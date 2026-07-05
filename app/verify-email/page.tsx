import type { Metadata } from "next";
import { Suspense } from "react";
import VerifyEmailScreen from "@/components/VerifyEmailScreen";
import Spinner from "@/components/ui/Spinner";
import { gameMeta } from "@/game/meta";
import { ui } from "@/lib/i18n/ui";

export const metadata: Metadata = {
  title: `${ui.auth.emailVerifiedTitle} — ${gameMeta.displayName}`,
};

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="legal-page">
          <Spinner label={ui.common.loading} />
        </main>
      }
    >
      <VerifyEmailScreen />
    </Suspense>
  );
}
