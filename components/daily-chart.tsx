import { formatDay, formatMoney } from "@/lib/format";
import type { Summary } from "@/lib/db";

export function DailyChart({ month, data, currency }: { month: string; data: Summary["byDay"]; currency: string }) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDate = new Map(data.map((d) => [d.date, d.total]));
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { date, total: byDate.get(date) ?? 0 };
  });
  const max = Math.max(...days.map((d) => d.total), 1);

  return (
    <div>
      <div className="flex h-36 items-end gap-[2px] border-b border-zinc-200 dark:border-zinc-800">
        {days.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 items-end">
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 font-mono text-xs tabular-nums text-zinc-50 group-hover:block dark:bg-zinc-100 dark:text-zinc-900">
              {formatDay(d.date)} · {formatMoney(d.total, currency)}
            </span>
            <div
              className={`w-full rounded-t-[4px] ${d.total > 0 ? "bg-accent" : ""} group-hover:opacity-80`}
              style={{ height: d.total > 0 ? `${Math.max((d.total / max) * 100, 3)}%` : "0" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-zinc-400">
        <span>1</span>
        <span>15</span>
        <span>{daysInMonth}</span>
      </div>
    </div>
  );
}
