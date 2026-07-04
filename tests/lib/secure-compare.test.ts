import { describe, expect, it } from "vitest";
import { secureCompare } from "@/lib/security/secure-compare";

describe("secureCompare", () => {
  it("returns true for equal strings", () => {
    expect(secureCompare("secret-value-32-chars-minimum!!", "secret-value-32-chars-minimum!!")).toBe(
      true,
    );
  });

  it("returns false for different strings of same length", () => {
    expect(secureCompare("secret-value-32-chars-minimum!!", "secret-value-32-chars-minimum?x")).toBe(
      false,
    );
  });

  it("returns false when lengths differ", () => {
    expect(secureCompare("short", "much-longer-value")).toBe(false);
  });
});
