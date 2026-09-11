// رسم الأفراد: جسم بلون اللاعب، رأس، ظل، شريط دم، ومضة الضرب، وسقوط الميت
import { TILE_HALF_W, TILE_HALF_H, COMBAT } from '../config.js';
import { UI_LIGHT } from './colors.js';
import { mix } from './colors.js';

// موقع الوحدة في العالم مع تنعيم بين تحديثين (alpha من 0 إلى 1)
export function unitWorldPos(unit, alpha) {
  const i = unit.prevX + (unit.x - unit.prevX) * alpha;
  const j = unit.prevY + (unit.y - unit.prevY) * alpha;
  return { x: (i - j) * TILE_HALF_W, y: (i + j) * TILE_HALF_H };
}

export function drawUnit(ctx, unit, alpha) {
  const { x, y } = unitWorldPos(unit, alpha);

  if (unit.state === 'dead') {
    drawDeadUnit(ctx, unit, x, y);
    return;
  }

  // الظل
  ctx.beginPath();
  ctx.ellipse(x, y + 0.5, 3.5, 1.6, 0, 0, 6.2832);
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fill();

  drawBody(ctx, unit, x, y);

  // شريط الدم يظهر للوحدة المتضررة أو المحددة
  if (unit.hp < unit.maxHp || unit.selected) drawHealthBar(ctx, unit, x, y);
}

function drawBody(ctx, unit, x, y) {
  // ومضة بيضاء قصيرة عند تلقي ضربة
  const bodyColor = unit.hitFlash > 0 ? mix(unit.color, '#ffffff', 0.45) : unit.color;

  ctx.fillStyle = bodyColor;
  ctx.fillRect(x - 2, y - 7, 4, 6);
  ctx.strokeStyle = '#2b2825';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x - 2, y - 7, 4, 6);

  ctx.beginPath();
  ctx.arc(x, y - 8.5, 2, 0, 6.2832);
  ctx.fillStyle = unit.hitFlash > 0 ? mix('#d9a77a', '#ffffff', 0.45) : '#d9a77a';
  ctx.fill();
}

// الوحدة الميتة تسقط وتختفي خلال ثانية
function drawDeadUnit(ctx, unit, x, y) {
  const progress = Math.max(0, Math.min(1, 1 - unit.deathTimer / COMBAT.deathTime));
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.translate(x, y);
  ctx.rotate(progress * 1.4);
  ctx.fillStyle = unit.color;
  ctx.fillRect(-2, -7, 4, 6);
  ctx.beginPath();
  ctx.arc(0, -8.5, 2, 0, 6.2832);
  ctx.fillStyle = '#d9a77a';
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawHealthBar(ctx, unit, x, y) {
  const w = 5, h = 1.1, top = y - 12.5;
  const ratio = Math.max(0, unit.hp / unit.maxHp);

  ctx.fillStyle = 'rgba(20,18,16,.75)';
  ctx.fillRect(x - w / 2, top, w, h);
  ctx.fillStyle = ratio > 0.5 ? '#5fbf5f' : ratio > 0.25 ? '#e0b030' : '#d9463b';
  ctx.fillRect(x - w / 2, top, w * ratio, h);
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

// --- المقذوفات وهي تطير ---
const PROJECTILE_COLORS = {
  stone:  '#9a948c',
  arrow:  '#c8b68a',
  bottle: '#e8893a'
};

export function drawProjectile(ctx, shot, alpha) {
  const i = shot.prevX + (shot.x - shot.prevX) * alpha;
  const j = shot.prevY + (shot.y - shot.prevY) * alpha;
  const t = shot.prevT + (shot.t - shot.prevT) * alpha;

  const x = (i - j) * TILE_HALF_W;
  const progress = Math.max(0, Math.min(1, t / shot.duration));
  // ارتفاع قوس الرمية + ارتفاع اليد
  const y = (i + j) * TILE_HALF_H - 6 - Math.sin(progress * Math.PI) * COMBAT.projectileArc;
  const color = PROJECTILE_COLORS[shot.kind] || PROJECTILE_COLORS.stone;

  if (shot.kind === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(x - 2, y + 1);
    ctx.lineTo(x + 2, y - 1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, 6.2832);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,40,37,.8)';   // حد داكن ليظهر المقذوف على أي خلفية
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}
