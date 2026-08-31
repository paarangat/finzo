"use client";

import { useState } from "react";
import { categoryColor } from "@/lib/colors";
import { formatDay, formatMoney } from "@/lib/format";
import { Dialog } from "@/components/dialog";
import type { TransactionRow } from "@/lib/db";
import type { RuleCheck } from "@/lib/rules";

const FILL = { good: "bg-accent", warn: "bg-amber-500", bad: "bg-red-500" } as const;
const TEXT = {
  good: "text-accent",
  warn: "text-amber-600 dark:text-amber-500",
  bad: "text-red-600 dark:text-red-400",
} as const;

/** Debits in the rule's categories — mirrors the summary SQL that produced the headline. */
const rowsFor = (check: RuleCheck, transactions: TransactionRow[]) =>
  check.categories
    ? transactions.filter((t) => t.direction === "debit" && check.categories!.includes(t.category)).sort((a, b) => b.amount - a.amount)
    : [];

function Breakdown({ check, transactions, currency }: { check: RuleCheck; transactions: TransactionRow[]; currency: string }) {
  const rows = rowsFor(check, transactions);
  const total = rows.reduce((acc, t) => acc + t.amount, 0);
  const byCategory = [...rows.reduce((m, t) => m.set(t.category, (m.get(t.category) ?? 0) + t.amount), new Map<string, number>())].sort(
    (a, b) => b[1] - a[1]
  );

  if (rows.length === 0) return <p className="text-sm text-zinc-500">No transactions in this month.</p>;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {byCategory.map(([category, amount]) => (
          <div key={category} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: categoryColor(category) }} />
                {category}
              </span>
              <span className="font-mono tabular-nums text-zinc-500">
                {formatMoney(amount, currency)} · {Math.round((amount / total) * 100)}%
              </span>
            </div>
            <div className="h-1 rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-1 rounded-full"
                style={{ width: `${(amount / total) * 100}%`, background: categoryColor(category) }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-zinc-100 first:border-t-0 dark:border-zinc-800/70">
                <td className="whitespace-nowrap py-1.5 pr-3 font-mono tabular-nums text-zinc-500">{formatDay(t.date)}</td>
                <td className="w-full truncate py-1.5 pr-3" title={t.description}>
                  {t.description}
                </td>
                <td className="py-1.5 pr-3 text-zinc-500">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: categoryColor(t.category) }} />
                    {t.category}
                  </span>
                </td>
                <td className="py-1.5 text-right font-mono tabular-nums">{formatMoney(t.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="flex items-baseline justify-between border-t border-zinc-200 pt-3 text-xs dark:border-zinc-800">
        <span className="text-zinc-500">
          {rows.length} {rows.length === 1 ? "transaction" : "transactions"}
        </span>
        <span className="font-mono tabular-nums">{formatMoney(total, currency)}</span>
      </p>
    </div>
  );
}

export function RuleChecks({
  checks,
  transactions,
  currency,
}: {
  checks: RuleCheck[];
  transactions: TransactionRow[];
  currency: string;
}) {
  const [open, setOpen] = useState<RuleCheck | null>(null);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {checks.map((c) => {
        const card = (
          <>
            <p className="text-xs text-zinc-500">{c.label}</p>
            <p className="mt-1.5 font-mono text-[22px] tabular-nums tracking-tight">{c.value}</p>
            <p className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-zinc-500" title={c.sub}>
              {c.sub}
            </p>
            <div className="relative mt-3 h-1 rounded-full bg-zinc-200 dark:bg-zinc-800">
              {c.band && (
                <div
                  className="absolute top-0 h-1 rounded-full bg-accent/15"
                  style={{ left: `${c.band[0] * 100}%`, width: `${(c.band[1] - c.band[0]) * 100}%` }}
                />
              )}
              <div className={`absolute left-0 top-0 h-1 rounded-full ${FILL[c.status]}`} style={{ width: `${c.fill * 100}%` }} />
              <div className="absolute -top-[3px] h-2.5 w-0.5 bg-foreground" style={{ left: `calc(${c.tick * 100}% - 1px)` }} />
            </div>
            <p className={`mt-2.5 text-[11px] ${TEXT[c.status]}`}>{c.statusLabel}</p>
          </>
        );
        const cls = "rounded-xl border border-zinc-200 bg-white p-4 text-left dark:border-zinc-800 dark:bg-zinc-900";
        // Emergency fund is derived from balance and past months, not this month's rows — nothing to drill into.
        return c.categories ? (
          <button
            key={c.label}
            type="button"
            onClick={() => setOpen(c)}
            className={`${cls} transition-colors hover:border-zinc-300 dark:hover:border-zinc-700`}
            title={`See the transactions behind ${c.label}`}
          >
            {card}
          </button>
        ) : (
          <div key={c.label} className={cls}>
            {card}
          </div>
        );
      })}

      <Dialog open={!!open} onClose={() => setOpen(null)} width="max-w-2xl" title={open ? `${open.label} · ${open.sub}` : ""}>
        {open && <Breakdown check={open} transactions={transactions} currency={currency} />}
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={() => setOpen(null)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-foreground">
            Close
          </button>
        </div>
      </Dialog>
    </div>
  );
}
