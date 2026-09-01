import { FIXTURE_CAS } from "../cas";
import { GOAL_PROMPT_MARKER } from "./prompt";
import type { Extraction } from "../schema";
import type { Engine } from "./types";

// Mock statement for tests and for trying finzo without a Claude/Codex subscription.
export const FIXTURE_EXTRACTION: Extraction = {
  bank_name: "Fixture Bank",
  currency: "USD",
  period_start: "2026-07-01",
  period_end: "2026-07-31",
  closing_balance: 4187.42,
  transactions: [
    { date: "2026-07-01", description: "Salary - Meridian Labs", amount: 5230.0, direction: "credit", category: "Income" },
    { date: "2026-07-01", description: "Rent - Oakview Apartments", amount: 1650.0, direction: "debit", category: "Rent & Housing" },
    { date: "2026-07-02", description: "Whole Harvest Market", amount: 86.34, direction: "debit", category: "Groceries" },
    { date: "2026-07-03", description: "Metro card reload", amount: 40.0, direction: "debit", category: "Transport" },
    { date: "2026-07-05", description: "Netflix", amount: 15.49, direction: "debit", category: "Subscriptions" },
    { date: "2026-07-06", description: "Cafe Solano", amount: 12.8, direction: "debit", category: "Food & Dining" },
    { date: "2026-07-08", description: "Electric bill - City Power", amount: 94.17, direction: "debit", category: "Bills & Utilities" },
    { date: "2026-07-10", description: "Transfer to savings", amount: 800.0, direction: "debit", category: "Transfers" },
    { date: "2026-07-12", description: "Trailhead Outfitters", amount: 137.62, direction: "debit", category: "Shopping" },
    { date: "2026-07-14", description: "Pharmacy - Greenleaf", amount: 23.9, direction: "debit", category: "Health" },
    { date: "2026-07-16", description: "Ristorante Bel Poggio", amount: 64.5, direction: "debit", category: "Food & Dining" },
    { date: "2026-07-18", description: "Spotify", amount: 11.99, direction: "debit", category: "Subscriptions" },
    { date: "2026-07-19", description: "Whole Harvest Market", amount: 102.11, direction: "debit", category: "Groceries" },
    { date: "2026-07-21", description: "Cinema - Palace Theatres", amount: 28.0, direction: "debit", category: "Entertainment" },
    { date: "2026-07-23", description: "Rideshare", amount: 18.75, direction: "debit", category: "Transport" },
    { date: "2026-07-25", description: "ATM withdrawal fee", amount: 3.5, direction: "debit", category: "Fees" },
    { date: "2026-07-27", description: "Refund - Trailhead Outfitters", amount: 42.2, direction: "credit", category: "Other" },
    { date: "2026-07-29", description: "Whole Harvest Market", amount: 77.48, direction: "debit", category: "Groceries" },
  ],
};

/** Canned goal verdict — the fixture engine never looks at the real numbers, so it says so. */
const FIXTURE_GOAL_ADVICE = {
  verdict: "stretch",
  headline: "This is the demo engine — it can't see your numbers, so treat this as a sample.",
  reasons: [
    "Pick Claude Code or Codex in the top bar to get a verdict based on your actual spending.",
    "The monthly amount and the cushion check above are real — those are worked out on this machine either way.",
  ],
  cuts: [],
};

export const fixtureEngine: Engine = {
  id: "fixture",
  label: "Fixture (demo)",
  async extract(): Promise<Extraction> {
    return structuredClone(FIXTURE_EXTRACTION);
  },
  async run(prompt: string): Promise<string> {
    // Two questions reach an engine's run(): a goal verdict and CAS parsing.
    // The fixture answers both from canned data so the app works with no CLI.
    return JSON.stringify(prompt.includes(GOAL_PROMPT_MARKER) ? FIXTURE_GOAL_ADVICE : FIXTURE_CAS);
  },
};
