import { NextResponse } from "next/server";
import { badRequest, forbidden, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, toPublicUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { loginSchema } from "@/lib/validation/auth";

export const POST = withApiHandler(
  "auth/login",
  async (request) => {
    const body = await parseJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = loginSchema.safeParse(body.data);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Некорректные данные");
    }

    const { username, password } = parsed.data;

    await connectDB();

    const user = await User.findOne({ username });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return unauthorized("Неверные данные");
    }

    if (user.isBanned) {
      return forbidden("Аккаунт заблокирован");
    }

    await createSession(user._id);

    return NextResponse.json({ user: toPublicUser(user) });
  },
  {
    keyPrefix: "auth:login",
    maxRequests: RATE_LIMIT.AUTH_MAX_REQUESTS,
    windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
  },
);
