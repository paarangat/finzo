"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DemoButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        const res = await fetch("/api/demo", { method: "POST" });
        const json = await res.json();
        router.push(`/?month=${json.month}`);
        router.refresh();
      }}
      disabled={loading}
      className="text-sm text-accent underline underline-offset-4 disabled:opacity-60"
    >
      {loading ? "Loading demo…" : "Or explore with demo data first"}
    </button>
  );
}

export function DemoBanner() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <span>You&apos;re looking at demo data.</span>
      <button
        onClick={async () => {
          await fetch("/api/demo", { method: "DELETE" });
          router.push("/");
          router.refresh();
        }}
        className="font-medium underline underline-offset-4"
      >
        Clear demo data
      </button>
    </div>
  );
}
