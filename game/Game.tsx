"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { createReviveAdProvider, isReviveAdEnabled } from "@/lib/client/ads";
import { ui } from "@/lib/i18n/ui";
import type { GameComponentProps } from "@/game/contract";
import {
  drawGround,
  drawSkyBackground,
  drawSkyDecor,
  drawStyledCactus,
  drawStyledDino,
} from "@/game/canvas-draw";
import { GAME_CONFIG } from "@/game/constants";
import { createDinoEngine, TICKS_PER_SECOND, type DinoEngine } from "@/game/engine";
import { gameMeta } from "@/game/meta";

const { CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_Y, DINO_X, DINO_WIDTH, DINO_HEIGHT } =
  GAME_CONFIG;

const TICK_MS = 1000 / TICKS_PER_SECOND;
const MAX_FRAME_DELTA_MS = 100;
const REVIVE_AD_ENABLED = isReviveAdEnabled();
/** Countdown on the revive banner (visual urgency). */
const REVIVE_OFFER_COUNTDOWN_SEC = 15;

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
  const adSlotRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(initialBestScore);
  const [reviveOffer, setReviveOffer] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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
  const onScoreSavedRef = useRef(onScoreSaved);
  const activeSkinColorRef = useRef(activeSkinColor);

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
    const media = window.matchMedia("(pointer: coarse)");
    const syncHint = () => {
      setJumpHint(media.matches ? ui.game.tapJump : ui.game.spaceJump);
    };
    syncHint();
    media.addEventListener("change", syncHint);
    return () => media.removeEventListener("change", syncHint);
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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let engine: DinoEngine | null = null;
    let jumpTicks: number[] = [];
    let pendingJump = false;
    let gameSessionId: string | null = null;
    let animationFrameId = 0;
    let lastFrameTime = 0;
    let tickAccumulatorMs = 0;
    let generation = 0;
    let lastDisplayedScore = -1;
    let pausedForReviveOffer = false;
    let hasRevived = false;
    let reviveAtTick: number | null = null;
    let adPending = false;
    let scoreSubmitStarted = false;

    /** Visual-only offset between fixed simulation ticks (does not affect engine/replay). */
    const renderAlpha = (): number => {
      if (!engine || engine.isGameOver()) return 0;
      return Math.min(tickAccumulatorMs / TICK_MS, 1);
    };

    const buildInputLog = (): unknown => {
      if (hasRevived && reviveAtTick !== null) {
        return { jumpTicks, reviveAtTick };
      }
      return jumpTicks;
    };

    const startGameSession = () => {
      gameSessionId = null;
      const requestGeneration = generation;
      void api
        .startGameSession()
        .then((data) => {
          if (requestGeneration !== generation) return;
          gameSessionId = data.sessionId;
          engine = createDinoEngine(data.seed);
        })
        .catch(() => {
          if (requestGeneration !== generation) return;
          engine = createDinoEngine(Math.random().toString(36).slice(2));
          setSaveError(ui.game.sessionStartFailed);
        });
    };

    const resetGame = () => {
      generation += 1;
      engine = null;
      jumpTicks = [];
      pendingJump = false;
      tickAccumulatorMs = 0;
      lastDisplayedScore = -1;
      pausedForReviveOffer = false;
      hasRevived = false;
      reviveAtTick = null;
      scoreSubmitStarted = false;
      setScore(0);
      setReviveOffer(false);
      setAdLoading(false);
      setGameOver(false);
      setRankInfo(null);
      setSaveError(null);
      startGameSession();
    };

    resetGameRef.current = resetGame;

    const submitScore = (displayScore: number, inputLog: unknown) => {
      if (!gameSessionId) {
        setSaveError(ui.game.sessionMissing);
        return;
      }
      void api
        .submitScore(displayScore, gameSessionId, inputLog)
        .then((data) => {
          setHighScore(data.bestScore);
          onScoreSavedRef.current?.({
            bestScore: data.bestScore,
            totalScore: data.totalScore,
          });
          setRankInfo({ rank: data.rank, nextUsername: data.nextUsername });
        })
        .catch(() => {
          setSaveError(ui.game.saveFailed);
        });
    };

    const beginFinalScoreSubmit = () => {
      if (!engine || scoreSubmitStarted) return;
      scoreSubmitStarted = true;
      pausedForReviveOffer = false;
      setReviveOffer(false);
      setGameOver(true);
      submitScore(engine.getScore(), buildInputLog());
    };

    const saveScoreFromReviveOffer = () => {
      beginFinalScoreSubmit();
    };

    saveScoreRef.current = saveScoreFromReviveOffer;

    const watchAdAndRevive = () => {
      if (!engine || !gameSessionId || hasRevived || adPending) return;
      adPending = true;
      setAdLoading(true);
      setSaveError(null);

      const provider = createReviveAdProvider(() => adSlotRef.current);

      void provider.show().then((outcome) => {
        if (outcome !== "completed") {
          setSaveError(
            outcome === "dismissed" ? ui.game.adDismissed : ui.game.reviveFailed,
          );
          setAdLoading(false);
          adPending = false;
          return;
        }

        return api
          .gameRevive(gameSessionId!)
          .then(() => {
            hasRevived = true;
            pausedForReviveOffer = false;
            engine!.revive();
            setReviveOffer(false);
            setAdLoading(false);
            adPending = false;
          })
          .catch(() => {
            setSaveError(ui.game.reviveFailed);
            setAdLoading(false);
            adPending = false;
          });
      });
    };

    watchAdRef.current = watchAdAndRevive;

    const update = (frameTime: number) => {
      if (!engine) return;

      if (engine.isGameOver()) {
        if (!pausedForReviveOffer && !hasRevived) {
          pausedForReviveOffer = true;
          reviveAtTick = engine.getTick();
          setReviveOffer(true);
          return;
        }
        if (pausedForReviveOffer) {
          return;
        }
        beginFinalScoreSubmit();
        return;
      }

      const delta = Math.min(frameTime - lastFrameTime, MAX_FRAME_DELTA_MS);
      tickAccumulatorMs += delta;

      while (tickAccumulatorMs >= TICK_MS && !engine.isGameOver()) {
        tickAccumulatorMs -= TICK_MS;
        const jumpRequested = pendingJump;
        pendingJump = false;
        if (jumpRequested) {
          jumpTicks.push(engine.getTick());
        }
        engine.tick(jumpRequested);
      }

      const nextScore = engine.getScore();
      if (nextScore !== lastDisplayedScore) {
        lastDisplayedScore = nextScore;
        setScore(nextScore);
      }
    };

    const draw = () => {
      drawSkyBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawSkyDecor(ctx, CANVAS_WIDTH);

      drawGround(ctx, GROUND_Y, CANVAS_WIDTH);

      const alpha = renderAlpha();
      const scrollPx = engine && !engine.isGameOver() ? engine.getSpeed() * alpha : 0;

      let dinoY = engine ? engine.getDino().y : GROUND_Y - DINO_HEIGHT;
      if (engine && alpha > 0 && !engine.isGameOver()) {
        dinoY += engine.getDino().velocityY * alpha;
      }

      drawStyledDino(
        ctx,
        DINO_X,
        dinoY,
        DINO_WIDTH,
        DINO_HEIGHT,
        activeSkinColorRef.current,
      );

      if (engine) {
        for (const cactus of engine.getCacti()) {
          const cactusY = GROUND_Y - cactus.height;
          const renderX = cactus.x - scrollPx;
          drawStyledCactus(ctx, renderX, cactusY, cactus.width, cactus.height);
        }
      }
    };

    const gameLoop = (frameTime: number) => {
      update(frameTime);
      lastFrameTime = frameTime;
      draw();
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    const handleJumpInput = () => {
      if (engine?.isGameOver()) {
        if (pausedForReviveOffer) return;
        resetGame();
        return;
      }
      pendingJump = true;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.code !== "ArrowUp") return;
      event.preventDefault();
      handleJumpInput();
    };

    const handleTouchStart = (event: TouchEvent) => {
      event.preventDefault();
      handleJumpInput();
    };

    window.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    resetGame();
    animationFrameId = requestAnimationFrame((frameTime) => {
      lastFrameTime = frameTime;
      gameLoop(frameTime);
    });

    return () => {
      resetGameRef.current = null;
      watchAdRef.current = null;
      saveScoreRef.current = null;
      generation += 1;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("touchstart", handleTouchStart);
    };
  }, []);

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
          <button type="button" className="topbar-exit" onClick={onBack}>
            {ui.common.exit}
          </button>
        )}
      </div>

      {username && <p className="game-sub game-user-line">{username}</p>}

      <div className="game-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          data-testid="game-canvas"
          tabIndex={0}
          aria-label={ui.game.ariaLabel(gameMeta.displayName)}
        />
      </div>

      {!reviveOffer && !gameOver && (
        <p className="game-sub game-hint">{jumpHint}</p>
      )}

      {reviveOffer && (
        <div className="dead-overlay revive-modal" data-testid="revive-offer-modal">
          <div className="dead-title">{ui.game.crashTitle}</div>
          <div className="dead-score">
            {ui.game.score}: {score}
          </div>

          {reviveRank && (
            <div className="dead-rank">
              {ui.game.rankLine(reviveRank.rank, reviveRank.nextUsername)}
            </div>
          )}

          {REVIVE_AD_ENABLED && (
            <div className="revive-ad-banner">
              <p className="revive-ad-banner-text">{ui.game.reviveAdBanner}</p>
              <div className="revive-countdown" aria-live="polite">
                {reviveCountdown}
              </div>
            </div>
          )}

          {!REVIVE_AD_ENABLED && (
            <p className="game-sub revive-hint">{ui.game.reviveHintNoAd}</p>
          )}

          <div
            ref={adSlotRef}
            className="revive-ad-slot"
            data-testid="revive-ad-slot"
            aria-hidden={!adLoading}
          />

          {saveError && (
            <p className="alert-error" role="alert">
              {saveError}
            </p>
          )}

          {REVIVE_AD_ENABLED ? (
            <>
              <button
                type="button"
                data-testid="revive-watch-ad-btn"
                onClick={() => watchAdRef.current?.()}
                className="pbtn pbtn-primary revive-continue-btn"
                disabled={adLoading}
              >
                {adLoading ? ui.game.adLoading : `▶ ${ui.game.watchAdContinue}`}
              </button>

              <div className="revive-secondary-row">
                <button
                  type="button"
                  onClick={() => resetGameRef.current?.()}
                  className="pbtn pbtn-secondary revive-secondary-btn"
                  disabled={adLoading}
                >
                  ↻ {ui.game.restartRun}
                </button>
                {onOpenLeaderboard && (
                  <button
                    type="button"
                    onClick={onOpenLeaderboard}
                    className="pbtn pbtn-secondary revive-secondary-btn"
                    disabled={adLoading}
                  >
                    🏆 {ui.game.toLeaderboard}
                  </button>
                )}
              </div>

              <button
                type="button"
                data-testid="revive-save-score-btn"
                onClick={() => saveScoreRef.current?.()}
                className="revive-save-link"
                disabled={adLoading}
              >
                {ui.game.saveScoreLink}
              </button>
            </>
          ) : (
            <div className="btn-row">
              <button
                type="button"
                data-testid="revive-save-score-btn"
                onClick={() => saveScoreRef.current?.()}
                className="pbtn pbtn-primary"
                disabled={adLoading}
              >
                {ui.game.saveScore}
              </button>
              <button
                type="button"
                onClick={() => resetGameRef.current?.()}
                className="pbtn pbtn-secondary"
                disabled={adLoading}
              >
                ↻ {ui.game.restartRun}
              </button>
              {onOpenLeaderboard && (
                <button
                  type="button"
                  onClick={onOpenLeaderboard}
                  className="pbtn pbtn-secondary"
                  disabled={adLoading}
                >
                  🏆 {ui.game.toLeaderboard}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {gameOver && (
        <div className="dead-overlay" data-testid="game-over-modal">
          <div className="dead-title">{ui.game.gameOver}</div>
          <div className="dead-score">
            {ui.game.score}: {score}
          </div>

          {rankInfo && (
            <div className="dead-rank">{ui.game.rankLine(rankInfo.rank, rankInfo.nextUsername)}</div>
          )}

          {saveError && (
            <p className="alert-error" role="alert">
              {saveError}
            </p>
          )}

          <div className="btn-row">
            <button
              type="button"
              onClick={() => resetGameRef.current?.()}
              className="pbtn pbtn-primary"
            >
              {ui.game.playAgain}
            </button>
            {onOpenLeaderboard && (
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="pbtn pbtn-secondary"
              >
                {ui.game.toLeaderboard}
              </button>
            )}
            {onBack && (
              <button type="button" onClick={onBack} className="pbtn pbtn-secondary">
                {ui.common.back}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
