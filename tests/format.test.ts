import { describe, expect, it } from "vitest";
import { delta, greeting } from "../lib/format";

describe("greeting", () => {
  // Local time on purpose — the dashboard renders on the same machine the user is sitting at.
  const at = (h: number) => greeting(new Date(2026, 7, 25, h, 30));
  it("covers the day in three bands", () => {
    expect(at(0)).toBe("Good morning");
    expect(at(11)).toBe("Good morning");
    expect(at(12)).toBe("Good afternoon");
    expect(at(16)).toBe("Good afternoon");
    expect(at(17)).toBe("Good evening");
    expect(at(23)).toBe("Good evening");
  });
});

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
