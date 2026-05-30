import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { getSessionUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";

export const POST = withApiHandler(
  "game/session/start",
  async () => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    await connectDB();

    const user = await User.findById(sessionUser.id);
    if (!user) {
      return unauthorized();
    }

    user.activeGameStartedAt = new Date();
    await user.save();

    return NextResponse.json({
      startedAt: user.activeGameStartedAt.toISOString(),
    });
  },
  {
    keyPrefix: "game:session",
    maxRequests: RATE_LIMIT.SCORE_MAX_REQUESTS,
    windowMs: RATE_LIMIT.SCORE_WINDOW_MS,
  },
);
