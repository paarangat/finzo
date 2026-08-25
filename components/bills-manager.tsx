"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { categoryColor } from "@/lib/colors";
import type { Recurring } from "@/lib/db";
import { formatDay, formatMoney } from "@/lib/format";

const CADENCE_LABEL = { weekly: "/wk", monthly: "/mo", yearly: "/yr" } as const;

/** The recurring list with user corrections: dismiss false positives, force-add missed bills. */
export function BillsManager({ bills, monthlyTotal, currency }: { bills: Recurring[]; monthlyTotal: number; currency: string }) {
  const router = useRouter();
  const [merchant, setMerchant] = useState("");
  const [cadence, setCadence] = useState<Recurring["cadence"]>("monthly");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function override(m: string, mode: "exclude" | "include" | null, cad?: Recurring["cadence"]) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchant: m, mode, cadence: cad }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Something went wrong.");
      return false;
    }
    router.refresh();
    return true;
  }

  const textBtn = "text-xs text-zinc-400 transition-colors hover:text-foreground disabled:opacity-50";

  return (
    <div>
      {bills.length === 0 ? (
        <p className="text-sm text-zinc-500">No recurring charges detected yet. Upload a few months of statements, or add one below.</p>
      ) : (
        <>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {bills.map((r) => (
              <li key={r.matcher} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate">
                    {r.merchant}
                    {r.manual && (
                      <span className="ml-2 text-xs text-zinc-400" title="Added by you, not auto-detected">
                        manual
                      </span>
                    )}
                    {r.priceChanged && (
                      <span className="ml-2 text-xs text-amber-600 dark:text-amber-500" title="Latest charge differs from the previous one">
                        price changed
                      </span>
                    )}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: categoryColor(r.category) }} />
                    {r.category} · {r.count}× · last {formatDay(r.lastDate)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-xs tabular-nums text-zinc-500">
                    {formatMoney(r.amount, currency)}
                    {CADENCE_LABEL[r.cadence]}
                  </span>
                  {r.manual ? (
                    <button onClick={() => override(r.matcher, null)} disabled={busy} className={textBtn} title="Remove and return to auto-detection">
                      Remove
                    </button>
                  ) : (
                    <button onClick={() => override(r.matcher, "exclude")} disabled={busy} className={textBtn} title="Hide from bills — this isn't recurring">
                      Not a bill
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
            ≈ <span className="font-mono tabular-nums">{formatMoney(Math.round(monthlyTotal), currency)}</span>/mo across {bills.length}{" "}
            {bills.length === 1 ? "bill" : "bills"}
          </p>
        </>
      )}

      <form
        className="mt-6 flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await override(merchant, "include", cadence)) setMerchant("");
        }}
      >
        <input
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="Merchant name (as it appears in transactions)"
          required
          className="h-9 w-72 max-w-full rounded-lg border border-zinc-200 bg-transparent px-3 text-sm placeholder:text-zinc-400 dark:border-zinc-800"
        />
        <select
          value={cadence}
          onChange={(e) => setCadence(e.target.value as Recurring["cadence"])}
          className="h-9 rounded-lg border border-zinc-200 bg-transparent px-2 text-sm dark:border-zinc-800"
          aria-label="Cadence"
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <button type="submit" disabled={busy} className="h-9 rounded-lg bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50">
          Add bill
        </button>
        {error && <p className="w-full text-xs text-red-600 dark:text-red-400">{error}</p>}
      </form>
    </div>
  );
}
