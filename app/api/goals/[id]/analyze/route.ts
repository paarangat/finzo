import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { currentMonth } from "@/lib/format";
import { resolveEngine } from "@/lib/engines";
import { buildGoalPrompt } from "@/lib/engines/prompt";
import { goalFacts, planGoal } from "@/lib/goals";
import { parseModelJson, validateGoalAdvice } from "@/lib/schema";

/**
 * Hands one goal's already-computed numbers to the same CLI that reads your
 * statements, and stores the plain-English verdict it comes back with.
 *
 * The numbers are never the model's to produce — `planGoal` does those locally,
 * and this route only asks for the judgement and the wording.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const goal = db.goals().find((g) => g.id === Number(id));
  if (!goal) return NextResponse.json({ error: "Goal not found." }, { status: 404 });

  const currency = db.currency();
  const cashflows = db.monthlyCashflow();
  const currentCalendarMonth = currentMonth();
  const balanceMinor = db.balance()?.amount ?? null;
  const plan = planGoal(goal, { balanceMinor, cashflows, currentCalendarMonth, salaryMinor: db.salary(), currency });
  const facts = goalFacts(plan, {
    currency,
    salaryMinor: db.salary(),
    balanceMinor,
    // The same three completed months the spending average comes from.
    byCategory: db.avgByCategory(cashflows.filter((c) => c.month < currentCalendarMonth && c.spent > 0).slice(-3).map((c) => c.month)),
    recurring: db.recurring().map((r) => ({ merchant: r.merchant, amount: r.amount, cadence: r.cadence })),
  });

  const engine = resolveEngine(db.getSetting("engine"));
  // An empty scratch directory: the prompt carries everything, so the CLI is
  // given nothing on disk to read — not the statements, not the database.
  const workDir = await mkdtemp(path.join(tmpdir(), "finzo-goal-"));
  try {
    const advice = validateGoalAdvice(parseModelJson(await engine.run(buildGoalPrompt(facts), workDir)));
    db.setGoalAnalysis(goal.id, JSON.stringify(advice));
    return NextResponse.json({ ok: true, advice });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `${engine.label} couldn't answer.`, detail: message }, { status: 502 });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
