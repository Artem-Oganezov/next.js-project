import { describe, expect, it } from "vitest";
import { SCORE_VALIDATION } from "@/lib/game/constants";
import { maxPlausibleScore, validateGameScore } from "@/lib/game/score-rules";

describe("maxPlausibleScore", () => {
  it("returns grace for zero elapsed time", () => {
    expect(maxPlausibleScore(0)).toBe(SCORE_VALIDATION.SCORE_GRACE);
  });

  it("scales with elapsed seconds", () => {
    expect(maxPlausibleScore(10_000)).toBe(
      10 * SCORE_VALIDATION.MAX_SCORE_PER_SECOND + SCORE_VALIDATION.SCORE_GRACE,
    );
  });
});

describe("validateGameScore", () => {
  const startedAt = new Date("2026-01-01T12:00:00.000Z");

  it("rejects when game session was not started", () => {
    const result = validateGameScore(5, null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/начните игру/i);
    }
  });

  it("rejects impossibly high score for short session", () => {
    const result = validateGameScore(
      500,
      startedAt,
      new Date("2026-01-01T12:00:01.000Z"),
    );
    expect(result.ok).toBe(false);
  });

  it("accepts plausible score for session duration", () => {
    const result = validateGameScore(
      50,
      startedAt,
      new Date("2026-01-01T12:00:30.000Z"),
    );
    expect(result.ok).toBe(true);
  });
});
