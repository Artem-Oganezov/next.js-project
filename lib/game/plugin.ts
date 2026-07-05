import { z } from "zod";
import { replayGame, TICKS_PER_SECOND } from "@/game/engine";
import {
  MAX_GAME_DURATION_MS,
  MAX_SCORE_PER_SECOND,
  MIN_GAME_DURATION_MS,
  SCORE_GRACE,
} from "@/game/score-config";
import { gameMeta } from "@/game/meta";
import {
  validateGameScore,
  type ScoreRulesConfig,
  type ScoreValidationResult,
  type ValidateGameScoreOptions,
} from "@/lib/game/score-rules";
import type { ScoreOrder } from "@/lib/game/score-order";
import { AntiCheatReason } from "@/lib/security/anti-cheat-reasons";

export type InputParseResult =
  | { ok: true; input: unknown }
  | { ok: false; message: string };

export type DinoInputLog = {
  jumpTicks: number[];
  reviveAtTick?: number;
};

export type ReplayValidationResult =
  | { ok: true; ticks: number }
  | { ok: false; code: string; message: string };

/**
 * The only game-specific backend entry point.
 *
 * To run this backend for a different game, replace the contents of this file
 * (and the frontend): API routes, auth, leaderboard, and rate limiting are game-agnostic.
 */
export type GamePlugin = {
  id: string;
  displayName: string;
  /** desc — higher is better; asc — lower is better (time attack). */
  scoreOrder: ScoreOrder;
  scoreRules: ScoreRulesConfig;
  /** Max serialized inputLog size in bytes (platform enforces before plugin parse). */
  maxInputLogBytes: number;
  parseInputLog(raw: unknown): InputParseResult;
  validateScore(
    score: number,
    gameStartedAt: Date | null | undefined,
    now?: Date,
    options?: ValidateGameScoreOptions,
  ): ScoreValidationResult;
  /**
   * Exact replay validation: the server replays the run from seed and input log
   * and verifies the score bit-for-bit. Optional — games without a deterministic
   * engine rely only on the heuristics above.
   */
  validateReplay?(
    seed: string,
    input: unknown,
    submittedScore: number,
  ): ReplayValidationResult;
};

const jumpTicksSchema = z
  .array(
    z
      .number()
      .int("Tick index must be an integer")
      .min(0, "Tick index cannot be negative")
      .max(10_000_000, "Invalid tick index"),
  )
  .max(10_000, "Input log too long");

/** Legacy array-only log (still accepted). */
export const dinoInputSchema = jumpTicksSchema;

const dinoInputObjectSchema = z
  .object({
    jumpTicks: jumpTicksSchema,
    reviveAtTick: z
      .number()
      .int("Revive tick must be an integer")
      .min(1, "Revive tick must be positive")
      .max(10_000_000, "Invalid revive tick")
      .optional(),
  })
  .strict();

function parseDinoInputLog(raw: unknown): InputParseResult {
  if (raw === undefined || raw === null || Array.isArray(raw)) {
    const result = jumpTicksSchema.safeParse(raw ?? []);
    if (!result.success) {
      return {
        ok: false,
        message: result.error.issues[0]?.message ?? "Invalid input log",
      };
    }
    return { ok: true, input: { jumpTicks: result.data } satisfies DinoInputLog };
  }

  const objectResult = dinoInputObjectSchema.safeParse(raw);
  if (!objectResult.success) {
    return {
      ok: false,
      message: objectResult.error.issues[0]?.message ?? "Invalid input log",
    };
  }
  return { ok: true, input: objectResult.data satisfies DinoInputLog };
}

const scoreRules: ScoreRulesConfig = {
  maxScorePerSecond: MAX_SCORE_PER_SECOND,
  scoreGrace: SCORE_GRACE,
  maxGameDurationMs: MAX_GAME_DURATION_MS,
  minGameDurationMs: MIN_GAME_DURATION_MS,
};

const MAX_REPLAY_TICKS = (scoreRules.maxGameDurationMs / 1000) * TICKS_PER_SECOND;
const MAX_INPUT_LOG_BYTES = 256 * 1024;

export const gamePlugin: GamePlugin = {
  id: gameMeta.id,
  displayName: gameMeta.displayName,
  scoreOrder: "desc",
  scoreRules,
  maxInputLogBytes: MAX_INPUT_LOG_BYTES,
  parseInputLog: parseDinoInputLog,
  validateScore: (score, gameStartedAt, now, options) =>
    validateGameScore(score, gameStartedAt, scoreRules, now, options),
  validateReplay: (seed, input, submittedScore) => {
    const { jumpTicks, reviveAtTick } = input as DinoInputLog;
    const replay = replayGame(seed, jumpTicks, MAX_REPLAY_TICKS, reviveAtTick);
    if (!replay.ok) {
      if (replay.reason === "revive-mismatch") {
        return {
          ok: false,
          code: AntiCheatReason.REPLAY_REVIVE_MISMATCH,
          message: "Revive tick does not match server replay",
        };
      }
      return {
        ok: false,
        code: AntiCheatReason.REPLAY_FAILED,
        message: "Game failed server-side verification",
      };
    }
    if (replay.score !== submittedScore) {
      return {
        ok: false,
        code: AntiCheatReason.REPLAY_SCORE_MISMATCH,
        message: "Score does not match server replay",
      };
    }
    return { ok: true, ticks: replay.ticks };
  },
};
