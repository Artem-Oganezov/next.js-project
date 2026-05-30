import { beforeAll, describe, expect, it } from "vitest";
import { jsonRequest, parseJsonResponse } from "../helpers/request";

type RegisterRoute = typeof import("@/app/api/auth/register/route");
type LoginRoute = typeof import("@/app/api/auth/login/route");
type MeRoute = typeof import("@/app/api/auth/me/route");
type ScoreRoute = typeof import("@/app/api/game/score/route");

let registerPost: RegisterRoute["POST"];
let loginPost: LoginRoute["POST"];
let meGet: MeRoute["GET"];
let scorePost: ScoreRoute["POST"];

beforeAll(async () => {
  const [register, login, me, score] = await Promise.all([
    import("@/app/api/auth/register/route"),
    import("@/app/api/auth/login/route"),
    import("@/app/api/auth/me/route"),
    import("@/app/api/game/score/route"),
  ]);
  registerPost = register.POST;
  loginPost = login.POST;
  meGet = me.GET;
  scorePost = score.POST;
});

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
    expect(body.message).toMatch(/уже существует/i);
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
      jsonRequest("http://localhost/api/game/score", "POST", { score: 10 }),
    );
    const { status } = await parseJsonResponse<{ message: string }>(response);
    expect(status).toBe(401);
  });

  it("POST /api/game/score updates best score when authenticated", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "scorer",
        email: "scorer@example.com",
        password: "password12",
      }),
    );

    const first = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", { score: 50 }),
    );
    const firstBody = await parseJsonResponse<{
      bestScore: number;
      isNewRecord: boolean;
    }>(first);
    expect(firstBody.status).toBe(200);
    expect(firstBody.body.bestScore).toBe(50);
    expect(firstBody.body.isNewRecord).toBe(true);

    const second = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", { score: 30 }),
    );
    const secondBody = await parseJsonResponse<{
      bestScore: number;
      isNewRecord: boolean;
    }>(second);
    expect(secondBody.status).toBe(200);
    expect(secondBody.body.bestScore).toBe(50);
    expect(secondBody.body.isNewRecord).toBe(false);

    const third = await scorePost(
      jsonRequest("http://localhost/api/game/score", "POST", { score: 120 }),
    );
    const thirdBody = await parseJsonResponse<{
      bestScore: number;
      isNewRecord: boolean;
    }>(third);
    expect(thirdBody.status).toBe(200);
    expect(thirdBody.body.bestScore).toBe(120);
    expect(thirdBody.body.isNewRecord).toBe(true);
  });
});
