# Revive ads integration

Revive uses a small client-side **ad provider** so you can swap stub → production without touching game logic or anti-cheat.

## Flow

1. Player dies once → revive overlay.
2. **Watch ad & continue** → `createReviveAdProvider().show()`.
3. Only on outcome **`completed`** → `POST /api/game/revive` → `engine.revive()`.
4. Second death → score submit with `{ jumpTicks, reviveAtTick }`.

The server does **not** verify that an ad was shown — same as most browser games. Revive is gated by `reviveUsed` on `GameSession` (once per run).

## Environment

```env
# none  — soft launch default: save score / play again on first death
# stub  — local dev: fake ad delay before continue
# slot  — production web interstitial via window events
NEXT_PUBLIC_REVIVE_AD_PROVIDER=none

# stub delay in ms (optional, default 1200) — only when provider=stub
NEXT_PUBLIC_REVIVE_AD_STUB_MS=1200

# slot mode: DOM id for the ad mount node (required for slot)
NEXT_PUBLIC_REVIVE_AD_SLOT_ID=revive-ad-slot
```

For local ad-flow testing, set in `.env.local`:

```env
NEXT_PUBLIC_REVIVE_AD_PROVIDER=stub
```

## Mode: `stub`

No external SDK. Waits `NEXT_PUBLIC_REVIVE_AD_STUB_MS` then resolves `completed`. Used in dev and CI.

## Mode: `slot` (production hook)

1. Set `NEXT_PUBLIC_REVIVE_AD_PROVIDER=slot` and `NEXT_PUBLIC_REVIVE_AD_SLOT_ID`.
2. Load your ad network script in `app/layout.tsx` or a dedicated component.
3. Listen for the request event and render the interstitial:

```html
<script>
  window.addEventListener("revive-ad-request", (event) => {
    const { slotId, mountNode } = event.detail;
    // Example: render GPT / iframe / network SDK into mountNode
    // When the user finishes watching:
    window.dispatchEvent(new Event("revive-ad-complete"));
    // If the user closes without reward:
    // window.dispatchEvent(new Event("revive-ad-dismissed"));
  });
</script>
```

Events (defined in `lib/client/ads/types.ts`):

| Event | When |
| ----- | ---- |
| `revive-ad-request` | Player tapped continue; `detail: { slotId, mountNode }` |
| `revive-ad-complete` | Grant revive |
| `revive-ad-dismissed` | No revive; player can save score |

Timeout: **120s** without an event → `failed`.

## Mode: `none`

Disable monetized revive (e.g. kid-friendly build or ad-free tier). Overlay shows **Save score** and **Play again** only.

## Legal

Before enabling real ads, update `/privacy` and `/terms` copy in `lib/i18n/ui.ts` (ads & third-party sections) and comply with COPPA/GDPR/ePrivacy for your audience.

## Testing

- Unit: `tests/lib/revive-ad.test.ts`
- E2E uses default `stub` — no network calls.
