import { gameMeta } from "@/game/meta";

/** Application name comes from the game module — see game/meta.ts. */
export const APP_NAME = gameMeta.displayName;

export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

/** Redis cache TTL for resolved auth sessions (tokenHash → PublicUser). */
export const SESSION_CACHE_TTL_SEC = 10 * 60;

/**
 * Maximum concurrent sessions per user (multi-device still supported).
 * When creating a new session, oldest sessions beyond the limit are removed —
 * lost cookies do not stay valid until TTL expires.
 */
export const MAX_SESSIONS_PER_USER = 5;

export const RATE_LIMIT = {
  AUTH_MAX_REQUESTS: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 10),
  AUTH_WINDOW_MS: 60_000,
  SCORE_MAX_REQUESTS: Number(process.env.RATE_LIMIT_SCORE_MAX ?? 30),
  SCORE_WINDOW_MS: 60_000,
  SCORE_STATUS_MAX_REQUESTS: Number(process.env.RATE_LIMIT_SCORE_STATUS_MAX ?? 120),
  SCORE_STATUS_WINDOW_MS: 60_000,
} as const;
