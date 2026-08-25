"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, Scissors, TrashSimple } from "@phosphor-icons/react";
import { CATEGORIES, type Category } from "@/lib/categories";
import { categoryColor } from "@/lib/colors";
import { formatDate, formatDay, formatMoney } from "@/lib/format";
import { SplitDialog, TransactionDialog } from "@/components/transaction-editor";
import type { Account, TransactionRow } from "@/lib/db";

export function TransactionsTable({
  transactions,
  currency,
  accounts = [],
  showYear = false,
  showAccount = false,
}: {
  transactions: TransactionRow[];
  currency: string;
  accounts?: Account[];
  showYear?: boolean;
  /** show which account each row belongs to (useful in the combined view) */
  showAccount?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [splitting, setSplitting] = useState<TransactionRow | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{ message: string; undo: () => Promise<void> } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Selection can hold ids from a previous month's render; only visible rows count.
  const selectedRows = transactions.filter((t) => selected.has(t.id));

  function showUndo(message: string, undo: () => Promise<void>) {
    clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = setTimeout(() => setToast(null), 8000);
  }

  async function patchCategory(id: number, category: string) {
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
  }

  async function recategorize(t: TransactionRow, category: string) {
    const prev = t.category;
    await patchCategory(t.id, category);
    // ponytail: undo re-PATCHes the old category, which marks the row user-overridden even
    // if it wasn't before — harmless, and beats a server-side undo log.
    showUndo(`${t.description} → ${category}`, () => patchCategory(t.id, prev));
    router.refresh();
  }

  async function bulkRecategorize(category: Category) {
    const rows = selectedRows;
    const prev = rows.map((r) => ({ id: r.id, category: r.category }));
    await fetch("/api/transactions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: rows.map((r) => r.id), category }),
    });
    showUndo(`${rows.length} ${rows.length === 1 ? "transaction" : "transactions"} → ${category}`, async () => {
      const byCategory = new Map<Category, number[]>();
      for (const p of prev) byCategory.set(p.category, [...(byCategory.get(p.category) ?? []), p.id]);
      for (const [cat, ids] of byCategory) {
        await fetch("/api/transactions/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, category: cat }),
        });
      }
    });
    setSelected(new Set());
    router.refresh();
  }

  async function remove(id: number) {
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    setConfirmingDelete(null);
    router.refresh();
  }

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = transactions.length > 0 && selectedRows.length === transactions.length;
  const iconBtn =
    "rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800";
  const checkbox = "size-3.5 accent-accent";

  return (
    <div>
      {selectedRows.length > 0 && (
        <div className="sticky top-0 z-20 -mx-2 mb-2 flex items-center gap-3 rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm shadow-sm dark:border-zinc-800">
          <span className="text-zinc-500">
            {selectedRows.length} selected
          </span>
          <select
            value=""
            onChange={(e) => bulkRecategorize(e.target.value as Category)}
            className="rounded-md border border-zinc-200 bg-transparent py-1 pl-2 pr-6 text-sm dark:border-zinc-800"
            aria-label="Recategorize selected transactions"
          >
            <option value="" disabled>
              Recategorize…
            </option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-zinc-500 transition-colors hover:text-foreground">
            Clear
          </button>
        </div>
      )}
      {/* On phones the table's Amount column fell off-screen; a two-line list keeps money visible and row-tap opens the editor. */}
      {/* ponytail: no bulk-select on the mobile list — checkboxes fight the row-tap editor; desktop covers it. */}
      <ul className="divide-y divide-zinc-100 text-sm md:hidden dark:divide-zinc-800/60">
        {transactions.map((t) => (
          <li key={t.id}>
            <button onClick={() => setEditing(t)} className="flex w-full items-center gap-3 py-2.5 text-left" aria-label={`Edit ${t.description}`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{t.description}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                  <span className="font-mono">{showYear ? formatDate(t.date) : formatDay(t.date)}</span>
                  <span aria-hidden>·</span>
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: categoryColor(t.category) }} />
                  {t.category}
                  {showAccount && t.account && <span className="truncate">· {t.account}</span>}
                </span>
              </span>
              <span className={`shrink-0 font-mono tabular-nums ${t.direction === "credit" ? "text-accent" : ""}`}>
                {t.direction === "credit" ? "+" : ""}
                {formatMoney(t.amount, currency)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <table className="w-full text-sm max-md:hidden">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="text-left text-xs text-zinc-500">
            <th className="w-8 py-2 pr-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(transactions.map((t) => t.id)))}
                className={checkbox}
                aria-label="Select all transactions"
              />
            </th>
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium">Description</th>
            {showAccount && <th className="py-2 pr-4 font-medium">Account</th>}
            <th className="py-2 pr-4 font-medium">Category</th>
            <th className="py-2 text-right font-medium">Amount</th>
            <th className="py-2 pl-3 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {transactions.map((t) => (
            <tr key={t.id} className="group">
              <td className="w-8 py-2.5 pr-2">
                <input
                  type="checkbox"
                  checked={selected.has(t.id)}
                  onChange={() => toggle(t.id)}
                  className={checkbox}
                  aria-label={`Select ${t.description}`}
                />
              </td>
              <td className="whitespace-nowrap py-2.5 pr-4 font-mono text-xs text-zinc-500">{showYear ? formatDate(t.date) : formatDay(t.date)}</td>
              <td className="max-w-75 truncate py-2.5 pr-4" title={t.description}>
                {t.description}
              </td>
              {showAccount && <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-zinc-500">{t.account}</td>}
              <td className="py-2.5 pr-4">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: categoryColor(t.category) }} />
                  <select
                    value={t.category}
                    onChange={(e) => recategorize(t, e.target.value)}
                    className="rounded-md border border-transparent bg-transparent py-1 pr-6 text-sm text-zinc-600 transition-colors hover:border-zinc-200 dark:text-zinc-400 dark:hover:border-zinc-800"
                    aria-label={`Category for ${t.description}`}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </span>
              </td>
              <td
                className={`whitespace-nowrap py-2.5 text-right font-mono tabular-nums ${
                  t.direction === "credit" ? "text-accent" : ""
                }`}
              >
                {t.direction === "credit" ? "+" : ""}
                {formatMoney(t.amount, currency)}
              </td>
              <td className="whitespace-nowrap py-1.5 pl-3 text-right">
                {confirmingDelete === t.id ? (
                  <span className="inline-flex items-center gap-1 text-xs">
                    <button onClick={() => remove(t.id)} className="rounded-md px-2 py-1 font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
                      Delete
                    </button>
                    <button onClick={() => setConfirmingDelete(null)} className="rounded-md px-2 py-1 text-zinc-500 hover:text-foreground">
                      Keep
                    </button>
                  </span>
                ) : (
                  <span className="inline-flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <button onClick={() => setEditing(t)} className={iconBtn} aria-label={`Edit ${t.description}`} title="Edit">
                      <PencilSimple size={14} />
                    </button>
                    <button onClick={() => setSplitting(t)} className={iconBtn} aria-label={`Split ${t.description}`} title="Split across categories">
                      <Scissors size={14} />
                    </button>
                    <button onClick={() => setConfirmingDelete(t.id)} className={iconBtn} aria-label={`Delete ${t.description}`} title="Delete">
                      <TrashSimple size={14} />
                    </button>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-3rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-zinc-200 bg-background px-4 py-2.5 text-sm shadow-lg dark:border-zinc-700">
          <span className="truncate">{toast.message}</span>
          <button
            onClick={async () => {
              clearTimeout(toastTimer.current);
              setToast(null);
              await toast.undo();
              router.refresh();
            }}
            className="shrink-0 font-medium text-accent"
          >
            Undo
          </button>
        </div>
      )}
      <TransactionDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        txn={editing}
        accounts={accounts}
        onDelete={(t) => {
          setEditing(null);
          remove(t.id);
        }}
        onSplit={(t) => {
          setEditing(null);
          setSplitting(t);
        }}
      />
      <SplitDialog txn={splitting} onClose={() => setSplitting(null)} currency={currency} />
    </div>
  );
}
