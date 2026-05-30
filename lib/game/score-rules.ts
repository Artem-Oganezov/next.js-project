/** Совпадает с DinoGame: currentScore += 0.15 за кадр (~60 FPS ≈ 9 очков/сек). */
export const SCORE_PER_FRAME = 0.15;
export const ASSUMED_FPS = 60;

/** Верхняя граница очков в секунду (запас к ускорению игры). */
export const MAX_SCORE_PER_SECOND = 18;

/** Допуск на сетевую задержку и округление Math.floor. */
export const SCORE_GRACE = 10;

/** Максимальная длительность одной партии. */
export const MAX_GAME_DURATION_MS = 20 * 60 * 1000;

export type ScoreValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function maxPlausibleScore(elapsedMs: number): number {
  if (elapsedMs <= 0) {
    return SCORE_GRACE;
  }
  const elapsedSec = elapsedMs / 1000;
  return Math.floor(elapsedSec * MAX_SCORE_PER_SECOND) + SCORE_GRACE;
}

export function validateGameScore(
  submittedScore: number,
  gameStartedAt: Date | null | undefined,
  now: Date = new Date(),
): ScoreValidationResult {
  if (!gameStartedAt) {
    return { ok: false, message: "Сначала начните игру" };
  }

  const elapsedMs = now.getTime() - gameStartedAt.getTime();

  if (elapsedMs > MAX_GAME_DURATION_MS) {
    return { ok: false, message: "Игровая сессия истекла, начните заново" };
  }

  if (submittedScore > maxPlausibleScore(elapsedMs)) {
    return { ok: false, message: "Слишком высокий счёт для этой партии" };
  }

  return { ok: true };
}
