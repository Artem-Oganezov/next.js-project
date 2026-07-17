import { LEADERBOARD_ELIGIBLE_FILTER } from "@/lib/game/leaderboard-eligibility";
import {
  bulkSeedLeaderboard,
  clearLeaderboardScores,
  invalidateTop10,
  leaderboardSize,
  rankFromCache,
} from "@/lib/cache/leaderboard";
import { connectDB } from "@/lib/db/mongoose";
import { gamePlugin } from "@/lib/game/plugin";
import {
  mongoBetterThanFilter,
  mongoNextSort,
  type ScoreOrder,
} from "@/lib/game/score-order";
import { User } from "@/lib/models/User";

export type RankResult = {
  rank: number;
  nextUsername: string | null;
};

const SEED_BATCH_SIZE = 1000;

export async function seedLeaderboardFromMongo(order: ScoreOrder): Promise<void> {
  await connectDB();

  let batch: { username: string; bestScore: number }[] = [];

  const cursor = User.find(LEADERBOARD_ELIGIBLE_FILTER)
    .select("username bestScore -_id")
    .lean()
    .cursor();

  for await (const doc of cursor) {
    batch.push({ username: doc.username, bestScore: doc.bestScore });
    if (batch.length >= SEED_BATCH_SIZE) {
      await bulkSeedLeaderboard(batch, order);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await bulkSeedLeaderboard(batch, order);
  }
}

async function rankFromMongo(
  bestScore: number,
  order: ScoreOrder,
): Promise<RankResult> {
  await connectDB();

  const eligibleFilter = {
    ...LEADERBOARD_ELIGIBLE_FILTER,
    ...mongoBetterThanFilter(bestScore, order),
  };
  const higherCount = await User.countDocuments(eligibleFilter);

  let nextUsername: string | null = null;
  if (higherCount > 0) {
    const nextUser = await User.findOne(eligibleFilter)
      .sort(mongoNextSort(order))
      .select("username -_id")
      .lean();
    nextUsername = nextUser?.username ?? null;
  }

  return { rank: higherCount + 1, nextUsername };
}

/** Pre-warm Redis ZSET on boot when empty (avoids cold-seed spike on first score). */
export async function warmLeaderboardIfEmpty(): Promise<void> {
  try {
    if ((await leaderboardSize()) === 0) {
      await seedLeaderboardFromMongo(gamePlugin.scoreOrder);
    }
  } catch {
    // Best-effort; computeRank seeds on demand when Redis is available.
  }
}

/**
 * Full rebuild of Redis rank ZSET from Mongo (source of truth).
 * Use after Redis wipe, drift, or ops incidents — also via admin API / CLI.
 */
export async function rebuildLeaderboardFromMongo(): Promise<{ seeded: number }> {
  await connectDB();
  await clearLeaderboardScores();
  await seedLeaderboardFromMongo(gamePlugin.scoreOrder);
  await invalidateTop10();
  return { seeded: await leaderboardSize() };
}

/**
 * User position in the global leaderboard and username of the nearest rival above.
 *
 * Primary path — Redis ZSET (O(log N)); an empty ZSET is seeded once from Mongo.
 * When Redis is unavailable — direct count in Mongo via index.
 */
export async function computeRank(
  username: string,
  bestScore: number,
): Promise<RankResult> {
  const order = gamePlugin.scoreOrder;

  try {
    if ((await leaderboardSize()) === 0) {
      await seedLeaderboardFromMongo(order);
    }
    return await rankFromCache(username, bestScore, order);
  } catch {
    return rankFromMongo(bestScore, order);
  }
}
