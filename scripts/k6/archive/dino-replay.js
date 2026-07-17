const GAME_CONFIG = {
  CANVAS_WIDTH: 800,
  GROUND_Y: 170,
  GRAVITY: 0.55,
  JUMP_FORCE: -11,
  DINO_X: 50,
  DINO_WIDTH: 44,
  DINO_HEIGHT: 47,
  BASE_SPEED: 5,
  REVIVE_INVINCIBILITY_TICKS: 90,
  SCORE_PER_FRAME: 0.15,
};

const MAX_REPLAY_TICKS = 20 * 60 * 60;

function createSeededRandom(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = (h ^= h >>> 16) >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isColliding(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function createDinoEngine(seed) {
  const random = createSeededRandom(seed);
  const dino = { y: GAME_CONFIG.GROUND_Y - GAME_CONFIG.DINO_HEIGHT, velocityY: 0 };
  const cacti = [];
  let scoreAccum = 0;
  let speed = GAME_CONFIG.BASE_SPEED;
  let framesSinceLastCactus = 0;
  let nextCactusGap = 80 + Math.floor(random() * 60);
  let tickCount = 0;
  let gameOver = false;
  let invincibleTicksRemaining = 0;

  const onGround = () =>
    dino.velocityY === 0 &&
    dino.y >= GAME_CONFIG.GROUND_Y - GAME_CONFIG.DINO_HEIGHT - 1;

  const tick = (jumpRequested) => {
    if (gameOver) return;

    if (jumpRequested && onGround()) {
      dino.velocityY = GAME_CONFIG.JUMP_FORCE;
    }

    dino.velocityY += GAME_CONFIG.GRAVITY;
    dino.y += dino.velocityY;

    const floorY = GAME_CONFIG.GROUND_Y - GAME_CONFIG.DINO_HEIGHT;
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
        x: GAME_CONFIG.CANVAS_WIDTH + 10,
        width: 18 + Math.floor(random() * 10),
        height: 35 + Math.floor(random() * 25),
      });
      framesSinceLastCactus = 0;
      nextCactusGap = 70 + Math.floor(random() * 80);
    }

    scoreAccum += GAME_CONFIG.SCORE_PER_FRAME;
    speed = GAME_CONFIG.BASE_SPEED + Math.floor(scoreAccum / 100) * 0.5;

    for (const cactus of cacti) {
      const cactusY = GAME_CONFIG.GROUND_Y - cactus.height;
      if (
        invincibleTicksRemaining <= 0 &&
        isColliding(
          GAME_CONFIG.DINO_X,
          dino.y,
          GAME_CONFIG.DINO_WIDTH,
          GAME_CONFIG.DINO_HEIGHT,
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

  return {
    tick,
    getTick: () => tickCount,
    getScore: () => Math.floor(scoreAccum),
    isGameOver: () => gameOver,
  };
}

/** Deterministic first-death run with no jumps — matches server replay validation. */
export function firstDeathRun(seed) {
  const engine = createDinoEngine(seed);
  const jumpTicks = [];

  while (!engine.isGameOver() && engine.getTick() < MAX_REPLAY_TICKS) {
    engine.tick(false);
  }

  return {
    score: engine.getScore(),
    jumpTicks,
    ticks: engine.getTick(),
  };
}
