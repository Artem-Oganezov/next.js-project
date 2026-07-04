/** Публичный юзер (общий для shell и API, не зависит от игры). */
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
