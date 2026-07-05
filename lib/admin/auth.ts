import { unauthorized } from "@/lib/api/errors";
import { msg } from "@/lib/i18n/messages";
import { getEnv } from "@/lib/env";
import { secureCompare } from "@/lib/security/secure-compare";

/**
 * Admin secret check: `X-Admin-Secret` header or
 * `Authorization: Bearer <secret>`.
 */
export function requireAdminSecret(request: Request): Response | null {
  const { ADMIN_SECRET } = getEnv();
  if (!ADMIN_SECRET) {
    return unauthorized(msg.admin.notConfigured);
  }

  const headerSecret = request.headers.get("x-admin-secret");
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ")
    ? auth.slice("Bearer ".length).trim()
    : null;
  const provided = headerSecret ?? bearer;

  if (!provided || !secureCompare(provided, ADMIN_SECRET)) {
    return unauthorized(msg.admin.invalidSecret);
  }

  return null;
}
