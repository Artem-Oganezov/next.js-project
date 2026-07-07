import {
  invalidateAllSessionCachesForUser,
} from "@/lib/auth/session";
import { removeLeaderboardEntry } from "@/lib/cache/leaderboard";

/**
 * Clear Redis-side public state when a user is banned or deleted.
 * Mongo remains authoritative; this keeps caches and ZSET consistent.
 */
export async function purgeUserPlatformState(
  userId: string,
  username: string,
): Promise<void> {
  await Promise.all([
    invalidateAllSessionCachesForUser(userId),
    removeLeaderboardEntry(username),
  ]);
}
