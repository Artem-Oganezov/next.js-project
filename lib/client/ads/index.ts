import { createSlotReviveAdProvider } from "@/lib/client/ads/slot-provider";
import { createStubReviveAdProvider } from "@/lib/client/ads/stub-provider";
import type {
  ReviveAdProvider,
  ReviveAdProviderMode,
} from "@/lib/client/ads/types";

const unavailableProvider: ReviveAdProvider = {
  async show() {
    return "failed";
  },
};

export function resolveReviveAdProviderMode(): ReviveAdProviderMode {
  const raw = process.env.NEXT_PUBLIC_REVIVE_AD_PROVIDER?.trim().toLowerCase();
  if (raw === "none" || raw === "slot" || raw === "stub") {
    return raw;
  }
  // Soft launch default: no ad button unless explicitly configured.
  return "none";
}

export function isReviveAdEnabled(): boolean {
  return resolveReviveAdProviderMode() !== "none";
}

export function createReviveAdProvider(
  getMountNode?: () => HTMLElement | null,
): ReviveAdProvider {
  switch (resolveReviveAdProviderMode()) {
    case "none":
      return unavailableProvider;
    case "slot":
      return createSlotReviveAdProvider(getMountNode ?? (() => null));
    case "stub":
    default:
      return createStubReviveAdProvider();
  }
}

export type { ReviveAdOutcome, ReviveAdProvider } from "@/lib/client/ads/types";
export {
  REVIVE_AD_COMPLETE_EVENT,
  REVIVE_AD_DISMISSED_EVENT,
  REVIVE_AD_REQUEST_EVENT,
} from "@/lib/client/ads/types";
