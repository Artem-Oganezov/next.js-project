import { NextResponse } from "next/server";
import { badRequest, forbidden, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { getSessionUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { validateGameScore } from "@/lib/game/score-rules";
import { User } from "@/lib/models/User";
import { scoreSchema } from "@/lib/validation/score";

export const POST = withApiHandler(
  "game/score",
  async (request) => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    const body = await parseJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = scoreSchema.safeParse(body.data);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Некорректные данные");
    }

    const { score } = parsed.data;

    await connectDB();

    const user = await User.findById(sessionUser.id);
    if (!user) {
      return unauthorized();
    }

    const validation = validateGameScore(score, user.activeGameStartedAt);
    if (!validation.ok) {
      return forbidden(validation.message);
    }

    const isNewRecord = score > user.bestScore;
    if (isNewRecord) {
      user.bestScore = score;
    }

    user.activeGameStartedAt = null;
    await user.save();

    return NextResponse.json({
      bestScore: user.bestScore,
      isNewRecord,
    });
  },
  {
    keyPrefix: "game:score",
    maxRequests: RATE_LIMIT.SCORE_MAX_REQUESTS,
    windowMs: RATE_LIMIT.SCORE_WINDOW_MS,
  },
);
