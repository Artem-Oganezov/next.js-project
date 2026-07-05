/** Dino Run game types. Replace entirely when swapping games. */

/** Cactus obstacle: spawns on the right, moves left. */
export type Cactus = {
  x: number;
  width: number;
  height: number;
};

/** Dinosaur state: vertical position and velocity. */
export type DinoState = {
  y: number;
  velocityY: number;
};
