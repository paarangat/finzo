import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { detectEngines, resolveEngine } from "@/lib/engines";
import { MonthNav } from "@/components/month-nav";
import { SiteHeader } from "@/components/site-header";
import { TransactionsTable } from "@/components/transactions-table";

export const dynamic = "force-dynamic";

export default async function Transactions({ searchParams }: PageProps<"/transactions">) {
  const { month: monthParam } = await searchParams;
  const db = getDb();
  const months = db.months();
  if (months.length === 0) redirect("/");
  const available = await detectEngines();
  const engine = resolveEngine(db.getSetting("engine"));
  const month = typeof monthParam === "string" && months.includes(monthParam) ? monthParam : months[0];
  const transactions = db.transactions(month);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        active="transactions"
        reviewCount={db.ambiguous().length}
        engine={engine}
        available={available}
        showUpload
      />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-6 py-8">
        <MonthNav months={months} current={month} basePath="/transactions" />
        <TransactionsTable transactions={transactions} currency={db.currency()} />
      </main>
    </div>
  );
}
