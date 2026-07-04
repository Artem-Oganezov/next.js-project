import { beforeAll, describe, expect, it } from "vitest";
import { jsonRequest, parseJsonResponse } from "../helpers/request";

type RegisterRoute = typeof import("@/app/api/auth/register/route");
type MeRoute = typeof import("@/app/api/auth/me/route");
type LogoutRoute = typeof import("@/app/api/auth/logout/route");

let registerPost: RegisterRoute["POST"];
let meGet: MeRoute["GET"];
let logoutPost: LogoutRoute["POST"];

beforeAll(async () => {
  const [register, me, logout] = await Promise.all([
    import("@/app/api/auth/register/route"),
    import("@/app/api/auth/me/route"),
    import("@/app/api/auth/logout/route"),
  ]);
  registerPost = register.POST;
  meGet = me.GET;
  logoutPost = logout.POST;
});

describe("Logout API", () => {
  it("POST /api/auth/logout destroys session: me returns 401 after logout", async () => {
    const registerResponse = await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "logout_user",
        email: "logout@example.com",
        password: "password12",
      }),
    );
    expect(registerResponse.status).toBe(201);

    const meBefore = await meGet(new Request("http://localhost/api/auth/me"));
    expect(meBefore.status).toBe(200);

    const logoutResponse = await logoutPost(
      new Request("http://localhost/api/auth/logout", { method: "POST" }),
    );
    const { status, body } = await parseJsonResponse<{ ok: boolean }>(logoutResponse);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);

    const meAfter = await meGet(new Request("http://localhost/api/auth/me"));
    expect(meAfter.status).toBe(401);
  });

  it("POST /api/auth/logout is idempotent without session", async () => {
    const response = await logoutPost(
      new Request("http://localhost/api/auth/logout", { method: "POST" }),
    );
    expect(response.status).toBe(200);
  });
});
