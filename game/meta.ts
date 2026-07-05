/**
 * Метаданные игры — единственное место, где живут название и фичи.
 *
 * Бэкенд (plugin, API скинов), shell (AuthGate, layout) и сама игра
 * читают отсюда. При смене игры меняешь этот файл + Game.tsx + constants.ts.
 */
export const gameMeta = {
  /** Технический id (логи, plugin). */
  id: "dino-run",
  /** Название в UI и <title>. */
  displayName: "Dino Run",
  /** Часть названия с акцентным цветом (после пробела или вторая часть). */
  displayNameAccent: "Run",
  /** Краткое описание для metadata. */
  description:
    "Browser game inspired by Chrome Dino with accounts, sessions, and saved high scores.",
  features: {
    /** false — скины скрыты в UI (API остаётся, но не используется). */
    skins: true,
  },
} as const;

export type GameMeta = typeof gameMeta;
