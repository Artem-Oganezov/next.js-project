import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { badRequest, conflict } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { hashPassword } from "@/lib/auth/password";
import { createSession, toPublicUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { registerSchema } from "@/lib/validation/auth";

export const POST = withApiHandler(
  "auth/register",
  async (request) => {
    const body = await parseJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = registerSchema.safeParse(body.data);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Некорректные данные");
    }

    const { username, email, password } = parsed.data;

    await connectDB();

    const existing = await User.findOne({
      $or: [{ username }, { email }],
    });
    if (existing) {
      return conflict("Пользователь с таким именем или email уже существует");
    }

    try {
      const passwordHash = await hashPassword(password);
      const user = await User.create({ username, email, passwordHash });
      await createSession(user._id);
      return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
    } catch (error) {
      if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
        return conflict("Пользователь с таким именем или email уже существует");
      }
      throw error;
    }
  },
  {
    keyPrefix: "auth:register",
    maxRequests: RATE_LIMIT.AUTH_MAX_REQUESTS,
    windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
  },
);
