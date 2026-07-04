export type ScoreOrder = "desc" | "asc";

/** Higher rank = better. For asc (time attack) Redis stores negated scores. */
export function toLeaderboardKey(score: number, order: ScoreOrder): number {
  return order === "desc" ? score : -score;
}

export function isBetterScore(
  currentBest: number,
  candidate: number,
  order: ScoreOrder,
): boolean {
  if (order === "desc") {
    return candidate > currentBest;
  }
  if (currentBest === 0) {
    return true;
  }
  return candidate < currentBest;
}

export function leaderboardSortDirection(order: ScoreOrder): -1 | 1 {
  return order === "desc" ? -1 : 1;
}

export function mongoBetterThanFilter(
  score: number,
  order: ScoreOrder,
): { bestScore: { $gt: number } } | { bestScore: { $lt: number } } {
  return order === "desc" ? { bestScore: { $gt: score } } : { bestScore: { $lt: score } };
}

export function mongoNextSort(order: ScoreOrder): { bestScore: 1 | -1 } {
  return order === "desc" ? { bestScore: 1 } : { bestScore: -1 };
}
