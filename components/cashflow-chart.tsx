import Link from "next/link";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import type { Cashflow } from "@/lib/db";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BAR_MAX_PX = 140;

export function CashflowChart({ data, current, currency }: { data: Cashflow[]; current: string; currency: string }) {
  const max = Math.max(...data.flatMap((d) => [d.income, d.spent]), 1);
  const px = (v: number) => Math.max(Math.round((v / max) * BAR_MAX_PX), v > 0 ? 3 : 0);
  return (
    <div>
      <div className="flex items-end gap-3">
        {data.map((d) => {
          const net = d.income - d.spent;
          return (
            <Link
              key={d.month}
              href={`/?month=${d.month}`}
              className={`group flex flex-1 flex-col items-center gap-1.5 transition-opacity ${
                d.month === current ? "" : "opacity-50 hover:opacity-80"
              }`}
              aria-label={`${d.month}: ${formatMoney(d.income, currency)} in, ${formatMoney(d.spent, currency)} out`}
            >
              <span
                className={`hidden font-mono text-[11px] tabular-nums sm:block ${net >= 0 ? "text-accent" : "text-red-600 dark:text-red-400"}`}
                title={`Net ${formatMoney(net, currency)}`}
              >
                {net >= 0 ? "+" : "−"}
                {formatMoneyCompact(Math.abs(net), currency)}
              </span>
              <span className="flex w-full max-w-14 items-end justify-center gap-1">
                <span className="w-1/2 rounded-t-[4px] bg-accent" style={{ height: px(d.income) }} title={`In ${formatMoney(d.income, currency)}`} />
                <span
                  className="w-1/2 rounded-t-[4px] bg-zinc-300 dark:bg-zinc-600"
                  style={{ height: px(d.spent) }}
                  title={`Out ${formatMoney(d.spent, currency)}`}
                />
              </span>
              <span className={`text-xs ${d.month === current ? "font-medium" : "text-zinc-500"}`}>
                {MONTH_ABBR[Number(d.month.slice(5)) - 1]}
              </span>
            </Link>
          );
        })}
      </div>
      <p className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-[2px] bg-accent" /> Income
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-[2px] bg-zinc-300 dark:bg-zinc-600" /> Spending
        </span>
      </p>
    </div>
  );
}
