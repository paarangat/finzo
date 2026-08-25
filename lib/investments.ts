import type { InvestmentRow } from "./db";

/** The instruments most Indian savers actually hold, in plain words. */
export const INVESTMENT_KINDS = {
  savings: { label: "Savings account", bucket: "cash" },
  fd: { label: "Fixed deposit", bucket: "debt" },
  rd: { label: "Recurring deposit", bucket: "debt" },
  mf_equity: { label: "Mutual fund · Equity", bucket: "equity" },
  mf_debt: { label: "Mutual fund · Debt", bucket: "debt" },
  stocks: { label: "Stocks", bucket: "equity" },
  ppf: { label: "PPF", bucket: "debt" },
  epf: { label: "EPF", bucket: "debt" },
  nps: { label: "NPS", bucket: "debt" },
  gold: { label: "Gold", bucket: "gold" },
} as const;

export type InvestmentKind = keyof typeof INVESTMENT_KINDS;
export type Bucket = (typeof INVESTMENT_KINDS)[InvestmentKind]["bucket"];

export const BUCKETS: { key: Bucket; label: string; color: string }[] = [
  { key: "equity", label: "Equity", color: "light-dark(#047857, #10b981)" },
  { key: "debt", label: "Debt", color: "light-dark(#2a78d6, #3987e5)" },
  { key: "cash", label: "Cash", color: "light-dark(#a1a1aa, #52525b)" },
  { key: "gold", label: "Gold", color: "light-dark(#eda100, #c98500)" },
];

export const kindLabel = (kind: string) => INVESTMENT_KINDS[kind as InvestmentKind]?.label ?? kind;

export interface Portfolio {
  total: number; // minor units
  gain: number | null; // total − invested, over rows that have a cost basis; null when none do
  buckets: { key: Bucket; label: string; color: string; value: number; share: number }[]; // only non-empty, by value desc
}

export function portfolio(rows: InvestmentRow[]): Portfolio {
  const total = rows.reduce((acc, r) => acc + r.value, 0);
  const withBasis = rows.filter((r) => r.invested !== null);
  const gain = withBasis.length ? withBasis.reduce((acc, r) => acc + r.value - r.invested!, 0) : null;
  const byBucket = new Map<Bucket, number>();
  for (const r of rows) {
    const bucket = INVESTMENT_KINDS[r.kind as InvestmentKind]?.bucket ?? "cash";
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + r.value);
  }
  const buckets = BUCKETS.filter((b) => byBucket.has(b.key))
    .map((b) => ({ ...b, value: byBucket.get(b.key)!, share: total > 0 ? byBucket.get(b.key)! / total : 0 }))
    .sort((a, b) => b.value - a.value);
  return { total, gain, buckets };
}
