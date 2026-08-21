"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple } from "@phosphor-icons/react";
import { formatMoney, formatDay } from "@/lib/format";
import type { Balance } from "@/lib/db";

export function BalanceStat({ balance, currency }: { balance: Balance | null; currency: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  async function save() {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return setEditing(false);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manualBalance: amount }),
    });
    setEditing(false);
    router.refresh();
  }

  return (
    <div>
      <p className="text-xs font-medium text-zinc-500">Current balance</p>
      {editing ? (
        <input
          autoFocus
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          onBlur={save}
          placeholder="0.00"
          className="mt-1 w-40 rounded-lg border border-zinc-300 bg-transparent px-2 py-1 font-mono text-2xl tabular-nums outline-none focus:border-accent dark:border-zinc-700"
        />
      ) : (
        <button
          onClick={() => {
            setValue(balance ? String(balance.amount / 100) : "");
            setEditing(true);
          }}
          className="group mt-1 flex items-baseline gap-2 text-left"
          aria-label="Edit balance"
        >
          <span className="font-mono text-2xl tabular-nums tracking-tight">
            {balance ? formatMoney(balance.amount, currency) : "Not set"}
          </span>
          <PencilSimple size={14} className="text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
      <p className="mt-0.5 text-xs text-zinc-500">
        {balance ? (balance.source === "manual" ? `entered ${formatDay(balance.asOf)}` : `from statement, ${formatDay(balance.asOf)}`) : "click to enter"}
      </p>
    </div>
  );
}
