import { NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/admin/auth";
import { badRequest, notFound } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { connectDB } from "@/lib/db/mongoose";
import { Session } from "@/lib/models/Session";
import { User } from "@/lib/models/User";
import { msg } from "@/lib/i18n/messages";
import { z } from "zod";

const banBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

type RouteParams = { params: Promise<{ userId: string }> };

function adminUserHandler(scope: string, action: "ban" | "unban", userId: string) {
  return withApiHandler(scope, async (request) => {
    const denied = requireAdminSecret(request);
    if (denied) return denied;

    await connectDB();

    if (action === "ban") {
      const body = await parseJsonBody(request);
      if (!body.ok) return body.response;

      const parsed = banBodySchema.safeParse(body.data ?? {});
      if (!parsed.success) {
        return badRequest(parsed.error.issues[0]?.message ?? msg.common.invalidPayload);
      }

      const user = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            isBanned: true,
            bannedAt: new Date(),
            banReason: parsed.data.reason ?? "manual-ban",
          },
        },
        { returnDocument: "after" },
      );

      if (!user) {
        return notFound("User not found");
      }

      await Session.deleteMany({ userId: user._id });

      return NextResponse.json({
        ok: true,
        userId: user._id.toString(),
        username: user.username,
        isBanned: true,
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: { isBanned: false },
        $unset: { bannedAt: "", banReason: "" },
      },
      { returnDocument: "after" },
    );

    if (!user) {
      return notFound("User not found");
    }

    return NextResponse.json({
      ok: true,
      userId: user._id.toString(),
      username: user.username,
      isBanned: false,
    });
  });
}

export async function POST(request: Request, { params }: RouteParams) {
  const { userId } = await params;
  return adminUserHandler("admin/users/ban", "ban", userId)(request);
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { userId } = await params;
  return adminUserHandler("admin/users/unban", "unban", userId)(request);
}
