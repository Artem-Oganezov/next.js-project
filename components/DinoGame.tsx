"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { GAME_CONFIG } from "@/lib/game/constants";
import type { Cactus, DinoState } from "@/types/dino-game.types";

const {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  GRAVITY,
  JUMP_FORCE,
  DINO_X,
  DINO_WIDTH,
  DINO_HEIGHT,
  BASE_SPEED,
  SCORE_PER_FRAME,
} = GAME_CONFIG;

type DinoGameProps = {
  initialBestScore?: number;
  onBestScoreUpdate?: (bestScore: number) => void;
};

export default function DinoGame({
  initialBestScore = 0,
  onBestScoreUpdate,
}: DinoGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(initialBestScore);
  const [gameOver, setGameOver] = useState(false);
  const onBestScoreUpdateRef = useRef(onBestScoreUpdate);

  useEffect(() => {
    setHighScore(initialBestScore);
  }, [initialBestScore]);

  useEffect(() => {
    onBestScoreUpdateRef.current = onBestScoreUpdate;
  }, [onBestScoreUpdate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dino: DinoState = { y: GROUND_Y - DINO_HEIGHT, velocityY: 0 };
    let cacti: Cactus[] = [];
    let currentScore = 0;
    let speed = BASE_SPEED;
    let isGameOver = false;
    let framesSinceLastCactus = 0;
    let nextCactusGap = 90;
    let animationFrameId = 0;

    const startGameSession = () => {
      void api.startGameSession().catch(() => {});
    };

    const resetGame = () => {
      dino = { y: GROUND_Y - DINO_HEIGHT, velocityY: 0 };
      cacti = [];
      currentScore = 0;
      speed = BASE_SPEED;
      isGameOver = false;
      framesSinceLastCactus = 0;
      nextCactusGap = 80 + Math.floor(Math.random() * 60);
      setScore(0);
      setGameOver(false);
      startGameSession();
    };

    const spawnCactus = () => {
      cacti.push({
        x: CANVAS_WIDTH + 10,
        width: 18 + Math.floor(Math.random() * 10),
        height: 35 + Math.floor(Math.random() * 25),
      });
    };

    const isColliding = (
      ax: number,
      ay: number,
      aw: number,
      ah: number,
      bx: number,
      by: number,
      bw: number,
      bh: number,
    ) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

    const submitScore = (displayScore: number) => {
      void api
        .submitScore(displayScore)
        .then((data) => {
          setHighScore(data.bestScore);
          onBestScoreUpdateRef.current?.(data.bestScore);
        })
        .catch(() => {});
    };

    const update = () => {
      if (isGameOver) return;

      dino.velocityY += GRAVITY;
      dino.y += dino.velocityY;

      const floorY = GROUND_Y - DINO_HEIGHT;
      if (dino.y >= floorY) {
        dino.y = floorY;
        dino.velocityY = 0;
      }

      for (let i = cacti.length - 1; i >= 0; i--) {
        cacti[i].x -= speed;
        if (cacti[i].x + cacti[i].width < 0) {
          cacti.splice(i, 1);
        }
      }

      framesSinceLastCactus += 1;
      if (framesSinceLastCactus >= nextCactusGap) {
        spawnCactus();
        framesSinceLastCactus = 0;
        nextCactusGap = 70 + Math.floor(Math.random() * 80);
      }

      currentScore += SCORE_PER_FRAME;
      const displayScore = Math.floor(currentScore);
      setScore(displayScore);
      speed = BASE_SPEED + Math.floor(currentScore / 100) * 0.5;

      for (const cactus of cacti) {
        const cactusY = GROUND_Y - cactus.height;
        if (
          isColliding(
            DINO_X,
            dino.y,
            DINO_WIDTH,
            DINO_HEIGHT,
            cactus.x,
            cactusY,
            cactus.width,
            cactus.height,
          )
        ) {
          isGameOver = true;
          setGameOver(true);
          submitScore(displayScore);
          break;
        }
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

      ctx.fillStyle = "#535353";
      ctx.fillRect(DINO_X, dino.y, DINO_WIDTH, DINO_HEIGHT);
      ctx.fillStyle = "#f7f7f7";
      ctx.fillRect(DINO_X + 30, dino.y + 8, 6, 6);

      for (const cactus of cacti) {
        const cactusY = GROUND_Y - cactus.height;
        ctx.fillStyle = "#535353";
        ctx.fillRect(cactus.x, cactusY, cactus.width, cactus.height);
        ctx.fillRect(cactus.x + cactus.width, cactusY + 10, 8, 4);
      }

      if (isGameOver) {
        ctx.fillStyle = "#535353";
        ctx.font = "bold 20px monospace";
        ctx.textAlign = "center";
        ctx.fillText("ИГРА ОКОНЧЕНА", CANVAS_WIDTH / 2, 70);
        ctx.font = "14px monospace";
        ctx.fillText("Пробел — начать заново", CANVAS_WIDTH / 2, 95);
      }
    };

    const gameLoop = () => {
      update();
      draw();
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.code !== "ArrowUp") return;
      event.preventDefault();

      if (isGameOver) {
        resetGame();
        return;
      }

      const onGround =
        dino.velocityY === 0 && dino.y >= GROUND_Y - DINO_HEIGHT - 1;
      if (onGround) {
        dino.velocityY = JUMP_FORCE;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    resetGame();
    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[820px] mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#535353] tracking-tight">Dino Run</h1>
        <p className="text-sm text-[#737373] mt-1">Пробел или ↑ — прыжок</p>
      </div>

      <div className="flex gap-8 font-mono text-lg text-[#535353]">
        <span>Очки: {score}</span>
        <span>Рекорд: {highScore}</span>
        {gameOver && (
          <span className="text-red-600 text-sm self-center">Проигрыш</span>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-[#d0d0d0] rounded-sm shadow-sm bg-[#f7f7f7]"
        tabIndex={0}
        aria-label="Игра Dino Run"
      />
    </div>
  );
}
