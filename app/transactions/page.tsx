import { redirect } from "next/navigation";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { getDb } from "@/lib/db";
import { detectEngines, resolveEngine } from "@/lib/engines";
import { formatMoney } from "@/lib/format";
import { MonthNav } from "@/components/month-nav";
import { SearchBox } from "@/components/search-box";
import { SiteHeader } from "@/components/site-header";
import { AddTransactionButton } from "@/components/transaction-editor";
import { TransactionsTable } from "@/components/transactions-table";

export const dynamic = "force-dynamic";

export default async function Transactions({ searchParams }: PageProps<"/transactions">) {
  const { month: monthParam, q: qParam } = await searchParams;
  const q = typeof qParam === "string" ? qParam.trim() : "";
  const db = getDb();
  const accounts = db.accounts();
  const selected = db.selectedAccount();
  const months = db.months(selected);
  if (months.length === 0) redirect("/");
  const available = await detectEngines();
  const engine = resolveEngine(db.getSetting("engine"));
  const month = typeof monthParam === "string" && months.includes(monthParam) ? monthParam : months[0];
  const currency = db.currency();
  const hits = q ? db.searchTransactions(q) : null;
  const merchant = q ? db.merchantTotal(q) : null;
  const showAccount = accounts.length > 1;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        active="transactions"
        reviewCount={db.ambiguous().length}
        engine={engine}
        available={available}
        showUpload
        accounts={accounts}
        selectedAccount={selected}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SearchBox initial={q} />
          {!q && <MonthNav months={months} current={month} basePath="/transactions" />}
          <div className="flex items-center gap-3">
            <AddTransactionButton accounts={accounts} defaultAccount={selected} />
            <a
              href="/api/export?format=csv"
              className="inline-flex h-9 items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-foreground"
              title="Download every transaction as CSV (JSON at /api/export?format=json)"
            >
              <DownloadSimple size={14} /> Export CSV
            </a>
          </div>
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
              <TransactionsTable transactions={hits} currency={currency} accounts={accounts} showYear showAccount={showAccount} />
            )}
          </>
        ) : (
          <TransactionsTable
            transactions={db.transactions(month, selected)}
            currency={currency}
            accounts={accounts}
            showAccount={showAccount && selected === undefined}
          />
        )}
      </main>
    </div>
  );
}
