"use client";

import { useEffect, useState } from "react";
import { SKINS, gameMeta } from "@/game";
import { ui } from "@/lib/i18n/ui";

type LeaderboardEntry = {
  username: string;
  bestScore: number;
};

type HomeScreenProps = {
  username: string;
  bestScore: number;
  totalScore?: number;
  unlockedSkins?: string[];
  activeSkin?: string;
  onUserUpdate?: (patch: {
    activeSkin?: string;
    totalScore?: number;
    unlockedSkins?: string[];
  }) => void;
  onStart: () => void;
  onLogout: () => void;
};

export default function HomeScreen({
  username,
  bestScore,
  totalScore: totalScoreProp,
  unlockedSkins: unlockedSkinsProp,
  activeSkin: activeSkinProp,
  onUserUpdate,
  onStart,
  onLogout,
}: HomeScreenProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState(false);

  const [totalScore, setTotalScore] = useState<number | undefined>(totalScoreProp);
  const [unlockedSkins, setUnlockedSkins] = useState<string[] | undefined>(
    unlockedSkinsProp,
  );
  const [activeSkin, setActiveSkin] = useState<string | undefined>(activeSkinProp);
  const [skinError, setSkinError] = useState<string | null>(null);

  const safeTotalScore = totalScore ?? 0;
  const safeUnlockedSkins = unlockedSkins ?? ["default"];
  const safeActiveSkin = activeSkin ?? "default";

  useEffect(() => {
    if (totalScoreProp !== undefined) {
      setTotalScore(totalScoreProp);
    }
    if (unlockedSkinsProp !== undefined) {
      setUnlockedSkins(unlockedSkinsProp);
    }
    if (activeSkinProp !== undefined) {
      setActiveSkin(activeSkinProp);
    }
  }, [totalScoreProp, unlockedSkinsProp, activeSkinProp]);

  useEffect(() => {
    if (
      totalScoreProp !== undefined &&
      unlockedSkinsProp !== undefined &&
      activeSkinProp !== undefined
    ) {
      return;
    }

    let cancelled = false;

    async function loadUserSkins() {
      setSkinError(null);

      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) throw new Error("Failed to load user");

        const data = (await response.json()) as {
          user: {
            totalScore?: number;
            unlockedSkins?: string[];
            activeSkin?: string;
          };
        };
        if (!cancelled) {
          setTotalScore(data.user.totalScore ?? 0);
          setUnlockedSkins(data.user.unlockedSkins ?? ["default"]);
          setActiveSkin(data.user.activeSkin ?? "default");
        }
      } catch {
        if (!cancelled) {
          setSkinError(ui.profile.loadSkinsFailed);
        }
      }
    }

    loadUserSkins();

    return () => {
      cancelled = true;
    };
  }, [totalScoreProp, unlockedSkinsProp, activeSkinProp]);

  async function handleSkinClick(skinId: string) {
    const isUnlocked = safeUnlockedSkins.includes(skinId);
    if (isUnlocked && skinId === safeActiveSkin) return;

    setSkinError(null);

    try {
      if (isUnlocked) {
        const response = await fetch("/api/skins", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skinId }),
        });
        const data = (await response.json()) as {
          activeSkin?: string;
          message?: string;
        };
        if (!response.ok) {
          throw new Error(data.message ?? ui.profile.equipSkinFailed);
        }
        const nextActiveSkin = data.activeSkin ?? "default";
        setActiveSkin(nextActiveSkin);
        onUserUpdate?.({ activeSkin: nextActiveSkin });
      } else {
        const response = await fetch("/api/skins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skinId }),
        });
        const data = (await response.json()) as {
          totalScore?: number;
          unlockedSkins?: string[];
          message?: string;
        };
        if (!response.ok) {
          throw new Error(data.message ?? ui.profile.buySkinFailed);
        }
        const nextTotalScore = data.totalScore ?? 0;
        const nextUnlockedSkins = data.unlockedSkins ?? ["default"];
        setTotalScore(nextTotalScore);
        setUnlockedSkins(nextUnlockedSkins);
        onUserUpdate?.({
          totalScore: nextTotalScore,
          unlockedSkins: nextUnlockedSkins,
        });
      }
    } catch (err) {
      setSkinError(err instanceof Error ? err.message : ui.common.error);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLeaderboardLoading(true);
      setLeaderboardError(false);

      try {
        const response = await fetch("/api/leaderboard");
        if (!response.ok) throw new Error("Failed to load leaderboard");

        const data = (await response.json()) as {
          leaderboard: LeaderboardEntry[];
        };
        if (!cancelled) {
          setLeaderboard(data.leaderboard);
        }
      } catch {
        if (!cancelled) {
          setLeaderboardError(true);
        }
      } finally {
        if (!cancelled) {
          setLeaderboardLoading(false);
        }
      }
    }

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [username, bestScore]);

  return (
    <div
      className="flex flex-col items-center gap-6 w-full max-w-md mx-auto"
      data-testid="home-screen"
    >
      <header className="flex flex-col items-center gap-1 text-center">
        <span className="text-lg font-medium text-[#535353]">{username}</span>
        <span className="text-sm text-[#737373]">{ui.home.bestScore}: {bestScore}</span>
      </header>

      <button
        type="button"
        onClick={onStart}
        data-testid="start-game-btn"
        className="w-full px-4 py-3 bg-[#535353] text-white rounded-sm font-medium hover:bg-[#404040] transition-colors"
      >
        {ui.home.startGame}
      </button>

      <div className="w-full space-y-3 text-center">
        <div className="w-full">
          <p className="text-sm font-medium text-[#535353] mb-2">{ui.home.leaderboard}</p>
          {leaderboardLoading && <p className="text-sm text-[#737373]">{ui.common.loading}</p>}
          {leaderboardError && (
            <p className="text-sm text-[#737373]">{ui.home.loadLeaderboardFailed}</p>
          )}
          {!leaderboardLoading && !leaderboardError && (
            <ul className="w-full space-y-1 text-left">
              {leaderboard.map((entry, index) => {
                const isCurrentUser = entry.username === username;

                return (
                  <li
                    key={entry.username}
                    className={`flex items-center justify-between text-sm px-2 py-1 rounded-sm ${
                      isCurrentUser
                        ? "bg-[#e8e8e8] text-[#535353] font-medium"
                        : "text-[#737373]"
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-5 shrink-0 text-right">{index + 1}</span>
                      <span className="truncate">{entry.username}</span>
                    </span>
                    <span className="shrink-0 ml-2">{entry.bestScore}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {gameMeta.features.skins && (
          <div className="w-full">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-[#535353]">{ui.home.skins}</p>
              <span className="text-sm text-[#737373]">{ui.home.points}: {safeTotalScore}</span>
            </div>
            {skinError && (
              <p className="text-sm text-red-600 mb-2" role="alert">
                {skinError}
              </p>
            )}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {SKINS.map((skin) => {
                const isUnlocked = safeUnlockedSkins.includes(skin.id);
                const isActive = skin.id === safeActiveSkin;

                return (
                  <button
                    key={skin.id}
                    type="button"
                    disabled={isUnlocked && isActive}
                    onClick={() => void handleSkinClick(skin.id)}
                    className={`shrink-0 flex flex-col items-center gap-1 p-2 min-w-[64px] ${
                      !isUnlocked ? "opacity-50" : ""
                    } ${isActive ? "border-2 border-[#535353] rounded-sm" : ""}`}
                  >
                    <span
                      className="w-8 h-8 rounded-sm"
                      style={{ background: skin.color }}
                      aria-hidden
                    />
                    <span className="text-xs text-[#535353]">{skin.name}</span>
                    {!isUnlocked && (
                      <span className="text-xs text-[#737373]">{skin.price}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="px-4 py-2 text-sm border border-[#d0d0d0] rounded-sm text-[#535353] hover:bg-[#f0f0f0] transition-colors"
      >
        {ui.auth.logOut}
      </button>
    </div>
  );
}
