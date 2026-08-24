import { formatDay, formatMoney } from "@/lib/format";

const W = 100;
const H = 40;
const PAD = 3; // keeps the stroke inside the box at min/max

export function BalanceSparkline({ data, currency }: { data: { date: string; amount: number }[]; currency: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data.map((d) => d.amount));
  const max = Math.max(...data.map((d) => d.amount));
  const span = max - min || 1;
  const step = W / (data.length - 1);
  const points = data.map((d, i) => ({ ...d, x: i * step, y: PAD + (1 - (d.amount - min) / span) * (H - PAD * 2) }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="mt-3 h-10 w-full max-w-60 overflow-visible text-accent"
      role="img"
      aria-label="Balance over time"
    >
      {/* area fill + endpoint dot so a near-flat history still reads as a chart, not a stray rule */}
      <polygon
        points={`0,${H} ${points.map((p) => `${p.x},${p.y}`).join(" ")} ${W},${H}`}
        fill="currentColor"
        opacity={0.08}
      />
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* dot as a zero-length round-capped stroke: a <circle> would stretch under preserveAspectRatio="none" */}
      <path
        d={`M ${points[points.length - 1].x},${points[points.length - 1].y} h 0.01`}
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {points.map((p) => (
        // ponytail: invisible hit-slabs + native <title> instead of a tooltip component
        <rect key={p.date} x={p.x - step / 2} y={0} width={step} height={H} fill="transparent">
          <title>{`${formatDay(p.date)} · ${formatMoney(p.amount, currency)}`}</title>
        </rect>
      ))}
    </svg>
  );
}
