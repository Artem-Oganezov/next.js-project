"use client";

import { useCallback, useEffect, useState } from "react";
import AuthForm from "@/components/AuthForm";
import DinoGame from "@/components/DinoGame";
import Spinner from "@/components/ui/Spinner";
import { ApiError, api } from "@/lib/client/api";
import type { User } from "@/types/dino-game.types";

export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.me();
      setUser(data.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        return;
      }
      setError("Не удалось проверить сессию");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const handleLogout = async () => {
    try {
      await api.logout();
      setUser(null);
    } catch {
      setError("Не удалось выйти из аккаунта");
    }
  };

  if (loading) {
    return <Spinner label="Проверка сессии…" />;
  }

  if (error && !user) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void loadSession()}
          className="px-4 py-2 text-sm border border-[#d0d0d0] rounded-sm hover:bg-[#f0f0f0]"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onSuccess={setUser} />;
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <header className="flex items-center gap-4 text-sm text-[#535353]">
        <span className="font-medium">{user.username}</span>
        <span className="text-[#737373]">Рекорд: {user.bestScore}</span>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="px-3 py-1 border border-[#d0d0d0] rounded-sm hover:bg-[#f0f0f0] transition-colors"
        >
          Выход
        </button>
      </header>
      <DinoGame
        initialBestScore={user.bestScore}
        onBestScoreUpdate={(bestScore) =>
          setUser((prev) => (prev ? { ...prev, bestScore } : prev))
        }
      />
    </div>
  );
}
