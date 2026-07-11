import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models/User";
import {
  GoogleOAuthError,
  allocateUsername,
  signInWithGoogleProfile,
} from "@/lib/auth/google";

describe("allocateUsername", () => {
  beforeEach(async () => {
    await connectDB();
    await User.deleteMany({});
  });

  it("sanitizes display names and ensures minimum length", async () => {
    const username = await allocateUsername("Cool Player!", "player@example.com");
    expect(username).toMatch(/^[a-z0-9_]{3,30}$/);
    expect(username).toContain("cool");
  });

  it("falls back to email local part when name is too short", async () => {
    const username = await allocateUsername("A", "myname@example.com");
    expect(username.startsWith("myname")).toBe(true);
  });

  it("adds a suffix when the base username is taken", async () => {
    await User.create({
      username: "taken_user",
      email: "existing@example.com",
      passwordHash: "hash",
      authProvider: "local",
    });

    const username = await allocateUsername("Taken User", "new@example.com");
    expect(username).not.toBe("taken_user");
    expect(username.startsWith("taken_user")).toBe(true);
  });
});

describe("signInWithGoogleProfile", () => {
  beforeEach(async () => {
    await connectDB();
    await User.deleteMany({});
  });

  it("creates a verified Google user without a password hash", async () => {
    const user = await signInWithGoogleProfile({
      googleId: "google-sub-1",
      email: "google@example.com",
      name: "Google Player",
    });

    expect(user.authProvider).toBe("google");
    expect(user.googleId).toBe("google-sub-1");
    expect(user.emailVerified).toBe(true);
    expect(user.passwordHash).toBeNull();
  });

  it("returns an existing user matched by googleId", async () => {
    const created = await User.create({
      username: "google_user",
      email: "same@example.com",
      authProvider: "google",
      googleId: "google-sub-2",
      emailVerified: true,
    });

    const user = await signInWithGoogleProfile({
      googleId: "google-sub-2",
      email: "same@example.com",
      name: "Same User",
    });

    expect(user._id.toString()).toBe(created._id.toString());
  });

  it("rejects when email belongs to a local password account", async () => {
    await User.create({
      username: "local_user",
      email: "shared@example.com",
      passwordHash: "hash",
      authProvider: "local",
    });

    await expect(
      signInWithGoogleProfile({
        googleId: "google-sub-3",
        email: "shared@example.com",
        name: "Shared Email",
      }),
    ).rejects.toMatchObject({
      code: "email_taken",
    } satisfies Partial<GoogleOAuthError>);
  });
});

describe("isGoogleOAuthEnabled", () => {
  it("requires client id, secret, and APP_URL", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
    vi.stubEnv("APP_URL", "http://localhost:3000");

    const { isGoogleOAuthEnabled } = await import("@/lib/auth/google");
    expect(isGoogleOAuthEnabled()).toBe(true);
  });
});
