import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, toMinor } from "@/lib/db";

const Body = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  target: z.number().positive().optional(),
  saved: z.number().min(0).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid goal payload." }, { status: 400 });
  }
  const { name, target, saved, targetDate } = parsed.data;
  const db = getDb();
  // Changing the price or the deadline changes the question, so the stored
  // verdict no longer answers it. A top-up doesn't — that's just progress.
  if (target !== undefined || targetDate !== undefined) db.setGoalAnalysis(Number(id), null);
  db.updateGoal(Number(id), {
    name,
    target: target === undefined ? undefined : toMinor(target),
    saved: saved === undefined ? undefined : toMinor(saved),
    target_date: targetDate,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  getDb().deleteGoal(Number(id));
  return NextResponse.json({ ok: true });
}
