import Link from "next/link";
import { getDb } from "@/lib/db";
import { detectEngines, resolveEngine } from "@/lib/engines";
import { currentMonth, formatMoney, formatMoneyWhole, formatMonth, greeting } from "@/lib/format";
import { Delta } from "@/components/delta";
import { BalanceStat } from "@/components/balance-stat";
import { BalanceSparkline } from "@/components/balance-sparkline";
import { CategoryBars } from "@/components/category-bars";
import { DailyChart } from "@/components/daily-chart";
import { DemoBanner } from "@/components/demo-controls";
import { Greeting } from "@/components/greeting";
import { Onboarding } from "@/components/onboarding";
import { DonutChart } from "@/components/donut-chart";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { CashflowChart } from "@/components/cashflow-chart";
import { RecurringList } from "@/components/recurring-list";
import { RuleChecks } from "@/components/rule-checks";
import { GoalSummary } from "@/components/goal-summary";
import { SalaryChip, SalarySetupCard } from "@/components/salary-control";
import { ruleChecks } from "@/lib/rules";
import { planGoal } from "@/lib/goals";
import { MonthNav } from "@/components/month-nav";
import { ReviewTeaser } from "@/components/review-teaser";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const { month: monthParam } = await searchParams;
  const db = getDb();
  const accounts = db.accounts();
  const selected = db.selectedAccount();
  const months = db.months(selected);
  const available = await detectEngines();
  const engine = resolveEngine(db.getSetting("engine"));
  const noCli = !available.includes("claude") && !available.includes("codex");
  const isDemo = !!db.getSetting("demo");

  const userName = db.getSetting("name");

  if (months.length === 0 && db.months().length === 0) {
    // Progress is inferred from what got saved, so a reload resumes at the first
    // unanswered step. Skipping saves nothing, so skipping everything and
    // reloading starts over — cheaper than tracking a step that only matters once.
    const saved = db.salary();
    const initialStep = !userName ? 0 : saved === null ? 1 : 2;
    return (
      <div className="flex min-h-dvh flex-col">
        <SiteHeader active="overview" engine={engine} available={available} showUpload={false} />
        <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
          <Onboarding
            initialStep={initialStep}
            name={userName}
            salary={saved}
            currency={db.currency()}
            age={db.age()}
            engineLabel={engine.label}
            noCli={noCli}
          />
        </main>
      </div>
    );
  }

  const header = (
    <SiteHeader
      active="overview"
      reviewCount={db.ambiguous().length}
      engine={engine}
      available={available}
      showUpload
      accounts={accounts}
      selectedAccount={selected}
    />
  );

  if (months.length === 0) {
    const name = accounts.find((a) => a.id === selected)?.name;
    return (
      <div className="flex min-h-dvh flex-col">
        {header}
        <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <p className="text-lg font-medium">No transactions in {name} yet</p>
          <p className="text-sm text-zinc-500">Upload a statement for this account, or switch back to all accounts.</p>
        </main>
      </div>
    );
  }

  const month = typeof monthParam === "string" && months.includes(monthParam) ? monthParam : months[0];
  const summary = db.summary(month, selected);
  const prevMonth = months[months.indexOf(month) + 1];
  const prev = prevMonth ? db.summary(prevMonth, selected) : null;
  const prevByCategory = Object.fromEntries(prev?.byCategory.map((c) => [c.category, c.total]) ?? []);
  const balance = db.balance(selected);
  const cashflows = db.monthlyCashflow(selected);
  const salary = db.salary();
  const age = db.age();
  const ambiguous = db.ambiguous();
  const thisMonth = currentMonth();
  // Goals are whole-picture: paid for out of every account, not the selected one.
  const allBalance = selected === undefined ? balance : db.balance();
  const allCashflows = selected === undefined ? cashflows : db.monthlyCashflow();
  const goalPlans = db
    .goals()
    .slice(0, 3)
    .map((goal) =>
      planGoal(goal, {
        balanceMinor: allBalance?.amount ?? null,
        cashflows: allCashflows,
        currentCalendarMonth: thisMonth,
        salaryMinor: salary,
        currency: summary.currency,
      })
    );
  // A combined sparkline over accounts with different statement dates would mislead — show it per-account or when there's just one.
  const showSparkline = selected !== undefined || accounts.length <= 1;

  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-6 py-8">
        {isDemo && <DemoBanner />}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Greeting greeting={greeting(new Date())} name={userName} />
          <MonthNav months={months} current={month} />
        </div>

        <section className="grid gap-8 sm:grid-cols-3">
          <div>
            <BalanceStat balance={balance} currency={summary.currency} />
            {showSparkline && <BalanceSparkline data={db.balanceHistory(selected)} currency={summary.currency} />}
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500">Spent this month</p>
            <p className="mt-1 font-mono text-2xl tabular-nums tracking-tight">{formatMoney(summary.spent, summary.currency)}</p>
            {prev && <Delta current={summary.spent} prev={prev.spent} label={formatMonth(prevMonth)} className="mt-0.5 block" />}
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500">Income this month</p>
            <p className="mt-1 font-mono text-2xl tabular-nums tracking-tight text-accent">
              {formatMoney(summary.income, summary.currency)}
            </p>
            {prev && <Delta current={summary.income} prev={prev.income} label={formatMonth(prevMonth)} goodWhenUp className="mt-0.5 block" />}
          </div>
        </section>

        <section className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <h2 className="mb-6 text-sm font-medium">Where it went</h2>
          <div className="grid items-center gap-10 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <DonutChart data={summary.byCategory} spent={summary.spent} currency={summary.currency} />
            </div>
            <div className="lg:col-span-3">
              <CategoryBars data={summary.byCategory} budgets={db.budgets(month)} prev={prevByCategory} currency={summary.currency} />
            </div>
          </div>
        </section>

        <section className="grid gap-10 border-t border-zinc-200 pt-8 lg:grid-cols-2 dark:border-zinc-800">
          <div>
            <h2 className="mb-4 text-sm font-medium">Cash flow</h2>
            <CashflowChart data={cashflows} current={month} currency={summary.currency} />
          </div>
          <div>
            <h2 className="mb-4 text-sm font-medium">Daily spend</h2>
            <DailyChart month={month} data={summary.byDay} currency={summary.currency} />
          </div>
        </section>

        <section className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium">Rule-of-thumb check</h2>
            {salary !== null && <SalaryChip salary={salary} currency={summary.currency} age={age} />}
          </div>
          {salary === null ? (
            <SalarySetupCard currency={summary.currency} age={age} />
          ) : (
            <>
              <RuleChecks
                checks={ruleChecks(summary, balance?.amount ?? null, cashflows, thisMonth, salary)}
                transactions={db.transactions(month, selected)}
                currency={summary.currency}
              />
              <p className="mt-4 text-xs text-zinc-500">
                Suggested limits from your salary — Needs{" "}
                <span className="font-mono tabular-nums">{formatMoneyWhole(salary * 0.5, summary.currency)}</span> · Wants{" "}
                <span className="font-mono tabular-nums">{formatMoneyWhole(salary * 0.3, summary.currency)}</span> · Save{" "}
                <span className="font-mono tabular-nums">{formatMoneyWhole(salary * 0.2, summary.currency)}</span>. Rules of thumb, not
                targets.
              </p>
            </>
          )}
        </section>

        {goalPlans.length > 0 && (
          <section className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-sm font-medium">Saving for</h2>
              <Link href="/plan" className="text-xs text-zinc-500 transition-colors hover:text-foreground">
                Plan →
              </Link>
            </div>
            <GoalSummary plans={goalPlans} currency={summary.currency} />
          </section>
        )}

        <section className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-medium">Investments</h2>
            <Link href="/invest" className="text-xs text-zinc-500 transition-colors hover:text-foreground">
              Manage →
            </Link>
          </div>
          {db.investments().length > 0 ? (
            <PortfolioSummary rows={db.investments()} currency={summary.currency} age={age} />
          ) : (
            <p className="text-sm text-zinc-500">
              Nothing tracked yet.{" "}
              <Link href="/invest" className="text-accent hover:underline">
                Upload your CAS
              </Link>{" "}
              to pull in mutual funds and stocks, or add FDs and savings by hand.
            </p>
          )}
        </section>

        <section className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-medium">Recurring</h2>
            <Link href="/bills" className="text-xs text-zinc-500 transition-colors hover:text-foreground">
              Bill calendar →
            </Link>
          </div>
          <RecurringList data={db.recurring(selected)} currency={summary.currency} />
        </section>

        {ambiguous.length > 0 && (
          <section className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
            <ReviewTeaser top={ambiguous[0]} count={ambiguous.length} currency={summary.currency} />
          </section>
        )}
      </main>
    </div>
  );
}
