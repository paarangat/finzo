"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Re-render server data whenever the database changes, from any source. */
export function AutoRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  const last = useRef<string | null>(null);

  useEffect(() => {
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const { v } = await (await fetch("/api/status")).json();
        if (last.current !== null && v !== last.current) router.refresh();
        last.current = v;
      } catch {
        // server briefly unreachable (restart); try again next tick
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
