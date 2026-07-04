import { z } from "zod";
import { replayGame, TICKS_PER_SECOND } from "@/game/engine";
import { gameMeta } from "@/game/meta";
import {
  validateGameScore,
  type ScoreRulesConfig,
  type ScoreValidationResult,
} from "@/lib/game/score-rules";
import type { ScoreOrder } from "@/lib/game/score-order";

export type InputParseResult =
  | { ok: true; input: unknown }
  | { ok: false; message: string };

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
  /** desc — больше лучше; asc — меньше лучше (time attack). */
  scoreOrder: ScoreOrder;
  scoreRules: ScoreRulesConfig;
  /** Max serialized inputLog size in bytes (platform enforces before plugin parse). */
  maxInputLogBytes: number;
  parseInputLog(raw: unknown): InputParseResult;
  validateScore(
    score: number,
    gameStartedAt: Date | null | undefined,
    now?: Date,
  ): ScoreValidationResult;
  /**
   * Точная replay-валидация: сервер прогоняет партию по seed и логу
   * ввода и сверяет счёт бит-в-бит. Опциональна — игра без
   * детерминированного движка полагается только на эвристики выше.
   */
  validateReplay?(
    seed: string,
    input: unknown,
    submittedScore: number,
  ): ScoreValidationResult;
};

/** Dino Run: tick indices where jump was pressed. */
export const dinoInputSchema = z
  .array(
    z
      .number()
      .int("Tick index must be an integer")
      .min(0, "Tick index cannot be negative")
      .max(10_000_000, "Invalid tick index"),
  )
  .max(10_000, "Input log too long");

const scoreRules: ScoreRulesConfig = {
  maxScorePerSecond: 18,
  scoreGrace: 10,
  maxGameDurationMs: 20 * 60 * 1000,
  minGameDurationMs: 2000,
};

const MAX_REPLAY_TICKS = (scoreRules.maxGameDurationMs / 1000) * TICKS_PER_SECOND;
const MAX_INPUT_LOG_BYTES = 256 * 1024;

export const gamePlugin: GamePlugin = {
  id: gameMeta.id,
  displayName: gameMeta.displayName,
  scoreOrder: "desc",
  scoreRules,
  maxInputLogBytes: MAX_INPUT_LOG_BYTES,
  parseInputLog(raw) {
    const result = dinoInputSchema.safeParse(raw ?? []);
    if (!result.success) {
      return {
        ok: false,
        message: result.error.issues[0]?.message ?? "Invalid input log",
      };
    }
    return { ok: true, input: result.data };
  },
  validateScore: (score, gameStartedAt, now) =>
    validateGameScore(score, gameStartedAt, scoreRules, now),
  validateReplay: (seed, input, submittedScore) => {
    const jumpTicks = input as number[];
    const replay = replayGame(seed, jumpTicks, MAX_REPLAY_TICKS);
    if (!replay.ok) {
      return { ok: false, message: "Game failed server-side verification" };
    }
    if (replay.score !== submittedScore) {
      return { ok: false, message: "Score does not match server replay" };
    }
    return { ok: true };
  },
};
