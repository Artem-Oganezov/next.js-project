import { syncSessionCacheForUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { invalidateTop10, upsertLeaderboardScore } from "@/lib/cache/leaderboard";
import { gamePlugin, type DinoInputLog } from "@/lib/game/plugin";
import { computeRank } from "@/lib/game/rank";
import { isBetterScore } from "@/lib/game/score-order";
import { GameSession } from "@/lib/models/GameSession";
import { User } from "@/lib/models/User";
import { recordSuspiciousSubmit } from "@/lib/security/anti-cheat";
import { AntiCheatReason } from "@/lib/security/anti-cheat-reasons";
import { msg } from "@/lib/i18n/messages";

export type ScoreSubmitResult = {
  bestScore: number;
  totalScore: number;
  isNewRecord: boolean;
  rank: number;
  nextUsername: string | null;
};

export type ProcessScoreFailure = {
  ok: false;
  httpStatus: 401 | 403;
  message: string;
  reason: string;
};

export type ProcessScoreSuccess = {
  ok: true;
  result: ScoreSubmitResult;
};

export type ProcessScoreOutcome = ProcessScoreSuccess | ProcessScoreFailure;

export type ProcessScoreInput = {
  userId: string;
  username: string;
  score: number;
  sessionId: string;
  inputLog: unknown;
};

/**
 * Full score pipeline: replay validation, session claim, user + leaderboard update.
 * Used by sync POST /api/game/score and the async score worker.
 */
export async function processScoreSubmission(
  input: ProcessScoreInput,
): Promise<ProcessScoreOutcome> {
  const { userId, username, score, sessionId, inputLog } = input;

  const inputParsed = gamePlugin.parseInputLog(inputLog);
  if (!inputParsed.ok) {
    return {
      ok: false,
      httpStatus: 403,
      message: inputParsed.message,
      reason: AntiCheatReason.REPLAY_FAILED,
    };
  }

  await connectDB();

  const gameSession = await GameSession.findOne({
    _id: sessionId,
    userId,
  });
  if (!gameSession) {
    await recordSuspiciousSubmit({
      userId,
      username,
      score,
      reason: AntiCheatReason.UNKNOWN_SESSION,
      elapsedMs: null,
    });
    return {
      ok: false,
      httpStatus: 403,
      message: msg.game.startFirst,
      reason: AntiCheatReason.UNKNOWN_SESSION,
    };
  }

  const elapsedMs = Date.now() - gameSession.startedAt.getTime();

  if (gameSession.scoreSubmitted) {
    await recordSuspiciousSubmit({
      userId,
      username,
      score,
      reason: AntiCheatReason.DUPLICATE_SUBMIT,
      elapsedMs,
    });
    return {
      ok: false,
      httpStatus: 403,
      message: msg.game.alreadySubmitted,
      reason: AntiCheatReason.DUPLICATE_SUBMIT,
    };
  }

  const parsedInput = inputParsed.input as DinoInputLog;
  const hasReviveInLog = parsedInput.reviveAtTick !== undefined;
  if (hasReviveInLog !== gameSession.reviveUsed) {
    await recordSuspiciousSubmit({
      userId,
      username,
      score,
      reason: AntiCheatReason.REVIVE_MISMATCH,
      elapsedMs,
    });
    return {
      ok: false,
      httpStatus: 403,
      message: msg.game.reviveMismatch,
      reason: AntiCheatReason.REVIVE_MISMATCH,
    };
  }

  let replayTicks: number | undefined;
  if (gamePlugin.validateReplay) {
    const replayCheck = gamePlugin.validateReplay(
      gameSession.seed,
      inputParsed.input,
      score,
    );
    if (!replayCheck.ok) {
      await recordSuspiciousSubmit({
        userId,
        username,
        score,
        reason: replayCheck.code,
        elapsedMs,
      });
      return {
        ok: false,
        httpStatus: 403,
        message: replayCheck.message,
        reason: replayCheck.code,
      };
    }
    replayTicks = replayCheck.ticks;
  }

  const validation = gamePlugin.validateScore(score, gameSession.startedAt, undefined, {
    replayTicks,
  });
  if (!validation.ok) {
    await recordSuspiciousSubmit({
      userId,
      username,
      score,
      reason: validation.code,
      elapsedMs,
    });
    return {
      ok: false,
      httpStatus: 403,
      message: validation.message,
      reason: validation.code,
    };
  }

  const claimed = await GameSession.findOneAndUpdate(
    { _id: sessionId, scoreSubmitted: false },
    { $set: { scoreSubmitted: true } },
  );
  if (!claimed) {
    await recordSuspiciousSubmit({
      userId,
      username,
      score,
      reason: AntiCheatReason.DUPLICATE_SUBMIT_RACE,
      elapsedMs,
    });
    return {
      ok: false,
      httpStatus: 403,
      message: msg.game.alreadySubmitted,
      reason: AntiCheatReason.DUPLICATE_SUBMIT_RACE,
    };
  }

  const userBefore = await User.findById(userId).select("bestScore username");
  if (!userBefore) {
    return {
      ok: false,
      httpStatus: 401,
      message: msg.common.unauthorized,
      reason: AntiCheatReason.UNKNOWN_SESSION,
    };
  }

  const order = gamePlugin.scoreOrder;

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId },
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
    return {
      ok: false,
      httpStatus: 401,
      message: msg.common.unauthorized,
      reason: AntiCheatReason.UNKNOWN_SESSION,
    };
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

  await syncSessionCacheForUser(userId);

  return {
    ok: true,
    result: {
      bestScore: updatedUser.bestScore,
      totalScore: updatedUser.totalScore,
      isNewRecord,
      rank,
      nextUsername,
    },
  };
}
