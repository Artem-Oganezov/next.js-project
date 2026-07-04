import { createHash, randomBytes } from "crypto";
import { connectDB } from "@/lib/db/mongoose";
import { getEnv } from "@/lib/env";
import { AuthToken, type AuthTokenType } from "@/lib/models/AuthToken";

const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  const { AUTH_SECRET } = getEnv();
  return createHash("sha256").update(`${token}${AUTH_SECRET}`).digest("hex");
}

export async function issueAuthToken(
  userId: string,
  type: AuthTokenType,
  ttlMs: number,
): Promise<string> {
  await connectDB();

  const rawToken = randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMs);

  await AuthToken.deleteMany({ userId, type });
  await AuthToken.create({ userId, type, tokenHash, expiresAt });

  return rawToken;
}

export async function consumeAuthToken(
  rawToken: string,
  type: AuthTokenType,
): Promise<string | null> {
  await connectDB();

  const tokenHash = hashToken(rawToken);
  const record = await AuthToken.findOneAndDelete({
    tokenHash,
    type,
    expiresAt: { $gt: new Date() },
  });

  return record ? record.userId.toString() : null;
}

export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
