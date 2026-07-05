# New game on this template — ~2 hour checklist

Principle: **1 project = 1 game**. Fork the repo, replace the `game/` folder and score rules — auth, leaderboard, anti-cheat shell, API, and deploy stay unchanged.

## What to change (in order)

### 1. `game/meta.ts` — 2 minutes

```ts
export const gameMeta = {
  id: "flappy-bird",
  displayName: "Flappy Bird",
  description: "…",
  features: { skins: false }, // false — skins hidden in UI
} as const;
```

`id`, UI/title name, and enabled features propagate everywhere automatically.

### 2. `lib/game/plugin.ts` — 10 minutes

The only game-specific backend hook — score validation rules:

```ts
const scoreRules: ScoreRulesConfig = {
  maxScorePerSecond: 2, // max honest score/sec × 2 safety margin
  scoreGrace: 3, // fixed allowance
  maxGameDurationMs: 10 * 60 * 1000,
  minGameDurationMs: 1000, // 0 — disable check
};
```

Formula for `maxScorePerSecond`: **(points per frame) × 60fps × 2**.
Dino example: `0.15 × 60 ≈ 9` → config value `18`.

Same file — `validateReplay` (exact server-side score check). If the new game is deterministic (fixed timestep + server seed, see Dino `game/engine.ts`), rewrite replay for its engine. If not — remove `validateReplay` from the plugin: time/ceiling heuristics remain.

### 3. `game/Game.tsx` — most of the time (1–2 hours)

New canvas component. Contract (`game/contract.ts`):

- accepts `GameComponentProps` (`initialBestScore`, `activeSkinColor`, `onScoreSaved`, `onBack`);
- on run start calls `api.startGameSession()` → `sessionId` + `seed`;
- run logic in a deterministic engine (your `game/engine.ts` analog: fixed timestep, PRNG from `createSeededRandom(seed)`); the component only renders engine state and records input log (`inputLog` format is game-specific);
- on game over calls `api.submitScore(score, sessionId, inputLog)` and surfaces errors if save fails.

### 4. `game/constants.ts` and `game/types.ts` — 15 minutes

Canvas size, physics, `SCORE_PER_FRAME`; obstacle and player types. Replace entirely — the shell does not import them.

### 5. `game/skins.ts` — optional

If `features.skins: false` — keep only `default`; skin UI is not rendered. API `/api/skins` remains but is unused.

### 6. Branding — 5 minutes

- `package.json` → `"name": "my-new-game"`
- new `.env` (separate database!) on production
- replace stub `/privacy` and `/terms` pages
- update `app/icon.svg`, `public/og.svg`, and `APP_URL`

## Do not touch

- `app/api/**` — API v1 contract is stable
- `lib/auth`, `lib/models`, `lib/cache`, `lib/redis.ts`, `lib/security`
- `lib/game/score-rules.ts`, `rank.ts`, `seeded-random.ts` — shared engine
- `components/AuthGate.tsx` and screens — import only `@/game`
- Dockerfile, docker-compose, CI

## Verification (~15 minutes)

```bash
npm test          # all tests should pass
npm run build
npm run dev
```

Manual: register → play → game over → score saved → leaderboard updated → resubmitting the same run is rejected (stderr `anti-cheat` log).
