# Game Backend Template (+ Dino Run)

Универсальный бэкенд для браузерных игр «счёт → рекорд → рейтинг» на Next.js.
Текущая игра — Dino Run; чтобы запустить другую, меняется **папка `game/`
и один файл правил** — auth, лидерборд, античит-оболочка и rate limiting общие.

Принцип: **1 проект = 1 игра**. Новая игра — новый форк (см.
[docs/NEW_GAME.md](docs/NEW_GAME.md), чеклист на ~2 часа).

Документация: [Новая игра](docs/NEW_GAME.md) ·
[Деплой](docs/DEPLOY.md) · [Архитектура](docs/ARCHITECTURE.md) ·
[Changelog](CHANGELOG.md)

## Features

- Регистрация и вход (bcrypt, httpOnly-сессии в MongoDB; кап одновременных
  сессий на юзера — старейшие вытесняются)
- Лидерборд топ-10 и позиция игрока в общем рейтинге (Redis ZSET, O(log N))
- Anti-cheat: одноразовые сессии + серверная **replay-валидация** — сервер
  прогоняет партию по seed и логу прыжков и сверяет счёт (см. ниже)
- Rate limiting в Redis по IP и по userId (по умолчанию fail-open;
  `RATE_LIMIT_FAIL_CLOSED=true` — жёсткий режим 429 при падении Redis)
- Health check `GET /api/health` (Mongo + Redis + сводка метрик) — для LB
- Метрики `GET /api/metrics` (Prometheus text / JSON) для мониторинга
- Админка `/admin` + API: журнал подозрительных сабмитов, бан пользователей
- Stateless API: готов к нескольким серверам за load balancer
- Docker (standalone build), GitHub Actions: format, lint, unit/integration,
  Redis-тесты, E2E (Playwright), build

## Stack

- **Frontend:** Next.js App Router, React 19, Tailwind CSS 4, canvas
- **Backend:** Route Handlers, Mongoose, Zod
- **Data:** MongoDB (source of truth) + Redis (hot path: рейтинг, rate limit)
- **Deploy:** Docker на VPS (или Vercel + Upstash)

## Quick start (локально)

```bash
cp .env.example .env.local          # Windows: Copy-Item .env.example .env.local
docker compose -f docker-compose.dev.yml up -d   # Mongo + Redis локально
npm install
npm test
npm run dev
```

`.env.local` для локального запуска:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/game
REDIS_URL=redis://127.0.0.1:6379
AUTH_SECRET=<openssl rand -base64 32>
ADMIN_SECRET=<openssl rand -base64 32>   # опционально: /admin и /api/metrics
```

## Как запустить НОВУЮ игру на этом бэке

Подробный чеклист: [docs/NEW_GAME.md](docs/NEW_GAME.md). Кратко:

1. **Форкни/скопируй репозиторий.**
2. **`game/meta.ts`** — id, название, feature-флаги (напр. `skins: false`).
3. **`lib/game/plugin.ts`** — единственная game-specific точка бэка:

   ```ts
   const scoreRules: ScoreRulesConfig = {
     maxScorePerSecond: 2, // Flappy: ~1 труба/сек, ×2 запас
     scoreGrace: 3,
     maxGameDurationMs: 10 * 60 * 1000,
     minGameDurationMs: 1000,
   };
   ```

4. **Замени папку `game/`** (canvas-компонент `Game.tsx`, константы, типы,
   скины). Контракт клиента (`game/contract.ts`) не меняется:
   - `POST /api/game/session/start` — перед началом партии; в ответе
     `sessionId` и `seed` (партия ведётся детерминированным движком от
     seed — см. `game/engine.ts`)
   - `POST /api/game/score { score, sessionId, jumpTicks }` — в ответе
     `bestScore`, `isNewRecord`, `rank`, `nextUsername`; `jumpTicks` — лог
     ввода для серверной replay-валидации (для игры без детерминированного
     движка убери `validateReplay` из `lib/game/plugin.ts`)
5. Новый `.env` (своя БД) — и деплой. Роуты, auth, лидерборд, shell-экраны
   не трогаешь.

## Anti-cheat

Оболочка общая для любой игры, пороги — в `lib/game/plugin.ts`:

1. **Одноразовая партия.** `session/start` создаёт `GameSession` (Mongo, TTL);
   счёт принимается только с валидным `sessionId`, повторный submit
   отклоняется атомарно (`findOneAndUpdate`), гонка двух запросов невозможна.
   Новый `session/start` аннулирует незакрытые партии юзера.
2. **Время партии.** Мин. и макс. длительность + лимит очков в секунду
   (`maxScorePerSecond`) — мгновенные и «бесконечные» результаты режутся.
3. **Replay-валидация.** Игра детерминирована: фиксированный шаг 60 тиков/сек
   (`game/engine.ts`), препятствия из серверного seed. Клиент отправляет
   лог прыжков (`jumpTicks`), сервер прогоняет ту же партию и сверяет счёт
   **бит-в-бит** — выдуманный счёт без реального прохождения не пройдёт.
4. **Rate limit по userId** на игровых эндпоинтах (не только по IP).
5. **Лог подозрительных сабмитов** — `scope: "anti-cheat"` в stderr
   (username, score, причина, elapsedMs) для мониторинга и банов.

Оставшаяся граница: replay доказывает, что партия _сыграна по правилам_,
но не что её играл человек — бот, честно проходящий игру, неотличим от
игрока (это уже задача поведенческого анализа, не движка).

## API

| Method     | Path                      | Description                                       |
| ---------- | ------------------------- | ------------------------------------------------- |
| `GET`      | `/api/health`             | Статус Mongo + Redis + observability summary    |
| `GET`      | `/api/metrics`            | Prometheus / JSON метрики (см. README)         |
| `POST`     | `/api/auth/register`      | Регистрация                                       |
| `POST`     | `/api/auth/login`         | Вход                                              |
| `POST`     | `/api/auth/logout`        | Выход                                             |
| `GET`      | `/api/auth/me`            | Текущий юзер                                      |
| `POST`     | `/api/game/session/start` | Старт партии → `sessionId` + `seed`               |
| `POST`     | `/api/game/score`         | `{ score, sessionId, jumpTicks }` → рекорд + rank |
| `GET`      | `/api/leaderboard`        | Топ-10 (кэш 60с в Redis)                          |
| `GET`      | `/api/leaderboard/rank`   | Позиция текущего юзера                            |
| `POST/PUT` | `/api/skins`              | Покупка / выбор скина                             |

## Deploy на VPS (Docker)

```bash
# на сервере
git clone <repo> && cd <repo>
cp .env.example .env    # прописать MONGODB_URI (Atlas!), AUTH_SECRET, REDIS_URL
docker compose up -d --build
```

- **Mongo — снаружи** (Atlas / отдельный сервер), не на app-ноде.
- Redis поднимается в compose рядом с app; для нескольких серверов вынеси
  его на отдельный хост и поменяй `REDIS_URL`.

### Масштабирование «подключил сервер»

1. Redis и Mongo — общие, вынесены с app-нод.
2. Новый VPS: тот же image + **тот же `.env`** (одинаковый `AUTH_SECRET`!).
3. Добавь сервер в upstream балансировщика — `nginx.example.conf`.

API stateless, sticky sessions не нужны. `GET /api/health` возвращает 503
при падении Mongo — LB сам выведет ноду из ротации.

## Тесты и CI

```bash
npm test              # vitest: unit + integration (mongodb-memory-server)
npm run test:redis    # Redis-ветка (нужен redis://127.0.0.1:6379)
npm run test:e2e      # Playwright (нужны Mongo + Redis + build/start)
npm run lint
npm run format:check
```

В основных тестах Redis намеренно недоступен — проверяется Mongo fallback.
Отдельный конфиг `vitest.redis.config.ts` гоняет ZSET, кэш топ-10 и rate limit
на реальном Redis (в CI — service container).

`.github/workflows/ci.yml` — format, lint, unit/integration, Redis-тесты,
build, E2E (Mongo + Redis + Playwright).

## Админка и модерация

1. Задай `ADMIN_SECRET` (≥32 символа) в `.env`.
2. Открой `/admin`, введи секрет — увидишь журнал anti-cheat сабмитов из MongoDB.
3. API: `GET /api/admin/submissions`, `POST/DELETE /api/admin/users/:id/ban`
   с заголовком `X-Admin-Secret`.

Забаненный пользователь не может войти; активные сессии сбрасываются.

## Project structure

```
app/api/           # Route handlers (универсальные, игру не знают)
components/        # Shell UI: AuthGate, экраны (игру не знают)
game/              # ВСЯ игра — меняется под новую игру целиком
  Game.tsx           # Canvas-компонент (рендер + ввод)
  engine.ts          # Детерминированный движок (fixed timestep, replay)
  contract.ts        # Контракт shell ↔ игра (GameComponentProps)
  meta.ts            # id, название, feature-флаги
  constants.ts       # Константы канваса и физики
  types.ts           # Игровые типы (препятствия, состояние)
  skins.ts           # Скины (опционально, features.skins)
lib/
  api/             # Errors, handler wrapper (requestId), HTTP helpers
  auth/            # Sessions, passwords
  cache/           # Redis-слой: топ-10, ZSET рейтинга
  db/              # Mongoose connection
  game/
    plugin.ts        # ЕДИНСТВЕННАЯ game-specific точка бэка
    score-rules.ts   # Общий движок валидации счёта
    rank.ts          # Ранг: Redis ZSET + Mongo fallback
    seeded-random.ts # Детерминированный PRNG из серверного seed
  models/            # User, Session, GameSession
  redis.ts         # RedisClient: REDIS_URL (TCP) или Upstash REST
  observability/   # In-process метрики (Prometheus)
  security/        # Rate limiting, anti-cheat persist
  admin/           # Проверка ADMIN_SECRET
  validation/      # Zod schemas
types/user.ts      # Общий тип User (не зависит от игры)
tests/             # Vitest + Playwright e2e/
e2e/               # Playwright: auth, game flow
docs/              # NEW_GAME, DEPLOY, ARCHITECTURE
```

## License

Proprietary — см. [LICENSE](LICENSE).
