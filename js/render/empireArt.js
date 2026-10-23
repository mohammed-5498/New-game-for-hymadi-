// طور الإمبراطورية: ما يُرسم كل إطار فوق المدينة (المباني نفسها في الطبقة الثابتة، landmarks.js)
// - سهام أبراج الرماية من أعلى البرج إلى هدفها
// - شريط الإنتاج فوق قواعدك الرئيسية التي في طابورها طلبات، ونقطة لكل طلب
// - دائرة مدى البرج أو المستشفى المفتوحة قائمته الآن
import { TILE_HALF_W, TILE_HALF_H, EMPIRE as E } from '../config.js';
import { tileOf, productionTime, towerStats, hospitalStats } from '../game/empire.js';
import { unitWorldPos } from './units.js';
import { roofTop, empireKind } from './landmarks.js';

const worldOf = (i, j) => ({ x: (i - j) * TILE_HALF_W, y: (i + j) * TILE_HALF_H });

// السهام قبل طبقة الليل (كمقذوفات الوحدات)
export function drawEmpireShots(ctx, state, alpha) {
  if (state.mode !== 'empire' || !state.modeState.shots.length) return;
  ctx.lineCap = 'round';
  for (const shot of state.modeState.shots) {
    const t = Math.min(1, (shot.prevT + (shot.t - shot.prevT) * alpha) / shot.duration);
    const from = worldOf(shot.i, shot.j);
    from.y -= E.arrow.top;
    const to = unitWorldPos(shot.target, alpha);
    to.y -= 8;                                       // جسم الهدف لا قدماه
    const arc = Math.sin(t * Math.PI) * 6;
    const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t - arc;
    // اتجاه الطيران الآن (مشتقة المسار) فيبدو السهم مائلاً مع القوس
    let vx = to.x - from.x, vy = to.y - from.y - Math.cos(t * Math.PI) * Math.PI * 6;
    const n = Math.hypot(vx, vy) || 1;
    vx = vx / n * 3; vy = vy / n * 3;
    ctx.beginPath();
    ctx.moveTo(x - vx, y - vy);
    ctx.lineTo(x + vx, y + vy);
    ctx.strokeStyle = '#3b2a18';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// شريط الإنتاج ونقاط الطابور فوق قواعدك، ودائرة المدى للمبنى المفتوحة قائمته (فوق طبقة الليل لتُقرأ)
export function drawEmpireMarks(ctx, state, visible, openDistrict) {
  if (state.mode !== 'empire') return;
  const map = state.map, ms = state.modeState, z = state.camera.z;
  for (const id of Object.keys(ms.queues)) {
    const queue = ms.queues[id], district = map.districts[id];
    if (!queue.length || district.owner !== state.humanId) continue;
    const at = tileOf(map, district.buildTile), { x, y } = worldOf(at.i, at.j);
    if (!visible(x, y)) continue;
    const top = y - roofTop(map, empireKind(map, 'Q'), at.i, at.j) - 26;
    const w = 22, h = Math.max(2.2, 3 / z);
    const item = queue[0];
    const done = Math.min(1, item.t / productionTime(state, district.owner, item.kind));
    ctx.fillStyle = 'rgba(20,14,8,0.75)';
    ctx.fillRect(x - w / 2 - 0.6, top - 0.6, w + 1.2, h + 1.2);
    ctx.fillStyle = '#e8c45a';
    ctx.fillRect(x - w / 2, top, w * done, h);
    // نقطة لكل طلب في الطابور
    const r = Math.max(1.2, 1.6 / z * 1.4);
    for (let k = 0; k < queue.length; k++) {
      ctx.beginPath();
      ctx.arc(x - (queue.length - 1) * r * 1.4 + k * r * 2.8, top - r * 2, r, 0, 6.2832);
      ctx.fillStyle = k ? 'rgba(232,196,90,0.55)' : '#e8c45a';
      ctx.fill();
    }
  }
  // مدى البرج أو المستشفى المفتوحة قائمته
  const open = openDistrict !== null && openDistrict !== undefined ? map.districts[openDistrict] : null;
  if (open && (open.building === 'tower' || open.building === 'hospital')) {
    const at = tileOf(map, open.buildTile), { x, y } = worldOf(at.i, at.j);
    const r = open.building === 'tower' ? towerStats(open).range : hospitalStats(open).radius;
    ctx.beginPath();
    ctx.ellipse(x, y, r * TILE_HALF_W * Math.SQRT2, r * TILE_HALF_H * Math.SQRT2, 0, 0, 6.2832);
    ctx.strokeStyle = open.building === 'tower' ? 'rgba(232,196,90,0.85)' : 'rgba(120,220,140,0.85)';
    ctx.lineWidth = 1.4 / z * 1.6;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
