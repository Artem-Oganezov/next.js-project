import { NextResponse } from "next/server";
import { badRequest, forbidden, tooManyRequests, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { getSessionUser } from "@/lib/auth/session";
import { invalidateTop10, upsertLeaderboardScore } from "@/lib/cache/leaderboard";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { gamePlugin } from "@/lib/game/plugin";
import { computeRank } from "@/lib/game/rank";
import { GameSession } from "@/lib/models/GameSession";
import { User } from "@/lib/models/User";
import { recordSuspiciousSubmit } from "@/lib/security/anti-cheat";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { scoreSchema } from "@/lib/validation/score";

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
      return tooManyRequests("Слишком много запросов");
    }

    const body = await parseJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = scoreSchema.safeParse(body.data);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Некорректные данные");
    }

    const { score, sessionId, jumpTicks } = parsed.data;

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
      return forbidden("Сначала начните игру");
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
      return forbidden("Результат этой партии уже засчитан");
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
        jumpTicks ?? [],
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
      return forbidden("Результат этой партии уже засчитан");
    }

    const user = await User.findById(sessionUser.id);
    if (!user) {
      return unauthorized();
    }

    const isNewRecord = score > user.bestScore;
    if (isNewRecord) {
      user.bestScore = score;
    }

    user.totalScore += score;
    await user.save();

    if (isNewRecord) {
      await upsertLeaderboardScore(user.username, user.bestScore);
      await invalidateTop10();
    }

    const { rank, nextUsername } = await computeRank(user.username, user.bestScore);

    return NextResponse.json({
      bestScore: user.bestScore,
      totalScore: user.totalScore,
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
