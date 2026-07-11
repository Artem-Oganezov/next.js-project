import { useEffect, type MutableRefObject, type RefObject } from "react";
import { api } from "@/lib/client/api";
import { ApiError } from "@/lib/client/api-error";
import { createReviveAdProvider } from "@/lib/client/ads";
import { ui } from "@/lib/i18n/ui";
import {
  drawGround,
  drawSkyBackground,
  drawSkyDecor,
  drawStyledCactus,
  drawStyledDino,
} from "@/game/canvas-draw";
import { GAME_CONFIG } from "@/game/constants";
import { createDinoEngine, TICKS_PER_SECOND, type DinoEngine } from "@/game/engine";

const { CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_Y, DINO_X, DINO_WIDTH, DINO_HEIGHT } =
  GAME_CONFIG;

const TICK_MS = 1000 / TICKS_PER_SECOND;
const MAX_FRAME_DELTA_MS = 100;
const SESSION_START_MAX_ATTEMPTS = 3;
const SESSION_START_RETRY_MS = 800;

export type DinoGameLoopRefs = {
  resetGameRef: MutableRefObject<(() => void) | null>;
  watchAdRef: MutableRefObject<(() => void) | null>;
  saveScoreRef: MutableRefObject<(() => void) | null>;
  retrySessionRef: MutableRefObject<(() => void) | null>;
  adSlotRef: RefObject<HTMLDivElement | null>;
};

export type UseDinoGameLoopOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  activeSkinColorRef: RefObject<string>;
  onScoreChange: (score: number) => void;
  onReviveOffer: () => void;
  onSetGameOver: (gameOver: boolean) => void;
  onCrash: () => void;
  onSessionLoading: (loading: boolean) => void;
  onSessionFailed: (failed: boolean) => void;
  onSaveError: (error: string | null) => void;
  onScoreSaving: (saving: boolean) => void;
  onScoreSaved: (result: { bestScore: number; totalScore: number }) => void;
  onHighScoreChange: (best: number) => void;
  onRankInfo: (rank: number, nextUsername: string | null) => void;
  onClearRank: () => void;
  onAdLoading: (loading: boolean) => void;
  onClearReviveOffer: () => void;
};

export function useDinoGameLoop(
  options: UseDinoGameLoopOptions,
  refs: DinoGameLoopRefs,
): void {
  const {
    canvasRef,
    activeSkinColorRef,
    onScoreChange,
    onReviveOffer,
    onSetGameOver,
    onCrash,
    onSessionLoading,
    onSessionFailed,
    onSaveError,
    onScoreSaving,
    onScoreSaved,
    onHighScoreChange,
    onRankInfo,
    onClearRank,
    onAdLoading,
    onClearReviveOffer,
  } = options;

  const {
    resetGameRef,
    watchAdRef,
    saveScoreRef,
    retrySessionRef,
    adSlotRef,
  } = refs;

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
    let tabHidden = false;

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

    const onVisibility = () => {
      tabHidden = document.hidden;
    };

    const startGameSession = (attempt = 1) => {
      gameSessionId = null;
      engine = null;
      onSessionLoading(true);
      onSessionFailed(false);
      onSaveError(null);

      const requestGeneration = generation;

      const scheduleRetry = () => {
        if (requestGeneration !== generation) return;
        if (attempt < SESSION_START_MAX_ATTEMPTS) {
          window.setTimeout(() => startGameSession(attempt + 1), SESSION_START_RETRY_MS);
          return;
        }
        onSessionLoading(false);
        onSessionFailed(true);
        onSaveError(ui.game.sessionStartFailed);
      };

      void api
        .startGameSession()
        .then((data) => {
          if (requestGeneration !== generation) return;
          gameSessionId = data.sessionId;
          engine = createDinoEngine(data.seed);
          onSessionLoading(false);
          onSessionFailed(false);
        })
        .catch(() => {
          scheduleRetry();
        });
    };

    retrySessionRef.current = () => startGameSession();

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
      onScoreChange(0);
      onClearReviveOffer();
      onAdLoading(false);
      onSetGameOver(false);
      onClearRank();
      onSaveError(null);
      onSessionLoading(true);
      onSessionFailed(false);
      startGameSession();
    };

    resetGameRef.current = resetGame;

    const submitScore = (displayScore: number, inputLog: unknown) => {
      if (!gameSessionId) {
        onSaveError(ui.game.sessionMissing);
        return;
      }
      void api
        .submitScore(displayScore, gameSessionId, inputLog, onScoreSaving)
        .then((data) => {
          onHighScoreChange(data.bestScore);
          onScoreSaved({ bestScore: data.bestScore, totalScore: data.totalScore });
          onRankInfo(data.rank, data.nextUsername);
        })
        .catch((err) => {
          onSaveError(err instanceof ApiError ? err.message : ui.game.saveFailed);
        });
    };

    const beginFinalScoreSubmit = () => {
      if (!engine || scoreSubmitStarted) return;
      scoreSubmitStarted = true;
      pausedForReviveOffer = false;
      onClearReviveOffer();
      onSetGameOver(true);
      submitScore(engine.getScore(), buildInputLog());
    };

    saveScoreRef.current = () => beginFinalScoreSubmit();

    const watchAdAndRevive = () => {
      if (!engine || !gameSessionId || hasRevived || adPending) return;
      adPending = true;
      onAdLoading(true);
      onSaveError(null);

      const provider = createReviveAdProvider(() => adSlotRef.current);
      const sessionId = gameSessionId;

      void api
        .gameReviveChallenge(sessionId)
        .then((challenge) => {
          const challengeStartedAt = Date.now();
          return provider.show().then(async (outcome) => {
            if (outcome !== "completed") {
              onSaveError(
                outcome === "dismissed" ? ui.game.adDismissed : ui.game.reviveFailed,
              );
              onAdLoading(false);
              adPending = false;
              return;
            }

            const elapsed = Date.now() - challengeStartedAt;
            const remaining = challenge.minWaitMs - elapsed;
            if (remaining > 0) {
              await new Promise((resolve) => setTimeout(resolve, remaining));
            }

            await api.gameRevive(sessionId, challenge.challengeId);
            hasRevived = true;
            pausedForReviveOffer = false;
            engine!.revive();
            onClearReviveOffer();
            onAdLoading(false);
            adPending = false;
          });
        })
        .catch((err) => {
          onSaveError(err instanceof ApiError ? err.message : ui.game.reviveFailed);
          onAdLoading(false);
          adPending = false;
        });
    };

    watchAdRef.current = watchAdAndRevive;

    const update = (frameTime: number) => {
      if (!engine || tabHidden) return;

      if (engine.isGameOver()) {
        if (!pausedForReviveOffer && !hasRevived) {
          pausedForReviveOffer = true;
          reviveAtTick = engine.getTick();
          onCrash();
          onReviveOffer();
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
        onScoreChange(nextScore);
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
      if (event.repeat) return;
      event.preventDefault();
      handleJumpInput();
    };

    const handleTouchStart = (event: TouchEvent) => {
      event.preventDefault();
      handleJumpInput();
    };

    document.addEventListener("visibilitychange", onVisibility);
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
      retrySessionRef.current = null;
      generation += 1;
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("touchstart", handleTouchStart);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- single mount lifecycle for canvas engine
  }, []);
}
