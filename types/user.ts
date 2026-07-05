/** Public user (shared by shell and API, game-agnostic). */
export type User = {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  bestScore: number;
  totalScore: number;
  unlockedSkins: string[];
  activeSkin: string;
};
