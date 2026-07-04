import { replayGame, TICKS_PER_SECOND } from "@/game/engine";
import { gameMeta } from "@/game/meta";
import {
  validateGameScore,
  type ScoreRulesConfig,
  type ScoreValidationResult,
} from "@/lib/game/score-rules";

/**
 * Единственная game-specific точка бэкенда.
 *
 * Чтобы запустить этот бэкенд под другую игру, достаточно заменить
 * содержимое этого файла (и фронтенд): API-роуты, авторизация,
 * лидерборд и rate limiting игру не знают.
 */
export type GamePlugin = {
  id: string;
  displayName: string;
  scoreRules: ScoreRulesConfig;
  validateScore(
    score: number,
    gameStartedAt: Date | null | undefined,
    now?: Date,
  ): ScoreValidationResult;
  /**
   * Точная replay-валидация: сервер прогоняет партию по seed и логу
   * прыжков и сверяет счёт бит-в-бит. Опциональна — игра без
   * детерминированного движка полагается только на эвристики выше.
   */
  validateReplay?(
    seed: string,
    jumpTicks: readonly number[],
    submittedScore: number,
  ): ScoreValidationResult;
};

const scoreRules: ScoreRulesConfig = {
  // Dino Run: ~9 очков/сек при честной игре (SCORE_PER_FRAME 0.15 * 60fps),
  // 18 оставляет двукратный запас на лаги и рассинхрон часов.
  maxScorePerSecond: 18,
  scoreGrace: 10,
  maxGameDurationMs: 20 * 60 * 1000,
  // Первый кактус физически не долетает до дино раньше ~2.5 сек.
  minGameDurationMs: 2000,
};

const MAX_REPLAY_TICKS = (scoreRules.maxGameDurationMs / 1000) * TICKS_PER_SECOND;

export const gamePlugin: GamePlugin = {
  id: gameMeta.id,
  displayName: gameMeta.displayName,
  scoreRules,
  validateScore: (score, gameStartedAt, now) =>
    validateGameScore(score, gameStartedAt, scoreRules, now),
  validateReplay: (seed, jumpTicks, submittedScore) => {
    const replay = replayGame(seed, jumpTicks, MAX_REPLAY_TICKS);
    if (!replay.ok) {
      return { ok: false, message: "Партия не прошла серверную проверку" };
    }
    if (replay.score !== submittedScore) {
      return { ok: false, message: "Счёт не совпадает с проверкой партии" };
    }
    return { ok: true };
  },
};
