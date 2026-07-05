import type { ScoreOrder } from "@/lib/game/score-order";
import { toLeaderboardKey } from "@/lib/game/score-order";
import { getRedis } from "@/lib/redis";

const TOP10_KEY = "lb:top10";
const TOP10_TTL_SEC = 60;
const SCORES_KEY = "lb:scores";

export type LeaderboardEntry = {
  username: string;
  bestScore: number;
  activeSkin: string;
};

/** Top-10 cache: null — miss or Redis unavailable (fall back to Mongo). */
export async function getCachedTop10(): Promise<LeaderboardEntry[] | null> {
  try {
    const raw = await getRedis().get(TOP10_KEY);
    return raw ? (JSON.parse(raw) as LeaderboardEntry[]) : null;
  } catch {
    return null;
  }
}

export async function setCachedTop10(entries: LeaderboardEntry[]): Promise<void> {
  try {
    await getRedis().setEx(TOP10_KEY, JSON.stringify(entries), TOP10_TTL_SEC);
  } catch {
    // Redis unavailable — cache simply does not work; response is still valid from Mongo
  }
}

export async function invalidateTop10(): Promise<void> {
  try {
    await getRedis().del(TOP10_KEY);
  } catch {
    // expires via TTL
  }
}

/**
 * ZSET of all scores (member = username, score = normalized bestScore).
 * Updated on each new record; used for O(log N) rank.
 */
export async function upsertLeaderboardScore(
  username: string,
  bestScore: number,
  order: ScoreOrder,
): Promise<void> {
  try {
    await getRedis().zadd(SCORES_KEY, [
      { score: toLeaderboardKey(bestScore, order), member: username },
    ]);
  } catch {
    // rank will be computed via Mongo fallback
  }
}

export async function bulkSeedLeaderboard(
  entries: { username: string; bestScore: number }[],
  order: ScoreOrder,
): Promise<void> {
  await getRedis().zadd(
    SCORES_KEY,
    entries.map((e) => ({
      score: toLeaderboardKey(e.bestScore, order),
      member: e.username,
    })),
  );
}

export async function leaderboardSize(): Promise<number> {
  return getRedis().zcard(SCORES_KEY);
}

/** Rank from ZSET. Throws if Redis is unavailable. */
export async function rankFromCache(
  username: string,
  bestScore: number,
  order: ScoreOrder,
): Promise<{ rank: number; nextUsername: string | null }> {
  const redis = getRedis();
  const key = toLeaderboardKey(bestScore, order);

  await redis.zadd(SCORES_KEY, [{ score: key, member: username }]);

  const higherCount = await redis.zcountAbove(SCORES_KEY, key);
  const nextUsername =
    higherCount > 0 ? await redis.zfirstAbove(SCORES_KEY, key) : null;

  return { rank: higherCount + 1, nextUsername };
}
