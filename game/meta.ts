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
  /** Краткое описание для metadata. */
  description:
    "Браузерная игра в стиле Chrome Dino с регистрацией, сессиями и сохранением рекорда в MongoDB.",
  features: {
    /** false — скины скрыты в UI (API остаётся, но не используется). */
    skins: true,
  },
} as const;

export type GameMeta = typeof gameMeta;
