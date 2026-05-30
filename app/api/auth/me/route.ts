import { NextResponse } from "next/server";
import { internalError, unauthorized } from "@/lib/api/errors";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return unauthorized();
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[auth/me]", error);
    return internalError();
  }
}
