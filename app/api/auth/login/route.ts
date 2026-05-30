import { NextResponse } from "next/server";
import { badRequest, internalError, unauthorized } from "@/lib/api/errors";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, toPublicUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Некорректный JSON");
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Некорректные данные");
    }

    const { username, password } = parsed.data;

    await connectDB();

    const user = await User.findOne({ username });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return unauthorized("Неверные данные");
    }

    await createSession(user._id);

    return NextResponse.json({ user: toPublicUser(user) });
  } catch (error) {
    console.error("[auth/login]", error);
    return internalError();
  }
}
