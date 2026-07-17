import { describe, expect, it, vi } from "vitest";

type ProvidersRoute = typeof import("@/app/api/auth/providers/route");
type GoogleRoute = typeof import("@/app/api/auth/google/route");

describe("Google OAuth routes", () => {
  it("GET /api/auth/providers reports google=false when not configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("APP_URL", "");

    const { GET } = (await import("@/app/api/auth/providers/route")) as ProvidersRoute;
    const response = await GET(new Request("http://localhost/api/auth/providers"));
    const body = (await response.json()) as { google: boolean };

    expect(response.status).toBe(200);
    expect(body.google).toBe(false);
  });

  it("GET /api/auth/google returns 503 when not configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    vi.stubEnv("APP_URL", "");

    const { GET } = (await import("@/app/api/auth/google/route")) as GoogleRoute;
    const response = await GET(new Request("http://localhost/api/auth/google"));

    expect(response.status).toBe(503);
  });
});
