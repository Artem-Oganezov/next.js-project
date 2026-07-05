"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import DinoSvg from "@/components/ui/DinoSvg";
import { gameMeta } from "@/game/meta";
import { SKINS } from "@/game/skins";
import { ApiError, api } from "@/lib/client/api";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
} from "@/lib/validation/auth";
import { ui } from "@/lib/i18n/ui";
import type { User } from "@/types/user";

type Mode = "login" | "register" | "forgot";

type AuthFormProps = {
  onSuccess: (user: User) => void;
};

function AuthGameTitle() {
  const accent = gameMeta.displayNameAccent;
  const base = gameMeta.displayName.replace(accent, "").trim();

  return (
    <h1 className="auth-title">
      {base}
      <span className="game-title-accent">{accent}</span>
    </h1>
  );
}

function LoginForm({
  onSuccess,
  onForgot,
}: {
  onSuccess: (user: User) => void;
  onForgot: () => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    defaultValues: { username: "", password: "" },
    resolver: zodResolver(loginSchema),
  });

  const authMutation = useMutation({
    mutationFn: (values: LoginInput) =>
      api.login({
        username: values.username.trim(),
        password: values.password,
      }),
    onSuccess: (data) => onSuccess(data.user),
    onError: (err) => {
      setSubmitError(err instanceof ApiError ? err.message : ui.common.networkError);
    },
  });

  const loading = isSubmitting || authMutation.isPending;

  return (
    <form
      onSubmit={handleSubmit((values) => {
        setSubmitError(null);
        authMutation.mutate(values);
      })}
      className="flex flex-col gap-1"
      noValidate
    >
      <label className="field-label">
        {ui.auth.username}
        <input
          type="text"
          autoComplete="username"
          disabled={loading}
          data-testid="auth-username"
          className="field-input"
          {...register("username")}
        />
      </label>
      {errors.username && (
        <p className="alert-error" role="alert">
          {errors.username.message}
        </p>
      )}

      <label className="field-label">
        {ui.auth.password}
        <input
          type="password"
          autoComplete="current-password"
          disabled={loading}
          data-testid="auth-password"
          className="field-input"
          {...register("password")}
        />
      </label>
      {errors.password && (
        <p className="alert-error" role="alert">
          {errors.password.message}
        </p>
      )}

      <button
        type="button"
        onClick={onForgot}
        disabled={loading}
        data-testid="auth-forgot-password"
        className="auth-switch p-0 text-left"
      >
        {ui.auth.forgotPassword}
      </button>

      {submitError && (
        <p className="alert-error" role="alert">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        data-testid="auth-submit"
        className="start-btn mt-3"
      >
        {loading ? ui.auth.wait : ui.auth.login}
      </button>
    </form>
  );
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    defaultValues: { email: "" },
    resolver: zodResolver(forgotPasswordSchema),
  });

  const forgotMutation = useMutation({
    mutationFn: (values: ForgotPasswordInput) =>
      api.forgotPassword(values.email.trim()),
    onSuccess: () => {
      setSubmitError(null);
      setSent(true);
    },
    onError: (err) => {
      setSubmitError(err instanceof ApiError ? err.message : ui.common.networkError);
    },
  });

  const loading = isSubmitting || forgotMutation.isPending;

  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <p className="alert-success" role="status">
          {ui.auth.forgotSent}
        </p>
        <button type="button" onClick={onBack} className="auth-switch p-0 text-left">
          {ui.auth.backToLogin}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((values) => {
        setSubmitError(null);
        forgotMutation.mutate(values);
      })}
      className="flex flex-col gap-1"
      noValidate
    >
      <label className="field-label">
        Email
        <input
          type="email"
          autoComplete="email"
          disabled={loading}
          data-testid="auth-forgot-email"
          className="field-input"
          {...register("email")}
        />
      </label>
      {errors.email && (
        <p className="alert-error" role="alert">
          {errors.email.message}
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
        data-testid="auth-forgot-submit"
        className="start-btn mt-3"
      >
        {loading ? ui.auth.wait : ui.auth.forgotSubmit}
      </button>
      <button type="button" onClick={onBack} disabled={loading} className="auth-switch">
        {ui.auth.backToLogin}
      </button>
    </form>
  );
}

function RegisterForm({ onSuccess }: { onSuccess: (user: User) => void }) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    defaultValues: { username: "", email: "", password: "" },
    resolver: zodResolver(registerSchema),
  });

  const authMutation = useMutation({
    mutationFn: (values: RegisterInput) =>
      api.register({
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
      }),
    onSuccess: (data) => onSuccess(data.user),
    onError: (err) => {
      setSubmitError(err instanceof ApiError ? err.message : ui.common.networkError);
    },
  });

  const loading = isSubmitting || authMutation.isPending;

  return (
    <form
      onSubmit={handleSubmit((values) => {
        setSubmitError(null);
        authMutation.mutate(values);
      })}
      className="flex flex-col gap-1"
      noValidate
    >
      <label className="field-label">
        {ui.auth.username}
        <input
          type="text"
          autoComplete="username"
          disabled={loading}
          data-testid="auth-username"
          className="field-input"
          {...register("username")}
        />
      </label>
      {errors.username && (
        <p className="alert-error" role="alert">
          {errors.username.message}
        </p>
      )}

      <label className="field-label">
        Email
        <input
          type="email"
          autoComplete="email"
          disabled={loading}
          data-testid="auth-email"
          className="field-input"
          {...register("email")}
        />
      </label>
      {errors.email && (
        <p className="alert-error" role="alert">
          {errors.email.message}
        </p>
      )}

      <label className="field-label">
        {ui.auth.password}
        <input
          type="password"
          autoComplete="new-password"
          disabled={loading}
          data-testid="auth-password"
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
        data-testid="auth-submit"
        className="start-btn mt-3"
      >
        {loading ? ui.auth.wait : ui.auth.register}
      </button>
    </form>
  );
}

export default function AuthForm({ onSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<Mode>("login");

  const subtitle =
    mode === "register"
      ? ui.auth.joinGame
      : mode === "forgot"
        ? ui.auth.forgotSubtitle
        : ui.auth.welcomeBack;

  return (
    <div className="auth-shell">
      <div className="auth-hero" aria-hidden>
        <div className="auth-hero-dino">
          <DinoSvg color={SKINS[0]?.color ?? "var(--coral)"} size={52} />
        </div>
      </div>

      <div className="auth-card">
        <AuthGameTitle />
        <p className="auth-subtitle">{subtitle}</p>

        {mode === "register" && <RegisterForm onSuccess={onSuccess} />}
        {mode === "login" && (
          <LoginForm onSuccess={onSuccess} onForgot={() => setMode("forgot")} />
        )}
        {mode === "forgot" && <ForgotPasswordForm onBack={() => setMode("login")} />}

        {mode !== "forgot" && (
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            data-testid="auth-switch-mode"
            className="auth-switch"
          >
            {mode === "register" ? ui.auth.haveAccount : ui.auth.noAccount}
          </button>
        )}
      </div>
    </div>
  );
}
