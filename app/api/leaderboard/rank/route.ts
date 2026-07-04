import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { getSessionUser } from "@/lib/auth/session";
import { computeRank } from "@/lib/game/rank";

export const GET = withApiHandler("leaderboard/rank", async () => {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return unauthorized();
  }

  const { rank, nextUsername } = await computeRank(
    sessionUser.username,
    sessionUser.bestScore,
  );

  return NextResponse.json({ rank, nextUsername });
});
