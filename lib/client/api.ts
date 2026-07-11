import { ApiError } from "@/lib/client/api-error";
import { submitGameScore } from "@/lib/client/submit-score";

export { ApiError };

type ApiFetchOptions = RequestInit & {
  json?: unknown;
};

async function parseApiResponse<T>(response: Response): Promise<T & { message?: string }> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(
      response.status,
      response.status >= 500
        ? "Server error — try again later"
        : "Unexpected server response",
    );
  }

  try {
    return (await response.json()) as T & { message?: string };
  } catch {
    throw new ApiError(response.status, "Invalid server response");
  }
}

export async function apiFetch<T>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { json, headers, ...rest } = options;

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      credentials: "include",
      headers: {
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "Network error — check your connection");
  }

  const data = await parseApiResponse<T>(response);

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
  gameReviveChallenge: (sessionId: string) =>
    apiFetch<{ challengeId: string; minWaitMs: number }>(
      "/api/game/revive/challenge",
      {
        method: "POST",
        json: { sessionId },
      },
    ),
  gameRevive: (sessionId: string, challengeId: string) =>
    apiFetch<{ ok: boolean }>("/api/game/revive", {
      method: "POST",
      json: { sessionId, challengeId },
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
