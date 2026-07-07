import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import {
  getCachedTop10,
  setCachedTop10,
  type LeaderboardEntry,
} from "@/lib/cache/leaderboard";
import { connectDB } from "@/lib/db/mongoose";
import { gamePlugin } from "@/lib/game/plugin";
import { LEADERBOARD_ELIGIBLE_FILTER } from "@/lib/game/leaderboard-eligibility";
import { leaderboardSortDirection } from "@/lib/game/score-order";
import { User } from "@/lib/models/User";

export const GET = withApiHandler("leaderboard", async () => {
  const cached = await getCachedTop10();
  if (cached) {
    return NextResponse.json({ leaderboard: cached });
  }

  await connectDB();

  const leaderboard = (await User.find(LEADERBOARD_ELIGIBLE_FILTER)
    .sort({ bestScore: leaderboardSortDirection(gamePlugin.scoreOrder) })
    .limit(10)
    .select("username bestScore activeSkin -_id")
    .lean()) as LeaderboardEntry[];

  await setCachedTop10(leaderboard);

  return NextResponse.json({ leaderboard });
});
