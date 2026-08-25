import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, toMinor } from "@/lib/db";
import { INVESTMENT_KINDS } from "@/lib/investments";

const KINDS = Object.keys(INVESTMENT_KINDS) as [string, ...string[]];

const Body = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(KINDS),
  value: z.number().positive(), // current value, major units
  invested: z.number().positive().nullable().optional(), // cost basis, major units
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid investment payload." }, { status: 400 });
  }
  const { name, kind, value, invested } = parsed.data;
  const id = getDb().addInvestment({ name, kind, value: toMinor(value), invested: invested == null ? null : toMinor(invested) });
  return NextResponse.json({ ok: true, id });
}
