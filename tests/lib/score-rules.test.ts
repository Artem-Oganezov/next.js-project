import { describe, expect, it } from "vitest";
import {
  maxPlausibleScore,
  SCORE_GRACE,
  validateGameScore,
} from "@/lib/game/score-rules";

describe("maxPlausibleScore", () => {
  it("returns grace for zero elapsed time", () => {
    expect(maxPlausibleScore(0)).toBe(SCORE_GRACE);
  });

  it("scales with elapsed seconds", () => {
    expect(maxPlausibleScore(10_000)).toBe(10 * 18 + SCORE_GRACE);
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
