/** Result of a revive interstitial — server revive is granted only on `completed`. */
export type ReviveAdOutcome = "completed" | "dismissed" | "failed";

export type ReviveAdProvider = {
  show(): Promise<ReviveAdOutcome>;
};

export type ReviveAdProviderMode = "stub" | "slot" | "none";

export const REVIVE_AD_COMPLETE_EVENT = "revive-ad-complete";
export const REVIVE_AD_DISMISSED_EVENT = "revive-ad-dismissed";
export const REVIVE_AD_REQUEST_EVENT = "revive-ad-request";
