import type { RuleCheck } from "@/lib/rules";

const FILL = { good: "bg-accent", warn: "bg-amber-500", bad: "bg-red-500" } as const;
const TEXT = {
  good: "text-accent",
  warn: "text-amber-600 dark:text-amber-500",
  bad: "text-red-600 dark:text-red-400",
} as const;

export function RuleChecks({ checks }: { checks: RuleCheck[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {checks.map((c) => (
        <div key={c.label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
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
        </div>
      ))}
    </div>
  );
}
