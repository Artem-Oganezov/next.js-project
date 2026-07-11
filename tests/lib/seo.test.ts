import { describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("SEO routes", () => {
  it("robots.txt disallows admin and api", () => {
    vi.stubEnv("APP_URL", "https://example.com");

    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules;

    expect(rules?.disallow).toEqual(
      expect.arrayContaining(["/admin", "/api/", "/reset-password", "/verify-email"]),
    );
    expect(config.sitemap).toBe("https://example.com/sitemap.xml");
  });

  it("sitemap.xml lists public pages", () => {
    vi.stubEnv("APP_URL", "https://example.com");

    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual([
      "https://example.com",
      "https://example.com/privacy",
      "https://example.com/terms",
    ]);
  });
});
