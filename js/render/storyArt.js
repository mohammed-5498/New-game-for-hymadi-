// علامات طور القصة على الخريطة (القسم 17): حلقة ذهبية نابضة حيث المهمة الحالية، وحلقة واسم فوق الزعيم والرسل
// والمتفجرين وتجار القافلة. رسم فقط
import { TILE_HALF_W, TILE_HALF_H, ALERTS } from '../config.js';
import { targetPoint } from '../game/story.js';

const GOLD = ALERTS.storyColor, RED = '#e0523b';

export function drawStoryMarks(ctx, state, alpha, visible) {
  if (!state.story || state.story.done) return;
  const t = state.time, z = state.camera.z;
  const p = targetPoint(state);
  if (p) {
    const x = (p.i - p.j) * TILE_HALF_W, y = (p.i + p.j) * TILE_HALF_H;
    if (visible(x, y)) {
      const pulse = 1 + 0.08 * Math.sin(t * 4);
      ring(ctx, x, y, p.r * pulse, GOLD, 2.4 / Math.max(1, z * 0.6), 0.9);
      ring(ctx, x, y, p.r * 0.55, GOLD, 1.2, 0.45);
      // سهم ذهبي يتمايل فوق المكان
      const top = y - 30 - 3 * Math.sin(t * 3);
      ctx.beginPath();
      ctx.moveTo(x - 6, top - 9); ctx.lineTo(x + 6, top - 9); ctx.lineTo(x, top);
      ctx.closePath();
      ctx.fillStyle = GOLD;
      ctx.globalAlpha = 0.95;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(40,28,10,0.8)';
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  for (const u of state.units) {
    if (!u.story || u.state === 'dead') continue;
    const role = u.story.role;
    if (role !== 'boss' && role !== 'runner' && role !== 'merchant') continue;
    const ui = u.prevX + (u.x - u.prevX) * alpha, uj = u.prevY + (u.y - u.prevY) * alpha;
    const x = (ui - uj) * TILE_HALF_W, y = (ui + uj) * TILE_HALF_H;
    if (!visible(x, y)) continue;
    const color = role === 'merchant' ? GOLD : RED;
    ring(ctx, x, y, role === 'boss' ? 0.9 : 0.6, color, 1.6, 0.85);
    if (role === 'boss' || role === 'runner') label(ctx, u.name, x, y - (role === 'boss' ? 46 : 34), z, color);
  }
}

function ring(ctx, x, y, r, color, width, a) {
  ctx.globalAlpha = a;
  ctx.beginPath();
  ctx.ellipse(x, y, r * TILE_HALF_W, r * TILE_HALF_H, 0, 0, 6.2832);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function label(ctx, text, x, y, z, color) {
  if (!text) return;
  ctx.font = '700 ' + (12 / Math.max(0.8, z)).toFixed(2) + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.lineWidth = 3 / Math.max(0.8, z);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.direction = 'inherit';
}
