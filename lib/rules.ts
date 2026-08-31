import { NEEDS_CATEGORIES, SPEND_CATEGORIES, WANTS_CATEGORIES, type Category } from "./categories";
import { formatMoneyWhole } from "./format";
import type { Cashflow, Summary } from "./db";

/** One rule-of-thumb tile: value vs a salary-derived target, with meter geometry. */
export interface RuleCheck {
  label: string;
  value: string; // headline, e.g. "42%" or "1.7 mo"
  sub: string; // e.g. "₹37,927 / ₹45,000"
  status: "good" | "warn" | "bad";
  statusLabel: string;
  fill: number; // 0..1 of the meter
  tick: number; // 0..1 target marker position
  band?: [number, number]; // 0..1 target zone (emergency fund)
  /** Debit categories the headline is summed over; drives the drill-down. Absent when no transactions back the number. */
  categories?: Category[];
}

const pct = (share: number) => `${Math.round(share * 100)}%`;

/**
 * The classic rules (50/30/20, rent < 30%, 3–6 month emergency fund) measured
 * against a fixed monthly salary rather than one month's recorded credits, so
 * targets stay put. Returns [] when no salary is set — the UI shows setup.
 * Rules needing data Finzo doesn't track (age, insurance, EMIs) are absent.
 */
export function ruleChecks(
  summary: Summary,
  balanceMinor: number | null,
  cashflows: Cashflow[],
  currentCalendarMonth: string, // "YYYY-MM"; keeps the partial current month out of the emergency-fund average
  salaryMinor: number | null
): RuleCheck[] {
  if (salaryMinor === null || salaryMinor <= 0) return [];
  const { spent, byCategory, currency } = summary;
  const money = (minor: number) => formatMoneyWhole(Math.round(minor), currency);

  const needs = byCategory.filter((c) => NEEDS_CATEGORIES.includes(c.category)).reduce((acc, c) => acc + c.total, 0);
  const wants = spent - needs;
  const saved = salaryMinor - spent;
  const rent = byCategory.find((c) => c.category === "Rent & Housing")?.total ?? 0;

  // Meter scale: the target sits ~5/6 along the track unless the value overshoots it.
  const meter = (share: number, target: number) => {
    const max = Math.max(target * 1.2, share);
    return { fill: Math.max(Math.min(share / max, 1), 0), tick: target / max };
  };

  const spendRule = (label: string, amount: number, target: number, warnAt: number, categories: Category[]): RuleCheck => {
    const share = amount / salaryMinor;
    const status = share <= target ? "good" : share <= warnAt ? "warn" : "bad";
    const line = `${pct(target)} line`;
    return {
      label,
      value: pct(share),
      sub: `${money(amount)} / ${money(salaryMinor * target)}`,
      status,
      statusLabel: status === "good" ? `On track · under ${pct(target)}` : status === "warn" ? `Close to the ${line}` : `Over the ${line}`,
      categories,
      ...meter(share, target),
    };
  };

  const savedShare = saved / salaryMinor;
  const checks: RuleCheck[] = [
    spendRule("Needs", needs, 0.5, 0.6, NEEDS_CATEGORIES),
    spendRule("Wants", wants, 0.3, 0.4, WANTS_CATEGORIES),
    {
      label: "Savings",
      value: pct(savedShare),
      sub: `${money(Math.max(saved, 0))} / ${money(salaryMinor * 0.2)}`,
      status: savedShare >= 0.2 ? "good" : savedShare >= 0.1 ? "warn" : "bad",
      statusLabel:
        saved < 0 ? "Spent more than salary" : savedShare >= 0.2 ? "On track · 20%+ saved" : "Below the 20% goal",
      categories: SPEND_CATEGORIES, // salary minus all spending — the drill-down is where the rest went
      ...meter(Math.max(savedShare, 0), 0.2),
    },
    spendRule("Rent", rent, 0.3, 0.35, ["Rent & Housing"]),
  ];

  const past = cashflows.filter((c) => c.month < currentCalendarMonth && c.spent > 0).slice(-3);
  const avgSpend = past.length ? past.reduce((acc, c) => acc + c.spent, 0) / past.length : spent;
  if (balanceMinor !== null && balanceMinor > 0 && avgSpend > 0) {
    const months = balanceMinor / avgSpend;
    const max = Math.max(6, months);
    checks.push({
      label: "Emergency fund",
      value: `${months >= 10 ? Math.round(months) : months.toFixed(1)} mo`,
      sub: `${money(balanceMinor)} saved`,
      status: months >= 3 ? "good" : months >= 1.5 ? "warn" : "bad",
      statusLabel: months >= 6 ? "Fully funded" : months >= 3 ? "3+ months covered" : months >= 1.5 ? "Getting to 3 months" : "Under 2 months",
      fill: Math.min(months / max, 1),
      tick: 3 / max,
      band: [3 / max, Math.min(6 / max, 1)],
    });
  }

  return checks;
}
