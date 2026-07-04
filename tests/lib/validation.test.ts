import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validation/auth";
import { scoreSchema } from "@/lib/validation/score";

describe("registerSchema", () => {
  it("accepts valid registration data", () => {
    const result = registerSchema.safeParse({
      username: "player_one",
      email: "player@example.com",
      password: "password12",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short username", () => {
    const result = registerSchema.safeParse({
      username: "ab",
      email: "player@example.com",
      password: "password12",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({
      username: "player_one",
      email: "not-an-email",
      password: "password12",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid login data", () => {
    const result = loginSchema.safeParse({
      username: "player_one",
      password: "password12",
    });
    expect(result.success).toBe(true);
  });
});

describe("scoreSchema", () => {
  const sessionId = "a".repeat(24);

  it("accepts valid score with session id", () => {
    const result = scoreSchema.safeParse({ score: 42, sessionId });
    expect(result.success).toBe(true);
  });

  it("rejects negative score", () => {
    const result = scoreSchema.safeParse({ score: -1, sessionId });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer score", () => {
    const result = scoreSchema.safeParse({ score: 1.5, sessionId });
    expect(result.success).toBe(false);
  });

  it("rejects missing or malformed session id", () => {
    expect(scoreSchema.safeParse({ score: 42 }).success).toBe(false);
    expect(
      scoreSchema.safeParse({ score: 42, sessionId: "not-an-object-id" }).success,
    ).toBe(false);
  });

  it("accepts valid jump ticks log", () => {
    const result = scoreSchema.safeParse({
      score: 42,
      sessionId,
      jumpTicks: [10, 55, 120],
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed jump ticks", () => {
    expect(
      scoreSchema.safeParse({ score: 42, sessionId, jumpTicks: [-1] }).success,
    ).toBe(false);
    expect(
      scoreSchema.safeParse({ score: 42, sessionId, jumpTicks: [1.5] }).success,
    ).toBe(false);
    expect(
      scoreSchema.safeParse({
        score: 42,
        sessionId,
        jumpTicks: Array.from({ length: 10_001 }, (_, i) => i),
      }).success,
    ).toBe(false);
  });
});
