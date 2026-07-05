/**
 * Game metadata — the single place for name and features.
 *
 * Backend (plugin, skins API), shell (AuthGate, layout), and the game itself
 * read from here. When swapping games, change this file + Game.tsx + constants.ts.
 */
export const gameMeta = {
  /** Technical id (logs, plugin). */
  id: "dino-run",
  /** Name in UI and <title>. */
  displayName: "Dino Run",
  /** Accent-colored part of the name (after a space or second segment). */
  displayNameAccent: "Run",
  /** Short description for metadata. */
  description:
    "Browser game inspired by Chrome Dino with accounts, sessions, and saved high scores.",
  features: {
    /** false — skins hidden in UI (API remains but is unused). */
    skins: true,
  },
} as const;

export type GameMeta = typeof gameMeta;
