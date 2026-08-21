import { describe, expect, it } from "vitest";
import { parseModelJson, validateExtraction } from "../lib/schema";
import { FIXTURE_EXTRACTION } from "../lib/engines/fixture";

describe("parseModelJson", () => {
  it("parses a bare JSON object", () => {
    expect(parseModelJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it("strips code fences and prose", () => {
    const text = 'Here you go:\n```json\n{"a": [1, 2]}\n```\nDone.';
    expect(parseModelJson(text)).toEqual({ a: [1, 2] });
  });

  it("throws when no JSON object is present", () => {
    expect(() => parseModelJson("sorry, I could not read the file")).toThrow(/No JSON object/);
  });
});

describe("validateExtraction", () => {
  it("accepts the fixture extraction", () => {
    expect(validateExtraction(FIXTURE_EXTRACTION)).toEqual(FIXTURE_EXTRACTION);
  });

  it("rejects unknown categories", () => {
    const bad = structuredClone(FIXTURE_EXTRACTION) as { transactions: { category: string }[] };
    bad.transactions[0].category = "Crypto Gambling";
    expect(() => validateExtraction(bad)).toThrow(/category/);
  });

  it("rejects negative amounts and bad dates", () => {
    const bad = structuredClone(FIXTURE_EXTRACTION);
    bad.transactions[0].amount = -5;
    bad.transactions[1].date = "07/02/2026";
    expect(() => validateExtraction(bad)).toThrow(/amount|date/);
  });
});
