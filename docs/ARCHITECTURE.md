# Architecture

## Layers

```
┌──────────────────────────────────────────────────────┐
│ SHELL (game-agnostic)                                │
│  components/AuthGate, HomeScreen, Leaderboard,       │
│  Profile, AuthForm · app/layout · lib/client/api     │
└──────────────────────┬───────────────────────────────┘
                       │ imports only @/game
┌──────────────────────▼───────────────────────────────┐
│ GAME (swap per project)                              │
│  game/Game.tsx · constants · types · skins · meta    │
│  contract: game/contract.ts                          │
└──────────────────────┬───────────────────────────────┘
                       │ api.startGameSession / submitScore
┌──────────────────────▼───────────────────────────────┐
│ API (universal, game-agnostic)                       │
│  app/api/auth/* · game/* · leaderboard/* · skins ·   │
│  health · single game hook: lib/game/plugin          │
└──────────┬──────────────────────────┬────────────────┘
           │                          │
┌──────────▼──────────┐    ┌──────────▼────────────────┐
│ MongoDB             │    │ Redis                     │
│ source of truth:    │    │ hot path: rank ZSET,      │
│ User, Session,      │    │ top-10 cache, rate limit  │
│ GameSession (TTL)   │    │ rate limit, score queue   │
│                     │    │ (fail-closed recommended) │
└─────────────────────┘    └───────────────────────────┘
```

## Key decisions

**One deploy = one game.** No `gameId` in the database or API. A new game means a new fork with its own `.env`.

**`lib/game/plugin.ts` is the only game-specific backend hook.** Routes import `gamePlugin` and do not know which game runs. Metadata (name, features) lives in `game/meta.ts`; the plugin reuses it.

**Anti-cheat — heuristics + server replay.** One-time sessions (`GameSession`, atomic claim via `findOneAndUpdate`), score-per-second cap, min/max duration. On top of that, replay validation: the game is deterministic (fixed timestep 60 ticks/sec, `game/engine.ts`); the client sends a jump log; the server replays the run from the seed and compares the score bit-for-bit (`gamePlugin.validateReplay`, optional for non-deterministic games). Suspicious submissions go to stderr with `scope: "anti-cheat"`.

**Redis degrades gracefully.** Rank falls back to Mongo `countDocuments`; top-10 falls back to a direct query; rate limiting is fail-open by default (the limiter must not take down the API; production should set `RATE_LIMIT_FAIL_CLOSED=true` for 429 when Redis is down). `GET /api/health` returns `degraded` for monitoring and includes `scoreQueueDepth` when `SCORE_ASYNC=true`.

**Sessions.** Token (32 bytes) in an httpOnly cookie; Mongo stores only SHA-256(token + AUTH_SECRET). TTL indexes clean expired Session and GameSession records. Cap on concurrent sessions per user (`MAX_SESSIONS_PER_USER`): on login, oldest sessions beyond the cap are removed — forgotten cookies do not live until TTL expiry.

**requestId.** Every API response includes `X-Request-Id`; server error logs use the same id — bug reports map to server logs.

**Observability.** In-process counters (`lib/observability/metrics.ts`): HTTP requests by scope/status, rate-limit denials, anti-cheat rejections. `GET /api/metrics` — Prometheus text; `GET /api/health` — short summary.

**Moderation.** Suspicious submissions → MongoDB + stderr. Admin UI at `/admin` and `GET /api/admin/submissions` (header `X-Admin-Secret` = `ADMIN_SECRET`). Bans invalidate sessions and block login.

## Data flows

**Score submit:** cookie session → rate limit (IP + userId) → Zod → GameSession exists and is open → validateScore (time/ceiling) → validateReplay (replay from seed + jumpTicks, score bit-for-bit) → atomic claim → update User → ZSET + invalidate top-10 → rank.

**Rank:** Redis ZSET O(log N); empty ZSET is seeded once from Mongo via cursor; when Redis is unavailable — count by `bestScore` index.

## Known boundaries (intentional)

- Replay proves a run followed the rules but does not distinguish a human from a bot playing honestly (behavioral analysis is out of scope).
- Rate limiting is fail-open by default when Redis is down (optional fail-closed via `RATE_LIMIT_FAIL_CLOSED=true`).
- User update + ZSET are not in a transaction: if something fails between them, rebuild via `POST /api/admin/leaderboard/rebuild` or `npx tsx scripts/rebuild-leaderboard.ts` (ZSET also self-heals on empty seed).
- Equal `bestScore` values share the same rank (consistent in Redis and Mongo).
