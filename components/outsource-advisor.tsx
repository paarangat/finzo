"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatMoney, formatMoneyWhole } from "@/lib/format";
import { GOAL_TEXT } from "@/lib/goals";
import { DEFAULT_WORK_HOURS, formatHours, monthlyHours, OUTSOURCE_ADVICE_TEXT, storedOutsourceAdvice, type OutsourcePlan } from "@/lib/outsource";
import type { OutsourceRow } from "@/lib/db";

const inputCls =
  "h-9 rounded-lg border border-zinc-200 bg-transparent px-3 text-sm placeholder:text-zinc-400 dark:border-zinc-800";

const CADENCE_WORD: Record<OutsourceRow["cadence"], string> = { once: "one-off", weekly: "every week", monthly: "every month" };

/** "Your hour is worth ₹X" with the hours-a-week it's divided by, editable in place. */
export function HourlyRate({
  rate,
  salary,
  hoursPerWeek,
  currency,
}: {
  rate: number | null; // minor units per hour; null without a salary
  salary: number | null;
  hoursPerWeek: number | null; // null means the 40-hour default is in play
  currency: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(hoursPerWeek ?? DEFAULT_WORK_HOURS));
  const [busy, setBusy] = useState(false);
  const hours = hoursPerWeek ?? DEFAULT_WORK_HOURS;

  async function save() {
    const n = Number(draft);
    if (!Number.isFinite(n) || n <= 0 || n > 100) return;
    setBusy(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // Back to the default clears the setting rather than pinning 40 forever.
      body: JSON.stringify({ workHours: n === DEFAULT_WORK_HOURS ? null : n }),
    });
    setBusy(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-medium text-zinc-500">Your hour is worth</p>
        <p className="mt-1 font-mono text-2xl tabular-nums tracking-tight">{rate === null ? "—" : formatMoneyWhole(rate, currency)}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {salary === null ? (
            "Set your take-home salary above to work this out."
          ) : (
            <>
              <span className="font-mono tabular-nums">{formatMoneyWhole(salary, currency)}</span> a month over{" "}
              <span className="font-mono tabular-nums">{hours}</span> hrs a week, about{" "}
              <span className="font-mono tabular-nums">{Math.round(monthlyHours(hours))}</span> hrs a month
              {hoursPerWeek === null && " (assumed — edit if you work more or less)"}.
            </>
          )}
        </p>
      </div>
      {editing ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputMode="decimal"
            autoFocus
            className={`${inputCls} w-20 font-mono tabular-nums`}
            aria-label="Hours worked a week"
          />
          <span className="text-xs text-zinc-500">hrs a week</span>
          <button type="submit" disabled={busy} className="h-9 rounded-lg bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50">
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-zinc-500 transition-colors hover:text-foreground">
            Cancel
          </button>
        </form>
      ) : (
        <button onClick={() => setEditing(true)} className="text-xs text-accent transition-colors hover:underline">
          Edit hours
        </button>
      )}
    </div>
  );
}

/** The chores you've asked about, each with the local verdict and the engine's read, plus the ask form. */
export function OutsourceAdvisor({ plans, currency, engineLabel }: { plans: OutsourcePlan[]; currency: string; engineLabel: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState<number | null>(null);
  const [askError, setAskError] = useState<{ id: number; message: string } | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ name: string; cost: string; hours: string; cadence: OutsourceRow["cadence"] }>({
    name: "",
    cost: "",
    hours: "",
    cadence: "monthly",
  });
  const [busy, setBusy] = useState(false);

  async function call(path: string, method: string, body?: object): Promise<{ id?: number } | null> {
    setBusy(true);
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    const json = res.ok ? ((await res.json()) as { id?: number }) : null;
    setBusy(false);
    router.refresh();
    return json;
  }

  /** The one engine call here: the numbers are already worked out, this asks for the read on them. */
  async function ask(id: number) {
    setAsking(id);
    setAskError(null);
    try {
      const res = await fetch(`/api/outsource/${id}/analyze`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) setAskError({ id, message: json.detail ? `${json.error} ${json.detail.slice(0, 160)}` : json.error });
      else router.refresh();
    } catch (err) {
      setAskError({ id, message: err instanceof Error ? err.message : "Could not reach the engine." });
    }
    setAsking(null);
  }

  return (
    <div>
      {plans.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map(({ task, ...p }) => {
            const advice = storedOutsourceAdvice(task);
            return (
              <div key={task.id} className="group rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{task.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      <span className="font-mono tabular-nums">{formatMoney(task.cost, currency)}</span> {CADENCE_WORD[task.cadence]} ·{" "}
                      <span className="font-mono tabular-nums">{formatHours(task.hours)}</span> back each time
                    </p>
                  </div>
                  {confirming === task.id ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs">
                      <button
                        onClick={() => {
                          setConfirming(null);
                          call(`/api/outsource/${task.id}`, "DELETE");
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
                      onClick={() => setConfirming(task.id)}
                      className="shrink-0 rounded-md p-1 text-zinc-300 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover:opacity-100 dark:text-zinc-600 dark:hover:text-red-400"
                      aria-label={`Delete ${task.name}`}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <p className="mt-3 font-mono text-[22px] tabular-nums tracking-tight">{p.headline}</p>
                <p className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-zinc-500" title={p.sub}>
                  {p.sub}
                </p>

                <p className={`mt-2.5 text-[11px] leading-relaxed ${GOAL_TEXT[p.status]}`}>{p.verdict}</p>
                {p.note && <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">{p.note}</p>}
                {p.rate !== null && task.cadence !== "once" && (
                  <p className="mt-2 border-t border-zinc-100 pt-2 text-[11px] text-zinc-500 dark:border-zinc-800/60">
                    <span className="font-mono tabular-nums">{formatMoneyWhole(p.monthlyCost, currency)}</span> a month for{" "}
                    <span className="font-mono tabular-nums">{formatHours(Math.round(p.monthlyHours * 10) / 10)}</span> back
                    {p.surplusShare !== null && (
                      <>
                        {" "}
                        · <span className="font-mono tabular-nums">{Math.round(p.surplusShare * 100)}%</span> of what you save
                      </>
                    )}
                  </p>
                )}

                <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800/60">
                  {advice && (
                    <>
                      <p className={`text-xs font-medium leading-relaxed ${OUTSOURCE_ADVICE_TEXT[advice.verdict]}`}>{advice.headline}</p>
                      <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-zinc-500">
                        {advice.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {askError?.id === task.id && <p className="text-[11px] text-red-600 dark:text-red-400">{askError.message}</p>}
                  <button
                    onClick={() => ask(task.id)}
                    disabled={asking !== null}
                    className="mt-2 text-[11px] text-zinc-500 transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    {asking === task.id
                      ? `Asking ${engineLabel}…`
                      : advice
                        ? `Ask ${engineLabel} again${task.analysis_at ? ` · asked ${formatDate(task.analysis_at)}` : ""}`
                        : `Ask ${engineLabel}: should I hand this off?`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {adding || plans.length === 0 ? (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const cost = Number(form.cost);
            const hours = Number(form.hours);
            if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(hours) || hours <= 0) return;
            const created = await call("/api/outsource", "POST", { name: form.name, cost, hours, cadence: form.cadence });
            setForm({ name: "", cost: "", hours: "", cadence: "monthly" });
            setAdding(false);
            // Asking is the whole point of adding it, so ask without being asked.
            if (created?.id) await ask(created.id);
          }}
        >
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="What would you hand off — e.g. house cleaning"
            required
            className={`${inputCls} w-72`}
          />
          <input
            value={form.cost}
            onChange={(e) => setForm({ ...form, cost: e.target.value })}
            placeholder="Cost each time"
            inputMode="decimal"
            required
            className={`${inputCls} w-32 font-mono tabular-nums placeholder:font-sans`}
          />
          <input
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
            placeholder="Hours it saves"
            inputMode="decimal"
            required
            className={`${inputCls} w-32 font-mono tabular-nums placeholder:font-sans`}
            title="Hours of your time it frees up each time"
          />
          <select
            value={form.cadence}
            onChange={(e) => setForm({ ...form, cadence: e.target.value as OutsourceRow["cadence"] })}
            className={`${inputCls} px-2`}
            aria-label="How often"
          >
            <option value="once">One-off</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </select>
          <button type="submit" disabled={busy} className="h-9 rounded-lg bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50">
            Should I?
          </button>
          {plans.length > 0 && (
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-zinc-500 transition-colors hover:text-foreground">
              Cancel
            </button>
          )}
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-4 text-xs text-zinc-500 transition-colors hover:text-foreground">
          + Ask about something else you could hand off
        </button>
      )}
    </div>
  );
}
