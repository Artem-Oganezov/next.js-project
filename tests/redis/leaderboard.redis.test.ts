import { describe, expect, it } from "vitest";
import {
  bumpLeaderboardCacheGeneration,
  getCachedTop10,
  rankFromCache,
  removeLeaderboardEntry,
  setCachedTop10,
  upsertLeaderboardScore,
} from "@/lib/cache/leaderboard";
import { isRedisAvailable } from "../redis.setup";

const describeRedis = isRedisAvailable() ? describe : describe.skip;

describeRedis("Redis leaderboard cache", () => {
  it("caches and reads top-10", async () => {
    const entries = [
      { username: "alpha", bestScore: 100, activeSkin: "default" },
      { username: "beta", bestScore: 50, activeSkin: "default" },
    ];

    await setCachedTop10(entries);
    const cached = await getCachedTop10();

    expect(cached).toEqual(entries);
  });

  it("ignores stale top-10 after cache generation bump", async () => {
    const entries = [{ username: "alpha", bestScore: 100, activeSkin: "default" }];

    await setCachedTop10(entries);
    await bumpLeaderboardCacheGeneration();

    expect(await getCachedTop10()).toBeNull();
  });

  it("computes rank from ZSET", async () => {
    await upsertLeaderboardScore("top", 500, "desc");
    await upsertLeaderboardScore("mid", 200, "desc");
    await upsertLeaderboardScore("me", 100, "desc");

    const rank = await rankFromCache("me", 100, "desc");

    expect(rank.rank).toBe(3);
    expect(rank.nextUsername).toBe("mid");
  });

  it("removes user from ZSET and invalidates top-10 cache", async () => {
    await upsertLeaderboardScore("ghost", 900, "desc");
    await setCachedTop10([
      { username: "ghost", bestScore: 900, activeSkin: "default" },
    ]);

    await removeLeaderboardEntry("ghost");

    expect(await getCachedTop10()).toBeNull();

    await upsertLeaderboardScore("solo", 100, "desc");
    const rank = await rankFromCache("solo", 100, "desc");
    expect(rank.rank).toBe(1);
  });

  it("rebuilds ZSET from Mongo via rebuildLeaderboardFromMongo", async () => {
    const { connectDB } = await import("@/lib/db/mongoose");
    const { User } = await import("@/lib/models/User");
    const { rebuildLeaderboardFromMongo } = await import("@/lib/game/rank");
    const { clearLeaderboardScores, leaderboardSize, rankFromCache } =
      await import("@/lib/cache/leaderboard");

    await connectDB();
    await User.create({
      username: `rebuild_${Date.now()}`,
      email: `rebuild_${Date.now()}@test.local`,
      passwordHash: "x".repeat(60),
      bestScore: 777,
      totalScore: 777,
    });

    await clearLeaderboardScores();
    expect(await leaderboardSize()).toBe(0);

    const result = await rebuildLeaderboardFromMongo();
    expect(result.seeded).toBeGreaterThanOrEqual(1);

    const rank = await rankFromCache(
      (await User.findOne({ bestScore: 777 }).sort({ createdAt: -1 }).lean())!.username,
      777,
      "desc",
    );
    expect(rank.rank).toBeGreaterThanOrEqual(1);
  });
});
