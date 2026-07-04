import { getRedis } from "@/lib/redis";

const TOP10_KEY = "lb:top10";
const TOP10_TTL_SEC = 60;
const SCORES_KEY = "lb:scores";

export type LeaderboardEntry = {
  username: string;
  bestScore: number;
  activeSkin: string;
};

/** Кэш топ-10: null — промах или Redis недоступен (иди в Mongo). */
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
    // Redis недоступен — кэш просто не работает, ответ валиден из Mongo
  }
}

export async function invalidateTop10(): Promise<void> {
  try {
    await getRedis().del(TOP10_KEY);
  } catch {
    // истечёт по TTL
  }
}

/**
 * ZSET всех результатов (member = username, score = bestScore).
 * Обновляется при каждом новом рекорде; используется для O(log N) ранга.
 */
export async function upsertLeaderboardScore(
  username: string,
  bestScore: number,
): Promise<void> {
  try {
    await getRedis().zadd(SCORES_KEY, [{ score: bestScore, member: username }]);
  } catch {
    // ранг посчитается через Mongo fallback
  }
}

export async function bulkSeedLeaderboard(
  entries: { username: string; bestScore: number }[],
): Promise<void> {
  await getRedis().zadd(
    SCORES_KEY,
    entries.map((e) => ({ score: e.bestScore, member: e.username })),
  );
}

export async function leaderboardSize(): Promise<number> {
  return getRedis().zcard(SCORES_KEY);
}

/** Ранг из ZSET. Бросает исключение, если Redis недоступен. */
export async function rankFromCache(
  username: string,
  bestScore: number,
): Promise<{ rank: number; nextUsername: string | null }> {
  const redis = getRedis();

  // Самовосстановление: свой актуальный счёт всегда дописываем перед чтением.
  await redis.zadd(SCORES_KEY, [{ score: bestScore, member: username }]);

  const higherCount = await redis.zcountAbove(SCORES_KEY, bestScore);
  const nextUsername =
    higherCount > 0 ? await redis.zfirstAbove(SCORES_KEY, bestScore) : null;

  return { rank: higherCount + 1, nextUsername };
}
