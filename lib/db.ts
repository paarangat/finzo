import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Extraction } from "./schema";
import { NON_SPEND_CATEGORIES, type Category } from "./categories";

export interface TransactionRow {
  id: number;
  statement_id: number;
  date: string;
  description: string;
  amount: number; // minor units, always positive; direction says which way
  direction: "debit" | "credit";
  category: Category;
  category_overridden: 0 | 1;
}

export interface Summary {
  spent: number;
  income: number;
  byCategory: { category: Category; total: number }[];
  byDay: { date: string; total: number }[];
  currency: string;
}

export interface Balance {
  amount: number;
  asOf: string;
  source: "manual" | "statement";
}

export interface Recurring {
  merchant: string;
  category: Category;
  cadence: "weekly" | "monthly" | "yearly";
  amount: number; // median, minor units
  lastDate: string;
  count: number;
  priceChanged: boolean;
}

export const toMinor = (n: number) => Math.round(n * 100);

// "NETFLIX.COM 1234  *REF 99" -> "netflix com ref": merchant identity without the noise.
export const normalizeDesc = (d: string) => d.toLowerCase().replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();

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

const txnHash = (key: string) => createHash("sha256").update(key).digest("hex");

export function createDb(file: string) {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON"); // ON DELETE CASCADE needs this in SQLite
  db.exec(`
    CREATE TABLE IF NOT EXISTS statements (
      id INTEGER PRIMARY KEY,
      filename TEXT NOT NULL,
      file_hash TEXT NOT NULL UNIQUE,
      bank_name TEXT,
      currency TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      closing_balance INTEGER,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY,
      statement_id INTEGER NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('debit','credit')),
      category TEXT NOT NULL,
      category_overridden INTEGER NOT NULL DEFAULT 0,
      txn_hash TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);

  const insertStatementStmt = db.prepare(
    `INSERT INTO statements (filename, file_hash, bank_name, currency, period_start, period_end, closing_balance)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertTxnStmt = db.prepare(
    `INSERT OR IGNORE INTO transactions (statement_id, date, description, amount, direction, category, txn_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const store = {
    raw: db,

    hasStatement(fileHash: string): boolean {
      return !!db.prepare("SELECT 1 FROM statements WHERE file_hash = ?").get(fileHash);
    },

    insertStatement(extraction: Extraction, filename: string, fileHash: string): { statementId: number; inserted: number; skipped: number } {
      const run = db.transaction(() => {
        const res = insertStatementStmt.run(
          filename,
          fileHash,
          extraction.bank_name,
          extraction.currency.toUpperCase(),
          extraction.period_start,
          extraction.period_end,
          extraction.closing_balance === null ? null : toMinor(extraction.closing_balance)
        );
        const statementId = Number(res.lastInsertRowid);
        let inserted = 0;
        // Legit same-day identical repeats (two identical orders) get an occurrence
        // number, so dedup only bites across overlapping statement uploads.
        const seen = new Map<string, number>();
        for (const t of extraction.transactions) {
          const amount = toMinor(t.amount);
          const key = `${t.date}|${t.description}|${amount}|${t.direction}`;
          const n = (seen.get(key) ?? 0) + 1;
          seen.set(key, n);
          const r = insertTxnStmt.run(statementId, t.date, t.description, amount, t.direction, t.category, txnHash(`${key}|${n}`));
          inserted += r.changes;
        }
        return { statementId, inserted, skipped: extraction.transactions.length - inserted };
      });
      return run();
    },

    monthlySpend(): { month: string; total: number }[] {
      const nonSpend = NON_SPEND_CATEGORIES.map(() => "?").join(",");
      return db
        .prepare(
          `SELECT substr(date,1,7) AS month, SUM(amount) AS total FROM transactions
           WHERE direction = 'debit' AND category NOT IN (${nonSpend})
           GROUP BY month ORDER BY month`
        )
        .all(...NON_SPEND_CATEGORIES) as { month: string; total: number }[];
    },

    months(): string[] {
      return (db.prepare("SELECT DISTINCT substr(date, 1, 7) AS m FROM transactions ORDER BY m DESC").all() as { m: string }[]).map((r) => r.m);
    },

    transactions(month: string): TransactionRow[] {
      return db
        .prepare("SELECT * FROM transactions WHERE substr(date, 1, 7) = ? ORDER BY date DESC, id DESC")
        .all(month) as TransactionRow[];
    },

    summary(month: string): Summary {
      const nonSpend = NON_SPEND_CATEGORIES.map(() => "?").join(",");
      const spent = (db
        .prepare(`SELECT COALESCE(SUM(amount), 0) AS v FROM transactions WHERE substr(date,1,7) = ? AND direction = 'debit' AND category NOT IN (${nonSpend})`)
        .get(month, ...NON_SPEND_CATEGORIES) as { v: number }).v;
      const income = (db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS v FROM transactions WHERE substr(date,1,7) = ? AND direction = 'credit'")
        .get(month) as { v: number }).v;
      const byCategory = db
        .prepare(
          `SELECT category, SUM(amount) AS total FROM transactions
           WHERE substr(date,1,7) = ? AND direction = 'debit' AND category NOT IN (${nonSpend})
           GROUP BY category ORDER BY total DESC`
        )
        .all(month, ...NON_SPEND_CATEGORIES) as Summary["byCategory"];
      const byDay = db
        .prepare(
          `SELECT date, SUM(amount) AS total FROM transactions
           WHERE substr(date,1,7) = ? AND direction = 'debit' AND category NOT IN (${nonSpend})
           GROUP BY date ORDER BY date`
        )
        .all(month, ...NON_SPEND_CATEGORIES) as Summary["byDay"];
      const currency =
        (db.prepare("SELECT currency FROM statements ORDER BY uploaded_at DESC, id DESC LIMIT 1").get() as { currency: string } | undefined)
          ?.currency ?? "USD";
      return { spent, income, byCategory, byDay, currency };
    },

    // Merchants charged ≥3 times at a steady gap (weekly/monthly/yearly) and steady amount (±20% of median).
    recurring(): Recurring[] {
      const rows = db
        .prepare("SELECT date, description, amount, category FROM transactions WHERE direction = 'debit' ORDER BY date, id")
        .all() as { date: string; description: string; amount: number; category: Category }[];
      const groups = new Map<string, typeof rows>();
      for (const r of rows) {
        const k = normalizeDesc(r.description);
        groups.set(k, [...(groups.get(k) ?? []), r]);
      }
      const out: Recurring[] = [];
      for (const g of groups.values()) {
        if (g.length < 3) continue;
        const gaps = g.slice(1).map((r, i) => (Date.parse(r.date) - Date.parse(g[i].date)) / DAY);
        const gap = median(gaps);
        const cadence = CADENCES.find((c) => gap >= c.min && gap <= c.max);
        if (!cadence) continue;
        const amount = median(g.map((r) => r.amount));
        if (g.some((r) => Math.abs(r.amount - amount) > amount * 0.2)) continue;
        const [prev, last] = g.slice(-2);
        out.push({
          merchant: last.description,
          category: last.category,
          cadence: cadence.name,
          amount,
          lastDate: last.date,
          count: g.length,
          priceChanged: Math.abs(last.amount - prev.amount) > prev.amount * 0.05,
        });
      }
      return out.sort((a, b) => b.amount - a.amount);
    },

    setCategory(id: number, category: Category): void {
      db.prepare("UPDATE transactions SET category = ?, category_overridden = 1 WHERE id = ?").run(category, id);
    },

    getSetting(key: string): string | null {
      return (db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? null;
    },

    setSetting(key: string, value: string): void {
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
    },

    setManualBalance(amountMinor: number): void {
      store.setSetting("manual_balance", String(amountMinor));
      store.setSetting("manual_balance_at", new Date().toISOString().slice(0, 10));
    },

    // "Whichever is fresher": manual entry wins if made on/after the latest statement's period end.
    balance(): Balance | null {
      const manual = store.getSetting("manual_balance");
      const manualAt = store.getSetting("manual_balance_at");
      const latest = db
        .prepare("SELECT closing_balance, period_end FROM statements WHERE closing_balance IS NOT NULL ORDER BY period_end DESC LIMIT 1")
        .get() as { closing_balance: number; period_end: string } | undefined;
      if (manual !== null && manualAt !== null && (!latest || manualAt >= latest.period_end)) {
        return { amount: Number(manual), asOf: manualAt, source: "manual" };
      }
      if (latest) return { amount: latest.closing_balance, asOf: latest.period_end, source: "statement" };
      return null;
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
