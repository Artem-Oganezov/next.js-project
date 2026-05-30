import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { connectDB } from "@/lib/db/mongoose";

export const GET = withApiHandler("health", async () => {
  await connectDB();

  const dbState = (await connectDB()).connection.readyState;
  const dbOk = dbState === 1;

  return NextResponse.json(
    {
      status: dbOk ? "ok" : "degraded",
      database: dbOk ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 },
  );
});
