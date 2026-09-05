import { describe, expect, it } from "vitest";
import { createDb, type OutsourceRow } from "../lib/db";
import { fixtureEngine } from "../lib/engines/fixture";
import { buildOutsourcePrompt, OUTSOURCE_PROMPT_MARKER } from "../lib/engines/prompt";
import { hourlyRate, monthlyHours, outsourceFacts, planOutsource, storedOutsourceAdvice } from "../lib/outsource";
import { parseModelJson, validateOutsourceAdvice } from "../lib/schema";

const task = (over: Partial<OutsourceRow> = {}): OutsourceRow => ({
  id: 1,
  name: "House cleaning",
  cost: 80_000, // $800 in minor units
  hours: 4,
  cadence: "weekly",
  created_at: "2026-09-01",
  analysis: null,
  analysis_at: null,
  ...over,
});

// $8,000 take-home over a 40-hour week → about 173 hrs a month → about $46/hr.
const plan = (t: OutsourceRow, over: Partial<Parameters<typeof planOutsource>[1]> = {}) =>
  planOutsource(t, { salaryMinor: 800_000, hoursPerWeek: 40, typicalSpend: 500_000, currency: "USD", ...over });

describe("hourlyRate", () => {
  it("spreads the month's salary over 52 weeks of hours, not 48", () => {
    // 4 weeks a month would undercount a full month of working hours a year and flatter the rate.
    expect(monthlyHours(40)).toBeCloseTo(173.33, 2);
    expect(hourlyRate(800_000, 40)).toBeCloseTo(4615.38, 1); // $46.15/hr in minor units
    expect(hourlyRate(800_000, 20)).toBeCloseTo(9230.77, 1); // half the hours, twice the rate
  });

  it("has no answer without a salary or without hours", () => {
    expect(hourlyRate(null, 40)).toBeNull();
    expect(hourlyRate(0, 40)).toBeNull();
    expect(hourlyRate(800_000, 0)).toBeNull();
  });
});

describe("planOutsource — is the hour cheap?", () => {
  it("says yes when each hour back costs well under what an hour earns", () => {
    const p = plan(task({ cost: 6_000, hours: 4 })); // $60 for 4 hrs → $15/hr against $46
    expect(p.costPerHour).toBe(1_500);
    expect(p.headline).toBe("$15/hr");
    expect(p.sub).toBe("vs your $46/hr · 4 hrs back a week");
    expect(p.status).toBe("good");
    expect(p.verdict).toBe("Worth it — each hour back costs $15, and an hour of your work earns $46.");
    expect(p.maxWorth).toBeCloseTo(18_461.5, 0); // 4 × $46.15
  });

  it("calls a near-match even rather than a verdict either way", () => {
    // $46/hr costs $40/hr back: 87% of the rate — inside the ±20% band.
    const p = plan(task({ cost: 16_000, hours: 4 }));
    expect(p.status).toBe("warn");
    expect(p.verdict).toContain("About even");
  });

  it("says no when the hour costs more than it earns, and names the ceiling", () => {
    const p = plan(task({ cost: 80_000, hours: 4 })); // $200/hr against $46
    expect(p.status).toBe("bad");
    expect(p.verdict).toBe("Not worth it — you'd pay $200 for an hour that earns you $46.");
    expect(p.note).toBe("Worth paying up to $185 a week for this, not $800.");
  });
});

describe("planOutsource — can you carry it?", () => {
  it("turns a cheap hour into a no when the monthly cost beats what's left over", () => {
    // $15/hr is cheap, but 40 hrs a week of it is $2,600 a month against a $3,000 surplus — 87%.
    const p = plan(task({ cost: 60_000, hours: 40 }));
    expect(p.surplusShare).toBeCloseTo(0.867, 2);
    expect(p.status).toBe("bad");
    expect(p.verdict).toBe("Cheaper than your hour, but $2,600 a month is more than the $3,000 you have left over.");
  });

  it("warns when the cost is a big slice of what you save, even if the hour is cheap", () => {
    // $60 a week → $260 a month; at a $600 surplus that is 43%.
    const p = plan(task({ cost: 6_000, hours: 4 }), { typicalSpend: 740_000 });
    expect(p.status).toBe("warn");
    expect(p.verdict).toContain("43% of what you save");
    expect(p.note).toContain("pays for itself");
  });

  it("says so when you spend everything you earn", () => {
    const p = plan(task({ cost: 6_000, hours: 4 }), { typicalSpend: 800_000 });
    expect(p.surplusShare).toBeNull();
    expect(p.status).toBe("bad");
    expect(p.verdict).toContain("nothing left over");
  });

  it("measures a one-off against one month's leftover, not a monthly bite", () => {
    const once = plan(task({ cost: 120_000, hours: 40, cadence: "once" })); // $1,200 one-off at $30/hr, surplus $3,000
    expect(once.monthlyCost).toBe(120_000);
    expect(once.monthlyHours).toBe(40);
    expect(once.sub).toBe("vs your $46/hr · 40 hrs back");
    expect(once.status).toBe("good");
    // The same price every month would eat 40% of the surplus and only warn.
    expect(plan(task({ cost: 120_000, hours: 40, cadence: "monthly" })).status).toBe("warn");
  });

  it("puts the work-or-rest framing under a yes", () => {
    const p = plan(task({ cost: 6_000, hours: 4 }));
    // (46.15 − 15) × 17.33 hrs a month ≈ $540
    expect(p.netGain).toBeCloseTo(53_999, -2);
    expect(p.note).toBe("Fill those 17.3 hrs a month with paid work and you come out $540 a month ahead — or rest, at $15 an hour.");
  });
});

describe("planOutsource — no salary", () => {
  it("still prices the hour, but asks for a salary before judging", () => {
    const p = plan(task({ cost: 6_000, hours: 4 }), { salaryMinor: null });
    expect(p.rate).toBeNull();
    expect(p.headline).toBe("$15/hr");
    expect(p.sub).toBe("4 hrs back a week");
    expect(p.status).toBe("warn");
    expect(p.verdict).toContain("take-home salary");
    expect(p.note).toBeNull();
  });
});

describe("the engine's read", () => {
  const facts = () =>
    outsourceFacts(plan(task({ name: "house cleaning", cost: 6_000, hours: 4 })), {
      currency: "USD",
      salaryMinor: 800_000,
      hoursPerWeek: 40,
      typicalSpend: 500_000,
      spendMonths: ["2026-06", "2026-07", "2026-08"],
    });

  it("hands over major units with the comparison already made", () => {
    const f = facts();
    expect(f.task.cost_each_time).toBe(60);
    expect(f.task.cost_per_hour_freed).toBe(15);
    expect(f.take_home_per_hour).toBe(46.15);
    expect(f.task.most_worth_paying_each_time).toBe(184.62);
    expect(f.task.monthly_cost).toBe(260);
    expect(f.task.monthly_hours_freed).toBe(17.3);
    expect(f.typical_monthly_left_over).toBe(3000);
    expect(f.monthly_cost_as_share_of_left_over).toBe(0.09);
    expect(f.hours_worked_per_week).toBe(40);
  });

  it("builds a prompt the fixture engine answers with valid advice", async () => {
    const prompt = buildOutsourcePrompt(facts());
    expect(prompt).toContain(OUTSOURCE_PROMPT_MARKER);
    expect(prompt).toContain("house cleaning");
    const advice = validateOutsourceAdvice(parseModelJson(await fixtureEngine.run(prompt, ".")));
    expect(advice.verdict).toBe("depends");
  });

  it("reads back a stored verdict, and shows nothing rather than garbage", () => {
    const advice = { verdict: "yes", headline: "Yes — hand it off.", reasons: ["Your hour earns three times what it costs."] };
    expect(storedOutsourceAdvice(task({ analysis: JSON.stringify(advice) }))?.headline).toBe("Yes — hand it off.");
    expect(storedOutsourceAdvice(task())).toBeNull();
    expect(storedOutsourceAdvice(task({ analysis: '{"verdict":"maybe"}' }))).toBeNull(); // not a verdict we accept
    expect(storedOutsourceAdvice(task({ analysis: "{half-writ" }))).toBeNull();
  });
});

describe("store — chores and hours", () => {
  it("keeps the chores you asked about, newest first, and the verdict with them", () => {
    const db = createDb(":memory:");
    const a = db.addOutsource({ name: "Cleaning", cost: 6_000, hours: 4, cadence: "weekly" });
    const b = db.addOutsource({ name: "Tax filing", cost: 30_000, hours: 6, cadence: "once" });
    expect(db.outsource().map((t) => t.id)).toEqual([b, a]);
    db.setOutsourceAnalysis(a, '{"verdict":"yes"}');
    expect(db.outsource().find((t) => t.id === a)?.analysis_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    db.deleteOutsource(a);
    expect(db.outsource()).toHaveLength(1);
  });

  it("stores hours a week and treats nonsense as unset", () => {
    const db = createDb(":memory:");
    expect(db.workHours()).toBeNull();
    db.setWorkHours(45);
    expect(db.workHours()).toBe(45);
    db.setSetting("work_hours", "0");
    expect(db.workHours()).toBeNull();
    db.setWorkHours(null);
    expect(db.getSetting("work_hours")).toBeNull();
  });
});
