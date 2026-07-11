"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { ui } from "@/lib/i18n/ui";
import type { GameComponentProps } from "@/game/contract";
import GameOverModal from "@/game/components/GameOverModal";
import ReviveOfferModal from "@/game/components/ReviveOfferModal";
import SessionStatusOverlay from "@/game/components/SessionStatusOverlay";
import { GAME_CONFIG } from "@/game/constants";
import { useDinoGameLoop } from "@/game/hooks/useDinoGameLoop";
import { gameMeta } from "@/game/meta";

const { CANVAS_WIDTH, CANVAS_HEIGHT } = GAME_CONFIG;
const REVIVE_OFFER_COUNTDOWN_SEC = 15;
const ONBOARDING_KEY = "dino-run-onboarding-dismissed";

export default function Game({
  username,
  initialBestScore = 0,
  activeSkinColor = "#ff6f5e",
  onScoreSaved,
  onBack,
  onOpenLeaderboard,
}: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resetGameRef = useRef<(() => void) | null>(null);
  const watchAdRef = useRef<(() => void) | null>(null);
  const saveScoreRef = useRef<(() => void) | null>(null);
  const retrySessionRef = useRef<(() => void) | null>(null);
  const adSlotRef = useRef<HTMLDivElement>(null);
  const onScoreSavedRef = useRef(onScoreSaved);
  const activeSkinColorRef = useRef(activeSkinColor);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(initialBestScore);
  const [reviveOffer, setReviveOffer] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [scoreSaving, setScoreSaving] = useState(false);
  const [rankInfo, setRankInfo] = useState<{
    rank: number;
    nextUsername: string | null;
  } | null>(null);
  const [jumpHint, setJumpHint] = useState<string>(ui.game.spaceJump);
  const [reviveRank, setReviveRank] = useState<{
    rank: number;
    nextUsername: string | null;
  } | null>(null);
  const [reviveCountdown, setReviveCountdown] = useState(REVIVE_OFFER_COUNTDOWN_SEC);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionFailed, setSessionFailed] = useState(false);
  const [crashShake, setCrashShake] = useState(false);
  const [tabPaused, setTabPaused] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setHighScore(initialBestScore);
  }, [initialBestScore]);

  useEffect(() => {
    onScoreSavedRef.current = onScoreSaved;
  }, [onScoreSaved]);

  useEffect(() => {
    activeSkinColorRef.current = activeSkinColor;
  }, [activeSkinColor]);

  useEffect(() => {
    try {
      setShowOnboarding(localStorage.getItem(ONBOARDING_KEY) !== "1");
    } catch {
      setShowOnboarding(false);
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const syncHint = () => {
      setJumpHint(media.matches ? ui.game.tapJump : ui.game.spaceJump);
    };
    syncHint();
    media.addEventListener("change", syncHint);
    return () => media.removeEventListener("change", syncHint);
  }, []);

  useEffect(() => {
    const onVisibility = () => setTabPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!reviveOffer && !gameOver) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [reviveOffer, gameOver]);

  useEffect(() => {
    if (!reviveOffer) {
      setReviveRank(null);
      setReviveCountdown(REVIVE_OFFER_COUNTDOWN_SEC);
      return;
    }

    setReviveCountdown(REVIVE_OFFER_COUNTDOWN_SEC);
    void api.getLeaderboardRank().then(setReviveRank).catch(() => setReviveRank(null));

    const timerId = window.setInterval(() => {
      setReviveCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [reviveOffer]);

  useEffect(() => {
    if (!reviveOffer || reviveCountdown > 0 || adLoading) return;
    saveScoreRef.current?.();
  }, [reviveOffer, reviveCountdown, adLoading]);

  useEffect(() => {
    if (!crashShake) return;
    const timerId = window.setTimeout(() => setCrashShake(false), 450);
    return () => window.clearTimeout(timerId);
  }, [crashShake]);

  const handleScoreSaved = useCallback((result: { bestScore: number; totalScore: number }) => {
    onScoreSavedRef.current?.(result);
  }, []);

  useDinoGameLoop(
    {
      canvasRef,
      activeSkinColorRef,
      onScoreChange: setScore,
      onReviveOffer: () => setReviveOffer(true),
      onSetGameOver: setGameOver,
      onCrash: () => setCrashShake(true),
      onSessionLoading: setSessionLoading,
      onSessionFailed: setSessionFailed,
      onSaveError: setSaveError,
      onScoreSaving: setScoreSaving,
      onScoreSaved: handleScoreSaved,
      onHighScoreChange: setHighScore,
      onRankInfo: (rank, nextUsername) => setRankInfo({ rank, nextUsername }),
      onClearRank: () => setRankInfo(null),
      onAdLoading: setAdLoading,
      onClearReviveOffer: () => setReviveOffer(false),
    },
    {
      resetGameRef,
      watchAdRef,
      saveScoreRef,
      retrySessionRef,
      adSlotRef,
    },
  );

  const dismissOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowOnboarding(false);
  };

  const confirmLeaveRun = (): boolean => {
    if (reviveOffer) {
      return window.confirm(ui.game.leaveConfirmRevive);
    }
    if (!gameOver && score > 0) {
      return window.confirm(ui.game.leaveConfirmPlaying);
    }
    return true;
  };

  const handleBack = () => {
    if (!confirmLeaveRun()) return;
    onBack?.();
  };

  const handleOpenLeaderboard = () => {
    if (!confirmLeaveRun()) return;
    onOpenLeaderboard?.();
  };

  const handleRestart = () => {
    if (reviveOffer && !window.confirm(ui.game.restartConfirmRevive)) return;
    resetGameRef.current?.();
  };

  const canvasWrapClass = [
    "game-canvas-wrap",
    crashShake ? "game-canvas-wrap--shake" : "",
    tabPaused ? "game-canvas-wrap--paused" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="game-screen">
      <div className="topbar">
        <span className="topbar-name">
          {ui.game.score}: {score}
        </span>
        <span className="topbar-mid">
          {ui.game.best} <b>{highScore}</b>
        </span>
        {onBack && (
          <button type="button" className="topbar-exit" onClick={handleBack}>
            {ui.common.exit}
          </button>
        )}
      </div>

      {username && <p className="game-sub game-user-line">{username}</p>}

      {showOnboarding && !sessionLoading && !reviveOffer && !gameOver && (
        <div className="game-onboarding" role="note">
          <p>{jumpHint}</p>
          <button type="button" className="game-onboarding-dismiss" onClick={dismissOnboarding}>
            {ui.game.onboardingDismiss}
          </button>
        </div>
      )}

      <div className={canvasWrapClass}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          data-testid="game-canvas"
          tabIndex={0}
          aria-label={ui.game.ariaLabel(gameMeta.displayName)}
        />
        {tabPaused && !reviveOffer && !gameOver && (
          <div className="game-paused-badge" aria-live="polite">
            {ui.game.paused}
          </div>
        )}
      </div>

      {!reviveOffer && !gameOver && !sessionLoading && !sessionFailed && !showOnboarding && (
        <p className="game-sub game-hint">{jumpHint}</p>
      )}

      {(sessionLoading || sessionFailed) && !reviveOffer && !gameOver && (
        <SessionStatusOverlay
          sessionLoading={sessionLoading}
          sessionFailed={sessionFailed}
          saveError={saveError}
          onRetry={() => retrySessionRef.current?.()}
          onBack={onBack ? handleBack : undefined}
        />
      )}

      {reviveOffer && (
        <ReviveOfferModal
          score={score}
          reviveRank={reviveRank}
          reviveCountdown={reviveCountdown}
          adLoading={adLoading}
          saveError={saveError}
          adSlotRef={adSlotRef}
          onWatchAd={() => watchAdRef.current?.()}
          onSaveScore={() => saveScoreRef.current?.()}
          onRestart={handleRestart}
          onOpenLeaderboard={onOpenLeaderboard ? handleOpenLeaderboard : undefined}
        />
      )}

      {gameOver && (
        <GameOverModal
          score={score}
          rankInfo={rankInfo}
          saveError={saveError}
          scoreSaving={scoreSaving}
          onPlayAgain={() => resetGameRef.current?.()}
          onOpenLeaderboard={onOpenLeaderboard ? handleOpenLeaderboard : undefined}
          onBack={onBack ? handleBack : undefined}
        />
      )}
    </div>
  );
}
