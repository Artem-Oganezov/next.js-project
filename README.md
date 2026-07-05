# Game Backend Template (+ Dino Run)

Universal backend for browser games built around **score → personal best → leaderboard** on Next.js.
The bundled game is Dino Run; to ship another title, swap the **`game/` folder** and
**one plugin file** — auth, leaderboard, anti-cheat shell, and rate limiting stay the same.

Principle: **1 repo = 1 game**. A new game is a new fork (see
[docs/NEW_GAME.md](docs/NEW_GAME.md), ~2 hour checklist).

Docs: [New game](docs/NEW_GAME.md) · [Deploy](docs/DEPLOY.md) ·
[Live prod checklist](docs/LIVE-PROD.md) · [VPS + HTTPS](docs/VPS-DEPLOY.md) ·
[Architecture](docs/ARCHITECTURE.md) · [Changelog](CHANGELOG.md)

## Features

- Registration and login (bcrypt, httpOnly sessions in MongoDB; concurrent session cap per user)
- Top-10 leaderboard and player rank (Redis ZSET, O(log N))
- Anti-cheat: one-time sessions + server-side **replay validation** — the server replays the run from seed + input log and verifies the score (see below)
- Rate limiting in Redis by IP and userId (fail-open by default; `RATE_LIMIT_FAIL_CLOSED=true` for strict 429 when Redis is down)
- Health check `GET /api/health` (Mongo + Redis + metrics summary) — for load balancers
- Metrics `GET /api/metrics` (Prometheus text / JSON)
- Admin panel `/admin` + API: suspicious submit log, user ban/unban
- Account management: password reset, email verification, change password, delete account
- Security: CSP + Origin check middleware, timing-safe admin secret, atomic Redis rate limits
- Stateless API: ready for multiple app servers behind a load balancer
- Docker (standalone build), GitHub Actions: format, lint, unit/integration, Redis tests, E2E (Playwright), build

## Stack

- **Frontend:** Next.js App Router, React 19, Tailwind CSS 4, canvas
- **Backend:** Route Handlers, Mongoose, Zod
- **Data:** MongoDB (source of truth) + Redis (hot path: rank, rate limit)
- **Deploy:** Docker on VPS (recommended) or Vercel + Upstash

## Quick start (local)

```bash
cp .env.example .env.local          # Windows: Copy-Item .env.example .env.local
docker compose -f docker-compose.dev.yml up -d   # local Mongo + Redis
npm install
npm test
npm run dev
```

`.env.local` for local dev:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/game
REDIS_URL=redis://127.0.0.1:6379
AUTH_SECRET=<openssl rand -base64 32>
ADMIN_SECRET=<openssl rand -base64 32>   # optional: /admin and /api/metrics
APP_URL=http://localhost:3000            # email links (optional without SMTP)
```

## How to ship a NEW game on this backend

Full checklist: [docs/NEW_GAME.md](docs/NEW_GAME.md). In short:

1. **Fork/copy the repo.**
2. **`game/meta.ts`** — id, display name, feature flags (e.g. `skins: false`).
3. **`lib/game/plugin.ts`** — the only game-specific backend file:

   ```ts
   const scoreRules: ScoreRulesConfig = {
     maxScorePerSecond: 2,
     scoreGrace: 3,
     maxGameDurationMs: 10 * 60 * 1000,
     minGameDurationMs: 1000,
   };
   ```

4. **Replace the `game/` folder** (canvas `Game.tsx`, constants, types, skins). Client contract (`game/contract.ts`) stays the same:
   - `POST /api/game/session/start` — before a run; returns `sessionId` and `seed`
   - `POST /api/game/score { score, sessionId, inputLog }` — returns `bestScore`, `isNewRecord`, `rank`, `nextUsername`; `inputLog` is the input record for server replay validation (remove `validateReplay` from the plugin if your game is not deterministic)
5. New `.env` (separate DB) and deploy. Routes, auth, leaderboard, and shell screens stay untouched.

## Anti-cheat

The shell is game-agnostic; thresholds live in `lib/game/plugin.ts`:

1. **One-time run.** `session/start` creates a `GameSession` (Mongo, TTL); scores are accepted only with a valid `sessionId`. Resubmit is rejected atomically.
2. **Run duration.** Min/max duration + score-per-second cap (`maxScorePerSecond`).
3. **Replay validation.** For deterministic games: fixed 60 ticks/sec engine, obstacles from server seed. Client sends `inputLog`, server replays and compares score bit-for-bit.
4. **Rate limit by userId** on game endpoints (not only IP).
5. **Suspicious submit log** — stderr + MongoDB for monitoring and bans.

Remaining boundary: replay proves the run followed game rules, not that a human played it.

## API

| Method       | Path                              | Description                                      |
| ------------ | --------------------------------- | ------------------------------------------------ |
| `GET`        | `/api/health`                     | Mongo + Redis + observability summary            |
| `GET`        | `/api/metrics`                    | Prometheus / JSON metrics                          |
| `POST`       | `/api/auth/register`              | Register                                         |
| `POST`       | `/api/auth/login`                 | Log in                                           |
| `POST`       | `/api/auth/logout`                | Log out                                          |
| `GET`        | `/api/auth/me`                    | Current user                                     |
| `POST`       | `/api/auth/forgot-password`       | Send password reset email → `/reset-password`    |
| `POST`       | `/api/auth/reset-password`        | Reset password with token (also `/reset-password`) |
| `POST`       | `/api/auth/resend-verification`   | Resend email verification (authenticated)        |
| `GET`        | `/api/auth/verify-email`          | Verify email → redirect `/verify-email?status=` |
| `PUT`        | `/api/auth/password`              | Change password (authenticated)                  |
| `DELETE`     | `/api/auth/account`               | Delete account (authenticated)                   |
| `POST`       | `/api/game/session/start`         | Start run → `sessionId` + `seed`                   |
| `POST`       | `/api/game/revive`                | Mark revive used (once per session, before continue) |
| `POST`       | `/api/game/score`                 | `{ score, sessionId, inputLog }` → best + rank   |
| `GET`        | `/api/leaderboard`                | Top 10 (60s Redis cache)                         |
| `GET`        | `/api/leaderboard/rank`           | Current user rank                                |
| `POST`/`PUT` | `/api/skins`                      | Unlock / equip skin                              |

## Deploy on VPS (Docker)

See [docs/VPS-DEPLOY.md](docs/VPS-DEPLOY.md) for HTTPS, nginx, and `TRUST_PROXY`.

```bash
git clone <repo> && cd <repo>
cp .env.example .env    # MONGODB_URI (Atlas!), AUTH_SECRET, REDIS_URL, APP_URL
docker compose up -d --build
```

- **Mongo outside** the app node (Atlas / dedicated server).
- Redis runs in compose next to the app; for multiple servers, host Redis separately and update `REDIS_URL`.

### Horizontal scaling

1. Shared Redis and Mongo, off the app nodes.
2. New VPS: same image + **same `.env`** (identical `AUTH_SECRET`).
3. Add the server to the load balancer upstream — see `nginx.example.conf`.

API is stateless; sticky sessions are not required. `GET /api/health` returns 503 when Mongo is down so the LB can drain the node.

## Tests and CI

```bash
npm test              # vitest: unit + integration (mongodb-memory-server)
npm run test:redis    # Redis branch (needs redis://127.0.0.1:6379)
npm run test:e2e      # Playwright (Mongo + Redis + build/start)
npm run lint
npm run format:check
npm run build
```

`.github/workflows/ci.yml` — format, lint, unit/integration, Redis tests, build, E2E.

## Admin and moderation

1. Set `ADMIN_SECRET` (≥32 chars) in `.env`.
2. Open `/admin`, enter the secret — view anti-cheat submit log from MongoDB.
3. API: `GET /api/admin/submissions`, `POST/DELETE /api/admin/users/:id/ban` with header `X-Admin-Secret`.

Banned users cannot log in; active sessions are cleared.

## Project structure

```
app/api/           # Route handlers (universal, game-agnostic)
components/        # Shell UI: AuthGate, screens (game-agnostic)
game/              # Entire game — replace wholesale for a new title
  Game.tsx           # Canvas component (render + input)
  engine.ts          # Deterministic engine (fixed timestep, replay)
  contract.ts        # Shell ↔ game contract (GameComponentProps)
  meta.ts            # id, name, feature flags
lib/
  game/plugin.ts     # ONLY game-specific backend file
  i18n/messages.ts   # API strings (English)
  i18n/ui.ts         # Client UI strings (English)
types/user.ts      # Shared User type
tests/             # Vitest + Playwright e2e/
docs/              # NEW_GAME, DEPLOY, VPS-DEPLOY, ARCHITECTURE
```

## License

Proprietary — see [LICENSE](LICENSE).
