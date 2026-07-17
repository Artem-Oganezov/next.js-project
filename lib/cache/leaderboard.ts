import type { ScoreOrder } from "@/lib/game/score-order";
import { toLeaderboardKey } from "@/lib/game/score-order";
import { getRedis } from "@/lib/redis";

const TOP10_KEY = "lb:top10";
const TOP10_GEN_KEY = "lb:top10:gen";
const TOP10_TTL_SEC = 60;
const SCORES_KEY = "lb:scores";
const UPSERT_MAX_ATTEMPTS = 2;
const UPSERT_RETRY_MS = 25;
const UPSERT_OPERATION_TIMEOUT_MS = 500;

async function zaddLeaderboardScore(
  username: string,
  bestScore: number,
  order: ScoreOrder,
): Promise<void> {
  await Promise.race([
    getRedis().zadd(SCORES_KEY, [
      { score: toLeaderboardKey(bestScore, order), member: username },
    ]),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("redis-timeout")), UPSERT_OPERATION_TIMEOUT_MS);
    }),
  ]);
}

export async function upsertLeaderboardScore(
  username: string,
  bestScore: number,
  order: ScoreOrder,
): Promise<void> {
  for (let attempt = 1; attempt <= UPSERT_MAX_ATTEMPTS; attempt += 1) {
    try {
      await zaddLeaderboardScore(username, bestScore, order);
      return;
    } catch (error) {
      if (attempt === UPSERT_MAX_ATTEMPTS) {
        console.error(
          JSON.stringify({
            level: "error",
            scope: "leaderboard",
            action: "upsert-failed",
            username,
            message: error instanceof Error ? error.message : "unknown",
          }),
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, UPSERT_RETRY_MS * attempt));
    }
  }
}

export type LeaderboardEntry = {
  username: string;
  bestScore: number;
  activeSkin: string;
};

type CachedTop10Payload = {
  gen: number;
  entries: LeaderboardEntry[];
};

async function getLeaderboardCacheGeneration(): Promise<number> {
  const raw = await getRedis().get(TOP10_GEN_KEY);
  return raw ? Number(raw) : 0;
}

/** Bump generation so stale top-10 payloads on any node are ignored. */
export async function bumpLeaderboardCacheGeneration(): Promise<void> {
  try {
    await getRedis().pipeline().incr(TOP10_GEN_KEY).del(TOP10_KEY).exec();
  } catch {
    // Mongo remains authoritative; cache simply misses until repopulated.
  }
}

/** Top-10 cache: null — miss or Redis unavailable (fall back to Mongo). */
export async function getCachedTop10(): Promise<LeaderboardEntry[] | null> {
  try {
    const redis = getRedis();
    const [currentGen, raw] = await Promise.all([
      getLeaderboardCacheGeneration(),
      redis.get(TOP10_KEY),
    ]);
    if (!raw) {
      return null;
    }

    const payload = JSON.parse(raw) as CachedTop10Payload;
    if (payload.gen !== currentGen) {
      return null;
    }

    return payload.entries;
  } catch {
    return null;
  }
}

export async function setCachedTop10(entries: LeaderboardEntry[]): Promise<void> {
  try {
    const gen = await getLeaderboardCacheGeneration();
    const payload: CachedTop10Payload = { gen, entries };
    await getRedis().setEx(TOP10_KEY, JSON.stringify(payload), TOP10_TTL_SEC);
  } catch {
    // Redis unavailable — cache simply does not work; response is still valid from Mongo
  }
}

export async function invalidateTop10(): Promise<void> {
  await bumpLeaderboardCacheGeneration();
}

/** Remove a user from the rank ZSET (ban, account deletion). */
export async function removeLeaderboardEntry(username: string): Promise<void> {
  try {
    await getRedis().zrem(SCORES_KEY, [username]);
    await invalidateTop10();
  } catch {
    // Mongo remains authoritative; ZSET self-heals on next seed
  }
}

/**
 * ZSET of all scores (member = username, score = normalized bestScore).
 * Updated on each new record; used for O(log N) rank.
 */

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

/** Drop the rank ZSET so it can be fully rebuilt from Mongo. */
export async function clearLeaderboardScores(): Promise<void> {
  await getRedis().del(SCORES_KEY);
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

  const [, higherCount, nextMembers] = await redis
    .pipeline()
    .zadd(SCORES_KEY, [{ score: key, member: username }])
    .zcountAbove(SCORES_KEY, key)
    .zfirstAbove(SCORES_KEY, key)
    .exec();

  const higher = Number(higherCount);
  const members = nextMembers as string[] | string | null | undefined;
  const nextMember = Array.isArray(members) ? members[0] : members;
  const nextUsername = higher > 0 ? (nextMember ?? null) : null;

  return { rank: higher + 1, nextUsername };
}
