// المدن المفتوحة (CITIES.open: شيكاغو وهونغ كونغ والأوروبية): تفاصيل الشوارع العريضة والممرات والدوار.
// الأرض (تُرسم مع سطح الشوارع في القطع): أرصفة على حواف الشارع، ممرات مشاة عند التقاطعات،
// رصف الممرات بين صفوف المباني، وخط حلقة الدوار. المحتوى (بترتيب الرسام): أعمدة إنارة وأحواض
// زرع ومقاعد على الممرات، وجزيرة الدوار بنافورتها وعمودها المضيء.
// كل الأشكال حتمية من hsh (نفس الخريطة ← نفس الرسم دائماً)، والألوان الثابتة شفافة فتتبع الطقس.
import { CITIES } from '../config.js';
import { poly, circ, ln, rc, el, box, glow, hsh, getCtx } from './cityThemes.js';

export const openOf = (map) => CITIES.open[map.city] || null;
export const isLane = (map, k) => map.type[k] === '.' && (map.kind[k] === 'lane_i' || map.kind[k] === 'lane_j');
// علامات الشارع العريض التي لا حطام عليها ولا زينة طابع: حلقة الدوار وممرات المشاة
export const cleanRoad = (map, k) => map.dash[k] >= 5;

// نقطة على المربع بإحداثياته (a على i، b على j، من -0.5 إلى 0.5) حول مركزه على الشاشة
const at = (x, y, a, b) => [x + (a - b) * 18, y + (a + b) * 9];

// --- الأرض ---

// رصيف بعرض 0.2 مربع على كل حافة للشارع تجاور حياً (لا جزيرة الدوار)، وحافة داكنة نحو الشارع
const SIDES = [[-1, 0], [1, 0], [0, -1], [0, 1]];
export function drawSidewalks(ctx, map, i, j, x, y) {
  const f = 0.2;
  for (const [da, db] of SIDES) {
    const a = i + da, b = j + db;
    if (!map.inBounds(a, b)) continue;
    const k = map.idx(a, b);
    if (map.road[k] || map.type[k] === 'Y') continue;
    // الحافة المجاورة ثم الحافة الداخلية بعد f نحو مركز المربع
    const p = (u, v) => at(x, y, da ? da * u : v, db ? db * u : v);
    const e1 = p(0.5, -0.5), e2 = p(0.5, 0.5), e3 = p(0.5 - f, 0.5), e4 = p(0.5 - f, -0.5);
    ctx.beginPath(); ctx.moveTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]); ctx.lineTo(e3[0], e3[1]); ctx.lineTo(e4[0], e4[1]); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(e4[0], e4[1]); ctx.lineTo(e3[0], e3[1]);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 0.6; ctx.stroke();
  }
}

// ممر المشاة عند مدخل التقاطع: خطوط بيضاء موازية للشارع متتابعة عبر عرضه (6 شارع على i، 7 على j)
export function drawCrosswalk(ctx, map, i, j, x, y) {
  const along = map.dash[map.idx(i, j)] === 6;
  ctx.beginPath();
  for (const o of [-0.3, 0, 0.3]) {
    const s = along ? at(x, y, -0.28, o) : at(x, y, o, -0.28), e = along ? at(x, y, 0.28, o) : at(x, y, o, 0.28);
    ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]);
  }
  ctx.strokeStyle = 'rgba(236,232,220,0.62)'; ctx.lineWidth = 1.5; ctx.lineCap = 'butt'; ctx.stroke();
}

// رصف الممر: حافتان فاتحتان على طوله وفواصل بلاط عرضية
export function drawLanePaving(ctx, map, i, j, x, y) {
  const alongI = map.kind[map.idx(i, j)] === 'lane_i';
  const p = (u, v) => alongI ? at(x, y, u, v) : at(x, y, v, u);   // u على طول الممر، v عرضه
  ctx.beginPath();
  for (const u of [-0.25, 0.25]) { const s = p(u, -0.42), e = p(u, 0.42); ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]); }
  ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.beginPath();
  for (const v of [-0.42, 0.42]) { const s = p(-0.5, v), e = p(0.5, v); ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]); }
  ctx.strokeStyle = 'rgba(255,255,255,0.24)'; ctx.lineWidth = 0.7; ctx.stroke();
}

// مركز جزيرة الدوار إن كان المربع "مرساتها": أقرب مربعات الجزيرة للشاشة (تُرسم مرة واحدة منه)
export function roundaboutAnchor(map, i, j) {
  const Y = (a, b) => map.inBounds(a, b) && map.type[map.idx(a, b)] === 'Y';
  return Y(i, j) && Y(i - 1, j) && Y(i, j - 1) && !Y(i + 1, j) && !Y(i, j + 1);
}

// خط الحلقة المتقطع حول الجزيرة (على الأرض، فالجنود فوقه دائماً)
export function drawRoundaboutRing(ctx, x, y) {
  ctx.beginPath();
  ctx.ellipse(x, y - 9, 38, 19, 0, 0, Math.PI * 2);
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = 'rgba(240,236,224,0.7)'; ctx.lineWidth = 0.9; ctx.stroke();
  ctx.setLineDash([]);
}

// --- المحتوى ---

// زينة الممر (حتمية): عمود إنارة أو حوض زرع أو مقعد على أحد جانبيه، ولا شيء في أغلب المربعات
export function laneDecor(map, i, j) {
  const h = hsh(i, j, 520);
  const kind = h < 0.3 ? 'lamp' : h < 0.5 ? 'planter' : h < 0.6 ? 'bench' : null;
  if (!kind) return null;
  const side = hsh(i, j, 521) < 0.5 ? -0.3 : 0.3, u = (hsh(i, j, 522) - 0.5) * 0.5;
  return map.kind[map.idx(i, j)] === 'lane_i' ? { kind, a: u, b: side } : { kind, a: side, b: u };
}

const LAMP_GLOW = { hk: '#7fe8ff', chicago: '#f2d58a', europe: '#f2d58a' };

export function drawLaneDecor(map, i, j, x, y) {
  const d = laneDecor(map, i, j);
  if (!d) return;
  const [px, py] = at(x, y, d.a, d.b);
  if (d.kind === 'lamp') {
    ln(px, py, px, py - 14, '#2b2825', 0.9);
    poly([[px - 1.7, py - 14], [px, py - 17.2], [px + 1.7, py - 14], [px, py - 13]], '#2b2825');
    rc(px - 0.9, py - 15.8, 1.8, 1.7, LAMP_GLOW[map.city] || '#f2d58a');
  } else if (d.kind === 'planter') {
    box(px, py, 3.2, 1.6, 2.2, '#6f6a62', '#8a837b', '#5c5750');
    circ(px, py - 4.4, 3, '#47753d'); circ(px - 1.1, py - 5.3, 1.8, '#5f9150'); circ(px + 1.3, py - 4.8, 1.2, '#d86a8a');
  } else {
    box(px, py, 3.4, 1.7, 1.3, '#5e4634', '#76583f', '#8a6a4c');
    ln(px - 3.4, py - 3.6, px, py - 1.9, '#5e4634', 0.8);
  }
}

// شجرة صغيرة على الرصيف البعيد عن الشاشة فقط (حافة −i أو −j وخلفها مبنى): فالجندي على الشارع
// أمامها دائماً ويُرسم فوقها كما يجب. حتمية، وليست على ممرات المشاة ولا حلقة الدوار
const TREE = {
  europe: ['#5b4636', '#5f8a44', '#6f9a52'],
  chicago: ['#4a3a2e', '#4f6b3a', '#5f7d45'],
  hk: ['#3a2f28', '#2f5a3a', '#3a6a44']
};
export function streetTree(map, i, j) {
  const k = map.idx(i, j);
  if (map.dash[k] >= 5 || hsh(i, j, 530) >= 0.34) return null;
  for (const [da, db] of [[-1, 0], [0, -1]]) {
    const a = i + da, b = j + db;
    if (!map.inBounds(a, b)) continue;
    const t = map.type[map.idx(a, b)];
    if (!map.road[map.idx(a, b)] && (t === 'H' || t === 'R')) return da ? { a: -0.36, b: 0 } : { a: 0, b: -0.36 };
  }
  return null;
}
export function drawStreetTree(map, i, j, x, y) {
  const t = streetTree(map, i, j);
  if (!t) return;
  const [px, py] = at(x, y, t.a, t.b), c = TREE[map.city] || TREE.europe;
  el(px, py + 0.6, 4.2, 1.8, 'rgba(0,0,0,0.22)');
  rc(px - 0.8, py - 7, 1.6, 7, c[0]);
  circ(px, py - 10.5, 4.6, c[1]); circ(px - 2, py - 12, 3.2, c[2]); circ(px + 2.2, py - 9.6, 2.6, c[1]);
}

// إضاءة الليل لأعمدة الممرات (تجمعها chunkCache مع الإضاءات الثابتة)
export function laneLight(map, i, j, x, y) {
  const d = laneDecor(map, i, j);
  if (!d || d.kind !== 'lamp') return null;
  const [px, py] = at(x, y, d.a, d.b);
  return { x: px, y: py - 15, r: 24, c: map.city === 'hk' ? '127,232,255' : '255,220,150', a: 0.5 };
}

// جزيرة الدوار: حافة حجرية وعشب وزهور ونافورة، وفي وسطها عمود بخطوط نيون (هونغ كونغ)
export function drawRoundaboutIsland(x, y) {
  const cx = x, cy = y - 9;
  el(cx, cy + 1.4, 25.5, 12.8, '#7e7a74');
  el(cx, cy, 25.5, 12.8, '#bdb8af');
  el(cx, cy - 0.2, 22.8, 11.3, '#3d6b46');
  el(cx, cy - 0.5, 18.5, 9.1, '#4c8052');
  const flowers = ['#ff7eb6', '#ffd23f', '#f4efe4', '#ff9f5a'];
  for (let k = 0; k < 14; k++) {
    const an = k / 14 * Math.PI * 2;
    circ(cx + Math.cos(an) * 20.5, cy + Math.sin(an) * 10.1, 1.1, flowers[k % 4]);
  }
  el(cx, cy + 1, 9.5, 4.7, '#8e8a84');
  el(cx, cy, 9.5, 4.7, '#d2cdc3');
  el(cx, cy - 0.2, 8, 3.9, '#3f7fa8');
  el(cx - 2.4, cy - 1, 3, 1.1, 'rgba(255,255,255,0.35)');
  // العمود: قاعدة ثم جسم داكن بحافتين من النيون، وفي قمته كرة مضيئة
  box(cx, cy, 3.6, 1.8, 3, '#55565c', '#6a6b71', '#7a7b81');
  box(cx, cy - 3, 2.2, 1.1, 24, '#34353b', '#44454c', '#56575e');
  ln(cx - 2.2, cy - 3, cx - 2.2, cy - 27, '#ff4fa3', 0.7);
  ln(cx + 2.2, cy - 3, cx + 2.2, cy - 27, '#3fe0ff', 0.7);
  ln(cx, cy - 1.9, cx, cy - 25.9, 'rgba(255,255,255,0.35)', 0.5);
  glow(cx, cy - 30, 9, 'rgba(255,120,200,0.45)');
  circ(cx, cy - 30, 2.4, '#ff8fd0');
  circ(cx - 0.7, cy - 30.7, 0.9, '#ffffff');
  // رذاذ النافورة
  const c = getCtx();
  c.save(); c.globalAlpha = 0.55;
  for (const dx of [-5, 5]) {
    c.beginPath(); c.moveTo(cx + dx * 0.25, cy - 4); c.quadraticCurveTo(cx + dx * 0.8, cy - 9, cx + dx, cy - 1);
    c.strokeStyle = '#bfe6ff'; c.lineWidth = 0.7; c.stroke();
  }
  c.restore();
}

// إضاءة الدوار ليلاً: وهج العمود المضيء
export function roundaboutLights(x, y) {
  return [{ x, y: y - 39, r: 46, c: '255,110,190', a: 0.45 }, { x, y: y - 12, r: 34, c: '120,220,255', a: 0.3 }];
}
