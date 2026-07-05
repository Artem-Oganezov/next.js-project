/**
 * Single entry point for the game module.
 *
 * Shell (AuthGate, layout) imports ONLY from here:
 *   import { Game, gameMeta, SKINS } from "@/game";
 *
 * Swapping games = replace contents of game/ + score rules
 * in lib/game/plugin.ts. Shell and API are unchanged.
 */
export { default as Game } from "./Game";
export { gameMeta, type GameMeta } from "./meta";
export type { GameComponentProps } from "./contract";
export { SKINS, type SkinDefinition } from "./skins";
