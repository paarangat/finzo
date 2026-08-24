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
  muted = false,
  className = "",
}: {
  current: number;
  prev: number;
  label?: string;
  goodWhenUp?: boolean;
  /** always zinc — for dense lists where a column of red/green reads as alarm */
  muted?: boolean;
  className?: string;
}) {
  const pct = delta(current, prev);
  if (pct === null) return null;
  const up = pct > 0;
  const color = muted || pct === 0 ? "" : up === goodWhenUp ? "text-accent" : "text-red-600 dark:text-red-400";
  // "↑ 2300%" off a tiny base is noise; past 300% show the multiple instead.
  const magnitude = Math.abs(pct) >= 300 ? `${Math.round((Math.abs(pct) + 100) / 100)}×` : `${Math.abs(pct)}%`;
  // scanning a column that switches units reads as a typo; spell the multiple out on hover
  const title = Math.abs(pct) >= 300 ? `${up ? "+" : "-"}${Math.abs(pct)}% vs previous` : undefined;
  return (
    <span title={title} className={`whitespace-nowrap font-mono text-xs tabular-nums ${color || "text-zinc-500"} ${className}`}>
      {pct === 0 ? "→" : up ? "↑" : "↓"} {magnitude}
      {label && <span className="text-zinc-500"> vs {label}</span>}
    </span>
  );
}
