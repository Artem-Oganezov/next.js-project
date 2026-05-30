import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { badRequest, conflict, internalError } from "@/lib/api/errors";
import { hashPassword } from "@/lib/auth/password";
import { createSession, toPublicUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { registerSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Некорректный JSON");
    }

    const parsed = registerSchema.safeParse(body);
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

    const passwordHash = await hashPassword(password);
    const user = await User.create({ username, email, passwordHash });

    await createSession(user._id);

    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      return conflict("Пользователь с таким именем или email уже существует");
    }

    console.error("[auth/register]", error);
    return internalError();
  }
}
