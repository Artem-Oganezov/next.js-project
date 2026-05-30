import { SCORE_VALIDATION } from "@/lib/game/constants";

export type ScoreValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function maxPlausibleScore(elapsedMs: number): number {
  if (elapsedMs <= 0) {
    return SCORE_VALIDATION.SCORE_GRACE;
  }

  const elapsedSec = elapsedMs / 1000;
  return (
    Math.floor(elapsedSec * SCORE_VALIDATION.MAX_SCORE_PER_SECOND) +
    SCORE_VALIDATION.SCORE_GRACE
  );
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

  if (elapsedMs > SCORE_VALIDATION.MAX_GAME_DURATION_MS) {
    return { ok: false, message: "Игровая сессия истекла, начните заново" };
  }

  if (submittedScore > maxPlausibleScore(elapsedMs)) {
    return { ok: false, message: "Слишком высокий счёт для этой партии" };
  }

  return { ok: true };
}
