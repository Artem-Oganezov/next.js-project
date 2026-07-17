import { describe, expect, it } from "vitest";
import { gamePlugin, dinoInputSchema } from "@/lib/game/plugin";
import {
  isBetterScore,
  leaderboardSortDirection,
  toLeaderboardKey,
} from "@/lib/game/score-order";
import { scoreBodySchema } from "@/lib/validation/score";

describe("scoreBodySchema", () => {
  const sessionId = "a".repeat(24);

  it("accepts valid score with session id", () => {
    const result = scoreBodySchema.safeParse({ score: 42, sessionId });
    expect(result.success).toBe(true);
  });

  it("accepts opaque inputLog without platform-level shape checks", () => {
    const result = scoreBodySchema.safeParse({
      score: 42,
      sessionId,
      inputLog: {
        actions: [
          [0, 1],
          [5, 2],
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative score", () => {
    const result = scoreBodySchema.safeParse({ score: -1, sessionId });
    expect(result.success).toBe(false);
  });

  it("rejects malformed session id", () => {
    expect(scoreBodySchema.safeParse({ score: 42 }).success).toBe(false);
    expect(
      scoreBodySchema.safeParse({ score: 42, sessionId: "not-an-object-id" }).success,
    ).toBe(false);
  });
});

describe("gamePlugin.parseInputLog (Dino reference plugin)", () => {
  it("accepts valid tick log", () => {
    const result = gamePlugin.parseInputLog([10, 55, 120]);
    expect(result.ok).toBe(true);
  });

  it("rejects malformed tick log via plugin schema", () => {
    expect(gamePlugin.parseInputLog([-1]).ok).toBe(false);
    expect(gamePlugin.parseInputLog([1.5]).ok).toBe(false);
    expect(
      gamePlugin.parseInputLog(Array.from({ length: 10_001 }, (_, i) => i)).ok,
    ).toBe(false);
  });

  it("defaults missing input to empty jump log object", () => {
    const result = gamePlugin.parseInputLog(undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input).toEqual({ jumpTicks: [] });
    }
  });

  it("accepts object log with reviveAtTick", () => {
    const result = gamePlugin.parseInputLog({
      jumpTicks: [10, 55],
      reviveAtTick: 400,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input).toEqual({ jumpTicks: [10, 55], reviveAtTick: 400 });
    }
  });
});

describe("mock multi-action input plugin contract", () => {
  const mockPlugin = {
    parseInputLog(raw: unknown) {
      const schema = dinoInputSchema; // stand-in for game-specific schema
      const parsed = schema.safeParse(raw ?? []);
      if (!parsed.success) {
        return { ok: false as const, message: "invalid" };
      }
      return { ok: true as const, input: parsed.data };
    },
  };

  it("allows platform to accept unknown shape before plugin rejects", () => {
    const body = scoreBodySchema.safeParse({
      score: 10,
      sessionId: "a".repeat(24),
      inputLog: "not-valid-for-dino",
    });
    expect(body.success).toBe(true);
    expect(mockPlugin.parseInputLog("not-valid-for-dino").ok).toBe(false);
  });
});

describe("score order helpers", () => {
  it("desc: higher is better", () => {
    expect(isBetterScore(10, 20, "desc")).toBe(true);
    expect(isBetterScore(20, 10, "desc")).toBe(false);
    expect(toLeaderboardKey(100, "desc")).toBe(100);
    expect(leaderboardSortDirection("desc")).toBe(-1);
  });

  it("asc: lower is better (negated Redis key)", () => {
    expect(isBetterScore(0, 50, "asc")).toBe(true);
    expect(isBetterScore(100, 50, "asc")).toBe(true);
    expect(isBetterScore(50, 100, "asc")).toBe(false);
    expect(toLeaderboardKey(100, "asc")).toBe(-100);
    expect(leaderboardSortDirection("asc")).toBe(1);
  });
});
