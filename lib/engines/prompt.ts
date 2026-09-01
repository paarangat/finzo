import { CATEGORIES, SPEND_CATEGORIES } from "../categories";

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

/** Lets the fixture engine tell a goal question from a statement extraction. */
export const GOAL_PROMPT_MARKER = "FINZO_GOAL_ADVICE";

/**
 * Asks the engine one question: can they afford this thing, given their own
 * spending? Every number is handed over already computed — the model's job is
 * the judgement and the plain English, never the arithmetic.
 */
export function buildGoalPrompt(facts: unknown): string {
  return `${GOAL_PROMPT_MARKER}

Someone wants to buy something and needs a straight answer about whether they can afford it. Here are their real numbers, taken from their own bank statements and already worked out — use them as given, do not recalculate anything:

${JSON.stringify(facts, null, 2)}

Respond with ONLY a JSON object, no prose, no code fences, matching exactly this shape:
{
  "verdict": "yes" | "stretch" | "no",
  "headline": string,        // ONE sentence, under 100 characters, addressed to them as "you", that states the decision
  "reasons": [string],       // 1-3 short sentences explaining it with their actual numbers
  "cuts": [                  // 0-3 realistic monthly trims that would close the gap; empty when the verdict is "yes"
    { "category": string, "monthly": number, "note": string }
  ]
}

What each verdict means:
- "yes": the monthly amount fits inside what they already have left over each month.
- "stretch": it only works if they trim spending they can realistically trim.
- "no": it does not work at this income and spending without a bigger change.

Rules:
- Lead with the decision. "Yes — ..." / "It's a stretch — ..." / "Not right now — ...". No preamble, no hedging, no financial-advice disclaimers.
- Plain English a teenager would follow. No jargon, no percentages of percentages, no "consider allocating".
- Quote their real amounts in \`currency\` and their real category names. Never invent a number that is not in the data above.
- If \`months_of_expenses_left_if_bought_outright_today\` is a number under 3, say plainly that paying for it outright would leave them too thin, and how many months they'd have left. If it is null, the price is more than their whole balance — say that instead.
- If \`typical_monthly_left_over\` is null, they have not set a salary — say the answer depends on that and keep it short.
- "cuts" may only name categories they actually spend in, taken from \`typical_monthly_spend_by_category\`, and each "monthly" must be well under what they spend there. Use one of exactly these names: ${SPEND_CATEGORIES.join(", ")}.
- If \`typical_monthly_spend_is_averaged_over_these_months\` holds one month or is empty, that spending figure is a single month, not a habit — say so in one of the reasons, and note that a big one-off in that month would be skewing it.
- Be honest. If the answer is no, say no — do not soften it into a maybe.`;
}
