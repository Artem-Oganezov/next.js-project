export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiFetchOptions = RequestInit & {
  json?: unknown;
};

export async function apiFetch<T>(url: string, options: ApiFetchOptions = {}): Promise<T> {
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
    throw new ApiError(response.status, data.message ?? "Ошибка запроса");
  }

  return data;
}

export const api = {
  me: () => apiFetch<{ user: import("@/types/dino-game.types").User }>("/api/auth/me"),
  login: (body: { username: string; password: string }) =>
    apiFetch<{ user: import("@/types/dino-game.types").User }>("/api/auth/login", {
      method: "POST",
      json: body,
    }),
  register: (body: { username: string; email: string; password: string }) =>
    apiFetch<{ user: import("@/types/dino-game.types").User }>("/api/auth/register", {
      method: "POST",
      json: body,
    }),
  logout: () => apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  startGameSession: () =>
    apiFetch<{ startedAt: string }>("/api/game/session/start", { method: "POST" }),
  submitScore: (score: number) =>
    apiFetch<{ bestScore: number; isNewRecord: boolean }>("/api/game/score", {
      method: "POST",
      json: { score },
    }),
};
