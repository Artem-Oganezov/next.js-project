/**
 * Скины игры (опционально). Если gameMeta.features.skins === false,
 * UI скинов скрыт — оставь только default.
 *
 * Читается и сервером (app/api/skins) и клиентом — только чистые данные.
 */
export type SkinDefinition = {
  id: string;
  name: string;
  color: string;
  /** Цена в totalScore; 0 — доступен сразу. */
  price: number;
};

export const SKINS: SkinDefinition[] = [
  { id: "default", name: "Coral", color: "#ff6f5e", price: 0 },
  { id: "blue", name: "Grape", color: "#7c5cff", price: 200 },
  { id: "orange", name: "Honey", color: "#ffb84d", price: 500 },
  { id: "purple", name: "Bubble", color: "#ff6ec7", price: 1000 },
  { id: "gold", name: "Mint", color: "#4fd1c5", price: 2000 },
];
