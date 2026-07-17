import { SKINS } from "@/game/skins";

/** Deterministic avatar color from username (UI only, no API). */
export function avatarColorForUsername(
  username: string,
  options?: { isCurrentUser?: boolean; activeSkinId?: string },
): string {
  if (options?.isCurrentUser && options.activeSkinId) {
    return (
      SKINS.find((skin) => skin.id === options.activeSkinId)?.color ?? SKINS[0].color
    );
  }

  let hash = 0;
  for (let i = 0; i < username.length; i += 1) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }

  return SKINS[hash % SKINS.length]?.color ?? SKINS[0].color;
}
