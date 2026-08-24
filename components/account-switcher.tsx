"use client";

import { useRouter } from "next/navigation";
import type { Account } from "@/lib/db";

export function AccountSwitcher({ accounts, selected }: { accounts: Account[]; selected?: number }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-500">
      <span className="sr-only">Account</span>
      <select
        value={selected ?? "all"}
        onChange={async (e) => {
          await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ account: e.target.value === "all" ? "all" : Number(e.target.value) }),
          });
          router.refresh();
        }}
        className="h-9 rounded-lg border border-zinc-200 bg-transparent px-2 text-sm text-foreground dark:border-zinc-800"
      >
        <option value="all">All accounts</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}
