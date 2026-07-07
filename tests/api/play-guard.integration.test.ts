import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { issueAuthToken } from "@/lib/auth/mail-tokens";
import { resetEnvCache } from "@/lib/env";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { playHonestGame } from "../helpers/replay";
import { jsonRequest, parseJsonResponse } from "../helpers/request";

type RegisterRoute = typeof import("@/app/api/auth/register/route");
type SessionStartRoute = typeof import("@/app/api/game/session/start/route");
type ScoreRoute = typeof import("@/app/api/game/score/route");
type VerifyRoute = typeof import("@/app/api/auth/verify-email/route");

let registerPost: RegisterRoute["POST"];
let sessionStartPost: SessionStartRoute["POST"];
let scorePost: ScoreRoute["POST"];
let verifyGet: VerifyRoute["GET"];

beforeAll(async () => {
  const [register, sessionStart, score, verify] = await Promise.all([
    import("@/app/api/auth/register/route"),
    import("@/app/api/game/session/start/route"),
    import("@/app/api/game/score/route"),
    import("@/app/api/auth/verify-email/route"),
  ]);
  registerPost = register.POST;
  sessionStartPost = sessionStart.POST;
  scorePost = score.POST;
  verifyGet = verify.GET;
});

afterEach(() => {
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
  resetEnvCache();
});

describe("Play guard (REQUIRE_EMAIL_VERIFICATION)", () => {
  it("blocks session start and score until email is verified", async () => {
    process.env.REQUIRE_EMAIL_VERIFICATION = "true";
    resetEnvCache();

    const registerResponse = await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "strict_email",
        email: "strict@example.com",
        password: "password12",
      }),
    );
    expect(registerResponse.status).toBe(201);

    const blockedStart = await sessionStartPost(
      jsonRequest("http://localhost/api/game/session/start", "POST", {}),
    );
    const blockedStartBody = await parseJsonResponse<{ message: string }>(blockedStart);
    expect(blockedStartBody.status).toBe(403);
    expect(blockedStartBody.body.message).toMatch(/verify your email/i);

    const blockedScore = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", {
        score: 10,
        sessionId: "a".repeat(24),
        inputLog: [],
      }),
    );
    const blockedScoreBody = await parseJsonResponse<{ message: string }>(blockedScore);
    expect(blockedScoreBody.status).toBe(403);
    expect(blockedScoreBody.body.message).toMatch(/verify your email/i);

    await connectDB();
    const user = await User.findOne({ username: "strict_email" });
    expect(user).toBeTruthy();

    const token = await issueAuthToken(user!._id.toString(), "email-verify", 60_000);
    const verifyResponse = await verifyGet(
      new Request(`http://localhost/api/auth/verify-email?token=${token}`),
    );
    expect(verifyResponse.status).toBe(307);

    const allowedStart = await sessionStartPost(
      jsonRequest("http://localhost/api/game/session/start", "POST", {}),
    );
    expect(allowedStart.status).toBe(200);

    const { sessionId, seed } = (await allowedStart.json()) as {
      sessionId: string;
      seed: string;
    };
    const run = playHonestGame(seed, 30);

    const { GameSession } = await import("@/lib/models/GameSession");
    await GameSession.updateOne(
      { _id: sessionId },
      { startedAt: new Date(Date.now() - (Math.ceil(run.ticks / 60) + 5) * 1000) },
    );

    const allowedScore = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", {
        score: run.score,
        sessionId,
        inputLog: run.jumpTicks,
      }),
    );
    expect(allowedScore.status).toBe(200);
  });
});
