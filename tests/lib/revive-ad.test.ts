import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REVIVE_AD_COMPLETE_EVENT,
  REVIVE_AD_DISMISSED_EVENT,
} from "@/lib/client/ads/types";
import {
  createReviveAdProvider,
  isReviveAdEnabled,
  resolveReviveAdProviderMode,
} from "@/lib/client/ads";
import { createSlotReviveAdProvider } from "@/lib/client/ads/slot-provider";
import { createStubReviveAdProvider } from "@/lib/client/ads/stub-provider";

function createMockMountNode() {
  return {
    replaceChildren: vi.fn(),
    dataset: {} as DOMStringMap,
    id: "",
    childNodes: [] as unknown[],
  };
}

function ensureWindowPolyfill() {
  if (typeof globalThis.window !== "undefined") return;

  const listeners = new Map<string, Set<EventListener>>();

  vi.stubGlobal("window", {
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: Event) {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
    setTimeout,
    clearTimeout,
  });

  vi.stubGlobal(
    "CustomEvent",
    class MockCustomEvent extends Event {
      detail: unknown;
      constructor(type: string, init?: CustomEventInit) {
        super(type);
        this.detail = init?.detail;
      }
    },
  );
}

describe("revive ad provider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureWindowPolyfill();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("stub provider resolves completed after configured delay", async () => {
    vi.stubEnv("NEXT_PUBLIC_REVIVE_AD_STUB_MS", "500");
    const provider = createStubReviveAdProvider();
    const promise = provider.show();
    await vi.advanceTimersByTimeAsync(500);
    await expect(promise).resolves.toBe("completed");
  });

  it("resolveReviveAdProviderMode defaults to none (soft launch)", () => {
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_REVIVE_AD_PROVIDER;
    expect(resolveReviveAdProviderMode()).toBe("none");
  });

  it("isReviveAdEnabled is false when provider is none", async () => {
    vi.stubEnv("NEXT_PUBLIC_REVIVE_AD_PROVIDER", "none");
    expect(isReviveAdEnabled()).toBe(false);
    await expect(createReviveAdProvider().show()).resolves.toBe("failed");
  });

  it("slot provider fails without mount node or slot id", async () => {
    vi.stubEnv("NEXT_PUBLIC_REVIVE_AD_SLOT_ID", "revive-slot");
    const provider = createSlotReviveAdProvider(() => null);
    await expect(provider.show()).resolves.toBe("failed");
  });

  it("slot provider completes on window event", async () => {
    vi.stubEnv("NEXT_PUBLIC_REVIVE_AD_SLOT_ID", "revive-slot");
    const mount = createMockMountNode();
    const provider = createSlotReviveAdProvider(
      () => mount as unknown as HTMLElement,
    );

    const promise = provider.show();
    await Promise.resolve();

    window.dispatchEvent(new Event(REVIVE_AD_COMPLETE_EVENT));
    await expect(promise).resolves.toBe("completed");
    expect(mount.replaceChildren).toHaveBeenCalled();
  });

  it("slot provider resolves dismissed on dismiss event", async () => {
    vi.stubEnv("NEXT_PUBLIC_REVIVE_AD_SLOT_ID", "revive-slot");
    const mount = createMockMountNode();
    const provider = createSlotReviveAdProvider(
      () => mount as unknown as HTMLElement,
    );

    const promise = provider.show();
    await Promise.resolve();
    window.dispatchEvent(new Event(REVIVE_AD_DISMISSED_EVENT));
    await expect(promise).resolves.toBe("dismissed");
  });
});
