import { NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { destroySession } from "@/lib/auth/session";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/logout]", error);
    return internalError();
  }
}
