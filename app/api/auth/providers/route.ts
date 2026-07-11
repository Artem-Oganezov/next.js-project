import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { isGoogleOAuthEnabled } from "@/lib/auth/google";

export const GET = withApiHandler("auth/providers", async () => {
  return NextResponse.json({
    google: isGoogleOAuthEnabled(),
  });
});
