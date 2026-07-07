import { beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongoose";
import { GameSession } from "@/lib/models/GameSession";
import { playHonestGame } from "../helpers/replay";
import { jsonRequest, parseJsonResponse } from "../helpers/request";

type RegisterRoute = typeof import("@/app/api/auth/register/route");
type LoginRoute = typeof import("@/app/api/auth/login/route");
type MeRoute = typeof import("@/app/api/auth/me/route");
type ScoreRoute = typeof import("@/app/api/game/score/route");
type SessionStartRoute = typeof import("@/app/api/game/session/start/route");

let registerPost: RegisterRoute["POST"];
let loginPost: LoginRoute["POST"];
let meGet: MeRoute["GET"];
let scorePost: ScoreRoute["POST"];
let sessionStartPost: SessionStartRoute["POST"];

beforeAll(async () => {
  const [register, login, me, score, sessionStart] = await Promise.all([
    import("@/app/api/auth/register/route"),
    import("@/app/api/auth/login/route"),
    import("@/app/api/auth/me/route"),
    import("@/app/api/game/score/route"),
    import("@/app/api/game/session/start/route"),
  ]);
  registerPost = register.POST;
  loginPost = login.POST;
  meGet = me.GET;
  scorePost = score.POST;
  sessionStartPost = sessionStart.POST;
});

async function startGameSession(): Promise<{
  sessionId: string;
  seed: string;
}> {
  const response = await sessionStartPost(
    jsonRequest("http://localhost/api/game/session/start", "POST", {}),
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { sessionId: string; seed: string };
  expect(body.seed).toBeTruthy();
  return body;
}

async function backdateGameSession(
  sessionId: string,
  secondsAgo: number,
): Promise<void> {
  await connectDB();
  await GameSession.updateOne(
    { _id: sessionId },
    { startedAt: new Date(Date.now() - secondsAgo * 1000) },
  );
}

/**
 * Fair run: start session, autoplay to targetScore,
 * backdate startedAt to the actual run duration.
 * Returns data for a valid submit.
 */
async function playAndBackdate(targetScore: number): Promise<{
  sessionId: string;
  score: number;
  inputLog: number[];
}> {
  const { sessionId, seed } = await startGameSession();
  const run = playHonestGame(seed, targetScore);
  await backdateGameSession(sessionId, Math.ceil(run.ticks / 60) + 5);
  return { sessionId, score: run.score, inputLog: run.jumpTicks };
}

const registerPayload = {
  username: "test_player",
  email: "test@example.com",
  password: "password12",
};

describe("Auth API", () => {
  it("POST /api/auth/register creates user and returns 201", async () => {
    const response = await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", registerPayload),
    );
    const { status, body } = await parseJsonResponse<{
      user: { username: string; email: string; bestScore: number };
    }>(response);

    expect(status).toBe(201);
    expect(body.user.username).toBe(registerPayload.username);
    expect(body.user.email).toBe(registerPayload.email);
    expect(body.user.bestScore).toBe(0);
  });

  it("POST /api/auth/register rejects duplicate user with 409", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", registerPayload),
    );

    const response = await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", registerPayload),
    );
    const { status, body } = await parseJsonResponse<{ message: string }>(response);

    expect(status).toBe(409);
    expect(body.message).toMatch(/already taken/i);
  });

  it("POST /api/auth/register rejects invalid payload with 400", async () => {
    const response = await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "x",
        email: "bad",
        password: "short",
      }),
    );
    const { status } = await parseJsonResponse<{ message: string }>(response);
    expect(status).toBe(400);
  });

  it("GET /api/auth/me returns 401 without session", async () => {
    const response = await meGet();
    const { status } = await parseJsonResponse<{ message: string }>(response);
    expect(status).toBe(401);
  });

  it("GET /api/auth/me returns user after register", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "session_user",
        email: "session@example.com",
        password: "password12",
      }),
    );

    const response = await meGet();
    const { status, body } = await parseJsonResponse<{
      user: { username: string; email: string };
    }>(response);

    expect(status).toBe(200);
    expect(body.user.username).toBe("session_user");
    expect(body.user.email).toBe("session@example.com");
  });

  it("POST /api/auth/login rejects wrong password with 401", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "login_user",
        email: "login@example.com",
        password: "password12",
      }),
    );

    const response = await loginPost(
      jsonRequest("http://localhost/api/auth/login", "POST", {
        username: "login_user",
        password: "wrong-password",
      }),
    );
    const { status } = await parseJsonResponse<{ message: string }>(response);
    expect(status).toBe(401);
  });

  it("POST /api/auth/login succeeds with valid credentials", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "valid_login",
        email: "valid@example.com",
        password: "password12",
      }),
    );

    const response = await loginPost(
      jsonRequest("http://localhost/api/auth/login", "POST", {
        username: "valid_login",
        password: "password12",
      }),
    );
    const { status, body } = await parseJsonResponse<{
      user: { username: string };
    }>(response);

    expect(status).toBe(200);
    expect(body.user.username).toBe("valid_login");
  });
});

describe("Game score API", () => {
  it("POST /api/game/score returns 401 without session", async () => {
    const response = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", {
        score: 10,
        sessionId: "0".repeat(24),
      }),
    );
    const { status } = await parseJsonResponse<{ message: string }>(response);
    expect(status).toBe(401);
  });

  it("POST /api/game/score returns 403 for unknown game session", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "no_game_session",
        email: "no_game@example.com",
        password: "password12",
      }),
    );

    const response = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", {
        score: 5,
        sessionId: "0".repeat(24),
      }),
    );
    const { status, body } = await parseJsonResponse<{ message: string }>(response);
    expect(status).toBe(403);
    expect(body.message).toMatch(/start a game/i);
  });

  it("POST /api/game/score returns 400 without sessionId", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "no_session_id",
        email: "no_session_id@example.com",
        password: "password12",
      }),
    );

    const response = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", { score: 5 }),
    );
    const { status } = await parseJsonResponse<{ message: string }>(response);
    expect(status).toBe(400);
  });

  it("POST /api/game/score rejects cheat score with 403", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "cheater",
        email: "cheater@example.com",
        password: "password12",
      }),
    );
    const { sessionId, seed } = await startGameSession();
    const run = playHonestGame(seed, 50);
    await backdateGameSession(sessionId, 1);

    const response = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", {
        score: run.score,
        sessionId,
        inputLog: run.jumpTicks,
      }),
    );
    const { status, body } = await parseJsonResponse<{ message: string }>(response);
    expect(status).toBe(403);
    expect(body.message).toMatch(/too high/i);
  });

  it("POST /api/game/score rejects plausible score with fake replay log", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "replay_cheater",
        email: "replay_cheater@example.com",
        password: "password12",
      }),
    );
    const { sessionId } = await startGameSession();
    await backdateGameSession(sessionId, 30);

    // 100 points pass the heuristic (18/sec × 30s), but replay from seed
    // with an empty jump log yields a different score.
    const response = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", {
        score: 100,
        sessionId,
        inputLog: [],
      }),
    );
    const { status, body } = await parseJsonResponse<{ message: string }>(response);
    expect(status).toBe(403);
    expect(body.message).toMatch(/does not match/i);
  });

  it("POST /api/game/score rejects score above ceiling for elapsed time", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "speedrunner",
        email: "speedrunner@example.com",
        password: "password12",
      }),
    );
    const { sessionId, seed } = await startGameSession();
    const run = playHonestGame(seed, 0);

    const response = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", {
        score: run.score,
        sessionId,
        inputLog: run.jumpTicks,
      }),
    );
    const { status, body } = await parseJsonResponse<{ message: string }>(response);
    expect(status).toBe(403);
    expect(body.message).toMatch(/too high/i);
  });

  it("POST /api/game/score rejects duplicate submit for same session", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "replayer",
        email: "replayer@example.com",
        password: "password12",
      }),
    );
    const run = await playAndBackdate(30);

    const first = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", run),
    );
    expect(first.status).toBe(200);

    const second = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", run),
    );
    const { status, body } = await parseJsonResponse<{ message: string }>(second);
    expect(status).toBe(403);
    expect(body.message).toMatch(/already submitted/i);
  });

  it("POST /api/game/score updates best score when authenticated", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "scorer",
        email: "scorer@example.com",
        password: "password12",
      }),
    );

    // Run 1: record (~50+).
    const runA = await playAndBackdate(50);
    const first = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", runA),
    );
    const firstBody = await parseJsonResponse<{
      bestScore: number;
      totalScore: number;
      isNewRecord: boolean;
    }>(first);
    expect(firstBody.status).toBe(200);
    expect(firstBody.body.bestScore).toBe(runA.score);
    expect(firstBody.body.totalScore).toBe(runA.score);
    expect(firstBody.body.isNewRecord).toBe(true);

    // Run 2: no jumps — death on the first cactus, score is intentionally
    // below run 1 (< 50): record is not updated.
    const runB = await playAndBackdate(0);
    expect(runB.score).toBeLessThan(runA.score);
    const second = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", runB),
    );
    const secondBody = await parseJsonResponse<{
      bestScore: number;
      totalScore: number;
      isNewRecord: boolean;
    }>(second);
    expect(secondBody.status).toBe(200);
    expect(secondBody.body.bestScore).toBe(runA.score);
    expect(secondBody.body.totalScore).toBe(runA.score + runB.score);
    expect(secondBody.body.isNewRecord).toBe(false);

    // Run 3: new record (~120+ > run 1).
    const runC = await playAndBackdate(120);
    expect(runC.score).toBeGreaterThan(runA.score);
    const third = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", runC),
    );
    const thirdBody = await parseJsonResponse<{
      bestScore: number;
      totalScore: number;
      isNewRecord: boolean;
    }>(third);
    expect(thirdBody.status).toBe(200);
    expect(thirdBody.body.bestScore).toBe(runC.score);
    expect(thirdBody.body.totalScore).toBe(runA.score + runB.score + runC.score);
    expect(thirdBody.body.isNewRecord).toBe(true);

    const meResponse = await meGet(new Request("http://localhost/api/auth/me"));
    const meBody = await parseJsonResponse<{
      user: { bestScore: number; totalScore: number };
    }>(meResponse);
    expect(meBody.status).toBe(200);
    expect(meBody.body.user.bestScore).toBe(runC.score);
    expect(meBody.body.user.totalScore).toBe(runA.score + runB.score + runC.score);
  });

  it("GET /api/auth/me reflects fresh scores after each submit (session cache)", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "cache_sync",
        email: "cache_sync@example.com",
        password: "password12",
      }),
    );

    const runA = await playAndBackdate(50);
    const first = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", runA),
    );
    expect(first.status).toBe(200);

    const meAfterFirst = await meGet(new Request("http://localhost/api/auth/me"));
    const afterFirstBody = await parseJsonResponse<{
      user: { bestScore: number; totalScore: number };
    }>(meAfterFirst);
    expect(afterFirstBody.body.user.bestScore).toBe(runA.score);
    expect(afterFirstBody.body.user.totalScore).toBe(runA.score);

    const runB = await playAndBackdate(120);
    const second = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", runB),
    );
    expect(second.status).toBe(200);

    const meAfterSecond = await meGet(new Request("http://localhost/api/auth/me"));
    const afterSecondBody = await parseJsonResponse<{
      user: { bestScore: number; totalScore: number };
    }>(meAfterSecond);
    expect(afterSecondBody.body.user.bestScore).toBe(runB.score);
    expect(afterSecondBody.body.user.totalScore).toBe(runA.score + runB.score);
  });
});
