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

  it("keeps legitimate identical same-day transactions within one statement", () => {
    const db = createDb(":memory:");
    const extraction = structuredClone(FIXTURE_EXTRACTION);
    extraction.transactions.push({ ...extraction.transactions[5] }, { ...extraction.transactions[5] });
    const res = db.insertStatement(extraction, "july.pdf", "hash-1");
    expect(res.inserted).toBe(extraction.transactions.length);
    // ...but a second overlapping statement still can't double-count them
    const again = db.insertStatement(extraction, "july-again.pdf", "hash-2");
    expect(again.inserted).toBe(0);
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
    expect(db.monthlySpend()).toEqual([{ month: "2026-07", total: expectedSpent }]);
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

  it("searches descriptions case-insensitively and totals debits only", () => {
    const db = createDb(":memory:");
    insertFixture(db);
    const hits = db.searchTransactions("trailhead");
    expect(hits.map((t) => t.description).sort()).toEqual(["Refund - Trailhead Outfitters", "Trailhead Outfitters"]);
    expect(db.merchantTotal("TRAILHEAD")).toEqual({ count: 1, total: toMinor(137.62) });
    expect(db.merchantTotal("whole harvest")).toEqual({ count: 3, total: toMinor(86.34 + 102.11 + 77.48) });
    expect(db.searchTransactions("nope")).toEqual([]);
  });

  it("lists ambiguous debits with merchant-based suggestions", () => {
    const db = createDb(":memory:");
    const extraction = structuredClone(FIXTURE_EXTRACTION);
    extraction.transactions.push(
      { date: "2026-07-10", description: "AMZN Mktp 1234", amount: 20, direction: "debit", category: "Other" },
      { date: "2026-07-12", description: "AMZN Mktp 9876", amount: 35, direction: "debit", category: "Shopping" },
      { date: "2026-07-13", description: "MYSTERY POS 77", amount: 5, direction: "debit", category: "Other" }
    );
    db.insertStatement(extraction, "july.pdf", "hash-1");
    const deck = db.ambiguous();
    // debits only (the fixture's "Other" refund is a credit), newest first
    expect(deck.map((t) => t.description)).toEqual(["MYSTERY POS 77", "AMZN Mktp 1234"]);
    expect(deck[1].suggestion).toBe("Shopping"); // same merchant modulo digits
    expect(deck[0].suggestion).toBeNull();
    db.setCategory(deck[1].id, "Shopping");
    expect(db.ambiguous().map((t) => t.description)).toEqual(["MYSTERY POS 77"]);
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

  it("detects recurring charges by steady gap and amount", () => {
    const db = createDb(":memory:");
    const extraction = structuredClone(FIXTURE_EXTRACTION);
    const t = (date: string, description: string, amount: number) => ({ date, description, amount, direction: "debit" as const, category: "Subscriptions" as const });
    extraction.transactions = [
      ...extraction.transactions, // contains Netflix 15.49 on 2026-07-05
      t("2026-08-05", "NETFLIX *8831", 15.49),
      t("2026-09-04", "Netflix", 15.49),
      t("2026-10-05", "Netflix", 17.99), // price rise
      t("2026-07-01", "Gym", 40), // only 2 charges
      t("2026-08-01", "Gym", 40),
      t("2026-07-02", "Random Shop", 20), // irregular gaps
      t("2026-07-10", "Random Shop", 20),
      t("2026-09-25", "Random Shop", 20),
      t("2026-07-03", "Coffee Club", 5), // weekly
      t("2026-07-10", "Coffee Club", 5),
      t("2026-07-17", "Coffee Club", 5.2),
    ];
    db.insertStatement(extraction, "multi.pdf", "hash-1");
    const rec = db.recurring();
    expect(rec.map((r) => r.merchant)).toEqual(["Netflix", "Coffee Club"]);
    const netflix = rec[0];
    expect(netflix).toMatchObject({ cadence: "monthly", count: 4, lastDate: "2026-10-05", priceChanged: true, category: "Subscriptions" });
    expect(netflix.amount).toBe(toMinor(15.49));
    expect(rec[1]).toMatchObject({ cadence: "weekly", count: 3, priceChanged: false });
  });

  it("budgets join monthly spend with limits and clear on null", () => {
    const db = createDb(":memory:");
    insertFixture(db);
    const groceries = db.summary("2026-07").byCategory.find((c) => c.category === "Groceries")!.total;
    db.setBudget("Groceries", toMinor(500));
    db.setBudget("Travel", toMinor(200)); // no Travel spend this month
    expect(db.budgets("2026-07")).toEqual([
      { category: "Groceries", limit: toMinor(500), spent: groceries },
      { category: "Travel", limit: toMinor(200), spent: 0 },
    ]);
    db.setBudget("Groceries", toMinor(600));
    expect(db.budgets("2026-07")[0].limit).toBe(toMinor(600));
    db.setBudget("Groceries", null);
    db.setBudget("Travel", null);
    expect(db.budgets("2026-07")).toEqual([]);
    expect(() => db.setBudget("Transfers", toMinor(1))).toThrow();
  });
});

describe("balanceHistory", () => {
  const withStatement = (db: ReturnType<typeof createDb>, periodEnd: string, closing: number | null, hash: string) =>
    db.insertStatement({ ...FIXTURE_EXTRACTION, period_end: periodEnd, closing_balance: closing, transactions: [] }, `${hash}.pdf`, hash);

  it("returns statements sorted by period end, skipping NULL closing balances", () => {
    const db = createDb(":memory:");
    withStatement(db, "2026-07-31", 4187.42, "h2");
    withStatement(db, "2026-05-31", 1000, "h1");
    withStatement(db, "2026-06-30", null, "h-null");
    expect(db.balanceHistory()).toEqual([
      { date: "2026-05-31", amount: toMinor(1000) },
      { date: "2026-07-31", amount: toMinor(4187.42) },
    ]);
  });

  it("appends the manual balance only when it is newer than the latest statement", () => {
    const db = createDb(":memory:");
    withStatement(db, "2026-07-31", 4187.42, "h2");
    db.setSetting("manual_balance", String(toMinor(3900)));
    db.setSetting("manual_balance_at", "2026-07-15");
    expect(db.balanceHistory()).toHaveLength(1);
    db.setSetting("manual_balance_at", "2026-08-10");
    expect(db.balanceHistory().at(-1)).toEqual({ date: "2026-08-10", amount: toMinor(3900) });
  });
});
