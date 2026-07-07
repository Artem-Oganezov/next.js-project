import { NextResponse } from "next/server";
import { badRequest, forbidden, tooManyRequests, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { getSessionUser } from "@/lib/auth/session";
import { isScoreAsyncEnabled } from "@/lib/config/score-async";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { gamePlugin } from "@/lib/game/plugin";
import { assertCanPlay } from "@/lib/game/play-guard";
import { processScoreSubmission } from "@/lib/game/process-score";
import { GameSession } from "@/lib/models/GameSession";
import { recordSuspiciousSubmit } from "@/lib/security/anti-cheat";
import { AntiCheatReason } from "@/lib/security/anti-cheat-reasons";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { enqueueScoreJob } from "@/lib/queue/score-queue";
import { scoreBodySchema } from "@/lib/validation/score";
import { msg } from "@/lib/i18n/messages";

export const POST = withApiHandler(
  "game/score",
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
      `game:score:user:${sessionUser.id}`,
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

    const parsed = scoreBodySchema.safeParse(body.data);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? msg.common.invalidPayload);
    }

    const { score, sessionId, inputLog } = parsed.data;

    const inputBytes = Buffer.byteLength(JSON.stringify(inputLog ?? null), "utf8");
    if (inputBytes > gamePlugin.maxInputLogBytes) {
      return badRequest(msg.game.inputLogTooLarge);
    }

    if (isScoreAsyncEnabled()) {
      await connectDB();
      const gameSession = await GameSession.findOne({
        _id: sessionId,
        userId: sessionUser.id,
      });
      if (!gameSession) {
        await recordSuspiciousSubmit({
          userId: sessionUser.id,
          username: sessionUser.username,
          score,
          reason: AntiCheatReason.UNKNOWN_SESSION,
          elapsedMs: null,
        });
        return forbidden(msg.game.startFirst);
      }

      if (gameSession.scoreSubmitted) {
        return forbidden(msg.game.alreadySubmitted);
      }

      const { jobId } = await enqueueScoreJob({
        userId: sessionUser.id,
        username: sessionUser.username,
        score,
        sessionId,
        inputLog,
      });

      return NextResponse.json(
        { jobId, status: "pending" as const },
        { status: 202 },
      );
    }

    const outcome = await processScoreSubmission({
      userId: sessionUser.id,
      username: sessionUser.username,
      score,
      sessionId,
      inputLog,
    });

    if (!outcome.ok) {
      if (outcome.httpStatus === 401) {
        return unauthorized(outcome.message);
      }
      return forbidden(outcome.message);
    }

    return NextResponse.json(outcome.result);
  },
  {
    keyPrefix: "game:score",
    maxRequests: RATE_LIMIT.SCORE_MAX_REQUESTS,
    windowMs: RATE_LIMIT.SCORE_WINDOW_MS,
  },
);
