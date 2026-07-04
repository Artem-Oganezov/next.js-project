import {
  bulkSeedLeaderboard,
  leaderboardSize,
  rankFromCache,
} from "@/lib/cache/leaderboard";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";

export type RankResult = {
  rank: number;
  nextUsername: string | null;
};

const SEED_BATCH_SIZE = 1000;

async function seedLeaderboardFromMongo(): Promise<void> {
  await connectDB();

  let batch: { username: string; bestScore: number }[] = [];

  const cursor = User.find({}).select("username bestScore -_id").lean().cursor();

  for await (const doc of cursor) {
    batch.push({ username: doc.username, bestScore: doc.bestScore });
    if (batch.length >= SEED_BATCH_SIZE) {
      await bulkSeedLeaderboard(batch);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await bulkSeedLeaderboard(batch);
  }
}

async function rankFromMongo(bestScore: number): Promise<RankResult> {
  await connectDB();

  const higherCount = await User.countDocuments({
    bestScore: { $gt: bestScore },
  });

  let nextUsername: string | null = null;
  if (higherCount > 0) {
    const nextUser = await User.findOne({ bestScore: { $gt: bestScore } })
      .sort({ bestScore: 1 })
      .select("username -_id")
      .lean();
    nextUsername = nextUser?.username ?? null;
  }

  return { rank: higherCount + 1, nextUsername };
}

/**
 * Позиция юзера в общем рейтинге и username ближайшего соперника сверху.
 *
 * Основной путь — Redis ZSET (O(log N)); пустой ZSET один раз засеивается
 * из Mongo. При недоступном Redis — прямой подсчёт в Mongo по индексу.
 */
export async function computeRank(
  username: string,
  bestScore: number,
): Promise<RankResult> {
  try {
    if ((await leaderboardSize()) === 0) {
      await seedLeaderboardFromMongo();
    }
    return await rankFromCache(username, bestScore);
  } catch {
    return rankFromMongo(bestScore);
  }
}
