/**
 * Единая точка входа игрового модуля.
 *
 * Shell (AuthGate, layout) импортирует ТОЛЬКО отсюда:
 *   import { Game, gameMeta, SKINS } from "@/game";
 *
 * Смена игры = замена содержимого папки game/ + правила счёта
 * в lib/game/plugin.ts. Shell и API не трогаются.
 */
export { default as Game } from "./Game";
export { gameMeta, type GameMeta } from "./meta";
export type { GameComponentProps } from "./contract";
export { SKINS, type SkinDefinition } from "./skins";
