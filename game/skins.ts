/**
 * Game skins (optional). If gameMeta.features.skins === false,
 * the skins UI is hidden — keep only default.
 *
 * Read by both server (app/api/skins) and client — pure data only.
 */
export type SkinDefinition = {
  id: string;
  name: string;
  color: string;
  /** Price in totalScore; 0 — available immediately. */
  price: number;
};

export const SKINS: SkinDefinition[] = [
  { id: "default", name: "Coral", color: "#ff6f5e", price: 0 },
  { id: "blue", name: "Grape", color: "#7c5cff", price: 200 },
  { id: "orange", name: "Honey", color: "#ffb84d", price: 500 },
  { id: "purple", name: "Bubble", color: "#ff6ec7", price: 1000 },
  { id: "gold", name: "Mint", color: "#4fd1c5", price: 2000 },
];
