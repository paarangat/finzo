import { categoryColor, REMAINDER } from "@/lib/colors";
import { formatMoney } from "@/lib/format";
import type { Summary } from "@/lib/db";

const TOP = 5;

export function DonutChart({ data, spent, currency }: { data: Summary["byCategory"]; spent: number; currency: string }) {
  if (data.length === 0 || spent === 0) return null;
  const top = data.slice(0, TOP).map((d) => ({ label: d.category, total: d.total, color: categoryColor(d.category) }));
  const rest = data.slice(TOP).reduce((acc, d) => acc + d.total, 0);
  const slices = rest > 0 ? [...top, { label: "Everything else", total: rest, color: REMAINDER }] : top;

  let start = 0;
  return (
    <div className="relative mx-auto size-52">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        {slices.map((s) => {
          const pct = (s.total / spent) * 100;
          const gap = slices.length > 1 ? 1.2 : 0; // 2px-ish surface gap between slices
          const len = Math.max(pct - gap, 0.4);
          const el = (
            <circle
              key={s.label}
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke={s.color}
              strokeWidth="17"
              pathLength={100}
              strokeDasharray={`${len} ${100 - len}`}
              strokeDashoffset={-start - gap / 2}
              className="transition-opacity hover:opacity-75"
            >
              <title>{`${s.label}: ${formatMoney(s.total, currency)}`}</title>
            </circle>
          );
          start += pct;
          return el;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl tabular-nums tracking-tight">{formatMoney(spent, currency)}</span>
        <span className="text-xs text-zinc-500">spent</span>
      </div>
    </div>
  );
}
