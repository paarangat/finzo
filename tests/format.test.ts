import { describe, expect, it } from "vitest";
import { delta } from "../lib/format";

describe("delta", () => {
  it("hides when there is no previous value", () => {
    expect(delta(500, 0)).toBeNull();
  });
  it("reports increases", () => {
    expect(delta(112, 100)).toBe(12);
  });
  it("reports decreases", () => {
    expect(delta(88, 100)).toBe(-12);
  });
  it("rounds to whole percent", () => {
    expect(delta(1005, 1000)).toBe(1);
    expect(delta(1004, 1000)).toBe(0);
    expect(delta(0, 100)).toBe(-100);
  });
});
