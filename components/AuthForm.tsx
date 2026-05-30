"use client";

import { useState } from "react";
import type { User } from "@/types/dino-game.types";

type Mode = "login" | "register";

type AuthFormState = Pick<User, "username" | "email"> & {
  password: string;
};

const initialForm: AuthFormState = {
  username: "",
  email: "",
  password: "",
};

type AuthFormProps = {
  onSuccess: (user: User) => void;
};

export default function AuthForm({ onSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState<AuthFormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === "register";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = form.username.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    const body = isRegister
      ? { username: trimmed, email: form.email.trim(), password: form.password }
      : { username: trimmed, password: form.password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { user?: User; message?: string };

      if (!res.ok) {
        setError(data.message ?? "Ошибка");
        return;
      }

      if (data.user) {
        onSuccess(data.user);
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError(null);
  };

  const update =
    (field: keyof AuthFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  return (
    <div className="w-full max-w-sm mx-auto">
      <h2 className="text-xl font-bold text-[#535353] tracking-tight text-center">
        {isRegister ? "Регистрация" : "Вход"}
      </h2>

      <form
        onSubmit={handleSubmit}
        className="mt-4 flex flex-col gap-3"
        noValidate
      >
        <label className="flex flex-col gap-1 text-sm text-[#535353]">
          Имя пользователя
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={update("username")}
            autoComplete="username"
            required
            disabled={loading}
            className="px-3 py-2 border border-[#d0d0d0] rounded-sm bg-white text-[#535353] focus:outline-none focus:border-[#535353]"
          />
        </label>

        {isRegister && (
          <label className="flex flex-col gap-1 text-sm text-[#535353]">
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={update("email")}
              autoComplete="email"
              required
              disabled={loading}
              className="px-3 py-2 border border-[#d0d0d0] rounded-sm bg-white text-[#535353] focus:outline-none focus:border-[#535353]"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm text-[#535353]">
          Пароль
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={update("password")}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            disabled={loading}
            className="px-3 py-2 border border-[#d0d0d0] rounded-sm bg-white text-[#535353] focus:outline-none focus:border-[#535353]"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 px-4 py-2 bg-[#535353] text-white rounded-sm font-medium hover:bg-[#404040] transition-colors"
        >
          {isRegister ? "Зарегистрироваться" : "Войти"}
        </button>
      </form>

      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={switchMode}
        disabled={loading}
        className="mt-4 w-full text-sm text-[#737373] hover:text-[#535353] transition-colors"
      >
        {isRegister
          ? "Уже есть аккаунт? Войти"
          : "Нет аккаунта? Зарегистрироваться"}
      </button>
    </div>
  );
}
