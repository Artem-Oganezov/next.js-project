"use client";

import type { User } from "@/types/user";
import { useCallback, useEffect, useState } from "react";
import AuthForm from "@/components/AuthForm";
import HomeScreen from "@/components/HomeScreen";
import LeaderboardScreen from "@/components/LeaderboardScreen";
import ProfileScreen from "@/components/ProfileScreen";
import Spinner from "@/components/ui/Spinner";
import { Game, SKINS } from "@/game";
import { ApiError, api } from "@/lib/client/api";
import { ui } from "@/lib/i18n/ui";

type AppScreen = "home" | "leaderboard" | "profile" | "game";

type TabScreen = Exclude<AppScreen, "game">;

const TAB_ITEMS: { id: TabScreen; label: string }[] = [
  { id: "home", label: ui.nav.home },
  { id: "leaderboard", label: ui.nav.leaderboard },
  { id: "profile", label: ui.nav.profile },
];

export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [screen, setScreen] = useState<AppScreen>("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.me();
      setUser(data.user);
      setScreen("home");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        return;
      }
      setError(ui.auth.sessionCheckFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.me();
      setUser(data.user);
    } catch {
      // Сессия могла истечь — не мешаем возврату на главную.
    }
  }, []);

  const handleAuthSuccess = (nextUser: User) => {
    setUser(nextUser);
    setScreen("home");
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setUser(null);
      setScreen("home");
    } catch {
      setError(ui.auth.logoutFailed);
    }
  };

  if (loading) {
    return <Spinner label={ui.auth.sessionCheck} />;
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
          {ui.common.retry}
        </button>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onSuccess={handleAuthSuccess} />;
  }

  if (screen !== "game") {
    const handleUserUpdate = (patch: {
      activeSkin?: string;
      totalScore?: number;
      unlockedSkins?: string[];
    }) => setUser((prev) => (prev ? { ...prev, ...patch } : prev));

    return (
      <div className="flex flex-col w-full max-w-md mx-auto min-h-[70vh]">
        <div className="flex-1 pb-4">
          {screen === "home" && (
            <HomeScreen
              username={user.username}
              bestScore={user.bestScore}
              totalScore={user.totalScore}
              unlockedSkins={user.unlockedSkins}
              activeSkin={user.activeSkin}
              onUserUpdate={handleUserUpdate}
              onStart={() => setScreen("game")}
              onLogout={() => void handleLogout()}
            />
          )}
          {screen === "leaderboard" && (
            <LeaderboardScreen
              username={user.username}
              onBack={() => setScreen("home")}
            />
          )}
          {screen === "profile" && (
            <ProfileScreen
              username={user.username}
              emailVerified={user.emailVerified}
              bestScore={user.bestScore}
              totalScore={user.totalScore}
              unlockedSkins={user.unlockedSkins}
              activeSkin={user.activeSkin}
              onUserUpdate={handleUserUpdate}
              onLogout={() => void handleLogout()}
              onBack={() => setScreen("home")}
            />
          )}
        </div>

        <nav
          className="sticky bottom-0 mt-auto pt-3 border-t border-[#e0e0e0] bg-[#fafafa]"
          aria-label={ui.nav.main}
        >
          <ul className="flex">
            {TAB_ITEMS.map((tab) => {
              const isActive = screen === tab.id;

              return (
                <li key={tab.id} className="flex-1">
                  <button
                    type="button"
                    onClick={() => setScreen(tab.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`w-full py-2.5 text-sm transition-colors ${
                      isActive
                        ? "text-[#535353] font-medium"
                        : "text-[#737373] hover:text-[#535353]"
                    }`}
                  >
                    {tab.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    );
  }

  const activeSkinColor =
    SKINS.find((skin) => skin.id === user.activeSkin)?.color ?? "#535353";

  return (
    <Game
      initialBestScore={user.bestScore}
      activeSkinColor={activeSkinColor}
      onScoreSaved={({ bestScore, totalScore }) =>
        setUser((prev) => (prev ? { ...prev, bestScore, totalScore } : prev))
      }
      onBack={() => {
        void refreshUser();
        setScreen("home");
      }}
    />
  );
}
