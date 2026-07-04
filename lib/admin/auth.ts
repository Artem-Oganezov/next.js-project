import { unauthorized } from "@/lib/api/errors";
import { getEnv } from "@/lib/env";

/**
 * Проверка секрета админки: заголовок `X-Admin-Secret` или
 * `Authorization: Bearer <secret>`.
 */
export function requireAdminSecret(request: Request): Response | null {
  const { ADMIN_SECRET } = getEnv();
  if (!ADMIN_SECRET) {
    return unauthorized("Админка не настроена");
  }

  const headerSecret = request.headers.get("x-admin-secret");
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ")
    ? auth.slice("Bearer ".length).trim()
    : null;
  const provided = headerSecret ?? bearer;

  if (!provided || provided !== ADMIN_SECRET) {
    return unauthorized("Неверный секрет администратора");
  }

  return null;
}
