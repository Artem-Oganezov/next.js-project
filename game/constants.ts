/** Константы канваса и физики Dino Run. При смене игры заменяются целиком. */
export const GAME_CONFIG = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 200,
  GROUND_Y: 170,
  GRAVITY: 0.55,
  JUMP_FORCE: -11,
  DINO_X: 50,
  DINO_WIDTH: 44,
  DINO_HEIGHT: 47,
  BASE_SPEED: 5,
  // Связано с maxScorePerSecond в lib/game/plugin.ts:
  // 0.15 * 60fps ≈ 9 очков/сек при честной игре.
  SCORE_PER_FRAME: 0.15,
} as const;
