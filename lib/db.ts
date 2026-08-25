import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Extraction } from "./schema";
import { NON_SPEND_CATEGORIES, type Category } from "./categories";

export interface Account {
  id: number;
  name: string;
  kind: "checking" | "savings" | "credit" | "cash";
}

export interface TransactionRow {
  id: number;
  statement_id: number | null;
  account_id: number;
  date: string;
  description: string;
  amount: number; // minor units, always positive; direction says which way
  direction: "debit" | "credit";
  category: Category;
  category_overridden: 0 | 1;
  account?: string; // joined account name
}

export interface Summary {
  spent: number;
  income: number;
  byCategory: { category: Category; total: number }[];
  byDay: { date: string; total: number }[];
  currency: string;
}

export interface Budget {
  category: Category;
  limit: number; // minor units, monthly
  spent: number; // minor units, for the requested month
}

export interface Balance {
  amount: number;
  asOf: string;
  source: "manual" | "statement";
}

export interface ExportRow {
  date: string;
  description: string;
  amount: number; // minor units
  direction: string;
  category: string;
  account: string;
  statement: string | null;
}

export interface Recurring {
  merchant: string;
  matcher: string; // normalized merchant key, used for overrides
  category: Category;
  cadence: "weekly" | "monthly" | "yearly";
  amount: number; // median, minor units
  lastDate: string;
  count: number;
  priceChanged: boolean;
  manual: boolean; // forced by a user override rather than detected
}

export interface Cashflow {
  month: string;
  income: number; // minor units, all credits (matches the dashboard income stat)
  spent: number; // minor units, debits excluding non-spend categories
}

export const toMinor = (n: number) => Math.round(n * 100);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const DAY = 86_400_000;
const CADENCES: { name: Recurring["cadence"]; min: number; max: number; perMonth: number }[] = [
  { name: "weekly", min: 6, max: 8, perMonth: 52 / 12 },
  { name: "monthly", min: 25, max: 35, perMonth: 1 },
  { name: "yearly", min: 350, max: 380, perMonth: 1 / 12 },
];
export const perMonth = (r: Recurring) => r.amount * CADENCES.find((c) => c.name === r.cadence)!.perMonth;

/** Projected charge dates for one recurring bill inside a calendar month ("YYYY-MM"). */
export function dueDatesInMonth(r: Recurring, month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const [, lm, ld] = r.lastDate.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (r.cadence === "weekly") {
    const monthEnd = Date.UTC(y, m - 1, daysInMonth);
    const out: string[] = [];
    for (let t = Date.parse(r.lastDate); t <= monthEnd; t += 7 * DAY) {
      const d = new Date(t);
      if (d.getUTCFullYear() === y && d.getUTCMonth() === m - 1) out.push(`${month}-${pad(d.getUTCDate())}`);
    }
    return out;
  }
  if (r.cadence === "yearly") return lm === m ? [`${month}-${pad(Math.min(ld, daysInMonth))}`] : [];
  // monthly: same day each month, clamped to short months
  return [`${month}-${pad(Math.min(ld, daysInMonth))}`];
}

const txnHash = (key: string) => createHash("sha256").update(key).digest("hex");

// "AMZN Mktp 1234" and "AMZN Mktp 9876" are the same merchant: drop digits/punctuation.
export const normalizeDesc = (d: string) => d.toLowerCase().replace(/[^a-z]+/g, " ").trim();

// Account ids are validated integers, safe to interpolate into a WHERE clause.
const accFilter = (accountId: number | undefined, col = "account_id") => {
  if (accountId === undefined) return "";
  if (!Number.isInteger(accountId)) throw new Error("Invalid account id");
  return ` AND ${col} = ${accountId}`;
};

export function createDb(file: string) {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'checking' CHECK (kind IN ('checking','savings','credit','cash')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS rules (
      matcher TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS statements (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL,
      file_hash TEXT NOT NULL UNIQUE,
      bank_name TEXT,
      currency TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      closing_balance INTEGER,
      account_id INTEGER REFERENCES accounts(id),
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY,
      statement_id INTEGER REFERENCES statements(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('debit','credit')),
      category TEXT NOT NULL,
      category_overridden INTEGER NOT NULL DEFAULT 0,
      txn_hash TEXT UNIQUE
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS budgets (category TEXT PRIMARY KEY, amount INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS recurring_overrides (
      matcher TEXT PRIMARY KEY,
      mode TEXT NOT NULL CHECK (mode IN ('exclude','include')),
      cadence TEXT CHECK (cadence IN ('weekly','monthly','yearly'))
    );
  `);

  // Migrate single-account databases: give existing rows a default account and
  // rebuild transactions (statement_id/txn_hash become nullable for manual rows).
  const stmtCols = (db.pragma("table_info(statements)") as { name: string }[]).map((c) => c.name);
  if (!stmtCols.includes("account_id")) {
    db.transaction(() => {
      const bank = (db.prepare("SELECT bank_name FROM statements ORDER BY id DESC LIMIT 1").get() as { bank_name: string | null } | undefined)
        ?.bank_name;
      const accountId = Number(db.prepare("INSERT INTO accounts (name) VALUES (?)").run(bank ?? "Main").lastInsertRowid);
      db.exec("ALTER TABLE statements ADD COLUMN account_id INTEGER REFERENCES accounts(id)");
      db.prepare("UPDATE statements SET account_id = ?").run(accountId);
      db.exec(`
        CREATE TABLE transactions_new (
          id INTEGER PRIMARY KEY,
          statement_id INTEGER REFERENCES statements(id) ON DELETE CASCADE,
          account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          description TEXT NOT NULL,
          amount INTEGER NOT NULL,
          direction TEXT NOT NULL CHECK (direction IN ('debit','credit')),
          category TEXT NOT NULL,
          category_overridden INTEGER NOT NULL DEFAULT 0,
          txn_hash TEXT UNIQUE
        );
        INSERT INTO transactions_new (id, statement_id, account_id, date, description, amount, direction, category, category_overridden, txn_hash)
          SELECT id, statement_id, ${accountId}, date, description, amount, direction, category, category_overridden, txn_hash FROM transactions;
        DROP TABLE transactions;
        ALTER TABLE transactions_new RENAME TO transactions;
      `);
    })();
  }
  db.pragma("foreign_keys = ON"); // ON DELETE CASCADE needs this in SQLite; after migration so the rebuild can drop freely

  const insertStatementStmt = db.prepare(
    `INSERT INTO statements (filename, file_hash, bank_name, currency, period_start, period_end, closing_balance, account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertTxnStmt = db.prepare(
    `INSERT OR IGNORE INTO transactions (statement_id, account_id, date, description, amount, direction, category, category_overridden, txn_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const selectTxns = "SELECT t.*, a.name AS account FROM transactions t JOIN accounts a ON a.id = t.account_id";

  const store = {
    raw: db,

    accounts(): Account[] {
      return db.prepare("SELECT id, name, kind FROM accounts ORDER BY id").all() as Account[];
    },

    findOrCreateAccount(name: string, kind: Account["kind"] = "checking"): number {
      db.prepare("INSERT OR IGNORE INTO accounts (name, kind) VALUES (?, ?)").run(name, kind);
      return (db.prepare("SELECT id FROM accounts WHERE name = ?").get(name) as { id: number }).id;
    },

    /** The account picked in the header switcher; undefined means "all accounts". */
    selectedAccount(): number | undefined {
      const id = Number(store.getSetting("account"));
      return Number.isInteger(id) && store.accounts().some((a) => a.id === id) ? id : undefined;
    },

    hasStatement(fileHash: string): boolean {
      return !!db.prepare("SELECT 1 FROM statements WHERE file_hash = ?").get(fileHash);
    },

    insertStatement(
      extraction: Extraction,
      filename: string,
      fileHash: string,
      accountId?: number
    ): { statementId: number; inserted: number; skipped: number } {
      const run = db.transaction(() => {
        const account = accountId ?? store.findOrCreateAccount(extraction.bank_name ?? "Main");
        const res = insertStatementStmt.run(
          filename,
          fileHash,
          extraction.bank_name,
          extraction.currency.toUpperCase(),
          extraction.period_start,
          extraction.period_end,
          extraction.closing_balance === null ? null : toMinor(extraction.closing_balance),
          account
        );
        const statementId = Number(res.lastInsertRowid);
        const rules = store.rules();
        let inserted = 0;
        // Legit same-day identical repeats (two identical orders) get an occurrence
        // number, so dedup only bites across overlapping statement uploads.
        const seen = new Map<string, number>();
        for (const t of extraction.transactions) {
          const amount = toMinor(t.amount);
          const key = `${account}|${t.date}|${t.description}|${amount}|${t.direction}`;
          const n = (seen.get(key) ?? 0) + 1;
          seen.set(key, n);
          const category = rules.get(normalizeDesc(t.description)) ?? t.category;
          const r = insertTxnStmt.run(statementId, account, t.date, t.description, amount, t.direction, category, 0, txnHash(`${key}|${n}`));
          inserted += r.changes;
        }
        return { statementId, inserted, skipped: extraction.transactions.length - inserted };
      });
      return run();
    },

    rules(): Map<string, Category> {
      const rows = db.prepare("SELECT matcher, category FROM rules").all() as { matcher: string; category: Category }[];
      return new Map(rows.map((r) => [r.matcher, r.category]));
    },

    // Uncategorized debits, each with a category guess voted by already-tagged
    // transactions from the same normalized merchant (null when no match).
    ambiguous(): (TransactionRow & { suggestion: Category | null })[] {
      const rows = db
        .prepare(
          `${selectTxns} WHERE direction = 'debit' AND category = 'Other' AND category_overridden = 0 ORDER BY date DESC, t.id DESC`
        )
        .all() as TransactionRow[];
      if (rows.length === 0) return [];
      const tagged = db
        .prepare("SELECT description, category FROM transactions WHERE category != 'Other'")
        .all() as { description: string; category: Category }[];
      const votes = new Map<string, Map<Category, number>>();
      for (const t of tagged) {
        const key = normalizeDesc(t.description);
        if (!key) continue;
        const m = votes.get(key) ?? new Map<Category, number>();
        m.set(t.category, (m.get(t.category) ?? 0) + 1);
        votes.set(key, m);
      }
      return rows.map((r) => {
        const m = votes.get(normalizeDesc(r.description));
        const suggestion = m ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
        return { ...r, suggestion };
      });
    },

    /** Display currency: the user's explicit choice, else the latest statement's. Formats only — amounts are never converted. */
    currency(): string {
      const chosen = store.getSetting("currency");
      if (chosen) return chosen;
      return (
        (db.prepare("SELECT currency FROM statements ORDER BY uploaded_at DESC, id DESC LIMIT 1").get() as { currency: string } | undefined)
          ?.currency ?? "USD"
      );
    },

    monthlyCashflow(accountId?: number): Cashflow[] {
      const nonSpend = NON_SPEND_CATEGORIES.map(() => "?").join(",");
      return db
        .prepare(
          `SELECT substr(date,1,7) AS month,
                  SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) AS income,
                  SUM(CASE WHEN direction = 'debit' AND category NOT IN (${nonSpend}) THEN amount ELSE 0 END) AS spent
           FROM transactions WHERE 1=1${accFilter(accountId)}
           GROUP BY month ORDER BY month`
        )
        .all(...NON_SPEND_CATEGORIES) as Cashflow[];
    },

    months(accountId?: number): string[] {
      return (
        db
          .prepare(`SELECT DISTINCT substr(date, 1, 7) AS m FROM transactions WHERE 1=1${accFilter(accountId)} ORDER BY m DESC`)
          .all() as { m: string }[]
      ).map((r) => r.m);
    },

    transactions(month: string, accountId?: number): TransactionRow[] {
      return db
        .prepare(`${selectTxns} WHERE substr(date, 1, 7) = ?${accFilter(accountId, "t.account_id")} ORDER BY date DESC, t.id DESC`)
        .all(month) as TransactionRow[];
    },

    transaction(id: number): TransactionRow | undefined {
      return db.prepare(`${selectTxns} WHERE t.id = ?`).get(id) as TransactionRow | undefined;
    },

    // ponytail: LIKE substring over description; FTS if it ever gets slow.
    searchTransactions(q: string): TransactionRow[] {
      return db
        .prepare(`${selectTxns} WHERE description LIKE '%' || ? || '%' COLLATE NOCASE ORDER BY date DESC, t.id DESC LIMIT 200`)
        .all(q) as TransactionRow[];
    },

    merchantTotal(q: string): { count: number; total: number } {
      return db
        .prepare(
          `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM transactions
           WHERE description LIKE '%' || ? || '%' COLLATE NOCASE AND direction = 'debit'`
        )
        .get(q) as { count: number; total: number };
    },

    summary(month: string, accountId?: number): Summary {
      const nonSpend = NON_SPEND_CATEGORIES.map(() => "?").join(",");
      const acc = accFilter(accountId);
      const spent = (db
        .prepare(`SELECT COALESCE(SUM(amount), 0) AS v FROM transactions WHERE substr(date,1,7) = ? AND direction = 'debit' AND category NOT IN (${nonSpend})${acc}`)
        .get(month, ...NON_SPEND_CATEGORIES) as { v: number }).v;
      const income = (db
        .prepare(`SELECT COALESCE(SUM(amount), 0) AS v FROM transactions WHERE substr(date,1,7) = ? AND direction = 'credit'${acc}`)
        .get(month) as { v: number }).v;
      const byCategory = db
        .prepare(
          `SELECT category, SUM(amount) AS total FROM transactions
           WHERE substr(date,1,7) = ? AND direction = 'debit' AND category NOT IN (${nonSpend})${acc}
           GROUP BY category ORDER BY total DESC`
        )
        .all(month, ...NON_SPEND_CATEGORIES) as Summary["byCategory"];
      const byDay = db
        .prepare(
          `SELECT date, SUM(amount) AS total FROM transactions
           WHERE substr(date,1,7) = ? AND direction = 'debit' AND category NOT IN (${nonSpend})${acc}
           GROUP BY date ORDER BY date`
        )
        .all(month, ...NON_SPEND_CATEGORIES) as Summary["byDay"];
      return { spent, income, byCategory, byDay, currency: store.currency() };
    },

    // Merchants charged ≥3 times at a steady gap (weekly/monthly/yearly) and steady amount (±20% of median).
    recurring(accountId?: number): Recurring[] {
      const rows = db
        .prepare(`SELECT date, description, amount, category FROM transactions WHERE direction = 'debit'${accFilter(accountId)} ORDER BY date, id`)
        .all() as { date: string; description: string; amount: number; category: Category }[];
      const groups = new Map<string, typeof rows>();
      for (const r of rows) {
        const k = normalizeDesc(r.description);
        groups.set(k, [...(groups.get(k) ?? []), r]);
      }
      const latest = rows.length ? Date.parse(rows[rows.length - 1].date) : 0;
      const overrides = new Map(
        (db.prepare("SELECT matcher, mode, cadence FROM recurring_overrides").all() as {
          matcher: string;
          mode: "exclude" | "include";
          cadence: Recurring["cadence"] | null;
        }[]).map((o) => [o.matcher, o])
      );
      const out: Recurring[] = [];
      for (const [matcher, g] of groups.entries()) {
        const override = overrides.get(matcher);
        if (override?.mode === "exclude") continue;
        const forced = override?.mode === "include" ? override.cadence ?? "monthly" : null;
        let cadence: Recurring["cadence"] | null = forced;
        if (!forced) {
          if (g.length < 3) continue;
          const gaps = g.slice(1).map((r, i) => (Date.parse(r.date) - Date.parse(g[i].date)) / DAY);
          const gap = median(gaps);
          const detected = CADENCES.find((c) => gap >= c.min && gap <= c.max);
          if (!detected) continue;
          // A charge last seen well past its cadence has lapsed — don't list it as active.
          if (latest - Date.parse(g[g.length - 1].date) > detected.max * 1.5 * DAY) continue;
          cadence = detected.name;
        }
        const amount = median(g.map((r) => r.amount));
        if (!forced && g.some((r) => Math.abs(r.amount - amount) > amount * 0.2)) continue;
        const [prev, last] = g.length >= 2 ? g.slice(-2) : [g[0], g[0]];
        out.push({
          merchant: last.description,
          matcher,
          category: last.category,
          cadence: cadence!,
          amount,
          lastDate: last.date,
          count: g.length,
          priceChanged: Math.abs(last.amount - prev.amount) > prev.amount * 0.05,
          manual: !!forced,
        });
      }
      return out.sort((a, b) => b.amount - a.amount);
    },

    /**
     * User correction to detection: 'exclude' hides a merchant from bills,
     * 'include' forces it in at the given cadence, null returns it to auto.
     * For 'include', the merchant must have at least one debit to project from.
     */
    setRecurringOverride(matcher: string, mode: "exclude" | "include" | null, cadence?: Recurring["cadence"]): void {
      if (mode === null) {
        db.prepare("DELETE FROM recurring_overrides WHERE matcher = ?").run(matcher);
        return;
      }
      db.prepare(
        `INSERT INTO recurring_overrides (matcher, mode, cadence) VALUES (?, ?, ?)
         ON CONFLICT(matcher) DO UPDATE SET mode = excluded.mode, cadence = excluded.cadence`
      ).run(matcher, mode, cadence ?? null);
    },

    /** True when at least one debit matches this normalized merchant (needed to force-include it as a bill). */
    hasMerchant(matcher: string): boolean {
      const rows = db.prepare("SELECT DISTINCT description FROM transactions WHERE direction = 'debit'").all() as { description: string }[];
      return rows.some((r) => normalizeDesc(r.description) === matcher);
    },

    /**
     * Recategorize one transaction. With `remember`, save a rule for the merchant
     * (applied to future uploads) and retroactively recategorize every past
     * transaction from the same merchant that wasn't manually overridden.
     */
    setCategory(id: number, category: Category, remember = false): void {
      const target = db.prepare("SELECT description FROM transactions WHERE id = ?").get(id) as { description: string } | undefined;
      if (!target) return;
      db.transaction(() => {
        db.prepare("UPDATE transactions SET category = ?, category_overridden = 1 WHERE id = ?").run(category, id);
        if (!remember) return;
        const matcher = normalizeDesc(target.description);
        if (!matcher) return;
        db.prepare("INSERT INTO rules (matcher, category) VALUES (?, ?) ON CONFLICT(matcher) DO UPDATE SET category = excluded.category").run(
          matcher,
          category
        );
        // Rule-driven rows keep category_overridden = 0 so a later rule change re-applies to them.
        const others = db
          .prepare("SELECT id, description FROM transactions WHERE category_overridden = 0 AND id != ?")
          .all(id) as { id: number; description: string }[];
        const update = db.prepare("UPDATE transactions SET category = ? WHERE id = ?");
        for (const o of others) if (normalizeDesc(o.description) === matcher) update.run(category, o.id);
      })();
    },

    /** Recategorize many transactions at once (bulk action in the table). Rows are marked overridden, no rules saved. */
    setCategoryBulk(ids: number[], category: Category): void {
      const update = db.prepare("UPDATE transactions SET category = ?, category_overridden = 1 WHERE id = ?");
      db.transaction(() => {
        for (const id of ids) update.run(category, id);
      })();
    },

    addTransaction(t: {
      accountId: number;
      date: string;
      description: string;
      amount: number; // minor units
      direction: "debit" | "credit";
      category: Category;
    }): number {
      const res = insertTxnStmt.run(null, t.accountId, t.date, t.description, t.amount, t.direction, t.category, 1, null);
      return Number(res.lastInsertRowid);
    },

    updateTransaction(
      id: number,
      patch: Partial<{ date: string; description: string; amount: number; direction: "debit" | "credit"; category: Category }>
    ): void {
      const sets: string[] = [];
      const vals: (string | number)[] = [];
      for (const key of ["date", "description", "amount", "direction"] as const) {
        if (patch[key] !== undefined) {
          sets.push(`${key} = ?`);
          vals.push(patch[key]);
        }
      }
      if (patch.category !== undefined) {
        sets.push("category = ?", "category_overridden = 1");
        vals.push(patch.category);
      }
      if (sets.length === 0) return;
      db.prepare(`UPDATE transactions SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
    },

    deleteTransaction(id: number): void {
      db.prepare("DELETE FROM transactions WHERE id = ?").run(id);
    },

    /**
     * Replace one transaction with parts that sum to its amount, each with its
     * own category. The first part inherits the txn_hash so statement dedup
     * still recognizes the original on overlapping uploads.
     */
    splitTransaction(id: number, parts: { amount: number; category: Category }[]): void {
      const t = db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) as
        | (TransactionRow & { txn_hash: string | null })
        | undefined;
      if (!t) throw new Error("Transaction not found");
      if (parts.length < 2) throw new Error("A split needs at least 2 parts");
      const sum = parts.reduce((acc, p) => acc + p.amount, 0);
      if (sum !== t.amount) throw new Error(`Parts sum to ${sum} but the transaction is ${t.amount}`);
      if (parts.some((p) => p.amount <= 0)) throw new Error("Each part must be positive");
      db.transaction(() => {
        db.prepare("DELETE FROM transactions WHERE id = ?").run(id);
        parts.forEach((p, i) => {
          insertTxnStmt.run(t.statement_id, t.account_id, t.date, t.description, p.amount, t.direction, p.category, 1, i === 0 ? t.txn_hash : null);
        });
      })();
    },

    getSetting(key: string): string | null {
      return (db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? null;
    },

    setSetting(key: string, value: string): void {
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
    },

    /** Monthly take-home salary in minor units; drives rule-of-thumb targets. */
    salary(): number | null {
      const v = Number(store.getSetting("salary"));
      return Number.isFinite(v) && v > 0 ? v : null;
    },

    setSalary(amountMinor: number | null): void {
      if (amountMinor === null) db.prepare("DELETE FROM settings WHERE key = 'salary'").run();
      else store.setSetting("salary", String(amountMinor));
    },

    /** User's age in years; drives the 100-minus-age equity allocation suggestion. */
    age(): number | null {
      const v = Number(store.getSetting("age"));
      return Number.isInteger(v) && v >= 10 && v <= 100 ? v : null;
    },

    setAge(years: number | null): void {
      if (years === null) db.prepare("DELETE FROM settings WHERE key = 'age'").run();
      else store.setSetting("age", String(years));
    },

    setManualBalance(amountMinor: number): void {
      store.setSetting("manual_balance", String(amountMinor));
      store.setSetting("manual_balance_at", new Date().toISOString().slice(0, 10));
    },

    setBudget(category: Category, amountMinor: number | null): void {
      if (NON_SPEND_CATEGORIES.includes(category)) throw new Error(`Cannot budget ${category}`);
      if (amountMinor === null) db.prepare("DELETE FROM budgets WHERE category = ?").run(category);
      else db.prepare("INSERT INTO budgets (category, amount) VALUES (?, ?) ON CONFLICT(category) DO UPDATE SET amount = excluded.amount").run(category, amountMinor);
    },

    budgets(month: string): Budget[] {
      return db
        .prepare(
          `SELECT b.category, b.amount AS "limit",
                  COALESCE((SELECT SUM(t.amount) FROM transactions t
                            WHERE t.category = b.category AND t.direction = 'debit' AND substr(t.date,1,7) = ?), 0) AS spent
           FROM budgets b ORDER BY b.category`
        )
        .all(month) as Budget[];
    },

    /**
     * Per account: the latest statement closing balance. Across all accounts:
     * their sum — with "whichever is fresher" semantics for the manual entry
     * (manual wins if made on/after the latest statement's period end).
     */
    balance(accountId?: number): Balance | null {
      const latestPerAccount = db
        .prepare(
          `SELECT account_id, closing_balance, MAX(period_end) AS period_end FROM statements
           WHERE closing_balance IS NOT NULL${accFilter(accountId)} GROUP BY account_id`
        )
        .all() as { closing_balance: number; period_end: string }[];
      const fromStatements =
        latestPerAccount.length > 0
          ? {
              amount: latestPerAccount.reduce((acc, r) => acc + r.closing_balance, 0),
              asOf: latestPerAccount.map((r) => r.period_end).sort().at(-1)!,
              source: "statement" as const,
            }
          : null;
      if (accountId !== undefined) return fromStatements; // manual entry is a whole-picture number, not per-account
      const manual = store.getSetting("manual_balance");
      const manualAt = store.getSetting("manual_balance_at");
      if (manual !== null && manualAt !== null && (!fromStatements || manualAt >= fromStatements.asOf)) {
        return { amount: Number(manual), asOf: manualAt, source: "manual" };
      }
      return fromStatements;
    },

    // Statement closing balances over time, plus the manual entry when it is the freshest point.
    balanceHistory(accountId?: number): { date: string; amount: number }[] {
      const acc = accFilter(accountId);
      const points = db
        .prepare(`SELECT period_end AS date, closing_balance AS amount FROM statements WHERE closing_balance IS NOT NULL${acc} ORDER BY period_end`)
        .all() as { date: string; amount: number }[];
      if (accountId === undefined) {
        const manual = store.getSetting("manual_balance");
        const manualAt = store.getSetting("manual_balance_at");
        if (manual !== null && manualAt !== null && (points.length === 0 || manualAt > points[points.length - 1].date)) {
          points.push({ date: manualAt, amount: Number(manual) });
        }
      }
      if (points.length !== 1) return points;
      // One lone anchor draws no line: reconstruct earlier month-end balances
      // by walking net cash flow (all directions, all categories) back from it.
      const anchor = points[0];
      const flow = db.prepare(
        `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) AS v FROM transactions WHERE date > ? AND date <= ?${acc}`
      );
      const derived: { date: string; amount: number }[] = [];
      for (const m of store.months(accountId).slice().reverse()) {
        const [y, mo] = m.split("-").map(Number);
        const end = `${m}-${String(new Date(y, mo, 0).getDate()).padStart(2, "0")}`;
        if (end >= anchor.date) continue;
        const net = (flow.get(end, anchor.date) as { v: number }).v;
        derived.push({ date: end, amount: anchor.amount - net });
      }
      return [...derived, ...points];
    },

    /** All demo statements share the 'demo-' file_hash prefix; clearing removes them and any account left empty. */
    clearDemo(): void {
      db.transaction(() => {
        db.prepare("DELETE FROM statements WHERE file_hash LIKE 'demo-%'").run();
        db.prepare(
          `DELETE FROM accounts WHERE id NOT IN (SELECT DISTINCT account_id FROM transactions)
           AND id NOT IN (SELECT DISTINCT account_id FROM statements WHERE account_id IS NOT NULL)`
        ).run();
        db.prepare("DELETE FROM settings WHERE key = 'demo'").run();
      })();
    },

    exportRows(): ExportRow[] {
      return db
        .prepare(
          `SELECT t.date, t.description, t.amount, t.direction, t.category, a.name AS account, s.filename AS statement
           FROM transactions t JOIN accounts a ON a.id = t.account_id LEFT JOIN statements s ON s.id = t.statement_id
           ORDER BY t.date, t.id`
        )
        .all() as ExportRow[];
    },
  };
  return store;
}

export type Store = ReturnType<typeof createDb>;

let singleton: Store | null = null;
export function getDb(): Store {
  singleton ??= createDb(path.join(process.cwd(), "data", "finzo.db"));
  return singleton;
}
