/** Visual theme for canvas + stage preview. Does not affect game physics or API. */
export const GAME_THEME = {
  skyTop: "#ffeede",
  skyBottom: "#ffd0c0",
  ground: "#e8543f",
  groundLine: "#e8543f",
  cactus: "#7c5cff",
  sun: "#ffb84d",
  cloud: "#ffffff",
  eye: "#3b2b4a",
  leg: "#e8543f",
} as const;

export type GameTheme = typeof GAME_THEME;

/** Darken hex color for limbs/shadows (canvas only). */
export function darkenColor(color: string, factor = 0.82): string {
  if (!color.startsWith("#") || color.length < 7) {
    return GAME_THEME.leg;
  }

  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

  return `#${toHex(r * factor)}${toHex(g * factor)}${toHex(b * factor)}`;
}
