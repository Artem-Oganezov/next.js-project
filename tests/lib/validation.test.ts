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
  it("accepts valid score", () => {
    const result = scoreSchema.safeParse({ score: 42 });
    expect(result.success).toBe(true);
  });

  it("rejects negative score", () => {
    const result = scoreSchema.safeParse({ score: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer score", () => {
    const result = scoreSchema.safeParse({ score: 1.5 });
    expect(result.success).toBe(false);
  });
});
