"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DemoButton } from "@/components/demo-controls";
import { SalaryForm } from "@/components/salary-control";
import { Uploader } from "@/components/uploader";

const STEPS = 3;

function Dots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-between text-xs text-zinc-500">
      <div className="flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={`size-2 rounded-full ${i <= step ? "bg-accent" : "bg-zinc-200 dark:bg-zinc-800"}`} />
        ))}
      </div>
      <span className="font-mono tabular-nums">
        Step {step + 1} of {STEPS}
      </span>
    </div>
  );
}

/**
 * First run, shown while the database has no transactions at all. Steps 1 and 2
 * only write settings, so quitting halfway leaves nothing broken — the server
 * hands back `initialStep` so a reload resumes where you were.
 */
export function Onboarding({
  initialStep,
  name,
  salary,
  currency,
  age,
  engineLabel,
  noCli,
}: {
  initialStep: number;
  name: string | null;
  /** minor units; prefills step 2 so stepping Back doesn't ask for it again */
  salary: number | null;
  currency: string;
  age: number | null;
  engineLabel: string;
  noCli: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [value, setValue] = useState(name ?? "");
  const [busy, setBusy] = useState(false);

  const back = (
    <button onClick={() => setStep((s) => s - 1)} className="text-xs text-zinc-500 transition-colors hover:text-foreground">
      ← Back
    </button>
  );

  return (
    <div className="w-full max-w-lg space-y-6">
      <Dots step={step} />

      {step === 0 && (
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const trimmed = value.trim();
            if (!trimmed) return;
            setBusy(true);
            await fetch("/api/settings", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: trimmed }),
            });
            setBusy(false);
            setStep(1);
            router.refresh();
          }}
        >
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome to Finzo</h1>
            <p className="mt-1.5 text-sm text-zinc-500">
              Local-first money tracking. Your statements and everything Finzo learns from them stay on this machine.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="onboarding-name" className="block text-xs font-medium text-zinc-500">
              What should I call you?
            </label>
            <input
              id="onboarding-name"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Your name"
              maxLength={60}
              autoFocus
              required
              className="h-10 w-full rounded-lg border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-accent dark:border-zinc-700"
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-zinc-500 transition-colors hover:text-foreground"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-9 rounded-lg bg-accent-solid px-3.5 text-sm font-medium text-accent-solid-fg transition-colors hover:bg-accent-solid-hover disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </form>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your money basics</h1>
            <p className="mt-1.5 text-sm text-zinc-500">
              Optional. With a take-home salary, the classic rules — 50/30/20, rent under 30%, a 3–6 month cushion — get
              checked against your real spending instead of following whatever each month happened to record. Age unlocks the
              100 − age equity split.
            </p>
          </div>
          <SalaryForm
            initial={salary ?? undefined}
            currency={currency}
            initialAge={age}
            onDone={() => setStep(2)}
            submitLabel="Next →"
            cancelLabel="Skip"
          />
          {back}
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col items-center gap-6 text-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Add your first statement</h1>
            <p className="mt-1.5 text-sm text-zinc-500">
              {engineLabel} reads it, categorizes every transaction, and your dashboard builds itself.
            </p>
          </div>
          <Uploader variant="dropzone" engineLabel={engineLabel} />
          <DemoButton />
          {noCli && (
            <div className="rounded-xl border border-zinc-200 p-4 text-left text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              <p className="font-medium text-foreground">No AI engine found</p>
              <p className="mt-1">
                Finzo uses the Claude Code or Codex CLI on this machine. Install one and sign in with your subscription:
              </p>
              <pre className="mt-2 rounded-lg bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-900">
                {"npm install -g @anthropic-ai/claude-code\nnpm install -g @openai/codex"}
              </pre>
            </div>
          )}
          {back}
        </div>
      )}
    </div>
  );
}
