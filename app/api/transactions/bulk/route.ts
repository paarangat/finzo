import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";
import { getDb } from "@/lib/db";

const Body = z.object({
  ids: z.array(z.number().int()).min(1).max(1000),
  category: z.enum(CATEGORIES),
});

/** Recategorize many transactions in one shot (bulk action in the table). */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  getDb().setCategoryBulk(parsed.data.ids, parsed.data.category);
  return NextResponse.json({ ok: true });
}
