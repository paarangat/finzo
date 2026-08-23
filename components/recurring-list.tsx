import { perMonth, type Recurring } from "@/lib/db";
import { formatDay, formatMoney } from "@/lib/format";

const CADENCE_LABEL = { weekly: "/wk", monthly: "/mo", yearly: "/yr" } as const;

export function RecurringList({ data, currency }: { data: Recurring[]; currency: string }) {
  if (data.length === 0) {
    return <p className="text-sm text-zinc-500">No recurring charges detected yet. Upload a few months of statements.</p>;
  }
  const monthly = data.reduce((acc, r) => acc + perMonth(r), 0);
  return (
    <div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
        {data.map((r) => (
          <li key={r.merchant} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate">
                {r.merchant}
                {r.priceChanged && (
                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-500" title="Latest charge differs from the previous one">
                    price changed
                  </span>
                )}
              </p>
              <p className="text-xs text-zinc-500">
                {r.category} · {r.count}× · last {formatDay(r.lastDate)}
              </p>
            </div>
            <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-500">
              {formatMoney(r.amount, currency)}
              {CADENCE_LABEL[r.cadence]}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
        ≈ <span className="font-mono tabular-nums">{formatMoney(Math.round(monthly), currency)}</span>/mo in subscriptions
      </p>
    </div>
  );
}
