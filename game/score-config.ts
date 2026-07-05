/** Must stay in sync with game/engine.ts TICKS_PER_SECOND. */
export const TICKS_PER_SECOND = 60;

/** Points earned per simulation tick — must match server plugin score rules. */
export const SCORE_PER_FRAME = 0.15;

export const BASE_SCORE_PER_SECOND = SCORE_PER_FRAME * TICKS_PER_SECOND;

/** Headroom for post-revive speed scaling; used by lib/game/plugin.ts. */
export const MAX_SCORE_PER_SECOND = Math.ceil(BASE_SCORE_PER_SECOND * 1.35);

export const SCORE_GRACE = 10;

export const MIN_GAME_DURATION_MS = 2000;

export const MAX_GAME_DURATION_MS = 20 * 60 * 1000;
