import { describe, expect, it } from "vitest";
import { goalFacts, planGoal, storedAdvice } from "../lib/goals";
import { buildGoalPrompt, GOAL_PROMPT_MARKER } from "../lib/engines/prompt";
import { fixtureEngine } from "../lib/engines/fixture";
import { parseModelJson, validateGoalAdvice } from "../lib/schema";
import type { Cashflow, GoalRow } from "../lib/db";

const goal = (over: Partial<GoalRow> = {}): GoalRow => ({
  id: 1,
  name: "Laptop",
  target: 100_000, // ₹1,000 in minor units
  saved: 0,
  target_date: null,
  created_at: "2026-08-01",
  analysis: null,
  analysis_at: null,
  ...over,
});

// Typical spend is 50k/month; the partial current month is deliberately tiny.
const cashflows: Cashflow[] = [
  { month: "2026-05", income: 0, spent: 40_000 },
  { month: "2026-06", income: 0, spent: 50_000 },
  { month: "2026-07", income: 0, spent: 60_000 },
  { month: "2026-08", income: 0, spent: 3_000 },
];

const plan = (g: GoalRow, over: Partial<Parameters<typeof planGoal>[1]> = {}) =>
  planGoal(g, {
    balanceMinor: 300_000,
    cashflows,
    currentCalendarMonth: "2026-08",
    salaryMinor: 80_000,
    currency: "USD",
    ...over,
  });

describe("planGoal — saving to a date", () => {
  it("splits what's left over the months remaining", () => {
    const p = plan(goal({ target: 120_000, saved: 20_000, target_date: "2026-12-25" }));
    expect(p.monthsLeft).toBe(4); // Aug → Dec
    expect(p.remaining).toBe(100_000);
    expect(p.perMonth).toBe(25_000);
    expect(p.headline).toBe("$250/mo");
    expect(p.sub).toBe("for 4 months · $1,000 to go");
    expect(p.progress).toBeCloseTo(1 / 6);
  });

  it("names the months behind the spending figure, so one month is never called typical", () => {
    expect(plan(goal()).spendMonths).toEqual(["2026-05", "2026-06", "2026-07"]);
    // One statement loaded: the "average" is that month alone, and callers must be able to tell.
    const single = plan(goal(), { cashflows: [{ month: "2026-07", income: 0, spent: 274_247 }] });
    expect(single.spendMonths).toEqual(["2026-07"]);
    expect(single.typicalSpend).toBe(274_247);
  });

  it("ignores the partial current month when working out what you save", () => {
    // Surplus is 80k − avg(40k, 50k, 60k) = 30k. Using August's 3k spend would
    // have claimed a 77k surplus and graded an unaffordable goal "comfortable".
    const p = plan(goal({ target: 160_000, target_date: "2026-12-01" }));
    expect(p.surplus).toBe(30_000);
    expect(p.perMonth).toBe(40_000); // 160k over 4 months
    expect(p.status).toBe("warn"); // over the 30k surplus, but under 1.5×
    expect(p.verdict).toContain("find $100 a month");
  });

  it("grades a goal the surplus covers as comfortable", () => {
    const p = plan(goal({ target: 100_000, target_date: "2027-08-01" })); // 12 months → 8,334/mo
    expect(p.status).toBe("good");
    expect(p.verdict).toContain("to spare");
  });

  it("calls it out when the monthly ask is far past what you save", () => {
    const p = plan(goal({ target: 500_000, target_date: "2026-10-01" }));
    expect(p.status).toBe("bad");
    expect(p.verdict).toBe("Not at this rate — you save about $300 a month");
  });

  it("treats a date in the past as due this month rather than dividing by zero", () => {
    for (const date of ["2026-08-30", "2026-02-01"]) {
      const p = plan(goal({ target: 100_000, saved: 40_000, target_date: date }));
      expect(p.monthsLeft).toBe(0);
      expect(p.perMonth).toBe(60_000); // the whole remainder, not Infinity
      expect(p.headline).toBe("$600/mo");
      expect(p.sub).toBe("due this month · $600 to go");
    }
  });
});

describe("planGoal — no date", () => {
  it("answers when instead of how much", () => {
    const p = plan(goal({ target: 90_000 })); // 90k at a 30k surplus → 3 months
    expect(p.perMonth).toBeNull();
    expect(p.monthsLeft).toBe(3);
    expect(p.headline).toBe("November 2026");
    expect(p.sub).toBe("3 months · $900 to go");
    expect(p.status).toBe("good");
  });

  it("warns past a year and fails past two", () => {
    expect(plan(goal({ target: 500_000 })).status).toBe("warn"); // 17 months
    expect(plan(goal({ target: 900_000 })).status).toBe("bad"); // 30 months
  });

  it("says so when there is no surplus to save from", () => {
    const p = plan(goal({ target: 90_000 }), { salaryMinor: 45_000 });
    expect(p.surplus).toBe(-5_000);
    expect(p.status).toBe("bad");
    expect(p.verdict).toContain("spend about everything you earn");
  });
});

describe("planGoal — edges", () => {
  it("reports a fully saved goal as funded, never a negative remainder", () => {
    const p = plan(goal({ target: 100_000, saved: 120_000, target_date: "2026-12-01" }));
    expect(p.remaining).toBe(0);
    expect(p.progress).toBe(1);
    expect(p.status).toBe("good");
    expect(p.headline).toBe("Funded");
  });

  it("still plans without a salary, but asks for one before grading", () => {
    const dated = plan(goal({ target: 100_000, target_date: "2026-12-01" }), { salaryMinor: null });
    expect(dated.surplus).toBeNull();
    expect(dated.perMonth).toBe(25_000); // the arithmetic needs no salary
    expect(dated.verdict).toContain("take-home salary");

    const undated = plan(goal({ target: 100_000 }), { salaryMinor: null });
    expect(undated.monthsLeft).toBeNull();
    expect(undated.headline).toBe("$1,000 to go");
  });
});

describe("planGoal — buy it now?", () => {
  const buy = (target: number, balanceMinor: number | null = 300_000) =>
    plan(goal({ target }), { balanceMinor }).buyNow;

  it("says yes while 3 months of expenses survive the purchase", () => {
    // Balance 300k, typical spend 50k/mo: 150k leaves exactly 3 months.
    expect(buy(150_000)).toEqual({ status: "good", label: "Buy it now — still leaves 3.0 mo of expenses" });
  });

  it("warns between 1.5 and 3 months of cushion", () => {
    const v = buy(200_000)!; // 100k left → 2 months
    expect(v.status).toBe("warn");
    expect(v.label).toBe("You could, but it drops your cushion to 2.0 mo");
  });

  it("says no below a month and a half, and when the price beats the balance", () => {
    expect(buy(260_000)!.status).toBe("bad"); // 40k left → 0.8 months
    expect(buy(400_000)).toEqual({ status: "bad", label: "Costs more than your $3,000 balance" });
  });

  it("stays silent with no balance or no spending history to measure against", () => {
    expect(buy(150_000, null)).toBeNull();
    expect(planGoal(goal(), { balanceMinor: 300_000, cashflows: [], currentCalendarMonth: "2026-08", salaryMinor: 80_000, currency: "USD" }).buyNow).toBeNull();
  });
});

describe("the engine's verdict", () => {
  const facts = () =>
    goalFacts(plan(goal({ name: "electric guitar", target: 2_000_000, target_date: "2027-03-01" })), {
      currency: "USD",
      salaryMinor: 80_000,
      balanceMinor: 300_000,
      byCategory: [{ category: "Food & Dining", avg: 9_400 }],
      recurring: [{ merchant: "Netflix", amount: 649, cadence: "monthly" }],
    });

  it("hands over major units and the answers already computed, never raw transactions", () => {
    const f = facts();
    expect(f.goal.price).toBe(20_000); // 2,000,000 minor units, not 2,000,000 dollars
    expect(f.goal.months_until_they_want_it).toBe(7); // Aug 2026 → Mar 2027
    expect(f.goal.needed_per_month).toBe(2857.15); // computed here, so the model can't get the division wrong
    expect(f.typical_monthly_spend).toBe(500);
    expect(f.typical_monthly_spend_is_averaged_over_these_months).toEqual(["2026-05", "2026-06", "2026-07"]);
    expect(f.typical_monthly_left_over).toBe(300);
    expect(f.months_of_expenses_left_if_bought_outright_today).toBeNull(); // costs more than the balance — not "negative 34 months"
    expect(f.typical_monthly_spend_by_category).toEqual({ "Food & Dining": 94 });
    expect(JSON.stringify(f)).not.toContain("description");
  });

  it("builds a prompt the fixture engine can answer with valid advice", async () => {
    const prompt = buildGoalPrompt(facts());
    expect(prompt).toContain(GOAL_PROMPT_MARKER);
    expect(prompt).toContain("electric guitar");
    const advice = validateGoalAdvice(parseModelJson(await fixtureEngine.run(prompt, ".")));
    expect(advice.verdict).toBe("stretch");
  });

  it("reads back a stored verdict, and shows nothing rather than garbage", () => {
    const advice = { verdict: "yes", headline: "Yes — it fits.", reasons: ["You save enough."], cuts: [] };
    expect(storedAdvice(goal({ analysis: JSON.stringify(advice) }))?.headline).toBe("Yes — it fits.");
    expect(storedAdvice(goal())).toBeNull();
    expect(storedAdvice(goal({ analysis: '{"verdict":"maybe"}' }))).toBeNull(); // not a verdict we accept
    expect(storedAdvice(goal({ analysis: "{half-writ" }))).toBeNull(); // a torn row loses its card, not the page
  });
});
