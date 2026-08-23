"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/categories";
import { formatDay, formatMoney } from "@/lib/format";

export interface ReviewCard {
  id: number;
  date: string;
  description: string;
  amount: number;
  suggestion: Category | null;
}

const THRESHOLD = 90; // px of drag before a release commits the swipe
const CHIP_CATEGORIES = CATEGORIES.filter((c) => c !== "Other" && c !== "Income");

export function ReviewDeck({ deck, currency }: { deck: ReviewCard[]; currency: string }) {
  const [i, setI] = useState(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fly, setFly] = useState<0 | -1 | 1>(0);
  const card = fly ? deck[i - 1] : deck[i];

  const advance = useCallback((dir: -1 | 1) => {
    setI((n) => n + 1);
    setFly(dir);
    setTimeout(() => {
      setFly(0);
      setDx(0);
    }, 250);
  }, []);

  const tag = useCallback(
    (id: number, category: Category, dir: -1 | 1) => {
      // ponytail: fire-and-forget; the dashboard is force-dynamic and refetches on nav
      fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      advance(dir);
    },
    [advance]
  );

  const skip = useCallback(() => advance(-1), [advance]);
  const accept = useCallback(() => {
    const c = deck[i];
    if (c?.suggestion) tag(c.id, c.suggestion, 1);
  }, [deck, i, tag]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (fly || i >= deck.length) return;
      if (e.key === "ArrowRight") accept();
      if (e.key === "ArrowLeft") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accept, skip, fly, i, deck.length]);

  if (deck.length === 0 || (i >= deck.length && !fly)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-medium">{deck.length === 0 ? "Nothing to review" : "All done"}</p>
        <p className="text-sm text-zinc-500">
          {deck.length === 0 ? "Every transaction has a category." : `Reviewed ${deck.length} transactions.`}
        </p>
        <Link href="/" className="mt-2 text-sm text-accent underline underline-offset-4">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const offset = fly ? fly * 480 : dx;
  const verdict = offset > THRESHOLD / 2 && card.suggestion ? "accept" : offset < -THRESHOLD / 2 ? "skip" : null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <p className="font-mono text-xs tabular-nums text-zinc-500">
        {Math.min(i + 1, deck.length)} of {deck.length}
      </p>

      <div className="relative h-64 w-full max-w-sm select-none">
        {[2, 1].map(
          (behind) =>
            deck[(fly ? i - 1 : i) + behind] && (
              <div
                key={behind}
                className="absolute inset-0 rounded-2xl border border-zinc-200 bg-background dark:border-zinc-800"
                style={{ transform: `scale(${1 - behind * 0.05}) translateY(${behind * 14}px)` }}
              />
            )
        )}

        <div
          className="absolute inset-0 flex cursor-grab touch-none flex-col justify-between rounded-2xl border border-zinc-200 bg-background p-6 shadow-sm active:cursor-grabbing dark:border-zinc-800"
          style={{
            transform: `translateX(${offset}px) rotate(${offset / 18}deg)`,
            transition: dragging ? "none" : "transform 250ms ease, opacity 250ms ease",
            opacity: fly ? 0 : 1,
          }}
          onPointerDown={(e) => {
            if (fly) return;
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
            const from = e.clientX;
            const move = (ev: PointerEvent) => setDx(ev.clientX - from);
            const up = (ev: PointerEvent) => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
              setDragging(false);
              const d = ev.clientX - from;
              if (d > THRESHOLD && deck[i].suggestion) accept();
              else if (d < -THRESHOLD) skip();
              else setDx(0);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          <div>
            <p className="font-mono text-xs text-zinc-500">{formatDay(card.date)}</p>
            <p className="mt-1 text-lg font-medium" title={card.description}>
              {card.description}
            </p>
            <p className="mt-1 font-mono text-2xl tabular-nums tracking-tight">{formatMoney(card.amount, currency)}</p>
          </div>
          <div className="flex items-center justify-between text-sm">
            {card.suggestion ? (
              <span className={verdict === "accept" ? "font-medium text-accent" : "text-zinc-500"}>
                Suggested: <span className="text-foreground">{card.suggestion}</span>
              </span>
            ) : (
              <span className="text-zinc-500">No guess — pick below</span>
            )}
            <span className={verdict === "skip" ? "font-medium text-foreground" : "text-zinc-400 dark:text-zinc-600"}>
              {verdict === "skip" ? "Skip" : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="flex max-w-md flex-wrap justify-center gap-2">
        {CHIP_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => !fly && tag(card.id, c, 1)}
            className="min-h-11 rounded-full border border-zinc-200 px-4 text-xs text-zinc-600 transition-colors hover:border-accent hover:text-accent dark:border-zinc-800 dark:text-zinc-400"
          >
            {c}
          </button>
        ))}
      </div>

      <p className="text-xs text-zinc-500">
        Swipe or <kbd className="rounded border border-zinc-200 px-1 font-mono dark:border-zinc-800">→</kbd> accept
        {" · "}
        <kbd className="rounded border border-zinc-200 px-1 font-mono dark:border-zinc-800">←</kbd> skip
      </p>
    </div>
  );
}
