import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "@/game/constants";
import { gamePlugin } from "@/lib/game/plugin";
import {
  BASE_SCORE_PER_SECOND,
  MAX_SCORE_PER_SECOND,
  SCORE_PER_FRAME,
} from "@/game/score-config";

describe("score-config", () => {
  it("keeps client SCORE_PER_FRAME in sync with GAME_CONFIG", () => {
    expect(GAME_CONFIG.SCORE_PER_FRAME).toBe(SCORE_PER_FRAME);
  });

  it("derives plugin maxScorePerSecond from shared physics", () => {
    expect(gamePlugin.scoreRules.maxScorePerSecond).toBe(MAX_SCORE_PER_SECOND);
    expect(MAX_SCORE_PER_SECOND).toBeGreaterThanOrEqual(BASE_SCORE_PER_SECOND);
  });
});
