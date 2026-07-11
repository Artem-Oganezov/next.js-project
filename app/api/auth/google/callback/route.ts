import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GoogleOAuthError,
  fetchGoogleProfileFromCode,
  googleOAuthErrorRedirectPath,
  isGoogleOAuthEnabled,
  signInWithGoogleProfile,
} from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";

function redirectHome(request: Request, path = "/"): NextResponse {
  const { APP_URL } = getEnv();
  const base = APP_URL ?? new URL("/", request.url).origin;
  return NextResponse.redirect(new URL(path, base));
}

export async function GET(request: Request) {
  if (!isGoogleOAuthEnabled()) {
    return redirectHome(request, googleOAuthErrorRedirectPath("not_configured"));
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return redirectHome(request, googleOAuthErrorRedirectPath("token_exchange_failed"));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return redirectHome(request, googleOAuthErrorRedirectPath("invalid_state"));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE);

  if (!expectedState || expectedState !== state) {
    return redirectHome(request, googleOAuthErrorRedirectPath("invalid_state"));
  }

  try {
    const profile = await fetchGoogleProfileFromCode(code);
    const user = await signInWithGoogleProfile(profile);
    await createSession(user._id);
    return redirectHome(request, "/");
  } catch (err) {
    if (err instanceof GoogleOAuthError) {
      return redirectHome(request, googleOAuthErrorRedirectPath(err.code));
    }
    console.error(
      JSON.stringify({
        level: "error",
        scope: "auth/google/callback",
        message: err instanceof Error ? err.message : "unknown",
      }),
    );
    return redirectHome(request, googleOAuthErrorRedirectPath("token_exchange_failed"));
  }
}
