import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Session } from "@/lib/models/Session";
import { User, type IUser } from "@/lib/models/User";
import type { User as PublicUser } from "@/types/dino-game.types";

export const SESSION_COOKIE_NAME = "dino_session";

export function toPublicUser(user: IUser): PublicUser {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    bestScore: user.bestScore,
  };
}

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("Please define the AUTH_SECRET environment variable");
  }
  return secret;
}

function hashSessionToken(token: string): string {
  return createHash("sha256")
    .update(`${token}${getAuthSecret()}`)
    .digest("hex");
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

  await connectDB();

  const tokenHash = hashSessionToken(token);
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

  return toPublicUser(user);
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await connectDB();
    const tokenHash = hashSessionToken(token);
    await Session.deleteOne({ tokenHash });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
