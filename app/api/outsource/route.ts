import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, toMinor } from "@/lib/db";

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  cost: z.number().positive(), // what it costs each time, major units
  hours: z.number().positive().max(744), // hours it frees each time; 744 is a whole month
  cadence: z.enum(["once", "weekly", "monthly"]),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid outsourcing payload." }, { status: 400 });
  }
  const { name, cost, hours, cadence } = parsed.data;
  const id = getDb().addOutsource({ name, cost: toMinor(cost), hours, cadence });
  return NextResponse.json({ ok: true, id });
}
