"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import {
  getGamAdFormat,
  getGamAdUnitPath,
} from "@/lib/client/ads/gam-config";
import {
  REVIVE_AD_COMPLETE_EVENT,
  REVIVE_AD_DISMISSED_EVENT,
  REVIVE_AD_REQUEST_EVENT,
} from "@/lib/client/ads/types";

const GPT_SRC = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";

function dispatchReviveOutcome(eventName: string): void {
  window.dispatchEvent(new Event(eventName));
}

function showGamReviveAd(): void {
  const adUnitPath = getGamAdUnitPath();
  if (!adUnitPath || typeof window.googletag === "undefined") {
    dispatchReviveOutcome(REVIVE_AD_DISMISSED_EVENT);
    return;
  }

  const format = getGamAdFormat();

  window.googletag.cmd.push(() => {
    let settled = false;
    const finish = (outcome: "complete" | "dismiss") => {
      if (settled) return;
      settled = true;
      dispatchReviveOutcome(
        outcome === "complete"
          ? REVIVE_AD_COMPLETE_EVENT
          : REVIVE_AD_DISMISSED_EVENT,
      );
      try {
        window.googletag.destroySlots();
      } catch {
        /* ignore cleanup errors */
      }
    };

    const outOfPageFormat =
      format === "rewarded"
        ? window.googletag.enums.OutOfPageFormat.REWARDED
        : window.googletag.enums.OutOfPageFormat.INTERSTITIAL;

    const slot = window.googletag.defineOutOfPageSlot(adUnitPath, outOfPageFormat);
    if (!slot) {
      finish("dismiss");
      return;
    }

    slot.addService(window.googletag.pubads());

    if (format === "rewarded") {
      let granted = false;

      window.googletag.pubads().addEventListener("rewardedSlotReady", (event) => {
        event.makeRewardedVisible?.();
      });
      window.googletag.pubads().addEventListener("rewardedSlotGranted", () => {
        granted = true;
      });
      window.googletag.pubads().addEventListener("rewardedSlotClosed", (event) => {
        const rewarded = granted || Boolean(event.payload?.reward);
        finish(rewarded ? "complete" : "dismiss");
      });
    } else {
      let rendered = false;

      window.googletag.pubads().addEventListener("slotRenderEnded", (event) => {
        if (event.slot !== slot) return;
        if (event.isEmpty) {
          finish("dismiss");
          return;
        }
        rendered = true;
      });
      window.googletag.pubads().addEventListener("slotVisibilityChanged", (event) => {
        if (event.slot !== slot || !rendered) return;
        if (event.inViewPercentage === 0) {
          finish("complete");
        }
      });
    }

    window.googletag.enableServices();
    window.googletag.display(slot);
  });
}

/**
 * Loads Google Publisher Tag and serves revive interstitials when
 * NEXT_PUBLIC_REVIVE_AD_PROVIDER=slot and GAM env IDs are set.
 */
export default function ReviveAdGoogle() {
  const gptReady = useRef(false);

  useEffect(() => {
    window.googletag = window.googletag || { cmd: [] };

    const onRequest = () => {
      if (!gptReady.current) {
        dispatchReviveOutcome(REVIVE_AD_DISMISSED_EVENT);
        return;
      }
      showGamReviveAd();
    };

    window.addEventListener(REVIVE_AD_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(REVIVE_AD_REQUEST_EVENT, onRequest);
  }, []);

  return (
    <Script
      id="google-gpt"
      src={GPT_SRC}
      strategy="afterInteractive"
      crossOrigin="anonymous"
      onLoad={() => {
        window.googletag = window.googletag || { cmd: [] };
        gptReady.current = true;
      }}
      onError={() => {
        gptReady.current = false;
      }}
    />
  );
}
