import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";
import { getDb, toMinor } from "@/lib/db";

const Body = z.object({
  parts: z.array(z.object({ amount: z.number().positive(), category: z.enum(CATEGORIES) })).min(2),
});

/** Split one transaction into parts (each with its own category) that sum to the original amount. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid split payload." }, { status: 400 });
  }
  try {
    getDb().splitTransaction(
      Number(id),
      parsed.data.parts.map((p) => ({ amount: toMinor(p.amount), category: p.category }))
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Split failed." }, { status: 400 });
  }
}
