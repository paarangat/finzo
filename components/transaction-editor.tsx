"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { CATEGORIES, type Category } from "@/lib/categories";
import { formatMoney } from "@/lib/format";
import type { Account, TransactionRow } from "@/lib/db";

const toMinor = (n: number) => Math.round(n * 100);

function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-full max-w-sm rounded-2xl border border-zinc-200 bg-background p-6 text-foreground shadow-lg dark:border-zinc-800"
    >
      <h2 className="mb-4 text-sm font-medium">{title}</h2>
      {open && children}
    </dialog>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-accent dark:border-zinc-700";
const labelCls = "block text-xs font-medium text-zinc-500";

/** Add a new transaction, or edit an existing one when `txn` is set. */
export function TransactionDialog({
  open,
  onClose,
  txn,
  accounts,
  defaultAccount,
  onDelete,
  onSplit,
}: {
  open: boolean;
  onClose: () => void;
  txn?: TransactionRow | null;
  accounts: Account[];
  defaultAccount?: number;
  /** shows a Delete action in the footer (touch has no hover row actions) */
  onDelete?: (txn: TransactionRow) => void;
  /** shows a Split action in the footer */
  onSplit?: (txn: TransactionRow) => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // every close path (Cancel, Escape, save) routes through here so the confirm state never leaks into the next open
  function close() {
    setConfirmingDelete(false);
    onClose();
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      date: String(f.get("date")),
      description: String(f.get("description")).trim(),
      amount: Number(f.get("amount")),
      direction: String(f.get("direction")) as "debit" | "credit",
      category: String(f.get("category")) as Category,
      ...(txn ? {} : { accountId: Number(f.get("account") ?? defaultAccount ?? accounts[0]?.id) }),
    };
    setSaving(true);
    setError(null);
    const res = await fetch(txn ? `/api/transactions/${txn.id}` : "/api/transactions", {
      method: txn ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Save failed.");
      return;
    }
    close();
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={close} title={txn ? "Edit transaction" : "Add transaction"}>
      <form onSubmit={submit} className="space-y-3" key={txn?.id ?? "new"}>
        <label className={labelCls}>
          Date
          <input name="date" type="date" required defaultValue={txn?.date ?? new Date().toISOString().slice(0, 10)} className={`mt-1 ${inputCls}`} />
        </label>
        <label className={labelCls}>
          Description
          <input name="description" required defaultValue={txn?.description ?? ""} placeholder="Coffee, cash" className={`mt-1 ${inputCls}`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Amount
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={txn ? (txn.amount / 100).toFixed(2) : ""}
              className={`mt-1 ${inputCls} font-mono tabular-nums`}
            />
          </label>
          <label className={labelCls}>
            Direction
            <select name="direction" defaultValue={txn?.direction ?? "debit"} className={`mt-1 ${inputCls}`}>
              <option value="debit">Spent (debit)</option>
              <option value="credit">Received (credit)</option>
            </select>
          </label>
        </div>
        <label className={labelCls}>
          Category
          <select name="category" defaultValue={txn?.category ?? "Other"} className={`mt-1 ${inputCls}`}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {!txn && accounts.length > 1 && (
          <label className={labelCls}>
            Account
            <select name="account" defaultValue={defaultAccount ?? accounts[0]?.id} className={`mt-1 ${inputCls}`}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex items-center gap-2 pt-2">
          {txn && (onDelete || onSplit) && (
            <span className="flex items-center gap-1 text-sm">
              {onDelete &&
                (confirmingDelete ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onDelete(txn)}
                      className="rounded-lg px-2 py-1.5 font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      Delete
                    </button>
                    <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-lg px-2 py-1.5 text-zinc-500 hover:text-foreground">
                      Keep
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmingDelete(true)} className="rounded-lg px-2 py-1.5 text-zinc-500 hover:text-red-600 dark:hover:text-red-400">
                    Delete
                  </button>
                ))}
              {onSplit && !confirmingDelete && (
                <button type="button" onClick={() => onSplit(txn)} className="rounded-lg px-2 py-1.5 text-zinc-500 hover:text-foreground">
                  Split
                </button>
              )}
            </span>
          )}
          <span className="ml-auto flex gap-2">
            <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-foreground">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-accent-solid px-3.5 py-1.5 text-sm font-medium text-accent-solid-fg hover:bg-accent-solid-hover disabled:opacity-60"
            >
              {saving ? "Saving…" : txn ? "Save" : "Add"}
            </button>
          </span>
        </div>
      </form>
    </Dialog>
  );
}

/** Split a transaction into parts that must sum to the original amount. */
export function SplitDialog({ txn, onClose, currency }: { txn: TransactionRow | null; onClose: () => void; currency: string }) {
  return (
    <Dialog open={!!txn} onClose={onClose} title="Split transaction">
      {txn && <SplitForm key={txn.id} txn={txn} onClose={onClose} currency={currency} />}
    </Dialog>
  );
}

function SplitForm({ txn, onClose, currency }: { txn: TransactionRow; onClose: () => void; currency: string }) {
  const router = useRouter();
  const [parts, setParts] = useState<{ amount: string; category: Category }[]>([
    { amount: (txn.amount / 100).toFixed(2), category: txn.category },
    { amount: "", category: "Other" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assigned = parts.reduce((acc, p) => acc + (toMinor(Number(p.amount)) || 0), 0);
  const remainder = txn.amount - assigned;

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/transactions/${txn.id}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parts: parts.map((p) => ({ amount: Number(p.amount), category: p.category })) }),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Split failed.");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="space-y-3">
          <p className="text-sm text-zinc-500">
            <span className="text-foreground">{txn.description}</span> · {formatMoney(txn.amount, currency)}
          </p>
          {parts.map((p, i) => (
            <div key={i} className="grid grid-cols-[7rem_1fr] gap-2">
              <input
                inputMode="decimal"
                value={p.amount}
                onChange={(e) => setParts(parts.map((q, j) => (j === i ? { ...q, amount: e.target.value } : q)))}
                placeholder="0.00"
                aria-label={`Part ${i + 1} amount`}
                className={`${inputCls} font-mono tabular-nums`}
              />
              <select
                value={p.category}
                onChange={(e) => setParts(parts.map((q, j) => (j === i ? { ...q, category: e.target.value as Category } : q)))}
                aria-label={`Part ${i + 1} category`}
                className={inputCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm">
            <button
              onClick={() => setParts([...parts, { amount: "", category: "Other" }])}
              className="inline-flex items-center gap-1 text-zinc-500 hover:text-foreground"
            >
              <Plus size={14} /> Add part
            </button>
            <span className={`font-mono text-xs tabular-nums ${remainder === 0 ? "text-accent" : "text-amber-600 dark:text-amber-400"}`}>
              {remainder === 0 ? "fully assigned" : `${formatMoney(remainder, currency)} left`}
            </span>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:text-foreground">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving || remainder !== 0}
              className="rounded-lg bg-accent-solid px-3.5 py-1.5 text-sm font-medium text-accent-solid-fg hover:bg-accent-solid-hover disabled:opacity-60"
            >
              {saving ? "Splitting…" : "Split"}
            </button>
          </div>
    </div>
  );
}

/** Toolbar button that opens the add-transaction dialog. */
export function AddTransactionButton({ accounts, defaultAccount }: { accounts: Account[]; defaultAccount?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-600 transition-colors hover:border-accent hover:text-accent dark:border-zinc-800 dark:text-zinc-400"
      >
        <Plus size={14} weight="bold" /> Add transaction
      </button>
      <TransactionDialog open={open} onClose={() => setOpen(false)} accounts={accounts} defaultAccount={defaultAccount} />
    </>
  );
}
