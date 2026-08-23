import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const csvField = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** Everything, yours to take: ?format=csv for transactions, ?format=json for the full dataset. */
export async function GET(req: Request) {
  const db = getDb();
  const rows = db.exportRows();
  const format = new URL(req.url).searchParams.get("format") ?? "csv";
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    const body = {
      exportedAt: new Date().toISOString(),
      currency: db.currency(),
      accounts: db.accounts(),
      budgets: db.raw.prepare("SELECT category, amount FROM budgets ORDER BY category").all(),
      rules: [...db.rules().entries()].map(([matcher, category]) => ({ matcher, category })),
      transactions: rows,
    };
    return NextResponse.json(body, {
      headers: { "Content-Disposition": `attachment; filename="finzo-export-${stamp}.json"` },
    });
  }

  const currency = db.currency();
  const header = "date,description,amount,currency,direction,category,account,statement";
  const lines = rows.map((r) =>
    [r.date, csvField(r.description), (r.amount / 100).toFixed(2), currency, r.direction, csvField(r.category), csvField(r.account), csvField(r.statement)].join(",")
  );
  return new NextResponse([header, ...lines].join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finzo-transactions-${stamp}.csv"`,
    },
  });
}
