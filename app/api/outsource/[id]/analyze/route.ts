import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { currentMonth } from "@/lib/format";
import { resolveEngine } from "@/lib/engines";
import { buildOutsourcePrompt } from "@/lib/engines/prompt";
import { DEFAULT_WORK_HOURS, outsourceFacts, planOutsource } from "@/lib/outsource";
import { spendBaseline } from "@/lib/rules";
import { parseModelJson, validateOutsourceAdvice } from "@/lib/schema";

/**
 * Hands one chore's already-computed numbers to the same CLI that reads your
 * statements, and stores the plain-English verdict it comes back with. As with
 * goals, the rate and the cost per hour are never the model's to produce.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const task = db.outsource().find((t) => t.id === Number(id));
  if (!task) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const currency = db.currency();
  const salaryMinor = db.salary();
  const hoursPerWeek = db.workHours() ?? DEFAULT_WORK_HOURS;
  const cashflows = db.monthlyCashflow();
  const { avg: typicalSpend, months: spendMonths } = spendBaseline(cashflows, currentMonth(), cashflows.at(-1)?.spent ?? 0);
  const plan = planOutsource(task, { salaryMinor, hoursPerWeek, typicalSpend, currency });
  const facts = outsourceFacts(plan, { currency, salaryMinor, hoursPerWeek, typicalSpend, spendMonths });

  const engine = resolveEngine(db.getSetting("engine"));
  // An empty scratch directory: the prompt carries everything, so the CLI is
  // given nothing on disk to read — not the statements, not the database.
  const workDir = await mkdtemp(path.join(tmpdir(), "finzo-outsource-"));
  try {
    const advice = validateOutsourceAdvice(parseModelJson(await engine.run(buildOutsourcePrompt(facts), workDir)));
    db.setOutsourceAnalysis(task.id, JSON.stringify(advice));
    return NextResponse.json({ ok: true, advice });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `${engine.label} couldn't answer.`, detail: message }, { status: 502 });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
