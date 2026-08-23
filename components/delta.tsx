import { delta } from "@/lib/format";

/**
 * "↑ 12% vs July 2026". `goodWhenUp` flips the colour (income) vs spend.
 * Renders nothing when there is no previous value.
 */
export function Delta({
  current,
  prev,
  label,
  goodWhenUp = false,
  className = "",
}: {
  current: number;
  prev: number;
  label?: string;
  goodWhenUp?: boolean;
  className?: string;
}) {
  const pct = delta(current, prev);
  if (pct === null) return null;
  const up = pct > 0;
  const color = pct === 0 ? "" : up === goodWhenUp ? "text-accent" : "text-red-600 dark:text-red-400";
  return (
    <span className={`font-mono text-xs tabular-nums ${color || "text-zinc-500"} ${className}`}>
      {pct === 0 ? "→" : up ? "↑" : "↓"} {Math.abs(pct)}%{label && <span className="text-zinc-500"> vs {label}</span>}
    </span>
  );
}
