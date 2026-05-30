"use client";

import { useEffect, useState } from "react";
import AuthForm from "@/components/AuthForm";
import DinoGame from "@/components/DinoGame";
import type { User } from "@/types/dino-game.types";

export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as { user: User };
          setUser(data.user);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  };

  if (loading) {
    return null;
  }

  if (!user) {
    return <AuthForm onSuccess={setUser} />;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3 text-sm text-[#535353]">
        <span>{user.username}</span>
        <button
          type="button"
          onClick={handleLogout}
          className="px-3 py-1 border border-[#d0d0d0] rounded-sm hover:bg-[#f0f0f0] transition-colors"
        >
          Выход
        </button>
      </div>
      <DinoGame
        initialBestScore={user.bestScore}
        onBestScoreUpdate={(bestScore) =>
          setUser((prev) => (prev ? { ...prev, bestScore } : prev))
        }
      />
    </div>
  );
}
