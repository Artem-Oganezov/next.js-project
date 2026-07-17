# Revive ads integration

Revive uses a client-side **ad provider** so you can swap stub → Google Ad Manager without touching game logic or anti-cheat.

## Flow

1. Player dies once → revive overlay.
2. **Watch ad & continue** → `createReviveAdProvider().show()`.
3. Only on outcome **`completed`** → `POST /api/game/revive` → `engine.revive()`.
4. Second death → score submit with `{ jumpTicks, reviveAtTick }`.

The server does **not** verify that an ad was shown — same as most browser games. Revive is gated by `reviveUsed` on `GameSession` (once per run).

## Environment

```env
# none  — soft launch: save score / play again on first death
# stub  — local dev: fake ad delay before continue
# slot  — Google Ad Manager (GPT) — built into the app
NEXT_PUBLIC_REVIVE_AD_PROVIDER=slot

# Google Ad Manager ad unit path (from Inventory → Ad units):
NEXT_PUBLIC_GAM_AD_UNIT_PATH=/12345678/revive_interstitial
# Or split:
# NEXT_PUBLIC_GAM_NETWORK_ID=12345678
# NEXT_PUBLIC_GAM_AD_UNIT_NAME=revive_interstitial

# interstitial (default) or rewarded — must match your GAM unit type
NEXT_PUBLIC_GAM_AD_FORMAT=interstitial

# stub delay in ms (optional, default 1200) — only when provider=stub
NEXT_PUBLIC_REVIVE_AD_STUB_MS=1200

# slot DOM id (optional, default revive-ad-slot)
NEXT_PUBLIC_REVIVE_AD_SLOT_ID=revive-ad-slot
```

For local testing without Google, set in `.env.local`:

```env
NEXT_PUBLIC_REVIVE_AD_PROVIDER=stub
```

**Docker:** `NEXT_PUBLIC_*` is embedded at **image build**. After changing ad env, run:

```bash
docker compose up -d --build
```

## Mode: `stub`

No external SDK. Waits `NEXT_PUBLIC_REVIVE_AD_STUB_MS` then resolves `completed`. Used in dev and CI.

## Mode: `slot` (Google Ad Manager — production)

The app ships with **`components/ReviveAdGoogle.tsx`**: loads GPT, listens for `revive-ad-request`, shows an out-of-page interstitial or rewarded ad, and dispatches `revive-ad-complete` / `revive-ad-dismissed`.

### What you configure in Google (not in code)

1. Create an account at [Google Ad Manager](https://admanager.google.com/).
2. Add your **HTTPS domain** (same as `APP_URL`).
3. Create an ad unit:
   - **Interstitial** (web) — `NEXT_PUBLIC_GAM_AD_FORMAT=interstitial`
   - **Rewarded** (web) — `NEXT_PUBLIC_GAM_AD_FORMAT=rewarded`
4. Copy **Network code** + **Ad unit name** into env (see above).
5. Wait for site approval. Until then, slots may be empty → player sees Save score (no revive).

Mobile and desktop browsers both count toward GAM web revenue in one report.

### Custom integrators

The slot provider still emits window events if you replace GPT with another network:

| Event                 | When                                                    |
| --------------------- | ------------------------------------------------------- |
| `revive-ad-request`   | Player tapped continue; `detail: { slotId, mountNode }` |
| `revive-ad-complete`  | Grant revive                                            |
| `revive-ad-dismissed` | No revive; player can save score                        |

Timeout: **120s** without an event → `failed`.

CSP allowlists Google domains automatically when `NEXT_PUBLIC_REVIVE_AD_PROVIDER=slot` (see `lib/security/csp.ts`).

## Mode: `none`

Disable monetized revive. Overlay shows **Save score** and **Play again** only.

## Legal

Before enabling real ads, update `/privacy` and `/terms` in `lib/i18n/ui.ts` (ads & third-party sections), list **Google Ad Manager**, and add a cookie/consent mechanism if required in your region (GDPR/ePrivacy).

## Testing

- Unit: `tests/lib/revive-ad.test.ts`, `tests/lib/gam-config.test.ts`, `tests/lib/csp.test.ts`
- Local revive flow: `NEXT_PUBLIC_REVIVE_AD_PROVIDER=stub`
- Production smoke: real device (iPhone Safari + Android Chrome) after GAM approval
