import { beforeAll, describe, expect, it } from "vitest";
import { resetEnvCache } from "@/lib/env";
import { connectDB } from "@/lib/db/mongoose";
import { GameSession } from "@/lib/models/GameSession";
import { playHonestGame } from "../helpers/replay";
import { jsonRequest, parseJsonResponse } from "../helpers/request";

type RegisterRoute = typeof import("@/app/api/auth/register/route");
type ScoreRoute = typeof import("@/app/api/game/score/route");
type SessionStartRoute = typeof import("@/app/api/game/session/start/route");
type SubmissionsRoute = typeof import("@/app/api/admin/submissions/route");
type BanRoute = typeof import("@/app/api/admin/users/[userId]/ban/route");
type LoginRoute = typeof import("@/app/api/auth/login/route");
type MeRoute = typeof import("@/app/api/auth/me/route");
type LeaderboardRoute = typeof import("@/app/api/leaderboard/route");

const ADMIN_SECRET = "vitest-admin-secret-at-least-32-chars";

let registerPost: RegisterRoute["POST"];
let scorePost: ScoreRoute["POST"];
let sessionStartPost: SessionStartRoute["POST"];
let submissionsGet: SubmissionsRoute["GET"];
let banPost: BanRoute["POST"];
let unbanDelete: BanRoute["DELETE"];
let loginPost: LoginRoute["POST"];
let meGet: MeRoute["GET"];
let leaderboardGet: LeaderboardRoute["GET"];

beforeAll(async () => {
  process.env.ADMIN_SECRET = ADMIN_SECRET;
  resetEnvCache();

  const [register, score, sessionStart, submissions, ban, login, me, leaderboard] =
    await Promise.all([
      import("@/app/api/auth/register/route"),
      import("@/app/api/game/score/route"),
      import("@/app/api/game/session/start/route"),
      import("@/app/api/admin/submissions/route"),
      import("@/app/api/admin/users/[userId]/ban/route"),
      import("@/app/api/auth/login/route"),
      import("@/app/api/auth/me/route"),
      import("@/app/api/leaderboard/route"),
    ]);

  registerPost = register.POST;
  scorePost = score.POST;
  sessionStartPost = sessionStart.POST;
  submissionsGet = submissions.GET;
  banPost = ban.POST;
  unbanDelete = ban.DELETE;
  loginPost = login.POST;
  meGet = me.GET;
  leaderboardGet = leaderboard.GET;
});

function adminRequest(url: string, init?: RequestInit): Request {
  return new Request(url, {
    ...init,
    headers: {
      "X-Admin-Secret": ADMIN_SECRET,
      ...(init?.headers ?? {}),
    },
  });
}

async function submitHonestScore(targetScore: number): Promise<void> {
  const startResponse = await sessionStartPost(
    jsonRequest("http://localhost/api/game/session/start", "POST", {}),
  );
  expect(startResponse.status).toBe(200);
  const { sessionId, seed } = (await startResponse.json()) as {
    sessionId: string;
    seed: string;
  };

  const run = playHonestGame(seed, targetScore);
  await connectDB();
  await GameSession.updateOne(
    { _id: sessionId },
    {
      startedAt: new Date(Date.now() - (Math.ceil(run.ticks / 60) + 5) * 1000),
    },
  );

  const scoreResponse = await scorePost(
    jsonRequest("http://localhost/api/game/score", "POST", {
      score: run.score,
      sessionId,
      inputLog: run.jumpTicks,
    }),
  );
  expect(scoreResponse.status).toBe(200);
}

describe("Admin API", () => {
  it("GET /api/admin/submissions returns 401 without secret", async () => {
    const response = await submissionsGet(
      new Request("http://localhost/api/admin/submissions"),
    );
    expect(response.status).toBe(401);
  });

  it("POST /api/admin/leaderboard/rebuild returns 401 without secret", async () => {
    const { POST: rebuildPost } =
      await import("@/app/api/admin/leaderboard/rebuild/route");
    const response = await rebuildPost(
      new Request("http://localhost/api/admin/leaderboard/rebuild", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(401);
  });

  it("records suspicious submit and allows ban", async () => {
    const registerResponse = await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "admin_target",
        email: "admin_target@example.com",
        password: "password12",
      }),
    );
    expect(registerResponse.status).toBe(201);
    const { user } = (await registerResponse.json()) as { user: { id: string } };

    const startResponse = await sessionStartPost(
      jsonRequest("http://localhost/api/game/session/start", "POST", {}),
    );
    const { sessionId } = (await startResponse.json()) as { sessionId: string };

    await connectDB();
    await GameSession.updateOne(
      { _id: sessionId },
      { startedAt: new Date(Date.now() - 60_000) },
    );

    const cheatResponse = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", {
        score: 9999,
        sessionId,
        inputLog: [],
      }),
    );
    expect(cheatResponse.status).toBe(403);

    const listResponse = await submissionsGet(
      adminRequest("http://localhost/api/admin/submissions"),
    );
    const { status, body } = await parseJsonResponse<{
      submissions: { userId: string; username: string }[];
    }>(listResponse);

    expect(status).toBe(200);
    expect(body.submissions.some((s) => s.username === "admin_target")).toBe(true);

    const banResponse = await banPost(
      adminRequest(`http://localhost/api/admin/users/${user.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "test-ban" }),
      }),
      { params: Promise.resolve({ userId: user.id }) },
    );
    expect(banResponse.status).toBe(200);

    const { GET: leaderboardGetRoute } = await import("@/app/api/leaderboard/route");
    const leaderboardResponse = await leaderboardGetRoute(
      new Request("http://localhost/api/leaderboard"),
    );
    const leaderboardBody = (await leaderboardResponse.json()) as {
      leaderboard: { username: string }[];
    };
    expect(
      leaderboardBody.leaderboard.some((entry) => entry.username === "admin_target"),
    ).toBe(false);

    const loginResponse = await loginPost(
      jsonRequest("http://localhost/api/auth/login", "POST", {
        username: "admin_target",
        password: "password12",
      }),
    );
    expect(loginResponse.status).toBe(403);

    const meResponse = await meGet(new Request("http://localhost/api/auth/me"));
    expect(meResponse.status).toBe(401);
  });

  it("unban restores user on leaderboard when they have a best score", async () => {
    const registerResponse = await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "unban_user",
        email: "unban_user@example.com",
        password: "password12",
      }),
    );
    expect(registerResponse.status).toBe(201);
    const { user } = (await registerResponse.json()) as { user: { id: string } };

    await submitHonestScore(80);

    const leaderboardBefore = await leaderboardGet(
      new Request("http://localhost/api/leaderboard"),
    );
    const beforeBody = (await leaderboardBefore.json()) as {
      leaderboard: { username: string }[];
    };
    expect(
      beforeBody.leaderboard.some((entry) => entry.username === "unban_user"),
    ).toBe(true);

    const banResponse = await banPost(
      adminRequest(`http://localhost/api/admin/users/${user.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "temp-ban" }),
      }),
      { params: Promise.resolve({ userId: user.id }) },
    );
    expect(banResponse.status).toBe(200);

    const leaderboardBanned = await leaderboardGet(
      new Request("http://localhost/api/leaderboard"),
    );
    const bannedBody = (await leaderboardBanned.json()) as {
      leaderboard: { username: string }[];
    };
    expect(
      bannedBody.leaderboard.some((entry) => entry.username === "unban_user"),
    ).toBe(false);

    const unbanResponse = await unbanDelete(
      adminRequest(`http://localhost/api/admin/users/${user.id}/ban`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ userId: user.id }) },
    );
    expect(unbanResponse.status).toBe(200);

    const loginResponse = await loginPost(
      jsonRequest("http://localhost/api/auth/login", "POST", {
        username: "unban_user",
        password: "password12",
      }),
    );
    expect(loginResponse.status).toBe(200);

    const leaderboardAfter = await leaderboardGet(
      new Request("http://localhost/api/leaderboard"),
    );
    const afterBody = (await leaderboardAfter.json()) as {
      leaderboard: { username: string }[];
    };
    expect(afterBody.leaderboard.some((entry) => entry.username === "unban_user")).toBe(
      true,
    );
  });

  it("GET /api/metrics returns prometheus text", async () => {
    const { GET } = await import("@/app/api/metrics/route");
    const response = await GET(
      adminRequest("http://localhost/api/metrics", {
        headers: { Accept: "text/plain" },
      }),
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toMatch(/# TYPE .+ counter/);
  });
});
