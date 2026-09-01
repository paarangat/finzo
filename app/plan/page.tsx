import { getDb } from "@/lib/db";
import { detectEngines, resolveEngine } from "@/lib/engines";
import { planGoal } from "@/lib/goals";
import { currentMonth, formatMonth, formatMoneyWhole } from "@/lib/format";
import { spendBaseline } from "@/lib/rules";
import { GoalPlanner } from "@/components/goal-planner";
import { SalaryChip, SalarySetupCard } from "@/components/salary-control";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export default async function Plan() {
  const db = getDb();
  const available = await detectEngines();
  const engine = resolveEngine(db.getSetting("engine"));
  const currency = db.currency();
  const salary = db.salary();
  const age = db.age();
  // Whole-picture numbers on purpose: a goal is paid for out of everything you
  // have, not out of whichever account the header switcher happens to be on.
  const balance = db.balance()?.amount ?? null;
  const cashflows = db.monthlyCashflow();
  const currentCalendarMonth = currentMonth();
  const plans = db.goals().map((goal) => planGoal(goal, { balanceMinor: balance, cashflows, currentCalendarMonth, salaryMinor: salary, currency }));
  const { avg: avgSpend, months: spendMonths } = spendBaseline(cashflows, currentCalendarMonth, cashflows.at(-1)?.spent ?? 0);
  // One statement is one month, and one big month is not a habit. Name what the
  // number is actually made of rather than calling a single month "typical".
  const spentLabel =
    spendMonths.length === 0
      ? "you have spent so far"
      : spendMonths.length === 1
        ? `you spent in ${formatMonth(spendMonths[0])}`
        : `you spent a month on average across ${formatMonth(spendMonths[0])}–${formatMonth(spendMonths[spendMonths.length - 1])}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        active="plan"
        reviewCount={db.ambiguous().length}
        engine={engine}
        available={available}
        showUpload={false}
        accounts={db.accounts()}
        selectedAccount={db.selectedAccount()}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-6 py-8">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Saving for something</h1>
          <p className="mt-1.5 max-w-xl text-sm text-zinc-500">
            Put in what it costs and when you want it. Finzo works out what that means per month against what you actually save —
            and whether buying it outright today would eat your cushion.
          </p>
        </div>

        {salary === null ? (
          <SalarySetupCard currency={currency} age={age} />
        ) : (
          <div className="flex flex-wrap items-baseline justify-between gap-3 text-xs text-zinc-500">
            <p>
              You save about{" "}
              <span className="font-mono tabular-nums text-foreground">{formatMoneyWhole(Math.max(salary - avgSpend, 0), currency)}</span> a
              month — your salary minus the <span className="font-mono tabular-nums">{formatMoneyWhole(avgSpend, currency)}</span> {spentLabel}
              {spendMonths.length === 1 && ". One statement is one month, so a single big purchase sets this number — upload more months to even it out"}.
            </p>
            <SalaryChip salary={salary} currency={currency} age={age} />
          </div>
        )}

        <GoalPlanner plans={plans} currency={currency} engineLabel={engine.label} />

        <p className="border-t border-zinc-200 pt-6 text-xs leading-relaxed text-zinc-500 dark:border-zinc-800">
          Spending is averaged over your last three completed months (fewer, if that is all you have uploaded), never the half-finished
          current one — it would flatter every number here.
          &ldquo;Buy it now&rdquo; asks whether your balance minus the price still covers three months of that — the same cushion line
          as the emergency-fund rule. All of it is arithmetic on your own numbers, done on this machine.
        </p>
      </main>
    </div>
  );
}
