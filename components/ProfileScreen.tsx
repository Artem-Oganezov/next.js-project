"use client";

import { useEffect, useState } from "react";
import { SKINS, gameMeta } from "@/game";
import { ApiError, api } from "@/lib/client/api";
import { ui } from "@/lib/i18n/ui";

type LeaderboardEntry = {
  username: string;
  bestScore: number;
};

type ProfileScreenProps = {
  username: string;
  emailVerified: boolean;
  bestScore: number;
  totalScore?: number;
  unlockedSkins?: string[];
  activeSkin?: string;
  onUserUpdate?: (patch: {
    activeSkin?: string;
    totalScore?: number;
    unlockedSkins?: string[];
    emailVerified?: boolean;
  }) => void;
  onLogout: () => void;
  onBack: () => void;
};

export default function ProfileScreen({
  username,
  emailVerified,
  bestScore,
  totalScore: totalScoreProp,
  unlockedSkins: unlockedSkinsProp,
  activeSkin: activeSkinProp,
  onUserUpdate,
  onLogout,
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

  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);

  const safeTotalScore = totalScore ?? 0;
  const safeUnlockedSkins = unlockedSkins ?? ["default"];
  const safeActiveSkin = activeSkin ?? "default";

  const rankIndex = leaderboard.findIndex((entry) => entry.username === username);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;

  useEffect(() => {
    if (totalScoreProp !== undefined) setTotalScore(totalScoreProp);
    if (unlockedSkinsProp !== undefined) setUnlockedSkins(unlockedSkinsProp);
    if (activeSkinProp !== undefined) setActiveSkin(activeSkinProp);
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
        const data = await api.me();
        if (!cancelled) {
          setTotalScore(data.user.totalScore ?? 0);
          setUnlockedSkins(data.user.unlockedSkins ?? ["default"]);
          setActiveSkin(data.user.activeSkin ?? "default");
        }
      } catch {
        if (!cancelled) setSkinError(ui.profile.loadSkinsFailed);
      }
    }

    void loadUserSkins();
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
        if (!response.ok) throw new Error("Failed");
        const data = (await response.json()) as { leaderboard: LeaderboardEntry[] };
        if (!cancelled) setLeaderboard(data.leaderboard);
      } catch {
        if (!cancelled) setLeaderboardError(true);
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    }

    void loadLeaderboard();
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
        const data = await api.equipSkin(skinId);
        const nextActiveSkin = data.activeSkin ?? "default";
        setActiveSkin(nextActiveSkin);
        onUserUpdate?.({ activeSkin: nextActiveSkin });
      } else {
        const data = await api.unlockSkin(skinId);
        setTotalScore(data.totalScore);
        setUnlockedSkins(data.unlockedSkins);
        onUserUpdate?.({
          totalScore: data.totalScore,
          unlockedSkins: data.unlockedSkins,
        });
      }
    } catch (err) {
      setSkinError(err instanceof Error ? err.message : ui.common.error);
    }
  }

  async function handleResendVerification() {
    setAccountBusy(true);
    setAccountError(null);
    setAccountMessage(null);
    try {
      await api.resendVerification();
      setAccountMessage(ui.auth.verificationSent);
    } catch (err) {
      setAccountError(err instanceof ApiError ? err.message : ui.common.error);
    } finally {
      setAccountBusy(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setAccountBusy(true);
    setAccountError(null);
    setAccountMessage(null);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setAccountMessage(ui.auth.passwordChanged);
      setCurrentPassword("");
      setNewPassword("");
      onLogout();
    } catch (err) {
      setAccountError(err instanceof ApiError ? err.message : ui.common.error);
    } finally {
      setAccountBusy(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setAccountBusy(true);
    setAccountError(null);
    setAccountMessage(null);
    try {
      await api.deleteAccount({ password: deletePassword });
      setAccountMessage(ui.auth.accountDeleted);
      onLogout();
    } catch (err) {
      setAccountError(err instanceof ApiError ? err.message : ui.common.error);
    } finally {
      setAccountBusy(false);
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
          {ui.common.back}
        </button>
        <h1 className="text-lg font-medium text-[#535353]">{ui.profile.title}</h1>
        <span className="w-[60px]" aria-hidden />
      </header>

      <div className="w-full space-y-4 text-center">
        <div className="space-y-1">
          <p className="text-lg font-medium text-[#535353]">{username}</p>
          <p className="text-sm text-[#737373]">
            {ui.profile.bestScore}: {bestScore}
          </p>
          <p className="text-sm text-[#737373]">
            {ui.profile.points}: {safeTotalScore}
          </p>
        </div>

        {!emailVerified && (
          <div className="text-left p-3 border border-[#e0e0e0] rounded-sm bg-[#fafafa]">
            <p className="text-sm text-[#737373] mb-2">{ui.auth.emailUnverified}</p>
            <button
              type="button"
              disabled={accountBusy}
              onClick={() => void handleResendVerification()}
              className="text-sm text-[#535353] underline hover:no-underline disabled:opacity-60"
            >
              {ui.auth.resendVerification}
            </button>
          </div>
        )}

        <div>
          <p className="text-sm font-medium text-[#535353] mb-1">{ui.profile.rank}</p>
          {leaderboardLoading && (
            <p className="text-sm text-[#737373]">{ui.common.loading}</p>
          )}
          {leaderboardError && (
            <p className="text-sm text-[#737373]">{ui.profile.loadRankFailed}</p>
          )}
          {!leaderboardLoading && !leaderboardError && (
            <p className="text-sm text-[#737373]">
              {rank !== null ? `#${rank}` : ui.profile.rankOutsideTop}
            </p>
          )}
        </div>
      </div>

      {gameMeta.features.skins && (
        <div className="w-full">
          <p className="text-sm font-medium text-[#535353] mb-2 text-center">
            {ui.profile.skins}
          </p>
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

      <div className="w-full space-y-4 border-t border-[#e0e0e0] pt-4">
        {accountMessage && (
          <p className="text-sm text-green-700 text-center" role="status">
            {accountMessage}
          </p>
        )}
        {accountError && (
          <p className="text-sm text-red-600 text-center" role="alert">
            {accountError}
          </p>
        )}

        <form onSubmit={handleChangePassword} className="space-y-2">
          <p className="text-sm font-medium text-[#535353]">{ui.auth.changePassword}</p>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={ui.auth.currentPassword}
            disabled={accountBusy}
            className="w-full px-3 py-2 text-sm border border-[#d0d0d0] rounded-sm"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={ui.auth.newPassword}
            disabled={accountBusy}
            className="w-full px-3 py-2 text-sm border border-[#d0d0d0] rounded-sm"
          />
          <button
            type="submit"
            disabled={accountBusy || !currentPassword || !newPassword}
            className="w-full px-3 py-2 text-sm bg-[#535353] text-white rounded-sm disabled:opacity-60"
          >
            {ui.auth.changePassword}
          </button>
        </form>

        <form onSubmit={handleDeleteAccount} className="space-y-2">
          <p className="text-sm font-medium text-red-700">{ui.auth.deleteAccount}</p>
          <p className="text-xs text-[#737373]">{ui.auth.deleteConfirm}</p>
          <input
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder={ui.auth.password}
            disabled={accountBusy}
            className="w-full px-3 py-2 text-sm border border-[#d0d0d0] rounded-sm"
          />
          <button
            type="submit"
            disabled={accountBusy || !deletePassword}
            className="w-full px-3 py-2 text-sm border border-red-600 text-red-700 rounded-sm disabled:opacity-60"
          >
            {ui.auth.deleteAccount}
          </button>
        </form>
      </div>
    </div>
  );
}
