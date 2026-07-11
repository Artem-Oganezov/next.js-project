/** Public user (shared by shell and API, game-agnostic). */
export type AuthProvider = "local" | "google";

export type User = {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  authProvider: AuthProvider;
  bestScore: number;
  totalScore: number;
  unlockedSkins: string[];
  activeSkin: string;
};

/** Session-scoped user: same as User but email is never cached or returned from /api/auth/me. */
export type SessionUser = Omit<User, "email">;

export function toSessionUser(user: User): SessionUser {
  const { email: _email, ...session } = user;
  return session;
}
