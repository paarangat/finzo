import { describe, expect, it } from "vitest";
import { ruleChecks } from "../lib/rules";
import type { Summary } from "../lib/db";

const summary = (byCategory: Summary["byCategory"]): Summary => ({
  income: 0, // unused: targets come from salary
  spent: byCategory.reduce((acc, c) => acc + c.total, 0),
  byCategory,
  byDay: [],
  currency: "USD",
});

const SALARY = 100_000; // minor units

describe("ruleChecks", () => {
  it("grades 50/30/20, rent, and emergency fund against the salary", () => {
    // needs 40% (rent 25 + groceries 15), wants 25%, saved 35%
    const s = summary([
      { category: "Rent & Housing", total: 25_000 },
      { category: "Groceries", total: 15_000 },
      { category: "Shopping", total: 25_000 },
    ]);
    const cashflows = [
      { month: "2026-05", income: 0, spent: 40_000 },
      { month: "2026-06", income: 0, spent: 50_000 },
      { month: "2026-07", income: 0, spent: 60_000 },
      { month: "2026-08", income: 0, spent: 5_000 }, // partial current month, ignored in the average
    ];
    const checks = ruleChecks(s, 250_000, cashflows, "2026-08", SALARY);
    expect(checks.map((c) => [c.label, c.value, c.status])).toEqual([
      ["Needs", "40%", "good"],
      ["Wants", "25%", "good"],
      ["Savings", "35%", "good"],
      ["Rent", "25%", "good"],
      ["Emergency fund", "5.0 mo", "good"], // 250k / avg(40k,50k,60k)
    ]);
    const needs = checks[0];
    expect(needs.sub).toBe("$400 / $500");
    expect(needs.tick).toBeCloseTo(0.5 / 0.6); // target sits 5/6 along the track
    expect(needs.fill).toBeCloseTo(0.4 / 0.6);
    const fund = checks[4];
    expect(fund.band).toEqual([0.5, 1]);
    expect(fund.tick).toBeCloseTo(0.5);
  });

  it("flags overspending: fill caps at 1, savings floor at 0", () => {
    const s = summary([
      { category: "Rent & Housing", total: 45_000 },
      { category: "Bills & Utilities", total: 20_000 },
      { category: "Shopping", total: 45_000 },
    ]);
    const checks = ruleChecks(s, 50_000, [], "2026-08", SALARY); // no history: current spend is the baseline
    expect(checks.map((c) => [c.label, c.status])).toEqual([
      ["Needs", "bad"], // 65%
      ["Wants", "bad"], // 45%
      ["Savings", "bad"], // -10%
      ["Rent", "bad"], // 45%
      ["Emergency fund", "bad"], // 0.5 months
    ]);
    const wants = checks[1];
    expect(wants.fill).toBe(1); // 45% > 30%*1.2 → value defines the scale
    expect(wants.tick).toBeCloseTo(0.3 / 0.45);
    const savings = checks[2];
    expect(savings.value).toBe("-10%");
    expect(savings.fill).toBe(0);
    expect(savings.statusLabel).toBe("Spent more than salary");
  });

  it("returns nothing without a salary — the UI shows setup instead", () => {
    const s = summary([{ category: "Shopping", total: 10_000 }]);
    expect(ruleChecks(s, 250_000, [], "2026-08", null)).toEqual([]);
  });
});

describe("rule drill-down categories", () => {
  // The dialog sums debits in check.categories. If that set drifts from the SQL
  // behind byCategory, the dialog quietly disagrees with the card it opened from.
  it("each check's category set sums to the amount the card reports", () => {
    const byCategory: Summary["byCategory"] = [
      { category: "Rent & Housing", total: 25_000 },
      { category: "Groceries", total: 10_000 },
      { category: "Family", total: 12_000 },
      { category: "Shopping", total: 8_000 },
      { category: "Travel", total: 5_000 },
    ];
    const s = summary(byCategory);
    const checks = ruleChecks(s, 250_000, [], "2026-08", SALARY);
    const sum = (c: (typeof checks)[number]) =>
      byCategory.filter((b) => c.categories!.includes(b.category)).reduce((acc, b) => acc + b.total, 0);

    const by = Object.fromEntries(checks.map((c) => [c.label, c]));
    expect(sum(by.Needs)).toBe(35_000); // rent + groceries
    expect(sum(by.Wants)).toBe(25_000); // family + shopping + travel — Family is a want
    expect(sum(by.Rent)).toBe(25_000);
    expect(sum(by.Savings)).toBe(s.spent); // savings = salary − everything below
    expect(sum(by.Needs) + sum(by.Wants)).toBe(s.spent);
    expect(by["Emergency fund"].categories).toBeUndefined(); // no transactions back it

    // Non-spend never enters a drill-down, matching `category NOT IN (Transfers, Income)`.
    for (const c of checks) {
      expect(c.categories ?? []).not.toContain("Transfers");
      expect(c.categories ?? []).not.toContain("Income");
    }
  });
});
