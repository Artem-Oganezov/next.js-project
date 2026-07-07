import { describe, expect, it } from "vitest";
import { darkenColor, GAME_THEME } from "@/game/theme";

describe("darkenColor", () => {
  it("darkens hex skin colors for limbs", () => {
    expect(darkenColor("#ff6f5e")).toBe("#d15b4d");
    expect(darkenColor("#7c5cff")).toBe("#664bd1");
  });

  it("falls back to theme leg color for non-hex values", () => {
    expect(darkenColor("var(--coral)")).toBe(GAME_THEME.leg);
  });
});
