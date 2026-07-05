import type { ReviveAdProvider } from "@/lib/client/ads/types";

const DEFAULT_STUB_MS = 1200;

function resolveStubDelayMs(): number {
  const raw = process.env.NEXT_PUBLIC_REVIVE_AD_STUB_MS;
  if (!raw) return DEFAULT_STUB_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_STUB_MS;
}

export function createStubReviveAdProvider(): ReviveAdProvider {
  return {
    async show() {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, resolveStubDelayMs());
      });
      return "completed";
    },
  };
}
