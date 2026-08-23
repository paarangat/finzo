import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { detectEngines, resolveEngine } from "@/lib/engines";
import { formatMoney } from "@/lib/format";
import { MonthNav } from "@/components/month-nav";
import { SearchBox } from "@/components/search-box";
import { SiteHeader } from "@/components/site-header";
import { TransactionsTable } from "@/components/transactions-table";

export const dynamic = "force-dynamic";

export default async function Transactions({ searchParams }: PageProps<"/transactions">) {
  const { month: monthParam, q: qParam } = await searchParams;
  const q = typeof qParam === "string" ? qParam.trim() : "";
  const db = getDb();
  const months = db.months();
  if (months.length === 0) redirect("/");
  const available = await detectEngines();
  const engine = resolveEngine(db.getSetting("engine"));
  const month = typeof monthParam === "string" && months.includes(monthParam) ? monthParam : months[0];
  const currency = db.currency();
  const hits = q ? db.searchTransactions(q) : null;
  const merchant = q ? db.merchantTotal(q) : null;

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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SearchBox initial={q} />
          {!q && <MonthNav months={months} current={month} basePath="/transactions" />}
        </div>
        {hits && merchant ? (
          <>
            <p className="text-sm text-zinc-500">
              {merchant.count} {merchant.count === 1 ? "transaction" : "transactions"} · {formatMoney(merchant.total, currency)} spent
              {hits.length === 200 && " · showing first 200"}
            </p>
            {hits.length === 0 ? (
              <p className="text-sm text-zinc-500">No transactions match “{q}”.</p>
            ) : (
              <TransactionsTable transactions={hits} currency={currency} showYear />
            )}
          </>
        ) : (
          <TransactionsTable transactions={db.transactions(month)} currency={currency} />
        )}
      </main>
    </div>
  );
}
