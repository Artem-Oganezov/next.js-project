# Архитектура

## Слои

```
┌──────────────────────────────────────────────────────┐
│ SHELL (не знает игру)                                │
│  components/AuthGate, HomeScreen, Leaderboard,       │
│  Profile, AuthForm · app/layout · lib/client/api     │
└──────────────────────┬───────────────────────────────┘
                       │ импортирует только @/game
┌──────────────────────▼───────────────────────────────┐
│ GAME (меняется под игру)                             │
│  game/Game.tsx · constants · types · skins · meta    │
│  контракт: game/contract.ts                          │
└──────────────────────┬───────────────────────────────┘
                       │ api.startGameSession / submitScore
┌──────────────────────▼───────────────────────────────┐
│ API (универсальный, игру не знает)                   │
│  app/api/auth/* · game/* · leaderboard/* · skins ·   │
│  health · единственная game-точка: lib/game/plugin   │
└──────────┬──────────────────────────┬────────────────┘
           │                          │
┌──────────▼──────────┐    ┌──────────▼────────────────┐
│ MongoDB             │    │ Redis                     │
│ source of truth:    │    │ hot path: ZSET рейтинга,  │
│ User, Session,      │    │ кэш топ-10, rate limit    │
│ GameSession (TTL)   │    │ (fail-open при падении)   │
└─────────────────────┘    └───────────────────────────┘
```

## Ключевые решения

**Один деплой = одна игра.** Никакого `gameId` в БД и API. Новая игра —
новый форк с новым `.env`.

**`lib/game/plugin.ts` — единственная game-точка бэкенда.** Роуты
импортируют `gamePlugin` и не знают, что за игра. Метаданные (название,
фичи) — в `game/meta.ts`, plugin их переиспользует.

**Anti-cheat — эвристики + серверный replay.** Одноразовые партии
(`GameSession`, атомарный claim через `findOneAndUpdate`), лимит
очков/сек, мин/макс длительность. Поверх — replay-валидация: игра
детерминирована (fixed timestep 60 тиков/сек, `game/engine.ts`),
клиент шлёт лог прыжков, сервер прогоняет партию по seed и сверяет
счёт бит-в-бит (`gamePlugin.validateReplay`, опционален для игр без
детерминированного движка). Подозрительные сабмиты — в stderr
со `scope: "anti-cheat"`.

**Redis деградирует, не роняет.** Rank → fallback на Mongo
`countDocuments`; топ-10 → прямой запрос; rate limit → fail-open
(осознанно: лимитер не должен ронять API; жёсткий режим —
`RATE_LIMIT_FAIL_CLOSED=true`, тогда 429 при падении Redis).
`GET /api/health` возвращает `degraded` — видно в мониторинге.

**Сессии.** Токен (32 байта) в httpOnly cookie; в Mongo — только
SHA-256(token + AUTH_SECRET). TTL-индексы чистят истёкшие Session
и GameSession. Кап одновременных сессий на юзера
(`MAX_SESSIONS_PER_USER`): при логине старейшие сверх лимита удаляются —
забытые куки не живут до конца TTL.

**requestId.** Каждый API-ответ несёт `X-Request-Id`; ошибки в логах
содержат тот же id — баг-репорт сопоставляется с логом сервера.

**Observability.** In-process счётчики (`lib/observability/metrics.ts`):
HTTP-запросы по scope/status, отказы rate limit, anti-cheat rejections.
`GET /api/metrics` — Prometheus text; `GET /api/health` — краткая сводка.

**Модерация.** Подозрительные сабмиты → MongoDB + stderr. Админка `/admin`
и `GET /api/admin/submissions` (заголовок `X-Admin-Secret` = `ADMIN_SECRET`).
Бан сбрасывает сессии и блокирует login.

## Потоки данных

**Сабмит счёта:** cookie-сессия → rate limit (IP + userId) → Zod →
GameSession существует и не закрыта → validateScore (время/потолок) →
validateReplay (прогон партии по seed + jumpTicks, счёт бит-в-бит) →
атомарный claim → обновление User → ZSET + инвалидация топ-10 → rank.

**Ранг:** Redis ZSET O(log N); пустой ZSET один раз засеивается из Mongo
курсором; при недоступном Redis — счёт по индексу `bestScore`.

## Известные границы (осознанные)

- Replay доказывает партию по правилам, но не отличает человека от бота,
  честно проходящего игру (поведенческий анализ вне скоупа).
- Rate limit по умолчанию fail-open при падении Redis
  (опционально fail-closed через `RATE_LIMIT_FAIL_CLOSED=true`).
- Обновление User + ZSET не в транзакции: при сбое между ними рассинхрон
  чинится самовосстановлением ZSET при следующем чтении rank.
- Равные `bestScore` делят один rank (и в Redis, и в Mongo — консистентно).
