import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { getSessionUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { computeRank } from "@/lib/game/rank";
import { LEADERBOARD_ELIGIBLE_FILTER } from "@/lib/game/leaderboard-eligibility";
import { User } from "@/lib/models/User";

export const GET = withApiHandler(
  "leaderboard/rank",
  async () => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    await connectDB();

    const user = await User.findOne({
      _id: sessionUser.id,
      ...LEADERBOARD_ELIGIBLE_FILTER,
    })
      .select("username bestScore")
      .lean();

    if (!user) {
      return unauthorized();
    }

    const { rank, nextUsername } = await computeRank(user.username, user.bestScore);

    return NextResponse.json({ rank, nextUsername });
  },
  {
    keyPrefix: "leaderboard:rank",
    maxRequests: RATE_LIMIT.LEADERBOARD_MAX_REQUESTS,
    windowMs: RATE_LIMIT.LEADERBOARD_WINDOW_MS,
  },
);
