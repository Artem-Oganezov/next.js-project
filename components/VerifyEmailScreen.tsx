"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ui } from "@/lib/i18n/ui";

export default function VerifyEmailScreen() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const success = status === "success";

  return (
    <main className="legal-page">
      <div className="legal-card auth-card">
        <h1>{ui.auth.emailVerifiedTitle}</h1>
        {success ? (
          <>
            <p className="alert-success" role="status">
              {ui.auth.emailVerifiedSuccess}
            </p>
            <Link href="/" className="start-btn mt-4 inline-block text-center">
              {ui.auth.login}
            </Link>
          </>
        ) : (
          <>
            <p className="alert-error" role="alert">
              {ui.auth.emailVerifiedFailed}
            </p>
            <Link href="/" className="auth-switch mt-4 inline-block">
              {ui.auth.backToLogin}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
