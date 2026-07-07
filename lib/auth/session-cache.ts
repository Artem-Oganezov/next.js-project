import { SESSION_CACHE_TTL_SEC, SESSION_MAX_AGE_SEC } from "@/lib/config/app";
import { getRedis } from "@/lib/redis";
import type { User as PublicUser } from "@/types/user";

const SESSION_KEY_PREFIX = "auth:sess:";
const BANNED_KEY_PREFIX = "auth:banned:";

function sessionKey(tokenHash: string): string {
  return `${SESSION_KEY_PREFIX}${tokenHash}`;
}

function bannedKey(userId: string): string {
  return `${BANNED_KEY_PREFIX}${userId}`;
}

export async function getCachedSessionUser(
  tokenHash: string,
): Promise<PublicUser | null> {
  try {
    const redis = getRedis();
    const raw = await redis.get(sessionKey(tokenHash));
    if (!raw) return null;

    const user = JSON.parse(raw) as PublicUser;
    const banned = await redis.get(bannedKey(user.id));
    if (banned) {
      await redis.del(sessionKey(tokenHash));
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export async function setCachedSessionUser(
  tokenHash: string,
  user: PublicUser,
): Promise<void> {
  try {
    const redis = getRedis();
    await redis.setEx(
      sessionKey(tokenHash),
      JSON.stringify(user),
      SESSION_CACHE_TTL_SEC,
    );
  } catch {
    // Fail-open: auth still works via Mongo.
  }
}

export async function invalidateSessionCache(tokenHash: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(sessionKey(tokenHash));
  } catch {
    // Best-effort invalidation.
  }
}

export async function markUserBanned(userId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.setEx(bannedKey(userId), "1", SESSION_MAX_AGE_SEC);
  } catch {
    // Mongo ban remains authoritative.
  }
}

export async function clearUserBanned(userId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(bannedKey(userId));
  } catch {
    // Best-effort.
  }
}
