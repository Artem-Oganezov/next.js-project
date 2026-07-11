import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { unauthorized } from "@/lib/api/errors";
import { msg } from "@/lib/i18n/messages";
import { getEnv } from "@/lib/env";
import { secureCompare } from "@/lib/security/secure-compare";

export const ADMIN_SESSION_COOKIE = "admin_session";
const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 8;

function signAdminSessionPayload(payload: string): string {
  const { ADMIN_SECRET } = getEnv();
  return createHmac("sha256", ADMIN_SECRET!).update(payload).digest("hex");
}

function buildAdminSessionToken(): string {
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE_SEC * 1000;
  const payload = `${expiresAt}.${nonce}`;
  const signature = signAdminSessionPayload(payload);
  return `${payload}.${signature}`;
}

function parseAdminSessionToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [expiresAtRaw, nonce, signature] = parts;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !nonce || !signature) {
    return false;
  }

  const expected = signAdminSessionPayload(`${expiresAtRaw}.${nonce}`);
  if (expected.length !== signature.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function createAdminSession(): Promise<void> {
  const token = buildAdminSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SEC,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

function hasValidAdminSessionCookie(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return false;
  }

  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`));

  if (!match) {
    return false;
  }

  const token = decodeURIComponent(match.slice(ADMIN_SESSION_COOKIE.length + 1));
  return parseAdminSessionToken(token);
}

/**
 * Admin auth: httpOnly session cookie (preferred) or legacy header/bearer secret.
 */
export function requireAdminSecret(request: Request): Response | null {
  const { ADMIN_SECRET } = getEnv();
  if (!ADMIN_SECRET) {
    return unauthorized(msg.admin.notConfigured);
  }

  if (hasValidAdminSessionCookie(request)) {
    return null;
  }

  return verifyAdminSecretHeader(request);
}

/** Header/bearer check only — used to mint the httpOnly admin session cookie. */
export function verifyAdminSecretHeader(request: Request): Response | null {
  const { ADMIN_SECRET } = getEnv();
  if (!ADMIN_SECRET) {
    return unauthorized(msg.admin.notConfigured);
  }

  const headerSecret = request.headers.get("x-admin-secret");
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ")
    ? auth.slice("Bearer ".length).trim()
    : null;
  const provided = headerSecret ?? bearer;

  if (!provided || !secureCompare(provided, ADMIN_SECRET)) {
    return unauthorized(msg.admin.invalidSecret);
  }

  return null;
}
