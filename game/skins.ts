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
  { id: "default", name: "Classic", color: "#535353", price: 0 },
  { id: "blue", name: "Ocean", color: "#2c5282", price: 200 },
  { id: "orange", name: "Fire", color: "#c05621", price: 500 },
  { id: "purple", name: "Shadow", color: "#553c9a", price: 1000 },
  { id: "gold", name: "Legend", color: "#b7791f", price: 2000 },
];
