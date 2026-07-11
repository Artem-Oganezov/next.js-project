/** Mongo filter: only non-banned users with a recorded best appear in leaderboard and rank seed. */
export const LEADERBOARD_ELIGIBLE_FILTER = {
  isBanned: { $ne: true },
  bestScore: { $gt: 0 },
} as const;
