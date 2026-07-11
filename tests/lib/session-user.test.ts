import { describe, expect, it } from "vitest";
import { toSessionUser, type User } from "@/types/user";

describe("toSessionUser", () => {
  it("removes email from public user payload", () => {
    const user: User = {
      id: "1",
      username: "player",
      email: "player@example.com",
      emailVerified: true,
      authProvider: "local",
      bestScore: 10,
      totalScore: 20,
      unlockedSkins: ["default"],
      activeSkin: "default",
    };

    const session = toSessionUser(user);
    expect(session).toEqual({
      id: "1",
      username: "player",
      emailVerified: true,
      authProvider: "local",
      bestScore: 10,
      totalScore: 20,
      unlockedSkins: ["default"],
      activeSkin: "default",
    });
    expect(session).not.toHaveProperty("email");
  });
});
