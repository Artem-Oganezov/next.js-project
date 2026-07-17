import { TICKS_PER_SECOND } from "@/game/engine";
import { AntiCheatReason } from "@/lib/security/anti-cheat-reasons";

export type ScoreValidationResult =
  { ok: true } | { ok: false; code: string; message: string };

export type ScoreRulesConfig = {
  maxScorePerSecond: number;
  scoreGrace: number;
  maxGameDurationMs: number;
  minGameDurationMs: number;
};

export type ValidateGameScoreOptions = {
  /** When replay succeeded, min duration may pass via tick count instead of wall clock. */
  replayTicks?: number;
};

export function minRunTicks(config: ScoreRulesConfig): number {
  return Math.ceil((config.minGameDurationMs / 1000) * TICKS_PER_SECOND);
}

export function maxPlausibleScore(elapsedMs: number, config: ScoreRulesConfig): number {
  if (elapsedMs <= 0) {
    return config.scoreGrace;
  }

  const elapsedSec = elapsedMs / 1000;
  return Math.floor(elapsedSec * config.maxScorePerSecond) + config.scoreGrace;
}

export function validateGameScore(
  submittedScore: number,
  gameStartedAt: Date | null | undefined,
  config: ScoreRulesConfig,
  now: Date = new Date(),
  options?: ValidateGameScoreOptions,
): ScoreValidationResult {
  if (!gameStartedAt) {
    return {
      ok: false,
      code: AntiCheatReason.UNKNOWN_SESSION,
      message: "Start a game session first",
    };
  }

  const elapsedMs = now.getTime() - gameStartedAt.getTime();

  if (elapsedMs > config.maxGameDurationMs) {
    return {
      ok: false,
      code: AntiCheatReason.SESSION_EXPIRED,
      message: "Game session expired, start a new run",
    };
  }

  if (submittedScore > maxPlausibleScore(elapsedMs, config)) {
    return {
      ok: false,
      code: AntiCheatReason.SCORE_CEILING,
      message: "Score too high for this run",
    };
  }

  if (options?.replayTicks !== undefined) {
    const replayElapsedMs = (options.replayTicks / TICKS_PER_SECOND) * 1000;
    if (submittedScore > maxPlausibleScore(replayElapsedMs, config)) {
      return {
        ok: false,
        code: AntiCheatReason.SCORE_CEILING,
        message: "Score too high for this run",
      };
    }
  }

  const minTicks = minRunTicks(config);
  const ticksOk = options?.replayTicks !== undefined && options.replayTicks >= minTicks;
  if (elapsedMs < config.minGameDurationMs && !ticksOk) {
    return {
      ok: false,
      code: AntiCheatReason.RUN_TOO_SHORT,
      message: "Run too short",
    };
  }

  return { ok: true };
}
