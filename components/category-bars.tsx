"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, NON_SPEND_CATEGORIES } from "@/lib/categories";
import { categoryColor } from "@/lib/colors";
import { delta, formatMoney } from "@/lib/format";
import { Delta } from "@/components/delta";
import type { Budget, Summary } from "@/lib/db";

export function CategoryBars({
  data,
  budgets,
  prev = {},
  currency,
}: {
  data: Summary["byCategory"];
  budgets: Budget[];
  /** previous month's totals by category; rows that moved >10% get a ↑/↓ suffix */
  prev?: Record<string, number>;
  currency: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const limits = new Map(budgets.map((b) => [b.category, b.limit]));
  // Budgeted categories with no spend this month still get a (0%) row.
  const rows = [...data, ...budgets.filter((b) => !data.some((d) => d.category === b.category)).map((b) => ({ category: b.category, total: 0 }))];
  // A category picked from "Set a budget" gets a temporary 0-spend row to type into.
  if (adding && !rows.some((r) => r.category === adding)) rows.push({ category: adding as (typeof rows)[number]["category"], total: 0 });
  if (rows.length === 0) {
    return <p className="py-8 text-sm text-zinc-500">No spending recorded this month.</p>;
  }
  const max = Math.max(...data.map((d) => d.total), 1);
  const unbudgeted = CATEGORIES.filter((c) => !NON_SPEND_CATEGORIES.includes(c) && !limits.has(c) && c !== adding);

  async function save(category: string) {
    const amount = value.trim() === "" ? null : Number(value);
    setAdding(null);
    if (amount !== null && !(amount > 0)) return setEditing(null);
    await fetch("/api/budgets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, amount }),
    });
    setEditing(null);
    router.refresh();
  }

  return (
    <ul className="space-y-3">
      {rows.map(({ category, total }) => {
        const limit = limits.get(category);
        const ratio = limit ? total / limit : total / max;
        const color = !limit
          ? categoryColor(category)
          : ratio >= 1
            ? "light-dark(#dc2626, #ef4444)"
            : ratio >= 0.8
              ? "light-dark(#d97706, #f59e0b)"
              : categoryColor(category);
        return (
          <li key={category} className="grid grid-cols-[8rem_1fr_auto_3rem] items-center gap-3 text-sm">
            <span className="truncate text-zinc-600 dark:text-zinc-400">{category}</span>
            <div className={`relative h-2 ${limit ? "rounded-r-[4px] bg-zinc-100 dark:bg-zinc-800" : ""}`}>
              <div
                className="h-full rounded-r-[4px]"
                style={{ width: `${Math.min(Math.max(ratio * 100, 1), 100)}%`, minWidth: "6px", background: color }}
              />
              {limit && <span aria-hidden className="absolute -top-1 right-0 h-4 w-px bg-zinc-400 dark:bg-zinc-500" />}
            </div>
            {editing === category ? (
              <input
                autoFocus
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => (e.key === "Enter" ? save(category) : e.key === "Escape" && setEditing(null))}
                onBlur={() => save(category)}
                placeholder="no limit"
                aria-label={`Monthly limit for ${category}`}
                className="w-24 rounded-md border border-zinc-300 bg-transparent px-1.5 py-0.5 font-mono text-xs tabular-nums outline-none focus:border-accent dark:border-zinc-700"
              />
            ) : (
              <button
                onClick={() => {
                  setValue(limit ? String(limit / 100) : "");
                  setEditing(category);
                }}
                className="rounded-md px-1.5 py-0.5 text-left font-mono text-xs tabular-nums text-zinc-500 underline decoration-zinc-300 decoration-dashed underline-offset-4 transition-colors hover:bg-zinc-100 hover:text-foreground dark:decoration-zinc-600 dark:hover:bg-zinc-800"
                aria-label={`Set monthly limit for ${category}`}
                title="Click to set a monthly limit"
              >
                {formatMoney(total, currency)}
                {limit && <span className="text-zinc-400"> / {formatMoney(limit, currency)}</span>}
              </button>
            )}
            <span className="text-right">
              {Math.abs(delta(total, prev[category] ?? 0) ?? 0) > 10 && <Delta current={total} prev={prev[category]} muted />}
            </span>
          </li>
        );
      })}
      {unbudgeted.length > 0 && (
        <li>
          <select
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              setAdding(e.target.value);
              setEditing(e.target.value);
              setValue("");
            }}
            aria-label="Set a budget for a category"
            className="rounded-lg border border-dashed border-zinc-300 bg-transparent px-2 py-1.5 text-xs text-zinc-500 dark:border-zinc-700"
          >
            <option value="">+ Set a budget…</option>
            {unbudgeted.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </li>
      )}
    </ul>
  );
}
