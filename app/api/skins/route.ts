import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { getSessionUser, syncSessionCacheForUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
// Import directly from game/skins (not @/game): the server route
// does not need the client Game component.
import { SKINS } from "@/game/skins";
import { User } from "@/lib/models/User";
import { msg } from "@/lib/i18n/messages";

const skinIdSchema = z.object({
  skinId: z.string().min(1, msg.skins.skinIdRequired),
});

export const POST = withApiHandler(
  "skins/unlock",
  async (request) => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    const body = await parseJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = skinIdSchema.safeParse(body.data);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? msg.common.invalidPayload);
    }

    const { skinId } = parsed.data;

    const skin = SKINS.find((item) => item.id === skinId);
    if (!skin) {
      return badRequest(msg.skins.notFound);
    }

    await connectDB();

    const updated = await User.findOneAndUpdate(
      {
        _id: sessionUser.id,
        totalScore: { $gte: skin.price },
        unlockedSkins: { $ne: skinId },
      },
      {
        $inc: { totalScore: -skin.price },
        $push: { unlockedSkins: skinId },
      },
      { returnDocument: "after" },
    );

    if (!updated) {
      const user = await User.findById(sessionUser.id);
      if (!user) {
        return unauthorized();
      }
      if (user.unlockedSkins.includes(skinId)) {
        return badRequest(msg.skins.alreadyUnlocked);
      }
      return badRequest(msg.skins.insufficientPoints);
    }

    await syncSessionCacheForUser(sessionUser.id);

    return NextResponse.json({
      totalScore: updated.totalScore,
      unlockedSkins: updated.unlockedSkins,
    });
  },
  {
    keyPrefix: "skins:unlock",
    maxRequests: RATE_LIMIT.SCORE_MAX_REQUESTS,
    windowMs: RATE_LIMIT.SCORE_WINDOW_MS,
  },
);

export const PUT = withApiHandler(
  "skins/equip",
  async (request) => {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return unauthorized();
    }

    const body = await parseJsonBody(request);
    if (!body.ok) {
      return body.response;
    }

    const parsed = skinIdSchema.safeParse(body.data);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? msg.common.invalidPayload);
    }

    const { skinId } = parsed.data;

    await connectDB();

    const updated = await User.findOneAndUpdate(
      { _id: sessionUser.id, unlockedSkins: skinId },
      { $set: { activeSkin: skinId } },
      { returnDocument: "after" },
    );

    if (!updated) {
      const user = await User.findById(sessionUser.id);
      if (!user) {
        return unauthorized();
      }
      return badRequest(msg.skins.notUnlocked);
    }

    await syncSessionCacheForUser(sessionUser.id);

    return NextResponse.json({
      activeSkin: updated.activeSkin,
    });
  },
  {
    keyPrefix: "skins:equip",
    maxRequests: RATE_LIMIT.SCORE_MAX_REQUESTS,
    windowMs: RATE_LIMIT.SCORE_WINDOW_MS,
  },
);
