import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getGamAdFormat,
  getGamAdUnitPath,
  isGamReviveConfigured,
} from "@/lib/client/ads/gam-config";

describe("GAM config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds ad unit path from network id and unit name", () => {
    vi.stubEnv("NEXT_PUBLIC_GAM_NETWORK_ID", "12345678");
    vi.stubEnv("NEXT_PUBLIC_GAM_AD_UNIT_NAME", "revive_interstitial");
    expect(getGamAdUnitPath()).toBe("/12345678/revive_interstitial");
  });

  it("uses direct ad unit path when set", () => {
    vi.stubEnv("NEXT_PUBLIC_GAM_AD_UNIT_PATH", "/999/unit");
    expect(getGamAdUnitPath()).toBe("/999/unit");
  });

  it("prefixes slash when direct path omits it", () => {
    vi.stubEnv("NEXT_PUBLIC_GAM_AD_UNIT_PATH", "888/revive");
    expect(getGamAdUnitPath()).toBe("/888/revive");
  });

  it("defaults ad format to interstitial", () => {
    delete process.env.NEXT_PUBLIC_GAM_AD_FORMAT;
    expect(getGamAdFormat()).toBe("interstitial");
  });

  it("supports rewarded format", () => {
    vi.stubEnv("NEXT_PUBLIC_GAM_AD_FORMAT", "rewarded");
    expect(getGamAdFormat()).toBe("rewarded");
  });

  it("isGamReviveConfigured requires slot mode and path", () => {
    vi.stubEnv("NEXT_PUBLIC_REVIVE_AD_PROVIDER", "slot");
    vi.stubEnv("NEXT_PUBLIC_GAM_AD_UNIT_PATH", "/1/revive");
    expect(isGamReviveConfigured()).toBe(true);
  });

  it("isGamReviveConfigured is false without path", () => {
    vi.stubEnv("NEXT_PUBLIC_REVIVE_AD_PROVIDER", "slot");
    delete process.env.NEXT_PUBLIC_GAM_AD_UNIT_PATH;
    delete process.env.NEXT_PUBLIC_GAM_NETWORK_ID;
    delete process.env.NEXT_PUBLIC_GAM_AD_UNIT_NAME;
    expect(isGamReviveConfigured()).toBe(false);
  });
});
