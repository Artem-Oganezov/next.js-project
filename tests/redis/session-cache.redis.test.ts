import { beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongoose";
import {
  getCachedSessionUser,
  setCachedSessionUser,
} from "@/lib/auth/session-cache";
import { syncSessionCacheForUser } from "@/lib/auth/session";
import { User } from "@/lib/models/User";
import { Session } from "@/lib/models/Session";
import type { User as PublicUser } from "@/types/user";
import { isRedisAvailable } from "../redis.setup";

const describeRedis = isRedisAvailable() ? describe : describe.skip;

beforeAll(async () => {
  await connectDB();
});

const sampleUser = (): PublicUser => ({
  id: "507f1f77bcf86cd799439011",
  username: "cache_user",
  email: "cache@test.com",
  emailVerified: true,
  bestScore: 10,
  totalScore: 20,
  unlockedSkins: ["default"],
  activeSkin: "default",
});

describeRedis("Redis session cache", () => {
  it("returns cached user and respects ban flag", async () => {
    const {
      clearUserBanned,
      invalidateSessionCache,
      markUserBanned,
    } = await import("@/lib/auth/session-cache");
    const { getRedis } = await import("@/lib/redis");
    const tokenHash = `test-hash-${Date.now()}`;
    const user = sampleUser();

    await setCachedSessionUser(tokenHash, user);
    await expect(getCachedSessionUser(tokenHash)).resolves.toEqual(user);

    await markUserBanned(user.id);
    await expect(getCachedSessionUser(tokenHash)).resolves.toBeNull();

    await clearUserBanned(user.id);
    await invalidateSessionCache(tokenHash);
    await getRedis().del(`auth:sess:${tokenHash}`);
  });

  it("syncSessionCacheForUser refreshes cached profile fields", async () => {
    const tokenHash = `sync-hash-${Date.now()}`;
    const user = await User.create({
      username: `sync_user_${Date.now()}`,
      email: `sync_${Date.now()}@example.com`,
      passwordHash: "hash",
      emailVerified: true,
      bestScore: 5,
      totalScore: 10,
    });

    await Session.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await setCachedSessionUser(tokenHash, {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      emailVerified: true,
      bestScore: 5,
      totalScore: 10,
      unlockedSkins: ["default"],
      activeSkin: "default",
    });

    await User.findByIdAndUpdate(user._id, {
      $set: { bestScore: 99, totalScore: 150 },
    });

    await syncSessionCacheForUser(user._id.toString());

    const cached = await getCachedSessionUser(tokenHash);
    expect(cached?.bestScore).toBe(99);
    expect(cached?.totalScore).toBe(150);
  });
});
