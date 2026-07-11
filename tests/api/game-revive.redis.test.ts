import { beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongoose";
import { GameSession } from "@/lib/models/GameSession";
import { playHonestGameWithRevive } from "../helpers/replay";
import { jsonRequest, parseJsonResponse } from "../helpers/request";
import { isRedisAvailable } from "../redis.setup";

type RegisterRoute = typeof import("@/app/api/auth/register/route");
type SessionStartRoute = typeof import("@/app/api/game/session/start/route");
type ReviveRoute = typeof import("@/app/api/game/revive/route");
type ReviveChallengeRoute = typeof import("@/app/api/game/revive/challenge/route");
type ScoreRoute = typeof import("@/app/api/game/score/route");

let registerPost: RegisterRoute["POST"];
let sessionStartPost: SessionStartRoute["POST"];
let revivePost: ReviveRoute["POST"];
let reviveChallengePost: ReviveChallengeRoute["POST"];
let scorePost: ScoreRoute["POST"];

beforeAll(async () => {
  const [register, sessionStart, revive, reviveChallenge, score] = await Promise.all([
    import("@/app/api/auth/register/route"),
    import("@/app/api/game/session/start/route"),
    import("@/app/api/game/revive/route"),
    import("@/app/api/game/revive/challenge/route"),
    import("@/app/api/game/score/route"),
  ]);
  registerPost = register.POST;
  sessionStartPost = sessionStart.POST;
  revivePost = revive.POST;
  reviveChallengePost = reviveChallenge.POST;
  scorePost = score.POST;
});

async function registerUser(username: string): Promise<void> {
  const response = await registerPost(
    jsonRequest("http://localhost/api/auth/register", "POST", {
      username,
      email: `${username}@example.com`,
      password: "password12",
    }),
  );
  expect(response.status).toBe(201);
}

async function startGameSession(): Promise<{ sessionId: string; seed: string }> {
  const response = await sessionStartPost(
    jsonRequest("http://localhost/api/game/session/start", "POST", {}),
  );
  expect(response.status).toBe(200);
  return (await response.json()) as { sessionId: string; seed: string };
}

async function backdateGameSession(sessionId: string, secondsAgo: number): Promise<void> {
  await connectDB();
  await GameSession.updateOne(
    { _id: sessionId },
    { startedAt: new Date(Date.now() - secondsAgo * 1000) },
  );
}

async function claimRevive(sessionId: string): Promise<Response> {
  const challengeResponse = await reviveChallengePost(
    jsonRequest("http://localhost/api/game/revive/challenge", "POST", { sessionId }),
  );
  expect(challengeResponse.status).toBe(200);

  return revivePost(
    jsonRequest("http://localhost/api/game/revive", "POST", {
      sessionId,
      challengeId: sessionId,
    }),
  );
}

describe("Game revive API", () => {
  it.skipIf(!isRedisAvailable())(
    "POST /api/game/revive marks session and score accepts revive log",
    async () => {
      await registerUser("revive_ok");
      const { sessionId, seed } = await startGameSession();
      const run = playHonestGameWithRevive(seed, 80);
      await backdateGameSession(sessionId, Math.ceil(run.ticks / 60) + 5);

      const reviveResponse = await claimRevive(sessionId);
      expect(reviveResponse.status).toBe(200);

      const scoreResponse = await scorePost(
        jsonRequest("http://localhost/api/game/score", "POST", {
          score: run.score,
          sessionId,
          inputLog: { jumpTicks: run.jumpTicks, reviveAtTick: run.reviveAtTick },
        }),
      );
      const { status, body } = await parseJsonResponse<{ bestScore: number }>(scoreResponse);
      expect(status).toBe(200);
      expect(body.bestScore).toBe(run.score);
    },
  );

  it.skipIf(!isRedisAvailable())(
    "POST /api/game/revive rejects second revive on same session",
    async () => {
      await registerUser("revive_twice");
      const { sessionId } = await startGameSession();

      const first = await claimRevive(sessionId);
      expect(first.status).toBe(200);

      const second = await revivePost(
        jsonRequest("http://localhost/api/game/revive", "POST", {
          sessionId,
          challengeId: sessionId,
        }),
      );
      expect(second.status).toBe(403);
    },
  );

  it("POST /api/game/score rejects reviveAtTick when revive was not used", async () => {
    await registerUser("revive_mismatch");
    const { sessionId, seed } = await startGameSession();
    const run = playHonestGameWithRevive(seed, 80);
    await backdateGameSession(sessionId, Math.ceil(run.ticks / 60) + 5);

    const response = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", {
        score: run.score,
        sessionId,
        inputLog: { jumpTicks: run.jumpTicks, reviveAtTick: run.reviveAtTick },
      }),
    );
    expect(response.status).toBe(403);
  });
});
