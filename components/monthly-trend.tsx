import Link from "next/link";
import { formatMoney } from "@/lib/format";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthlyTrend({
  data,
  current,
  currency,
}: {
  data: { month: string; total: number }[];
  current: string;
  currency: string;
}) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex h-44 items-end gap-3">
      {data.map((d) => (
        <Link
          key={d.month}
          href={`/?month=${d.month}`}
          className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
          aria-label={`${d.month}: ${formatMoney(d.total, currency)}`}
        >
          <span className="font-mono text-xs tabular-nums text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100">
            {formatMoney(d.total, currency)}
          </span>
          <div
            className={`w-full max-w-14 rounded-t-[4px] bg-accent transition-opacity ${
              d.month === current ? "" : "opacity-35 group-hover:opacity-60"
            }`}
            style={{ height: `${Math.max((d.total / max) * 100, 2)}%` }}
          />
          <span className={`text-xs ${d.month === current ? "font-medium" : "text-zinc-500"}`}>
            {MONTH_ABBR[Number(d.month.slice(5)) - 1]}
          </span>
        </Link>
      ))}
    </div>
  );
}
