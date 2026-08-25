"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoneyWhole } from "@/lib/format";

// Common codes up front; any ISO 4217 code the statements produce still displays fine.
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"];

async function saveSalary(value: number, currency: string, age: number | null) {
  await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ salary: value, currency, age }),
  });
}

export function SalaryForm({
  initial,
  currency: initialCurrency,
  initialAge,
  onDone,
  autoFocus,
  submitLabel = "Set salary",
  cancelLabel = "Cancel",
}: {
  initial?: number;
  currency: string;
  initialAge?: number | null;
  onDone?: () => void;
  autoFocus?: boolean;
  /** onboarding relabels these to "Next"/"Skip" */
  submitLabel?: string;
  cancelLabel?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial ? String(initial / 100) : "");
  const [age, setAge] = useState(initialAge ? String(initialAge) : "");
  const [currency, setCurrency] = useState(initialCurrency);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return;
        const years = Math.round(Number(age));
        setBusy(true);
        await saveSalary(n, currency, years >= 10 && years <= 100 ? years : null);
        setBusy(false);
        onDone?.();
        router.refresh();
      }}
    >
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="h-9 rounded-lg border border-zinc-200 bg-transparent px-2 font-mono text-sm dark:border-zinc-800"
        aria-label="Currency"
      >
        {(CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES]).map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="per month"
        inputMode="decimal"
        autoFocus={autoFocus}
        required
        className="h-9 w-36 rounded-lg border border-zinc-200 bg-transparent px-3 font-mono text-sm tabular-nums placeholder:font-sans placeholder:text-zinc-400 dark:border-zinc-800"
        aria-label="Monthly take-home salary"
      />
      <input
        value={age}
        onChange={(e) => setAge(e.target.value)}
        placeholder="Age"
        inputMode="numeric"
        className="h-9 w-16 rounded-lg border border-zinc-200 bg-transparent px-3 font-mono text-sm tabular-nums placeholder:font-sans placeholder:text-zinc-400 dark:border-zinc-800"
        aria-label="Age in years (optional, for the equity split suggestion)"
        title="Optional — unlocks the 100 − age equity split"
      />
      <button
        type="submit"
        disabled={busy}
        className="h-9 rounded-lg bg-accent-solid px-3.5 text-sm font-medium text-accent-solid-fg transition-colors hover:bg-accent-solid-hover disabled:opacity-50"
      >
        {submitLabel}
      </button>
      {onDone && (
        <button type="button" onClick={onDone} className="text-xs text-zinc-500 transition-colors hover:text-foreground">
          {cancelLabel}
        </button>
      )}
    </form>
  );
}

/** The empty state shown until a salary is set. */
export function SalarySetupCard({ currency, age }: { currency: string; age: number | null }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-lg">
          <p className="text-sm font-medium">Set your take-home salary</p>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
            Classic money rules — 50/30/20, rent under 30%, a 3–6 month cushion — get checked against your real spending. With your
            salary, targets become fixed amounts instead of following each month&apos;s recorded income.
          </p>
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">Stays on this device — Finzo is local-first.</p>
        </div>
        <SalaryForm currency={currency} initialAge={age} autoFocus={false} />
      </div>
    </div>
  );
}

/** Header chip: "Targets from your salary ₹X/mo · Edit". */
export function SalaryChip({ salary, currency, age }: { salary: number; currency: string; age: number | null }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <SalaryForm initial={salary} currency={currency} initialAge={age} onDone={() => setEditing(false)} autoFocus />;
  return (
    <p className="text-xs text-zinc-500">
      Targets from your salary <span className="font-mono tabular-nums text-foreground">{formatMoneyWhole(salary, currency)}</span>/mo ·{" "}
      <button onClick={() => setEditing(true)} className="text-accent transition-colors hover:underline">
        Edit
      </button>
    </p>
  );
}
