# Новая игра на этом шаблоне — чеклист на ~2 часа

Принцип: **1 проект = 1 игра**. Форкаешь репозиторий, меняешь папку `game/`
и правила счёта — auth, лидерборд, античит-оболочка, API и деплой не трогаются.

## Что менять (по порядку)

### 1. `game/meta.ts` — 2 минуты

```ts
export const gameMeta = {
  id: "flappy-bird",
  displayName: "Flappy Bird",
  description: "…",
  features: { skins: false }, // false — скины скрыты в UI
} as const;
```

`id`, название в UI/`<title>` и включённые фичи подтянутся везде автоматически.

### 2. `lib/game/plugin.ts` — 10 минут

Единственная game-specific точка бэкенда — правила валидации счёта:

```ts
const scoreRules: ScoreRulesConfig = {
  maxScorePerSecond: 2, // максимум очков/сек честной игры × 2 запас
  scoreGrace: 3, // фиксированный допуск
  maxGameDurationMs: 10 * 60 * 1000,
  minGameDurationMs: 1000, // 0 — выключить проверку
};
```

Формула `maxScorePerSecond`: **(очки за кадр) × 60fps × 2**.
Пример Dino: `0.15 × 60 ≈ 9` → в конфиге `18`.

Там же — `validateReplay` (точная серверная проверка счёта). Если новая
игра детерминирована (fixed timestep + серверный seed, см. `game/engine.ts`
у Dino) — перепиши прогон под её движок. Если нет — удали `validateReplay`
из плагина: останутся только эвристики времени/потолка.

### 3. `game/Game.tsx` — основное время (1–2 часа)

Новый canvas-компонент. Контракт (см. `game/contract.ts`):

- принимает `GameComponentProps` (`initialBestScore`, `activeSkinColor`,
  `onScoreSaved`, `onBack`);
- при старте партии вызывает `api.startGameSession()` → `sessionId` + `seed`;
- партию ведёт детерминированный движок (свой аналог `game/engine.ts`:
  fixed timestep, PRNG из `createSeededRandom(seed)`), компонент только
  рендерит его состояние и записывает лог ввода (`jumpTicks`);
- на game over вызывает `api.submitScore(score, sessionId, jumpTicks)`
  и показывает ошибку, если сохранить не удалось.

### 4. `game/constants.ts` и `game/types.ts` — 15 минут

Размеры канваса, физика, `SCORE_PER_FRAME`; типы препятствий и игрока.
Заменяются целиком — shell их не импортирует.

### 5. `game/skins.ts` — опционально

Если `features.skins: false` — оставь только `default`, UI скинов не рендерится.
API `/api/skins` остаётся, но не используется.

### 6. Косметика — 5 минут

- `package.json` → `"name": "my-new-game"`
- новый `.env` (своя БД!) на проде

## Что НЕ трогать

- `app/api/**` — контракт API v1 стабилен
- `lib/auth`, `lib/models`, `lib/cache`, `lib/redis.ts`, `lib/security`
- `lib/game/score-rules.ts`, `rank.ts`, `seeded-random.ts` — общий движок
- `components/AuthGate.tsx` и экраны — импортируют только `@/game`
- Dockerfile, docker-compose, CI

## Проверка (15 минут)

```bash
npm test          # все тесты должны быть зелёными
npm run build
npm run dev
```

Вручную: регистрация → игра → проигрыш → счёт сохранился → рейтинг
обновился → повторный сабмит той же партии отклоняется (лог `anti-cheat`).
