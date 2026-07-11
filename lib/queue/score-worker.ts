import {
  popScoreJobPayload,
  releaseScoreSessionLock,
  writeScoreJobRecord,
  type ScoreJobPayload,
  type ScoreJobRecord,
} from "@/lib/queue/score-queue";
import { getScoreWorkerConcurrency } from "@/lib/config/score-async";
import { processScoreSubmission } from "@/lib/game/process-score";
import {
  releaseGameSessionClaim,
  releaseGameSessionPending,
} from "@/lib/game/session-claim";

export async function runScoreJob(payload: ScoreJobPayload): Promise<void> {
  let jobRecord: ScoreJobRecord = {
    status: "pending",
    userId: payload.userId,
    sessionId: payload.sessionId,
  };

  jobRecord = {
    ...jobRecord,
    status: "processing",
    processingStartedAt: new Date().toISOString(),
  };
  await writeScoreJobRecord(payload.jobId, jobRecord);

  const outcome = await processScoreSubmission({
    userId: payload.userId,
    username: payload.username,
    score: payload.score,
    sessionId: payload.sessionId,
    inputLog: payload.inputLog,
    sessionSnapshot: {
      seed: payload.sessionSeed,
      startedAt: new Date(payload.sessionStartedAt),
      reviveUsed: payload.sessionReviveUsed,
    },
  });

  if (!outcome.ok) {
    await writeScoreJobRecord(payload.jobId, {
      ...jobRecord,
      status: "failed",
      message: outcome.message,
    });
    await releaseGameSessionPending(payload.sessionId);
    await releaseGameSessionClaim(payload.sessionId);
    await releaseScoreSessionLock(payload.sessionId);
    return;
  }

  await writeScoreJobRecord(payload.jobId, {
    ...jobRecord,
    status: "completed",
    result: outcome.result,
  });
  await releaseScoreSessionLock(payload.sessionId);
}

export async function drainScoreQueueOnce(timeoutSeconds = 1): Promise<boolean> {
  const payload = await popScoreJobPayload(timeoutSeconds);
  if (!payload) return false;
  await runScoreJob(payload);
  return true;
}

export async function runScoreWorkerLoop(signal?: AbortSignal): Promise<void> {
  const concurrency = getScoreWorkerConcurrency();
  await Promise.all(
    Array.from({ length: concurrency }, () => runSingleScoreWorkerLoop(signal)),
  );
}

async function runSingleScoreWorkerLoop(signal?: AbortSignal): Promise<void> {
  while (!signal?.aborted) {
    try {
      const payload = await popScoreJobPayload(5);
      if (!payload) continue;
      try {
        await runScoreJob(payload);
      } catch (error) {
        console.error(
          JSON.stringify({
            level: "error",
            scope: "score-worker",
            jobId: payload.jobId,
            message: error instanceof Error ? error.message : "Unknown error",
          }),
        );
        await writeScoreJobRecord(payload.jobId, {
          status: "failed",
          userId: payload.userId,
          sessionId: payload.sessionId,
          message: "Score processing failed",
        });
        await releaseGameSessionPending(payload.sessionId);
        await releaseGameSessionClaim(payload.sessionId);
        await releaseScoreSessionLock(payload.sessionId);
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          scope: "score-worker",
          message: error instanceof Error ? error.message : "Queue read failed",
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
