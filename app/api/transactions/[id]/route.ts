import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";
import { getDb } from "@/lib/db";

const Body = z.object({ category: z.enum(CATEGORIES) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }
  getDb().setCategory(Number(id), parsed.data.category);
  return NextResponse.json({ ok: true });
}
