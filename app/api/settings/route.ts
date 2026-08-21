import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, toMinor } from "@/lib/db";

const Body = z.object({
  engine: z.enum(["claude", "codex", "fixture"]).optional(),
  manualBalance: z.number().optional(),
});

export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
  }
  const db = getDb();
  if (parsed.data.engine) db.setSetting("engine", parsed.data.engine);
  if (parsed.data.manualBalance !== undefined) db.setManualBalance(toMinor(parsed.data.manualBalance));
  return NextResponse.json({ ok: true });
}
