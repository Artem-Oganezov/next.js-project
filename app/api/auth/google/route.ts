import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withApiHandler } from "@/lib/api/handler";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_STATE_MAX_AGE_SEC,
  buildGoogleAuthUrl,
  generateGoogleOAuthState,
  isGoogleOAuthEnabled,
} from "@/lib/auth/google";
import { msg } from "@/lib/i18n/messages";

export const GET = withApiHandler("auth/google", async () => {
  if (!isGoogleOAuthEnabled()) {
    return NextResponse.json(
      { message: msg.auth.googleNotConfigured },
      { status: 503 },
    );
  }

  const state = generateGoogleOAuthState();
  const authUrl = buildGoogleAuthUrl(state);

  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GOOGLE_OAUTH_STATE_MAX_AGE_SEC,
  });

  return NextResponse.redirect(authUrl);
});
