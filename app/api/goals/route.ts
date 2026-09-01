import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, toMinor } from "@/lib/db";

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  target: z.number().positive(), // price, major units
  saved: z.number().min(0).optional(), // already put aside, major units
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid goal payload." }, { status: 400 });
  }
  const { name, target, saved, targetDate } = parsed.data;
  const id = getDb().addGoal({ name, target: toMinor(target), saved: saved === undefined ? 0 : toMinor(saved), target_date: targetDate ?? null });
  return NextResponse.json({ ok: true, id });
}
