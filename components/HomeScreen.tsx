"use client";

import { useState } from "react";
import DinoSvg from "@/components/ui/DinoSvg";
import EmptyState from "@/components/ui/EmptyState";
import LeaderboardRows from "@/components/ui/LeaderboardRows";
import PanelSkeleton from "@/components/ui/PanelSkeleton";
import StagePreview from "@/components/ui/StagePreview";
import { SKINS, gameMeta } from "@/game";
import {
  getApiErrorMessage,
  useLeaderboardQuery,
  useSkinMutations,
} from "@/lib/client/hooks";
import { ui } from "@/lib/i18n/ui";

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
  onViewLeaderboard: () => void;
};

function GameTitle() {
  const accent = gameMeta.displayNameAccent;
  const base = gameMeta.displayName.replace(accent, "").trim();

  return (
    <h1 className="game-title">
      {base}
      <span className="game-title-accent">{accent}</span>
    </h1>
  );
}

export default function HomeScreen({
  username,
  bestScore,
  totalScore: totalScoreProp,
  unlockedSkins: unlockedSkinsProp,
  activeSkin: activeSkinProp,
  onUserUpdate,
  onStart,
  onLogout,
  onViewLeaderboard,
}: HomeScreenProps) {
  const [skinError, setSkinError] = useState<string | null>(null);

  const safeTotalScore = totalScoreProp ?? 0;
  const safeUnlockedSkins = unlockedSkinsProp ?? ["default"];
  const safeActiveSkin = activeSkinProp ?? "default";
  const activeSkinColor =
    SKINS.find((s) => s.id === safeActiveSkin)?.color ?? "var(--coral)";

  const {
    data: leaderboard = [],
    isLoading: leaderboardLoading,
    isError: leaderboardError,
  } = useLeaderboardQuery();

  const { equipMutation, unlockMutation } = useSkinMutations(onUserUpdate);

  const skinBusy = equipMutation.isPending || unlockMutation.isPending;

  async function handleSkinClick(skinId: string) {
    const isUnlocked = safeUnlockedSkins.includes(skinId);
    if (isUnlocked && skinId === safeActiveSkin) return;

    setSkinError(null);

    try {
      if (isUnlocked) {
        await equipMutation.mutateAsync(skinId);
      } else {
        await unlockMutation.mutateAsync(skinId);
        await equipMutation.mutateAsync(skinId);
      }
    } catch (err) {
      setSkinError(getApiErrorMessage(err, ui.common.error));
    }
  }

  return (
    <div className="screen-content" data-testid="home-screen">
      <div className="topbar">
        <span className="topbar-name">{username}</span>
        <span className="topbar-mid">
          {ui.home.bestScore} <b>{bestScore}</b>
        </span>
        <button type="button" className="topbar-exit" onClick={onLogout}>
          {ui.common.exit}
        </button>
      </div>

      <GameTitle />
      <p className="game-sub">{ui.home.subtitle}</p>

      <StagePreview dinoColor={activeSkinColor} />

      <button
        type="button"
        onClick={onStart}
        data-testid="start-game-btn"
        className="start-btn"
      >
        {ui.home.startGame}
      </button>

      <div className="section-label">
        <span>{ui.home.leaderboard}</span>
        <span className="section-count">
          {ui.home.points}: <b>{bestScore}</b>
        </span>
      </div>

      <div className="panel">
        {leaderboardLoading && <PanelSkeleton rows={4} />}
        {leaderboardError && (
          <p className="status-muted">{ui.home.loadLeaderboardFailed}</p>
        )}
        {!leaderboardLoading && !leaderboardError && leaderboard.length === 0 && (
          <EmptyState message={ui.leaderboard.empty} dinoColor={activeSkinColor} />
        )}
        {!leaderboardLoading && !leaderboardError && leaderboard.length > 0 && (
          <>
            <LeaderboardRows
              entries={leaderboard}
              currentUsername={username}
              activeSkinId={safeActiveSkin}
              limit={4}
            />
            <button type="button" className="view-all" onClick={onViewLeaderboard}>
              {ui.home.viewAllLeaderboard}
            </button>
          </>
        )}
      </div>

      {gameMeta.features.skins && (
        <>
          <div className="section-label">
            <span>{ui.home.skins}</span>
            <span className="section-count">
              {ui.home.points}: <b>{safeTotalScore}</b>
            </span>
          </div>
          {skinError && (
            <p className="alert-error" role="alert">
              {skinError}
            </p>
          )}
          <div className="skins-row">
            {SKINS.map((skin) => {
              const isUnlocked = safeUnlockedSkins.includes(skin.id);
              const isActive = skin.id === safeActiveSkin;

              return (
                <button
                  key={skin.id}
                  type="button"
                  disabled={(isUnlocked && isActive) || skinBusy}
                  onClick={() => void handleSkinClick(skin.id)}
                  className={`skin-card${isActive ? " skin-card-active" : ""}${
                    !isUnlocked ? " skin-card-locked" : ""
                  }`}
                >
                  {isActive && <span className="skin-check">✓</span>}
                  <DinoSvg color={skin.color} size={32} />
                  <span className="skin-name">{skin.name}</span>
                  {!isUnlocked && <span className="skin-price">{skin.price}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
