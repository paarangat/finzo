"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatMoney } from "@/lib/format";
import { ADVICE_TEXT, GOAL_FILL, GOAL_TEXT, storedAdvice, type GoalPlan } from "@/lib/goals";

const inputCls =
  "h-9 rounded-lg border border-zinc-200 bg-transparent px-3 text-sm placeholder:text-zinc-400 dark:border-zinc-800";

/** Goals list with inline top-ups, plus the add form. The math arrives already done in `plans`. */
export function GoalPlanner({ plans, currency, engineLabel }: { plans: GoalPlan[]; currency: string; engineLabel: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState<number | null>(null);
  const [askError, setAskError] = useState<{ id: number; message: string } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", target: "", targetDate: "", saved: "" });
  const [busy, setBusy] = useState(false);

  async function call(path: string, method: string, body?: object): Promise<{ id?: number } | null> {
    setBusy(true);
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    const json = res.ok ? ((await res.json()) as { id?: number }) : null;
    setBusy(false);
    router.refresh();
    return json;
  }

  /** The one engine call in this feature: the numbers are already worked out, this asks for the read on them. */
  async function ask(id: number) {
    setAsking(id);
    setAskError(null);
    try {
      const res = await fetch(`/api/goals/${id}/analyze`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) setAskError({ id, message: json.detail ? `${json.error} ${json.detail.slice(0, 160)}` : json.error });
      else router.refresh();
    } catch (err) {
      setAskError({ id, message: err instanceof Error ? err.message : "Could not reach the engine." });
    }
    setAsking(null);
  }

  async function saveSaved(id: number) {
    const n = Number(draft);
    if (Number.isFinite(n) && n >= 0) await call(`/api/goals/${id}`, "PATCH", { saved: n });
    setEditing(null);
  }

  return (
    <div>
      {plans.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map(({ goal, ...p }) => (
            <div
              key={goal.id}
              className="group rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{goal.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    <span className="font-mono tabular-nums">{formatMoney(goal.target, currency)}</span>
                    {goal.target_date && <> · by {formatDate(goal.target_date)}</>}
                  </p>
                </div>
                {confirming === goal.id ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs">
                    <button
                      onClick={() => {
                        setConfirming(null);
                        call(`/api/goals/${goal.id}`, "DELETE");
                      }}
                      className="rounded-md px-2 py-1 font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      Delete
                    </button>
                    <button onClick={() => setConfirming(null)} className="rounded-md px-2 py-1 text-zinc-500 hover:text-foreground">
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirming(goal.id)}
                    className="shrink-0 rounded-md p-1 text-zinc-300 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover:opacity-100 dark:text-zinc-600 dark:hover:text-red-400"
                    aria-label={`Delete ${goal.name}`}
                  >
                    ✕
                  </button>
                )}
              </div>

              <p className="mt-3 font-mono text-[22px] tabular-nums tracking-tight">{p.headline}</p>
              <p className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-zinc-500" title={p.sub}>
                {p.sub}
              </p>

              <div className="mt-3 h-1 rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div className={`h-1 rounded-full ${GOAL_FILL[p.status]}`} style={{ width: `${p.progress * 100}%` }} />
              </div>
              <p className="mt-2 flex items-baseline justify-between gap-2 text-[11px] text-zinc-500">
                {editing === goal.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveSaved(goal.id);
                    }}
                  >
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => saveSaved(goal.id)}
                      autoFocus
                      inputMode="decimal"
                      className="h-7 w-28 rounded-lg border border-zinc-200 bg-transparent px-2 font-mono text-xs tabular-nums dark:border-zinc-800"
                      aria-label={`Amount saved towards ${goal.name}`}
                    />
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setEditing(goal.id);
                      setDraft(String(goal.saved / 100));
                    }}
                    className="-ml-1.5 rounded-md px-1.5 py-0.5 font-mono tabular-nums transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
                    title="Click to update what you've put aside"
                  >
                    {formatMoney(goal.saved, currency)} saved
                  </button>
                )}
                <span className="font-mono tabular-nums">{Math.round(p.progress * 100)}%</span>
              </p>

              <p className={`mt-2.5 text-[11px] ${GOAL_TEXT[p.status]}`}>{p.verdict}</p>
              {p.buyNow && (
                <p className={`mt-2 border-t border-zinc-100 pt-2 text-[11px] dark:border-zinc-800/60 ${GOAL_TEXT[p.buyNow.status]}`}>
                  {p.buyNow.label}
                </p>
              )}

              {(() => {
                const advice = storedAdvice(goal);
                return (
                  <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800/60">
                    {advice && (
                      <>
                        <p className={`text-xs font-medium leading-relaxed ${ADVICE_TEXT[advice.verdict]}`}>{advice.headline}</p>
                        <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-zinc-500">
                          {advice.reasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                        {advice.cuts.length > 0 && (
                          <ul className="mt-2 space-y-1 text-[11px] leading-relaxed">
                            {advice.cuts.map((c) => (
                              <li key={c.category}>
                                <span className="font-medium">{c.category}</span>{" "}
                                <span className="font-mono tabular-nums">−{formatMoney(Math.round(c.monthly * 100), currency)}</span>
                                <span className="text-zinc-500">/mo · {c.note}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                    {askError?.id === goal.id && <p className="text-[11px] text-red-600 dark:text-red-400">{askError.message}</p>}
                    <button
                      onClick={() => ask(goal.id)}
                      disabled={asking !== null}
                      className="mt-2 text-[11px] text-zinc-500 transition-colors hover:text-foreground disabled:opacity-50"
                    >
                      {asking === goal.id
                        ? `Asking ${engineLabel}…`
                        : advice
                          ? `Ask ${engineLabel} again${goal.analysis_at ? ` · asked ${formatDate(goal.analysis_at)}` : ""}`
                          : `Ask ${engineLabel}: can I afford this?`}
                    </button>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {adding || plans.length === 0 ? (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const target = Number(form.target);
            const saved = form.saved.trim() === "" ? undefined : Number(form.saved);
            if (!Number.isFinite(target) || target <= 0) return;
            const created = await call("/api/goals", "POST", {
              name: form.name,
              target,
              saved,
              targetDate: form.targetDate || null,
            });
            setForm({ name: "", target: "", targetDate: "", saved: "" });
            setAdding(false);
            // Adding it is the moment you want the answer, so ask without being asked.
            if (created?.id) await ask(created.id);
          }}
        >
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="What is it — e.g. MacBook, Goa trip"
            required
            className={`${inputCls} w-64`}
          />
          <input
            value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}
            placeholder="Price"
            inputMode="decimal"
            required
            className={`${inputCls} w-28 font-mono tabular-nums placeholder:font-sans`}
          />
          <input
            type="date"
            value={form.targetDate}
            onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
            className={`${inputCls} font-mono tabular-nums`}
            aria-label="Want it by (optional)"
            title="Want it by — leave empty and Finzo works out when you'd get there"
          />
          <input
            value={form.saved}
            onChange={(e) => setForm({ ...form, saved: e.target.value })}
            placeholder="Saved (optional)"
            inputMode="decimal"
            className={`${inputCls} w-32 font-mono tabular-nums placeholder:font-sans`}
            title="Already put aside for this"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-9 rounded-lg bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50"
          >
            Add
          </button>
          {plans.length > 0 && (
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-zinc-500 transition-colors hover:text-foreground">
              Cancel
            </button>
          )}
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-4 text-xs text-zinc-500 transition-colors hover:text-foreground">
          + Add something you&apos;re saving for
        </button>
      )}
    </div>
  );
}
