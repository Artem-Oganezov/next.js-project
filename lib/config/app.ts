import { gameMeta } from "@/game/meta";

/** Название приложения берётся из игрового модуля — см. game/meta.ts. */
export const APP_NAME = gameMeta.displayName;

export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/**
 * Максимум одновременных сессий на юзера (мультиустройство остаётся).
 * При создании новой сессии старейшие сверх лимита удаляются — утерянные
 * куки не живут валидными до конца TTL.
 */
export const MAX_SESSIONS_PER_USER = 5;

export const RATE_LIMIT = {
  AUTH_MAX_REQUESTS: 10,
  AUTH_WINDOW_MS: 60_000,
  SCORE_MAX_REQUESTS: 30,
  SCORE_WINDOW_MS: 60_000,
} as const;
