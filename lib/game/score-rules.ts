export type ScoreValidationResult = { ok: true } | { ok: false; message: string };

export type ScoreRulesConfig = {
  maxScorePerSecond: number;
  scoreGrace: number;
  maxGameDurationMs: number;
  minGameDurationMs: number;
};

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
): ScoreValidationResult {
  if (!gameStartedAt) {
    return { ok: false, message: "Start a game session first" };
  }

  const elapsedMs = now.getTime() - gameStartedAt.getTime();

  if (elapsedMs > config.maxGameDurationMs) {
    return { ok: false, message: "Game session expired, start a new run" };
  }

  if (submittedScore > maxPlausibleScore(elapsedMs, config)) {
    return { ok: false, message: "Score too high for this run" };
  }

  if (elapsedMs < config.minGameDurationMs) {
    return { ok: false, message: "Run too short" };
  }

  return { ok: true };
}
