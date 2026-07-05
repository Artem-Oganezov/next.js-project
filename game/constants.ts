import { SCORE_PER_FRAME } from "@/game/score-config";

/** Dino Run canvas and physics constants. Replace entirely when swapping games. */
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
  /** Invincibility after revive — must match server replay (ticks at 60/s). */
  REVIVE_INVINCIBILITY_TICKS: 90,
  SCORE_PER_FRAME,
} as const;
