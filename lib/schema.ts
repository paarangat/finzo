import { z } from "zod";
import { CATEGORIES } from "./categories";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const TransactionSchema = z.object({
  date: isoDate,
  description: z.string().min(1),
  amount: z.number().positive(),
  direction: z.enum(["debit", "credit"]),
  category: z.enum(CATEGORIES),
});

export const ExtractionSchema = z.object({
  bank_name: z.string().nullable(),
  currency: z.string().length(3),
  period_start: isoDate,
  period_end: isoDate,
  closing_balance: z.number().nullable(),
  transactions: z.array(TransactionSchema).min(1),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type ExtractedTransaction = z.infer<typeof TransactionSchema>;

/** Pull a JSON object out of model output that may include prose or code fences. */
export function parseModelJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error(`No JSON object found in engine output: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

export function validateExtraction(data: unknown): Extraction {
  const result = ExtractionSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Extraction failed validation: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  return result.data;
}
