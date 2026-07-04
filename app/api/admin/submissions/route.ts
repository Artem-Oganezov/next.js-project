import { NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin/auth";
import { withApiHandler } from "@/lib/api/handler";
import { connectDB } from "@/lib/db/mongoose";
import { SuspiciousSubmit } from "@/lib/models/SuspiciousSubmit";

export const GET = withApiHandler("admin/submissions", async (request) => {
  const denied = requireAdminSecret(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50),
  );

  await connectDB();

  const submissions = await SuspiciousSubmit.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({
    submissions: submissions.map((entry) => ({
      id: entry._id.toString(),
      userId: entry.userId.toString(),
      username: entry.username,
      score: entry.score,
      reason: entry.reason,
      elapsedMs: entry.elapsedMs,
      createdAt: entry.createdAt.toISOString(),
    })),
  });
});
