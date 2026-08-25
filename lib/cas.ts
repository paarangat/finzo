import { z } from "zod";

/**
 * Consolidated Account Statement (CAS) extraction — CAMS/KFintech (mutual
 * funds) and NSDL/CDSL (demat + NPS) statements every Indian investor can
 * generate. One upload replaces manual holding entry.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const CAS_KINDS = ["mf_equity", "mf_debt", "stocks", "gold", "nps"] as const;

export const CasHoldingSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(CAS_KINDS),
  units: z.number().positive().nullable(),
  value: z.number().positive(), // current valuation, major units
  invested: z.number().positive().nullable(), // cost value when the statement shows it
  isin: z.string().nullable(),
});

export const CasSchema = z.object({
  statement_date: isoDate.nullable(),
  holdings: z.array(CasHoldingSchema).min(1),
});

export type CasExtraction = z.infer<typeof CasSchema>;
export type CasHolding = z.infer<typeof CasHoldingSchema>;

export function validateCas(data: unknown): CasExtraction {
  const result = CasSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`CAS failed validation: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  return result.data;
}

export function buildCasPrompt(filePath: string, feedback?: string): string {
  return `Read the investment statement file at ${filePath}. It is an Indian Consolidated Account Statement (CAS) from CAMS, KFintech, NSDL or CDSL — or a similar portfolio/holdings statement. Extract every current holding.

Respond with ONLY a JSON object, no prose, no code fences, matching exactly this shape:
{
  "statement_date": "YYYY-MM-DD" | null,  // the "as of" / statement date
  "holdings": [
    {
      "name": string,          // full scheme/security name, e.g. "Parag Parikh Flexi Cap Fund - Direct Plan - Growth"
      "kind": "mf_equity" | "mf_debt" | "stocks" | "gold" | "nps",
      "units": number | null,  // units/shares held; null if not stated
      "value": number,         // current valuation in the statement currency, positive decimal
      "invested": number | null, // cost value / amount invested if the statement shows it, else null
      "isin": string | null
    }
  ]
}

Classification:
- Equity, flexi cap, ELSS, index and hybrid-aggressive mutual funds -> "mf_equity"
- Debt, liquid, gilt, money-market and hybrid-conservative funds -> "mf_debt"
- Listed shares in a demat section -> "stocks"
- Sovereign Gold Bonds or gold ETFs/funds -> "gold"
- NPS tiers -> "nps"

Rules:
- One entry per scheme/folio line with a non-zero current value; skip closed/zero-balance folios.
- Sum multiple folios of the same scheme into one entry (units and values added).
- Do not invent holdings or values not present in the file.${feedback ? `\n\nYour previous attempt failed with: ${feedback}\nFix that and respond again with only the JSON object.` : ""}`;
}

// Mock CAS for tests and the fixture engine (demo mode).
export const FIXTURE_CAS: CasExtraction = {
  statement_date: "2026-08-24",
  holdings: [
    { name: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth", kind: "mf_equity", units: 1520.404, value: 138351.09, invested: 110000, isin: "INF879O01027" },
    { name: "HDFC Liquid Fund - Direct Plan - Growth", kind: "mf_debt", units: 10.513, value: 52204.9, invested: 50000, isin: "INF179K01UT0" },
    { name: "Tata Motors Ltd", kind: "stocks", units: 40, value: 28000, invested: 21500, isin: "INE155A01022" },
  ],
};
