import { beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongoose";
import { resetEnvCache } from "@/lib/env";
import { GameSession } from "@/lib/models/GameSession";
import { playHonestGame } from "../helpers/replay";
import { jsonRequest, parseJsonResponse } from "../helpers/request";
import { clearTestCookies, isRedisAvailable } from "../redis.setup";

const describeRedis = isRedisAvailable() ? describe : describe.skip;

type RegisterRoute = typeof import("@/app/api/auth/register/route");
type LoginRoute = typeof import("@/app/api/auth/login/route");
type ScoreRoute = typeof import("@/app/api/game/score/route");
type ScoreStatusRoute = typeof import("@/app/api/game/score/status/[jobId]/route");
type SessionStartRoute = typeof import("@/app/api/game/session/start/route");

let registerPost: RegisterRoute["POST"];
let loginPost: LoginRoute["POST"];
let scorePost: ScoreRoute["POST"];
let scoreStatusGet: ScoreStatusRoute["GET"];
let sessionStartPost: SessionStartRoute["POST"];

const registerPayload = {
  username: "async_player",
  email: "async@example.com",
  password: "password12",
};

beforeAll(async () => {
  process.env.SCORE_ASYNC = "true";
  resetEnvCache();

  const [register, login, score, scoreStatus, sessionStart] = await Promise.all([
    import("@/app/api/auth/register/route"),
    import("@/app/api/auth/login/route"),
    import("@/app/api/game/score/route"),
    import("@/app/api/game/score/status/[jobId]/route"),
    import("@/app/api/game/session/start/route"),
  ]);
  registerPost = register.POST;
  loginPost = login.POST;
  scorePost = score.POST;
  scoreStatusGet = scoreStatus.GET;
  sessionStartPost = sessionStart.POST;
});

async function login(): Promise<void> {
  clearTestCookies();
  await registerPost(
    jsonRequest("http://localhost/api/auth/register", "POST", registerPayload),
  );
  await loginPost(
    jsonRequest("http://localhost/api/auth/login", "POST", {
      username: registerPayload.username,
      password: registerPayload.password,
    }),
  );
}

describeRedis("Async score API", () => {
  it("POST /api/game/score returns 202 and completes via worker", async () => {
    await login();

    const sessionResponse = await sessionStartPost(
      jsonRequest("http://localhost/api/game/session/start", "POST", {}),
    );
    const sessionBody = (await sessionResponse.json()) as {
      sessionId: string;
      seed: string;
    };
    const run = playHonestGame(sessionBody.seed, 40);
    await connectDB();
    await GameSession.updateOne(
      { _id: sessionBody.sessionId },
      { startedAt: new Date(Date.now() - (Math.ceil(run.ticks / 60) + 5) * 1000) },
    );

    const { drainScoreQueueOnce } = await import("@/lib/queue/score-worker");

    const submitResponse = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", {
        sessionId: sessionBody.sessionId,
        score: run.score,
        inputLog: run.jumpTicks,
      }),
    );

    expect(submitResponse.status).toBe(202);
    const accepted = (await submitResponse.json()) as { jobId: string; status: string };
    expect(accepted.status).toBe("pending");
    expect(accepted.jobId).toBeTruthy();

    const pendingStatus = await scoreStatusGet(
      jsonRequest(
        `http://localhost/api/game/score/status/${accepted.jobId}`,
        "GET",
      ),
      { params: Promise.resolve({ jobId: accepted.jobId }) },
    );
    expect(pendingStatus.status).toBe(200);
    const pendingBody = (await pendingStatus.json()) as { status: string };
    expect(["pending", "processing"]).toContain(pendingBody.status);

    const processed = await drainScoreQueueOnce();
    expect(processed).toBe(true);

    const completedStatus = await scoreStatusGet(
      jsonRequest(
        `http://localhost/api/game/score/status/${accepted.jobId}`,
        "GET",
      ),
      { params: Promise.resolve({ jobId: accepted.jobId }) },
    );
    const { status, body } = await parseJsonResponse<{
      status: string;
      bestScore: number;
      rank: number;
    }>(completedStatus);

    expect(status).toBe(200);
    expect(body.status).toBe("completed");
    expect(body.bestScore).toBeGreaterThanOrEqual(run.score);
    expect(body.rank).toBeGreaterThan(0);
  });
});
