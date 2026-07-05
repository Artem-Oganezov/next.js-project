import { describe, expect, it } from "vitest";
import { AntiCheatReason } from "@/lib/security/anti-cheat-reasons";
import { formatAntiCheatReason } from "@/lib/security/anti-cheat-labels";

describe("formatAntiCheatReason", () => {
  it("returns human label for known codes", () => {
    expect(formatAntiCheatReason(AntiCheatReason.SCORE_CEILING)).toMatch(/too high/i);
    expect(formatAntiCheatReason(AntiCheatReason.REPLAY_SCORE_MISMATCH)).toMatch(/replay/i);
  });

  it("falls back to raw code for unknown values", () => {
    expect(formatAntiCheatReason("custom-code")).toBe("custom-code");
  });
});
