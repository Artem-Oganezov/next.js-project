import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, unauthorized } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/http";
import { getSessionUser } from "@/lib/auth/session";
import { RATE_LIMIT } from "@/lib/config/app";
import { connectDB } from "@/lib/db/mongoose";
// Импорт напрямую из game/skins (не из @/game): серверному роуту
// не нужен клиентский компонент Game.
import { SKINS } from "@/game/skins";
import { User } from "@/lib/models/User";

const skinIdSchema = z.object({
  skinId: z.string().min(1, "skinId обязателен"),
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
      return badRequest(parsed.error.issues[0]?.message ?? "Некорректные данные");
    }

    const { skinId } = parsed.data;

    const skin = SKINS.find((item) => item.id === skinId);
    if (!skin) {
      return badRequest("Скин не найден");
    }

    await connectDB();

    const user = await User.findById(sessionUser.id);
    if (!user) {
      return unauthorized();
    }

    if (user.unlockedSkins.includes(skinId)) {
      return badRequest("уже разблокирован");
    }

    if (user.totalScore < skin.price) {
      return badRequest("недостаточно очков");
    }

    user.totalScore -= skin.price;
    user.unlockedSkins.push(skinId);
    await user.save();

    return NextResponse.json({
      totalScore: user.totalScore,
      unlockedSkins: user.unlockedSkins,
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
      return badRequest(parsed.error.issues[0]?.message ?? "Некорректные данные");
    }

    const { skinId } = parsed.data;

    await connectDB();

    const user = await User.findById(sessionUser.id);
    if (!user) {
      return unauthorized();
    }

    if (!user.unlockedSkins.includes(skinId)) {
      return badRequest("Скин не разблокирован");
    }

    user.activeSkin = skinId;
    await user.save();

    return NextResponse.json({
      activeSkin: user.activeSkin,
    });
  },
  {
    keyPrefix: "skins:equip",
    maxRequests: RATE_LIMIT.SCORE_MAX_REQUESTS,
    windowMs: RATE_LIMIT.SCORE_WINDOW_MS,
  },
);
