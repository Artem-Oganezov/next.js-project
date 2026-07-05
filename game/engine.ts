/**
 * Deterministic Dino Run engine: pure simulation without canvas or timers.
 *
 * The same seed + the same jump log (tick numbers) produce a bit-for-bit
 * identical run on the client and server. The client renders engine snapshots;
 * the server replays and verifies the score
 * (see lib/game/plugin.ts → replayScore).
 *
 * When swapping games, replace this file entirely along with constants/types.
 */
import { GAME_CONFIG } from "@/game/constants";
import type { Cactus, DinoState } from "@/game/types";
import { createSeededRandom } from "@/lib/game/seeded-random";
import { TICKS_PER_SECOND } from "@/game/score-config";

export { TICKS_PER_SECOND };

const {
  CANVAS_WIDTH,
  GROUND_Y,
  GRAVITY,
  JUMP_FORCE,
  DINO_X,
  DINO_WIDTH,
  DINO_HEIGHT,
  BASE_SPEED,
  SCORE_PER_FRAME,
  REVIVE_INVINCIBILITY_TICKS,
} = GAME_CONFIG;

export type DinoEngine = {
  /** One simulation step; jumpRequested — whether jump input was pressed this tick. */
  tick(jumpRequested: boolean): void;
  /** Next tick number (how many ticks have been played). */
  getTick(): number;
  /** Display score (integer). */
  getScore(): number;
  getSpeed(): number;
  getDino(): Readonly<DinoState>;
  getCacti(): readonly Cactus[];
  isGameOver(): boolean;
  /** Dino is on the ground — jump will trigger on the next tick. */
  canJump(): boolean;
  /** Clear game over after an ad; deterministic for replay. */
  revive(): void;
};

function isColliding(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function createDinoEngine(seed: string): DinoEngine {
  const random = createSeededRandom(seed);

  const dino: DinoState = { y: GROUND_Y - DINO_HEIGHT, velocityY: 0 };
  const cacti: Cactus[] = [];
  let scoreAccum = 0;
  let speed = BASE_SPEED;
  let framesSinceLastCactus = 0;
  let nextCactusGap = 80 + Math.floor(random() * 60);
  let tickCount = 0;
  let gameOver = false;
  let invincibleTicksRemaining = 0;

  const onGround = (): boolean =>
    dino.velocityY === 0 && dino.y >= GROUND_Y - DINO_HEIGHT - 1;

  const tick = (jumpRequested: boolean): void => {
    if (gameOver) return;

    if (jumpRequested && onGround()) {
      dino.velocityY = JUMP_FORCE;
    }

    dino.velocityY += GRAVITY;
    dino.y += dino.velocityY;

    const floorY = GROUND_Y - DINO_HEIGHT;
    if (dino.y >= floorY) {
      dino.y = floorY;
      dino.velocityY = 0;
    }

    for (let i = cacti.length - 1; i >= 0; i--) {
      cacti[i].x -= speed;
      if (cacti[i].x + cacti[i].width < 0) {
        cacti.splice(i, 1);
      }
    }

    framesSinceLastCactus += 1;
    if (framesSinceLastCactus >= nextCactusGap) {
      cacti.push({
        x: CANVAS_WIDTH + 10,
        width: 18 + Math.floor(random() * 10),
        height: 35 + Math.floor(random() * 25),
      });
      framesSinceLastCactus = 0;
      nextCactusGap = 70 + Math.floor(random() * 80);
    }

    scoreAccum += SCORE_PER_FRAME;
    speed = BASE_SPEED + Math.floor(scoreAccum / 100) * 0.5;

    for (const cactus of cacti) {
      const cactusY = GROUND_Y - cactus.height;
      if (
        invincibleTicksRemaining <= 0 &&
        isColliding(
          DINO_X,
          dino.y,
          DINO_WIDTH,
          DINO_HEIGHT,
          cactus.x,
          cactusY,
          cactus.width,
          cactus.height,
        )
      ) {
        gameOver = true;
        break;
      }
    }

    tickCount += 1;
    if (invincibleTicksRemaining > 0) {
      invincibleTicksRemaining -= 1;
    }
  };

  const revive = (): void => {
    if (!gameOver) return;
    gameOver = false;
    invincibleTicksRemaining = REVIVE_INVINCIBILITY_TICKS;
    dino.velocityY = JUMP_FORCE;
  };

  return {
    tick,
    getTick: () => tickCount,
    getScore: () => Math.floor(scoreAccum),
    getSpeed: () => speed,
    getDino: () => dino,
    getCacti: () => cacti,
    isGameOver: () => gameOver,
    canJump: () => !gameOver && onGround(),
    revive,
  };
}

export type ReplayResult =
  | { ok: true; score: number; ticks: number }
  | { ok: false; reason: "too-long" | "revive-mismatch" };

/**
 * Run a game from seed and jump log until game over.
 * With reviveAtTick — after the first death, engine.revive() is called and the run
 * continues until the second death (must match the client).
 */
export function replayGame(
  seed: string,
  jumpTicks: readonly number[],
  maxTicks: number,
  reviveAtTick?: number,
): ReplayResult {
  const engine = createDinoEngine(seed);
  const jumps = new Set(jumpTicks);

  while (!engine.isGameOver()) {
    if (engine.getTick() >= maxTicks) {
      return { ok: false, reason: "too-long" };
    }
    engine.tick(jumps.has(engine.getTick()));
  }

  if (reviveAtTick !== undefined) {
    if (engine.getTick() !== reviveAtTick) {
      return { ok: false, reason: "revive-mismatch" };
    }
    engine.revive();
    while (!engine.isGameOver()) {
      if (engine.getTick() >= maxTicks) {
        return { ok: false, reason: "too-long" };
      }
      engine.tick(jumps.has(engine.getTick()));
    }
  }

  return { ok: true, score: engine.getScore(), ticks: engine.getTick() };
}
