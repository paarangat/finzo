"use client";

import { useRouter } from "next/navigation";
import type { EngineId } from "@/lib/engines/types";

const LABELS: Record<EngineId, string> = { claude: "Claude Code", codex: "Codex", fixture: "Fixture (demo)" };

export function EngineSelect({ current, available }: { current: EngineId; available: EngineId[] }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-500">
      <span className="max-sm:sr-only">Engine</span>
      <select
        value={current}
        onChange={async (e) => {
          await fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ engine: e.target.value }),
          });
          router.refresh();
        }}
        className="rounded-lg border border-zinc-200 bg-transparent px-2 py-1.5 text-sm text-foreground dark:border-zinc-800"
      >
        {available.map((id) => (
          <option key={id} value={id}>
            {LABELS[id]}
          </option>
        ))}
      </select>
    </label>
  );
}
