"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, api } from "@/lib/client/api";
import { msg } from "@/lib/i18n/messages";
import { ui } from "@/lib/i18n/ui";

const newPasswordSchema = z.object({
  password: z
    .string()
    .min(8, msg.auth.passwordMin)
    .max(128, msg.auth.passwordMax),
});

type NewPasswordInput = z.infer<typeof newPasswordSchema>;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordInput>({
    defaultValues: { password: "" },
    resolver: zodResolver(newPasswordSchema),
  });

  const resetMutation = useMutation({
    mutationFn: (password: string) => {
      if (!token) {
        throw new ApiError(400, ui.auth.resetPasswordMissingToken);
      }
      return api.resetPassword({ token, password });
    },
    onSuccess: () => setDone(true),
  });

  const loading = isSubmitting || resetMutation.isPending;
  const submitError =
    resetMutation.error instanceof ApiError
      ? resetMutation.error.message
      : resetMutation.error
        ? ui.common.networkError
        : null;

  if (!token) {
    return (
      <main className="legal-page">
        <div className="legal-card auth-card">
          <Link href="/" className="back-link">
            {ui.common.back}
          </Link>
          <h1>{ui.auth.resetPasswordTitle}</h1>
          <p className="alert-error" role="alert">
            {ui.auth.resetPasswordMissingToken}
          </p>
          <Link href="/" className="start-btn mt-4 inline-block text-center">
            {ui.auth.backToLogin}
          </Link>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="legal-page">
        <div className="legal-card auth-card">
          <h1>{ui.auth.resetPasswordTitle}</h1>
          <p className="alert-success" role="status">
            {ui.auth.resetPasswordSuccess}
          </p>
          <button
            type="button"
            className="start-btn mt-4"
            onClick={() => router.push("/")}
          >
            {ui.auth.login}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="legal-page">
      <div className="legal-card auth-card">
        <Link href="/" className="back-link">
          {ui.common.back}
        </Link>
        <h1>{ui.auth.resetPasswordTitle}</h1>

        <form
          onSubmit={handleSubmit((values) => resetMutation.mutate(values.password))}
          className="flex flex-col gap-1 mt-4"
          noValidate
        >
          <label className="field-label">
            {ui.auth.newPassword}
            <input
              type="password"
              autoComplete="new-password"
              disabled={loading}
              data-testid="reset-password-input"
              className="field-input"
              {...register("password")}
            />
          </label>
          {errors.password && (
            <p className="alert-error" role="alert">
              {errors.password.message}
            </p>
          )}
          {submitError && (
            <p className="alert-error" role="alert">
              {submitError}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            data-testid="reset-password-submit"
            className="start-btn mt-3"
          >
            {loading ? ui.auth.wait : ui.auth.resetPasswordSubmit}
          </button>
        </form>
      </div>
    </main>
  );
}
