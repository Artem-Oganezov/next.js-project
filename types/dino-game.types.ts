// Тип одного кактуса-препятствия на экране
export type Cactus = {
  x: number; // позиция по X (справа появляется, уходит влево)
  width: number; // ширина кактуса
  height: number; // высота кактуса
};

// Состояние динозавра: позиция и вертикальная скорость
export type DinoState = {
  y: number; // текущая позиция по вертикали
  velocityY: number; // вертикальная скорость (прыжок / падение)
};

export type User = {
  id: string;
  username: string;
  email: string;
  bestScore: number;
};
