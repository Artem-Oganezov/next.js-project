import { afterEach, describe, expect, it, vi } from "vitest";
import { createConsoleEmailSender } from "@/lib/email/console";

describe("createConsoleEmailSender", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs email body in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await createConsoleEmailSender().send({
      to: "user@example.com",
      subject: "Reset",
      text: "https://app/reset?token=secret-token",
    });

    const payload = JSON.parse(String(info.mock.calls[0]?.[0])) as { text?: string };
    expect(payload.text).toContain("secret-token");
  });

  it("redacts email body outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await createConsoleEmailSender().send({
      to: "user@example.com",
      subject: "Reset",
      text: "https://app/reset?token=secret-token",
    });

    const payload = JSON.parse(String(info.mock.calls[0]?.[0])) as {
      to: string;
      subject: string;
      text?: string;
    };
    expect(payload.to).toBe("user@example.com");
    expect(payload.subject).toBe("Reset");
    expect(payload.text).toBeUndefined();
  });
});
