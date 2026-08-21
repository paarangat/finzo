import { describe, expect, it } from "vitest";
import { createDb, toMinor } from "../lib/db";
import { FIXTURE_EXTRACTION } from "../lib/engines/fixture";

const insertFixture = (db: ReturnType<typeof createDb>, hash = "hash-1") =>
  db.insertStatement(FIXTURE_EXTRACTION, "july.pdf", hash);

describe("store", () => {
  it("inserts a statement and its transactions", () => {
    const db = createDb(":memory:");
    const res = insertFixture(db);
    expect(res.inserted).toBe(FIXTURE_EXTRACTION.transactions.length);
    expect(db.months()).toEqual(["2026-07"]);
    expect(db.transactions("2026-07")).toHaveLength(res.inserted);
  });

  it("dedupes identical transactions across overlapping statements", () => {
    const db = createDb(":memory:");
    insertFixture(db, "hash-1");
    const second = insertFixture(db, "hash-2");
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(FIXTURE_EXTRACTION.transactions.length);
    expect(db.transactions("2026-07")).toHaveLength(FIXTURE_EXTRACTION.transactions.length);
  });

  it("rejects re-uploading the same file via hasStatement", () => {
    const db = createDb(":memory:");
    insertFixture(db);
    expect(db.hasStatement("hash-1")).toBe(true);
    expect(db.hasStatement("hash-other")).toBe(false);
  });

  it("computes summary excluding Transfers and Income from spend", () => {
    const db = createDb(":memory:");
    insertFixture(db);
    const s = db.summary("2026-07");
    const expectedSpent = FIXTURE_EXTRACTION.transactions
      .filter((t) => t.direction === "debit" && t.category !== "Transfers" && t.category !== "Income")
      .reduce((acc, t) => acc + toMinor(t.amount), 0);
    const expectedIncome = FIXTURE_EXTRACTION.transactions
      .filter((t) => t.direction === "credit")
      .reduce((acc, t) => acc + toMinor(t.amount), 0);
    expect(s.spent).toBe(expectedSpent);
    expect(s.income).toBe(expectedIncome);
    expect(s.byCategory[0].total).toBeGreaterThanOrEqual(s.byCategory.at(-1)!.total);
    expect(s.byCategory.map((c) => c.category)).not.toContain("Transfers");
    expect(s.currency).toBe("USD");
    expect(s.byDay.reduce((acc, d) => acc + d.total, 0)).toBe(expectedSpent);
  });

  it("re-categorizing updates summary and marks the override", () => {
    const db = createDb(":memory:");
    insertFixture(db);
    const txn = db.transactions("2026-07").find((t) => t.description === "Netflix")!;
    db.setCategory(txn.id, "Entertainment");
    const updated = db.transactions("2026-07").find((t) => t.id === txn.id)!;
    expect(updated.category).toBe("Entertainment");
    expect(updated.category_overridden).toBe(1);
    expect(db.summary("2026-07").byCategory.find((c) => c.category === "Subscriptions")!.total).toBe(toMinor(11.99));
  });

  it("balance prefers the statement until a newer manual entry exists", () => {
    const db = createDb(":memory:");
    expect(db.balance()).toBeNull();
    insertFixture(db);
    expect(db.balance()).toEqual({ amount: toMinor(4187.42), asOf: "2026-07-31", source: "statement" });
    db.setManualBalance(toMinor(3900));
    const b = db.balance()!;
    expect(b.source).toBe("manual");
    expect(b.amount).toBe(toMinor(3900));
  });
});
