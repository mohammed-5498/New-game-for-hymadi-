// طور الإمبراطورية: ما يُرسم كل إطار فوق المدينة (المباني نفسها في الطبقة الثابتة، landmarks.js)
// - هالة ذهبية حول كل قاعدة رئيسية (حول قلعتها كلها)
// - سهام أبراج الرماية من أعلى البرج إلى هدفها
// - شارة كل مبنى على سارية فوق سطحه: تاج للقاعدة، وقوس وسهم للبرج، وصليب للمستشفى، بحلقة بلون صاحبه
// - شريط الإنتاج فوق شارة قواعدك التي في طابورها طلبات، ونقطة لكل طلب
// - دائرة مدى البرج أو المستشفى المفتوحة قائمته الآن
import { TILE_HALF_W, TILE_HALF_H, EMPIRE as E } from '../config.js';
import { tileOf, productionTime, towerStats, hospitalStats, BUILDING_TILE } from '../game/empire.js';
import { unitWorldPos } from './units.js';
import { roofTop, empireKind } from './landmarks.js';

const worldOf = (i, j) => ({ x: (i - j) * TILE_HALF_W, y: (i + j) * TILE_HALF_H });

// --- الهالة الذهبية حول القواعد الرئيسية: قبل الوحدات فيمشي الجنود فوقها ---
export function drawEmpireHalos(ctx, state, visible) {
  if (state.mode !== 'empire') return;
  const H = E.baseHalo, map = state.map;
  const pulse = 1 - H.pulse + H.pulse * (0.5 + 0.5 * Math.sin(state.time * H.speed));
  const rx = H.radius * TILE_HALF_W * Math.SQRT2, ry = H.radius * TILE_HALF_H * Math.SQRT2;
  for (const d of map.districts) {
    if (d.building !== 'hq' || d.buildTile === undefined) continue;
    const at = tileOf(map, d.buildTile), { x, y } = worldOf(at.i, at.j);
    if (!visible(x, y)) continue;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, 6.2832);
    ctx.strokeStyle = 'rgba(255,200,70,' + (H.glowAlpha * pulse).toFixed(3) + ')';
    ctx.lineWidth = H.glow;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,218,105,' + (H.alpha * pulse).toFixed(3) + ')';
    ctx.lineWidth = H.width;
    ctx.stroke();
  }
}

// --- شارات المباني ---
// مكان الشارة: فوق سطح المبنى بسارية قصيرة، ونصف قطرها لا يصغر على الشاشة عن badge.minScreen
// (ويستعمله input.js لمساحة لمس المبنى)
export function badgeOf(state, d) {
  const B = E.badge, map = state.map;
  const at = tileOf(map, d.buildTile), { x, y } = worldOf(at.i, at.j);
  const top = y - roofTop(map, empireKind(map, BUILDING_TILE[d.building]), at.i, at.j);
  const r = Math.max(B.radius, B.minScreen / state.camera.z);
  return { x, y, top, r, cy: top - B.pole - r };
}

// رمز كل مبنى داخل قرصه: s نصف عرض الرمز
const ICONS = {
  // تاج ذهبي بثلاث شُرَف وجواهر
  hq(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - s, y + s * 0.6);
    ctx.lineTo(x - s, y - s * 0.35);
    ctx.lineTo(x - s * 0.5, y + s * 0.1);
    ctx.lineTo(x, y - s * 0.7);
    ctx.lineTo(x + s * 0.5, y + s * 0.1);
    ctx.lineTo(x + s, y - s * 0.35);
    ctx.lineTo(x + s, y + s * 0.6);
    ctx.closePath();
    ctx.fillStyle = '#ffd34d';
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    for (const [dx, dy] of [[-1, -0.35], [0, -0.7], [1, -0.35]]) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, s * 0.17, 0, 6.2832);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(120,80,10,0.55)';
    ctx.fillRect(x - s, y + s * 0.3, s * 2, s * 0.3);
  },
  // قوس مشدود وسهم
  tower(ctx, x, y, s) {
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x - s * 0.55, y, s * 1.05, -1.1, 1.1);
    ctx.strokeStyle = '#e0b04a';
    ctx.lineWidth = s * 0.24;
    ctx.stroke();
    const bx = x - s * 0.55 + Math.cos(1.1) * s * 1.05, by = Math.sin(1.1) * s * 1.05;
    ctx.beginPath();
    ctx.moveTo(bx, y - by);
    ctx.lineTo(x - s * 0.55, y);
    ctx.lineTo(bx, y + by);
    ctx.strokeStyle = '#f3ece0';
    ctx.lineWidth = s * 0.09;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - s * 0.75, y);
    ctx.lineTo(x + s * 0.75, y);
    ctx.lineWidth = s * 0.13;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s * 1.05, y);
    ctx.lineTo(x + s * 0.6, y - s * 0.28);
    ctx.lineTo(x + s * 0.6, y + s * 0.28);
    ctx.closePath();
    ctx.fillStyle = '#f3ece0';
    ctx.fill();
  },
  // صليب أحمر على أبيض
  hospital(ctx, x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, s * 1.15, 0, 6.2832);
    ctx.fillStyle = '#f7f3ea';
    ctx.fill();
    ctx.fillStyle = '#d0322a';
    ctx.fillRect(x - s * 0.24, y - s * 0.78, s * 0.48, s * 1.56);
    ctx.fillRect(x - s * 0.78, y - s * 0.24, s * 1.56, s * 0.48);
  }
};

// الشارات فوق طبقة الليل لتُقرأ دائماً، ولكل مبنى ظاهر في كل الأحياء (لك ولخصومك)
export function drawEmpireBadges(ctx, state, visible) {
  if (state.mode !== 'empire') return;
  const B = E.badge, z = state.camera.z;
  for (const d of state.map.districts) {
    if (!d.building || d.buildTile === undefined) continue;
    const b = badgeOf(state, d);
    if (!visible(b.x, b.y)) continue;
    ctx.beginPath();
    ctx.moveTo(b.x, b.top + 1);
    ctx.lineTo(b.x, b.cy + b.r);
    ctx.strokeStyle = '#2b2825';
    ctx.lineWidth = Math.max(1.1, 1.6 / z);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x, b.cy, b.r, 0, 6.2832);
    ctx.fillStyle = B.disc;
    ctx.fill();
    ctx.lineWidth = b.r * 0.24;
    ctx.strokeStyle = d.owner !== null ? state.players[d.owner].color : B.neutral;
    ctx.stroke();
    ICONS[d.building](ctx, b.x, b.cy, b.r * 0.6);
  }
}

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
    const b = badgeOf(state, district), x = b.x;
    if (!visible(x, b.y)) continue;
    const h = Math.max(2.2, 3 / z), top = b.cy - b.r - 4 - h;    // فوق الشارة
    const w = 22;
    const item = queue[0];
    const done = Math.min(1, item.t / productionTime(state, district, item.kind));
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
