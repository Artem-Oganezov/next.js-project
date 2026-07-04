import { describe, expect, it } from "vitest";
import { gamePlugin } from "@/lib/game/plugin";
import {
  maxPlausibleScore,
  validateGameScore,
  type ScoreRulesConfig,
} from "@/lib/game/score-rules";

const config: ScoreRulesConfig = gamePlugin.scoreRules;

describe("maxPlausibleScore", () => {
  it("returns grace for zero elapsed time", () => {
    expect(maxPlausibleScore(0, config)).toBe(config.scoreGrace);
  });

  it("scales with elapsed seconds", () => {
    expect(maxPlausibleScore(10_000, config)).toBe(
      10 * config.maxScorePerSecond + config.scoreGrace,
    );
  });
});

describe("validateGameScore", () => {
  const startedAt = new Date("2026-01-01T12:00:00.000Z");

  it("rejects when game session was not started", () => {
    const result = validateGameScore(5, null, config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/начните игру/i);
    }
  });

  it("rejects impossibly high score for short session", () => {
    const result = validateGameScore(
      500,
      startedAt,
      config,
      new Date("2026-01-01T12:00:01.000Z"),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects session shorter than minimum duration", () => {
    const result = validateGameScore(
      3,
      startedAt,
      config,
      new Date(startedAt.getTime() + config.minGameDurationMs - 1),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/короткая/i);
    }
  });

  it("rejects expired session", () => {
    const result = validateGameScore(
      50,
      startedAt,
      config,
      new Date(startedAt.getTime() + config.maxGameDurationMs + 1000),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/истекла/i);
    }
  });

  it("accepts plausible score for session duration", () => {
    const result = validateGameScore(
      50,
      startedAt,
      config,
      new Date("2026-01-01T12:00:30.000Z"),
    );
    expect(result.ok).toBe(true);
  });
});

describe("gamePlugin.validateScore", () => {
  it("delegates to score rules with plugin config", () => {
    const startedAt = new Date(Date.now() - 30_000);
    expect(gamePlugin.validateScore(50, startedAt).ok).toBe(true);
    expect(gamePlugin.validateScore(999_999, startedAt).ok).toBe(false);
  });
});
