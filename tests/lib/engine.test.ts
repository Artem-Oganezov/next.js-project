import { describe, expect, it } from "vitest";
import { createDinoEngine, replayGame } from "@/game/engine";
import { playHonestGame, playHonestGameWithRevive } from "../helpers/replay";

const SEED = "test-seed-deterministic";
const MAX_TICKS = 200_000;

describe("Dino engine determinism", () => {
  it("same seed and inputs produce identical run", () => {
    const first = replayGame(SEED, [50, 120, 200], MAX_TICKS);
    const second = replayGame(SEED, [50, 120, 200], MAX_TICKS);
    expect(first).toEqual(second);
  });

  it("run without jumps ends on the first cactus with a small score", () => {
    const result = replayGame(SEED, [], MAX_TICKS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(60);
    }
  });

  it("different seeds produce different runs", () => {
    const a = replayGame("seed-a", [], MAX_TICKS);
    const b = replayGame("seed-b", [], MAX_TICKS);
    expect(a).not.toEqual(b);
  });

  it("returns too-long when run exceeds max ticks", () => {
    const result = replayGame(SEED, [], 10);
    expect(result).toEqual({ ok: false, reason: "too-long" });
  });

  it("tick-by-tick engine matches replayGame", () => {
    const jumps = new Set([50, 120, 200]);
    const engine = createDinoEngine(SEED);
    while (!engine.isGameOver()) {
      engine.tick(jumps.has(engine.getTick()));
    }

    const replay = replayGame(SEED, [...jumps], MAX_TICKS);
    expect(replay).toEqual({
      ok: true,
      score: engine.getScore(),
      ticks: engine.getTick(),
    });
  });

  it("tick-by-tick engine with revive matches replayGame", () => {
    const run = playHonestGameWithRevive(SEED, 120);
    const replay = replayGame(SEED, run.jumpTicks, MAX_TICKS, run.reviveAtTick);
    expect(replay).toEqual({ ok: true, score: run.score, ticks: run.ticks });
  });
});

describe("playHonestGame helper", () => {
  it("reaches the target score and its log passes replay validation", () => {
    const run = playHonestGame(SEED, 100);
    expect(run.score).toBeGreaterThanOrEqual(100);

    const replay = replayGame(SEED, run.jumpTicks, MAX_TICKS);
    expect(replay).toEqual({ ok: true, score: run.score, ticks: run.ticks });
  });
});
