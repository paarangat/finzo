import { formatMoneyWhole } from "./format";
import { OutsourceAdviceSchema, type OutsourceAdvice } from "./schema";
import { GOAL_TEXT, type GoalStatus } from "./goals";
import type { OutsourceRow } from "./db";

/**
 * What an hour of your time is worth, and whether paying someone else to do a
 * chore buys that hour back for less. Same shape as the goal planner: every
 * number is worked out here, locally; the engine only gets to phrase the read.
 */

/** Hours a week assumed until you say otherwise — a standard full-time week. */
export const DEFAULT_WORK_HOURS = 40;

/** 52 weeks over 12 months, not 4: a "4 weeks a month" shortcut drops a whole month's hours a year. */
export const WEEKS_PER_MONTH = 52 / 12;

export const monthlyHours = (hoursPerWeek: number) => hoursPerWeek * WEEKS_PER_MONTH;

/** Take-home per hour worked, in minor units. null when there's no salary or no hours to divide by. */
export function hourlyRate(salaryMinor: number | null, hoursPerWeek: number): number | null {
  if (salaryMinor === null || salaryMinor <= 0 || hoursPerWeek <= 0) return null;
  return salaryMinor / monthlyHours(hoursPerWeek);
}

/** How many times a month a task at this cadence happens; a one-off is counted once. */
export const timesPerMonth = (cadence: OutsourceRow["cadence"]) => (cadence === "weekly" ? WEEKS_PER_MONTH : 1);

/** The engine's verdict, coloured like the local status it sits under. */
export const OUTSOURCE_ADVICE_TEXT: Record<OutsourceAdvice["verdict"], string> = {
  yes: GOAL_TEXT.good,
  depends: GOAL_TEXT.warn,
  no: GOAL_TEXT.bad,
};

export interface OutsourcePlan {
  task: OutsourceRow;
  rate: number | null; // your take-home per hour, minor units; null without a salary
  costPerHour: number; // what each hour bought back costs, minor units
  maxWorth: number | null; // the most it's worth paying per go — hours × rate; null without a salary
  monthlyCost: number; // minor units; a one-off counts once
  monthlyHours: number; // hours back per month; a one-off counts once
  netGain: number | null; // per month, if you filled the freed hours with paid work: (rate − costPerHour) × hours
  surplusShare: number | null; // monthlyCost as a share of what you have left over each month; null without a salary or spend history
  status: GoalStatus;
  headline: string; // "₹250/hr"
  sub: string; // "vs your ₹600/hr · 3 hrs back a week"
  verdict: string; // the decision, in one line
  note: string | null; // the work-or-rest framing under it
}

export const formatHours = (h: number) => {
  const n = Number.isInteger(h) ? String(h) : h.toFixed(1).replace(/\.0$/, "");
  return `${n} ${h === 1 ? "hr" : "hrs"}`;
};

const CADENCE_LABEL: Record<OutsourceRow["cadence"], string> = { once: "one-off", weekly: "a week", monthly: "a month" };

export function planOutsource(
  task: OutsourceRow,
  opts: {
    salaryMinor: number | null;
    hoursPerWeek: number;
    typicalSpend: number; // minor units, the same three-month average the goals use
    currency: string;
  }
): OutsourcePlan {
  const { salaryMinor, hoursPerWeek, typicalSpend, currency } = opts;
  const money = (minor: number) => formatMoneyWhole(Math.round(minor), currency);

  const rate = hourlyRate(salaryMinor, hoursPerWeek);
  const costPerHour = task.cost / task.hours;
  const times = timesPerMonth(task.cadence);
  const monthlyCost = task.cost * times;
  const hoursBack = task.hours * times;
  const perLabel = task.cadence === "once" ? "" : ` ${CADENCE_LABEL[task.cadence]}`;
  const base = { task, rate, costPerHour, monthlyCost, monthlyHours: hoursBack, headline: `${money(costPerHour)}/hr` };

  if (rate === null) {
    return {
      ...base,
      maxWorth: null,
      netGain: null,
      surplusShare: null,
      status: "warn",
      sub: `${formatHours(task.hours)} back${perLabel}`,
      verdict: "Set your take-home salary to see what your hour is worth.",
      note: null,
    };
  }

  const maxWorth = task.hours * rate;
  const netGain = (rate - costPerHour) * hoursBack;
  const sub = `vs your ${money(rate)}/hr · ${formatHours(task.hours)} back${perLabel}`;

  // Is the hour cheap? Within 20% either side is a coin toss, not a verdict.
  const ratio = costPerHour / rate;
  const value: GoalStatus = ratio <= 0.8 ? "good" : ratio <= 1.2 ? "warn" : "bad";

  // Can you carry it? A one-off is measured against one month's leftover; a
  // recurring cost against the leftover it eats every month. A quarter of what
  // you save is an easy yes, past three-fifths it crowds out everything else.
  const surplus = salaryMinor! - typicalSpend;
  const surplusShare = surplus > 0 ? monthlyCost / surplus : null;
  const afford: GoalStatus =
    surplus <= 0
      ? "bad"
      : task.cadence === "once"
        ? surplusShare! <= 0.5
          ? "good"
          : surplusShare! <= 1.5
            ? "warn"
            : "bad"
        : surplusShare! <= 0.25
          ? "good"
          : surplusShare! <= 0.6
            ? "warn"
            : "bad";

  const rank: Record<GoalStatus, number> = { good: 0, warn: 1, bad: 2 };
  const status: GoalStatus = rank[afford] > rank[value] ? afford : value;
  const hoursWord = formatHours(hoursBack);
  const period = task.cadence === "once" ? "" : " a month";

  let verdict: string;
  let note: string | null = null;
  if (value === "bad") {
    verdict = `Not worth it — you'd pay ${money(costPerHour)} for an hour that earns you ${money(rate)}.`;
    note = `Worth paying up to ${money(maxWorth)}${task.cadence === "once" ? "" : ` ${CADENCE_LABEL[task.cadence]}`} for this, not ${money(task.cost)}.`;
  } else if (afford === "bad") {
    verdict =
      surplus <= 0
        ? `Cheaper than your hour, but you spend about everything you earn — there's nothing left over to pay for it.`
        : `Cheaper than your hour, but ${money(monthlyCost)}${period} is more than the ${money(surplus)} you have left over.`;
  } else if (value === "warn") {
    verdict = `About even — ${money(costPerHour)} an hour back against ${money(rate)} an hour earned. Only worth it if you'd really use the time.`;
  } else if (afford === "warn") {
    verdict = `Worth it on paper — each hour back costs ${money(costPerHour)} — but ${money(monthlyCost)}${period} is ${Math.round(surplusShare! * 100)}% of what you save. That's the squeeze.`;
  } else {
    verdict = `Worth it — each hour back costs ${money(costPerHour)}, and an hour of your work earns ${money(rate)}.`;
  }
  if (value !== "bad") {
    note =
      status === "good"
        ? `Fill those ${hoursWord}${period} with paid work and you come out ${money(netGain)}${period} ahead — or rest, at ${money(costPerHour)} an hour.`
        : `Fill those ${hoursWord}${period} with paid work and it pays for itself; as rest, it costs ${money(costPerHour)} an hour.`;
  }

  return { ...base, maxWorth, netGain, surplusShare, status, sub, verdict, note };
}

/** Major units, 2dp — what the engine reads. Minor units would invite a 100× mistake in prose. */
const major = (minor: number) => Math.round(minor) / 100;

/**
 * Everything the engine gets: the task, your rate, and the answers already
 * worked out. No transactions, no merchants — and no arithmetic left to do.
 */
export function outsourceFacts(
  plan: OutsourcePlan,
  extra: { currency: string; salaryMinor: number | null; hoursPerWeek: number; typicalSpend: number; spendMonths: string[] }
) {
  const { task } = plan;
  const { currency, salaryMinor, hoursPerWeek, typicalSpend, spendMonths } = extra;
  const surplus = salaryMinor === null ? null : salaryMinor - typicalSpend;
  return {
    currency,
    task: {
      what_they_want_to_hand_off: task.name,
      cost_each_time: major(task.cost),
      how_often: task.cadence,
      hours_it_frees_each_time: task.hours,
      cost_per_hour_freed: major(plan.costPerHour),
      most_worth_paying_each_time: plan.maxWorth === null ? null : major(plan.maxWorth),
      monthly_cost: major(plan.monthlyCost),
      monthly_hours_freed: Math.round(plan.monthlyHours * 10) / 10,
      monthly_gain_if_freed_hours_go_to_paid_work: plan.netGain === null ? null : major(plan.netGain),
    },
    monthly_take_home: salaryMinor === null ? null : major(salaryMinor),
    hours_worked_per_week: hoursPerWeek,
    take_home_per_hour: plan.rate === null ? null : major(plan.rate),
    typical_monthly_spend: major(typicalSpend),
    typical_monthly_spend_is_averaged_over_these_months: spendMonths,
    typical_monthly_left_over: surplus === null ? null : major(surplus),
    monthly_cost_as_share_of_left_over: plan.surplusShare === null ? null : Math.round(plan.surplusShare * 100) / 100,
  };
}

export type OutsourceFacts = ReturnType<typeof outsourceFacts>;

/** The stored verdict, or null when there is none or it no longer parses. */
export function storedOutsourceAdvice(task: OutsourceRow): OutsourceAdvice | null {
  if (!task.analysis) return null;
  try {
    const parsed = OutsourceAdviceSchema.safeParse(JSON.parse(task.analysis));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // a torn row loses its card, not the page
  }
}
