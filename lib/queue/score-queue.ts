import { randomUUID } from "crypto";
import type { ScoreSubmitResult } from "@/lib/game/process-score";
import { getRedis } from "@/lib/redis";

export const SCORE_QUEUE_KEY = "score:queue";
const SCORE_JOB_PREFIX = "score:job:";
const SCORE_SESSION_PREFIX = "score:session:";

export const SCORE_JOB_TTL_SEC = 86_400;
const SCORE_SESSION_LOCK_TTL_SEC = 3_600;

export type ScoreJobStatus = "pending" | "processing" | "completed" | "failed";

export type ScoreJobPayload = {
  jobId: string;
  userId: string;
  username: string;
  score: number;
  sessionId: string;
  inputLog: unknown;
  enqueuedAt: string;
};

export type ScoreJobRecord = {
  status: ScoreJobStatus;
  userId: string;
  sessionId: string;
  message?: string;
  result?: ScoreSubmitResult;
};

function jobKey(jobId: string): string {
  return `${SCORE_JOB_PREFIX}${jobId}`;
}

function sessionKey(sessionId: string): string {
  return `${SCORE_SESSION_PREFIX}${sessionId}`;
}

export async function getScoreJob(jobId: string): Promise<ScoreJobRecord | null> {
  const raw = await getRedis().get(jobKey(jobId));
  if (!raw) return null;
  return JSON.parse(raw) as ScoreJobRecord;
}

export async function getScoreJobIdForSession(
  sessionId: string,
): Promise<string | null> {
  return getRedis().get(sessionKey(sessionId));
}

export async function enqueueScoreJob(
  payload: Omit<ScoreJobPayload, "jobId" | "enqueuedAt">,
): Promise<{ jobId: string; created: boolean }> {
  const redis = getRedis();
  const existingJobId = await redis.get(sessionKey(payload.sessionId));
  if (existingJobId) {
    return { jobId: existingJobId, created: false };
  }

  const jobId = randomUUID();
  const locked = await redis.setNx(
    sessionKey(payload.sessionId),
    jobId,
    SCORE_SESSION_LOCK_TTL_SEC,
  );
  if (!locked) {
    const racedJobId = await redis.get(sessionKey(payload.sessionId));
    if (racedJobId) {
      return { jobId: racedJobId, created: false };
    }
    throw new Error("Score session lock race without job id");
  }

  const job: ScoreJobPayload = {
    ...payload,
    jobId,
    enqueuedAt: new Date().toISOString(),
  };

  const record: ScoreJobRecord = {
    status: "pending",
    userId: payload.userId,
    sessionId: payload.sessionId,
  };

  await redis.setEx(jobKey(jobId), JSON.stringify(record), SCORE_JOB_TTL_SEC);
  await redis.lpush(SCORE_QUEUE_KEY, JSON.stringify(job));

  return { jobId, created: true };
}

export async function updateScoreJob(
  jobId: string,
  patch: Partial<ScoreJobRecord> & { status: ScoreJobStatus },
): Promise<void> {
  const redis = getRedis();
  const existing = await getScoreJob(jobId);
  if (!existing) return;

  const next: ScoreJobRecord = { ...existing, ...patch };
  await redis.setEx(jobKey(jobId), JSON.stringify(next), SCORE_JOB_TTL_SEC);
}

export async function releaseScoreSessionLock(sessionId: string): Promise<void> {
  await getRedis().del(sessionKey(sessionId));
}

export async function popScoreJobPayload(
  timeoutSeconds: number,
): Promise<ScoreJobPayload | null> {
  const raw = await getRedis().brpop(SCORE_QUEUE_KEY, timeoutSeconds);
  if (!raw) return null;
  return JSON.parse(raw) as ScoreJobPayload;
}
