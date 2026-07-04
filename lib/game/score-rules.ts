export type ScoreValidationResult = { ok: true } | { ok: false; message: string };

export type ScoreRulesConfig = {
  /** Максимум очков в секунду, достижимый честной игрой (с запасом). */
  maxScorePerSecond: number;
  /** Фиксированный допуск к рассчитанному максимуму. */
  scoreGrace: number;
  /** Партия дольше этого времени считается протухшей. */
  maxGameDurationMs: number;
  /** Партия короче этого времени отклоняется (0 — проверка выключена). */
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
    return { ok: false, message: "Сначала начните игру" };
  }

  const elapsedMs = now.getTime() - gameStartedAt.getTime();

  if (elapsedMs > config.maxGameDurationMs) {
    return { ok: false, message: "Игровая сессия истекла, начните заново" };
  }

  if (submittedScore > maxPlausibleScore(elapsedMs, config)) {
    return { ok: false, message: "Слишком высокий счёт для этой партии" };
  }

  if (elapsedMs < config.minGameDurationMs) {
    return { ok: false, message: "Партия слишком короткая" };
  }

  return { ok: true };
}
