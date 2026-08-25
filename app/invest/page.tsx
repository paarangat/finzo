import { getDb } from "@/lib/db";
import { detectEngines, resolveEngine } from "@/lib/engines";
import { refreshNavValues } from "@/lib/nav";
import { CasUploader } from "@/components/cas-uploader";
import { InvestmentsPanel } from "@/components/investments-panel";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export default async function Invest() {
  const db = getDb();
  const accounts = db.accounts();
  const selected = db.selectedAccount();
  const available = await detectEngines();
  const engine = resolveEngine(db.getSetting("engine"));
  let rows = db.investments();

  // Reprice NAV-tracked holdings at most once a day, on visit; offline just leaves them stale.
  const today = new Date().toISOString().slice(0, 10);
  if (rows.some((r) => r.scheme_code !== null && r.units !== null && r.updated_at < today)) {
    await refreshNavValues(db);
    rows = db.investments();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        active="invest"
        reviewCount={db.ambiguous().length}
        engine={engine}
        available={available}
        showUpload={false}
        accounts={accounts}
        selectedAccount={selected}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-6 py-8">
        {rows.length > 0 ? (
          <PortfolioSummary rows={rows} currency={db.currency()} age={db.age()} />
        ) : (
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Investments</h1>
            <p className="mt-1.5 max-w-xl text-sm text-zinc-500">
              Mutual funds, stocks, FDs, PPF, gold — imported from one statement, priced automatically where a public feed
              exists, and never leaving this machine.
            </p>
          </div>
        )}

        <CasUploader engineLabel={engine.label} />

        <section className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <h2 className="mb-4 text-sm font-medium">Holdings</h2>
          <InvestmentsPanel rows={rows} currency={db.currency()} />
        </section>
      </main>
    </div>
  );
}
