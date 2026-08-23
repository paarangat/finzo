import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, toMinor } from "@/lib/db";

const Body = z.object({
  engine: z.enum(["claude", "codex", "fixture"]).optional(),
  manualBalance: z.number().optional(),
  account: z.union([z.literal("all"), z.number().int()]).optional(),
});

export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
  }
  const db = getDb();
  if (parsed.data.engine) db.setSetting("engine", parsed.data.engine);
  if (parsed.data.manualBalance !== undefined) db.setManualBalance(toMinor(parsed.data.manualBalance));
  if (parsed.data.account !== undefined) db.setSetting("account", String(parsed.data.account));
  return NextResponse.json({ ok: true });
}
