# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/), versions follow [SemVer](https://semver.org/).

## [1.8.0] — 2026-07-17

### Added

- **`scoreQueueDepth`** on `GET /api/health` and `GET /api/metrics` when `SCORE_ASYNC=true` (pending Redis list length).
- **Leaderboard rebuild:** `POST /api/admin/leaderboard/rebuild` + `scripts/rebuild-leaderboard.ts` — full Redis ZSET rebuild from Mongo.
- **Husky + lint-staged** pre-commit (Prettier + ESLint) to keep CI format/lint green.

### Changed

- **VPS-only Redis:** `REDIS_URL` (TCP / ioredis) is required. Upstash REST transport and `@upstash/redis` removed.
- Docs (`DEPLOY`, `PRODUCTION`, README): serverless/Vercel path demoted; production defaults remain async + fail-closed + trust proxy.
- Version bumped to **1.8.0**.

### Removed

- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` env support.

## [1.7.0] — 2026-07-07

### Added

- **`REQUIRE_EMAIL_VERIFICATION`** env flag — optional gate on `session/start` and `score` (`lib/game/play-guard.ts`); enabled in `.env.production.example`.
- **`MONGODB_MAX_POOL_SIZE`** validated in `lib/env.ts` (default 100, range 1–500).
- **Leaderboard cache generation** — `lb:top10:gen` invalidates stale top-10 across nodes on ban/unban.
- **Unban** restores Redis ZSET entry when user has `bestScore > 0`.
- **Buyer documentation:** [docs/BUYER-NOTES.md](docs/BUYER-NOTES.md) — product scope, limits, customization checklist.
- Tests: session cache after score (`/api/auth/me`), play guard, unban → leaderboard, stale cache bump (Redis).

### Changed

- Score route: single `parseInputLog` in `processScoreSubmission` (no duplicate parse in route).
- Removed deprecated `scoreSchema` alias (`lib/validation/score.ts`).
- Version bumped to **1.7.0**.

## [1.6.0] — 2026-07-05

### Added

- **Revive after ad (stub):** first death shows continue overlay; `POST /api/game/revive` (once per session); `inputLog` supports `{ jumpTicks, reviveAtTick }`; deterministic `engine.revive()` for server replay.
- **Ad provider layer:** `lib/client/ads` — `stub` / `slot` / `none` via `NEXT_PUBLIC_REVIVE_AD_PROVIDER`; integration guide [docs/ADS.md](docs/ADS.md).
- **Legal stubs:** Privacy/Terms sections for ads and third-party services.
- **Ops:** `GET /api/health` includes app `version`; session start rate-limit message in English.
- **Auth pages for production:** `/reset-password`, `/verify-email`, forgot-password mode in login form (`AuthForm`).
- **Verify email UX:** `GET /api/auth/verify-email` redirects to `/verify-email?status=success|error` instead of raw JSON.
- **Live prod checklist:** [docs/LIVE-PROD.md](docs/LIVE-PROD.md).

### Changed

- Revive ad default is **`none`** (soft launch); set `stub` in `.env.local` for local ad testing.
- Mobile/desktop revive overlay polish (viewport, safe areas, touch targets, jump hints).
- Version bumped to **1.6.0**.

## [1.5.0] — 2026-07-05

### Added

- **Universal game contract:** `inputLog` replaces `jumpTicks`; `scoreOrder: "desc" | "asc"` for time-attack games.
- **Account auth flows:** forgot/reset password, email verification, change password, delete account (`/api/auth/*`).
- **Email layer:** nodemailer + token model; optional SMTP via env (`APP_URL`, `SMTP_*`).
- **Security hardening:** CSP + Origin middleware, timing-safe admin compare, dummy bcrypt on failed login, `TRUST_PROXY` for client IP behind nginx.
- **Reliability:** atomic Redis `INCR+EXPIRE` rate limits; Mongo connection cache reset; atomic score/skin updates (`$inc`, pipeline updates).
- **English localization:** API messages (`lib/i18n/messages.ts`), client UI (`lib/i18n/ui.ts`), English README and [docs/VPS-DEPLOY.md](docs/VPS-DEPLOY.md).
- **Profile UI:** email verification banner, change password, delete account.
- Tests: plugin contract (10), extended auth (4) — **80 tests** total.

### Changed

- Score submit body: `{ score, sessionId, inputLog }`.
- Validation and error messages moved to English.
- Version bumped to **1.5.0**.

## [1.4.0] — 2026-07-04

### Added

- **Playwright E2E** (`e2e/`) — registration, login, full game loop through
  game over; separate CI job with Mongo + Redis.
- **Redis integration tests** (`npm run test:redis`, `vitest.redis.config.ts`) —
  rank ZSET, top-10 cache, real rate limit.
- **Observability:** in-process counters, `GET /api/metrics` (Prometheus /
  JSON), summary in `GET /api/health`.
- **Admin panel:** `/admin`, `GET /api/admin/submissions`, user ban/unban;
  suspicious submits are stored in MongoDB (`SuspiciousSubmit`).
- Prettier (`npm run format`, `format:check` in CI).
- `ADMIN_SECRET` in env for admin API and metrics protection in production.

### Changed

- Anti-cheat logs are duplicated to the DB (not only stderr).
- User ban: blocks login/me, clears sessions.

## [1.3.0] — 2026-07-04

### Added

- **Server-side score replay validation.** The game uses a
  deterministic engine (`game/engine.ts`, fixed timestep 60 ticks/sec,
  obstacles from server seed). The client sends a jump log (`jumpTicks`);
  the server replays the same run and verifies the score bit-for-bit
  (`gamePlugin.validateReplay`; optional for games without an engine).
- Tests: engine determinism, replay rejection of a plausible score
  with a forged log, autoplayer for fair runs in integration
  tests — 60 tests total.

### Changed

- `POST /api/game/score` accepts `jumpTicks` (input log for replay).
- `Game.tsx` — render and input only: simulation in the engine; run starts
  after `session/start` response (when the server is unavailable — offline run
  without saving).

## [1.2.0] — 2026-07-04

### Added

- Concurrent session cap per user (`MAX_SESSIONS_PER_USER = 5`):
  on login, oldest sessions beyond the limit are removed — forgotten cookies
  no longer stay valid until TTL expires.
- `RATE_LIMIT_FAIL_CLOSED=true` — strict rate limiting mode: when
  Redis is unavailable, rate-limited requests get 429 (default remains
  fail-open).
- Tests: session cap (oldest evicted), fail-open/fail-closed
  limiter — 51 tests total.

### Changed

- `session/start` returns 429 via shared helper `tooManyRequests`
  (consistent error format).

### Fixed

- Test count in README matches actual total.

## [1.1.0] — 2026-07-04

### Added

- `game/` module — entire game (canvas, constants, types, skins, metadata)
  in one folder; swapping games does not touch shell or API.
- `game/contract.ts` — typed contract between shell and game
  component (`GameComponentProps`).
- `game/meta.ts` — single source: id, name, description, feature flags.
- Feature flag `features.skins` — hides skins UI without editing screens.
- `X-Request-Id` on every API response + `requestId` in error logs.
- Client error messages when a run is not registered or
  score was not saved.
- Tests: health (degraded mode), logout (session destruction), skins
  (purchase, duplicate, equip) — 47 tests total.
- Documentation: `docs/NEW_GAME.md`, `docs/DEPLOY.md`, `docs/ARCHITECTURE.md`.

### Changed

- `User` type moved to `types/user.ts` (shared, game-agnostic).
- `APP_NAME`, layout metadata, and `gamePlugin.id/displayName` read from
  `game/meta.ts`.
- CI: `REDIS_URL` stub for stable build.

### Removed

- `components/DinoGame.tsx`, `lib/game/constants.ts`, `lib/game/skins.ts`,
  `types/game.types.ts` — moved to `game/`.

## [1.0.0]

Initial release: auth (bcrypt, httpOnly sessions), one-time game runs
with server seed, Redis ZSET leaderboard with Mongo fallback, rate limiting,
health check, Docker standalone, CI.
