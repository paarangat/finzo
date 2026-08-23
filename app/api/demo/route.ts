import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { FIXTURE_EXTRACTION } from "@/lib/engines/fixture";
import type { Extraction } from "@/lib/schema";

const lastDay = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return String(new Date(y, m, 0).getDate()).padStart(2, "0");
};

/** The fixture statement re-dated into `month`, amounts scaled so month-over-month deltas show. */
function shiftTo(month: string, factor: number, closing: number): Extraction {
  const maxDay = lastDay(month);
  return {
    ...FIXTURE_EXTRACTION,
    period_start: `${month}-01`,
    period_end: `${month}-${maxDay}`,
    closing_balance: closing,
    transactions: FIXTURE_EXTRACTION.transactions.map((t) => {
      const day = t.date.slice(8) > maxDay ? maxDay : t.date.slice(8);
      return { ...t, date: `${month}-${day}`, amount: Math.round(t.amount * factor * 100) / 100 };
    }),
  };
}

/** Load three months of demo data so every dashboard feature has something to show. */
export async function POST() {
  const db = getDb();
  const now = new Date();
  const months = [2, 1, 0].map((back) => {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const factors = [0.93, 1.06, 1];
  const closings = [3400.1, 3901.77, 4187.42];
  if (!db.getSetting("demo")) {
    months.forEach((month, i) => {
      const hash = `demo-${month}`;
      if (!db.hasStatement(hash)) db.insertStatement(shiftTo(month, factors[i], closings[i]), "demo-statement.pdf", hash);
    });
    db.setSetting("demo", "1");
  }
  return NextResponse.json({ ok: true, month: months[2] });
}

export async function DELETE() {
  getDb().clearDemo();
  return NextResponse.json({ ok: true });
}
