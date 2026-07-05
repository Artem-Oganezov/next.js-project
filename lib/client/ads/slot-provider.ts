import {
  REVIVE_AD_COMPLETE_EVENT,
  REVIVE_AD_DISMISSED_EVENT,
  REVIVE_AD_REQUEST_EVENT,
  type ReviveAdProvider,
} from "@/lib/client/ads/types";

const SLOT_TIMEOUT_MS = 120_000;

/**
 * Full-screen slot for an external ad script (GPT, AdSense, custom network).
 * The integrator listens for `revive-ad-request` and dispatches
 * `revive-ad-complete` or `revive-ad-dismissed` on window when done.
 */
export function createSlotReviveAdProvider(
  getMountNode: () => HTMLElement | null,
): ReviveAdProvider {
  return {
    async show() {
      const mountNode = getMountNode();
      const slotId = process.env.NEXT_PUBLIC_REVIVE_AD_SLOT_ID?.trim();
      if (!mountNode || !slotId) {
        return "failed";
      }

      mountNode.replaceChildren();
      mountNode.dataset.adSlot = "revive";
      mountNode.id = slotId;

      return new Promise((resolve) => {
        let settled = false;

        const finish = (outcome: "completed" | "dismissed" | "failed") => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          window.removeEventListener(REVIVE_AD_COMPLETE_EVENT, onComplete);
          window.removeEventListener(REVIVE_AD_DISMISSED_EVENT, onDismiss);
          mountNode.replaceChildren();
          resolve(outcome);
        };

        const onComplete = () => finish("completed");
        const onDismiss = () => finish("dismissed");
        const timeoutId = window.setTimeout(() => finish("failed"), SLOT_TIMEOUT_MS);

        window.addEventListener(REVIVE_AD_COMPLETE_EVENT, onComplete);
        window.addEventListener(REVIVE_AD_DISMISSED_EVENT, onDismiss);

        window.dispatchEvent(
          new CustomEvent(REVIVE_AD_REQUEST_EVENT, {
            detail: { slotId, mountNode },
          }),
        );
      });
    },
  };
}
