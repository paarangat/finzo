import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  getDb().deleteOutsource(Number(id));
  return NextResponse.json({ ok: true });
}
