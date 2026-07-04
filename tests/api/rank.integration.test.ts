import { beforeAll, describe, expect, it } from "vitest";
import { connectDB } from "@/lib/db/mongoose";
import { GameSession } from "@/lib/models/GameSession";
import { User } from "@/lib/models/User";
import { playHonestGame } from "../helpers/replay";
import { jsonRequest, parseJsonResponse } from "../helpers/request";

type RegisterRoute = typeof import("@/app/api/auth/register/route");
type ScoreRoute = typeof import("@/app/api/game/score/route");
type SessionStartRoute = typeof import("@/app/api/game/session/start/route");
type RankRoute = typeof import("@/app/api/leaderboard/rank/route");
type LeaderboardRoute = typeof import("@/app/api/leaderboard/route");

let registerPost: RegisterRoute["POST"];
let scorePost: ScoreRoute["POST"];
let sessionStartPost: SessionStartRoute["POST"];
let rankGet: RankRoute["GET"];
let leaderboardGet: LeaderboardRoute["GET"];

beforeAll(async () => {
  const [register, score, sessionStart, rank, leaderboard] = await Promise.all([
    import("@/app/api/auth/register/route"),
    import("@/app/api/game/score/route"),
    import("@/app/api/game/session/start/route"),
    import("@/app/api/leaderboard/rank/route"),
    import("@/app/api/leaderboard/route"),
  ]);
  registerPost = register.POST;
  scorePost = score.POST;
  sessionStartPost = sessionStart.POST;
  rankGet = rank.GET;
  leaderboardGet = leaderboard.GET;
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

/**
 * Играет честную партию автоплеером (счёт ≥ targetScore) за текущего
 * залогиненного юзера и сабмитит результат. Сессия бэкдейтится на
 * фактическую длительность партии.
 */
async function submitScore(targetScore: number): Promise<Response> {
  const startResponse = await sessionStartPost(
    jsonRequest("http://localhost/api/game/session/start", "POST", {}),
  );
  expect(startResponse.status).toBe(200);
  const { sessionId, seed } = (await startResponse.json()) as {
    sessionId: string;
    seed: string;
  };

  const run = playHonestGame(seed, targetScore);
  const backdateMs = (Math.ceil(run.ticks / 60) + 5) * 1000;

  await connectDB();
  await GameSession.updateOne(
    { _id: sessionId },
    { startedAt: new Date(Date.now() - backdateMs) },
  );

  return scorePost(
    jsonRequest("http://localhost/api/game/score", "POST", {
      score: run.score,
      sessionId,
      jumpTicks: run.jumpTicks,
    }),
  );
}

async function seedOpponent(username: string, bestScore: number): Promise<void> {
  await connectDB();
  await User.create({
    username,
    email: `${username}@example.com`,
    passwordHash: "x".repeat(60),
    bestScore,
  });
}

describe("Rank API", () => {
  it("GET /api/leaderboard/rank returns 401 without session", async () => {
    const response = await rankGet(
      new Request("http://localhost/api/leaderboard/rank"),
    );
    expect(response.status).toBe(401);
  });

  it("returns rank 1 without next user when leader", async () => {
    await registerUser("leader");
    const response = await submitScore(100);

    const { status, body } = await parseJsonResponse<{
      rank: number;
      nextUsername: string | null;
    }>(response);

    expect(status).toBe(200);
    expect(body.rank).toBe(1);
    expect(body.nextUsername).toBeNull();
  });

  it("returns rank and next username when others are above", async () => {
    await seedOpponent("top_player", 500);
    await seedOpponent("middle_player", 200);

    await registerUser("challenger");
    const response = await submitScore(100);

    const { status, body } = await parseJsonResponse<{
      rank: number;
      nextUsername: string | null;
    }>(response);

    expect(status).toBe(200);
    expect(body.rank).toBe(3);
    expect(body.nextUsername).toBe("middle_player");
  });

  it("GET /api/leaderboard/rank matches score response", async () => {
    await seedOpponent("alpha", 900);

    await registerUser("beta");
    await submitScore(100);

    const response = await rankGet(
      new Request("http://localhost/api/leaderboard/rank"),
    );
    const { status, body } = await parseJsonResponse<{
      rank: number;
      nextUsername: string | null;
    }>(response);

    expect(status).toBe(200);
    expect(body.rank).toBe(2);
    expect(body.nextUsername).toBe("alpha");
  });

  it("GET /api/leaderboard returns sorted top users", async () => {
    await seedOpponent("first", 300);
    await seedOpponent("second", 200);
    await seedOpponent("third", 100);

    const response = await leaderboardGet(
      new Request("http://localhost/api/leaderboard"),
    );
    const { status, body } = await parseJsonResponse<{
      leaderboard: { username: string; bestScore: number }[];
    }>(response);

    expect(status).toBe(200);
    expect(body.leaderboard.map((entry) => entry.username)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });
});
