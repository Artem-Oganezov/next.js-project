// Директива Next.js: компонент работает только в браузере (Canvas, клавиатура, localStorage)
"use client";

// Хуки React: эффекты, ссылка на canvas, состояние для счёта на экране
import { useEffect, useRef, useState } from "react";

// --- Константы игры (не меняются во время игры) ---

const CANVAS_WIDTH = 800; // ширина игрового поля в пикселях
const CANVAS_HEIGHT = 200; // высота игрового поля в пикселях
const GROUND_Y = 170; // Y-координата «земли» (линия, по которой бежит динозавр)
const GRAVITY = 0.55; // сила притяжения: каждый кадр прибавляется к скорости падения
const JUMP_FORCE = -11; // начальная скорость вверх при прыжке (отрицательная = вверх)
const DINO_X = 50; // фиксированная позиция динозавра по горизонтали
const DINO_WIDTH = 44; // ширина прямоугольника динозавра
const DINO_HEIGHT = 47; // высота прямоугольника динозавра
const BASE_SPEED = 5; // начальная скорость движения кактусов влево
const STORAGE_KEY = "dino-high-score"; // ключ для сохранения рекорда в localStorage

// Тип одного кактуса-препятствия
type Cactus = {
  x: number; // позиция по X (справа появляется, уходит влево)
  width: number; // ширина кактуса
  height: number; // высота кактуса
};

// Тип состояния динозавра
type DinoState = {
  y: number; // текущая позиция по вертикали
  velocityY: number; // вертикальная скорость (прыжок / падение)
};

export default function DinoGame() {
  // Ссылка на элемент <canvas> в DOM — через неё рисуем игру
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Текущий счёт и рекорд — показываем в React-разметке над canvas
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  // При первой загрузке читаем рекорд из localStorage браузера
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY); // строка или null
    if (saved !== null) {
      setHighScore(parseInt(saved, 10)); // превращаем строку в число
    }
  }, []);

  // Главный эффект: запуск игрового цикла один раз после монтирования компонента
  useEffect(() => {
    const canvas = canvasRef.current; // берём canvas из DOM
    if (!canvas) return; // если ещё нет — выходим

    const ctx = canvas.getContext("2d"); // контекст рисования 2D
    if (!ctx) return; // старые браузеры без canvas — выходим

    // --- Переменные игрового состояния (живут внутри эффекта, не в React state — так быстрее) ---

    let dino: DinoState = {
      y: GROUND_Y - DINO_HEIGHT, // стоит на земле
      velocityY: 0, // не падает и не летит
    };

    let cacti: Cactus[] = []; // массив активных кактусов на экране
    let currentScore = 0; // счёт внутри цикла (синхронизируем с React реже)
    let speed = BASE_SPEED; // текущая скорость препятствий
    let isGameOver = false; // флаг конца игры
    let framesSinceLastCactus = 0; // счётчик кадров до следующего кактуса
    let nextCactusGap = 90; // через сколько кадров появится следующий кактус
    let animationFrameId = 0; // id кадра для отмены requestAnimationFrame

    // Сброс игры в начальное состояние (старт и рестарт)
    const resetGame = () => {
      dino = { y: GROUND_Y - DINO_HEIGHT, velocityY: 0 };
      cacti = [];
      currentScore = 0;
      speed = BASE_SPEED;
      isGameOver = false;
      framesSinceLastCactus = 0;
      nextCactusGap = 80 + Math.floor(Math.random() * 60); // случайный интервал 80–140 кадров
      setScore(0);
      setGameOver(false);
    };

    // Создать новый кактус у правого края экрана
    const spawnCactus = () => {
      const height = 35 + Math.floor(Math.random() * 25); // высота 35–59 px
      const width = 18 + Math.floor(Math.random() * 10); // ширина 18–27 px
      cacti.push({
        x: CANVAS_WIDTH + 10, // чуть за правым краем — «въезжает» на экран
        width,
        height,
      });
    };

    // Проверка пересечения двух прямоугольников (динозавр и кактус)
    const isColliding = (
      ax: number,
      ay: number,
      aw: number,
      ah: number,
      bx: number,
      by: number,
      bw: number,
      bh: number
    ) => {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    };

    // Обновление логики на один кадр (физика, движение, столкновения)
    const update = () => {
      if (isGameOver) return; // на паузе после проигрыша логика не крутится

      // --- Физика прыжка динозавра ---
      dino.velocityY += GRAVITY; // ускорение вниз каждый кадр
      dino.y += dino.velocityY; // смещаем динозавра по Y

      // Не даём провалиться ниже земли
      const floorY = GROUND_Y - DINO_HEIGHT;
      if (dino.y >= floorY) {
        dino.y = floorY; // прижимаем к земле
        dino.velocityY = 0; // останавливаем падение
      }

      // --- Движение кактусов влево ---
      for (let i = cacti.length - 1; i >= 0; i--) {
        cacti[i].x -= speed; // сдвиг влево на текущую скорость
        if (cacti[i].x + cacti[i].width < 0) {
          cacti.splice(i, 1); // удалили кактус, ушедший за левый край
        }
      }

      // --- Генерация новых кактусов ---
      framesSinceLastCactus += 1;
      if (framesSinceLastCactus >= nextCactusGap) {
        spawnCactus();
        framesSinceLastCactus = 0;
        nextCactusGap = 70 + Math.floor(Math.random() * 80); // новый случайный интервал
      }

      // --- Нарастание сложности и счёта ---
      currentScore += 0.15; // очки растут плавно каждый кадр
      const displayScore = Math.floor(currentScore);
      setScore(displayScore); // обновляем React только целым числом

      // Скорость чуть растёт с очками (как в оригинале Chrome)
      speed = BASE_SPEED + Math.floor(currentScore / 100) * 0.5;

      // --- Проверка столкновений ---
      for (const cactus of cacti) {
        const cactusY = GROUND_Y - cactus.height;
        const hit = isColliding(
          DINO_X,
          dino.y,
          DINO_WIDTH,
          DINO_HEIGHT,
          cactus.x,
          cactusY,
          cactus.width,
          cactus.height
        );
        if (hit) {
          isGameOver = true;
          setGameOver(true);

          // Сохраняем рекорд, если побили прошлый результат
          const saved = localStorage.getItem(STORAGE_KEY);
          const prevBest = saved ? parseInt(saved, 10) : 0;
          if (displayScore > prevBest) {
            localStorage.setItem(STORAGE_KEY, String(displayScore));
            setHighScore(displayScore);
          }
          break;
        }
      }
    };

    // Отрисовка одного кадра на canvas
    const draw = () => {
      // Очищаем весь холст цветом «небо Chrome offline»
      ctx.fillStyle = "#f7f7f7";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Линия земли
      ctx.strokeStyle = "#535353";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
      ctx.stroke();

      // --- Рисуем динозавра (упрощённый пиксельный стиль) ---
      ctx.fillStyle = "#535353";
      ctx.fillRect(DINO_X, dino.y, DINO_WIDTH, DINO_HEIGHT);
      // Глаз
      ctx.fillStyle = "#f7f7f7";
      ctx.fillRect(DINO_X + 30, dino.y + 8, 6, 6);

      // --- Рисуем все кактусы ---
      ctx.fillStyle = "#535353";
      for (const cactus of cacti) {
        const cactusY = GROUND_Y - cactus.height;
        ctx.fillRect(cactus.x, cactusY, cactus.width, cactus.height);
        // «рука» кактуса для узнаваемости
        ctx.fillRect(cactus.x + cactus.width, cactusY + 10, 8, 4);
      }

      // Текст Game Over поверх canvas
      if (isGameOver) {
        ctx.fillStyle = "#535353";
        ctx.font = "bold 20px monospace";
        ctx.textAlign = "center";
        ctx.fillText("ИГРА ОКОНЧЕНА", CANVAS_WIDTH / 2, 70);
        ctx.font = "14px monospace";
        ctx.fillText("Пробел — начать заново", CANVAS_WIDTH / 2, 95);
      }
    };

    // Игровой цикл: браузер вызывает эту функцию ~60 раз в секунду
    const gameLoop = () => {
      update(); // сначала считаем новые позиции
      draw(); // потом рисуем кадр
      animationFrameId = requestAnimationFrame(gameLoop); // просим следующий кадр
    };

    // Прыжок или рестарт по клавише
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.code !== "ArrowUp") return;
      event.preventDefault(); // не прокручиваем страницу пробелом

      if (isGameOver) {
        resetGame(); // рестарт после проигрыша
        return;
      }

      // Прыжок только если динозавр стоит на земле (velocityY === 0 и y на полу)
      const onGround = dino.velocityY === 0 && dino.y >= GROUND_Y - DINO_HEIGHT - 1;
      if (onGround) {
        dino.velocityY = JUMP_FORCE; // даём импульс вверх
      }
    };

    window.addEventListener("keydown", handleKeyDown); // слушаем клавиатуру
    resetGame(); // начальное состояние
    animationFrameId = requestAnimationFrame(gameLoop); // стартуем цикл

    // Очистка при размонтировании компонента (уход со страницы)
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []); // пустой массив зависимостей = эффект один раз при монтировании

  return (
  // Обёртка с Tailwind: центрируем игру на странице
    <div className="flex flex-col items-center gap-4 w-full max-w-[820px] mx-auto">
      {/* Заголовок и подсказка управления */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#535353] tracking-tight">
          Dino Run
        </h1>
        <p className="text-sm text-[#737373] mt-1">
          Пробел или ↑ — прыжок
        </p>
      </div>

      {/* Панель счёта */}
      <div className="flex gap-8 font-mono text-lg text-[#535353]">
        <span>Очки: {score}</span>
        <span>Рекорд: {highScore}</span>
        {gameOver && (
          <span className="text-red-600 text-sm self-center">Проигрыш!</span>
        )}
      </div>

      {/* Canvas — сюда рисует игровой цикл */}
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
