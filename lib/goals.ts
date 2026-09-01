import { formatMoneyWhole, formatMonth } from "./format";
import { spendBaseline } from "./rules";
import { GoalAdviceSchema, type GoalAdvice } from "./schema";
import type { Cashflow, GoalRow } from "./db";

/**
 * The arithmetic behind "something I have to buy": what it costs per month to
 * get there by a date, when you'd get there at your current rate, and whether
 * buying it today would eat the emergency fund.
 *
 * All local — no engine call. The numbers come from your salary, your last
 * three completed months of spending, and your balance.
 */

export type GoalStatus = "good" | "warn" | "bad";

// Here rather than in a component: both the /plan cards and the dashboard list
// paint the same status, and one of the two is a server component.
export const GOAL_FILL: Record<GoalStatus, string> = { good: "bg-accent", warn: "bg-amber-500", bad: "bg-red-500" };
export const GOAL_TEXT: Record<GoalStatus, string> = {
  good: "text-accent",
  warn: "text-amber-600 dark:text-amber-500",
  bad: "text-red-600 dark:text-red-400",
};

/** The engine's verdict, coloured like the local status it sits under. */
export const ADVICE_TEXT: Record<GoalAdvice["verdict"], string> = {
  yes: GOAL_TEXT.good,
  stretch: GOAL_TEXT.warn,
  no: GOAL_TEXT.bad,
};

export interface GoalPlan {
  goal: GoalRow;
  remaining: number; // minor units still to put aside
  progress: number; // 0..1 of the price already saved
  typicalSpend: number; // average monthly spend behind every number here, minor units
  spendMonths: string[]; // the completed months it averages — one month is not a habit, and the UI says so
  monthsLeft: number | null; // whole months to the target date; null when undated
  perMonth: number | null; // what you'd have to set aside each month; null when undated
  surplus: number | null; // salary − typical monthly spend; null without a salary
  status: GoalStatus;
  headline: string; // "₹12,500/mo", "March 2027", "Funded"
  sub: string; // what the headline is measured over
  verdict: string; // whether that fits what you actually save
  /** Buying it outright today, measured against the 3-month cushion rule. Absent without a balance or spending history. */
  buyNow: { status: GoalStatus; label: string } | null;
}

/** "2026-09" + 4 → "2027-01" */
const addMonths = (month: string, n: number): string => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Whole months from `month` to the target date's month. Negative when the date has passed. */
const monthsUntil = (targetDate: string, month: string): number => {
  const [ty, tm] = targetDate.split("-").map(Number);
  const [cy, cm] = month.split("-").map(Number);
  return (ty - cy) * 12 + (tm - cm);
};

const months = (n: number) => `${n >= 10 ? Math.round(n) : n.toFixed(1)} mo`;

export function planGoal(
  goal: GoalRow,
  opts: {
    balanceMinor: number | null;
    cashflows: Cashflow[];
    currentCalendarMonth: string; // "YYYY-MM"
    salaryMinor: number | null;
    currency: string;
  }
): GoalPlan {
  const { balanceMinor, cashflows, currentCalendarMonth, salaryMinor, currency } = opts;
  const money = (minor: number) => formatMoneyWhole(Math.round(minor), currency);

  const remaining = Math.max(goal.target - goal.saved, 0);
  const progress = goal.target > 0 ? Math.min(goal.saved / goal.target, 1) : 1;
  const { avg: avgSpend, months: spendMonths } = spendBaseline(cashflows, currentCalendarMonth, cashflows.at(-1)?.spent ?? 0);
  const surplus = salaryMinor === null || salaryMinor <= 0 ? null : salaryMinor - avgSpend;

  // What buying it outright today would do to the cushion. Same 3-month line the
  // emergency-fund rule uses, so the two never disagree.
  let buyNow: GoalPlan["buyNow"] = null;
  if (balanceMinor !== null && avgSpend > 0) {
    const after = balanceMinor - goal.target;
    if (after < 0) {
      buyNow = { status: "bad", label: `Costs more than your ${money(balanceMinor)} balance` };
    } else {
      const cushion = after / avgSpend;
      buyNow =
        cushion >= 3
          ? { status: "good", label: `Buy it now — still leaves ${months(cushion)} of expenses` }
          : cushion >= 1.5
            ? { status: "warn", label: `You could, but it drops your cushion to ${months(cushion)}` }
            : { status: "bad", label: `Not outright — that would leave ${months(cushion)} of expenses` };
    }
  }

  const base = { goal, remaining, progress, surplus, typicalSpend: avgSpend, spendMonths, buyNow };

  if (remaining === 0) {
    return {
      ...base,
      monthsLeft: goal.target_date ? Math.max(monthsUntil(goal.target_date, currentCalendarMonth), 0) : null,
      perMonth: 0,
      status: "good",
      headline: "Funded",
      sub: `${money(goal.target)} put aside`,
      verdict: "Saved up — go get it.",
    };
  }

  if (goal.target_date) {
    // A date in the past (or this month) means it's due now, not overdue by a
    // negative number of months — the whole remainder lands in this month.
    const monthsLeft = Math.max(monthsUntil(goal.target_date, currentCalendarMonth), 0);
    const perMonth = monthsLeft === 0 ? remaining : Math.ceil(remaining / monthsLeft);
    const sub =
      monthsLeft === 0 ? `due this month · ${money(remaining)} to go` : `for ${monthsLeft} months · ${money(remaining)} to go`;
    if (surplus === null) {
      return { ...base, monthsLeft, perMonth, status: "warn", headline: `${money(perMonth)}/mo`, sub, verdict: "Set your take-home salary to see whether that fits." };
    }
    const status: GoalStatus = surplus <= 0 || perMonth > surplus * 1.5 ? "bad" : perMonth > surplus ? "warn" : "good";
    const verdict =
      surplus <= 0
        ? "You spend about everything you earn, so there's nothing to put aside yet."
        : status === "good"
          ? `Comfortable — you usually save ${money(surplus)} a month, ${money(surplus - perMonth)} to spare`
          : status === "warn"
            ? `Tight — you'd have to find ${money(perMonth - surplus)} a month on top of what you save`
            : `Not at this rate — you save about ${money(surplus)} a month`;
    return { ...base, monthsLeft, perMonth, status, headline: `${money(perMonth)}/mo`, sub, verdict };
  }

  // Undated: the question is when, not how much.
  if (surplus === null) {
    return { ...base, monthsLeft: null, perMonth: null, status: "warn", headline: `${money(remaining)} to go`, sub: "no date set", verdict: "Set your take-home salary to see when you'd get there." };
  }
  if (surplus <= 0) {
    return {
      ...base,
      monthsLeft: null,
      perMonth: null,
      status: "bad",
      headline: `${money(remaining)} to go`,
      sub: "no date set",
      verdict: "You spend about everything you earn — this needs a spending change before a date.",
    };
  }
  const need = Math.ceil(remaining / surplus);
  return {
    ...base,
    monthsLeft: need,
    perMonth: null,
    status: need <= 12 ? "good" : need <= 24 ? "warn" : "bad",
    headline: formatMonth(addMonths(currentCalendarMonth, need)),
    sub: `${need} ${need === 1 ? "month" : "months"} · ${money(remaining)} to go`,
    verdict: `At the ${money(surplus)} a month you usually have left over.`,
  };
}

/** Major units, 2dp — what the engine reads. Minor units would invite a 100× mistake in prose. */
const major = (minor: number) => Math.round(minor) / 100;

/**
 * The whole world the engine gets to reason about: aggregates and the answers
 * already computed here. No transaction rows, no merchant descriptions beyond
 * the recurring charges — and no arithmetic left for the model to get wrong.
 */
export function goalFacts(
  plan: GoalPlan,
  extra: {
    currency: string;
    salaryMinor: number | null;
    balanceMinor: number | null;
    byCategory: { category: string; avg: number }[];
    recurring: { merchant: string; amount: number; cadence: string }[];
  }
) {
  const { goal, typicalSpend } = plan;
  const { currency, salaryMinor, balanceMinor, byCategory, recurring } = extra;
  const cushion = (minor: number) => (typicalSpend > 0 ? Math.round((minor / typicalSpend) * 10) / 10 : null);
  return {
    currency,
    goal: {
      what_they_want: goal.name,
      price: major(goal.target),
      already_saved: major(goal.saved),
      still_needed: major(plan.remaining),
      want_it_by: goal.target_date,
      months_until_they_want_it: plan.monthsLeft,
      needed_per_month: plan.perMonth === null ? null : major(plan.perMonth),
    },
    monthly_take_home: salaryMinor === null ? null : major(salaryMinor),
    typical_monthly_spend: major(typicalSpend),
    typical_monthly_spend_is_averaged_over_these_months: plan.spendMonths,
    typical_monthly_left_over: plan.surplus === null ? null : major(plan.surplus),
    balance_now: balanceMinor === null ? null : major(balanceMinor),
    months_of_expenses_the_balance_covers: balanceMinor === null ? null : cushion(balanceMinor),
    // null, not a negative number of months: asked to report "how many months
    // you'd have left" from -34, a model writes nonsense. Can't afford it outright
    // is its own case, and the prompt handles a null.
    months_of_expenses_left_if_bought_outright_today:
      balanceMinor === null || balanceMinor - goal.target < 0 ? null : cushion(balanceMinor - goal.target),
    typical_monthly_spend_by_category: Object.fromEntries(byCategory.map((c) => [c.category, major(c.avg)])),
    recurring_charges: recurring.map((r) => ({ merchant: r.merchant, amount: major(r.amount), every: r.cadence })),
  };
}

export type GoalFacts = ReturnType<typeof goalFacts>;

/** The stored verdict, or null when there is none or it no longer parses. */
export function storedAdvice(goal: GoalRow): GoalAdvice | null {
  if (!goal.analysis) return null;
  try {
    const parsed = GoalAdviceSchema.safeParse(JSON.parse(goal.analysis));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // a half-written or hand-edited row loses its card, not the page
  }
}
