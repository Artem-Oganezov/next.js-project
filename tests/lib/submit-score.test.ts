import { describe, expect, it } from "vitest";
import { scorePollDelayMs } from "@/lib/client/submit-score";

describe("scorePollDelayMs", () => {
  it("starts fast for early attempts", () => {
    expect(scorePollDelayMs(0)).toBe(500);
    expect(scorePollDelayMs(1)).toBe(500);
  });

  it("increases delay for later attempts", () => {
    expect(scorePollDelayMs(7)).toBeGreaterThan(scorePollDelayMs(2));
    expect(scorePollDelayMs(10)).toBe(1500);
  });
});
