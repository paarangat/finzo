import { redirect } from "next/navigation";
import { getDb, dueDatesInMonth, perMonth } from "@/lib/db";
import { detectEngines, resolveEngine } from "@/lib/engines";
import { formatMoney, formatMonth } from "@/lib/format";
import { BillCalendar } from "@/components/bill-calendar";
import { BillsManager } from "@/components/bills-manager";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

export default async function Bills() {
  const db = getDb();
  const accounts = db.accounts();
  const selected = db.selectedAccount();
  if (db.months().length === 0) redirect("/");
  const available = await detectEngines();
  const engine = resolveEngine(db.getSetting("engine"));
  const bills = db.recurring(selected);
  const currency = db.currency();
  // ponytail: fixed to the current calendar month; add MonthNav when someone asks to browse ahead
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const dueThisMonth = bills.reduce((acc, b) => acc + b.amount * dueDatesInMonth(b, month).length, 0);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        active="bills"
        reviewCount={db.ambiguous().length}
        engine={engine}
        available={available}
        showUpload
        accounts={accounts}
        selectedAccount={selected}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-6 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-lg font-semibold tracking-tight">{formatMonth(month)}</h1>
          <p className="text-sm text-zinc-500">
            <span className="font-mono tabular-nums text-foreground">{formatMoney(dueThisMonth, currency)}</span> in bills this month
          </p>
        </div>
        <BillCalendar bills={bills} month={month} today={today} currency={currency} />
        <section className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <h2 className="mb-4 text-sm font-medium">Recurring charges</h2>
          <BillsManager bills={bills} monthlyTotal={bills.reduce((acc, b) => acc + perMonth(b), 0)} currency={currency} />
        </section>
      </main>
    </div>
  );
}
