import { ApiError } from "@/lib/client/api-error";
import { submitGameScore } from "@/lib/client/submit-score";

export { ApiError };

type ApiFetchOptions = RequestInit & {
  json?: unknown;
};

export async function apiFetch<T>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { json, headers, ...rest } = options;

  const response = await fetch(url, {
    ...rest,
    credentials: "include",
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  const data = (await response.json()) as T & { message?: string };

  if (!response.ok) {
    throw new ApiError(response.status, data.message ?? "Request failed");
  }

  return data;
}

export const api = {
  me: () => apiFetch<{ user: import("@/types/user").SessionUser }>("/api/auth/me"),
  authProviders: () => apiFetch<{ google: boolean }>("/api/auth/providers"),
  login: (body: { username: string; password: string }) =>
    apiFetch<{ user: import("@/types/user").User }>("/api/auth/login", {
      method: "POST",
      json: body,
    }),
  register: (body: { username: string; email: string; password: string }) =>
    apiFetch<{ user: import("@/types/user").User }>("/api/auth/register", {
      method: "POST",
      json: body,
    }),
  logout: () => apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      json: { email },
    }),
  resetPassword: (body: { token: string; password: string }) =>
    apiFetch<{ ok: boolean }>("/api/auth/reset-password", {
      method: "POST",
      json: body,
    }),
  resendVerification: () =>
    apiFetch<{ ok: boolean }>("/api/auth/resend-verification", { method: "POST" }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    apiFetch<{ ok: boolean }>("/api/auth/password", { method: "PUT", json: body }),
  deleteAccount: (body: { password?: string }) =>
    apiFetch<{ ok: boolean }>("/api/auth/account", { method: "DELETE", json: body }),
  startGameSession: () =>
    apiFetch<{ sessionId: string; seed: string; startedAt: string }>(
      "/api/game/session/start",
      { method: "POST" },
    ),
  gameRevive: (sessionId: string) =>
    apiFetch<{ ok: boolean }>("/api/game/revive", {
      method: "POST",
      json: { sessionId },
    }),
  submitScore: (
    score: number,
    sessionId: string,
    inputLog: unknown,
    onSaving?: (saving: boolean) => void,
  ) => submitGameScore(score, sessionId, inputLog, onSaving),
  getLeaderboard: () =>
    apiFetch<{ leaderboard: { username: string; bestScore: number }[] }>(
      "/api/leaderboard",
    ),
  getLeaderboardRank: () =>
    apiFetch<{ rank: number; nextUsername: string | null }>("/api/leaderboard/rank"),
  unlockSkin: (skinId: string) =>
    apiFetch<{ totalScore: number; unlockedSkins: string[] }>("/api/skins", {
      method: "POST",
      json: { skinId },
    }),
  equipSkin: (skinId: string) =>
    apiFetch<{ activeSkin: string }>("/api/skins", {
      method: "PUT",
      json: { skinId },
    }),
};
