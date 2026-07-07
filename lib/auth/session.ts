import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { Types } from "mongoose";
import {
  getCachedSessionUser,
  invalidateSessionCache,
  markUserBanned,
  setCachedSessionUser,
} from "@/lib/auth/session-cache";
import { MAX_SESSIONS_PER_USER, SESSION_MAX_AGE_SEC } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { getEnv } from "@/lib/env";
import { Session } from "@/lib/models/Session";
import { User, type IUser } from "@/lib/models/User";
import type { User as PublicUser } from "@/types/user";

export const SESSION_COOKIE_NAME = "game_session";

export function toPublicUser(user: IUser): PublicUser {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    bestScore: user.bestScore,
    totalScore: user.totalScore,
    unlockedSkins: user.unlockedSkins,
    activeSkin: user.activeSkin,
  };
}

export function hashSessionToken(token: string): string {
  const { AUTH_SECRET } = getEnv();
  return createHash("sha256").update(`${token}${AUTH_SECRET}`).digest("hex");
}

function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string | Types.ObjectId): Promise<void> {
  await connectDB();

  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000);

  await Session.create({
    userId,
    tokenHash,
    expiresAt,
  });

  // Session cap: oldest sessions beyond the limit are revoked so
  // forgotten cookies (another computer, etc.) do not stay valid until TTL expires.
  const staleSessions = await Session.find({ userId })
    .sort({ expiresAt: -1 })
    .skip(MAX_SESSIONS_PER_USER)
    .select({ tokenHash: 1 });
  if (staleSessions.length > 0) {
    await Session.deleteMany({
      _id: { $in: staleSessions.map((s) => s._id) },
    });
    await Promise.all(
      staleSessions.map((s) => invalidateSessionCache(s.tokenHash)),
    );
  }

  const user = await User.findById(userId);
  if (user && !user.isBanned) {
    await setCachedSessionUser(tokenHash, toPublicUser(user));
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function getSessionUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const cached = await getCachedSessionUser(tokenHash);
  if (cached) {
    return cached;
  }

  await connectDB();

  const session = await Session.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

  if (!session) {
    return null;
  }

  const user = await User.findById(session.userId);
  if (!user) {
    return null;
  }

  if (user.isBanned) {
    await Session.deleteOne({ tokenHash });
    await invalidateSessionCache(tokenHash);
    await markUserBanned(user._id.toString());
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  const publicUser = toPublicUser(user);
  await setCachedSessionUser(tokenHash, publicUser);
  return publicUser;
}

/** Push fresh User fields into every active session cache entry for this user. */
export async function syncSessionCacheForUser(userId: string): Promise<void> {
  await connectDB();

  const user = await User.findById(userId);
  if (!user || user.isBanned) {
    return;
  }

  const publicUser = toPublicUser(user);
  const sessions = await Session.find({
    userId,
    expiresAt: { $gt: new Date() },
  }).select({ tokenHash: 1 });

  await Promise.all(
    sessions.map((session) => setCachedSessionUser(session.tokenHash, publicUser)),
  );
}

/** Best-effort wipe of Redis session cache for all of a user's sessions. */
export async function invalidateAllSessionCachesForUser(
  userId: string,
): Promise<void> {
  await connectDB();

  const sessions = await Session.find({ userId }).select({ tokenHash: 1 });
  await Promise.all(
    sessions.map((session) => invalidateSessionCache(session.tokenHash)),
  );
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await connectDB();
    const tokenHash = hashSessionToken(token);
    await Session.deleteOne({ tokenHash });
    await invalidateSessionCache(tokenHash);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
