import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, toMinor } from "@/lib/db";

const Body = z.object({
  engine: z.enum(["claude", "codex", "fixture"]).optional(),
  manualBalance: z.number().optional(),
  account: z.union([z.literal("all"), z.number().int()]).optional(),
  /** monthly take-home salary in major units; null clears it */
  salary: z.number().positive().nullable().optional(),
  /** display currency (ISO 4217); formats numbers, never converts them */
  currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
  /** age in years for the 100-minus-age equity split; null clears it */
  age: z.number().int().min(10).max(100).nullable().optional(),
  /** what to call you in the dashboard greeting; stays on this machine */
  name: z.string().trim().min(1).max(60).optional(),
});

export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
  }
  const db = getDb();
  if (parsed.data.engine) db.setSetting("engine", parsed.data.engine);
  if (parsed.data.manualBalance !== undefined) db.setManualBalance(toMinor(parsed.data.manualBalance));
  if (parsed.data.account !== undefined) db.setSetting("account", String(parsed.data.account));
  if (parsed.data.salary !== undefined) db.setSalary(parsed.data.salary === null ? null : toMinor(parsed.data.salary));
  if (parsed.data.currency !== undefined) db.setSetting("currency", parsed.data.currency.toUpperCase());
  if (parsed.data.age !== undefined) db.setAge(parsed.data.age);
  if (parsed.data.name) db.setSetting("name", parsed.data.name);
  return NextResponse.json({ ok: true });
}
