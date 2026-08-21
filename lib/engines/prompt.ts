import { CATEGORIES } from "../categories";

export function buildExtractionPrompt(filePath: string, feedback?: string): string {
  return `Read the bank statement file at ${filePath} and extract every transaction.

Respond with ONLY a JSON object, no prose, no code fences, matching exactly this shape:
{
  "bank_name": string | null,
  "currency": string,            // ISO 4217 code, e.g. "USD", "EUR", "INR"
  "period_start": "YYYY-MM-DD",  // first date the statement covers
  "period_end": "YYYY-MM-DD",    // last date the statement covers
  "closing_balance": number | null,  // closing/available balance if stated, else null
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": string,     // cleaned-up merchant/counterparty description
      "amount": number,          // positive decimal in the statement currency
      "direction": "debit" | "credit",
      "category": string         // exactly one of the categories below
    }
  ]
}

Categories (use "Income" for salary and incoming credits, "Transfers" for moves between own accounts, "Other" only when nothing fits):
${CATEGORIES.map((c) => `- ${c}`).join("\n")}

Rules:
- Include every transaction row; do not summarize or skip small ones.
- Amounts are always positive; direction encodes debit vs credit.
- Do not invent transactions or balances not present in the file.${feedback ? `\n\nYour previous attempt failed with: ${feedback}\nFix that and respond again with only the JSON object.` : ""}`;
}
