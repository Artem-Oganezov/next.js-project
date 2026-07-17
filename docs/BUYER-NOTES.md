# Buyer notes — what you get and what to expect

This document is for purchasers of the **Game Backend Template** (white-label shell + bundled Dino Run).
It describes intentional design limits so you can evaluate the product honestly and plan your launch.

## Product scope

| Included                                                       | Not included                              |
| -------------------------------------------------------------- | ----------------------------------------- |
| Auth (register, login, sessions, password reset, email verify) | Multi-game runtime in one deploy          |
| Leaderboard + rank (Mongo source of truth, Redis hot path)     | Username change after scores are recorded |
| Anti-cheat shell (one-time sessions + server replay)           | Human/bot distinction beyond replay       |
| Skins / points economy                                         | Server-side ad impression verification    |
| Admin panel (suspicious submits, ban/unban)                    | Built-in payment / IAP                    |
| Docker + VPS deploy files                                      | Managed hosting (you bring infra)         |
| Optional async score queue + worker                            | Cross-region active-active                |

**Principle:** 1 repo = 1 game. Swap `game/` + `lib/game/plugin.ts` for a new title (~2h checklist in [NEW_GAME.md](NEW_GAME.md)).

## Security & anti-cheat

- **Replay validation** is the core guarantee: the server replays `seed + inputLog` and checks the score bit-for-bit.
- A client that sends a **valid replay** will pass — including scripted bots. This is standard for deterministic browser games without a proprietary client.
- **Revive** (`POST /api/game/revive`) trusts the client to watch an ad. Replay catches revive/score mismatches, but a user can revive without watching if they craft requests. Wire your ad network and add server callbacks if monetization requires it ([ADS.md](ADS.md)).
- **Admin secret** is sent via `X-Admin-Secret` from `/admin`. Use a long random `ADMIN_SECRET` and restrict `/admin` by IP in nginx if needed.

## Email verification

- **Default (dev):** users can play immediately after register; verification is encouraged in the profile UI.
- **Production (recommended):** set `REQUIRE_EMAIL_VERIFICATION=true` in `.env` — blocks `session/start` and `score` until the user verifies email. See `.env.production.example`.
- SMTP is optional in dev (emails log to stdout); production should set `SMTP_*` + `APP_URL`.

## Data consistency

- **MongoDB** is authoritative for users, scores, sessions.
- **Redis** caches rank, rate limits, optional async queue, session cache (~10 min TTL).
- After score/skin/ban mutations, caches are synced or invalidated. Top-10 leaderboard cache uses a **generation counter** so ban/unban on one node invalidates stale entries on others (60s TTL fallback). If the Redis rank ZSET drifts, rebuild with `POST /api/admin/leaderboard/rebuild` or `npm run rebuild:leaderboard`.
- **Async score** (`SCORE_ASYNC=true`): client polls job status; eventual consistency until worker completes. Watch `scoreQueueDepth` on `/api/health`.

## Infrastructure expectations

- **Shared Redis** across all app nodes (rate limits, rank, session cache).
- **Identical `AUTH_SECRET`** on every app node behind a load balancer.
- **`TRUST_PROXY=true`** behind nginx so IP rate limits use real client IPs.
- **`RATE_LIMIT_FAIL_CLOSED=true`** in production — reject when Redis is down instead of unlimited traffic.
- Metrics in `GET /api/metrics` are **per-process**; aggregate externally (Prometheus, etc.) on multi-node deploys.

## Customization checklist

1. `game/meta.ts` — display name, branding
2. `game/skins.ts` — skin catalog and prices
3. `lib/i18n/ui.ts` — player-facing copy
4. `lib/i18n/messages.ts` — API error messages
5. `/privacy`, `/terms` legal stubs
6. `LICENSE` — jurisdiction and operator name
7. `.env` from `.env.production.example`

## Test coverage (shipped)

- Unit + integration tests (`npm test`) — auth, score pipeline, anti-cheat, skins, admin, revive
- Redis tests (`npm run test:redis`) — leaderboard cache, session cache, rate limit, async score
- E2E (`npm run test:e2e`) — basic game-over flow

Run the full suite on your CI with Redis available before go-live. See [LIVE-PROD.md](LIVE-PROD.md).

## Support boundaries

This is a **template**, not a hosted SaaS. You own deployment, scaling, legal compliance, ad contracts, and game design changes beyond the plugin contract.

For architecture details see [ARCHITECTURE.md](ARCHITECTURE.md). For deploy steps see [VPS-DEPLOY.md](VPS-DEPLOY.md).
