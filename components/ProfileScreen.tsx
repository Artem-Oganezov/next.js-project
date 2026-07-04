"use client";

import { useEffect, useState } from "react";
import { SKINS, gameMeta } from "@/game";

type LeaderboardEntry = {
  username: string;
  bestScore: number;
};

type ProfileScreenProps = {
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
  onBack: () => void;
};

export default function ProfileScreen({
  username,
  bestScore,
  totalScore: totalScoreProp,
  unlockedSkins: unlockedSkinsProp,
  activeSkin: activeSkinProp,
  onUserUpdate,
  onBack,
}: ProfileScreenProps) {
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

  const rankIndex = leaderboard.findIndex((entry) => entry.username === username);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;

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
          setSkinError("Не удалось загрузить скины");
        }
      }
    }

    loadUserSkins();

    return () => {
      cancelled = true;
    };
  }, [totalScoreProp, unlockedSkinsProp, activeSkinProp]);

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
  }, []);

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
          throw new Error(data.message ?? "Не удалось выбрать скин");
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
          throw new Error(data.message ?? "Не удалось купить скин");
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
      setSkinError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      <header className="w-full flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 text-sm border border-[#d0d0d0] rounded-sm text-[#535353] hover:bg-[#f0f0f0] transition-colors"
        >
          Назад
        </button>
        <h1 className="text-lg font-medium text-[#535353]">Профиль</h1>
        <span className="w-[60px]" aria-hidden />
      </header>

      <div className="w-full space-y-4 text-center">
        <div className="space-y-1">
          <p className="text-lg font-medium text-[#535353]">{username}</p>
          <p className="text-sm text-[#737373]">Рекорд: {bestScore}</p>
          <p className="text-sm text-[#737373]">Очки: {safeTotalScore}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-[#535353] mb-1">Место в рейтинге</p>
          {leaderboardLoading && <p className="text-sm text-[#737373]">Загрузка...</p>}
          {leaderboardError && (
            <p className="text-sm text-[#737373]">Не удалось загрузить</p>
          )}
          {!leaderboardLoading && !leaderboardError && (
            <p className="text-sm text-[#737373]">
              {rank !== null ? `#${rank}` : "Вне топ-10"}
            </p>
          )}
        </div>
      </div>

      {gameMeta.features.skins && (
        <div className="w-full">
          <p className="text-sm font-medium text-[#535353] mb-2 text-center">Скины</p>
          {skinError && (
            <p className="text-sm text-red-600 mb-2 text-center" role="alert">
              {skinError}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {SKINS.map((skin) => {
              const isUnlocked = safeUnlockedSkins.includes(skin.id);
              const isActive = skin.id === safeActiveSkin;

              return (
                <button
                  key={skin.id}
                  type="button"
                  disabled={isUnlocked && isActive}
                  onClick={() => void handleSkinClick(skin.id)}
                  className={`shrink-0 flex flex-col items-center gap-1 p-2 min-w-[72px] ${
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
  );
}
