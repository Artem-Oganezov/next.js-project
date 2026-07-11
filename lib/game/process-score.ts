import { syncSessionCacheForUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { invalidateTop10, upsertLeaderboardScore } from "@/lib/cache/leaderboard";
import { gamePlugin, type DinoInputLog } from "@/lib/game/plugin";
import { computeRank } from "@/lib/game/rank";
import { releaseGameSessionClaim } from "@/lib/game/session-claim";
import { type ScoreOrder } from "@/lib/game/score-order";
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
  /** From async job enqueue — avoids GameSession.findOne in worker. */
  sessionSnapshot?: {
    seed: string;
    startedAt: Date;
    reviveUsed: boolean;
  };
};

function scoreBecameNewBest(
  order: ScoreOrder,
  newBest: number,
  submittedScore: number,
): boolean {
  return order === "desc"
    ? newBest === submittedScore && submittedScore > 0
    : newBest === submittedScore;
}

function buildUserScoreUpdatePipeline(score: number, order: ScoreOrder) {
  return [
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
  ];
}

/**
 * Full score pipeline: replay validation, session claim, user + leaderboard update.
 * Used by sync POST /api/game/score and the async score worker.
 */
export async function processScoreSubmission(
  input: ProcessScoreInput,
): Promise<ProcessScoreOutcome> {
  const { userId, username, score, sessionId, inputLog, sessionSnapshot } = input;

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

  let sessionSeed: string;
  let sessionStartedAt: Date;
  let sessionReviveUsed: boolean;

  if (sessionSnapshot) {
    sessionSeed = sessionSnapshot.seed;
    sessionStartedAt = sessionSnapshot.startedAt;
    sessionReviveUsed = sessionSnapshot.reviveUsed;
  } else {
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

    if (gameSession.scoreSubmitted || gameSession.submitPending) {
      const elapsedMs = Date.now() - gameSession.startedAt.getTime();
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

    sessionSeed = gameSession.seed;
    sessionStartedAt = gameSession.startedAt;
    sessionReviveUsed = gameSession.reviveUsed;
  }

  const elapsedMs = Date.now() - sessionStartedAt.getTime();

  const parsedInput = inputParsed.input as DinoInputLog;
  const hasReviveInLog = parsedInput.reviveAtTick !== undefined;
  if (hasReviveInLog !== sessionReviveUsed) {
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
      sessionSeed,
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

  const validation = gamePlugin.validateScore(score, sessionStartedAt, undefined, {
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

  const claimFilter = sessionSnapshot
    ? { _id: sessionId, scoreSubmitted: false, submitPending: true }
    : { _id: sessionId, scoreSubmitted: false };

  const claimed = await GameSession.findOneAndUpdate(claimFilter, {
    $set: { scoreSubmitted: true, submitPending: false },
  });
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

  try {
    const order = gamePlugin.scoreOrder;

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      buildUserScoreUpdatePipeline(score, order),
      { returnDocument: "after", updatePipeline: true },
    );
    if (!updatedUser) {
      await releaseGameSessionClaim(sessionId);
      return {
        ok: false,
        httpStatus: 401,
        message: msg.common.unauthorized,
        reason: AntiCheatReason.UNKNOWN_SESSION,
      };
    }

    const isNewRecord = scoreBecameNewBest(order, updatedUser.bestScore, score);

    if (isNewRecord) {
      await upsertLeaderboardScore(updatedUser.username, updatedUser.bestScore, order);
      await invalidateTop10();
    }

    const { rank, nextUsername } = await computeRank(
      updatedUser.username,
      updatedUser.bestScore,
    );

    void syncSessionCacheForUser(userId).catch(() => {
      // Best-effort; score result is already persisted and returned to the client.
    });

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
  } catch (error) {
    await releaseGameSessionClaim(sessionId);
    throw error;
  }
}
