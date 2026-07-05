import { describe, expect, it } from "vitest";
import {
  AntiCheatReason,
  antiCheatMetricLabel,
} from "@/lib/security/anti-cheat-reasons";

describe("antiCheatMetricLabel", () => {
  it("maps stable reason codes to metric labels", () => {
    expect(antiCheatMetricLabel(AntiCheatReason.SCORE_CEILING)).toBe("score-ceiling");
    expect(antiCheatMetricLabel(AntiCheatReason.REPLAY_SCORE_MISMATCH)).toBe("replay");
    expect(antiCheatMetricLabel(AntiCheatReason.REVIVE_MISMATCH)).toBe("revive");
    expect(antiCheatMetricLabel(AntiCheatReason.DUPLICATE_SUBMIT)).toBe("duplicate");
    expect(antiCheatMetricLabel(AntiCheatReason.RUN_TOO_SHORT)).toBe("timing");
    expect(antiCheatMetricLabel("unknown-code")).toBe("other");
  });
});
