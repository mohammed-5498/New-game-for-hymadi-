// المدن المفتوحة (CITIES.open: شيكاغو وهونغ كونغ والأوروبية وشبام وباريس وروتنبورغ): تفاصيل الشوارع العريضة والممرات والدوار.
// الأرض (تُرسم مع سطح الشوارع في القطع): أرصفة على حواف الشارع، ممرات مشاة عند التقاطعات،
// رصف الممرات بين صفوف المباني، وخط حلقة الدوار. المحتوى (بترتيب الرسام): أعمدة إنارة وأحواض
// زرع ومقاعد على الممرات، وجزيرة الدوار بنافورتها وعمودها المضيء.
// كل الأشكال حتمية من hsh (نفس الخريطة ← نفس الرسم دائماً)، والألوان الثابتة شفافة فتتبع الطقس.
import { CITIES } from '../config.js';
import { THEMES, TAU, poly, circ, ln, rc, el, box, glow, hsh, getCtx, paint } from './cityThemes.js';

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

// زينة الممر (حتمية): عمود إنارة أو حوض زرع أو مقعد على أحد جانبيه، ولا شيء في أغلب المربعات.
// وبطابع المدينة في بعض الفارغ منها: طاولة مقهى بمظلة (باريس والأوروبية)، أو بسطة سوق (روتنبورغ)،
// أو بسطة بهارات وتمر (شبام)، أو كشك صحف (شيكاغو)
const LANE_LOCAL = { paris: 'terrace', europe: 'terrace', rothenburg: 'stall', shibam: 'souq', chicago: 'newsstand' };
export function laneDecor(map, i, j) {
  const h = hsh(i, j, 520);
  const kind = h < 0.3 ? 'lamp' : h < 0.5 ? 'planter' : h < 0.6 ? 'bench' : h < 0.72 ? LANE_LOCAL[map.city] || null : null;
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
  } else if (d.kind === 'bench') {
    box(px, py, 3.4, 1.7, 1.3, '#5e4634', '#76583f', '#8a6a4c');
    ln(px - 3.4, py - 3.6, px, py - 1.9, '#5e4634', 0.8);
  } else if (d.kind === 'terrace') terraceTable(px, py, i, j);
  else if (d.kind === 'souq') souqStall(px, py, i, j);
  else if (d.kind === 'newsstand') newsstand(px, py, i, j);
  else marketStall(px, py, i, j);
}

// بسطة سوق عربية (شبام): سلال بهارات وتمر تحت قماش ترابي مخطط بالأحمر
const SOUQ_GOODS = ['#c8462e', '#e8b83a', '#6f8a3a', '#5a2e1a'];
function souqStall(px, py, i, j) {
  const g = Math.floor(hsh(i, j, 525) * SOUQ_GOODS.length);
  el(px, py + 0.5, 4.2, 1.8, 'rgba(0,0,0,0.18)');
  box(px, py, 3.6, 1.8, 2, '#7a5a3a', '#8e6a46', '#a07a52');
  for (let k = 0; k < 3; k++) {
    const bx = px - 1.8 + k * 1.8, by = py - 2.1 + (k - 1) * 0.15;
    poly([[bx - 0.75, by], [bx, by - 1.2], [bx + 0.75, by]], SOUQ_GOODS[(g + k) % SOUQ_GOODS.length]);
  }
  ln(px - 3.4, py - 0.2, px - 3.4, py - 6.4, '#5a4030', 0.5);
  ln(px + 3.4, py - 0.2, px + 3.4, py - 6.4, '#5a4030', 0.5);
  poly([[px - 4.2, py - 6.6], [px + 4.2, py - 6.6], [px + 3.4, py - 8.2], [px - 3.4, py - 8.2]], '#d6c08a');
  for (const o of [-1.8, 0, 1.8]) ln(px + o - 0.4, py - 6.6, px + o * 0.8, py - 8.2, '#a8322a', 0.6);
}

// كشك صحف بطراز الثلاثينيات (شيكاغو): صندوق أخضر بمجلات ملونة ولافتة بيضاء
const MAGS = ['#c8322a', '#e8c23a', '#2f6aa8', '#f2ede0'];
function newsstand(px, py, i, j) {
  el(px, py + 0.5, 3.8, 1.7, 'rgba(0,0,0,0.18)');
  box(px, py, 3.2, 1.6, 5.2, '#2f4a3a', '#3a5a46', '#2a3a30');
  for (let k = 0; k < 4; k++) rc(px + 0.4 + k * 0.65, py - 3.8 + 1.6 - k * 0.33, 0.5, 1.5, MAGS[(k + Math.floor(hsh(i, j, 526) * 4)) % 4]);
  poly([[px - 3.8, py - 5.2], [px, py - 7.3], [px + 3.8, py - 5.2], [px, py - 3.1]], '#26382e');
  rc(px - 2.4, py - 8.6, 4.8, 1.3, '#f2ede0');
  ln(px - 1.6, py - 8, px + 1.6, py - 8, '#2a2a2e', 0.4);
}

// طاولة مقهى باريسي مستديرة بكرسيين من الخيزران ومظلة حمراء أو خضراء
const TERRACE = [['#a3302a', '#efe6d2'], ['#2f5a46', '#efe6d2']];
function terraceTable(px, py, i, j) {
  const c = TERRACE[hsh(i, j, 523) < 0.5 ? 0 : 1];
  el(px, py + 0.5, 3.6, 1.6, 'rgba(0,0,0,0.18)');
  for (const s of [-1, 1]) {
    ln(px + s * 2.6, py + 0.4, px + s * 2.6, py - 1.4, '#6a4a2a', 0.5);
    el(px + s * 2.6, py - 1.5, 1, 0.5, '#a8743a');
    ln(px + s * 3.2, py - 1.4, px + s * 3.2, py - 3.2, '#a8743a', 0.6);
  }
  ln(px, py, px, py - 2.4, '#2b2825', 0.5);
  el(px, py - 2.6, 1.8, 0.85, '#3a3a3e');
  ln(px, py - 2.6, px, py - 8.4, '#5a4a3a', 0.5);
  for (let k = 0; k < 6; k++) {
    const a0 = k / 6 * TAU, a1 = (k + 1) / 6 * TAU;
    poly([[px, py - 10.4], [px + Math.cos(a0) * 4.4, py - 8.2 + Math.sin(a0) * 2.1], [px + Math.cos(a1) * 4.4, py - 8.2 + Math.sin(a1) * 2.1]], c[k % 2]);
  }
}

// بسطة سوق ألمانية: طاولة خشبية بالفاكهة والخضار، وعمودان، ومظلة مخططة بالأحمر والأبيض
const STALL_GOODS = ['#d9463b', '#e8a33a', '#6fa04a', '#c86a9a'];
function marketStall(px, py, i, j) {
  const g = Math.floor(hsh(i, j, 524) * STALL_GOODS.length);
  el(px, py + 0.5, 4.2, 1.8, 'rgba(0,0,0,0.18)');
  box(px, py, 3.6, 1.8, 2.4, '#7a5a3a', '#8e6a46', '#a07a52');
  for (let k = 0; k < 3; k++) circ(px - 1.8 + k * 1.8, py - 2.9 + (k - 1) * 0.15, 0.6, STALL_GOODS[(g + k) % STALL_GOODS.length]);
  ln(px - 3.4, py - 0.2, px - 3.4, py - 6.6, '#5a4030', 0.5);
  ln(px + 3.4, py - 0.2, px + 3.4, py - 6.6, '#5a4030', 0.5);
  for (let k = 0; k < 4; k++) {
    const u0 = -3.9 + k * 1.95, u1 = u0 + 1.95;
    poly([[px + u0, py - 6.9], [px + u1, py - 6.9], [px + u1, py - 5.3], [px + u0, py - 5.3]], k % 2 ? '#f2ede0' : '#c8322a');
  }
  poly([[px - 3.9, py - 6.9], [px + 3.9, py - 6.9], [px + 3.1, py - 8.4], [px - 3.1, py - 8.4]], '#a82a24');
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
  const [px, py] = at(x, y, t.a, t.b);
  if (THEMES[map.city] && THEMES[map.city].draw.tree === 'palm') { streetPalm(px, py, i, j); return; }
  const c = TREE[map.city] || TREE.europe;
  el(px, py + 0.6, 4.2, 1.8, 'rgba(0,0,0,0.22)');
  rc(px - 0.8, py - 7, 1.6, 7, c[0]);
  circ(px, py - 10.5, 4.6, c[1]); circ(px - 2, py - 12, 3.2, c[2]); circ(px + 2.2, py - 9.6, 2.6, c[1]);
}

// نخلة صغيرة على رصيف مدن النخيل (شبام): كنخيل المدينة نفسه بثلثي حجمه
export function streetPalm(px, py, i, j) {
  const o = ((i * 3 + j) % 3) - 1, c = getCtx();
  el(px, py + 0.6, 3.6, 1.5, 'rgba(0,0,0,0.22)');
  c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + o * 2, py - 8, px + o * 1.3, py - 14.5);
  c.strokeStyle = '#8a6a45'; c.lineWidth = 1.3; c.lineCap = 'round'; c.stroke();
  const tx = px + o * 1.3, ty = py - 14.5;
  for (let k = 0; k < 7; k++) {
    const a = k * 0.9 + 0.2, dx = Math.cos(a) * 6, dy = Math.sin(a) * 2.3 + 1.3;
    poly([[tx, ty], [tx + dx, ty + dy], [tx + dx * 0.55, ty + dy - 1.1]], k % 2 ? '#5f8a3a' : '#4d7a30');
  }
}

// إضاءة الليل لأعمدة الممرات (تجمعها chunkCache مع الإضاءات الثابتة)
export function laneLight(map, i, j, x, y) {
  const d = laneDecor(map, i, j);
  if (!d || d.kind !== 'lamp') return null;
  const [px, py] = at(x, y, d.a, d.b);
  return { x: px, y: py - 15, r: 24, c: map.city === 'hk' ? '127,232,255' : '255,220,150', a: 0.5 };
}

// جزيرة الدوار بطابع المدينة: مسلة بين نافورتين (باريس)، ونافورة السوق بعمودها وتمثالها (روتنبورغ)،
// وإلا حافة حجرية وعشب وزهور ونافورة وفي وسطها عمود بخطوط نيون (هونغ كونغ)
export function drawRoundaboutIsland(x, y, city) {
  if (city === 'paris') { parisIsland(x, y - 9); return; }
  if (city === 'rothenburg') { rothenburgIsland(x, y - 9); return; }
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

// نافورة صغيرة: حوض مستدير بماء، وعمود بصحن علوي، ورذاذ يسقط في الحوض
function fountain(cx, cy, r) {
  el(cx, cy + 1, r, r * 0.5, '#8e8a84');
  el(cx, cy, r, r * 0.5, '#d2cdc3');
  el(cx, cy - 0.2, r * 0.82, r * 0.4, '#3f7fa8');
  el(cx - r * 0.3, cy - 0.7, r * 0.3, r * 0.11, 'rgba(255,255,255,0.35)');
  box(cx, cy, 0.9, 0.45, 5, '#9a958c', '#b4afa6');
  el(cx, cy - 5, 2.4, 1.1, '#bdb8af');
  el(cx, cy - 5.2, 1.8, 0.75, '#5f9cc4');
  const c = getCtx();
  c.save(); c.globalAlpha = 0.55; c.beginPath();
  for (const s of [-1, 1]) { c.moveTo(cx + s * 1.6, cy - 5.4); c.quadraticCurveTo(cx + s * 3.6, cy - 7, cx + s * r * 0.62, cy - 0.6); }
  c.moveTo(cx, cy - 5.2); c.lineTo(cx, cy - 8.4);
  c.strokeStyle = paint('#bfe6ff'); c.lineWidth = 0.7; c.stroke();
  c.restore();
}

// عمود إنارة حديدي بفانوس (حول جزيرتي باريس وروتنبورغ)
function islandLamp(px, py, col) {
  ln(px, py, px, py - 12, '#2b2825', 0.9);
  poly([[px - 1.6, py - 12], [px, py - 15], [px + 1.6, py - 12], [px, py - 11.2]], '#2b2825');
  rc(px - 0.8, py - 13.6, 1.6, 1.5, col);
}

// باريس (ساحة الكونكورد): ساحة حجرية فاتحة بخطوط رصف، ومسلة حجرية وردية بقمة ذهبية على قاعدة،
// ونافورتان عن يمينها ويسارها، وأعمدة إنارة على الحافة
const PARIS_LAMPS = [-0.62, -2.52, 0.3, Math.PI - 0.3];
function parisIsland(cx, cy) {
  el(cx, cy + 1.4, 25.5, 12.8, '#7e7a74');
  el(cx, cy, 25.5, 12.8, '#cfc6b4');
  const c = getCtx();
  c.beginPath();
  c.ellipse(cx, cy, 19, 9.5, 0, 0, TAU);
  c.moveTo(cx + 11, cy); c.ellipse(cx, cy, 11, 5.5, 0, 0, TAU);
  c.strokeStyle = paint('rgba(0,0,0,0.12)'); c.lineWidth = 0.6; c.stroke();
  const lampAt = (an) => [cx + Math.cos(an) * 22.5, cy + Math.sin(an) * 11.2];
  for (const an of PARIS_LAMPS) if (Math.sin(an) < 0) islandLamp(...lampAt(an), '#f2d58a');
  fountain(cx - 13, cy + 0.5, 6.2);
  fountain(cx + 13, cy + 0.5, 6.2);
  // القاعدة ثم جسم المسلة (يضيق للأعلى) بنقوش صغيرة، والقمة الهرمية الذهبية
  box(cx, cy, 3.4, 1.7, 2.2, '#8a8478', '#a29c90', '#b4aea2');
  box(cx, cy - 2.2, 2.4, 1.2, 3.6, '#9a8e80', '#b0a494', '#c2b6a6');
  const y0 = cy - 5.8, H = 26, w0 = 1.9, d0 = 0.95, w1 = 1.1, d1 = 0.55;
  poly([[cx - w0, y0], [cx, y0 + d0], [cx, y0 + d1 - H], [cx - w1, y0 - H]], '#b08a78');
  poly([[cx, y0 + d0], [cx + w0, y0], [cx + w1, y0 - H], [cx, y0 + d1 - H]], '#c9a690');
  for (let k = 0; k < 5; k++) {
    const t = 0.15 + k * 0.16, yy = y0 - H * t, ww = w0 + (w1 - w0) * t;
    ln(cx + ww * 0.35, yy - 0.2, cx + ww * 0.7, yy - 0.5, 'rgba(70,40,30,0.45)', 0.4);
    ln(cx - ww * 0.65, yy - 0.5, cx - ww * 0.3, yy - 0.2, 'rgba(60,35,25,0.4)', 0.4);
  }
  const top = y0 - H, apex = top - 3.6;
  poly([[cx - w1, top], [cx, top + d1], [cx, apex]], '#c9a040');
  poly([[cx, top + d1], [cx + w1, top], [cx, apex]], '#f0cf6a');
  for (const an of PARIS_LAMPS) if (Math.sin(an) >= 0) islandLamp(...lampAt(an), '#f2d58a');
}

// روتنبورغ (ساحة السوق): رصف حجري بحلقات، وأحواض زهور حمراء، وحوض نافورة مثمن من الحجر
// في وسطه عمود بتاج يقف عليه تمثال الفارس برمحه ودرعه، وماء يتدفق من العمود
const ROTH_BEDS = [0.42, Math.PI - 0.42, -0.5, -Math.PI + 0.5];
function rothenburgIsland(cx, cy) {
  el(cx, cy + 1.4, 25.5, 12.8, '#6f6a62');
  el(cx, cy, 25.5, 12.8, '#a19b8e');
  const c = getCtx();
  c.beginPath();
  for (const r of [21.5, 16.5, 12.5]) { c.moveTo(cx + r, cy); c.ellipse(cx, cy, r, r * 0.5, 0, 0, TAU); }
  c.setLineDash([1.4, 1.2]);
  c.strokeStyle = paint('rgba(0,0,0,0.16)'); c.lineWidth = 0.6; c.stroke();
  c.setLineDash([]);
  const bedAt = (an) => [cx + Math.cos(an) * 19.5, cy + Math.sin(an) * 9.6];
  const bed = (an) => {
    const [bx, by] = bedAt(an);
    el(bx, by + 0.6, 4.2, 2, '#6a5a48');
    el(bx, by, 4.2, 2, '#4a6e3a');
    for (let k = 0; k < 5; k++) circ(bx - 2.6 + k * 1.3, by - 0.4 + (k % 2) * 0.7, 0.7, k % 2 ? '#e85a7a' : '#c8322a');
  };
  for (const an of ROTH_BEDS) if (Math.sin(an) < 0) bed(an);
  islandLamp(cx - 13, cy - 6, '#f2d58a');
  islandLamp(cx + 13, cy - 6, '#f2d58a');
  // الحوض المثمن: جداره ثم حافته ثم الماء
  const oct = (r, dy) => Array.from({ length: 8 }, (_, k) => {
    const an = (k + 0.5) / 8 * TAU;
    return [cx + Math.cos(an) * r, cy + dy + Math.sin(an) * r * 0.5];
  });
  poly(oct(11, 2.2), '#7a7062');
  poly(oct(11, 0), '#bfb39a');
  poly(oct(9.4, -0.1), '#3f7fa8');
  el(cx - 3.6, cy - 1.4, 2.6, 0.9, 'rgba(255,255,255,0.3)');
  // العمود بقاعدته وتاجه، وفوقه التمثال
  box(cx, cy, 2, 1, 2.4, '#9a8a70', '#b4a486', '#c4b598');
  box(cx, cy - 2.4, 1.1, 0.55, 11, '#a8987c', '#c0b194');
  box(cx, cy - 13.4, 1.9, 0.95, 1.2, '#9a8a70', '#b4a486', '#c4b598');
  const sy = cy - 14.6;
  rc(cx - 0.9, sy - 5, 1.8, 5, '#5f6e76');
  circ(cx, sy - 5.8, 0.95, '#6f7e86');
  el(cx - 1.3, sy - 3, 0.8, 1.3, '#c8322a');
  ln(cx + 1.3, sy, cx + 1.3, sy - 8.4, '#3a3a3e', 0.45);
  c.save(); c.globalAlpha = 0.55; c.beginPath();
  for (const s of [-1, 1]) { c.moveTo(cx + s * 0.9, cy - 9); c.quadraticCurveTo(cx + s * 4, cy - 10, cx + s * 6, cy - 0.8); }
  c.strokeStyle = paint('#bfe6ff'); c.lineWidth = 0.7; c.stroke();
  c.restore();
  for (const an of ROTH_BEDS) if (Math.sin(an) >= 0) bed(an);
}

// إضاءة الدوار ليلاً: وهج العمود المضيء (هونغ كونغ)، أو فوانيس الجزيرة وقمة المسلة (باريس) ونافورة السوق (روتنبورغ)
export function roundaboutLights(x, y, city) {
  const cy = y - 9;
  if (city === 'paris') {
    const lamps = PARIS_LAMPS.map(an => ({ x: x + Math.cos(an) * 22.5, y: cy + Math.sin(an) * 11.2 - 13, r: 22, c: '255,220,150', a: 0.45 }));
    return [...lamps, { x, y: cy - 34, r: 16, c: '255,215,120', a: 0.3 }];
  }
  if (city === 'rothenburg') {
    return [{ x: x - 13, y: cy - 19, r: 22, c: '255,220,150', a: 0.45 }, { x: x + 13, y: cy - 19, r: 22, c: '255,220,150', a: 0.45 },
            { x, y: cy - 4, r: 26, c: '255,205,140', a: 0.25 }];
  }
  return [{ x, y: y - 39, r: 46, c: '255,110,190', a: 0.45 }, { x, y: y - 12, r: 34, c: '120,220,255', a: 0.3 }];
}
