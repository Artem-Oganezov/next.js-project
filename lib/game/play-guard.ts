import { getEnv } from "@/lib/env";
import { msg } from "@/lib/i18n/messages";
import type { User as PublicUser } from "@/types/user";

export type PlayGuardResult =
  | { ok: true }
  | { ok: false; message: string };

export function isEmailVerificationRequired(): boolean {
  return Boolean(getEnv().REQUIRE_EMAIL_VERIFICATION);
}

/** Gate gameplay APIs when REQUIRE_EMAIL_VERIFICATION is enabled. */
export function assertCanPlay(user: PublicUser): PlayGuardResult {
  if (!isEmailVerificationRequired() || user.emailVerified) {
    return { ok: true };
  }

  return { ok: false, message: msg.game.emailNotVerified };
}
