import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, normalizeDesc } from "@/lib/db";

const Body = z.object({
  merchant: z.string().min(1), // raw description or already-normalized matcher
  /** 'exclude' = not a bill, 'include' = force as a bill, null = back to auto-detection */
  mode: z.enum(["exclude", "include"]).nullable(),
  cadence: z.enum(["weekly", "monthly", "yearly"]).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  const { merchant, mode, cadence } = parsed.data;
  const matcher = normalizeDesc(merchant);
  if (!matcher) {
    return NextResponse.json({ error: "Invalid merchant name." }, { status: 400 });
  }
  const db = getDb();
  if (mode === "include" && !db.hasMerchant(matcher)) {
    return NextResponse.json({ error: "No transactions from that merchant yet — the name must match one in your history." }, { status: 400 });
  }
  db.setRecurringOverride(matcher, mode, cadence);
  return NextResponse.json({ ok: true });
}
