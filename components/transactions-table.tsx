"use client";

import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";
import { formatDate, formatDay, formatMoney } from "@/lib/format";
import type { TransactionRow } from "@/lib/db";

export function TransactionsTable({
  transactions,
  currency,
  showYear = false,
}: {
  transactions: TransactionRow[];
  currency: string;
  showYear?: boolean;
}) {
  const router = useRouter();

  async function recategorize(id: number, category: string) {
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    router.refresh();
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500">
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium">Description</th>
            <th className="py-2 pr-4 font-medium">Category</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {transactions.map((t) => (
            <tr key={t.id}>
              <td className="whitespace-nowrap py-2.5 pr-4 font-mono text-xs text-zinc-500">{showYear ? formatDate(t.date) : formatDay(t.date)}</td>
              <td className="max-w-75 truncate py-2.5 pr-4" title={t.description}>
                {t.description}
              </td>
              <td className="py-2.5 pr-4">
                <select
                  value={t.category}
                  onChange={(e) => recategorize(t.id, e.target.value)}
                  className="rounded-md border border-transparent bg-transparent py-1 pr-6 text-sm text-zinc-600 transition-colors hover:border-zinc-200 dark:text-zinc-400 dark:hover:border-zinc-800"
                  aria-label={`Category for ${t.description}`}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </td>
              <td
                className={`whitespace-nowrap py-2.5 text-right font-mono tabular-nums ${
                  t.direction === "credit" ? "text-accent" : ""
                }`}
              >
                {t.direction === "credit" ? "+" : ""}
                {formatMoney(t.amount, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
