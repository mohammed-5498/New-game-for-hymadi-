// رسم الأفراد: جسم بلون اللاعب، رأس، وظل تحت القدمين
import { TILE_HALF_W, TILE_HALF_H } from '../config.js';
import { UI_LIGHT } from './colors.js';

// موقع الوحدة في العالم مع تنعيم بين تحديثين (alpha من 0 إلى 1)
export function unitWorldPos(unit, alpha) {
  const i = unit.prevX + (unit.x - unit.prevX) * alpha;
  const j = unit.prevY + (unit.y - unit.prevY) * alpha;
  return { x: (i - j) * TILE_HALF_W, y: (i + j) * TILE_HALF_H };
}

export function drawUnit(ctx, unit, alpha) {
  const { x, y } = unitWorldPos(unit, alpha);

  // الظل
  ctx.beginPath();
  ctx.ellipse(x, y + 0.5, 3.5, 1.6, 0, 0, 6.2832);
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fill();

  // الجسم بلون اللاعب
  ctx.fillStyle = unit.color;
  ctx.fillRect(x - 2, y - 7, 4, 6);
  ctx.strokeStyle = '#2b2825';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x - 2, y - 7, 4, 6);

  // الرأس
  ctx.beginPath();
  ctx.arc(x, y - 8.5, 2, 0, 6.2832);
  ctx.fillStyle = '#d9a77a';
  ctx.fill();
}

// دائرة التحديد عند القدمين (تُرسم فوق طبقة الليل حتى تبقى واضحة)
export function drawSelectionRing(ctx, unit, alpha) {
  const { x, y } = unitWorldPos(unit, alpha);
  ctx.beginPath();
  ctx.ellipse(x, y, 5.5, 2.8, 0, 0, 6.2832);
  ctx.strokeStyle = UI_LIGHT;
  ctx.lineWidth = 1;
  ctx.stroke();
}
