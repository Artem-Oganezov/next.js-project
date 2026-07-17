import { NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin/auth";
import { withApiHandler } from "@/lib/api/handler";
import { rebuildLeaderboardFromMongo } from "@/lib/game/rank";

/**
 * Rebuild Redis rank ZSET from Mongo (source of truth).
 * Auth: X-Admin-Secret or admin session cookie.
 */
export const POST = withApiHandler("admin/leaderboard/rebuild", async (request) => {
  const denied = requireAdminSecret(request);
  if (denied) return denied;

  const result = await rebuildLeaderboardFromMongo();
  return NextResponse.json({
    ok: true,
    seeded: result.seeded,
  });
});
