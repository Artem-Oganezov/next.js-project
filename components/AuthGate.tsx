"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import AuthForm from "@/components/AuthForm";
import HomeScreen from "@/components/HomeScreen";
import LeaderboardScreen from "@/components/LeaderboardScreen";
import ProfileScreen from "@/components/ProfileScreen";
import Spinner from "@/components/ui/Spinner";
import { HomeIcon, LeaderboardIcon, ProfileIcon } from "@/components/ui/NavIcons";
import { Game, SKINS } from "@/game";
import { useLogoutMutation, useSessionQuery } from "@/lib/client/hooks";
import { queryKeys } from "@/lib/client/query-keys";
import { ui } from "@/lib/i18n/ui";
import { toSessionUser, type SessionUser, type User } from "@/types/user";

type AppScreen = "home" | "leaderboard" | "profile" | "game";

type TabScreen = Exclude<AppScreen, "game">;

const TAB_ITEMS: { id: TabScreen; label: string; Icon: typeof HomeIcon }[] = [
  { id: "home", label: ui.nav.home, Icon: HomeIcon },
  { id: "leaderboard", label: ui.nav.leaderboard, Icon: LeaderboardIcon },
  { id: "profile", label: ui.nav.profile, Icon: ProfileIcon },
];

export default function AuthGate() {
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<AppScreen>("home");
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const { data: user = null, isLoading, isError, refetch } = useSessionQuery();
  const logoutMutation = useLogoutMutation();

  const handleAuthSuccess = (nextUser: User) => {
    queryClient.setQueryData(queryKeys.session, toSessionUser(nextUser));
    setScreen("home");
  };

  const handleLogout = () => {
    setLogoutError(null);
    logoutMutation.mutate(undefined, {
      onSuccess: () => setScreen("home"),
      onError: () => setLogoutError(ui.auth.logoutFailed),
    });
  };

  const refreshUser = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.session });
  };

  const patchUser = (patch: Partial<SessionUser>) => {
    queryClient.setQueryData<SessionUser | null>(queryKeys.session, (prev) =>
      prev ? { ...prev, ...patch } : prev,
    );
  };

  if (isLoading) {
    return (
      <div className="app">
        <Spinner label={ui.auth.sessionCheck} />
      </div>
    );
  }

  if (isError && !user) {
    return (
      <div className="app screen-content">
        <p className="alert-error text-center" role="alert">
          {ui.auth.sessionCheckFailed}
        </p>
        <button type="button" className="start-btn mt-4" onClick={() => void refetch()}>
          {ui.common.retry}
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app flex items-center justify-center min-h-[80vh]">
        <AuthForm onSuccess={handleAuthSuccess} />
      </div>
    );
  }

  if (screen === "game") {
    const activeSkinColor =
      SKINS.find((skin) => skin.id === user.activeSkin)?.color ?? "#ff6f5e";

    return (
      <Game
        username={user.username}
        initialBestScore={user.bestScore}
        activeSkinColor={activeSkinColor}
        onScoreSaved={({ bestScore, totalScore }) => {
          patchUser({ bestScore, totalScore });
          void queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard });
          void queryClient.invalidateQueries({ queryKey: queryKeys.rank });
        }}
        onBack={() => {
          refreshUser();
          setScreen("home");
        }}
        onOpenLeaderboard={() => {
          refreshUser();
          setScreen("leaderboard");
        }}
      />
    );
  }

  return (
    <div className="app">
      {logoutError && (
        <p className="alert-error text-center px-4 pt-2" role="alert">
          {logoutError}
        </p>
      )}

      <div className="screen-content">
        {screen === "home" && (
          <HomeScreen
            username={user.username}
            bestScore={user.bestScore}
            totalScore={user.totalScore}
            unlockedSkins={user.unlockedSkins}
            activeSkin={user.activeSkin}
            onUserUpdate={patchUser}
            onStart={() => setScreen("game")}
            onLogout={handleLogout}
            onViewLeaderboard={() => setScreen("leaderboard")}
          />
        )}
        {screen === "leaderboard" && (
          <LeaderboardScreen
            username={user.username}
            bestScore={user.bestScore}
            activeSkinId={user.activeSkin}
            onBack={() => setScreen("home")}
          />
        )}
        {screen === "profile" && (
          <ProfileScreen
            username={user.username}
            emailVerified={user.emailVerified}
            authProvider={user.authProvider}
            bestScore={user.bestScore}
            totalScore={user.totalScore}
            unlockedSkins={user.unlockedSkins}
            activeSkin={user.activeSkin}
            onUserUpdate={patchUser}
            onLogout={handleLogout}
            onBack={() => setScreen("home")}
          />
        )}
      </div>

      <nav className="bottom-nav" aria-label={ui.nav.main}>
        {TAB_ITEMS.map((tab) => {
          const isActive = screen === tab.id;
          const { Icon } = tab;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScreen(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`nav-btn${isActive ? " nav-btn-active" : ""}`}
            >
              <Icon />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
