/** Игровые типы Dino Run. При смене игры заменяются целиком. */

/** Кактус-препятствие: появляется справа, уходит влево. */
export type Cactus = {
  x: number;
  width: number;
  height: number;
};

/** Состояние динозавра: вертикальная позиция и скорость. */
export type DinoState = {
  y: number;
  velocityY: number;
};
