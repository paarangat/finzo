import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";
import { getDb, toMinor } from "@/lib/db";

const Body = z.object({
  accountId: z.number().int().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  amount: z.number().positive(),
  direction: z.enum(["debit", "credit"]),
  category: z.enum(CATEGORIES),
});

/** Manually add a transaction (cash spending, missing entries). */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transaction payload." }, { status: 400 });
  }
  const db = getDb();
  const { accountId, date, description, amount, direction, category } = parsed.data;
  const account = accountId ?? db.accounts()[0]?.id ?? db.findOrCreateAccount("Cash", "cash");
  if (accountId !== undefined && !db.accounts().some((a) => a.id === accountId)) {
    return NextResponse.json({ error: "Unknown account." }, { status: 400 });
  }
  const id = db.addTransaction({ accountId: account, date, description, amount: toMinor(amount), direction, category });
  return NextResponse.json({ ok: true, id });
}
