import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";
import { getDb, toMinor } from "@/lib/db";

const Body = z.object({
  category: z.enum(CATEGORIES).optional(),
  /** save a rule for this merchant and recategorize its past transactions too */
  remember: z.boolean().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  direction: z.enum(["debit", "credit"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transaction payload." }, { status: 400 });
  }
  const db = getDb();
  if (!db.transaction(Number(id))) {
    return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
  }
  const { category, remember, date, description, amount, direction } = parsed.data;
  if (date !== undefined || description !== undefined || amount !== undefined || direction !== undefined) {
    db.updateTransaction(Number(id), { date, description, direction, category, amount: amount === undefined ? undefined : toMinor(amount) });
  } else if (category) {
    db.setCategory(Number(id), category, remember ?? false);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  getDb().deleteTransaction(Number(id));
  return NextResponse.json({ ok: true });
}
