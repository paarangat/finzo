import { formatMoney } from "@/lib/format";
import { ADVICE_TEXT, GOAL_FILL, GOAL_TEXT, storedAdvice, type GoalPlan } from "@/lib/goals";

/** Dashboard-sized read of what you're saving for; the full planner lives on /plan. */
export function GoalSummary({ plans, currency }: { plans: GoalPlan[]; currency: string }) {
  return (
    <ul className="divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800/60 dark:border-zinc-800/60">
      {plans.map(({ goal, ...p }) => {
        const advice = storedAdvice(goal);
        return (
        <li key={goal.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate">{goal.name}</p>
            {advice && (
              <p className={`mt-0.5 truncate text-xs ${ADVICE_TEXT[advice.verdict]}`} title={advice.headline}>
                {advice.headline}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div className={`h-1 rounded-full ${GOAL_FILL[p.status]}`} style={{ width: `${p.progress * 100}%` }} />
              </div>
              <p className="truncate text-xs text-zinc-500">
                <span className="font-mono tabular-nums">{formatMoney(goal.saved, currency)}</span> of{" "}
                <span className="font-mono tabular-nums">{formatMoney(goal.target, currency)}</span>
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-sm tabular-nums">{p.headline}</p>
            <p className={`mt-0.5 text-[11px] ${GOAL_TEXT[p.status]}`}>{p.sub}</p>
          </div>
        </li>
        );
      })}
    </ul>
  );
}
