/**
 * Rebuild Redis leaderboard ZSET from Mongo.
 *
 * Prerequisites: MONGODB_URI, REDIS_URL, AUTH_SECRET in env (.env.local ok).
 *
 * Run: npx tsx scripts/rebuild-leaderboard.ts
 */
import { loadEnvLocal } from "@/lib/env-local";
import { rebuildLeaderboardFromMongo } from "@/lib/game/rank";
import { resetRedisCache } from "@/lib/redis";

loadEnvLocal();

async function main(): Promise<void> {
  const result = await rebuildLeaderboardFromMongo();
  console.log(
    JSON.stringify({
      ok: true,
      seeded: result.seeded,
    }),
  );
  await resetRedisCache();
  process.exit(0);
}

main().catch(async (error) => {
  console.error(
    JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : "unknown",
    }),
  );
  await resetRedisCache().catch(() => {});
  process.exit(1);
});
