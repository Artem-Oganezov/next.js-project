import type { ReviveAdProviderMode } from "@/lib/client/ads/types";

export type GamAdFormat = "interstitial" | "rewarded";

function resolveReviveAdProviderMode(): ReviveAdProviderMode {
  const raw = process.env.NEXT_PUBLIC_REVIVE_AD_PROVIDER?.trim().toLowerCase();
  if (raw === "none" || raw === "slot" || raw === "stub") {
    return raw;
  }
  return "none";
}

/**
 * Full GAM ad unit path, e.g. `/12345678/revive_interstitial`.
 * Set directly via NEXT_PUBLIC_GAM_AD_UNIT_PATH, or build from network id + unit name.
 */
export function getGamAdUnitPath(): string | null {
  const direct = process.env.NEXT_PUBLIC_GAM_AD_UNIT_PATH?.trim();
  if (direct) {
    return direct.startsWith("/") ? direct : `/${direct}`;
  }

  const networkId = process.env.NEXT_PUBLIC_GAM_NETWORK_ID?.trim();
  const unitName = process.env.NEXT_PUBLIC_GAM_AD_UNIT_NAME?.trim();
  if (networkId && unitName) {
    return `/${networkId}/${unitName}`;
  }

  return null;
}

export function getGamAdFormat(): GamAdFormat {
  const raw = process.env.NEXT_PUBLIC_GAM_AD_FORMAT?.trim().toLowerCase();
  return raw === "rewarded" ? "rewarded" : "interstitial";
}

/** True when slot mode is enabled and GAM IDs are configured. */
export function isGamReviveConfigured(): boolean {
  return resolveReviveAdProviderMode() === "slot" && getGamAdUnitPath() !== null;
}
