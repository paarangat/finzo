"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDay, formatMoney, formatMoneyWhole } from "@/lib/format";
import { INVESTMENT_KINDS, kindLabel, type InvestmentKind } from "@/lib/investments";
import type { InvestmentRow } from "@/lib/db";

const inputCls =
  "h-9 rounded-lg border border-zinc-200 bg-transparent px-3 text-sm placeholder:text-zinc-400 dark:border-zinc-800";

/** Holdings list + manual add. Rows with an AMFI scheme code are priced automatically; the rest are hand-updated. */
export function InvestmentsPanel({ rows, currency }: { rows: InvestmentRow[]; currency: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", kind: "savings" as InvestmentKind, value: "", invested: "" });
  const [busy, setBusy] = useState(false);

  async function call(path: string, method: string, body?: object) {
    setBusy(true);
    await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    setBusy(false);
    router.refresh();
  }

  async function saveValue(id: number) {
    const n = Number(draft);
    if (Number.isFinite(n) && n > 0) await call(`/api/investments/${id}`, "PATCH", { value: n });
    setEditing(null);
  }

  return (
    <div>
      {rows.length > 0 && (
        <ul className="divide-y divide-zinc-100 border-t border-zinc-100 dark:divide-zinc-800/60 dark:border-zinc-800/60">
          {rows.map((r) => {
            const auto = r.scheme_code !== null && r.units !== null;
            const rowGain = r.invested === null ? null : r.value - r.invested;
            return (
              <li key={r.id} className="group flex items-center justify-between gap-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{r.name}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {kindLabel(r.kind)}
                    {r.units !== null && <> · <span className="font-mono tabular-nums">{r.units}</span> units</>}
                    {" · "}
                    {auto ? "priced daily" : `as of ${formatDay(r.updated_at)}`}
                    {rowGain !== null && (
                      <span className={rowGain >= 0 ? "text-accent" : "text-red-600 dark:text-red-400"}>
                        {" "}
                        · {rowGain >= 0 ? "+" : ""}
                        {formatMoneyWhole(rowGain, currency)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {auto ? (
                    <span className="px-1.5 font-mono text-sm tabular-nums" title="Priced automatically from AMFI's NAV feed">
                      {formatMoney(r.value, currency)}
                    </span>
                  ) : editing === r.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveValue(r.id);
                      }}
                    >
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => saveValue(r.id)}
                        autoFocus
                        inputMode="decimal"
                        className="h-8 w-32 rounded-lg border border-zinc-200 bg-transparent px-2 text-right font-mono text-sm tabular-nums dark:border-zinc-800"
                        aria-label={`Current value of ${r.name}`}
                      />
                    </form>
                  ) : (
                    <button
                      onClick={() => {
                        setEditing(r.id);
                        setDraft(String(r.value / 100));
                      }}
                      className="rounded-md px-1.5 py-0.5 font-mono text-sm tabular-nums transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      title="Click to update the current value"
                    >
                      {formatMoney(r.value, currency)}
                    </button>
                  )}
                  {confirming === r.id ? (
                    <span className="inline-flex items-center gap-1 text-xs">
                      <button
                        onClick={() => {
                          setConfirming(null);
                          call(`/api/investments/${r.id}`, "DELETE");
                        }}
                        className="rounded-md px-2 py-1 font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        Delete
                      </button>
                      <button onClick={() => setConfirming(null)} className="rounded-md px-2 py-1 text-zinc-500 hover:text-foreground">
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirming(r.id)}
                      className="rounded-md p-1 text-zinc-300 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover:opacity-100 dark:text-zinc-600 dark:hover:text-red-400"
                      aria-label={`Delete ${r.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {adding || rows.length === 0 ? (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const value = Number(form.value);
            const invested = form.invested.trim() === "" ? null : Number(form.invested);
            if (!Number.isFinite(value) || value <= 0) return;
            await call("/api/investments", "POST", { name: form.name, kind: form.kind, value, invested });
            setForm({ name: "", kind: form.kind, value: "", invested: "" });
            setAdding(false);
          }}
        >
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name — e.g. HDFC Savings, SBI FD"
            required
            className={`${inputCls} w-60`}
          />
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as InvestmentKind })}
            className={inputCls}
            aria-label="Type"
          >
            {Object.entries(INVESTMENT_KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <input
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            placeholder="Current value"
            inputMode="decimal"
            required
            className={`${inputCls} w-32 font-mono tabular-nums placeholder:font-sans`}
          />
          <input
            value={form.invested}
            onChange={(e) => setForm({ ...form, invested: e.target.value })}
            placeholder="Invested (optional)"
            inputMode="decimal"
            className={`${inputCls} w-36 font-mono tabular-nums placeholder:font-sans`}
            title="What you put in, to show gain or loss"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-9 rounded-lg bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50"
          >
            Add
          </button>
          {rows.length > 0 && (
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-zinc-500 transition-colors hover:text-foreground">
              Cancel
            </button>
          )}
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-4 text-xs text-zinc-500 transition-colors hover:text-foreground">
          + Add manually (FDs, savings, PPF…)
        </button>
      )}
    </div>
  );
}
