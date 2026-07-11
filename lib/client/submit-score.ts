import { ApiError } from "@/lib/client/api-error";

export type ScoreSubmitResult = {
  bestScore: number;
  totalScore: number;
  isNewRecord: boolean;
  rank: number;
  nextUsername: string | null;
};

const SCORE_POLL_MAX_ATTEMPTS = 120;

/** Backoff polling: fast first checks, then wider gaps to cut HTTP load under queue pressure. */
export function scorePollDelayMs(attempt: number): number {
  if (attempt <= 1) return 500;
  if (attempt <= 3) return 800;
  if (attempt <= 6) return 1200;
  return 1500;
}

async function pollScoreJob(jobId: string): Promise<ScoreSubmitResult> {
  for (let attempt = 0; attempt < SCORE_POLL_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, scorePollDelayMs(attempt)));
    }

    const response = await fetch(`/api/game/score/status/${jobId}`, {
      credentials: "include",
    });
    const data = (await response.json()) as ScoreSubmitResult & {
      status?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new ApiError(response.status, data.message ?? "Request failed");
    }

    if (data.status === "completed") {
      return {
        bestScore: data.bestScore,
        totalScore: data.totalScore,
        isNewRecord: data.isNewRecord,
        rank: data.rank,
        nextUsername: data.nextUsername,
      };
    }

    if (data.status === "failed") {
      throw new ApiError(403, data.message ?? "Score could not be saved");
    }
  }

  throw new ApiError(408, "Score save timed out");
}

export async function submitGameScore(
  score: number,
  sessionId: string,
  inputLog: unknown,
  onSaving?: (saving: boolean) => void,
): Promise<ScoreSubmitResult> {
  onSaving?.(true);
  try {
    const response = await fetch("/api/game/score", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, sessionId, inputLog }),
    });

    const data = (await response.json()) as ScoreSubmitResult & {
      jobId?: string;
      status?: string;
      message?: string;
    };

    if (response.status === 202 && data.jobId) {
      return await pollScoreJob(data.jobId);
    }

    if (!response.ok) {
      throw new ApiError(response.status, data.message ?? "Request failed");
    }

    return data;
  } finally {
    onSaving?.(false);
  }
}
