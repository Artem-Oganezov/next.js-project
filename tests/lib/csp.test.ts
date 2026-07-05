import { describe, expect, it, vi } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/security/csp";

describe("buildContentSecurityPolicy", () => {
  it("uses strict policy when ads are disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_REVIVE_AD_PROVIDER", "none");
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("googlesyndication.com");
    vi.unstubAllEnvs();
  });

  it("allowlists Google domains when slot mode is enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_REVIVE_AD_PROVIDER", "slot");
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("securepubads.g.doubleclick.net");
    expect(csp).toContain("googlesyndication.com");
    vi.unstubAllEnvs();
  });
});
