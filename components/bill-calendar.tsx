import { dueDatesInMonth, type Recurring } from "@/lib/db";
import { formatMoneyCompact } from "@/lib/format";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function BillCalendar({
  bills,
  month,
  today,
  currency,
}: {
  bills: Recurring[];
  month: string; // "YYYY-MM"
  today: string; // "YYYY-MM-DD"
  currency: string;
}) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday-first
  const byDay = new Map<number, Recurring[]>();
  for (const b of bills) {
    for (const date of dueDatesInMonth(b, month)) {
      const day = Number(date.slice(8));
      byDay.set(day, [...(byDay.get(day) ?? []), b]);
    }
  }
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null); // trailing pads so the last week row isn't a gray slab

  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
      {DOW.map((d) => (
        <div key={d} className="bg-zinc-50 px-2 py-1.5 text-center text-[11px] font-medium text-zinc-500 dark:bg-zinc-900">
          {d}
        </div>
      ))}
      {cells.map((day, i) => {
        if (day === null) return <div key={`pad-${i}`} className="bg-background" />;
        const date = `${month}-${String(day).padStart(2, "0")}`;
        const due = byDay.get(day) ?? [];
        return (
          <div key={date} className="min-h-16 space-y-1 bg-background p-1.5 sm:min-h-20">
            <p
              className={`font-mono text-[11px] tabular-nums ${
                date === today
                  ? "inline-flex size-5 items-center justify-center rounded-full bg-accent font-medium text-white"
                  : "text-zinc-500"
              }`}
            >
              {day}
            </p>
            {due.map((b) => (
              <p
                key={b.matcher}
                className={`truncate rounded bg-zinc-100 px-1 py-0.5 text-[10px] leading-4 dark:bg-zinc-800/80 ${
                  date < today ? "text-zinc-400 dark:text-zinc-500" : ""
                }`}
                title={`${b.merchant} · ${formatMoneyCompact(b.amount, currency)}${date < today ? " · already charged" : ""}`}
              >
                {b.merchant} <span className="font-mono tabular-nums text-zinc-500">{formatMoneyCompact(b.amount, currency)}</span>
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
