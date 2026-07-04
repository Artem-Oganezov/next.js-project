import { beforeAll, describe, expect, it } from "vitest";
import { SKINS } from "@/game/skins";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import { jsonRequest, parseJsonResponse } from "../helpers/request";

type RegisterRoute = typeof import("@/app/api/auth/register/route");
type SkinsRoute = typeof import("@/app/api/skins/route");

let registerPost: RegisterRoute["POST"];
let skinsPost: SkinsRoute["POST"];
let skinsPut: SkinsRoute["PUT"];

const paidSkin = SKINS.find((skin) => skin.price > 0);
if (!paidSkin) {
  throw new Error("Тест требует хотя бы один платный скин в game/skins.ts");
}

beforeAll(async () => {
  const [register, skins] = await Promise.all([
    import("@/app/api/auth/register/route"),
    import("@/app/api/skins/route"),
  ]);
  registerPost = register.POST;
  skinsPost = skins.POST;
  skinsPut = skins.PUT;
});

async function registerUser(username: string): Promise<void> {
  const response = await registerPost(
    jsonRequest("http://localhost/api/auth/register", "POST", {
      username,
      email: `${username}@example.com`,
      password: "password12",
    }),
  );
  expect(response.status).toBe(201);
}

async function giveTotalScore(username: string, totalScore: number): Promise<void> {
  await connectDB();
  await User.updateOne({ username }, { $set: { totalScore } });
}

describe("Skins API", () => {
  it("POST /api/skins returns 401 without session", async () => {
    const response = await skinsPost(
      jsonRequest("http://localhost/api/skins", "POST", { skinId: paidSkin.id }),
    );
    expect(response.status).toBe(401);
  });

  it("POST /api/skins rejects unknown skin with 400", async () => {
    await registerUser("skin_unknown");
    const response = await skinsPost(
      jsonRequest("http://localhost/api/skins", "POST", { skinId: "nope" }),
    );
    const { status, body } = await parseJsonResponse<{ message: string }>(response);
    expect(status).toBe(400);
    expect(body.message).toMatch(/not found/i);
  });

  it("POST /api/skins rejects purchase without enough points", async () => {
    await registerUser("skin_poor");
    const response = await skinsPost(
      jsonRequest("http://localhost/api/skins", "POST", { skinId: paidSkin.id }),
    );
    const { status, body } = await parseJsonResponse<{ message: string }>(response);
    expect(status).toBe(400);
    expect(body.message).toMatch(/insufficient/i);
  });

  it("POST /api/skins unlocks skin and deducts points", async () => {
    await registerUser("skin_buyer");
    await giveTotalScore("skin_buyer", paidSkin.price + 50);

    const response = await skinsPost(
      jsonRequest("http://localhost/api/skins", "POST", { skinId: paidSkin.id }),
    );
    const { status, body } = await parseJsonResponse<{
      totalScore: number;
      unlockedSkins: string[];
    }>(response);

    expect(status).toBe(200);
    expect(body.totalScore).toBe(50);
    expect(body.unlockedSkins).toContain(paidSkin.id);
  });

  it("POST /api/skins rejects duplicate purchase", async () => {
    await registerUser("skin_repeat");
    await giveTotalScore("skin_repeat", paidSkin.price * 2);

    const first = await skinsPost(
      jsonRequest("http://localhost/api/skins", "POST", { skinId: paidSkin.id }),
    );
    expect(first.status).toBe(200);

    const second = await skinsPost(
      jsonRequest("http://localhost/api/skins", "POST", { skinId: paidSkin.id }),
    );
    const { status, body } = await parseJsonResponse<{ message: string }>(second);
    expect(status).toBe(400);
    expect(body.message).toMatch(/already unlocked/i);
  });

  it("PUT /api/skins rejects equipping locked skin", async () => {
    await registerUser("skin_locked");
    const response = await skinsPut(
      jsonRequest("http://localhost/api/skins", "PUT", { skinId: paidSkin.id }),
    );
    const { status, body } = await parseJsonResponse<{ message: string }>(response);
    expect(status).toBe(400);
    expect(body.message).toMatch(/not unlocked/i);
  });

  it("PUT /api/skins equips unlocked skin", async () => {
    await registerUser("skin_equipper");
    await giveTotalScore("skin_equipper", paidSkin.price);

    const purchase = await skinsPost(
      jsonRequest("http://localhost/api/skins", "POST", { skinId: paidSkin.id }),
    );
    expect(purchase.status).toBe(200);

    const response = await skinsPut(
      jsonRequest("http://localhost/api/skins", "PUT", { skinId: paidSkin.id }),
    );
    const { status, body } = await parseJsonResponse<{ activeSkin: string }>(response);
    expect(status).toBe(200);
    expect(body.activeSkin).toBe(paidSkin.id);
  });
});
