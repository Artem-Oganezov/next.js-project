import { cookies } from "next/headers";
import { beforeAll, describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { MAX_SESSIONS_PER_USER } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { Session } from "@/lib/models/Session";
import { User } from "@/lib/models/User";
import { jsonRequest } from "../helpers/request";

type RegisterRoute = typeof import("@/app/api/auth/register/route");
type LoginRoute = typeof import("@/app/api/auth/login/route");
type MeRoute = typeof import("@/app/api/auth/me/route");

let registerPost: RegisterRoute["POST"];
let loginPost: LoginRoute["POST"];
let meGet: MeRoute["GET"];

beforeAll(async () => {
  const [register, login, me] = await Promise.all([
    import("@/app/api/auth/register/route"),
    import("@/app/api/auth/login/route"),
    import("@/app/api/auth/me/route"),
  ]);
  registerPost = register.POST;
  loginPost = login.POST;
  meGet = me.GET;
});

const credentials = {
  username: "session_cap",
  email: "session_cap@example.com",
  password: "password12",
};

async function getCurrentSessionToken(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  expect(token).toBeTruthy();
  return token as string;
}

describe("Session cap", () => {
  it(`keeps at most ${MAX_SESSIONS_PER_USER} sessions per user and invalidates the oldest`, async () => {
    const registerResponse = await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", credentials),
    );
    expect(registerResponse.status).toBe(201);

    const firstToken = await getCurrentSessionToken();

    // MAX_SESSIONS_PER_USER + 1 more logins: total sessions exceed the cap.
    for (let i = 0; i < MAX_SESSIONS_PER_USER + 1; i++) {
      const loginResponse = await loginPost(
        jsonRequest("http://localhost/api/auth/login", "POST", {
          username: credentials.username,
          password: credentials.password,
        }),
      );
      expect(loginResponse.status).toBe(200);
    }

    await connectDB();
    const user = await User.findOne({ username: credentials.username });
    expect(user).not.toBeNull();

    const sessionCount = await Session.countDocuments({ userId: user!._id });
    expect(sessionCount).toBe(MAX_SESSIONS_PER_USER);

    // Newest session works.
    const meWithNewest = await meGet(new Request("http://localhost/api/auth/me"));
    expect(meWithNewest.status).toBe(200);

    // The first session was evicted by the cap — its cookie is no longer valid.
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, firstToken);
    const meWithOldest = await meGet(new Request("http://localhost/api/auth/me"));
    expect(meWithOldest.status).toBe(401);
  }, 60_000);
});
