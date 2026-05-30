"use client";

import { useState } from "react";
import { ApiError, api } from "@/lib/client/api";
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
    const trimmedUsername = form.username.trim();
    if (!trimmedUsername) return;

    setLoading(true);
    setError(null);

    try {
      const data = isRegister
        ? await api.register({
            username: trimmedUsername,
            email: form.email.trim(),
            password: form.password,
          })
        : await api.login({
            username: trimmedUsername,
            password: form.password,
          });

      onSuccess(data.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Ошибка сети");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((current) => (current === "login" ? "register" : "login"));
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

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3" noValidate>
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
            className="px-3 py-2 border border-[#d0d0d0] rounded-sm bg-white focus:outline-none focus:border-[#535353]"
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
              className="px-3 py-2 border border-[#d0d0d0] rounded-sm bg-white focus:outline-none focus:border-[#535353]"
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
            className="px-3 py-2 border border-[#d0d0d0] rounded-sm bg-white focus:outline-none focus:border-[#535353]"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 px-4 py-2 bg-[#535353] text-white rounded-sm font-medium hover:bg-[#404040] disabled:opacity-60 transition-colors"
        >
          {loading ? "Подождите…" : isRegister ? "Зарегистрироваться" : "Войти"}
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
        {isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
      </button>
    </div>
  );
}
