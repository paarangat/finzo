import { getDb } from "@/lib/db";
import { detectEngines, resolveEngine } from "@/lib/engines";
import { formatMoney, formatMonth } from "@/lib/format";
import { Delta } from "@/components/delta";
import { BalanceStat } from "@/components/balance-stat";
import { BalanceSparkline } from "@/components/balance-sparkline";
import { CategoryBars } from "@/components/category-bars";
import { DailyChart } from "@/components/daily-chart";
import { DemoBanner, DemoButton } from "@/components/demo-controls";
import { DonutChart } from "@/components/donut-chart";
import { MonthlyTrend } from "@/components/monthly-trend";
import { RecurringList } from "@/components/recurring-list";
import { MonthNav } from "@/components/month-nav";
import { ReviewTeaser } from "@/components/review-teaser";
import { SiteHeader } from "@/components/site-header";
import { Uploader } from "@/components/uploader";

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

  if (months.length === 0 && db.months().length === 0) {
    const steps = [
      { done: !noCli, text: "Install the Claude Code or Codex CLI and sign in with your subscription" },
      { done: false, text: "Upload a bank statement (PDF or CSV)" },
      { done: false, text: `${engine.label} extracts and categorizes every transaction — your dashboard builds itself` },
    ];
    return (
      <div className="flex min-h-dvh flex-col">
        <SiteHeader active="overview" engine={engine} available={available} showUpload={false} />
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
          <div className="max-w-lg text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Track your spending in minutes</h1>
            <ol className="mx-auto mt-4 max-w-md space-y-2 text-left text-sm text-zinc-600 dark:text-zinc-400">
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] ${
                      s.done ? "bg-accent/15 text-accent" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                    }`}
                  >
                    {s.done ? "✓" : i + 1}
                  </span>
                  {s.text}
                </li>
              ))}
            </ol>
          </div>
          <Uploader variant="dropzone" engineLabel={engine.label} />
          <DemoButton />
          {noCli && (
            <div className="max-w-lg rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              <p className="font-medium text-foreground">No AI engine found</p>
              <p className="mt-1">
                Finzo uses the Claude Code or Codex CLI on this machine. Install one and sign in with your subscription:
              </p>
              <pre className="mt-2 rounded-lg bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-900">
                {"npm install -g @anthropic-ai/claude-code\nnpm install -g @openai/codex"}
              </pre>
            </div>
          )}
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
  const ambiguous = db.ambiguous();
  // A combined sparkline over accounts with different statement dates would mislead — show it per-account or when there's just one.
  const showSparkline = selected !== undefined || accounts.length <= 1;

  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-6 py-8">
        {isDemo && <DemoBanner />}
        <div className="flex flex-wrap items-center justify-between gap-4">
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
            <h2 className="mb-4 text-sm font-medium">Monthly spending</h2>
            <MonthlyTrend data={db.monthlySpend(selected)} current={month} currency={summary.currency} />
          </div>
          <div>
            <h2 className="mb-4 text-sm font-medium">Daily spend</h2>
            <DailyChart month={month} data={summary.byDay} currency={summary.currency} />
          </div>
        </section>

        <section className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <h2 className="mb-4 text-sm font-medium">Recurring</h2>
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
