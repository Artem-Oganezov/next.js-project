import { describe, expect, it } from "vitest";
import {
  getCachedTop10,
  rankFromCache,
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

  it("computes rank from ZSET", async () => {
    await upsertLeaderboardScore("top", 500, "desc");
    await upsertLeaderboardScore("mid", 200, "desc");
    await upsertLeaderboardScore("me", 100, "desc");

    const rank = await rankFromCache("me", 100, "desc");

    expect(rank.rank).toBe(3);
    expect(rank.nextUsername).toBe("mid");
  });
});
