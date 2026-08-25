import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, toMinor } from "@/lib/db";
import { INVESTMENT_KINDS } from "@/lib/investments";

const KINDS = Object.keys(INVESTMENT_KINDS) as [string, ...string[]];

const Body = z.object({
  name: z.string().min(1).max(120).optional(),
  kind: z.enum(KINDS).optional(),
  value: z.number().positive().optional(),
  invested: z.number().positive().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid investment payload." }, { status: 400 });
  }
  const { name, kind, value, invested } = parsed.data;
  getDb().updateInvestment(Number(id), {
    name,
    kind,
    value: value === undefined ? undefined : toMinor(value),
    invested: invested === undefined ? undefined : invested === null ? null : toMinor(invested),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  getDb().deleteInvestment(Number(id));
  return NextResponse.json({ ok: true });
}
