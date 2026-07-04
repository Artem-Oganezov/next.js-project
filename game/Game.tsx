"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { ui } from "@/lib/i18n/ui";
import type { GameComponentProps } from "@/game/contract";
import { GAME_CONFIG } from "@/game/constants";
import { createDinoEngine, TICKS_PER_SECOND, type DinoEngine } from "@/game/engine";
import { gameMeta } from "@/game/meta";

const { CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_Y, DINO_X, DINO_WIDTH, DINO_HEIGHT } =
  GAME_CONFIG;

const TICK_MS = 1000 / TICKS_PER_SECOND;
/** Кап на догоняющие тики за кадр: после свёрнутой вкладки игра ставится
 * на паузу, а не проматывается вперёд. */
const MAX_FRAME_DELTA_MS = 100;

export default function Game({
  initialBestScore = 0,
  activeSkinColor = "#535353",
  onScoreSaved,
  onBack,
}: GameComponentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resetGameRef = useRef<(() => void) | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(initialBestScore);
  const [gameOver, setGameOver] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rankInfo, setRankInfo] = useState<{
    rank: number;
    nextUsername: string | null;
  } | null>(null);
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
    // Игнорировать ответы session/start, пришедшие после нового reset.
    let generation = 0;

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
          // Офлайн-партия на локальном seed: играть можно, счёт не сохранится.
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
      setScore(0);
      setGameOver(false);
      setRankInfo(null);
      setSaveError(null);
      startGameSession();
    };

    resetGameRef.current = resetGame;

    const submitScore = (displayScore: number, ticks: number[]) => {
      if (!gameSessionId) {
        setSaveError(ui.game.sessionMissing);
        return;
      }
      void api
        .submitScore(displayScore, gameSessionId, ticks)
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

    const update = (frameTime: number) => {
      if (!engine || engine.isGameOver()) return;

      const delta = Math.min(frameTime - lastFrameTime, MAX_FRAME_DELTA_MS);
      tickAccumulatorMs += delta;

      while (tickAccumulatorMs >= TICK_MS && !engine.isGameOver()) {
        tickAccumulatorMs -= TICK_MS;

        // Лог прыжков — вход replay-валидации на сервере: записывается
        // ровно то, что подаётся в движок.
        const jumpRequested = pendingJump;
        pendingJump = false;
        if (jumpRequested) {
          jumpTicks.push(engine.getTick());
        }
        engine.tick(jumpRequested);
      }

      setScore(engine.getScore());

      if (engine.isGameOver()) {
        setGameOver(true);
        submitScore(engine.getScore(), jumpTicks);
      }
    };

    const draw = () => {
      ctx.fillStyle = "#f7f7f7";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.strokeStyle = "#535353";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
      ctx.stroke();

      const dinoY = engine ? engine.getDino().y : GROUND_Y - DINO_HEIGHT;
      ctx.fillStyle = activeSkinColorRef.current;
      ctx.fillRect(DINO_X, dinoY, DINO_WIDTH, DINO_HEIGHT);
      ctx.fillStyle = "#f7f7f7";
      ctx.fillRect(DINO_X + 30, dinoY + 8, 6, 6);

      if (engine) {
        for (const cactus of engine.getCacti()) {
          const cactusY = GROUND_Y - cactus.height;
          ctx.fillStyle = "#535353";
          ctx.fillRect(cactus.x, cactusY, cactus.width, cactus.height);
          ctx.fillRect(cactus.x + cactus.width, cactusY + 10, 8, 4);
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
      generation += 1;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("touchstart", handleTouchStart);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[820px] mx-auto">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="self-start px-3 py-1 text-sm border border-[#d0d0d0] rounded-sm text-[#535353] hover:bg-[#f0f0f0] transition-colors"
        >
          {ui.common.back}
        </button>
      )}

      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#535353] tracking-tight">
          {gameMeta.displayName}
        </h1>
        <p className="text-sm text-[#737373] mt-1">{ui.game.spaceJump}</p>
      </div>

      <div className="flex gap-8 font-mono text-lg text-[#535353]">
        <span>{ui.game.score}: {score}</span>
        <span>{ui.game.best}: {highScore}</span>
        {gameOver && (
          <span className="text-red-600 text-sm self-center">{ui.game.gameOver}</span>
        )}
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          data-testid="game-canvas"
          className="border-2 border-[#d0d0d0] rounded-sm shadow-sm bg-[#f7f7f7]"
          tabIndex={0}
          aria-label={ui.game.ariaLabel(gameMeta.displayName)}
        />

        {gameOver && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-[#f7f7f7]/80 rounded-sm"
            data-testid="game-over-modal"
          >
            <div className="flex flex-col items-center gap-4 px-8 py-6 bg-white border-2 border-[#d0d0d0] rounded-sm shadow-sm">
              <h2 className="text-xl font-bold text-[#535353]">{ui.game.gameOver}</h2>

              <div className="flex gap-6 font-mono text-[#535353]">
                <span>{ui.game.score}: {score}</span>
                <span>{ui.game.best}: {highScore}</span>
              </div>

              {rankInfo && (
                <p className="text-sm text-[#737373]">
                  {ui.game.rankLine(rankInfo.rank, rankInfo.nextUsername)}
                </p>
              )}

              {saveError && (
                <p className="text-sm text-red-600" role="alert">
                  {saveError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => resetGameRef.current?.()}
                  className="px-4 py-2 text-sm font-medium border border-[#535353] rounded-sm text-white bg-[#535353] hover:bg-[#3d3d3d] transition-colors"
                >
                  {ui.game.playAgain}
                </button>
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="px-4 py-2 text-sm border border-[#d0d0d0] rounded-sm text-[#535353] hover:bg-[#f0f0f0] transition-colors"
                  >
                    {ui.common.back}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
