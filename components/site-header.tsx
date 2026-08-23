import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { EngineSelect } from "@/components/engine-select";
import { Uploader } from "@/components/uploader";
import type { EngineId } from "@/lib/engines/types";

const TABS = [
  { key: "overview", href: "/", label: "Overview" },
  { key: "transactions", href: "/transactions", label: "Transactions" },
  { key: "review", href: "/review", label: "Review" },
] as const;

export type Tab = (typeof TABS)[number]["key"];

export function SiteHeader({
  active,
  reviewCount = 0,
  engine,
  available,
  showUpload,
}: {
  active: Tab;
  reviewCount?: number;
  engine: { id: EngineId; label: string };
  available: EngineId[];
  showUpload: boolean;
}) {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <AutoRefresh />
      <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center gap-x-6 gap-y-1 px-6 py-2">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          finzo
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={t.key === active ? "font-medium" : "text-zinc-500 transition-colors hover:text-foreground"}
            >
              {t.label}
              {t.key === "review" && reviewCount > 0 && (
                <span className="ml-1.5 rounded-full bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-accent">
                  {reviewCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <EngineSelect current={engine.id} available={available} />
          {showUpload && <Uploader variant="button" engineLabel={engine.label} />}
        </div>
      </div>
    </header>
  );
}
