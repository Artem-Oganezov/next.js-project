# Dino Run

Production-ready браузерная игра (Next.js 15, MongoDB, Vercel) с аутентификацией, серверной валидацией счёта и CI.

## Features

- Регистрация и вход (bcrypt, httpOnly-сессии в MongoDB)
- Canvas-игра с сохранением лучшего результата
- Anti-cheat: игровая сессия + лимит очков по времени партии
- Rate limiting на auth и game API (MongoDB TTL)
- Health check: `GET /api/health`
- GitHub Actions: lint, test, build

## Stack

- **Frontend:** Next.js App Router, React 19, Tailwind CSS 4
- **Backend:** Route Handlers, Mongoose, Zod
- **Database:** MongoDB Atlas (или Docker локально)
- **Deploy:** Vercel

## Quick start

### 1. Environment

```bash
cp .env.example .env.local
```

Windows: `Copy-Item .env.example .env.local`

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `AUTH_SECRET` | Min. 32 characters for session signing |

### 2. Database

**Atlas (recommended for Vercel):** create cluster, user, allow `0.0.0.0/0`, paste URI into `.env.local`.

**Local:**

```bash
docker compose up -d
# MONGODB_URI=mongodb://127.0.0.1:27017/dino
```

### 3. Run

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Service + DB status |
| `POST` | `/api/auth/register` | Register |
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/logout` | Logout |
| `GET` | `/api/auth/me` | Current user |
| `POST` | `/api/game/session/start` | Start game session |
| `POST` | `/api/game/score` | Submit score (validated) |

## Deploy (Vercel)

1. Connect GitHub repository.
2. Set **Environment Variables** (same as `.env.local`).
3. Redeploy after changing env.

Auto-deploy runs on push to `main`.

## CI

`.github/workflows/ci.yml` — `lint`, `test`, `build` on push/PR.

## Project structure

```
app/api/          # Route handlers
components/       # UI (AuthGate, DinoGame, Spinner)
lib/
  api/            # Errors, handler wrapper, HTTP helpers
  auth/           # Sessions, passwords
  config/         # App constants
  db/             # Mongoose connection
  env.ts          # Validated environment
  game/           # Game constants, score rules
  models/         # User, Session, RateLimit
  security/       # Rate limiting
  validation/     # Zod schemas
tests/            # Vitest unit + integration
```

## License

Private / portfolio use.
