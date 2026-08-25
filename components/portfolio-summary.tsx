import { formatMoney, formatMoneyWhole } from "@/lib/format";
import { portfolio } from "@/lib/investments";
import type { InvestmentRow } from "@/lib/db";

/** Total, gain, and allocation bar for a set of holdings. Used on the overview (summary) and the invest page (header). */
export function PortfolioSummary({ rows, currency, age }: { rows: InvestmentRow[]; currency: string; age: number | null }) {
  const { total, gain, buckets } = portfolio(rows);
  const equityShare = buckets.find((b) => b.key === "equity")?.share ?? 0;
  const asOf = rows.reduce((acc, r) => (r.updated_at > acc ? r.updated_at : acc), "");

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="font-mono text-2xl tabular-nums tracking-tight">{formatMoney(total, currency)}</p>
        {gain !== null && (
          <p className={`font-mono text-sm tabular-nums ${gain >= 0 ? "text-accent" : "text-red-600 dark:text-red-400"}`}>
            {gain >= 0 ? "+" : ""}
            {formatMoneyWhole(gain, currency)} all-time
          </p>
        )}
        {asOf && <p className="text-xs text-zinc-400 dark:text-zinc-500">as of {asOf}</p>}
      </div>
      <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full">
        {buckets.map((b) => (
          <div key={b.key} style={{ width: `${b.share * 100}%`, background: b.color }} title={`${b.label} ${Math.round(b.share * 100)}%`} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
        {buckets.map((b) => (
          <span key={b.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-[2px]" style={{ background: b.color }} />
            {b.label} <span className="font-mono tabular-nums">{Math.round(b.share * 100)}%</span> ·{" "}
            <span className="font-mono tabular-nums">{formatMoneyWhole(b.value, currency)}</span>
          </span>
        ))}
      </div>
      {age !== null && buckets.length > 0 && (
        <p className="mt-2.5 text-xs text-zinc-500">
          Rule of thumb at {age}: hold ~{100 - age}% in equity — you&apos;re at{" "}
          <span className="font-mono tabular-nums">{Math.round(equityShare * 100)}%</span>.
        </p>
      )}
    </div>
  );
}
