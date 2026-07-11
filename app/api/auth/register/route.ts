import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { badRequest, conflict } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { hashPassword } from "@/lib/auth/password";
import { sendVerificationEmail } from "@/lib/auth/mail";
import { createSession, toPublicUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { registerSchema } from "@/lib/validation/auth";
import { msg } from "@/lib/i18n/messages";

export const POST = withApiHandler(
  "auth/register",
  async (request) => {
    const body = await parseJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = registerSchema.safeParse(body.data);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? msg.common.invalidPayload);
    }

    const { username, email, password } = parsed.data;

    await connectDB();

    const existing = await User.findOne({
      $or: [{ username }, { email }],
    });
    if (existing) {
      return conflict(msg.auth.userExists);
    }

    try {
      const passwordHash = await hashPassword(password);
      const user = await User.create({
        username,
        email,
        passwordHash,
        authProvider: "local",
      });
      await createSession(user._id);
      try {
        await sendVerificationEmail(user._id.toString(), user.email);
      } catch (error) {
        console.error(
          JSON.stringify({
            level: "error",
            scope: "auth/register",
            message: error instanceof Error ? error.message : "email send failed",
          }),
        );
      }
      return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
    } catch (error) {
      if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
        return conflict(msg.auth.userExists);
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
