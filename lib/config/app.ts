export const APP_NAME = "Dino Run";

export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export const RATE_LIMIT = {
  AUTH_MAX_REQUESTS: 10,
  AUTH_WINDOW_MS: 60_000,
  SCORE_MAX_REQUESTS: 30,
  SCORE_WINDOW_MS: 60_000,
} as const;
