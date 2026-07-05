import { darkenColor, GAME_THEME, type GameTheme } from "@/game/theme";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

export function drawSkyBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: GameTheme = GAME_THEME,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, theme.skyTop);
  gradient.addColorStop(0.7, "#ffe0d2");
  gradient.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function drawSkyDecor(
  ctx: CanvasRenderingContext2D,
  width: number,
  theme: GameTheme = GAME_THEME,
): void {
  ctx.fillStyle = theme.sun;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(width - 48, 28, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = theme.cloud;
  ctx.globalAlpha = 0.85;
  for (const cloud of [
    { x: 60, y: 24, w: 36, h: 14 },
    { x: width * 0.45, y: 16, w: 28, h: 11 },
    { x: width * 0.62, y: 34, w: 22, h: 9 },
  ]) {
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, cloud.w / 2, cloud.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawGround(
  ctx: CanvasRenderingContext2D,
  groundY: number,
  width: number,
  theme: GameTheme = GAME_THEME,
): void {
  ctx.fillStyle = theme.ground;
  ctx.fillRect(0, groundY + 2, width, 8);

  ctx.strokeStyle = theme.groundLine;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(width, groundY);
  ctx.stroke();
}

/** Styled dino inside the engine collision box (same x/y/w/h). */
export function drawStyledDino(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  theme: GameTheme = GAME_THEME,
): void {
  const s = width / 44;
  const bodyW = 28 * s;
  const bodyH = 26 * s;
  const bodyX = x + 4 * s;
  const bodyY = y + 4 * s;

  ctx.fillStyle = color;
  fillRoundRect(ctx, bodyX, bodyY, bodyW, bodyH, 10 * s);
  fillRoundRect(ctx, bodyX + 16 * s, y - 6 * s, 16 * s, 16 * s, 8 * s);
  fillRoundRect(ctx, x - 4 * s, bodyY + 8 * s, 14 * s, 10 * s, 6 * s);

  ctx.fillStyle = theme.eye;
  ctx.beginPath();
  ctx.arc(bodyX + 26 * s, y + 3 * s, 2.2 * s, 0, Math.PI * 2);
  ctx.fill();

  const legColor = darkenColor(color);
  ctx.fillStyle = legColor;
  fillRoundRect(ctx, bodyX + 4 * s, y + height - 14 * s, 9 * s, 14 * s, 4 * s);
  fillRoundRect(ctx, bodyX + 18 * s, y + height - 14 * s, 9 * s, 14 * s, 4 * s);

  ctx.strokeStyle = color;
  ctx.lineWidth = 6 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(bodyX + 26 * s, bodyY + 12 * s);
  ctx.quadraticCurveTo(bodyX + 34 * s, bodyY + 10 * s, bodyX + 32 * s, bodyY + 20 * s);
  ctx.stroke();
}

export function drawStyledCactus(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: GameTheme = GAME_THEME,
): void {
  ctx.fillStyle = theme.cactus;
  const stemW = Math.max(6, width * 0.35);
  const stemX = x + (width - stemW) / 2;
  fillRoundRect(ctx, stemX, y, stemW, height, stemW / 2);

  const armH = Math.max(4, height * 0.18);
  const armW = Math.max(8, width * 0.45);
  fillRoundRect(ctx, x - armW * 0.35, y + height * 0.28, armW, armH, armH / 2);
  fillRoundRect(
    ctx,
    x + width - armW * 0.65,
    y + height * 0.42,
    armW,
    armH,
    armH / 2,
  );
}
