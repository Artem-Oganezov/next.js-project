/** Mongo filter: only non-banned users appear in leaderboard and rank seed. */
export const LEADERBOARD_ELIGIBLE_FILTER = { isBanned: false } as const;
