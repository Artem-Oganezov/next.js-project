import { NextResponse } from "next/server";
import { badRequest, forbidden, tooManyRequests, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { getSessionUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { assertCanPlay } from "@/lib/game/play-guard";
import { issueReviveChallenge } from "@/lib/game/revive-challenge";
import { GameSession } from "@/lib/models/GameSession";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { reviveChallengeBodySchema } from "@/lib/validation/revive";
import { msg } from "@/lib/i18n/messages";

export const POST = withApiHandler(
  "game/revive/challenge",
  async (request) => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    const playGuard = assertCanPlay(sessionUser);
    if (!playGuard.ok) {
      return forbidden(playGuard.message);
    }

    const userLimit = await enforceRateLimit(
      `game:revive:challenge:user:${sessionUser.id}`,
      RATE_LIMIT.SCORE_MAX_REQUESTS,
      RATE_LIMIT.SCORE_WINDOW_MS,
    );
    if (!userLimit.ok) {
      return tooManyRequests(msg.game.tooManyRequests);
    }

    const body = await parseJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = reviveChallengeBodySchema.safeParse(body.data);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? msg.common.invalidPayload);
    }

    const { sessionId } = parsed.data;

    await connectDB();

    const gameSession = await GameSession.findOne({
      _id: sessionId,
      userId: sessionUser.id,
      scoreSubmitted: false,
      reviveUsed: false,
      submitPending: { $ne: true },
    });

    if (!gameSession) {
      return forbidden(msg.game.reviveUnavailable);
    }

    const challenge = await issueReviveChallenge(sessionId);
    if (!challenge.ok) {
      return forbidden(msg.game.reviveUnavailable);
    }

    return NextResponse.json({
      challengeId: sessionId,
      minWaitMs: challenge.minWaitMs,
    });
  },
  {
    keyPrefix: "game:revive:challenge",
    maxRequests: RATE_LIMIT.SCORE_MAX_REQUESTS,
    windowMs: RATE_LIMIT.SCORE_WINDOW_MS,
  },
);
