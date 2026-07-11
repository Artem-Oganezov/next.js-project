import { ApiError, api } from "@/lib/client/api";
import type { SessionUser } from "@/types/user";

/** Returns null when unauthenticated (401), throws on other errors. */
export async function fetchSessionUser(): Promise<SessionUser | null> {
  try {
    const data = await api.me();
    return data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return null;
    }
    throw err;
  }
}
