import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { getSessionUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";

export const GET = withApiHandler(
  "auth/me",
  async () => {
    const user = await getSessionUser();
    if (!user) {
      return unauthorized();
    }

    return NextResponse.json({ user });
  },
  {
    keyPrefix: "auth:me",
    maxRequests: RATE_LIMIT.ME_MAX_REQUESTS,
    windowMs: RATE_LIMIT.ME_WINDOW_MS,
  },
);
