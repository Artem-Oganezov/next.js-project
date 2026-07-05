import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { issueAuthToken } from "@/lib/auth/mail-tokens";
import { setEmailSenderForTests } from "@/lib/email";
import type { SendEmailParams } from "@/lib/email/types";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { jsonRequest, parseJsonResponse } from "../helpers/request";

type RegisterRoute = typeof import("@/app/api/auth/register/route");
type ForgotRoute = typeof import("@/app/api/auth/forgot-password/route");
type ResetRoute = typeof import("@/app/api/auth/reset-password/route");
type VerifyRoute = typeof import("@/app/api/auth/verify-email/route");
type PasswordRoute = typeof import("@/app/api/auth/password/route");
type AccountRoute = typeof import("@/app/api/auth/account/route");
type MeRoute = typeof import("@/app/api/auth/me/route");

let registerPost: RegisterRoute["POST"];
let forgotPost: ForgotRoute["POST"];
let resetPost: ResetRoute["POST"];
let verifyGet: VerifyRoute["GET"];
let passwordPut: PasswordRoute["PUT"];
let accountDelete: AccountRoute["DELETE"];
let meGet: MeRoute["GET"];

const sentEmails: SendEmailParams[] = [];

beforeAll(async () => {
  setEmailSenderForTests({
    async send(params) {
      sentEmails.push(params);
    },
  });

  const [register, forgot, reset, verify, password, account, me] = await Promise.all([
    import("@/app/api/auth/register/route"),
    import("@/app/api/auth/forgot-password/route"),
    import("@/app/api/auth/reset-password/route"),
    import("@/app/api/auth/verify-email/route"),
    import("@/app/api/auth/password/route"),
    import("@/app/api/auth/account/route"),
    import("@/app/api/auth/me/route"),
  ]);

  registerPost = register.POST;
  forgotPost = forgot.POST;
  resetPost = reset.POST;
  verifyGet = verify.GET;
  passwordPut = password.PUT;
  accountDelete = account.DELETE;
  meGet = me.GET;
});

afterAll(() => {
  setEmailSenderForTests(null);
});

describe("Extended auth API", () => {
  it("register sends verification email and verify-email confirms account", async () => {
    sentEmails.length = 0;

    const response = await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "verify_user",
        email: "verify@example.com",
        password: "password12",
      }),
    );
    expect(response.status).toBe(201);

    const meBefore = await meGet(new Request("http://localhost/api/auth/me"));
    const meBody = await parseJsonResponse<{ user: { emailVerified: boolean } }>(meBefore);
    expect(meBody.body.user.emailVerified).toBe(false);

    expect(sentEmails.some((e) => e.subject.includes("Verify"))).toBe(true);

    await connectDB();
    const user = await User.findOne({ username: "verify_user" });
    expect(user).toBeTruthy();

    const token = await issueAuthToken(user!._id.toString(), "email-verify", 60_000);
    const verifyResponse = await verifyGet(
      new Request(`http://localhost/api/auth/verify-email?token=${token}`),
    );
    expect(verifyResponse.status).toBe(307);
    expect(verifyResponse.headers.get("location")).toContain("/verify-email?status=success");

    const meAfter = await meGet(new Request("http://localhost/api/auth/me"));
    const afterBody = await parseJsonResponse<{ user: { emailVerified: boolean } }>(meAfter);
    expect(afterBody.body.user.emailVerified).toBe(true);
  });

  it("forgot-password + reset-password rotates credentials", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "reset_user",
        email: "reset@example.com",
        password: "password12",
      }),
    );

    sentEmails.length = 0;
    const forgotResponse = await forgotPost(
      jsonRequest("http://localhost/api/auth/forgot-password", "POST", {
        email: "reset@example.com",
      }),
    );
    expect(forgotResponse.status).toBe(200);
    expect(sentEmails.length).toBe(1);

    await connectDB();
    const user = await User.findOne({ email: "reset@example.com" });
    const token = await issueAuthToken(user!._id.toString(), "password-reset", 60_000);

    const resetResponse = await resetPost(
      jsonRequest("http://localhost/api/auth/reset-password", "POST", {
        token,
        password: "newpassword99",
      }),
    );
    expect(resetResponse.status).toBe(200);
  });

  it("change password logs user out of session", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "change_pw",
        email: "changepw@example.com",
        password: "password12",
      }),
    );

    const changeResponse = await passwordPut(
      jsonRequest("http://localhost/api/auth/password", "PUT", {
        currentPassword: "password12",
        newPassword: "newpassword99",
      }),
    );
    expect(changeResponse.status).toBe(200);

    const meResponse = await meGet(new Request("http://localhost/api/auth/me"));
    expect(meResponse.status).toBe(401);
  });

  it("delete account removes user and session", async () => {
    await registerPost(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        username: "delete_me",
        email: "delete@example.com",
        password: "password12",
      }),
    );

    const deleteResponse = await accountDelete(
      jsonRequest("http://localhost/api/auth/account", "DELETE", {
        password: "password12",
      }),
    );
    expect(deleteResponse.status).toBe(200);

    const meResponse = await meGet(new Request("http://localhost/api/auth/me"));
    expect(meResponse.status).toBe(401);

    await connectDB();
    const user = await User.findOne({ username: "delete_me" });
    expect(user).toBeNull();
  });
});
