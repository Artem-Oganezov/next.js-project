# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/), versions follow [SemVer](https://semver.org/).

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
- **Playwright E2E** (`e2e/`) — регистрация, логин, полный игровой цикл до
  game over; отдельный job в CI с Mongo + Redis.
- **Redis integration tests** (`npm run test:redis`, `vitest.redis.config.ts`) —
  ZSET ранга, кэш топ-10, реальный rate limit.
- **Observability:** in-process счётчики, `GET /api/metrics` (Prometheus /
  JSON), сводка в `GET /api/health`.
- **Админка:** `/admin`, `GET /api/admin/submissions`, бан/разбан пользователя;
  подозрительные сабмиты пишутся в MongoDB (`SuspiciousSubmit`).
- Prettier (`npm run format`, `format:check` в CI).
- `ADMIN_SECRET` в env для админ-API и защиты метрик в production.

### Changed
- Anti-cheat логи дублируются в БД (не только stderr).
- Бан пользователя: блокировка login/me, сброс сессий.

## [1.3.0] — 2026-07-04

### Added

- **Серверная replay-валидация счёта.** Игра переведена на
  детерминированный движок (`game/engine.ts`, fixed timestep 60 тиков/сек,
  препятствия из серверного seed). Клиент шлёт лог прыжков (`jumpTicks`),
  сервер прогоняет ту же партию и сверяет счёт бит-в-бит
  (`gamePlugin.validateReplay`; опционален для игр без движка).
- Тесты: детерминизм движка, replay-отклонение правдоподобного счёта
  с подделанным логом, автоплеер для честных партий в интеграционных
  тестах — 60 тестов суммарно.

### Changed

- `POST /api/game/score` принимает `jumpTicks` (лог ввода для replay).
- `Game.tsx` — только рендер и ввод: симуляция в движке, партия стартует
  после ответа `session/start` (при недоступном сервере — офлайн-партия
  без сохранения).

## [1.2.0] — 2026-07-04

### Added

- Кап одновременных сессий на юзера (`MAX_SESSIONS_PER_USER = 5`):
  при логине старейшие сессии сверх лимита удаляются — забытые куки
  больше не живут валидными до конца TTL.
- `RATE_LIMIT_FAIL_CLOSED=true` — жёсткий режим rate limiting: при
  недоступном Redis запросы под лимитом получают 429 (по умолчанию
  прежний fail-open).
- Тесты: кап сессий (вытеснение старейшей), fail-open/fail-closed
  лимитера — 51 тест суммарно.

### Changed

- `session/start` отдаёт 429 через общий хелпер `tooManyRequests`
  (единый формат ошибок).

### Fixed

- Счётчик тестов в README соответствует факту.

## [1.1.0] — 2026-07-04

### Added

- Модуль `game/` — вся игра (canvas, константы, типы, скины, метаданные)
  в одной папке; смена игры не затрагивает shell и API.
- `game/contract.ts` — типизированный контракт между shell и игровым
  компонентом (`GameComponentProps`).
- `game/meta.ts` — единая точка: id, название, описание, feature-флаги.
- Feature-флаг `features.skins` — выключает UI скинов без правки экранов.
- `X-Request-Id` в каждом API-ответе + `requestId` в логах ошибок.
- Сообщения об ошибке на клиенте, если партия не зарегистрирована или
  счёт не сохранился.
- Тесты: health (degraded-режим), logout (уничтожение сессии), skins
  (покупка, дубль, экипировка) — 47 тестов суммарно.
- Документация: `docs/NEW_GAME.md`, `docs/DEPLOY.md`, `docs/ARCHITECTURE.md`.

### Changed

- Тип `User` вынесен в `types/user.ts` (общий, не зависит от игры).
- `APP_NAME`, метаданные layout и `gamePlugin.id/displayName` читаются
  из `game/meta.ts`.
- CI: заглушка `REDIS_URL` для стабильного build.

### Removed

- `components/DinoGame.tsx`, `lib/game/constants.ts`, `lib/game/skins.ts`,
  `types/game.types.ts` — перенесены в `game/`.

## [1.0.0]

Первый релиз: auth (bcrypt, httpOnly-сессии), одноразовые игровые партии
с server seed, лидерборд на Redis ZSET с Mongo fallback, rate limiting,
health check, Docker standalone, CI.
