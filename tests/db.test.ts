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

  it("derives month-end balance history from a single anchor", () => {
    const db = createDb(":memory:");
    const extraction = structuredClone(FIXTURE_EXTRACTION);
    extraction.transactions.push({ date: "2026-06-10", description: "June rent", amount: 100, direction: "debit", category: "Rent & Housing" });
    db.insertStatement(extraction, "july.pdf", "hash-1");
    const julyNet = FIXTURE_EXTRACTION.transactions
      .filter((t) => t.date.startsWith("2026-07"))
      .reduce((acc, t) => acc + (t.direction === "credit" ? toMinor(t.amount) : -toMinor(t.amount)), 0);
    expect(db.balanceHistory()).toEqual([
      { date: "2026-06-30", amount: toMinor(4187.42) - julyNet },
      { date: "2026-07-31", amount: toMinor(4187.42) },
    ]);
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
      t("2026-09-19", "Coffee Club", 5), // weekly, still active
      t("2026-09-26", "Coffee Club", 5),
      t("2026-10-03", "Coffee Club", 5.2),
      t("2026-06-01", "Old Box", 30), // monthly cadence but lapsed months ago
      t("2026-07-01", "Old Box", 30),
      t("2026-08-01", "Old Box", 30),
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

describe("accounts", () => {
  it("auto-creates an account from the statement's bank name", () => {
    const db = createDb(":memory:");
    insertFixture(db);
    expect(db.accounts()).toEqual([{ id: 1, name: "Fixture Bank", kind: "checking" }]);
    db.insertStatement({ ...FIXTURE_EXTRACTION, bank_name: "Other Bank" }, "aug.pdf", "hash-2");
    expect(db.accounts().map((a) => a.name)).toEqual(["Fixture Bank", "Other Bank"]);
  });

  it("uploads into an explicit account and filters queries by account", () => {
    const db = createDb(":memory:");
    const acc = db.findOrCreateAccount("Credit Card", "credit");
    insertFixture(db, "hash-1");
    const other = structuredClone(FIXTURE_EXTRACTION);
    other.transactions = [{ date: "2026-06-15", description: "Card purchase", amount: 50, direction: "debit", category: "Shopping" }];
    db.insertStatement(other, "card.pdf", "hash-2", acc);
    expect(db.months()).toEqual(["2026-07", "2026-06"]);
    expect(db.months(acc)).toEqual(["2026-06"]);
    expect(db.summary("2026-06", acc).spent).toBe(toMinor(50));
    expect(db.transactions("2026-06", acc)[0].account).toBe("Credit Card");
    // identical transactions in different accounts both survive dedup
    db.insertStatement(other, "card2.pdf", "hash-3");
    expect(db.searchTransactions("Card purchase")).toHaveLength(2);
  });

  it("sums the latest closing balance per account in the combined view", () => {
    const db = createDb(":memory:");
    insertFixture(db, "hash-1");
    const acc = db.findOrCreateAccount("Savings", "savings");
    db.insertStatement({ ...FIXTURE_EXTRACTION, closing_balance: 1000, period_end: "2026-07-15" }, "sav.pdf", "hash-2", acc);
    expect(db.balance()).toEqual({ amount: toMinor(4187.42 + 1000), asOf: "2026-07-31", source: "statement" });
    expect(db.balance(acc)).toEqual({ amount: toMinor(1000), asOf: "2026-07-15", source: "statement" });
  });

  it("tracks the selected account and ignores stale ids", () => {
    const db = createDb(":memory:");
    insertFixture(db);
    expect(db.selectedAccount()).toBeUndefined();
    db.setSetting("account", "1");
    expect(db.selectedAccount()).toBe(1);
    db.setSetting("account", "99");
    expect(db.selectedAccount()).toBeUndefined();
    db.setSetting("account", "all");
    expect(db.selectedAccount()).toBeUndefined();
  });
});

describe("category rules", () => {
  it("remember=true saves a rule, retro-applies it, and tags future uploads", () => {
    const db = createDb(":memory:");
    const extraction = structuredClone(FIXTURE_EXTRACTION);
    extraction.transactions.push(
      { date: "2026-07-10", description: "UBER EATS 1234", amount: 20, direction: "debit", category: "Other" },
      { date: "2026-07-12", description: "UBER EATS 9876", amount: 35, direction: "debit", category: "Other" }
    );
    db.insertStatement(extraction, "july.pdf", "hash-1");
    const target = db.searchTransactions("UBER EATS 1234")[0];
    db.setCategory(target.id, "Food & Dining", true);
    // both past rows recategorized, only the direct target marked overridden
    const rows = db.searchTransactions("UBER EATS");
    expect(rows.map((r) => r.category)).toEqual(["Food & Dining", "Food & Dining"]);
    expect(rows.find((r) => r.id === target.id)!.category_overridden).toBe(1);
    expect(db.ambiguous().map((t) => t.description)).not.toContain("UBER EATS 9876");
    // future uploads apply the rule over the model's guess
    const next = structuredClone(FIXTURE_EXTRACTION);
    next.transactions = [{ date: "2026-08-02", description: "UBER EATS 5555", amount: 18, direction: "debit", category: "Other" }];
    db.insertStatement(next, "aug.pdf", "hash-2");
    expect(db.searchTransactions("UBER EATS 5555")[0].category).toBe("Food & Dining");
  });

  it("remember=false changes only the one transaction", () => {
    const db = createDb(":memory:");
    insertFixture(db);
    const [a, b] = db.searchTransactions("Whole Harvest");
    db.setCategory(a.id, "Shopping");
    expect(db.transaction(a.id)!.category).toBe("Shopping");
    expect(db.transaction(b.id)!.category).toBe("Groceries");
    expect(db.rules().size).toBe(0);
  });

  it("a rule does not stomp manual overrides", () => {
    const db = createDb(":memory:");
    insertFixture(db);
    const [a, b, c] = db.searchTransactions("Whole Harvest");
    db.setCategory(a.id, "Shopping"); // manual override
    db.setCategory(b.id, "Food & Dining", true); // rule
    expect(db.transaction(a.id)!.category).toBe("Shopping");
    expect(db.transaction(c.id)!.category).toBe("Food & Dining");
  });
});

describe("manual transactions", () => {
  it("adds, edits, and deletes a manual transaction", () => {
    const db = createDb(":memory:");
    insertFixture(db);
    const acc = db.accounts()[0].id;
    const id = db.addTransaction({ accountId: acc, date: "2026-07-20", description: "Cash lunch", amount: toMinor(14), direction: "debit", category: "Food & Dining" });
    expect(db.transaction(id)).toMatchObject({ statement_id: null, description: "Cash lunch", amount: toMinor(14), category_overridden: 1 });
    db.updateTransaction(id, { amount: toMinor(16), category: "Groceries" });
    expect(db.transaction(id)).toMatchObject({ amount: toMinor(16), category: "Groceries" });
    db.deleteTransaction(id);
    expect(db.transaction(id)).toBeUndefined();
  });

  it("splits a transaction into parts that sum to the original", () => {
    const db = createDb(":memory:");
    insertFixture(db);
    const t = db.searchTransactions("Trailhead Outfitters").find((r) => r.direction === "debit")!;
    expect(() => db.splitTransaction(t.id, [{ amount: 100, category: "Shopping" }, { amount: 100, category: "Health" }])).toThrow();
    db.splitTransaction(t.id, [
      { amount: toMinor(100), category: "Shopping" },
      { amount: toMinor(37.62), category: "Health" },
    ]);
    const parts = db.searchTransactions("Trailhead Outfitters").filter((r) => r.direction === "debit");
    expect(parts.map((p) => [p.amount, p.category]).sort()).toEqual([
      [toMinor(100), "Shopping"],
      [toMinor(37.62), "Health"],
    ]);
    // the first part inherits the txn_hash, so an overlapping re-upload can't resurrect the original
    const again = db.insertStatement(FIXTURE_EXTRACTION, "july2.pdf", "hash-2");
    expect(again.inserted).toBe(0);
  });
});

describe("demo data", () => {
  it("clearDemo removes demo statements, empty accounts, and the flag", () => {
    const db = createDb(":memory:");
    db.insertStatement(FIXTURE_EXTRACTION, "demo.pdf", "demo-2026-07");
    db.setSetting("demo", "1");
    expect(db.months()).toEqual(["2026-07"]);
    db.clearDemo();
    expect(db.months()).toEqual([]);
    expect(db.accounts()).toEqual([]);
    expect(db.getSetting("demo")).toBeNull();
  });

  it("clearDemo keeps accounts that still hold real data", () => {
    const db = createDb(":memory:");
    db.insertStatement(FIXTURE_EXTRACTION, "demo.pdf", "demo-2026-07");
    db.insertStatement({ ...FIXTURE_EXTRACTION, period_start: "2026-08-01", period_end: "2026-08-31", transactions: [
      { date: "2026-08-02", description: "Real charge", amount: 10, direction: "debit", category: "Other" },
    ] }, "real.pdf", "hash-real");
    db.clearDemo();
    expect(db.accounts().map((a) => a.name)).toEqual(["Fixture Bank"]);
    expect(db.searchTransactions("Real charge")).toHaveLength(1);
  });
});

describe("export", () => {
  it("joins account and statement names onto every row", () => {
    const db = createDb(":memory:");
    insertFixture(db);
    const rows = db.exportRows();
    expect(rows).toHaveLength(FIXTURE_EXTRACTION.transactions.length);
    expect(rows[0]).toMatchObject({ account: "Fixture Bank", statement: "july.pdf" });
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
