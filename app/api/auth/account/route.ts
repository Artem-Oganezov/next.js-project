import { NextResponse } from "next/server";
import { badRequest, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { deleteUserAccount } from "@/lib/auth/account";
import { verifyLoginPassword } from "@/lib/auth/password";
import { destroySession, getSessionUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { msg } from "@/lib/i18n/messages";
import { deleteAccountSchema } from "@/lib/validation/auth";

export const DELETE = withApiHandler(
  "auth/account",
  async (request) => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    const body = await parseJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = deleteAccountSchema.safeParse(body.data);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? msg.common.invalidPayload);
    }

    await connectDB();

    const user = await User.findById(sessionUser.id);
    if (!user) {
      return unauthorized();
    }

    if (user.passwordHash) {
      if (!parsed.data.password) {
        return badRequest(msg.auth.passwordWrong);
      }
      const valid = await verifyLoginPassword(parsed.data.password, user.passwordHash);
      if (!valid) {
        return unauthorized(msg.auth.passwordWrong);
      }
    }

    await deleteUserAccount(sessionUser.id);
    await destroySession();

    return NextResponse.json({ ok: true });
  },
  {
    keyPrefix: "auth:delete-account",
    maxRequests: RATE_LIMIT.AUTH_MAX_REQUESTS,
    windowMs: RATE_LIMIT.AUTH_WINDOW_MS,
  },
);
