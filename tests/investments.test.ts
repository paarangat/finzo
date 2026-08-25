import { describe, expect, it } from "vitest";
import { FIXTURE_CAS, validateCas } from "../lib/cas";
import { createDb, toMinor } from "../lib/db";
import { portfolio } from "../lib/investments";
import { schemeMatchScore } from "../lib/nav";
import type { InvestmentRow } from "../lib/db";

const row = (kind: string, value: number, invested: number | null = null): InvestmentRow => ({
  id: 0, name: kind, kind, value, invested, units: null, scheme_code: null, updated_at: "2026-08-25",
});

describe("portfolio", () => {
  it("totals, buckets by instrument type, and sums gain over rows with a cost basis", () => {
    const p = portfolio([
      row("mf_equity", 50_000, 40_000),
      row("stocks", 10_000),
      row("fd", 30_000),
      row("savings", 10_000),
    ]);
    expect(p.total).toBe(100_000);
    expect(p.gain).toBe(10_000); // only the mutual fund has a basis
    expect(p.buckets.map((b) => [b.key, b.value, b.share])).toEqual([
      ["equity", 60_000, 0.6],
      ["debt", 30_000, 0.3],
      ["cash", 10_000, 0.1],
    ]);
  });

  it("reports no gain when nothing has a cost basis, and handles empty", () => {
    expect(portfolio([row("fd", 5_000)]).gain).toBeNull();
    expect(portfolio([])).toEqual({ total: 0, gain: null, buckets: [] });
  });
});

describe("CAS", () => {
  it("validates the fixture and rejects junk", () => {
    expect(validateCas(structuredClone(FIXTURE_CAS)).holdings).toHaveLength(3);
    expect(() => validateCas({ holdings: [] })).toThrow();
    expect(() => validateCas({ statement_date: null, holdings: [{ name: "X", kind: "crypto", units: 1, value: 5, invested: null, isin: null }] })).toThrow();
  });
});

describe("scheme matching", () => {
  it("scores by shared tokens so the right plan variant wins", () => {
    const cas = "Parag Parikh Flexi Cap Fund - Direct Plan - Growth";
    const direct = schemeMatchScore(cas, "Parag Parikh Flexi Cap Fund - Direct Plan - Growth");
    const regular = schemeMatchScore(cas, "Parag Parikh Flexi Cap Fund - Regular Plan - Growth");
    const other = schemeMatchScore(cas, "HDFC Liquid Fund - Direct Plan - Growth");
    expect(direct).toBe(1);
    expect(regular).toBeLessThan(direct);
    expect(other).toBeLessThan(0.6);
  });
});

describe("holding upsert", () => {
  it("matches by scheme code, then normalized name; otherwise inserts", () => {
    const db = createDb(":memory:");
    const h = { name: "PPFAS Flexi Cap - Direct - Growth", kind: "mf_equity", value: toMinor(100), invested: null, units: 10, scheme_code: 122639 };
    expect(db.upsertHolding(h)).toBe("inserted");
    expect(db.upsertHolding({ ...h, name: "Parag Parikh Flexi Cap", value: toMinor(120) })).toBe("updated"); // scheme code wins
    expect(db.investments()).toHaveLength(1);
    expect(db.investments()[0].value).toBe(toMinor(120));
    const manual = { name: "HDFC FD", kind: "fd", value: toMinor(50), invested: null, units: null, scheme_code: null };
    expect(db.upsertHolding(manual)).toBe("inserted");
    expect(db.upsertHolding({ ...manual, value: toMinor(55) })).toBe("updated"); // name match
    expect(db.investments()).toHaveLength(2);
  });
});
