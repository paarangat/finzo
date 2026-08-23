import { getDb } from "@/lib/db";
import { detectEngines, resolveEngine } from "@/lib/engines";
import { formatMoney, formatMonth } from "@/lib/format";
import { Delta } from "@/components/delta";
import { BalanceStat } from "@/components/balance-stat";
import { BalanceSparkline } from "@/components/balance-sparkline";
import { CategoryBars } from "@/components/category-bars";
import { DailyChart } from "@/components/daily-chart";
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
  const months = db.months();
  const available = await detectEngines();
  const engine = resolveEngine(db.getSetting("engine"));
  const noCli = !available.includes("claude") && !available.includes("codex");

  if (months.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col">
        <SiteHeader active="overview" engine={engine} available={available} showUpload={false} />
        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16">
          <div className="max-w-lg text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Track your spending in minutes</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Upload a bank statement and {engine.label} extracts, categorizes, and summarizes every transaction.
            </p>
          </div>
          <Uploader variant="dropzone" engineLabel={engine.label} />
          {noCli && (
            <div className="max-w-lg rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              <p className="font-medium text-foreground">No AI engine found</p>
              <p className="mt-1">
                Finzo uses the Claude Code or Codex CLI on this machine. Install one and sign in with your subscription:
              </p>
              <pre className="mt-2 rounded-lg bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-900">
                {"npm install -g @anthropic-ai/claude-code\nnpm install -g @openai/codex"}
              </pre>
              <p className="mt-2">Or pick the Fixture engine above to try Finzo with demo data.</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  const month = typeof monthParam === "string" && months.includes(monthParam) ? monthParam : months[0];
  const summary = db.summary(month);
  const prevMonth = months[months.indexOf(month) + 1];
  const prev = prevMonth ? db.summary(prevMonth) : null;
  const prevByCategory = Object.fromEntries(prev?.byCategory.map((c) => [c.category, c.total]) ?? []);
  const balance = db.balance();
  const ambiguous = db.ambiguous();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader active="overview" reviewCount={ambiguous.length} engine={engine} available={available} showUpload />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <MonthNav months={months} current={month} />
        </div>

        <section className="grid gap-8 sm:grid-cols-3">
          <div>
            <BalanceStat balance={balance} currency={summary.currency} />
            <BalanceSparkline data={db.balanceHistory()} currency={summary.currency} />
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
            <MonthlyTrend data={db.monthlySpend()} current={month} currency={summary.currency} />
          </div>
          <div>
            <h2 className="mb-4 text-sm font-medium">Daily spend</h2>
            <DailyChart month={month} data={summary.byDay} currency={summary.currency} />
          </div>
        </section>

        <section className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <h2 className="mb-4 text-sm font-medium">Recurring</h2>
          <RecurringList data={db.recurring()} currency={summary.currency} />
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
