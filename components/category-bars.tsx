import { formatMoney } from "@/lib/format";
import type { Summary } from "@/lib/db";

export function CategoryBars({ data, currency }: { data: Summary["byCategory"]; currency: string }) {
  if (data.length === 0) {
    return <p className="py-8 text-sm text-zinc-500">No spending recorded this month.</p>;
  }
  const max = data[0].total;
  return (
    <ul className="space-y-3">
      {data.map(({ category, total }) => (
        <li key={category} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-zinc-600 dark:text-zinc-400">{category}</span>
          <div className="h-2">
            <div
              className="h-full rounded-r-[4px] bg-accent"
              style={{ width: `${Math.max((total / max) * 100, 1)}%` }}
            />
          </div>
          <span className="font-mono text-xs tabular-nums text-zinc-500">{formatMoney(total, currency)}</span>
        </li>
      ))}
    </ul>
  );
}
