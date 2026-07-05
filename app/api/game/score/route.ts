import { NextResponse } from "next/server";
import { badRequest, forbidden, tooManyRequests, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { getSessionUser } from "@/lib/auth/session";
import { invalidateTop10, upsertLeaderboardScore } from "@/lib/cache/leaderboard";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { gamePlugin, type DinoInputLog } from "@/lib/game/plugin";
import { computeRank } from "@/lib/game/rank";
import { isBetterScore } from "@/lib/game/score-order";
import { GameSession } from "@/lib/models/GameSession";
import { User } from "@/lib/models/User";
import { recordSuspiciousSubmit } from "@/lib/security/anti-cheat";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { scoreBodySchema } from "@/lib/validation/score";
import { msg } from "@/lib/i18n/messages";

export const POST = withApiHandler(
  "game/score",
  async (request) => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
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

    const inputParsed = gamePlugin.parseInputLog(inputLog);
    if (!inputParsed.ok) {
      return badRequest(inputParsed.message);
    }

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
        reason: "unknown-session",
        elapsedMs: null,
      });
      return forbidden(msg.game.startFirst);
    }

    const elapsedMs = Date.now() - gameSession.startedAt.getTime();

    if (gameSession.scoreSubmitted) {
      await recordSuspiciousSubmit({
        userId: sessionUser.id,
        username: sessionUser.username,
        score,
        reason: "duplicate-submit",
        elapsedMs,
      });
      return forbidden(msg.game.alreadySubmitted);
    }

    const parsedInput = inputParsed.input as DinoInputLog;
    const hasReviveInLog = parsedInput.reviveAtTick !== undefined;
    if (hasReviveInLog !== gameSession.reviveUsed) {
      await recordSuspiciousSubmit({
        userId: sessionUser.id,
        username: sessionUser.username,
        score,
        reason: "revive-mismatch",
        elapsedMs,
      });
      return forbidden(msg.game.reviveMismatch);
    }

    const validation = gamePlugin.validateScore(score, gameSession.startedAt);
    if (!validation.ok) {
      await recordSuspiciousSubmit({
        userId: sessionUser.id,
        username: sessionUser.username,
        score,
        reason: validation.message,
        elapsedMs,
      });
      return forbidden(validation.message);
    }

    if (gamePlugin.validateReplay) {
      const replayCheck = gamePlugin.validateReplay(
        gameSession.seed,
        inputParsed.input,
        score,
      );
      if (!replayCheck.ok) {
        await recordSuspiciousSubmit({
          userId: sessionUser.id,
          username: sessionUser.username,
          score,
          reason: `replay: ${replayCheck.message}`,
          elapsedMs,
        });
        return forbidden(replayCheck.message);
      }
    }

    const claimed = await GameSession.findOneAndUpdate(
      { _id: sessionId, scoreSubmitted: false },
      { $set: { scoreSubmitted: true } },
    );
    if (!claimed) {
      await recordSuspiciousSubmit({
        userId: sessionUser.id,
        username: sessionUser.username,
        score,
        reason: "duplicate-submit-race",
        elapsedMs,
      });
      return forbidden(msg.game.alreadySubmitted);
    }

    const userBefore = await User.findById(sessionUser.id).select(
      "bestScore username",
    );
    if (!userBefore) {
      return unauthorized();
    }

    const order = gamePlugin.scoreOrder;

    const updatedUser = await User.findOneAndUpdate(
      { _id: sessionUser.id },
      [
        {
          $set: {
            totalScore: { $add: ["$totalScore", score] },
            bestScore:
              order === "desc"
                ? { $max: ["$bestScore", score] }
                : {
                    $cond: [
                      { $eq: ["$bestScore", 0] },
                      score,
                      { $min: ["$bestScore", score] },
                    ],
                  },
          },
        },
      ],
      { returnDocument: "after", updatePipeline: true },
    );
    if (!updatedUser) {
      return unauthorized();
    }

    const isNewRecord = isBetterScore(userBefore.bestScore, score, order);

    if (isNewRecord) {
      await upsertLeaderboardScore(updatedUser.username, updatedUser.bestScore, order);
      await invalidateTop10();
    }

    const { rank, nextUsername } = await computeRank(
      updatedUser.username,
      updatedUser.bestScore,
    );

    return NextResponse.json({
      bestScore: updatedUser.bestScore,
      totalScore: updatedUser.totalScore,
      isNewRecord,
      rank,
      nextUsername,
    });
  },
  {
    keyPrefix: "game:score",
    maxRequests: RATE_LIMIT.SCORE_MAX_REQUESTS,
    windowMs: RATE_LIMIT.SCORE_WINDOW_MS,
  },
);
