/** Minimal GPT typings for revive interstitial / rewarded integration. */
declare namespace googletag {
  const cmd: Array<() => void>;
  const enums: {
    OutOfPageFormat: {
      INTERSTITIAL: unknown;
      REWARDED: unknown;
    };
  };

  function defineOutOfPageSlot(
    adUnitPath: string,
    format: unknown,
  ): GoogletagSlot | null;
  function destroySlots(slots?: GoogletagSlot[]): boolean;
  function display(slot: GoogletagSlot | string): void;
  function enableServices(): void;
  function pubads(): GoogletagPubAds;

  interface GoogletagSlot {
    addService(service: GoogletagPubAds): GoogletagSlot;
  }

  interface GoogletagPubAds {
    addEventListener(
      eventType: string,
      listener: (event: GoogletagEvent) => void,
    ): void;
    enableSingleRequest(): void;
  }

  interface GoogletagEvent {
    slot: GoogletagSlot;
    isEmpty?: boolean;
    inViewPercentage?: number;
    payload?: { reward?: boolean };
    makeRewardedVisible?: () => void;
  }
}

interface Window {
  googletag: typeof googletag;
}
