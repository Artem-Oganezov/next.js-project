import { GAME_CONFIG } from "@/game/constants";
import { createDinoEngine } from "@/game/engine";

const { DINO_X, DINO_WIDTH } = GAME_CONFIG;

/** Tick margin before a cactus at which the autoplayer jumps. */
const JUMP_LEAD_TICKS = 15;
const MAX_PLAY_TICKS = 200_000;

export type HonestRun = {
  score: number;
  jumpTicks: number[];
  ticks: number;
};

/**
 * Fair run with a greedy autoplayer: jumps over cacti while score
 * is below targetScore, then stops and hits the next cactus.
 * Final score ≥ targetScore (plus a small tail until collision).
 */
export function playHonestGame(seed: string, targetScore: number): HonestRun {
  const engine = createDinoEngine(seed);
  const jumpTicks: number[] = [];

  while (!engine.isGameOver() && engine.getTick() < MAX_PLAY_TICKS) {
    let jump = false;

    if (engine.getScore() < targetScore && engine.canJump()) {
      const dinoFront = DINO_X + DINO_WIDTH;
      const jumpDistancePx = engine.getSpeed() * JUMP_LEAD_TICKS;
      for (const cactus of engine.getCacti()) {
        const distance = cactus.x - dinoFront;
        if (distance > 0 && distance <= jumpDistancePx) {
          jump = true;
          break;
        }
      }
    }

    if (jump) {
      jumpTicks.push(engine.getTick());
    }
    engine.tick(jump);
  }

  return { score: engine.getScore(), jumpTicks, ticks: engine.getTick() };
}

/**
 * One revive mid-run: die once without jumps, revive, then autoplay to targetScore.
 */
export function playHonestGameWithRevive(
  seed: string,
  targetScoreAfterRevive: number,
): HonestRun & { reviveAtTick: number } {
  const engine = createDinoEngine(seed);
  const jumpTicks: number[] = [];

  while (!engine.isGameOver()) {
    engine.tick(false);
  }
  const reviveAtTick = engine.getTick();
  engine.revive();

  while (!engine.isGameOver() && engine.getTick() < MAX_PLAY_TICKS) {
    let jump = false;

    if (engine.getScore() < targetScoreAfterRevive && engine.canJump()) {
      const dinoFront = DINO_X + DINO_WIDTH;
      const jumpDistancePx = engine.getSpeed() * JUMP_LEAD_TICKS;
      for (const cactus of engine.getCacti()) {
        const distance = cactus.x - dinoFront;
        if (distance > 0 && distance <= jumpDistancePx) {
          jump = true;
          break;
        }
      }
    }

    if (jump) {
      jumpTicks.push(engine.getTick());
    }
    engine.tick(jump);
  }

  return {
    score: engine.getScore(),
    jumpTicks,
    ticks: engine.getTick(),
    reviveAtTick,
  };
}
