import {
  popScoreJobPayload,
  releaseScoreSessionLock,
  updateScoreJob,
  type ScoreJobPayload,
} from "@/lib/queue/score-queue";
import { processScoreSubmission } from "@/lib/game/process-score";

export async function runScoreJob(payload: ScoreJobPayload): Promise<void> {
  await updateScoreJob(payload.jobId, { status: "processing" });

  const outcome = await processScoreSubmission({
    userId: payload.userId,
    username: payload.username,
    score: payload.score,
    sessionId: payload.sessionId,
    inputLog: payload.inputLog,
  });

  if (!outcome.ok) {
    await updateScoreJob(payload.jobId, {
      status: "failed",
      message: outcome.message,
    });
    await releaseScoreSessionLock(payload.sessionId);
    return;
  }

  await updateScoreJob(payload.jobId, {
    status: "completed",
    result: outcome.result,
  });
  await releaseScoreSessionLock(payload.sessionId);
}

export async function drainScoreQueueOnce(): Promise<boolean> {
  const payload = await popScoreJobPayload(1);
  if (!payload) return false;
  await runScoreJob(payload);
  return true;
}

export async function runScoreWorkerLoop(signal?: AbortSignal): Promise<void> {
  while (!signal?.aborted) {
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
      await updateScoreJob(payload.jobId, {
        status: "failed",
        message: "Score processing failed",
      });
      await releaseScoreSessionLock(payload.sessionId);
    }
  }
}
