import type { Metadata } from "next";
import { Suspense } from "react";
import ResetPasswordScreen from "@/components/ResetPasswordScreen";
import Spinner from "@/components/ui/Spinner";
import { gameMeta } from "@/game/meta";
import { ui } from "@/lib/i18n/ui";

export const metadata: Metadata = {
  title: `${ui.auth.resetPasswordTitle} — ${gameMeta.displayName}`,
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="legal-page">
          <Spinner label={ui.common.loading} />
        </main>
      }
    >
      <ResetPasswordScreen />
    </Suspense>
  );
}
