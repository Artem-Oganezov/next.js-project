import { beforeAll, describe, expect, it } from "vitest";

type HealthRoute = typeof import("@/app/api/health/route");

let healthGet: HealthRoute["GET"];

beforeAll(async () => {
  const health = await import("@/app/api/health/route");
  healthGet = health.GET;
});

describe("Health API", () => {
  it("GET /api/health returns degraded when Redis is down but Mongo is up", async () => {
    const response = await healthGet(new Request("http://localhost/api/health"));
    const body = (await response.json()) as {
      status: string;
      version: string;
      mongo: string;
      redis: string;
      scoreQueueDepth: number | null;
      timestamp: string;
    };

    // In tests Redis is intentionally unavailable (see tests/setup.ts):
    // the service degrades but does not crash — the load balancer keeps the node in rotation.
    expect(response.status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(body.mongo).toBe("connected");
    expect(body.redis).toBe("disconnected");
    expect(body).toHaveProperty("scoreQueueDepth");
    expect(body.scoreQueueDepth).toBeNull();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it("GET /api/health responds with X-Request-Id header", async () => {
    const response = await healthGet(new Request("http://localhost/api/health"));
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
  });
});
