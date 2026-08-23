import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORIES, NON_SPEND_CATEGORIES } from "@/lib/categories";
import { getDb, toMinor } from "@/lib/db";

const Body = z.object({
  category: z.enum(CATEGORIES).refine((c) => !NON_SPEND_CATEGORIES.includes(c), "Category cannot be budgeted."),
  amount: z.number().positive().nullable(),
});

export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid budget payload." }, { status: 400 });
  }
  const { category, amount } = parsed.data;
  getDb().setBudget(category, amount === null ? null : toMinor(amount));
  return NextResponse.json({ ok: true });
}
