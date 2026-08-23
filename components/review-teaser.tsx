import Link from "next/link";
import { formatDay, formatMoney } from "@/lib/format";
import type { ReviewCard } from "@/components/review-deck";

export function ReviewTeaser({ top, count, currency }: { top: ReviewCard; count: number; currency: string }) {
  const minutes = Math.max(1, Math.ceil((count * 2) / 60)); // ~2s per swipe
  return (
    <div className="flex flex-col items-center gap-8 rounded-2xl border border-zinc-200 bg-white p-7 sm:flex-row dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="relative h-28 w-44 shrink-0">
        <div className="absolute inset-0 -translate-x-2 -rotate-5 rounded-xl border border-zinc-200 bg-background dark:border-zinc-800" />
        <div className="absolute inset-0 translate-x-2 rotate-4 rounded-xl border border-zinc-200 bg-background dark:border-zinc-800" />
        <div className="absolute inset-0 flex flex-col justify-between rounded-xl border border-zinc-300 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div>
            <p className="font-mono text-[10px] text-zinc-500">{formatDay(top.date)}</p>
            <p className="truncate text-xs font-medium">{top.description}</p>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-sm tabular-nums">{formatMoney(top.amount, currency)}</span>
            {top.suggestion && <span className="text-[10px] font-medium text-accent">{top.suggestion}?</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div>
          <p className="font-semibold">Sort the mystery spending</p>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            {count} payments are still filed under &ldquo;Other&rdquo;. Swipe right to accept a guess, left to skip.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/review"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 active:scale-[0.98]"
          >
            Swipe through {count}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 8h11" />
              <path d="M9.5 4l4 4-4 4" />
            </svg>
          </Link>
          <span className="text-xs text-zinc-400 dark:text-zinc-600">~{minutes} min</span>
        </div>
      </div>
    </div>
  );
}
