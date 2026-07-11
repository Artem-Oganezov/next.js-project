import { randomBytes } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { connectDB } from "@/lib/db/mongoose";
import { getEnv } from "@/lib/env";
import { User, type IUser } from "@/lib/models/User";
import { msg } from "@/lib/i18n/messages";

export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";
export const GOOGLE_OAUTH_STATE_MAX_AGE_SEC = 600;

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid",
];

export type GoogleOAuthProfile = {
  googleId: string;
  email: string;
  name?: string;
};

export class GoogleOAuthError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_configured"
      | "invalid_state"
      | "token_exchange_failed"
      | "profile_invalid"
      | "email_taken"
      | "account_banned",
  ) {
    super(message);
    this.name = "GoogleOAuthError";
  }
}

export function isGoogleOAuthEnabled(): boolean {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const appUrl = process.env.APP_URL?.trim();
  return Boolean(clientId && clientSecret && appUrl);
}

export function getGoogleRedirectUri(): string {
  const { APP_URL } = getEnv();
  if (!APP_URL) {
    throw new GoogleOAuthError("APP_URL is required for Google OAuth", "not_configured");
  }
  return new URL("/api/auth/google/callback", APP_URL).toString();
}

export function createGoogleOAuthClient(): OAuth2Client {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = getEnv();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new GoogleOAuthError("Google OAuth is not configured", "not_configured");
  }
  return new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    getGoogleRedirectUri(),
  );
}

export function generateGoogleOAuthState(): string {
  return randomBytes(32).toString("hex");
}

export function buildGoogleAuthUrl(state: string): string {
  const client = createGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: "online",
    scope: GOOGLE_SCOPES,
    state,
    prompt: "select_account",
    include_granted_scopes: true,
  });
}

export async function fetchGoogleProfileFromCode(
  code: string,
): Promise<GoogleOAuthProfile> {
  const client = createGoogleOAuthClient();

  let idToken: string | undefined;
  try {
    const { tokens } = await client.getToken(code);
    idToken = tokens.id_token;
  } catch {
    throw new GoogleOAuthError("Google token exchange failed", "token_exchange_failed");
  }

  if (!idToken) {
    throw new GoogleOAuthError("Google did not return an ID token", "profile_invalid");
  }

  let payload: NonNullable<
    Awaited<ReturnType<OAuth2Client["verifyIdToken"]>>["getPayload"]
  >;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: getEnv().GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new GoogleOAuthError("Google ID token verification failed", "profile_invalid");
  }

  if (!payload?.sub || !payload.email) {
    throw new GoogleOAuthError("Google profile is missing required fields", "profile_invalid");
  }

  if (payload.email_verified === false) {
    throw new GoogleOAuthError("Google email is not verified", "profile_invalid");
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name,
  };
}

function sanitizeUsernameBase(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return cleaned.length >= 3 ? cleaned.slice(0, 26) : "";
}

export async function allocateUsername(
  name: string | undefined,
  email: string,
): Promise<string> {
  const emailLocal = email.split("@")[0] ?? "player";
  const base =
    sanitizeUsernameBase(name ?? "") ||
    sanitizeUsernameBase(emailLocal) ||
    "player";

  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = attempt === 0 ? "" : `_${randomBytes(2).toString("hex")}`;
    const candidate = `${base}${suffix}`.slice(0, 30);
    const exists = await User.exists({ username: candidate });
    if (!exists) {
      return candidate;
    }
  }

  return `user_${randomBytes(4).toString("hex")}`.slice(0, 30);
}

/**
 * Find an existing Google user or create one. Rejects when the email belongs
 * to a local password account (no silent account linking).
 */
export async function signInWithGoogleProfile(
  profile: GoogleOAuthProfile,
): Promise<IUser> {
  await connectDB();

  const byGoogleId = await User.findOne({ googleId: profile.googleId });
  if (byGoogleId) {
    if (byGoogleId.isBanned) {
      throw new GoogleOAuthError(msg.auth.accountBanned, "account_banned");
    }
    return byGoogleId;
  }

  const byEmail = await User.findOne({ email: profile.email });
  if (byEmail) {
    if (byEmail.isBanned) {
      throw new GoogleOAuthError(msg.auth.accountBanned, "account_banned");
    }
    if (byEmail.passwordHash) {
      throw new GoogleOAuthError(msg.auth.googleEmailTaken, "email_taken");
    }
    if (byEmail.googleId && byEmail.googleId !== profile.googleId) {
      throw new GoogleOAuthError(msg.auth.googleEmailTaken, "email_taken");
    }

    byEmail.googleId = profile.googleId;
    byEmail.authProvider = "google";
    byEmail.emailVerified = true;
    await byEmail.save();
    return byEmail;
  }

  const username = await allocateUsername(profile.name, profile.email);
  const user = await User.create({
    username,
    email: profile.email,
    emailVerified: true,
    authProvider: "google",
    googleId: profile.googleId,
  });

  return user;
}

export function googleOAuthErrorRedirectPath(code: GoogleOAuthError["code"]): string {
  return `/?auth_error=${code}`;
}
