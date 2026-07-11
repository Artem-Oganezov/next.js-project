import { NextResponse } from "next/server";
import { badRequest, forbidden, tooManyRequests, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { getSessionUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { assertCanPlay } from "@/lib/game/play-guard";
import { peekReviveChallenge, clearReviveChallenge } from "@/lib/game/revive-challenge";
import { GameSession } from "@/lib/models/GameSession";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { reviveBodySchema } from "@/lib/validation/revive";
import { msg } from "@/lib/i18n/messages";

export const POST = withApiHandler(
  "game/revive",
  async (request) => {
    const body = await parseJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = reviveBodySchema.safeParse(body.data);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? msg.common.invalidPayload);
    }

    const { sessionId, challengeId } = parsed.data;

    if (challengeId !== sessionId) {
      return forbidden(msg.game.reviveChallengeRequired);
    }

    const challenge = await peekReviveChallenge(sessionId);
    if (!challenge.ok) {
      if (challenge.code === "too-early") {
        return forbidden(msg.game.reviveChallengeTooEarly);
      }
      return forbidden(msg.game.reviveChallengeRequired);
    }

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    const playGuard = assertCanPlay(sessionUser);
    if (!playGuard.ok) {
      return forbidden(playGuard.message);
    }

    const userLimit = await enforceRateLimit(
      `game:revive:user:${sessionUser.id}`,
      RATE_LIMIT.SCORE_MAX_REQUESTS,
      RATE_LIMIT.SCORE_WINDOW_MS,
    );
    if (!userLimit.ok) {
      return tooManyRequests(msg.game.tooManyRequests);
    }

    await connectDB();

    const claimed = await GameSession.findOneAndUpdate(
      {
        _id: sessionId,
        userId: sessionUser.id,
        scoreSubmitted: false,
        reviveUsed: false,
        submitPending: { $ne: true },
      },
      { $set: { reviveUsed: true } },
    );

    if (!claimed) {
      const existing = await GameSession.findOne({
        _id: sessionId,
        userId: sessionUser.id,
      });
      if (!existing) {
        return forbidden(msg.game.startFirst);
      }
      if (existing.scoreSubmitted) {
        return forbidden(msg.game.alreadySubmitted);
      }
      return forbidden(msg.game.reviveUnavailable);
    }

    await clearReviveChallenge(sessionId);

    return NextResponse.json({ ok: true });
  },
  {
    keyPrefix: "game:revive",
    maxRequests: RATE_LIMIT.SCORE_MAX_REQUESTS,
    windowMs: RATE_LIMIT.SCORE_WINDOW_MS,
  },
);
