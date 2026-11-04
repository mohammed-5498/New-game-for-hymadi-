// مزايا المدن (القسم 3.11): ما يُرسم منها
// - المبنى المميز في الطبقة الثابتة (landmarks.js بالحرف F): بطلب المستخدم أكبر وأفخم، على كتلة 2×2 وسط ساحته،
//   ومرسوم كله من مربعها الأمامي. معلم لا يُصبغ بلون مالكه: مالكه من حلقة شارته وأرض حيه
// - ساحته المرصوفة (fplaza): بلاط في طبقة الأرض، وزينة على أركانها (مسلات، فوانيس، مشاعل)
// - هالته الملونة تنبض حوله ونجوم صغيرة تدور عليها، مع الوحدات فيختفي ما خلف المبنى منها (renderer.js)
// - شارة فوق كل مبنى مميز وفوق علم كل قرية ينتظر أهلها، كشارات مباني الاقتصاد (empireArt.js)
// - غبار العاصفة الرملية فوق المشهد كله
// - دوائر الألعاب النارية على الأرض قبل انفجارها، وانفجاراتها في السماء
import { TILE_HALF_W, TILE_HALF_H, TICK_SEC, EMPIRE as E, CITY_FEATURES as F } from '../config.js';
import { poly, ln, circ, el, rc, box, cyl, cone, dome, arch, ridgeRoof, hipRoof, qL, qR, wL, wR, hsh, getCtx, getTone, getToneInfo, setTone } from './cityThemes.js';
import { streetPalm } from './openCity.js';
import { frustum, fL, fR } from './empireBuildings.js';
import { tileOf } from '../game/empire.js';
import { stormAt, villageWaiting } from '../game/features.js';

const TAU = 6.2831853;
const worldOf = (i, j) => ({ x: (i - j) * TILE_HALF_W, y: (i + j) * TILE_HALF_H });
const SMALL = 0.55;          // المبنى في حي ضيق (مربع واحد): نفس الرسم مصغّراً

// --- المبنى المميز في الطبقة الثابتة ---
// (x, y) مركز مربع F؛ والكتلة الكبيرة وسطها فوقه بنصف مربعين (−9 على الشاشة)
export function drawFeatureBuilding(feature, x, y, i, j, big) {
  const draw = BUILDINGS[feature];
  if (!draw) return;
  const saved = getTone(), savedInfo = getToneInfo();
  setTone(null);
  if (big) draw(x, y - TILE_HALF_H, i, j);
  else {
    const ctx = getCtx();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(SMALL, SMALL);
    draw(0, 0, i, j);
    ctx.restore();
  }
  setTone(saved, savedInfo);
}

// نقطة على وجه مثلثي: من القاعدة بين P وQ بنسبة u، ثم نحو القمة A بنسبة t
const onFace = (P, Q, A, u, t) => {
  const bx = P[0] + (Q[0] - P[0]) * u, by = P[1] + (Q[1] - P[1]) * u;
  return [bx + (A[0] - bx) * t, by + (A[1] - by) * t];
};

// --- تفاصيل 12د (القسم 3.13): أدوات صغيرة مشتركة لما يُضاف حول المباني المميزة وعليها ---
// البروز عن الوجه الأيمن (نحو +i) والأيسر (نحو +j) على الشاشة
const OUT_R = [1, 0.5], OUT_L = [-1, 0.5];
const outP = (p, o, k) => [p[0] + o[0] * k, p[1] + o[1] * k];
const WOODS = ['#6b4a2e', '#8a6440', '#9c7450'];
function crate(px, py, s, c = WOODS) {
  box(px, py, s, s / 2, s, c[0], c[1], c[2]);
  const r = qR(px, py, s, s / 2), a = r(0.1, 0.15 * s), b = r(0.9, 0.85 * s), e = r(0.1, 0.85 * s), f = r(0.9, 0.15 * s);
  ln(a[0], a[1], b[0], b[1], 'rgba(40,25,10,0.45)', 0.35);
  ln(e[0], e[1], f[0], f[1], 'rgba(40,25,10,0.45)', 0.35);
}
function barrel(px, py, r, h, c = ['#6b4a2e', '#8a6440', '#7a5636']) {
  cyl(px, py, r, h, c[0], c[1], c[2]);
  const ctx = getCtx();
  ctx.beginPath();
  for (const v of [h * 0.22, h * 0.78]) { ctx.moveTo(px + r, py - v); ctx.ellipse(px, py - v, r, r * 0.5, 0, 0, Math.PI); }
  ctx.strokeStyle = 'rgba(30,20,10,0.55)';
  ctx.lineWidth = 0.4;
  ctx.stroke();
}
function jar(px, py, r, c) {
  el(px, py - r, r, r * 1.1, c);
  el(px, py - r * 2.05, r * 0.55, r * 0.28, c);
  el(px - r * 0.35, py - r * 1.25, r * 0.25, r * 0.5, 'rgba(255,255,255,0.22)');
}
function torch(px, py, h) {
  ln(px, py, px, py - h, '#3a2a1c', 0.8);
  poly([[px - 1.2, py - h], [px, py - h - 3.6], [px + 1.2, py - h]], '#ff9a3c');
  poly([[px - 0.5, py - h - 0.3], [px, py - h - 2.2], [px + 0.5, py - h - 0.3]], '#ffe08a');
}
// خطوط كثيرة بمسار واحد: segs [[x1, y1, x2, y2], ...]
function lines(segs, color, w) {
  const c = getCtx();
  c.beginPath();
  for (const s of segs) { c.moveTo(s[0], s[1]); c.lineTo(s[2], s[3]); }
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.stroke();
}
// مداميك حجر على وجه q بعرض w وارتفاع h: صفوف كل rowH وفواصل متناوبة
function masonry(q, w, h, rowH, color, v0 = 0) {
  const segs = [], n = Math.max(2, Math.round(w / 4.5));
  for (let v = v0 + rowH, r = 0; v < h - 0.5; v += rowH, r++) {
    const a = q(0, v), b = q(1, v);
    segs.push([a[0], a[1], b[0], b[1]]);
    for (let k = (r % 2) * 0.5; k < n; k++) {
      const u = (k + 0.5) / n, p = q(u, v), t = q(u, Math.min(h, v + rowH));
      segs.push([p[0], p[1], t[0], t[1]]);
    }
  }
  lines(segs, color, 0.35);
}

// بئر القرية في ساحة علمها (شبام، 12د): حافة حجرية وقائمان وبكرة ودلو، وجرار ماء وكيسا حبوب وحوض للماشية
export function villageWell(x, y) {
  const wx = x - 8, wy = y - 1.2;
  cyl(wx, wy, 2.6, 2.4, '#8a6a4a', '#a8865e', '#3a5a6a');
  el(wx, wy - 2.4, 1.6, 0.8, '#2a4050');
  lines([[wx - 2.2, wy - 2, wx - 2.2, wy - 8], [wx + 2.2, wy - 2, wx + 2.2, wy - 8], [wx - 2.6, wy - 8, wx + 2.6, wy - 8]], '#5a3e26', 0.8);
  circ(wx, wy - 8, 0.9, '#6b4a2e');
  ln(wx, wy - 7.2, wx, wy - 4.6, '#3a2a1c', 0.3);
  box(wx, wy - 3.6, 0.7, 0.35, 1, '#5a3e26', '#6b4a2e', '#7a5636');
  for (const [px, py, c] of [[x + 7.6, y - 2.2, '#a8643a'], [x + 9.6, y - 1, '#b8774a']]) jar(px, py, 1.3, c);
  for (const [px, py] of [[x - 4, y + 4.4], [x - 2, y + 5.4]]) { el(px, py - 1.1, 1.3, 1.2, '#d8c49a'); ln(px - 0.6, py - 2.2, px + 0.6, py - 2.2, '#8a6a4a', 0.4); }
  box(x + 6.4, y + 3.2, 3, 1.5, 1.2, '#8a6a4a', '#a8865e', '#6f9aae');
}

// --- الهرم (القاهرة): منصة حجرية، ومداميك، وحجارة ناقصة، ومدخل بعمودين، وقمة ذهبية لامعة ---
function pyramid(x, y, i, j) {
  el(x, y + 6, 38, 17, 'rgba(60,40,20,0.22)');
  box(x, y + 2, 35, 17.5, 3, '#a88b5c', '#c4a571', '#d3b582');
  const by = y - 1, w = 32, d = 16, h = 60;
  const L = [x - w, by], Fr = [x, by + d], R = [x + w, by], A = [x, by - h];
  poly([L, Fr, A], '#ae8d58');
  poly([Fr, R, A], '#dbbb7e');
  for (let k = 1; k < 13; k++) {
    const t = k / 13;
    const a = onFace(L, Fr, A, 0, t), b = onFace(L, Fr, A, 1, t), c = onFace(Fr, R, A, 1, t);
    ln(a[0], a[1], b[0], b[1], 'rgba(70,48,24,0.32)', 0.55);
    ln(b[0], b[1], c[0], c[1], 'rgba(96,66,32,0.28)', 0.55);
  }
  ln(Fr[0], Fr[1], A[0], A[1], 'rgba(255,240,205,0.5)', 0.9);     // الحافة الأمامية مضاءة
  for (let k = 0; k < 6; k++) {                                     // حجارة ناقصة، مواضعها ثابتة لكل خريطة
    const t = 0.12 + hsh(i, j, 860 + k) * 0.6, u = 0.12 + hsh(i, j, 870 + k) * 0.76, right = k % 2 === 0;
    const m = right ? onFace(Fr, R, A, u, t) : onFace(L, Fr, A, u, t), s = 1.8 * (1 - t);
    poly([[m[0] - s, m[1]], [m[0] + s, m[1] + (right ? -s / 2 : s / 2)], [m[0] + s, m[1] - 2 * s + (right ? -s / 2 : s / 2)],
          [m[0] - s, m[1] - 2 * s]], right ? '#b39261' : '#8c6f43');
  }
  // المدخل على الواجهة اليمنى: عمودان وعتبة وظلمة الممر
  const door = [onFace(Fr, R, A, 0.4, 0), onFace(Fr, R, A, 0.52, 0), onFace(Fr, R, A, 0.52, 0.13), onFace(Fr, R, A, 0.4, 0.13)];
  poly(door, '#2f2214');
  for (const u of [0.36, 0.56]) {
    const p = onFace(Fr, R, A, u, 0), q = onFace(Fr, R, A, u, 0.17);
    ln(p[0], p[1], q[0], q[1], '#efdcaa', 2.2);
  }
  const l0 = onFace(Fr, R, A, 0.34, 0.17), l1 = onFace(Fr, R, A, 0.58, 0.17);
  ln(l0[0], l0[1], l1[0], l1[1], '#f4e2b2', 1.6);
  // القمة الذهبية ولمعتها
  const cL = onFace(L, Fr, A, 0, 0.84), cF = onFace(L, Fr, A, 1, 0.84), cR = onFace(Fr, R, A, 1, 0.84);
  poly([cL, cF, A], '#c99a2c');
  poly([cF, cR, A], '#f6d362');
  ln(cF[0], cF[1], A[0], A[1], '#fff3c4', 0.9);
  // 12د: كسوة الحجر الجيري الملساء تحت القمة، ونقوش بجانب المدخل، ودرج إليه، وكثبان رمل وأبو الهول صغير على المنصة
  const kL = onFace(L, Fr, A, 0, 0.7), kF = onFace(L, Fr, A, 1, 0.7), kR = onFace(Fr, R, A, 1, 0.7);
  poly([kL, kF, cF, cL], '#c4a873');
  poly([kF, kR, cR, cF], '#ecd8a8');
  ln(kF[0], kF[1], cF[0], cF[1], 'rgba(255,245,215,0.7)', 0.9);
  ln(kL[0], kL[1], kF[0], kF[1], 'rgba(90,64,30,0.35)', 0.5);
  ln(kF[0], kF[1], kR[0], kR[1], 'rgba(120,86,40,0.3)', 0.5);
  const glyphs = [];
  for (const u0 of [0.24, 0.6]) for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
    const p = onFace(Fr, R, A, u0 + k * 0.035, 0.03 + r * 0.035);
    glyphs.push(k % 2 ? [p[0], p[1] - 1.1, p[0], p[1] + 0.2] : [p[0] - 0.5, p[1] - 0.4, p[0] + 0.6, p[1] - 0.9]);
  }
  lines(glyphs, 'rgba(70,45,20,0.6)', 0.45);
  for (let k = 0; k < 3; k++) {                                     // درج المدخل نحو المنصة
    const p = outP(onFace(Fr, R, A, 0.46, 0), OUT_R, 1.6 + k * 1.6);
    box(p[0], p[1] + k * 0.5, 3.6 - k * 0.2, 1.8 - k * 0.1, 1.4 - k * 0.35, '#b39261', '#d8bc86', '#e6cc98');
  }
  for (const [px, py, rx] of [[x - 22, y + 7.5, 7], [x + 2, y + 16.5, 9], [x + 24, y + 6.5, 6]]) {
    el(px, py, rx, rx * 0.3, '#d9bd86');
    el(px - rx * 0.2, py - rx * 0.08, rx * 0.6, rx * 0.17, '#e9d3a4');
  }
  const sx = x - 15, sy = y + 9;                                    // أبو الهول: جسد رابض ورأس بغطاء مخطط
  box(sx, sy, 3.2, 1.6, 2.2, '#a8865a', '#c9a874', '#d6b886');
  box(sx + 2.2, sy + 1.1, 1.3, 0.65, 4.4, '#a8865a', '#c9a874', '#d6b886');
  poly([[sx + 0.6, sy - 3.4], [sx + 2.2, sy - 5.6], [sx + 3.8, sy - 2.6], [sx + 3.5, sy - 1.6], [sx + 0.9, sy - 2.6]], '#d6b886');
  ln(sx + 1.3, sy - 3.9, sx + 3.4, sy - 2.4, '#3f6aa0', 0.6);
  ln(sx + 1, sy - 3.1, sx + 3.2, sy - 1.8, '#3f6aa0', 0.5);
  circ(sx + 2.4, sy - 3.4, 0.35, '#3a2a18');
}

// --- دوجو الساموراي (إيدو): منصة بدرجات، وقاعة خشب داكن بألواح بيضاء وأعمدة حمراء، وسقفان مقعّران
// بحافة ذهبية وزعانف ذهبية، ولوحة اسم، ورايتان طويلتان بشعار دائري ---
function dojo(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(30,20,15,0.22)');
  box(x, y + 2, 33, 16.5, 5, '#77736b', '#96918a', '#a8a39a');
  box(x + 9, y + 9.5, 7, 3.5, 2.5, '#77736b', '#96918a', '#a8a39a');              // درجات المدخل
  const by = y - 3, w = 25, d = 12.5, h = 15;
  box(x, by, w + 3, (w + 3) / 2, 1.3, '#4e3322', '#6b4a32', '#80593c');          // 12د: شرفة خشبية (إنغاوا) حول القاعة
  box(x, by, w, d, h, '#4a2e22', '#5e3b2a');
  for (let k = 0; k < 4; k++) {
    wR(x, by, w, d, 0.06 + k * 0.235, 2.5, 0.18, 9.5, '#f0e7cf');
    wL(x, by, w, d, 0.06 + k * 0.235, 2.5, 0.18, 9.5, '#d9cdb2');
  }
  const qr = qR(x, by, w, d), ql = qL(x, by, w, d);
  for (let k = 0; k <= 4; k++) {                                     // أعمدة حمراء بين الألواح
    const u = 0.03 + k * 0.235;
    const a = qr(u, 0), b = qr(u, h), c = ql(u, 0), e = ql(u, h);
    ln(a[0], a[1], b[0], b[1], '#b3362b', 1.5);
    ln(c[0], c[1], e[0], e[1], '#8f2a22', 1.5);
  }
  for (let k = 0; k < 4; k++) {                                      // شبكة الألواح
    const v = 2.5 + 2.4 * (k + 1);
    const a = qr(0.06, v), b = qr(0.95, v);
    ln(a[0], a[1], b[0], b[1], 'rgba(60,40,30,0.35)', 0.4);
  }
  const s0 = qr(0.3, h - 2.2), s1 = qr(0.7, h - 2.2);                // لوحة الاسم فوق المدخل
  poly([[s0[0], s0[1]], [s1[0], s1[1]], [s1[0], s1[1] - 3.2], [s0[0], s0[1] - 3.2]], '#2a1a12');
  ln(s0[0], s0[1] - 1.6, s1[0], s1[1] - 1.6, '#d9b24a', 0.9);
  const roof = { ov: 7, sag: 2.6, flare: 3.4, front: '#3a3f4b', front2: '#2e333e', end: '#353a45', end2: '#2b2f39',
                 back: '#23262e', tile: 'rgba(0,0,0,0.28)', ridge: '#c9a046', ridgeW: 1.8 };
  ridgeRoof(x, by, w, d, h, 13, roof);
  const ty = by - h - 6;
  box(x, ty, 11, 5.5, 7, '#4a2e22', '#5e3b2a');
  wR(x, ty, 11, 5.5, 0.15, 1.6, 0.7, 4, '#f0e7cf');
  const top = ridgeRoof(x, ty, 11, 5.5, 7, 8, { ...roof, ov: 4.5, sag: 1.6, flare: 2.6, ridge: '#d6b252', ridgeW: 1.6 });
  for (const P of [top.P1, top.P2]) poly([[P[0], P[1]], [P[0] - 1.2, P[1] - 4], [P[0] + 1.2, P[1] - 3.2]], '#e2bd4f');   // زعانف ذهبية
  for (const [px, py] of [[x - 31, y + 2], [x + 31, y + 2]]) {        // رايتان بشعار دائري
    ln(px, py, px, py - 40, '#2b2420', 1.1);
    poly([[px, py - 38], [px + (px < x ? -6 : 6), py - 38], [px + (px < x ? -6 : 6), py - 18], [px, py - 18]], '#b3262f');
    circ(px + (px < x ? -3 : 3), py - 29, 2.2, '#f3ead8');
    circ(px + (px < x ? -3 : 3), py - 29, 1.1, '#b3262f');
  }
  // 12د: ستارة نورن فوق المدخل، وحامل سيوف خشبية، وطبل تايكو، وشجرة بونساي في أصيص
  poly([qr(0.3, h - 2.6), qr(0.47, h - 2.6), qr(0.47, h - 6.4), qr(0.385, h - 7), qr(0.3, h - 6.4)], '#243a5e');
  { const p = qr(0.385, h - 4.4); circ(p[0], p[1], 1.1, '#f3ead8'); }
  const rx = x + 17, ry = y + 4.5;
  ln(rx - 2.6, ry + 1.3, rx - 2.6, ry - 4.6, WOODS[0], 0.9); ln(rx + 2.6, ry - 1.3, rx + 2.6, ry - 7.2, WOODS[0], 0.9);
  ln(rx - 3, ry - 3.6, rx + 3, ry - 6.6, WOODS[1], 1);
  lines([0, 1, 2].map(k => [rx - 1.8 + k * 1.8, ry + 0.6 - k * 0.9, rx - 1 + k * 1.8, ry - 7.4 - k * 0.9]), '#c9a46a', 0.8);
  const kx = x - 9, ky = y + 8;
  ln(kx - 2, ky + 0.6, kx - 1, ky - 2.4, WOODS[0], 0.8); ln(kx + 2, ky + 0.6, kx + 1, ky - 2.4, WOODS[0], 0.8);
  el(kx, ky - 4.4, 3, 2.6, '#8a2a1e');
  el(kx + 0.9, ky - 4.4, 1.6, 2.4, '#e8dcc0');
  lines([[kx - 2.2, ky - 6, kx - 2.2, ky - 2.8], [kx + 0.4, ky - 6.7, kx + 0.4, ky - 2.1]], '#d4af4f', 0.4);
  const bx = x - 26, bb = y + 2;
  box(bx, bb, 2.6, 1.3, 2, '#4a5a6a', '#5f7080', '#6e7f8e');
  ln(bx, bb - 2, bx - 1, bb - 6, '#5a3a22', 1); ln(bx - 1, bb - 6, bx + 2, bb - 8, '#5a3a22', 0.8);
  el(bx - 2.2, bb - 6.4, 3, 1.3, '#3f6a3a'); el(bx + 2, bb - 8.4, 2.6, 1.1, '#4f7a44'); el(bx - 0.4, bb - 9.8, 2, 0.9, '#5e8a50');
}

// --- دار العلاج (كايفنغ): مصطبة حجرية، وقاعة حمراء بنوافذ مشبكة، وسقف أخضر مزجج بأطراف مرفوعة
// وحافة ذهبية، وقرعة الدواء الذهبية معلقة، وفوانيس حمراء، ورفوف أعشاب ---
function clinic(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(30,20,15,0.22)');
  box(x, y + 2, 33, 16.5, 4, '#8b867c', '#a8a298', '#b8b2a8');
  const by = y - 2, w = 24, d = 12, h = 14;
  box(x, by, w, d, h, '#9d3127', '#bb4434');
  for (let k = 0; k < 3; k++) {                                      // نوافذ مشبكة
    wR(x, by, w, d, 0.1 + k * 0.3, 4, 0.2, 7, '#e2c27a');
    wL(x, by, w, d, 0.1 + k * 0.3, 4, 0.2, 7, '#c7a560');
  }
  const qr = qR(x, by, w, d), ql = qL(x, by, w, d);
  for (let k = 0; k < 3; k++) for (let r = 1; r < 4; r++) {
    const a = qr(0.1 + k * 0.3, 4 + r * 1.75), b = qr(0.3 + k * 0.3, 4 + r * 1.75);
    ln(a[0], a[1], b[0], b[1], 'rgba(90,40,20,0.55)', 0.4);
  }
  for (let k = 0; k <= 3; k++) {                                     // أعمدة حمراء داكنة
    const a = qr(0.05 + k * 0.3, 0), b = qr(0.05 + k * 0.3, h), c = ql(0.05 + k * 0.3, 0), e = ql(0.05 + k * 0.3, h);
    ln(a[0], a[1], b[0], b[1], '#6e1d18', 1.6);
    ln(c[0], c[1], e[0], e[1], '#5a1814', 1.6);
  }
  const roof = ridgeRoof(x, by, w, d, h, 12, { ov: 7, sag: 2.8, flare: 4, front: '#3f8f6a', front2: '#367d5c', end: '#327256', end2: '#2b6249',
                                  back: '#22503b', tile: 'rgba(10,40,25,0.35)', ridge: '#d1a33f', ridgeW: 1.8 });
  for (const P of [roof.P1, roof.P2]) {                              // 12د: تنينان ذهبيان على طرفي السنام
    poly([[P[0], P[1]], [P[0] - 1.4, P[1] - 4.2], [P[0] + 0.4, P[1] - 2.6], [P[0] + 1.6, P[1] - 4.6], [P[0] + 1.4, P[1] - 0.4]], '#e2bd4f');
    circ(P[0] - 1.3, P[1] - 4.4, 0.5, '#f6d878');
  }
  for (const u of [0.18, 0.82]) {                                    // فوانيس حمراء تحت الحافة
    const p = qr(u, h + 1);
    ln(p[0], p[1] + 3, p[0], p[1] - 1, '#3a2a20', 0.5);
    el(p[0], p[1] + 5, 2.1, 2.6, '#d8402e');
    ln(p[0] - 1.6, p[1] + 5, p[0] + 1.6, p[1] + 5, '#f2c14e', 0.5);
  }
  const g = qr(0.5, h + 1);                                          // قرعة الدواء
  ln(g[0], g[1] - 1, g[0], g[1] + 3, '#c0392b', 0.7);
  circ(g[0], g[1] + 5, 2.4, '#d9a83a');
  circ(g[0], g[1] + 9.2, 3.4, '#e7b84a');
  ln(g[0] - 2.2, g[1] + 6.8, g[0] + 2.2, g[1] + 6.8, '#c0392b', 0.8);
  for (const [px, py] of [[x - 27, y + 1], [x + 27, y + 1]]) {        // رفوف أعشاب على المصطبة
    box(px, py, 3.5, 1.8, 5, '#6b4a2e', '#7e5836', '#8a6440');
    for (let k = 0; k < 3; k++) circ(px - 2 + k * 2, py - 6 - (k % 2), 1.4, ['#5e9a4a', '#7cb35a', '#4f8a3e'][k]);
  }
  // 12د: لوحة رأسية بحروف ذهبية، وجرار دواء من الخزف، ومبخرة برونزية أمام القاعة يتصاعد دخانها
  poly([qr(0.315, 12.4), qr(0.385, 12.4), qr(0.385, 4.2), qr(0.315, 4.2)], '#2a1a12');
  lines([0, 1, 2].map(k => { const a = qr(0.335, 11 - k * 2.6), b = qr(0.365, 10.4 - k * 2.6); return [a[0], a[1], b[0], b[1]]; }), '#e2bd4f', 0.6);
  [['#3f6aa0', x - 18, y + 5], ['#e8e2d4', x - 15, y + 6.5], ['#7a4a2a', x - 12, y + 8]].forEach(([c, px, py]) => jar(px, py, 1.3, c));
  ln(x - 15.6, y + 3.6, x - 14.4, y + 3.6, '#3f6aa0', 0.5);
  const ix = x + 14, iy = y + 6;
  lines([[ix - 1.6, iy, ix - 1.2, iy - 1.6], [ix + 1.6, iy - 0.4, ix + 1.2, iy - 1.8], [ix, iy + 0.8, ix, iy - 1.2]], '#5a4a2a', 0.6);
  el(ix, iy - 2.6, 2.4, 1.6, '#8a6a2a');
  el(ix, iy - 3.6, 2.4, 0.9, '#b08a3a');
  lines([[ix - 1.8, iy - 3.6, ix - 2.4, iy - 5.2], [ix + 1.8, iy - 3.6, ix + 2.4, iy - 5.2]], '#8a6a2a', 0.5);
  const c = getCtx();                                                // الدخان: خطان متموجان شفافان
  c.beginPath();
  c.moveTo(ix - 0.4, iy - 4); c.bezierCurveTo(ix - 2, iy - 7, ix + 1.4, iy - 9, ix - 0.6, iy - 12.5);
  c.moveTo(ix + 0.6, iy - 4); c.bezierCurveTo(ix + 2, iy - 6.5, ix - 0.6, iy - 8.5, ix + 1, iy - 11);
  c.strokeStyle = 'rgba(235,235,230,0.45)'; c.lineWidth = 0.6; c.stroke();
}

// --- الحصن (غوندر): سور قاعدة، وبرج أسطواني خلفي أعلى، وقلعة مربعة بشُرَف ونوافذ مقوسة، وبرجان أماميان
// بقباب، وبوابة خشبية، وراية خضراء بحافة ذهبية ---
function roundTower(x, y, r, h) {
  cyl(x, y, r, h, '#76603f', '#a3845b');
  const segs = [];                                                   // 12د: مداميك وفتحتا رمي
  for (let v = 4; v < h - 2; v += 4) segs.push([x - r * 0.95, y - v + r * 0.12, x + r * 0.95, y - v + r * 0.12]);
  lines(segs, 'rgba(60,45,25,0.3)', 0.35);
  rc(x - 0.5, y + r * 0.5 - h * 0.62, 1, 3.2, '#2a2018');
  rc(x + r * 0.5, y + r * 0.35 - h * 0.38, 0.9, 3, '#2a2018');
  for (let k = 0; k < 6; k++) {                                      // شُرَف حول القمة
    const a = Math.PI * (0.08 + k * 0.17);
    box(x + Math.cos(a) * r * 0.92, y - h + Math.sin(a) * r * 0.46, 1, 0.5, 2.4, '#76603f', '#a3845b', '#8f7550');
  }
  dome(x, y - h - 1, r * 0.78, '#8c7350', '#6e583d', '#d4af4f');
}

function fortress(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(30,20,15,0.24)');
  box(x, y + 2, 33, 16.5, 6, '#6c583e', '#8a7152', '#7d6649');
  for (let k = 0; k < 8; k++) {                                      // شُرَف سور القاعدة
    const ql = qL(x, y + 2, 33, 16.5), qr = qR(x, y + 2, 33, 16.5);
    const a = ql(0.06 + k * 0.125, 6), b = qr(0.06 + k * 0.125, 6);
    box(a[0], a[1], 1.4, 0.7, 2, '#6c583e', '#8a7152', '#7d6649');
    box(b[0], b[1], 1.4, 0.7, 2, '#6c583e', '#8a7152', '#7d6649');
  }
  const by = y - 4;
  roundTower(x, by - 10, 7.5, 42);
  const back = [x + 3, by - 10 - 42 - 7];                            // راية على البرج الخلفي
  ln(back[0], back[1] + 4, back[0], back[1] - 12, '#2b2420', 0.9);
  poly([[back[0], back[1] - 12], [back[0] + 9, back[1] - 10], [back[0], back[1] - 7]], '#2e8b57');
  ln(back[0], back[1] - 12, back[0] + 9, back[1] - 10, '#d9b24a', 0.6);
  const w = 20, d = 10, h = 28;
  masonry(qL(x, y + 2, 33, 16.5), 33, 6, 2, 'rgba(50,38,22,0.3)');      // 12د: مداميك السور والقلعة
  masonry(qR(x, y + 2, 33, 16.5), 33, 6, 2, 'rgba(60,45,25,0.26)');
  box(x, by, w, d, h, '#7b6346', '#9c7d57', '#8b6f4d');
  const ql = qL(x, by, w, d), qr = qR(x, by, w, d);
  masonry(ql, w, h, 3.5, 'rgba(50,38,22,0.28)');
  masonry(qr, w, h, 3.5, 'rgba(60,45,25,0.24)');
  for (let k = 0; k < 6; k++) {                                      // شُرَف القلعة
    const a = ql(0.04 + k * 0.17, h), b = qr(0.04 + k * 0.17, h);
    box(a[0], a[1], 1.4, 0.7, 2.4, '#7b6346', '#9c7d57', '#8b6f4d');
    box(b[0], b[1], 1.4, 0.7, 2.4, '#7b6346', '#9c7d57', '#8b6f4d');
  }
  for (const v of [9, 18]) for (let k = 0; k < 3; k++) {            // نوافذ مقوسة
    arch((a, b) => qr(a, b + v), 0.14 + k * 0.28, 0.12, 5.5, '#2a2018');
    arch((a, b) => ql(a, b + v), 0.14 + k * 0.28, 0.12, 5.5, '#231a14');
  }
  arch(qr, 0.38, 0.24, 11, '#3a2616');                               // البوابة
  arch((a, b) => qr(a + 0.02, b), 0.38, 0.2, 9.6, '#6b4526');
  for (const u of [0.31, 0.69]) { const p = outP(qr(u, 6), OUT_R, 1); torch(p[0], p[1] + 2, 3); }   // 12د: مشعلا البوابة
  const b0 = ql(0.36, 16.6), b1 = ql(0.64, 16.6), o0 = outP(b0, OUT_L, 2.4), o1 = outP(b1, OUT_L, 2.4);   // شرفة خشبية
  poly([b0, b1, o1, o0], '#5a3e26');
  lines([[o0[0], o0[1], o0[0], o0[1] - 3], [o1[0], o1[1], o1[0], o1[1] - 3], [o0[0], o0[1] - 3, o1[0], o1[1] - 3],
         [(o0[0] + o1[0]) / 2, (o0[1] + o1[1]) / 2, (o0[0] + o1[0]) / 2, (o0[1] + o1[1]) / 2 - 3],
         [o0[0], o0[1] + 0.2, b0[0] + 0.4, b0[1] + 3], [o1[0], o1[1] + 0.2, b1[0] + 0.4, b1[1] + 3]], '#3e2a18', 0.6);
  roundTower(x - 22, by + 4, 6.5, 32);
  roundTower(x + 22, by + 4, 6.5, 32);
}

// --- برج الخرطوم (مروي): منصة حجرية، وبرج مستدق من الطوب بمداميك ونوافذ رمي ضيقة وبوابة مقوسة،
// وفي أعلاه شرفة رماة بشُرَف وقبة صغيرة ومشعلان وراية ---
function khartoum(x, y, i, j) {
  el(x, y + 6, 36, 16, 'rgba(40,25,10,0.24)');
  box(x, y + 2, 31, 15.5, 7, '#96764e', '#b8946a', '#c4a276');
  const by = y - 5, w0 = 15, d0 = 7.5, w1 = 10.5, d1 = 5.2, H = 66;
  const BL = [x - w0, by], BF = [x, by + d0], BR = [x + w0, by];
  const TL = [x - w1, by - H], TF = [x, by + d1 - H], TR = [x + w1, by - H];
  poly([BL, BF, TF, TL], '#a8794a');
  poly([BF, BR, TR, TF], '#c99560');
  const lerp = (P, Q, t) => [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t];
  for (let k = 1; k < 11; k++) {                                     // مداميك الطوب
    const t = k / 11, a = lerp(BL, TL, t), b = lerp(BF, TF, t), c = lerp(BR, TR, t);
    ln(a[0], a[1], b[0], b[1], 'rgba(70,40,18,0.35)', 0.5);
    ln(b[0], b[1], c[0], c[1], 'rgba(90,55,22,0.3)', 0.5);
  }
  for (const t of [0.3, 0.52, 0.74]) for (const u of [0.35, 0.65]) { // نوافذ رمي ضيقة
    const p = lerp(lerp(BF, BR, u), lerp(TF, TR, u), t), q = lerp(lerp(BL, BF, u), lerp(TL, TF, u), t);
    rc(p[0] - 0.6, p[1] - 3.4, 1.2, 3.4, '#2a1a0e');
    rc(q[0] - 0.6, q[1] - 3.4, 1.2, 3.4, '#22150b');
  }
  const g0 = lerp(BF, BR, 0.32), g1 = lerp(BF, BR, 0.62);           // البوابة المقوسة
  poly([g0, g1, [g1[0], g1[1] - 9], [(g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2 - 12], [g0[0], g0[1] - 9]], '#3a2414');
  const tw = 14, td = 7;                                             // شرفة الرماة
  box(x, by - H + 1, tw, td, 5, '#93693f', '#b98a56', '#c99a64');
  const ql = qL(x, by - H + 1, tw, td), qr = qR(x, by - H + 1, tw, td);
  for (let k = 0; k < 5; k++) {
    const a = ql(0.05 + k * 0.22, 5), b = qr(0.05 + k * 0.22, 5);
    box(a[0], a[1], 1.3, 0.65, 2.6, '#93693f', '#b98a56', '#c99a64');
    box(b[0], b[1], 1.3, 0.65, 2.6, '#93693f', '#b98a56', '#c99a64');
  }
  dome(x, by - H - 4, 5.4, '#c99a64', '#a87c4c', '#d4af4f');
  for (const px of [x - 11, x + 11]) {                               // مشعلان
    ln(px, by - H - 3, px, by - H - 9, '#3a2a1c', 0.8);
    poly([[px - 1.6, by - H - 9], [px, by - H - 14], [px + 1.6, by - H - 9]], '#ff9a3c');
    poly([[px - 0.7, by - H - 9.4], [px, by - H - 12], [px + 0.7, by - H - 9.4]], '#ffe08a');
  }
  ln(x, by - H - 9.5, x, by - H - 22, '#2b2420', 0.9);               // راية
  poly([[x, by - H - 22], [x + 9, by - H - 20], [x, by - H - 17.5]], '#c98a3a');
  // 12د: عوارض خشبية بارزة من الطين (طراز الساحل)، وإطار أبيض للبوابة، ودروع جلدية على الشرفة، وجرار ماء ورماح عند القاعدة
  const sticks = [];
  for (const t of [0.16, 0.4, 0.63, 0.86]) for (const u of [0.18, 0.5, 0.82]) {
    const pr = lerp(lerp(BF, BR, u), lerp(TF, TR, u), t), pl = lerp(lerp(BL, BF, u), lerp(TL, TF, u), t);
    sticks.push([pr[0], pr[1], pr[0] + 1.8, pr[1] + 0.9], [pl[0], pl[1], pl[0] - 1.8, pl[1] + 0.9]);
  }
  lines(sticks, '#5a3e26', 0.75);
  lines([[g0[0], g0[1], g0[0], g0[1] - 9], [g0[0], g0[1] - 9, (g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2 - 12],
         [(g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2 - 12, g1[0], g1[1] - 9], [g1[0], g1[1] - 9, g1[0], g1[1]]], '#ecd6b6', 0.8);
  for (const [q, u, c] of [[ql, 0.3, '#7a2a1e'], [ql, 0.72, '#efe2c8'], [qr, 0.28, '#2a2420'], [qr, 0.7, '#7a2a1e']]) {
    const p = q(u, 2.6);
    el(p[0], p[1], 1.2, 1.6, c);
    ln(p[0], p[1] - 1.4, p[0], p[1] + 1.4, 'rgba(0,0,0,0.3)', 0.4);
  }
  for (const [px, py] of [[x + 12, y + 9.6], [x + 15.6, y + 8], [x + 9, y + 11]]) jar(px, py, 1.6, '#a8643a');
  const sp = outP(g0, OUT_R, 1.5);
  lines([[sp[0] - 1, sp[1] + 1, sp[0] + 0.6, sp[1] - 12], [sp[0] + 0.4, sp[1] + 1.4, sp[0] + 1.8, sp[1] - 11]], '#6b4a2e', 0.6);
  poly([[sp[0] + 0.6, sp[1] - 12], [sp[0] + 0.1, sp[1] - 14.4], [sp[0] + 1.1, sp[1] - 12.2]], '#c8ccd2');
  poly([[sp[0] + 1.8, sp[1] - 11], [sp[0] + 1.4, sp[1] - 13.4], [sp[0] + 2.3, sp[1] - 11.2]], '#c8ccd2');
}

// نقطة على السقف الأمامي مما يعيده ridgeRoof: u على الحافة من L إلى F، وt من الحافة (0) إلى السنام (1)
const roofAt = (roof, u, t) => {
  const e = [roof.L[0] + (roof.F[0] - roof.L[0]) * u, roof.L[1] + (roof.F[1] - roof.L[1]) * u];
  const r = [roof.P1[0] + (roof.P2[0] - roof.P1[0]) * u, roof.P1[1] + (roof.P2[1] - roof.P1[1]) * u];
  return [e[0] + (r[0] - e[0]) * t, e[1] + (r[1] - e[1]) * t];
};

// --- مركز الشرطة الرئيسي (روتنبورغ): طابق حجري ببوابة مقوسة ولوحة زرقاء ومصباح، وطابق نصف خشبي بارز
// بعوارض داكنة ونوافذ بأحواض زهور حمراء، وسقف قرميد أحمر حاد بنافذتين، وبرج صغير على السنام بقمة مدببة ---
const BEAM = '#4a3222';
function policeHQ(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(30,20,15,0.22)');
  box(x, y + 2, 33, 16.5, 4, '#7d766c', '#9b9489', '#aaa398');
  box(x + 9.5, y + 10, 7, 3.5, 2.5, '#7d766c', '#9b9489', '#aaa398');            // درجات البوابة
  const by = y - 2, w = 25, d = 12.5, h0 = 12;
  box(x, by, w, d, h0, '#8d8577', '#aca291');                                       // الطابق الحجري
  const gl = qL(x, by, w, d), gr = qR(x, by, w, d);
  for (const v of [4, 8]) {                                                         // مداميك
    const a = gl(0, v), b = gl(1, v), c = gr(1, v);
    ln(a[0], a[1], b[0], b[1], 'rgba(60,50,40,0.3)', 0.5);
    ln(b[0], b[1], c[0], c[1], 'rgba(70,60,50,0.25)', 0.5);
  }
  arch(gr, 0.38, 0.24, 8.6, '#3a2a1e');                                             // البوابة
  arch((a, b) => gr(a + 0.025, b), 0.38, 0.19, 7.4, '#6b4526');
  for (const u of [0.1, 0.74]) wR(x, by, w, d, u, 3.5, 0.13, 4.5, '#2c3440');
  for (const u of [0.12, 0.44, 0.76]) wL(x, by, w, d, u, 3.5, 0.13, 4.5, '#262d38');
  // 12د: مصاريع خضراء للنوافذ الحجرية
  for (const [q, u] of [[gr, 0.1], [gr, 0.74], [gl, 0.12], [gl, 0.44], [gl, 0.76]]) for (const s of [u - 0.055, u + 0.135]) {
    poly([q(s, 3.5), q(s + 0.05, 3.5), q(s + 0.05, 8), q(s, 8)], q === gr ? '#3f7a52' : '#336844');
  }
  const s0 = gr(0.34, 9.2), s1 = gr(0.66, 9.2);                                     // لوحة الشرطة الزرقاء
  poly([s0, s1, [s1[0], s1[1] - 2.6], [s0[0], s0[1] - 2.6]], '#2a5ca8');
  ln(s0[0] + 1.2, s0[1] - 1.3, s1[0] - 1.2, s1[1] - 1.3, '#e9eef6', 0.7);
  const lamp = gr(0.5, 13.6);                                                       // حامل المصباح (يومض فوقه، landmarks.js)
  ln(lamp[0], lamp[1] + 1.6, lamp[0], lamp[1] - 0.6, '#2a2d33', 0.8);
  // الطابق نصف الخشبي: أوسع قليلاً من الحجري، وخمسة أقسام لكل وجه: دعامتان متقاطعتان ونافذة بالتناوب
  const uy = by - h0, W = w + 1.5, D = d + 0.75, h1 = 15;
  box(x, uy, W, D, h1, '#e4d8bf', '#f2e8d2');
  for (const q of [qL(x, uy, W, D), qR(x, uy, W, D)]) {
    for (const v of [0.6, h1 - 0.6]) { const a = q(0, v), b = q(1, v); ln(a[0], a[1], b[0], b[1], BEAM, 1.3); }
    for (let k = 0; k <= 5; k++) { const a = q(k / 5, 0.6), b = q(k / 5, h1 - 0.6); ln(a[0], a[1], b[0], b[1], BEAM, 1.1); }
    for (let k = 0; k < 5; k++) {
      const a0 = k / 5, a1 = (k + 1) / 5;
      if (k % 2 === 0) {
        const p = q(a0, 0.6), r = q(a1, h1 - 0.6), s = q(a1, 0.6), t = q(a0, h1 - 0.6);
        ln(p[0], p[1], r[0], r[1], BEAM, 0.8);
        ln(s[0], s[1], t[0], t[1], BEAM, 0.8);
        continue;
      }
      const wa = a0 + 0.035, wb = a1 - 0.035;
      poly([q(wa, 5), q(wb, 5), q(wb, 11.5), q(wa, 11.5)], '#2b3442');
      const m0 = q((wa + wb) / 2, 5), m1 = q((wa + wb) / 2, 11.5);
      ln(m0[0], m0[1], m1[0], m1[1], '#e9e2d0', 0.5);
      const f0 = q(wa - 0.01, 4.4), f1 = q(wb + 0.01, 4.4);
      ln(f0[0], f0[1], f1[0], f1[1], '#5a3a22', 1.5);                              // حوض الزهور
      for (let n = 0; n < 3; n++) { const f = q(wa + (wb - wa) * (0.2 + n * 0.3), 5.4); circ(f[0], f[1], 0.95, n % 2 ? '#e0453a' : '#c8302b'); }
    }
  }
  const roof = ridgeRoof(x, uy, W, D, h1, 24, { gable: true, ov: 2.5, front: '#b2482f', back: '#7e2f22', tile: 'rgba(70,20,10,0.35)',
                                                wallEnd: '#eadfc8', eave: '#5a2a1a', ridge: '#5a2418', ridgeW: 1.4 });
  // عوارض الجملون، ونافذة مستديرة فيه
  const Fg = [x, uy + D - h1], Rg = [x + W, uy - h1], P2 = roof.P2, mid = [(Fg[0] + Rg[0]) / 2, (Fg[1] + Rg[1]) / 2];
  const c0 = [(Fg[0] + P2[0]) / 2, (Fg[1] + P2[1]) / 2], c1 = [(Rg[0] + P2[0]) / 2, (Rg[1] + P2[1]) / 2];
  ln(Fg[0], Fg[1], Rg[0], Rg[1], BEAM, 1.2);
  ln(mid[0], mid[1], P2[0], P2[1], BEAM, 1);
  ln(mid[0], mid[1], c0[0], c0[1], BEAM, 0.8);
  ln(mid[0], mid[1], c1[0], c1[1], BEAM, 0.8);
  ln(c0[0], c0[1], c1[0], c1[1], BEAM, 0.9);
  el((mid[0] + P2[0]) / 2, (mid[1] + P2[1]) / 2 + 2.2, 1.6, 1.9, '#2b3442');
  for (const u of [0.28, 0.68]) {                                                   // نافذتان في السقف الأمامي
    const [px, py] = roofAt(roof, u, 0.32);
    poly([[px - 2.4, py - 1.2], [px + 2.4, py + 1.2], [px + 2.4, py - 2.8], [px - 2.4, py - 5.2]], '#eadfc8');
    poly([[px - 1.4, py - 1.3], [px + 1.4, py + 0.1], [px + 1.4, py - 2.9], [px - 1.4, py - 4.3]], '#2b3442');
    poly([[px - 3.1, py - 5.6], [px + 3.1, py - 2.5], [px - 0.2, py - 9]], '#93392a');
  }
  // البرج الصغير على وسط السنام
  const mx = (roof.P1[0] + P2[0]) / 2, my = (roof.P1[1] + P2[1]) / 2 + 1.5;
  box(mx, my, 3.4, 1.7, 8, '#e4d8bf', '#f2e8d2');
  wR(mx, my, 3.4, 1.7, 0.25, 3, 0.5, 3.6, '#2b3442');
  wL(mx, my, 3.4, 1.7, 0.25, 3, 0.5, 3.6, '#262d38');
  cone(mx, my - 8, 4.4, 12, '#7e2f22', '#a8432f');
  ln(mx, my - 20, mx, my - 23.5, '#d4af4f', 0.8);
  circ(mx, my - 24, 1, '#d4af4f');
  // 12د: سيارة شرطة أمام الوجه الأيسر، ولوحة إعلانات ودراجة عند الدرج
  const cx = x - 15, cy = y + 5.6;
  el(cx - 2.6, cy + 1, 0.9, 0.55, '#1e1e20'); el(cx + 2.2, cy + 1.6, 0.9, 0.55, '#1e1e20');
  box(cx, cy, 4.6, 2.3, 2.2, '#c9ccd0', '#e6e8ea', '#f2f3f4');
  const cl = qL(cx, cy, 4.6, 2.3);
  poly([cl(0, 0.6), cl(1, 0.6), cl(1, 1.3), cl(0, 1.3)], '#2a5ca8');
  box(cx + 0.4, cy - 2.2, 2.8, 1.4, 1.6, '#3b4a5a', '#56687a', '#e6e8ea');
  rc(cx - 0.4, cy - 4.6, 1.6, 0.7, '#3a7ae8');
  circ(cx - 0.1, cy - 4.4, 0.35, '#bfe0ff');
  const nx = x + 20, ny = y + 3.4;
  lines([[nx - 2, ny + 1, nx - 2, ny - 6], [nx + 2, ny - 1, nx + 2, ny - 8]], '#4a3222', 0.8);
  poly([[nx - 2.4, ny - 2.4], [nx + 2.4, ny - 4.8], [nx + 2.4, ny - 8.4], [nx - 2.4, ny - 6]], '#6b4a2e');
  for (const [u, v, c] of [[-1.4, -4, '#f4f1ea'], [0.4, -5.2, '#f2d46a'], [-0.6, -6.3, '#f4f1ea']]) {
    poly([[nx + u - 0.8, ny + v + 0.4], [nx + u + 0.8, ny + v - 0.4], [nx + u + 0.8, ny + v - 1.8], [nx + u - 0.8, ny + v - 1]], c);
  }
  const bx = x + 17, bb = y + 6.6, wheel = (px, py) => { const c = getCtx(); c.beginPath(); c.ellipse(px, py, 1.2, 1.4, 0, 0, TAU);
    c.strokeStyle = '#1e1e22'; c.lineWidth = 0.4; c.stroke(); };
  wheel(bx - 1.6, bb); wheel(bx + 1.6, bb - 0.8);
  lines([[bx - 1.6, bb, bx, bb - 1.6], [bx, bb - 1.6, bx + 1.6, bb - 0.8], [bx, bb - 1.6, bx - 0.3, bb - 2.6], [bx + 1.6, bb - 0.8, bx + 1.3, bb - 2.8]], '#2a5ca8', 0.45);
}

// قرص على وجه مائل (وجه الساعة): q دالة الوجه، ومركزه (a, b)، ونصف قطره r بكسل، وw عرض الوجه
const faceDisc = (q, a, b, r, w, color) => {
  const pts = [];
  for (let k = 0; k < 18; k++) { const t = k * TAU / 18; pts.push(q(a + Math.cos(t) * r / w, b + Math.sin(t) * r)); }
  poly(pts, color);
};

// --- برج الساعة (برمنغهام): منصة بأحواض زهور، وقاعدة من الحجر الرملي ببوابتين، وبدن من الطوب الأحمر بأحزمة
// حجرية وحجارة ركن ونوافذ مقوسة، وطابق الساعة بوجهين، وإفريز وأربعة أبراج صغيرة، وسقف مدبب من الأردواز بقمة ذهبية ---
function clock(x, y, i, j) {
  el(x, y + 6, 36, 16, 'rgba(30,20,15,0.22)');
  box(x, y + 2, 31, 15.5, 3, '#8f8a80', '#aaa498', '#b6b0a4');
  for (const [px, py] of [[x - 21, y + 0.5], [x + 21, y + 0.5], [x, y + 11]]) {     // أحواض زهور
    box(px, py, 5, 2.5, 2.2, '#6c5a48', '#7e6a55', '#4f7a3a');
    for (let k = 0; k < 4; k++) circ(px - 3 + k * 2, py - 2.6 - (k % 2) * 0.6, 0.9, k % 2 ? '#e0453a' : '#f2c14e');
  }
  const by = y - 1;
  box(x, by, 15, 7.5, 8, '#b39874', '#cdb28c', '#d6bd98');
  arch(qR(x, by, 15, 7.5), 0.32, 0.36, 6.8, '#3a2c22');
  arch(qL(x, by, 15, 7.5), 0.32, 0.36, 6.8, '#33271e');
  const sy = by - 8, w = 10, d = 5, H = 40;
  box(x, sy, w, d, H, '#8a3a2a', '#ad4b34');
  const L = qL(x, sy, w, d), R = qR(x, sy, w, d), c = getCtx();
  c.beginPath();                                                                     // مداميك الطوب
  for (let v = 3; v < H; v += 3) {
    const a = L(0, v), b = L(1, v), e = R(1, v);
    c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(e[0], e[1]);
  }
  c.strokeStyle = 'rgba(60,20,10,0.22)';
  c.lineWidth = 0.4;
  c.stroke();
  for (const v of [13, 27]) {                                                        // أحزمة حجرية
    const a = L(0, v), b = L(1, v), e = R(1, v);
    ln(a[0], a[1], b[0], b[1], '#d8c29e', 1.5);
    ln(b[0], b[1], e[0], e[1], '#e6d2ae', 1.5);
  }
  for (let v = 1; v < H - 1; v += 4) rc(x - 1.1, sy + d - v - 2, 2.2, 2, '#e0cba6'); // حجارة الركن الأمامي
  for (const q of [L, R]) for (const v of [4, 17, 30]) arch((a, b) => q(a, b + v), 0.38, 0.24, 7, '#2a2220');
  const cy = sy - H, cw = 11.5, cd = 5.75, ch = 14;
  box(x, cy, cw, cd, ch, '#bea783', '#d8c19b');
  for (const q of [qL(x, cy, cw, cd), qR(x, cy, cw, cd)]) {
    faceDisc(q, 0.5, 7, 5.2, cw, '#d4af4f');                                          // الإطار الذهبي
    faceDisc(q, 0.5, 7, 4.3, cw, '#f4efe2');
    const o = q(0.5, 7), m = q(0.5, 10.4), hr = q(0.5 + 2.3 / cw, 5.9);
    ln(o[0], o[1], m[0], m[1], '#262626', 0.6);
    ln(o[0], o[1], hr[0], hr[1], '#262626', 0.85);
  }
  const ty = cy - ch;
  box(x, ty, 13, 6.5, 2.2, '#a8916c', '#c4ad86', '#cfb891');
  hipRoof(x, ty - 2.2, 11.5, 5.75, 0, 24, '#4b5661', '#66737f');
  for (const [px, py] of [[x - 12, ty - 2.2], [x, ty - 2.2 + 6], [x + 12, ty - 2.2]]) cone(px, py, 1.5, 8, '#a8916c', '#c4ad86');
  ln(x, ty - 26.2, x, ty - 32, '#d4af4f', 0.9);
  circ(x, ty - 28.6, 1.1, '#e6c35a');
  // 12د: درابزين حديدي فيكتوري على حافتي المنصة الأماميتين، وصندوق بريد أحمر، ومقعد خشبي
  const rail = [], pl = qL(x, y + 2, 31, 15.5), pr = qR(x, y + 2, 31, 15.5);
  for (const [q, u0, u1] of [[pl, 0.06, 0.78], [pr, 0.22, 0.94]]) {
    const a = q(u0, 3), b = q(u1, 3);
    rail.push([a[0], a[1] - 2.4, b[0], b[1] - 2.4], [a[0], a[1] - 0.9, b[0], b[1] - 0.9]);
    for (let u = u0; u <= u1 + 0.001; u += (u1 - u0) / 10) { const p = q(u, 3); rail.push([p[0], p[1], p[0], p[1] - 2.9]); }
  }
  lines(rail, '#1e2126', 0.45);
  const mx = x - 10, my = y + 7.4;
  cyl(mx, my, 1.15, 4.2, '#8e1c1c', '#c42a2a', '#d63a3a');
  dome(mx, my - 4.2, 1.2, '#2a2a2c', '#1e1e20', null);
  rc(mx - 0.5, my - 3.4, 1, 0.35, '#1e1e20');
  const ex = x + 11, ey = y + 7.4;
  box(ex, ey - 1.4, 3.4, 1.7, 0.5, '#5a3a22', '#7a5434', '#8a6440');
  lines([[ex - 3, ey - 0.2, ex - 3, ey - 1.6], [ex + 3, ey - 1.6, ex + 3, ey - 3], [ex - 3.4, ey - 3.8, ex + 3.4, ey - 7.2],
         [ex - 3.4, ey - 2.6, ex - 3.4, ey - 3.8], [ex + 3.4, ey - 6, ex + 3.4, ey - 7.2]], '#1e2126', 0.5);
  lines([[ex - 3.2, ey - 3.1, ex + 3.2, ey - 6.3]], '#7a5434', 0.9);
}

// حزام أحمر بنقش متدرج فيروزي أعلى الجدارين، وإزار أحمر أسفلهما (المجمع السكني)
function aztecBand(x, y, w, d, h) {
  for (const q of [qL(x, y, w, d), qR(x, y, w, d)]) {
    poly([q(0, h - 3.6), q(1, h - 3.6), q(1, h - 0.6), q(0, h - 0.6)], '#a63a2a');
    poly([q(0, 0), q(1, 0), q(1, 1.6), q(0, 1.6)], '#93382a');
    const n = Math.max(2, Math.round(w / 3.4));
    for (let k = 0; k < n; k++) {
      const a = (k + 0.12) / n, m = (k + 0.5) / n, b = (k + 0.88) / n;
      poly([q(a, h - 3.1), q(m, h - 3.1), q(m, h - 2.1), q(a, h - 2.1)], '#36b2a8');
      poly([q(m, h - 2.1), q(b, h - 2.1), q(b, h - 1.1), q(m, h - 1.1)], '#36b2a8');
    }
  }
}

// شُرَف بيضاء صغيرة على الحافتين الأماميتين لسطح
function merlons(x, y, w, d, h, n) {
  const l = qL(x, y, w, d), r = qR(x, y, w, d);
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) / n, a = l(u, h), b = r(u, h);
    box(a[0], a[1], 1.1, 0.55, 2, '#d6c9ae', '#efe6d2', '#f4ecda');
    box(b[0], b[1], 1.1, 0.55, 2, '#d6c9ae', '#efe6d2', '#f4ecda');
  }
}

// راية ريش: عمود وثلاث ريشات بألوان المجمع
function featherStandard(px, py, h) {
  ln(px, py, px, py - h, '#3a2a1c', 0.9);
  const t = py - h;
  poly([[px, t + 2], [px - 3.6, t - 3], [px - 1.4, t - 4.6]], '#2fa8a0');
  poly([[px, t + 2], [px - 1, t - 5.4], [px + 1, t - 5.4]], '#3f9b4a');
  poly([[px, t + 2], [px + 1.4, t - 4.6], [px + 3.6, t - 3]], '#c8392f');
}

// صبار النوبال في أصيص
const nopal = (px, py) => {
  box(px, py, 2.4, 1.2, 2.4, '#8a4a32', '#a85c3e', '#6b3a28');
  el(px, py - 5, 1.8, 2.8, '#4f8a3e');
  el(px - 2, py - 8, 1.4, 2.2, '#5e9a4a');
  el(px + 1.8, py - 8.8, 1.3, 2, '#4a8238');
};

// --- المجمع السكني (تينوتشتيتلان): منصة بدرجتين من حجر التيزونتلي الأحمر، وقاعة طين مبيضة بطابقين أمامها جناح،
// وأحزمة حمراء بنقش متدرج فيروزي، وشُرَف بيضاء، ومعبد صغير بسقف قش على السطح، ورايات ريش، وصبار في أصص ---
function complex(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(40,20,15,0.24)');
  box(x, y + 2, 33, 16.5, 3, '#7a4536', '#985844', '#a6634d');
  box(x, y - 1, 30, 15, 3, '#7a4536', '#985844', '#a6634d');
  const A = ['#d6c9ae', '#ebe0c8', '#e3d8bf'];
  const hy = y - 7, hw = 22, hd = 11, hh = 24;
  box(x, hy, hw, hd, hh, A[0], A[1], A[2]);                                          // القاعة الخلفية
  aztecBand(x, hy, hw, hd, hh);
  for (const u of [0.16, 0.42, 0.68]) {
    wL(x, hy, hw, hd, u, 14.5, 0.12, 4.2, '#2a1d16');
    wR(x, hy, hw, hd, u + 0.06, 14.5, 0.12, 4.2, '#33241b');
  }
  merlons(x, hy, hw, hd, hh, 6);
  { // 12د: جدارية بشمس ذهبية ونقش متدرج على الوجه الأيسر للقاعة
    const q = qL(x, hy, hw, hd);
    poly([q(0.04, 3.6), q(0.34, 3.6), q(0.34, 11.4), q(0.04, 11.4)], '#b8503a');
    const s = q(0.19, 7.5);
    lines([0, 1, 2, 3, 4, 5, 6, 7].map(k => { const t = k * TAU / 8; return [s[0], s[1], s[0] + Math.cos(t) * 3.2, s[1] + Math.sin(t) * 3.2]; }), '#f2c14e', 0.5);
    circ(s[0], s[1], 1.8, '#f2c14e');
    circ(s[0], s[1], 0.9, '#36b2a8');
    for (const u of [0.06, 0.27]) poly([q(u, 4.2), q(u + 0.04, 4.2), q(u + 0.04, 10.8), q(u, 10.8)], '#36b2a8');
  }
  const fy = y + 2, fw = 14, fd = 7, fh = 11;
  box(x, fy, fw, fd, fh, A[0], A[1], A[2]);                                          // الجناح الأمامي
  aztecBand(x, fy, fw, fd, fh);
  const fr = qR(x, fy, fw, fd);
  poly([fr(0.34, 1.6), fr(0.66, 1.6), fr(0.66, 7), fr(0.34, 7)], '#2a1d16');          // المدخل
  const t0 = fr(0.3, 7.3), t1 = fr(0.7, 7.3);
  ln(t0[0], t0[1], t1[0], t1[1], '#6b4526', 1.4);
  wL(x, fy, fw, fd, 0.4, 2.6, 0.2, 4, '#33241b');
  merlons(x, fy, fw, fd, fh, 4);
  // المعبد الصغير على سطح القاعة، ورايتا ريش على ركنيه
  const ry = hy - hh, sx = x - 6, sy = ry - 3;
  box(sx, sy, 6, 3, 7, '#a8432f', '#c25a3f');
  const sr = qR(sx, sy, 6, 3);
  poly([sr(0.3, 0), sr(0.7, 0), sr(0.7, 4.6), sr(0.3, 4.6)], '#2a1d16');
  ridgeRoof(sx, sy, 6, 3, 7, 7, { ov: 1.5, front: '#c9a35a', back: '#8a6a34', end: '#b08a48', ridge: '#6b4f2a', ridgeW: 1, tile: 'rgba(90,60,20,0.35)' });
  featherStandard(x - hw + 2, ry - 0.5, 13);
  featherStandard(x + hw - 2, ry - 0.5, 13);
  nopal(x - 25, y + 0.5);
  nopal(x + 25, y + 0.5);
  // 12د: مجمرتان نحاسيتان على سطح القاعة، ورأسا أفعى ريشية من الحجر على حافة الدرجة، وذرة في أصيصين
  for (const [px, py] of [[x + 1, y - 21.5], [x + 13, y - 26]]) {
    el(px, py - 1.6, 2.2, 1, '#8a4a2a');
    el(px, py - 2.2, 2.2, 0.8, '#b8683a');
    poly([[px - 1.6, py - 2.2], [px - 0.4, py - 6.6], [px + 0.4, py - 4.4], [px + 1, py - 7.2], [px + 1.6, py - 2.2]], '#ff8a2a');
    poly([[px - 0.8, py - 2.4], [px, py - 5], [px + 0.8, py - 2.4]], '#ffe08a');
  }
  for (const [px, py, s] of [[x - 7.5, y + 11, -1], [x + 7.5, y + 11, 1]]) {
    circ(px, py - 2.6, 2.4, '#3f9b5a');
    for (let k = 0; k < 5; k++) { const t = Math.PI * (1.05 + k * 0.22); circ(px + Math.cos(t) * 2.4, py - 2.6 + Math.sin(t) * 2.4, 0.7, k % 2 ? '#36b2a8' : '#c8392f'); }
    box(px + s * 0.8, py, 1.9, 0.95, 3.2, '#7d8a6c', '#9aa888', '#aab894');
    circ(px + s * 1.6, py - 2.2, 0.45, '#f2c14e');
    ln(px + s * 0.6, py - 0.9, px + s * 2.4, py - 0.4, '#3a2a1c', 0.5);
  }
  for (const [px, py] of [[x - 18, y + 1.5], [x + 18, y + 0.5]]) {
    box(px, py, 1.8, 0.9, 1.8, '#8a4a32', '#a85c3e', '#6b3a28');
    lines([[px - 0.6, py - 1.8, px - 1, py - 9], [px + 0.6, py - 1.8, px + 1.2, py - 8.4]], '#4f8a3e', 0.6);
    lines([[px - 0.8, py - 5, px - 2.8, py - 6.4], [px + 0.9, py - 4.6, px + 2.8, py - 6.2], [px - 0.9, py - 7, px + 0.4, py - 8.6]], '#5e9a4a', 0.5);
    el(px + 1.1, py - 7.4, 0.5, 1.2, '#e8c23a');
  }
}

// --- معبد ريو (بطلب المستخدم بدل التمثال، بمزاياه نفسها): أطلال كنيسة إرسالية من الحجر الرملي الأحمر على مرج،
// كصور سان ميغيل التي أرسلها: واجهة بطابقين بأعمدة ملتصقة وثلاثة أبواب وجبهة مثلثة بأوانٍ حجرية، وحلزونان داكنان
// على جانبي الطابق الأعلى، وبرج أجراس على يسارها بفتحات مقوسة وقمة مكسورة، ورواق أعمدة أمامها، وصحن بلا سقف
// بجدران مكسورة ونوافذ مقوسة، وأساسات منخفضة وحجارة متناثرة وشجرتان خلفها.
// a وb بالمربعات على محوري i وj من وسط الكتلة، وh الارتفاع بالبكسل فوق المرج؛ الضوء من اليمين كبقية المباني ---
const CH = { shade: '#a45537', lit: '#c46d45', top: '#d6936a', pil: '#b86745', dark: '#2b1a12', inner: '#5a2f1f',
             edge: 'rgba(255,214,170,0.55)', ledge: ['#b8694a', '#d07f56', '#e0a077'], stone: ['#9a5a3c', '#b8714d', '#c98a64'] };
function statue(x, y, i, j) {
  const G = 1.4, c = getCtx();
  const W = (a, b, h = 0) => [x + (a - b) * TILE_HALF_W, y + (a + b) * TILE_HALF_H - h - G];
  const onJ = (b, a0, a1) => (u, h) => W(a0 + (a1 - a0) * u, b, h);       // وجه يواجه +j: في الظل
  const onI = (a, b1, b0) => (u, h) => W(a, b1 + (b0 - b1) * u, h);       // وجه يواجه +i: مضاء، u من الأمام للخلف
  const up = (q, v) => (u, h) => q(u, h + v);
  const quad = (q, u0, u1, h0, h1, col) => poly([q(u0, h0), q(u1, h0), q(u1, h1), q(u0, h1)], col);
  const prism = (a0, a1, b0, b1, h0, h1, cl, cr, ct) => {
    poly([W(a0, b1, h0), W(a1, b1, h0), W(a1, b1, h1), W(a0, b1, h1)], cl);
    poly([W(a1, b1, h0), W(a1, b0, h0), W(a1, b0, h1), W(a1, b1, h1)], cr);
    poly([W(a0, b0, h1), W(a1, b0, h1), W(a1, b1, h1), W(a0, b1, h1)], ct);
  };
  const ledge = (a0, a1, b0, b1, h0, h1, o = 0.03) => prism(a0 - o, a1 + o, b0 - o, b1 + o, h0, h1, ...CH.ledge);
  // حجارة الوجه: مداميك أفقية وكتل أفتح وأغمق، مواضعها ثابتة لكل خريطة
  const masonry = (q, u0, u1, h0, h1, seed, n) => {
    c.beginPath();
    for (let h = h0 + 2.6; h < h1 - 0.5; h += 2.6) { const p = q(u0, h), r = q(u1, h); c.moveTo(p[0], p[1]); c.lineTo(r[0], r[1]); }
    c.strokeStyle = 'rgba(70,30,15,0.22)';
    c.lineWidth = 0.45;
    c.stroke();
    for (let k = 0; k < n; k++) {
      const u = u0 + (u1 - u0 - 0.08) * hsh(i, j, seed + k), h = h0 + (h1 - h0 - 2.6) * hsh(i, j, seed + 40 + k);
      quad(q, u, u + 0.04 + 0.05 * hsh(i, j, seed + 80 + k), h, h + 2.4, k % 3 ? 'rgba(255,200,160,0.14)' : 'rgba(40,20,10,0.2)');
    }
  };
  // جدار مكسور على الوجه q: حافته العليا درجات حجرية بارتفاع top(u) ± jag/2، وخط فاتح عليها؛ يعيد الارتفاعات
  const ruin = (q, n, top, jag, seed, col) => {
    const hs = [];
    for (let k = 0; k < n; k++) hs.push(Math.max(1, top((k + 0.5) / n) + (hsh(i, j, seed + k) - 0.5) * jag));
    const pts = [q(0, 0), q(1, 0)];
    for (let k = n - 1; k >= 0; k--) pts.push(q((k + 1) / n, hs[k]), q(k / n, hs[k]));
    poly(pts, col);
    c.beginPath();
    pts.slice(2).forEach(([px, py], k) => (k ? c.lineTo(px, py) : c.moveTo(px, py)));
    c.strokeStyle = CH.edge;
    c.lineWidth = 0.7;
    c.stroke();
    return hs;
  };
  // سمك الجدار المكسور من فوق: شريط بين وجهه الخارجي qo والداخلي qi على كل درجة
  const ruinTop = (qo, qi, hs) => hs.forEach((h, k) => {
    const u0 = k / hs.length, u1 = (k + 1) / hs.length;
    poly([qo(u0, h), qo(u1, h), qi(u1, h), qi(u0, h)], CH.top);
  });
  const tree = (a, b, s) => {
    const [px, py] = W(a, b);
    el(px + 2, py + 1, 6 * s, 2.6 * s, 'rgba(20,35,15,0.25)');
    ln(px, py, px, py - 9 * s, '#5a4128', 1.6 * s);
    for (const [dx, dy, r, col] of [[-3, -10, 4.2, '#3d6a32'], [3, -11, 4, '#4d7d3c'], [0, -14, 4.6, '#5b8d45'], [1.5, -12.5, 2.4, '#7aa95a']])
      circ(px + dx * s, py + dy * s, r * s, col);
  };

  // المرج بحافة حجرية، وبقع العشب، والأساسات المنخفضة والحجارة المتناثرة، وشجرتان خلف الكنيسة
  el(x, y + 8, 40, 18, 'rgba(30,40,20,0.2)');
  prism(-0.97, 0.97, -0.97, 0.97, -G, 0, '#7a5b3c', '#94714b', '#6d9846');
  for (let k = 0; k < 30; k++) {
    const [px, py] = W(-0.9 + 1.8 * hsh(i, j, 1200 + k), -0.9 + 1.8 * hsh(i, j, 1240 + k));
    el(px, py, 2 + 1.4 * hsh(i, j, 1280 + k), 0.9, k % 2 ? 'rgba(45,85,25,0.28)' : 'rgba(180,215,120,0.24)');
  }
  // الحجارة: ما خلف الكنيسة يُرسم قبلها، وما أمامها (يمين الصحن وأمام البرج) بعدها مع الأساسات
  const stones = [];
  for (let k = 0; k < 48 && stones.length < 12; k++) {
    const a = -0.92 + 1.84 * hsh(i, j, 1320 + k), b = -0.92 + 1.84 * hsh(i, j, 1370 + k);
    if ((a > -0.42 && a < 0.8) || (a > -0.9 && b > 0.02 && b < 0.68)) continue;   // لا حجارة تحت الكنيسة وبرجها
    stones.push([a, b, 0.035 + 0.03 * hsh(i, j, 1420 + k), 1 + 1.2 * hsh(i, j, 1470 + k)]);
  }
  const stone = ([a, b, s, h]) => prism(a, a + s * 1.4, b, b + s, 0, h, ...CH.stone);
  const ahead = ([a, b]) => a >= 0.8 || b > 0.68;
  stones.filter((st) => !ahead(st)).forEach(stone);
  tree(-0.85, -0.85, 1.2);

  const aW = -0.45, aE = 0.78, bF = 0.55, bB = -0.95, T = 0.07;
  // برج الأجراس: ثلاثة طوابق بأفاريز، وفتحات مقوسة، وقمة مكسورة بعمودين، بارتفاع الجبهة تقريباً كما في الصور
  const t0 = -0.95, t1 = aW, tb0 = 0.08, tb1 = 0.62;
  prism(t0, t1, tb0, tb1, 0, 24, '#9c4f33', '#c06b44', CH.top);
  masonry(onJ(tb1, t0, t1), 0, 1, 0, 24, 1600, 8);
  masonry(onI(t1, tb1, tb0), 0, 1, 0, 24, 1650, 8);
  ledge(t0, t1, tb0, tb1, 24, 26.5);
  prism(t0, t1, tb0, tb1, 26.5, 36, '#9c4f33', '#c06b44', CH.top);
  arch(up(onJ(tb1, t0, t1), 28), 0.3, 0.4, 7, CH.dark);
  arch(up(onI(t1, tb1, tb0), 28), 0.3, 0.4, 7, '#3a2216');
  ledge(t0, t1, tb0, tb1, 36, 38);
  const s0 = t0 + 0.06, s1 = t1 - 0.06, sb0 = tb0 + 0.06, sb1 = tb1 - 0.06;
  prism(s0, s1, sb0, sb1, 38, 45, '#9c4f33', '#c06b44', CH.top);
  arch(up(onJ(sb1, s0, s1), 39.3), 0.32, 0.36, 5, CH.dark);
  arch(up(onI(s1, sb1, sb0), 39.3), 0.32, 0.36, 5, '#3a2216');
  ledge(s0, s1, sb0, sb1, 45, 46.5, 0.02);
  prism(s1 - 0.1, s1, sb0, sb0 + 0.1, 46.5, 49, ...CH.ledge);               // بقايا القمة
  prism(s0, s0 + 0.1, sb1 - 0.1, sb1, 46.5, 50, ...CH.ledge);

  // داخل الصحن بلا سقف: الجدار الخلفي والجدار الأيسر من الداخل، وركام على أرضه
  ruin(onJ(bB + T, aW + T, aE - T), 8, (u) => 23 - 3 * u, 4, 1500, '#8c482e');
  const west = onI(aW + T, bF - T, bB + T);
  ruin(west, 10, (u) => 18 + 5 * u, 5, 1520, '#b8643f');
  for (const u of [0.22, 0.47, 0.72]) arch(up(west, 7), u, 0.08, 9, CH.inner);
  for (let k = 0; k < 7; k++) {
    const a = aW + 0.12 + (aE - aW - 0.3) * hsh(i, j, 1700 + k), b = bB + 0.15 + (bF - bB - 0.3) * hsh(i, j, 1720 + k);
    prism(a, a + 0.06, b, b + 0.045, 0, 1.2 + hsh(i, j, 1740 + k), ...CH.stone);
  }

  // الجدار الأيمن من الخارج: مكسور في وسطه، بأعمدة ملتصقة ونوافذ مقوسة، وسمكه ظاهر من فوق
  const east = onI(aE, bF, bB), eastIn = onI(aE - T, bF, bB);
  const eh = ruin(east, 12, (u) => 21 + 3 * u - 8 * Math.exp(-(((u - 0.5) / 0.17) ** 2)), 4, 1540, CH.lit);
  ruinTop(east, eastIn, eh);
  masonry(east, 0, 1, 0, 12, 1560, 14);
  for (const u of [0.04, 0.24, 0.66, 0.86]) {
    const k = Math.min(eh.length - 1, Math.floor(u * eh.length)), h = eh[k] - 0.5;
    quad(east, u, u + 0.035, 0, h, '#d27d52');
    ln(...east(u + 0.035, 0), ...east(u + 0.035, h), 'rgba(80,35,18,0.35)', 0.5);
  }
  for (const u of [0.12, 0.74]) arch(up(east, 6), u, 0.07, 11, CH.inner);
  arch(up(east, 5), 0.45, 0.07, 6, CH.inner);

  // الواجهة: الطابق الأسفل بأعمدته الملتصقة وأبوابه الثلاثة، ثم الإفريز
  const F0 = onJ(bF, aW, aE);
  quad(F0, 0, 1, 0, 24, CH.shade);
  masonry(F0, 0, 1, 0, 24, 1800, 18);
  for (const u of [0.05, 0.19, 0.33, 0.67, 0.81, 0.95]) {
    quad(F0, u - 0.022, u + 0.022, 0, 24, CH.pil);
    quad(F0, u - 0.03, u + 0.03, 0, 2.4, '#8f4529');
    ln(...F0(u + 0.022, 2.4), ...F0(u + 0.022, 24), 'rgba(60,25,12,0.35)', 0.5);
  }
  quad(F0, 0.43, 0.57, 0, 14, CH.dark);
  quad(F0, 0.41, 0.59, 14, 15.6, '#c07a55');
  for (const u of [0.11, 0.83]) { quad(F0, u, u + 0.06, 0, 10, CH.dark); quad(F0, u - 0.01, u + 0.07, 10, 11.2, '#c07a55'); }
  for (const u of [0.245, 0.715]) arch(up(F0, 9), u, 0.04, 6, '#5a3020');
  ledge(aW, aE, bF - 0.02, bF, 24, 26.5);
  // الحلزونان الداكنان على جانبي الطابق الأعلى
  for (const side of [-1, 1]) {
    const u0 = side < 0 ? 0.25 : 0.75, pts = [F0(u0, 26.5), F0(u0, 36.5)];
    for (let k = 1; k <= 8; k++) { const t = k / 8; pts.push(F0(u0 + side * 0.17 * t, 26.5 + 10 * (1 - t) ** 2)); }
    poly(pts, '#6a3a27');
    circ(...F0(u0 + side * 0.16, 28), 1.1, '#4e2a1b');
  }
  // الطابق الأعلى بنافذته ومحرابيه، وجانبه الأيمن، ثم الإفريز والجبهة المثلثة بأوانيها الحجرية
  quad(F0, 0.25, 0.75, 26.5, 37, CH.shade);
  masonry(F0, 0.25, 0.75, 26.5, 37, 1860, 8);
  for (const u of [0.28, 0.4, 0.6, 0.72]) quad(F0, u - 0.018, u + 0.018, 26.5, 37, CH.pil);
  quad(F0, 0.45, 0.55, 29.5, 35, '#3d2418');
  quad(F0, 0.44, 0.56, 28.9, 29.6, '#c98a62');
  for (const u of [0.32, 0.65]) arch(up(F0, 29.5), u, 0.035, 5, '#5a3020');
  const aU = aW + (aE - aW) * 0.75;
  quad(onI(aU, bF, bF - T), 0, 1, 26.5, 37, CH.lit);
  ledge(aW + (aE - aW) * 0.24, aU + 0.01, bF - 0.02, bF, 37, 39, 0.02);
  const pL = F0(0.24, 39), pR = F0(0.76, 39), pA = F0(0.5, 47.5);
  poly([pL, pR, pA], '#ad5a3b');
  poly([F0(0.3, 39.8), F0(0.7, 39.8), F0(0.5, 45.6)], '#93462d');
  ln(...pL, ...pA, '#d6946a', 1);
  ln(...pA, ...pR, '#d6946a', 1);
  for (const [u, h] of [[0.5, 47.5], [0.25, 39], [0.75, 39]]) {
    const [px, py] = F0(u, h);
    ln(px, py, px, py - 2.2, '#7b8466', 1);
    circ(px, py - 2.8, 1.2, '#9aa384');
  }
  for (const u of [0.15, 0.37, 0.58, 0.9]) {                                       // سواد المطر على الحجر
    const [px, py] = F0(u, 23.5);
    ln(px, py, px, py + 7 + 6 * hsh(i, j, 1900 + u * 100), 'rgba(35,25,18,0.2)', 1.4);
  }

  // أمام الواجهة: أرضية الرواق القديم من البلاط، وبقايا أعمدته قصيرة مكسورة كما في الصور
  poly([W(aW, bF, 0.3), W(aE, bF, 0.3), W(aE, 0.93, 0.3), W(aW, 0.93, 0.3)], '#c9a27c');
  [5, 3.5, 6, 4.2, 5.4].forEach((h, k) => {
    const a = aW + 0.06 + (aE - aW - 0.12) * k / 4;
    prism(a - 0.035, a + 0.035, 0.86, 0.93, 0, 1.2, ...CH.stone);
    prism(a - 0.025, a + 0.025, 0.875, 0.915, 1.2, h, '#b86c48', '#d0835a', CH.ledge[2]);
  });
  const low = (a0, a1, b0, b1) => prism(a0, a1, b0, b1, 0, 2.2, ...CH.stone);
  low(0.9, 0.96, -0.8, 0.3);                              // أساسات المدرسة يمين الصحن
  low(0.8, 0.96, -0.3, -0.25);
  low(0.8, 0.96, 0.25, 0.3);
  low(-0.95, -0.9, 0.62, 0.9);                            // وأمام البرج
  low(-0.95, -0.42, 0.86, 0.9);
  stones.filter(ahead).forEach(stone);
}

// ألواح صفيح مموجة: خطوط رأسية خفيفة على الوجهين، بمسار واحد لكل وجه
function corrugate(x, y, w, d, h) {
  const c = getCtx(), n = Math.round(w / 1.6);
  for (const [q, a] of [[qL(x, y, w, d), 0.17], [qR(x, y, w, d), 0.13]]) {
    c.beginPath();
    for (let k = 1; k < n; k++) { const p = q(k / n, 0), r = q(k / n, h); c.moveTo(p[0], p[1]); c.lineTo(r[0], r[1]); }
    c.strokeStyle = 'rgba(0,0,0,' + a + ')';
    c.lineWidth = 0.45;
    c.stroke();
  }
}

// نافذة بمصراعين مفتوحين على وجه
function shuttered(q, u, v, du, dv, glass, shutter) {
  poly([q(u, v), q(u + du, v), q(u + du, v + dv), q(u, v + dv)], glass);
  const s = du * 0.45;
  poly([q(u - s, v), q(u, v), q(u, v + dv), q(u - s, v + dv)], shutter);
  poly([q(u + du, v), q(u + du + s, v), q(u + du + s, v + dv), q(u + du, v + dv)], shutter);
}

// --- بيت المرتزقة (لا بوكا): كونفنتيو بطابقين من ألواح الصفيح المموجة بألوان زاهية، بنوافذ ذات مصاريع،
// وشرفة بدرابزين حديدي، ودرج خشبي خارجي، ولوحة بزخرفة الفيليتيادو، وسقف صفيح منخفض بصدأ، وخزان ماء ---
function mercs(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(30,20,15,0.22)');
  box(x, y + 2, 33, 16.5, 2.5, '#5f5a54', '#7a746c', '#857f76');
  const by = y - 0.5, w = 25, d = 12.5, h0 = 13, h1 = 12;
  box(x, by, w, d, h0, '#2f6db3', '#e8c23a');
  corrugate(x, by, w, d, h0);
  const gl = qL(x, by, w, d), gr = qR(x, by, w, d);
  poly([gr(0.42, 0), gr(0.58, 0), gr(0.58, 8.5), gr(0.42, 8.5)], '#5a3a22');         // الباب
  shuttered(gr, 0.14, 4, 0.12, 5, '#2b3442', '#3f9b5a');
  shuttered(gr, 0.76, 4, 0.12, 5, '#2b3442', '#3f9b5a');
  shuttered(gl, 0.56, 4, 0.12, 5, '#2b3442', '#c8392f');
  shuttered(gl, 0.82, 4, 0.1, 5, '#2b3442', '#c8392f');
  const s0 = gr(0.36, 9.4), s1 = gr(0.64, 9.4);                                      // لوحة الفيليتيادو
  poly([s0, s1, [s1[0], s1[1] - 3], [s0[0], s0[1] - 3]], '#1e1e22');
  for (let k = 0; k < 4; k++) {
    const p = gr(0.39 + k * 0.07, 10.9);
    el(p[0], p[1], 1, 0.7, ['#e8c23a', '#c8392f', '#3f9b5a', '#5fa8e8'][k]);
  }
  const uy = by - h0;
  box(x, uy, w, d, h1, '#c8392f', '#3f9b5a');
  corrugate(x, uy, w, d, h1);
  for (const q of [qL(x, uy, w, d), qR(x, uy, w, d)]) {                             // حافة خشبية بين الطابقين
    const a = q(0, 0.3), b = q(1, 0.3);
    ln(a[0], a[1], b[0], b[1], '#3a2e24', 1.2);
  }
  const ul = qL(x, uy, w, d), ur = qR(x, uy, w, d);
  shuttered(ul, 0.18, 3.5, 0.12, 5.5, '#2b3442', '#e8c23a');
  shuttered(ul, 0.62, 3.5, 0.12, 5.5, '#2b3442', '#e8c23a');
  poly([ur(0.44, 0.4), ur(0.58, 0.4), ur(0.58, 8.6), ur(0.44, 8.6)], '#5a3a22');      // باب الشرفة
  shuttered(ur, 0.16, 3.5, 0.12, 5.5, '#2b3442', '#2f6db3');
  shuttered(ur, 0.78, 3.5, 0.1, 5.5, '#2b3442', '#2f6db3');
  // الشرفة: أرضية ودرابزين حديدي أمام الوجه الأيمن
  const off = (p) => [p[0] + 1.4, p[1] + 2.8];
  const b0 = off(ur(0.32, 0)), b1 = off(ur(0.7, 0));
  poly([ur(0.32, 0), ur(0.7, 0), b1, b0], '#5a4632');
  const rail = (p) => [p[0], p[1] - 4.2];
  ln(rail(b0)[0], rail(b0)[1], rail(b1)[0], rail(b1)[1], '#1e1e22', 0.7);
  for (let k = 0; k <= 8; k++) {
    const p = [b0[0] + (b1[0] - b0[0]) * k / 8, b0[1] + (b1[1] - b0[1]) * k / 8];
    ln(p[0], p[1], p[0], p[1] - 4.2, '#1e1e22', 0.4);
  }
  // الدرج الخشبي الخارجي على الوجه الأيسر
  const st0 = gl(0.08, 0), st1 = gl(0.44, h0);
  const out = (p, k) => [p[0] - 0.9 * k, p[1] + 1.8 * k];
  poly([st0, st1, out(st1, 1), out(st0, 1)], '#6b4a2e');
  for (let k = 1; k < 9; k++) {
    const p = [st0[0] + (st1[0] - st0[0]) * k / 9, st0[1] + (st1[1] - st0[1]) * k / 9];
    ln(p[0], p[1], out(p, 1)[0], out(p, 1)[1], '#3e2a18', 0.5);
  }
  ln(out(st0, 1)[0], out(st0, 1)[1] - 4, out(st1, 1)[0], out(st1, 1)[1] - 4, '#3e2a18', 0.6);
  const roof = ridgeRoof(x, uy, w, d, h1, 8, { ov: 3, front: '#9aa1a8', back: '#6e747a', end: '#868c92', ridge: '#585d62', ridgeW: 1,
                                               tile: 'rgba(40,40,40,0.3)' });
  for (const [u, t, r] of [[0.25, 0.4, 2.6], [0.62, 0.65, 2], [0.8, 0.3, 1.7]]) {   // بقع صدأ
    const [px, py] = roofAt(roof, u, t);
    el(px, py, r * 1.6, r * 0.8, 'rgba(150,80,30,0.38)');
  }
  // خزان ماء على أعمدة قرب السنام
  const [tx, ty0] = roofAt(roof, 0.78, 0.7), ty = ty0 - 3;
  for (const dx of [-2.2, 2.2]) ln(tx + dx, ty + 3.4, tx + dx, ty, '#3a3a3a', 0.7);
  cyl(tx, ty, 3.2, 5.5, '#3c3f43', '#5a5e63', '#4a4d52');
  // لافتة فيليتيادو كبيرة على السقف: لوح أسود بإطار ذهبي وزخارف ملونة على عمودين، وفي وسطه قطعة ذهبية
  const a = roofAt(roof, 0.2, 0.42), b = roofAt(roof, 0.6, 0.42), up = (p, v) => [p[0], p[1] - v];
  for (const p of [roofAt(roof, 0.26, 0.42), roofAt(roof, 0.54, 0.42)]) ln(p[0], p[1], p[0], p[1] - 5, '#2a2420', 0.9);
  poly([up(a, 4), up(b, 4), up(b, 13), up(a, 13)], '#1e1e22');
  const c = getCtx();
  c.beginPath();
  for (const [p, q] of [[up(a, 4.8), up(b, 4.8)], [up(b, 4.8), up(b, 12.2)], [up(b, 12.2), up(a, 12.2)], [up(a, 12.2), up(a, 4.8)]]) {
    c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]);
  }
  c.strokeStyle = '#e2b84a';
  c.lineWidth = 0.7;
  c.stroke();
  const at = (u, v) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - v];
  ['#c8392f', '#3f9b5a', '#5fa8e8', '#e8c23a'].forEach((col, k) => {
    const [px, py] = at(k < 2 ? 0.16 + k * 0.12 : 0.6 + (k - 2) * 0.12 + 0.12, 8.5);
    el(px, py, 1.5, 1.1, col);
  });
  const [mx, my] = at(0.5, 8.5);
  circ(mx, my, 2.4, '#e8c45a');
  circ(mx, my, 1.4, '#c99a2c');
  // 12د: حبل غسيل ملون على الطابق الأعلى، وأصص على الشرفة، وبرميل وإطارات عند الركن
  const h0a = outP(ul(0.06, 10.6), OUT_L, 1), h1a = outP(ul(0.94, 10.6), OUT_L, 1);
  const cc = getCtx();
  cc.beginPath(); cc.moveTo(h0a[0], h0a[1]); cc.quadraticCurveTo((h0a[0] + h1a[0]) / 2, (h0a[1] + h1a[1]) / 2 + 1.6, h1a[0], h1a[1]);
  cc.strokeStyle = '#2a2420'; cc.lineWidth = 0.35; cc.stroke();
  ['#f4f1ea', '#c8392f', '#5fa8e8', '#e8c23a', '#3f9b5a', '#f4f1ea'].forEach((col, k) => {
    const t = 0.12 + k * 0.15, px = h0a[0] + (h1a[0] - h0a[0]) * t, py = h0a[1] + (h1a[1] - h0a[1]) * t + Math.sin(t * Math.PI) * 1.2;
    poly([[px - 0.9, py + 0.45], [px + 0.9, py - 0.45], [px + 0.9, py - 0.45 + 2.6 + (k % 2)], [px - 0.9, py + 0.45 + 2.6 + (k % 2)]], col);
  });
  for (const t of [0.15, 0.5, 0.85]) {
    const px = b0[0] + (b1[0] - b0[0]) * t, py = b0[1] + (b1[1] - b0[1]) * t - 0.6;
    box(px, py, 0.9, 0.45, 1.1, '#a85c3e', '#c06a46', '#7a3a28');
    el(px, py - 1.9, 1.2, 0.9, '#4f8a3e');
  }
  barrel(x + 26, y + 1.6, 1.6, 3.4, ['#2f6db3', '#3f7fc3', '#2a5ca8']);
  for (let k = 0; k < 3; k++) { el(x + 21.5, y + 4.2 - k * 0.9, 2.1, 1, '#1e1e20'); el(x + 21.5, y + 4.2 - k * 0.9, 1, 0.45, '#5f5a54'); }
}


// دكان مقوس على وجه السوق: قوس داكن، ومظلة مخططة بارزة عن الجدار، وأكياس توابل أمامه
// q دالة الوجه، وout اتجاه البروز عن الوجه على الشاشة
function soukShop(q, u, out, k) {
  arch(q, u, 0.16, 8, '#3a2a1e');
  const a = q(u - 0.015, 9), b = q(u + 0.175, 9), o = (p) => [p[0] + out[0] * 2.6, p[1] + out[1] * 2.6 + 1.6];
  const stripes = 4;
  for (let n = 0; n < stripes; n++) {
    const t0 = n / stripes, t1 = (n + 1) / stripes;
    const p0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], p1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1];
    poly([p0, p1, o(p1), o(p0)], (n + k) % 2 ? '#f1e6cf' : '#b8382c');
  }
  ['#c0392b', '#e1a12a', '#7a4a2a'].forEach((col, n) => {
    const p = q(u + 0.03 + n * 0.05, 0.6);
    circ(p[0] + out[0] * 1.6, p[1] + out[1] * 1.6, 1.15, col);
    circ(p[0] + out[0] * 1.6, p[1] + out[1] * 1.6 - 0.8, 0.7, n === 1 ? '#f2c14e' : col);
  });
}

// --- السوق الكبير (المدينة العربية): منصة حجرية، وقاعة سوق مسقوفة بحزام من البلاط الفيروزي، ودكاكين مقوسة
// بمظلات مخططة وأكياس توابل، وست قباب على السطح، وبوابة عالية بقوس مدبب وإطار فيروزي وفانوسين نحاسيين ---
function souk(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(40,25,10,0.22)');
  box(x, y + 2, 33, 16.5, 3, '#a8946e', '#c2ad86', '#cdb991');
  const by = y - 1, w = 26, d = 13, h = 14;
  box(x, by, w, d, h, '#d6c4a0', '#eadcbf', '#e1d1b0');
  const L = qL(x, by, w, d), R = qR(x, by, w, d);
  for (const q of [L, R]) poly([q(0, h - 2.6), q(1, h - 2.6), q(1, h - 1.2), q(0, h - 1.2)], '#2f8f8a');
  [0.08, 0.3, 0.52, 0.74].forEach((u, k) => soukShop(L, u, [-0.45, 0.9], k));
  [0.06, 0.78].forEach((u, k) => soukShop(R, u, [0.45, 0.9], k + 1));
  // القباب على السطح، الأبعد أولاً: P(s, t) نقطة على السطح بين ركنه الخلفي B وركنيه الأيسر والأيمن
  const top = by - h, B = [x, top - d], Lc = [x - w, top], Rc = [x + w, top];
  const P = (sv, tv) => [B[0] + (Lc[0] - B[0]) * sv + (Rc[0] - B[0]) * tv, B[1] + (Lc[1] - B[1]) * sv + (Rc[1] - B[1]) * tv];
  const domes = [];
  for (const sv of [0.28, 0.72]) for (const tv of [0.22, 0.5, 0.78]) domes.push([sv, tv]);
  domes.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [sv, tv] of domes) {
    const [px, py] = P(sv, tv), big = sv === 0.28 && tv === 0.5;
    box(px, py, big ? 5 : 3.8, big ? 2.5 : 1.9, 1.6, '#cdb991', '#e1d1b0', '#d8c7a6');
    dome(px, py - 1.6, big ? 5.4 : 4, '#efe2c6', '#cdb991', '#d4af4f');
  }
  // البوابة العالية في وسط الوجه الأيمن
  const pw = [R(0.36, 0), R(0.64, 0), R(0.64, h + 8), R(0.36, h + 8)];
  poly(pw, '#e6d6b4');
  poly([R(0.385, 1), R(0.615, 1), R(0.615, h + 6.6), R(0.385, h + 6.6)], '#2f8f8a');
  poly([R(0.405, 1.6), R(0.595, 1.6), R(0.595, h + 5.8), R(0.405, h + 5.8)], '#e9dcc0');
  poly([R(0.43, 0), R(0.57, 0), R(0.57, 10.5), R(0.5, 15.5), R(0.43, 10.5)], '#3a2a1e');
  poly([R(0.45, 0), R(0.55, 0), R(0.55, 8), R(0.45, 8)], '#6b4526');
  for (let n = 0; n < 5; n++) {                                     // شُرَف صغيرة فوق البوابة
    const a = R(0.37 + n * 0.06, h + 8), b = R(0.4 + n * 0.06, h + 8);
    poly([a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 2.2]], '#d6c4a0');
  }
  for (const u of [0.33, 0.67]) {                                   // فانوسان نحاسيان
    const p = R(u, 11);
    ln(p[0], p[1] - 1.6, p[0], p[1] + 0.6, '#5a3a22', 0.5);
    poly([[p[0] - 1.1, p[1] + 0.6], [p[0] + 1.1, p[1] + 0.6], [p[0] + 0.7, p[1] + 3.4], [p[0] - 0.7, p[1] + 3.4]], '#c99a3c');
    circ(p[0], p[1] + 2, 0.6, '#ffe7a3');
  }
  // 12د: سلسلة فوانيس نحاسية على الوجه الأيسر، وسجادة معروضة على حامل، وصناديق فاكهة عند الوجه الأيمن
  const s0 = outP(L(0.02, 11.2), OUT_L, 0.8), s1 = outP(L(0.98, 11.2), OUT_L, 0.8), c = getCtx();
  c.beginPath(); c.moveTo(s0[0], s0[1]);
  for (let k = 1; k <= 6; k++) { const t = k / 6, m = (k - 0.5) / 6;
    c.quadraticCurveTo(s0[0] + (s1[0] - s0[0]) * m, s0[1] + (s1[1] - s0[1]) * m + 1.4, s0[0] + (s1[0] - s0[0]) * t, s0[1] + (s1[1] - s0[1]) * t); }
  c.strokeStyle = '#4a3020'; c.lineWidth = 0.3; c.stroke();
  for (let k = 0; k < 6; k++) {
    const m = (k + 0.5) / 6, px = s0[0] + (s1[0] - s0[0]) * m, py = s0[1] + (s1[1] - s0[1]) * m + 0.7;
    poly([[px - 0.7, py], [px + 0.7, py], [px + 0.45, py + 1.8], [px - 0.45, py + 1.8]], '#c99a3c');
    circ(px, py + 1, 0.4, '#ffe7a3');
  }
  const cx = x - 28, cy = y + 0.8;
  lines([[cx - 3, cy + 1.5, cx - 3, cy - 9], [cx + 3, cy - 1.5, cx + 3, cy - 12]], '#5a3a22', 0.8);
  poly([[cx - 3, cy - 8.6], [cx + 3, cy - 11.6], [cx + 3, cy - 2.6], [cx - 3, cy + 0.4]], '#9a2a24');
  poly([[cx - 2.3, cy - 7.6], [cx + 2.3, cy - 9.9], [cx + 2.3, cy - 3.4], [cx - 2.3, cy - 1.1]], '#c8392f');
  poly([[cx, cy - 7.4], [cx + 1.4, cy - 5.4], [cx, cy - 3.4], [cx - 1.4, cy - 4.6]], '#2f5a8a');
  circ(cx, cy - 5.2, 0.5, '#f2c14e');
  for (const [px, py, f] of [[x + 17, y + 5.4, '#e8862a'], [x + 20.6, y + 3.6, '#7cb35a']]) {
    crate(px, py, 1.7);
    for (let k = 0; k < 3; k++) circ(px - 0.9 + k * 0.9, py - 1.9 - (k % 2) * 0.3, 0.6, f);
  }
}

// لافتة نيون رأسية بارزة عن وجه: لوح داكن بحافة متوهجة وخطوط حروف، q دالة الوجه وout اتجاه البروز على الشاشة
function neonBoard(q, u, v0, v1, out, col) {
  const a = q(u, v0), b = q(u, v1), o = (p, k) => [p[0] + out[0] * k, p[1] + out[1] * k];
  const pts = [a, b, o(b, 4.2), o(a, 4.2)];
  poly(pts, '#1c1220');
  const c = getCtx();
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < 4; k++) c.lineTo(pts[k][0], pts[k][1]);
  c.closePath();
  c.strokeStyle = col;
  c.lineWidth = 0.8;
  c.stroke();
  const n = Math.floor((v1 - v0) / 4);
  for (let k = 0; k < n; k++) {                                     // حروف متوهجة
    const p = o(q(u, v0 + 2 + k * 4), 1.1), r = o(q(u, v0 + 2 + k * 4), 3.1);
    ln(p[0], p[1], r[0], r[1], col, 0.9);
  }
}

// --- مقر الترياد (هونغ كونغ): ساحة إسفلتية، وبرج سكني عالٍ بطوابق ونوافذ بعضها مضاء ومكيفات، ولافتتا نيون رأسيتان
// ولوحة نيون فوق السطح، وبوابة حمراء بسقف أخضر ولوحة ذهبية، وفوانيس حمراء، وخزان ماء وهوائيات ---
function triads(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(20,15,25,0.25)');
  box(x, y + 2, 33, 16.5, 2.5, '#55555d', '#6b6b74', '#74747d');
  const by = y - 2, w = 19, d = 9.5, h = 58;
  box(x, by, w, d, h, '#857c72', '#a39a8f');
  const L = qL(x, by, w, d), R = qR(x, by, w, d);
  for (let f = 0; f < 7; f++) {                                     // الطوابق: بلاطة ونوافذ (بعضها مضاء)
    const v = 6 + f * 7.4;
    for (const q of [L, R]) { const a = q(0, v - 1.2), b = q(1, v - 1.2); ln(a[0], a[1], b[0], b[1], 'rgba(40,30,25,0.35)', 0.6); }
    for (let k = 0; k < 3; k++) {
      const lit = (f * 3 + k + i + j) % 4 === 0;
      wL(x, by, w, d, 0.1 + k * 0.3, v, 0.18, 4, lit ? '#ffd98a' : '#2b3442');
      wR(x, by, w, d, 0.1 + k * 0.3, v, 0.18, 4, (f + k) % 3 === 0 ? '#ffd98a' : '#2b3442');
    }
    const ac = R(0.82, v + 0.6);                                     // مكيف تحت النافذة
    box(ac[0], ac[1], 1.2, 0.6, 1.4, '#b8b4ae', '#d4d0ca', '#c8c4be');
  }
  neonBoard(R, 0.2, 14, 44, [0.45, 0.9], '#ff4fb4');
  neonBoard(L, 0.82, 18, 46, [-0.45, 0.9], '#4fe3ff');
  const top = by - h;                                               // السطح: خزان ماء وهوائيات ولوحة نيون
  cyl(x - 6, top - 4, 2.6, 4.5, '#3c3f43', '#5a5e63', '#4a4d52');
  ln(x + 7, top - 1, x + 7, top - 12, '#2a2a2e', 0.6);
  ln(x + 9, top + 1, x + 9, top - 8, '#2a2a2e', 0.5);
  const s0 = [x - 13, top - 1], s1 = [x + 3, top + 7];
  poly([s0, s1, [s1[0], s1[1] - 7], [s0[0], s0[1] - 7]], '#1c1220');
  for (let k = 0; k < 4; k++) {
    const t = 0.15 + k * 0.22, p = [s0[0] + (s1[0] - s0[0]) * t, s0[1] + (s1[1] - s0[1]) * t - 3.5];
    poly([[p[0] - 1.4, p[1] - 1.6], [p[0] + 1.4, p[1] - 0.9], [p[0] + 1.4, p[1] + 1.6], [p[0] - 1.4, p[1] + 0.9]], k % 2 ? '#ffd23f' : '#ff4fb4');
  }
  // البوابة الحمراء أمام الوجه الأيمن، والفوانيس
  const g0 = R(0.3, 0), g1 = R(0.7, 0);
  for (const p of [g0, g1]) { const o = [p[0] + 2.2, p[1] + 4.4]; ln(o[0], o[1], o[0], o[1] - 14, '#b3262f', 1.8); }
  const c0 = [g0[0] + 2.2, g0[1] + 4.4 - 14], c1 = [g1[0] + 2.2, g1[1] + 4.4 - 14];
  poly([[c0[0] - 2.5, c0[1] + 1], [c1[0] + 2.5, c1[1] - 0.5], [c1[0] + 1.5, c1[1] - 3.5], [c0[0] - 1.5, c0[1] - 2]], '#2f7a4a');
  ln(c0[0] - 1, c0[1] + 2.5, c1[0] + 1, c1[1] + 1, '#b3262f', 1.6);
  const pm = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2 + 3.6];
  poly([[pm[0] - 2.4, pm[1] - 1.6], [pm[0] + 2.4, pm[1] - 2.6], [pm[0] + 2.4, pm[1] + 0.8], [pm[0] - 2.4, pm[1] + 1.8]], '#d4af4f');
  for (const u of [0.12, 0.88]) {
    const p = R(u, 9);
    ln(p[0], p[1] - 1, p[0], p[1] + 1.5, '#3a2a20', 0.5);
    el(p[0], p[1] + 3.4, 1.8, 2.2, '#d8402e');
  }
  // 12د: أعواد غسيل خيزران من نوافذ الوجه الأيسر، ومكيفات عليه، ولافتة نيون أفقية فوق البوابة، ومزار أحمر صغير
  const poles = [], clothes = [];
  for (const [f, u] of [[1, 0.2], [3, 0.5], [4, 0.2], [5, 0.5]]) {
    const a = L(u + 0.09, 6 + f * 7.4 - 0.4), b = outP(a, OUT_L, 5.5);
    poles.push([a[0], a[1], b[0], b[1]]);
    for (const t of [0.35, 0.7]) clothes.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (f + t * 10) % 3]);
  }
  lines(poles, '#c9b07a', 0.5);
  for (const [px, py, k] of clothes) poly([[px - 0.7, py - 0.35], [px + 0.7, py + 0.35], [px + 0.7, py + 2.6], [px - 0.7, py + 1.9]],
                                          ['#f4f1ea', '#5fa8e8', '#e8a23a'][Math.floor(k)]);
  for (let f = 0; f < 7; f += 2) { const ac = L(0.06, 6 + f * 7.4 + 0.6); box(ac[0], ac[1], 1.2, 0.6, 1.4, '#b8b4ae', '#d4d0ca', '#c8c4be'); }
  const n0 = R(0.3, 12.6), n1 = R(0.7, 12.6);
  poly([n0, n1, [n1[0], n1[1] - 2.6], [n0[0], n0[1] - 2.6]], '#1c1220');
  ln(n0[0] + 1, n0[1] - 1.3, n1[0] - 1, n1[1] - 1.3, '#ffd23f', 0.8);
  const sh = outP(R(0.1, 0), OUT_R, 1.6);
  box(sh[0], sh[1], 1.4, 0.7, 2.4, '#8a1e22', '#b3262f', '#c8392f');
  circ(sh[0] + 0.4, sh[1] - 1.4, 0.45, '#ffd98a');
  lines([[sh[0] - 0.4, sh[1] - 2.4, sh[0] - 0.6, sh[1] - 4.4], [sh[0] + 0.3, sh[1] - 2.6, sh[0] + 0.4, sh[1] - 4.6]], '#d8c8a8', 0.3);
}

// --- إسطبل الفيلة (جايبور): منصة من الحجر الرملي، وقصر وردي بحزامين أبيضين ونوافذ مشبكة (جالي)، وبوابة عالية
// تسع الفيل، وأكشاك بقباب صغيرة (تشاتري) على أركان السطح، وقبة وسطى على قاعدة بعلم زعفراني ---
function chhatri(px, py, r) {
  for (const dx of [-r * 0.7, r * 0.7]) ln(px + dx, py, px + dx, py - r * 1.6, '#f4e3e6', 0.7);
  box(px, py - r * 1.6, r, r / 2, 0.8, '#e8c9cf', '#f4e3e6', '#f0d9dc');
  dome(px, py - r * 1.6 - 0.8, r * 0.9, '#f0d9dc', '#d8b6bb', '#d4af4f');
}

function stable(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(50,25,20,0.22)');
  box(x, y + 2, 33, 16.5, 3, '#c39c78', '#d8b48e', '#e0c09d');
  const by = y - 1, w = 25, d = 12.5, h = 18;
  box(x, by, w, d, h, '#cc6c7e', '#e48a9b', '#d9798a');
  const L = qL(x, by, w, d), R = qR(x, by, w, d);
  for (const q of [L, R]) {
    for (const v of [1.4, h - 1.6]) { const a = q(0, v), b = q(1, v); ln(a[0], a[1], b[0], b[1], '#f4e3e6', 1.2); }
  }
  for (const u of [0.08, 0.34, 0.6, 0.84]) {                        // نوافذ مشبكة (جالي)
    arch((a, b) => L(a, b + 5), u, 0.1, 7, '#f4e3e6');
    for (let k = 0; k < 3; k++) { const p = L(u + 0.05, 7 + k * 1.8); circ(p[0], p[1], 0.35, '#b05a6a'); }
  }
  for (const u of [0.06, 0.82]) {
    arch((a, b) => R(a, b + 5), u, 0.11, 7, '#f4e3e6');
    for (let k = 0; k < 3; k++) { const p = R(u + 0.055, 7 + k * 1.8); circ(p[0], p[1], 0.35, '#b05a6a'); }
  }
  arch(R, 0.31, 0.38, 15.9, '#d4af4f');                             // 12د: حافة ذهبية حول البوابة
  arch(R, 0.32, 0.36, 15, '#f4e3e6');                               // البوابة العالية بإطار أبيض
  arch((a, b) => R(a + 0.02, b), 0.32, 0.32, 13.6, '#3a2420');
  arch((a, b) => R(a + 0.05, b), 0.32, 0.26, 10, '#6b4526');
  const top = by - h;
  chhatri(x - w + 4, top + 0.5, 3.4);                               // الأكشاك على الأركان الظاهرة، ثم القبة الوسطى
  chhatri(x + w - 4, top + 0.5, 3.4);
  box(x, top - 1, 7, 3.5, 4, '#cc6c7e', '#e48a9b', '#d9798a');
  dome(x, top - 5, 7.2, '#f0d9dc', '#d8b6bb', '#d4af4f');
  ln(x, top - 18, x, top - 26, '#5a3a22', 0.7);
  poly([[x, top - 26], [x + 7, top - 24.5], [x, top - 23]], '#f2a33a');
  chhatri(x, top + d - 2, 3.4);
  // 12د: زهور مرسومة بين النوافذ، وحزم تبن على الركن الأيسر، وحوض ماء حجري، وجرس معلّق فوق البوابة
  for (const u of [0.24, 0.5, 0.76]) {
    const p = L(u, 9);
    for (let k = 0; k < 5; k++) { const t = k * TAU / 5; circ(p[0] + Math.cos(t) * 0.9, p[1] + Math.sin(t) * 0.9, 0.45, '#f4e3e6'); }
    circ(p[0], p[1], 0.4, '#e2a33a');
  }
  for (const [px, py] of [[x - 27, y + 1.6], [x - 24.5, y + 3.4], [x - 26, y - 0.6]]) {
    box(px, py, 2.4, 1.2, 2, '#b8943a', '#d8b44e', '#e6c45e');
    const q = qR(px, py, 2.4, 1.2), a = q(0, 1), b = q(1, 1);
    ln(a[0], a[1], b[0], b[1], '#8a6a2a', 0.35);
  }
  box(x + 18, y + 5, 3.6, 1.8, 1.6, '#a07c5c', '#c39c78', '#5fa8c8');
  el(x + 18, y + 3.4, 2.4, 1.1, '#7cc0dc');
  const g = R(0.5, 14.4);
  ln(g[0], g[1], g[0], g[1] + 1.6, '#5a3a22', 0.4);
  poly([[g[0] - 0.9, g[1] + 3.4], [g[0] - 0.6, g[1] + 1.6], [g[0] + 0.6, g[1] + 1.6], [g[0] + 0.9, g[1] + 3.4]], '#d4af4f');
}

// --- الكاتدرائية (المدينة الأوروبية، بدل محطة القطار): منصة حجرية بدرج، وصحن من الحجر بنوافذ مدببة ملونة ودعامات
// وسقف أردواز حاد، وواجهة بنافذة وردية وبوابة مدببة عميقة تحت جملون، وبرجان توأمان في كل منهما جرس ذهبي تحت قمة
// مدببة بصليب ---
function cathedral(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(30,25,20,0.22)');
  box(x, y + 2, 33, 16.5, 3, '#7c766c', '#9a9388', '#a8a196');
  box(x + 13, y + 10.5, 7, 3.5, 2, '#7c766c', '#9a9388', '#a8a196');               // الدرج أمام البوابة
  // الصحن نحو الركن الأيسر
  const nx = x - 6, ny = y - 3, w = 20, d = 10, h = 17;
  box(nx, ny, w, d, h, '#8b857a', '#a59e91');
  const L = qL(nx, ny, w, d);
  for (const u of [0.1, 0.35, 0.6]) {                                              // نوافذ مدببة بزجاج ملون
    arch((a, b) => L(a, b + 3), u, 0.14, 10.5, '#2c2540');
    arch((a, b) => L(a + 0.018, b + 3.6), u, 0.104, 9, '#5b4a9a');
    const c = L(u + 0.07, 9.5);
    circ(c[0], c[1], 1, '#e2b84a');
  }
  for (const u of [0.02, 0.27, 0.52, 0.77]) {                                      // الدعامات
    const a = L(u, 0), b = L(u, h - 1.5);
    ln(a[0] - 1.4, a[1] + 0.7, b[0], b[1], '#6f695f', 2.2);
  }
  ridgeRoof(nx, ny, w, d, h, 14, { ov: 1.5, front: '#48505a', back: '#353c45', end: '#56606b', ridge: '#2b3137', ridgeW: 1,
                                    tile: 'rgba(20,24,30,0.3)' });
  for (const u of [0.02, 0.27, 0.52, 0.77]) {                                      // 12د: قمم صغيرة فوق الدعامات
    const b = L(u, h - 1.5);
    cone(b[0], b[1] + 0.4, 1, 4.6, '#7a746a', '#968f83');
    circ(b[0], b[1] - 4.4, 0.4, '#d4af4f');
  }
  for (const [gx, gy] of [[x - 26, y + 1.4], [x - 22.4, y + 3.4], [x - 23, y + 0.2]]) {   // مقبرة صغيرة: شواهد وصليب
    box(gx, gy, 1.1, 0.55, 2.6, '#6f695f', '#8b857a', '#a59e91');
  }
  lines([[x - 19.4, y + 4.6, x - 19.4, y - 1.4], [x - 21, y + 0.4, x - 17.8, y - 1.2]], '#8b857a', 0.9);
  // الواجهة نحو الركن الأيمن، والبرج الخلفي قبلها والأمامي بعدها
  const fx = x + 9, fy = y + 3.5, fw = 16, fd = 8, fh = 21;
  const tower = (tx, ty) => {
    const th = fh + 13;
    box(tx, ty, 5.6, 2.8, th, '#8a8479', '#a9a295');
    const T = qR(tx, ty, 5.6, 2.8), TL = qL(tx, ty, 5.6, 2.8);
    for (const q of [T, TL]) {                                                     // فتحة الجرس والجرس فيها
      arch((a, b) => q(a, b + fh + 2), 0.2, 0.6, 7.5, '#1c1820');
      const c = q(0.5, fh + 5.6);
      poly([[c[0] - 1.6, c[1] + 1.4], [c[0] - 1, c[1] - 1.4], [c[0] + 1, c[1] - 1.4], [c[0] + 1.6, c[1] + 1.4]], '#d9a93a');
      circ(c[0], c[1] - 1.6, 1, '#e8c25a');
    }
    for (const v of [fh - 1, th - 1]) {                                            // أحزمة حجرية
      const a = TL(0, v), b = T(0, v), e = T(1, v);
      ln(a[0], a[1], b[0], b[1], '#c9c1b2', 1);
      ln(b[0], b[1], e[0], e[1], '#d6cfc1', 1);
    }
    cone(tx, ty - th, 6.4, 17, '#3d444e', '#56606b');                              // القمة المدببة والصليب
    ln(tx, ty - th - 17, tx, ty - th - 22.5, '#d4af4f', 0.9);
    ln(tx - 1.8, ty - th - 20.6, tx + 1.8, ty - th - 20.6, '#d4af4f', 0.9);
  };
  tower(fx + fw, fy);
  box(fx, fy, fw, fd, fh, '#958f84', '#b1aa9d');
  const R = qR(fx, fy, fw, fd), mid = 0.58;
  poly([R(0.2, fh), R(0.96, fh), R(mid, fh + 9)], '#a39c8f');                    // الجملون فوق الواجهة
  arch(R, mid - 0.17, 0.34, 12.5, '#c9c1b2');                                     // البوابة المدببة العميقة
  arch((a, b) => R(a + 0.03, b), mid - 0.17, 0.28, 11.2, '#3a2c22');
  arch((a, b) => R(a + 0.07, b), mid - 0.17, 0.2, 9.4, '#6b4526');
  faceDisc(R, mid, 16.4, 3.8, fw, '#d6cfc1');                                     // النافذة الوردية
  faceDisc(R, mid, 16.4, 3.1, fw, '#2c2540');
  faceDisc(R, mid, 16.4, 2.3, fw, '#7a5cc0');
  const rc0 = R(mid, 16.4);
  for (let k = 0; k < 6; k++) {
    const t = k * TAU / 6, p = R(mid + Math.cos(t) * 3.1 / fw, 16.4 + Math.sin(t) * 3.1);
    ln(rc0[0], rc0[1], p[0], p[1], 'rgba(230,210,140,0.75)', 0.5);
  }
  circ(rc0[0], rc0[1], 0.8, '#e8c25a');
  for (const u of [mid - 0.22, mid + 0.2]) {                                       // 12د: تمثالا قديسين في محرابين بجانب البوابة
    const p = R(u + 0.02, 1.4);
    arch((a, b) => R(a, b + 0.6), u - 0.035, 0.11, 8, '#4f4a42');
    poly([R(u - 0.02, 0.6), R(u + 0.06, 0.6), R(u + 0.06, 1.4), R(u - 0.02, 1.4)], '#d6cfc1');
    poly([[p[0] - 0.7, p[1]], [p[0] + 0.9, p[1] - 0.5], [p[0] + 0.7, p[1] - 5.6], [p[0] - 0.5, p[1] - 5.2]], '#ddd6c8');
    circ(p[0] + 0.1, p[1] - 6.4, 0.9, '#e6e0d4');
  }
  tower(fx, fy + fd);
}

// --- منجم الفضة (المدينة المكسيكية): تل صخري بفتحة نفق بإطار خشبي، وبرج رفع خشبي بعجلة كبيرة، وعربة على قضبان
// محمّلة بالفضة اللامعة، وكومة خام، ومكتب طين صغير بسقف قرميد وفانوس ---
function mine(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(40,25,15,0.24)');
  box(x, y + 2, 33, 16.5, 2, '#8c7356', '#a68a69', '#b0946f');
  // التل الصخري خلف الوسط
  poly([[x - 30, y - 1], [x - 22, y - 14], [x - 10, y - 26], [x + 4, y - 30], [x + 18, y - 22], [x + 28, y - 8], [x + 30, y],
        [x + 8, y + 6], [x - 14, y + 5]], '#8a6b4a');
  poly([[x + 4, y - 30], [x + 18, y - 22], [x + 28, y - 8], [x + 30, y], [x + 8, y + 6], [x + 2, y - 8]], '#a5835c');
  for (const [px, py, r] of [[-16, -12, 3], [10, -18, 2.4], [20, -8, 2.2], [-4, -22, 2]]) el(x + px, y + py, r * 1.4, r * 0.8, '#6e5236');
  // فتحة النفق بإطارها الخشبي على وجه التل
  poly([[x + 6, y - 1], [x + 16, y - 6], [x + 16, y - 17], [x + 6, y - 12]], '#1e140c');
  for (const [a, b] of [[[x + 5.4, y - 0.6], [x + 5.4, y - 13]], [[x + 16.6, y - 5.6], [x + 16.6, y - 18]]]) ln(a[0], a[1], b[0], b[1], '#6b4a2e', 1.6);
  ln(x + 4.6, y - 13, x + 17.4, y - 19.2, '#6b4a2e', 1.8);
  // القضبان والعربة المحمّلة بالفضة (12د: وعوارض خشبية تحتها)
  lines([0, 1, 2, 3, 4, 5, 6].map(k => { const t = k / 6, px = x + 11 + 15 * t, py = y - 3 + 7.5 * t; return [px - 2.4, py - 1.2, px + 2.4, py + 1.2]; }),
        '#5a3e26', 0.9);
  for (const off of [-1.6, 1.6]) ln(x + 11 + off, y - 3 + off * 0.5, x + 26 + off, y + 4.5 + off * 0.5, '#4a4038', 0.6);
  box(x + 20, y + 2.5, 4, 2, 3.2, '#4a3a2c', '#5e4a38', '#3a2c20');
  for (const [px, py] of [[x + 18.6, y + 1.2], [x + 20.8, y + 1.6], [x + 19.8, y - 0.2], [x + 21.6, y + 0.2]]) circ(px, py - 2.4, 1.2, '#d9dde2');
  circ(x + 20.2, y - 2.8, 0.5, '#ffffff');
  for (const [px, py] of [[x + 17, y + 3.6], [x + 22.5, y + 4.6]]) circ(px, py, 0.9, '#2a2420');
  // كومة الخام على الرصيف
  for (const [px, py, r, c] of [[-12, 8, 2.4, '#b8bcc2'], [-9, 9, 1.8, '#d9dde2'], [-10.5, 6.4, 1.6, '#c9cdd2'], [-7.4, 7.4, 1.3, '#eef1f4']]) circ(x + px, y + py, r, c);
  // برج الرفع الخشبي بعجلته
  const tx = x - 14, ty = y - 6;
  ln(tx - 5, ty, tx, ty - 26, '#6b4a2e', 1.3);
  ln(tx + 5, ty + 2, tx, ty - 26, '#5a3e26', 1.3);
  ln(tx - 3.5, ty - 8, tx + 3.6, ty - 6.4, '#5a3e26', 0.8);
  ln(tx - 2, ty - 17, tx + 2.2, ty - 16, '#5a3e26', 0.8);
  const c = getCtx();
  c.beginPath();
  c.ellipse(tx, ty - 26, 4.2, 4.6, 0, 0, TAU);
  c.strokeStyle = '#3a2716';
  c.lineWidth = 1.2;
  c.stroke();
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; ln(tx - Math.cos(a) * 4, ty - 26 - Math.sin(a) * 4.4, tx + Math.cos(a) * 4, ty - 26 + Math.sin(a) * 4.4, '#3a2716', 0.5); }
  ln(tx, ty - 26, x + 9, y - 13, '#2a2420', 0.4);                      // الحبل إلى النفق
  // المكتب الطيني الصغير
  box(x - 22, y + 3, 6, 3, 7, '#c9a27a', '#dcb88e');
  ridgeRoof(x - 22, y + 3, 6, 3, 7, 4, { ov: 1.2, front: '#b5543a', back: '#8a3e2a', end: '#a24a33', ridge: '#7a3424', ridgeW: 0.8 });
  wR(x - 22, y + 3, 6, 3, 0.3, 1, 0.3, 4, '#4a3020');
  const lamp = [x - 16.5, y - 2];
  ln(lamp[0], lamp[1] + 2, lamp[0], lamp[1] - 2, '#3a2a20', 0.5);
  el(lamp[0], lamp[1] - 3.2, 1, 1.3, '#ffd98a');
  // 12د: براميل عند المكتب، وصندوق متفجرات أحمر، ومعول ومجرفة مسنودان، وفانوس عند النفق، وصبار
  barrel(x - 27.5, y + 2, 1.5, 3.2);
  barrel(x - 25, y + 4.4, 1.5, 3.2);
  crate(x + 1, y + 9.2, 1.8, ['#8a1e1e', '#b3262f', '#c8392f']);
  { const q = qR(x + 1, y + 9.2, 1.8, 0.9), a = q(0.2, 1), b = q(0.8, 1.2); ln(a[0], a[1], b[0], b[1], '#f2d46a', 0.4); }
  lines([[x - 17.6, y + 6.6, x - 15.8, y - 1], [x - 15.6, y + 7.4, x - 14.4, y - 0.4]], '#6b4a2e', 0.6);
  ln(x - 16.8, y - 0.6, x - 14.6, y - 1.4, '#5c5650', 0.9);
  poly([[x - 15, y - 0.8], [x - 13.8, y - 1.2], [x - 13.6, y + 0.8], [x - 14.6, y + 1.2]], '#7a7470');
  ln(x + 11, y - 18.6, x + 11, y - 16.6, '#2a2420', 0.4);
  el(x + 11, y - 15.6, 0.9, 1.1, '#ffd98a');
  const kx = x + 27, ky = y + 1.2;
  lines([[kx, ky, kx, ky - 8.4]], '#4f8a3e', 1.6);
  lines([[kx - 2.2, ky - 3.6, kx - 2.2, ky - 6.4], [kx + 2, ky - 4.6, kx + 2, ky - 7.6]], '#4f8a3e', 1.1);
  lines([[kx - 2.2, ky - 3.6, kx - 0.4, ky - 3.6], [kx + 2, ky - 4.6, kx + 0.4, ky - 4.6]], '#4f8a3e', 1);
}

// --- البنك (شيكاغو الثلاثينيات): درج حجري، ومبنى كلاسيكي من الحجر الفاتح بأربعة أعمدة أمام الوجه الأيمن وجملون
// مثلث ولوحة ذهبية، وأبواب برونزية، ونوافذ عالية مشبكة، وإفريز، وسارية بعلم على السطح ---
function bank(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(30,25,20,0.22)');
  box(x, y + 2, 33, 16.5, 2.5, '#9e9a92', '#b8b3aa', '#c2bdb4');
  box(x, y - 0.5, 27, 13.5, 2, '#b8b3aa', '#d2cdc4', '#dad5cc');
  const by = y - 2.5, w = 24, d = 12, h = 24;
  box(x, by, w, d, h, '#cfc8ba', '#e6dfd1');
  const L = qL(x, by, w, d), R = qR(x, by, w, d);
  for (const u of [0.12, 0.38, 0.64]) {                              // نوافذ عالية مشبكة
    wL(x, by, w, d, u, 4, 0.14, 15, '#3b4652');
    for (let k = 1; k < 4; k++) { const a = L(u, 4 + k * 3.8), b = L(u + 0.14, 4 + k * 3.8); ln(a[0], a[1], b[0], b[1], '#cfc8ba', 0.4); }
  }
  poly([R(0.36, 0), R(0.64, 0), R(0.64, 11), R(0.36, 11)], '#6e4f2a');   // الأبواب البرونزية
  ln(R(0.5, 0)[0], R(0.5, 0)[1], R(0.5, 11)[0], R(0.5, 11)[1], '#a37a3e', 0.6);
  for (const u of [0.1, 0.36, 0.64, 0.9]) {                          // الأعمدة أمام الوجه الأيمن
    const p = R(u, 0), o = [p[0] + 3, p[1] + 6];
    box(o[0], o[1], 1.5, 0.75, h - 3, '#d8d1c3', '#efe9dc', '#f4efe3');
    for (const v of [h - 3]) box(o[0], o[1] - v, 2.2, 1.1, 1.2, '#cfc8ba', '#e6dfd1', '#eee8dc');
  }
  // الجملون فوق الأعمدة واللوحة الذهبية
  const g0 = R(0.02, h), g1 = R(0.98, h), out = (p) => [p[0] + 3, p[1] + 6];
  const a0 = out(g0), a1 = out(g1), apex = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2 - 8];
  poly([a0, a1, apex], '#e6dfd1');
  poly([[a0[0] + 2.4, a0[1] - 1.4], [a1[0] - 2.4, a1[1] + 0.2], [apex[0], apex[1] + 2.4]], '#cfc8ba');
  const pl = [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2 + 2.6];
  poly([[pl[0] - 7, pl[1] + 1.6], [pl[0] + 7, pl[1] - 1.9], [pl[0] + 7, pl[1] + 0.7], [pl[0] - 7, pl[1] + 4.2]], '#d4af4f');
  for (let k = 0; k < 4; k++) { const px = pl[0] - 5 + k * 3.3, py = pl[1] + 2.2 - k * 0.82; ln(px, py - 0.6, px + 1.8, py - 1.05, '#7a5a1c', 0.5); }
  // الإفريز والسطح والعلم
  for (const q of [L, R]) { const a = q(0, h - 0.6), b = q(1, h - 0.6); ln(a[0], a[1], b[0], b[1], '#b8b3aa', 1.4); }
  ln(x - 4, by - h - 3, x - 4, by - h - 18, '#3a3530', 0.7);
  poly([[x - 4, by - h - 18], [x + 5, by - h - 16.5], [x - 4, by - h - 14]], '#2f7a4a');
  // 12د: أسنان ذهبية تحت الإفريز، وعمودا إنارة على الدرج، وساعة فوق الأبواب، وشاحنة نقل أموال مصفحة
  const dent = [];
  for (const q of [L, R]) for (let k = 1; k < 16; k++) { const a = q(k / 16, h - 2), b = q(k / 16, h - 1.2); dent.push([a[0], a[1], b[0], b[1]]); }
  lines(dent, '#c9a046', 0.5);
  for (const [px, py] of [[x - 10, y + 8.6], [x + 28, y + 1.6]]) {
    box(px, py, 0.9, 0.45, 1.2, '#1e2126', '#2c3036', '#24282d');
    ln(px, py - 1.2, px, py - 11, '#1e2126', 0.8);
    circ(px, py - 12.2, 1.5, '#fff4d0');
    poly([[px - 1.3, py - 13.2], [px + 1.3, py - 13.2], [px, py - 14.6]], '#1e2126');
  }
  faceDisc(R, 0.5, 13.4, 1.8, w, '#d4af4f');
  faceDisc(R, 0.5, 13.4, 1.3, w, '#f4efe2');
  { const o = R(0.5, 13.4); ln(o[0], o[1], o[0], o[1] - 1, '#262626', 0.35); ln(o[0], o[1], o[0] + 0.8, o[1], '#262626', 0.35); }
  const tx = x - 19, ty = y + 5;
  el(tx - 2.8, ty + 0.9, 0.9, 0.55, '#1e1e20'); el(tx + 2.4, ty + 1.6, 0.9, 0.55, '#1e1e20');
  box(tx, ty, 4.8, 2.4, 3.6, '#2f4a3a', '#3f5f4a', '#4a6a54');
  box(tx + 2.6, ty + 1.2, 1.8, 0.9, 2.6, '#2f4a3a', '#3f5f4a', '#4a6a54');
  wR(tx + 2.6, ty + 1.2, 1.8, 0.9, 0.2, 1.4, 0.6, 1, '#8fb0c8');
  const vl = qL(tx, ty, 4.8, 2.4);
  for (const u of [0.3, 0.7]) { const p = vl(u, 2); circ(p[0], p[1], 0.35, '#c9a046'); }
}

// ================= مباني مدن الأحداث (12هـ، القسم 3.13) =================
// شُرَف مثلثة بيضاء على حافتي وجهين q1 وq2 عند الارتفاع h
function whiteTeeth(qs, h, n, c = '#f4ecdc') {
  for (const q of qs) for (let k = 0; k < n; k++) {
    const a = q(k / n, h), b = q((k + 1) / n, h), m = q((k + 0.5) / n, h + 2.6);
    poly([a, b, m], c);
  }
}

// --- قصر سلوى (الدرعية): قصر طين نجدي بجدران تضيق للأعلى وأحزمة وفتحات مثلثة، وشُرَف بيضاء، وطابق خلفي أعلى،
// وبرج مراقبة مستدق على ركنه، وباب خشبي بنقوش بيضاء، ونخلتان ---
function salwa(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(40,25,10,0.22)');
  box(x, y + 2, 33, 16.5, 2.5, '#a88a62', '#c2a47a', '#ccae84');
  const by = y - 0.5, M = ['#a07c52', '#c9a476', '#d6b488'];
  box(x + 5, by - 6, 12, 6, 30, M[0], M[1], M[2]);                       // الطابق الخلفي الأعلى
  whiteTeeth([qL(x + 5, by - 6, 12, 6), qR(x + 5, by - 6, 12, 6)], 30, 5);
  for (const u of [0.25, 0.6]) { wL(x + 5, by - 6, 12, 6, u, 22, 0.12, 3, '#3a2618'); wR(x + 5, by - 6, 12, 6, u, 22, 0.12, 3, '#3a2618'); }
  frustum(x, by, 24, 22.5, 18, M[0], M[1], M[2]);                         // البيت الكبير بجدران تضيق
  const L = fL(x, by, 24, 22.5, 18), R = fR(x, by, 24, 22.5, 18);
  for (const q of [L, R]) {
    for (const v of [6.5, 13]) { const a = q(0, v), b = q(1, v); ln(a[0], a[1], b[0], b[1], 'rgba(90,60,30,0.35)', 0.6); }
    for (let k = 0; k < 5; k++) {                                         // صف فتحات مثلثة عالية
      const u = 0.1 + k * 0.18, a = q(u, 14.6), b = q(u + 0.06, 14.6), m = q(u + 0.03, 16.4);
      poly([a, b, m], '#3a2618');
    }
  }
  for (const u of [0.12, 0.42, 0.72]) poly([L(u, 7.5), L(u + 0.1, 7.5), L(u + 0.1, 11), L(u, 11)], '#3a2618');
  whiteTeeth([L, R], 18, 8);
  poly([R(0.38, 0), R(0.6, 0), R(0.6, 10), R(0.38, 10)], '#6b4526');       // الباب ونقوشه البيضاء
  for (let k = 0; k < 3; k++) { const a = R(0.42, 2 + k * 2.6), b = R(0.49, 3.4 + k * 2.6), c = R(0.56, 2 + k * 2.6); poly([a, b, c], '#efe2c8'); }
  poly([R(0.35, 10), R(0.63, 10), R(0.63, 11.3), R(0.35, 11.3)], '#efe2c8');
  // برج المراقبة المستدق على الركن الأيسر
  const tx = x - 22, ty = y + 1;
  poly([[tx - 4.2, ty], [tx + 4.2, ty], [tx + 3, ty - 34], [tx - 3, ty - 34]], M[1]);
  poly([[tx - 4.2, ty], [tx - 1.2, ty + 1], [tx - 1, ty - 33.6], [tx - 3, ty - 34]], M[0]);
  for (const v of [10, 20, 28]) rc(tx - 0.5, ty - v, 1, 2.6, '#3a2618');
  for (let k = 0; k < 4; k++) poly([[tx - 3 + k * 1.5, ty - 34], [tx - 1.5 + k * 1.5, ty - 34], [tx - 2.25 + k * 1.5, ty - 36.6]], '#f4ecdc');
  streetPalm(x + 26, y + 1, i, j);
  streetPalm(x - 9, y + 12, i + 1, j);
}

// --- مرصد تشومسونغداي (غيونغجو): برج حجري على شكل قارورة بمداميك، ونافذة مربعة في وسطه، وإطار مربع مزدوج فوقه،
// على قاعدة مربعة بدرجتين، وفانوسان حجريان وأشجار صنوبر ---
function observatory(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(30,25,20,0.22)');
  box(x, y + 2, 33, 16.5, 2, '#7f7a70', '#9c968a', '#aaa498');
  box(x, y - 0.5, 14, 7, 2.6, '#8a8478', '#a8a296', '#b8b2a6');
  box(x, y - 3.1, 11, 5.5, 2.2, '#8a8478', '#a8a296', '#b8b2a6');
  const by = y - 5.3, H = 40, c = getCtx();
  const rAt = (t) => 8.2 - 3.4 * t + 2.6 * Math.sin(t * Math.PI) * (1 - t) - 0.9 * t * t;   // انتفاخ القارورة ثم عنقها
  const side = [], back = [];
  for (let k = 0; k <= 16; k++) { const t = k / 16, r = rAt(t); side.push([x - r, by - t * H]); back.push([x + r, by - t * H]); }
  c.beginPath();
  c.moveTo(side[0][0], side[0][1]);
  for (const p of side) c.lineTo(p[0], p[1]);
  for (const p of back.slice().reverse()) c.lineTo(p[0], p[1]);
  c.closePath();
  const g = c.createLinearGradient(x - 8, 0, x + 8, 0);
  g.addColorStop(0, '#8f877a'); g.addColorStop(0.55, '#c9c0ae'); g.addColorStop(1, '#a89f8f');
  c.fillStyle = g; c.fill();
  const rows = [];                                                         // مداميك الحجر (27 صفاً في الأصل)
  for (let k = 1; k < 20; k++) { const t = k / 20, r = rAt(t); rows.push([x - r, by - t * H + r * 0.12, x + r, by - t * H + r * 0.12]); }
  lines(rows, 'rgba(70,62,50,0.32)', 0.4);
  const wy = by - H * 0.5;                                                 // النافذة المربعة
  poly([[x - 1.2, wy + 2.8], [x + 2.2, wy + 1.4], [x + 2.2, wy - 2], [x - 1.2, wy - 0.6]], '#2a2420');
  const ty = by - H, tw = 4.4;                                             // الإطار المربع المزدوج فوقه
  for (const [v, w] of [[0, tw], [2.2, tw]]) {
    const q = [[x - w, ty - v], [x, ty + w / 2 - v], [x + w, ty - v], [x, ty - w / 2 - v]];
    c.beginPath(); c.moveTo(q[0][0], q[0][1]); for (const p of q.slice(1)) c.lineTo(p[0], p[1]); c.closePath();
    c.strokeStyle = '#d8d0c0'; c.lineWidth = 1.2; c.stroke();
  }
  for (const [px, py] of [[x - 21, y + 1.5], [x + 21, y + 1.5]]) {         // فانوسان حجريان
    box(px, py, 1.6, 0.8, 1.4, '#7d786f', '#9a948a', '#aaa49a');
    box(px, py - 1.4, 0.7, 0.35, 4, '#8a857b', '#a29c92');
    box(px, py - 5.4, 1.8, 0.9, 2.2, '#8a857b', '#a29c92', '#f2d58a');
    poly([[px - 2.4, py - 7.6], [px, py - 9.8], [px + 2.4, py - 7.6], [px, py - 6.6]], '#6f6a62');
  }
  for (const [px, py] of [[x - 27, y - 0.5], [x + 26, y - 1.5]]) {         // صنوبر
    ln(px, py, px, py - 9, '#5a3a22', 1.2);
    for (const [dy, r] of [[-6, 4], [-9, 3.4], [-11.6, 2.4]]) el(px, py + dy, r, r * 0.45, '#3f6a3a');
  }
}

// --- بوابة كانو القديمة (كانو): سور طيني سميك يضيق للأعلى بقوس مدبب كبير وبابين خشبيين، وقرون الزانكو على قمته،
// ونقوش بارزة حول القوس، وجذوع بارزة من الطين، وسوران قصيران على جانبيه ---
function kanoGate(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(40,25,10,0.22)');
  box(x, y + 2, 33, 16.5, 2, '#9a6a44', '#b8804e', '#c48e5c');
  const M = ['#9a5e36', '#b8774a', '#c88a5a'];
  for (const [ox, oy] of [[-17, -7], [17, -7]]) {                          // سوران قصيران بشُرَف مستديرة
    frustum(x + ox, y + oy + 7, 8, 7, 10, M[0], M[1], M[2]);
    for (const dx of [-5, -1.6, 1.8, 5]) el(x + ox + dx, y + oy + 7 - 10 + dx * (ox < 0 ? 0.25 : -0.25), 1, 1.4, M[2]);
  }
  frustum(x, y + 1, 15, 13, 26, M[0], M[1], M[2]);                         // كتلة البوابة
  const L = fL(x, y + 1, 15, 13, 26), R = fR(x, y + 1, 15, 13, 26);
  poly([R(0.22, 0), R(0.78, 0), R(0.78, 13), R(0.5, 19), R(0.22, 13)], '#ecd6b6');   // إطار القوس الأبيض
  poly([R(0.28, 0), R(0.72, 0), R(0.72, 12), R(0.5, 17), R(0.28, 12)], '#2a1a0e');
  poly([R(0.3, 0), R(0.49, 0), R(0.49, 11), R(0.3, 11)], '#6b4526');
  poly([R(0.51, 0), R(0.7, 0), R(0.7, 11), R(0.51, 11)], '#5a3a20');
  for (const u of [0.36, 0.63]) { const p = R(u, 5.5); circ(p[0], p[1], 0.5, '#d4af4f'); }
  for (const q of [L, R]) {                                                // نقوش بارزة: زخارف متعرجة ودوائر
    for (let k = 0; k < 5; k++) {
      const a = q(0.08 + k * 0.18, 21), b = q(0.17 + k * 0.18, 23), c = q(0.26 + k * 0.18, 21);
      lines([[a[0], a[1], b[0], b[1]], [b[0], b[1], c[0], c[1]]], '#ecd6b6', 0.7);
    }
  }
  for (const u of [0.12, 0.88]) { const p = R(u, 16); circ(p[0], p[1], 1.5, '#ecd6b6'); circ(p[0], p[1], 0.8, M[1]); }
  const sticks = [];
  for (const v of [8, 16]) for (const u of [0.2, 0.55, 0.85]) { const p = L(u, v); sticks.push([p[0], p[1], p[0] - 1.8, p[1] + 0.9]); }
  lines(sticks, '#5a3e26', 0.75);
  for (const [px, py] of [[x - 13, y + 1 - 26], [x, y + 1 + 6.5 - 26], [x + 13, y + 1 - 26], [x - 6.5, y + 1 + 3.2 - 26], [x + 6.5, y + 1 + 3.2 - 26]]) {
    poly([[px - 1.2, py], [px + 1.2, py], [px + 0.4, py - 5.5]], M[1]);   // قرون الزانكو
    ln(px - 1.2, py, px + 0.4, py - 5.5, M[0], 0.4);
  }
}

// --- قوس النصر (باريس): قوس حجري ضخم بفتحة كبيرة على وجهه الأيمن وأصغر على الأيسر، وأعمدة ملتصقة ونقوش بارزة،
// وإفريز وعلّية فوقه، وراية معلقة تحت القوس، ومصباحان ---
function triumph(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(30,25,20,0.22)');
  box(x, y + 2, 33, 16.5, 2, '#8f897d', '#aaa498', '#b6b0a4');
  const by = y - 0.5, w = 16, d = 9, h = 36, S = ['#c2b8a2', '#e0d6c0', '#ece4d2'];
  box(x, by, w, d, h, S[0], S[1], S[2]);
  const L = qL(x, by, w, d), R = qR(x, by, w, d);
  arch3(R, 0.26, 0.48, 24, '#cfc5ae', '#2a2620');                          // الفتحة الكبيرة
  arch3(L, 0.32, 0.36, 15, '#b8ae98', '#24201c');                          // الفتحة الجانبية
  for (const q of [L, R]) {
    for (const v of [h - 7, h - 5.6]) { const a = q(0, v), b = q(1, v); ln(a[0], a[1], b[0], b[1], 'rgba(90,80,60,0.4)', 0.6); }
    for (const u of [0.1, 0.9]) {                                          // أعمدة ملتصقة
      const a = q(u, 1), b = q(u, h - 8); ln(a[0], a[1], b[0], b[1], 'rgba(255,250,235,0.55)', 1.1);
    }
  }
  for (const u of [0.04, 0.78]) poly([R(u, 6), R(u + 0.16, 6), R(u + 0.16, 16), R(u, 16)], '#d2c8b0');   // نقوش بارزة
  for (const u of [0.07, 0.81]) { const a = R(u, 8), b = R(u + 0.05, 14), c = R(u + 0.1, 9); lines([[a[0], a[1], b[0], b[1]], [b[0], b[1], c[0], c[1]]], '#a89e88', 0.6); }
  const fr = [];                                                           // العلّية: نقش شبكي
  for (let k = 0; k < 10; k++) { const a = R(k / 10, h - 4.6), b = R(k / 10, h - 1); fr.push([a[0], a[1], b[0], b[1]]); }
  for (let k = 0; k < 6; k++) { const a = L(k / 6, h - 4.6), b = L(k / 6, h - 1); fr.push([a[0], a[1], b[0], b[1]]); }
  lines(fr, 'rgba(120,110,90,0.4)', 0.4);
  const t = R(0.5, 24.2);                                                  // راية معلقة تحت القوس الكبير
  ln(t[0] - 4, t[1] + 2, t[0] + 4, t[1] - 2, '#3a3530', 0.4);
  poly([[t[0] - 2.4, t[1] + 1.2], [t[0] + 2.4, t[1] - 1.2], [t[0] + 2.4, t[1] + 8], [t[0], t[1] + 10.4], [t[0] - 2.4, t[1] + 10.4]], '#2a4f8a');
  poly([[t[0] - 0.8, t[1] + 0.4], [t[0] + 0.8, t[1] - 0.4], [t[0] + 0.8, t[1] + 9.4], [t[0] - 0.8, t[1] + 10.2]], '#f4f1ea');
  for (const [px, py] of [[x + 21, y + 4], [x - 4, y + 13]]) {             // مصباحان
    ln(px, py, px, py - 11, '#1e2126', 0.8);
    circ(px, py - 12.2, 1.4, '#fff4d0');
  }
}
// قوس على وجه q: عرض du من u وارتفاع dv بإطار حجري ثم فتحة مظلمة
function arch3(q, u, du, dv, frame, dark) {
  arch(q, u - 0.03, du + 0.06, dv + 2.4, frame);
  arch(q, u, du, dv, dark);
}

// --- خان القوافل (صحراء اليمامة): فناء مربع بأسوار طينية منخفضة وأبراج ركن مستديرة وبوابة عالية مقوسة، وفي الفناء
// بئر وأكياس وجرار، وجملان باركان أمامه ---
function khan(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(40,25,10,0.22)');
  box(x, y + 2, 33, 16.5, 2, '#a88a62', '#c2a47a', '#ccae84');
  const by = y - 0.5, w = 25, d = 12.5, hw = 10, M = ['#a8845a', '#c9a476', '#d6b488'];
  const wall = (x0, y0, x1, y1, c) => poly([[x0, y0], [x1, y1], [x1, y1 - hw], [x0, y0 - hw]], c);
  wall(x - w, by, x, by - d, M[0]);                                        // السوران الخلفيان
  wall(x, by - d, x + w, by, M[1]);
  poly([[x - w + 2.4, by], [x, by - d + 1.2], [x + w - 2.4, by], [x, by + d - 1.2]], '#d8bd8e');   // أرض الفناء
  const cx = x, cy = by;                                                   // البئر وما حوله في الفناء
  cyl(cx - 4, cy - 1, 2.2, 2, '#8a6a4a', '#a8865e', '#3a5a6a');
  for (const [px, py] of [[cx + 6, cy - 3], [cx + 8.4, cy - 1.6]]) { el(px, py - 1, 1.4, 1.3, '#d8c49a'); }
  jar(cx + 3, cy + 2, 1.2, '#a8643a');
  wall(x - w, by, x, by + d, M[1]);                                        // السوران الأماميان
  wall(x, by + d, x + w, by, M[2]);
  const L = qL(x, by, w, d), R = qR(x, by, w, d);
  whiteTeeth([L, R], hw, 9, '#efe2c8');
  poly([R(0.36, 0), R(0.64, 0), R(0.64, 15), R(0.36, 15)], M[2]);          // البوابة العالية
  poly([R(0.41, 0), R(0.59, 0), R(0.59, 9), R(0.5, 12.6), R(0.41, 9)], '#3a2618');
  poly([R(0.33, 15), R(0.67, 15), R(0.67, 16.4), R(0.33, 16.4)], '#efe2c8');
  for (const [px, py] of [[x - w, by], [x, by + d], [x + w, by]]) {        // أبراج الركن
    cyl(px, py + 0.5, 3, hw + 4, M[0], M[1], M[2]);
    for (let k = 0; k < 4; k++) poly([[px - 3 + k * 1.5, py + 0.5 - hw - 4], [px - 1.5 + k * 1.5, py + 0.5 - hw - 4], [px - 2.25 + k * 1.5, py - hw - 6]], '#efe2c8');
  }
  for (const [px, py, s] of [[x + 20, y + 7.5, 1], [x - 18, y + 8.5, -1]]) {   // جملان باركان
    el(px, py, 3.4, 1.6, '#b8904e');
    el(px + s * 0.4, py - 1.6, 1.6, 1.2, '#c9a05e');
    ln(px + s * 2.6, py - 0.6, px + s * 4, py - 4, '#b8904e', 1.1);
    el(px + s * 4.4, py - 4.4, 1.1, 0.7, '#c9a05e');
    rc(px - 1.6, py - 2.6, 3.2, 0.8, '#b8382c');
  }
}

// --- ورشة البارود (الصينية): ورشة بجدران حمراء وسقف أخضر بأطراف مرفوعة، وحامل صواريخ مائل بصواريخ ورقية حمراء،
// وبراميل بارود وصناديق، وفوانيس، ودخان خفيف ---
function powder(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(30,20,15,0.22)');
  box(x, y + 2, 33, 16.5, 3, '#8b867c', '#a8a298', '#b8b2a8');
  const bx = x - 5, by = y - 3, w = 18, d = 9, h = 12;
  box(bx, by, w, d, h, '#8f2a22', '#b3362b');
  const L = qL(bx, by, w, d), R = qR(bx, by, w, d);
  for (const u of [0.12, 0.62]) { wL(bx, by, w, d, u, 4, 0.2, 5, '#e2c27a'); }
  poly([R(0.3, 0), R(0.62, 0), R(0.62, 8), R(0.3, 8)], '#3a2416');
  for (const u of [0.1, 0.8]) { const p = R(u, h + 1); ln(p[0], p[1], p[0], p[1] + 2, '#3a2a20', 0.4); el(p[0], p[1] + 3.6, 1.6, 2, '#d8402e'); }
  ridgeRoof(bx, by, w, d, h, 10, { ov: 5, sag: 2.2, flare: 3.2, front: '#3f7a52', front2: '#356a46', end: '#2f5e40', end2: '#285236',
                                    back: '#22503b', tile: 'rgba(10,40,25,0.35)', ridge: '#d1a33f', ridgeW: 1.4 });
  // حامل الصواريخ المائل على الركن الأيمن
  const rx = x + 17, ry = y + 2;
  lines([[rx - 4, ry + 1, rx + 2, ry - 12], [rx + 2, ry - 1, rx + 6, ry - 11], [rx - 4, ry + 1, rx + 2, ry - 1]], '#5a3e26', 1);
  for (let k = 0; k < 4; k++) {
    const sx = rx - 2.6 + k * 1.9, sy = ry - 2 - k * 1;
    ln(sx, sy, sx + 3.4, sy - 9.4, '#c8392f', 1.3);
    poly([[sx + 3.4, sy - 9.4], [sx + 2.6, sy - 8.4], [sx + 4.4, sy - 11.6]], '#e8c23a');
    ln(sx - 0.6, sy + 1.6, sx, sy, '#5a3e26', 0.4);
  }
  for (const [px, py] of [[x + 6, y + 9], [x + 9.6, y + 7.4], [x + 7.8, y + 5.8]]) barrel(px, py, 1.7, 3.6, ['#4a3a2c', '#6b4a2e', '#7a5636']);
  for (const [px, py] of [[x + 6, y + 5.4], [x + 9.6, y + 3.8]]) { el(px, py, 1.2, 0.6, '#2a2420'); }
  crate(x - 18, y + 6.6, 2, ['#8a1e1e', '#b3262f', '#c8392f']);
  crate(x - 21.5, y + 4.6, 2, ['#8a1e1e', '#b3262f', '#c8392f']);
  const c = getCtx();
  c.beginPath(); c.moveTo(x + 2, y - 16); c.bezierCurveTo(x, y - 22, x + 5, y - 26, x + 2, y - 32);
  c.strokeStyle = 'rgba(200,200,195,0.4)'; c.lineWidth = 1.4; c.stroke();
}

// --- بيت صيادي الترول (النرويجية): كوخ جذوع داكنة بسقف عشب، وجمجمة ترول كبيرة بقرنين فوق الباب، وحامل رماح وفؤوس،
// وقوس منجنيق كبير، ودروع مستديرة ملونة، وحطب ---
function hunters(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(25,20,15,0.24)');
  box(x, y + 2, 33, 16.5, 2.5, '#6f6a62', '#8a857b', '#9a948a');
  const by = y - 1, w = 22, d = 11, h = 12;
  box(x, by, w, d, h, '#4a3222', '#5e4030');
  const L = qL(x, by, w, d), R = qR(x, by, w, d), logs = [];
  for (let v = 1.5; v < h; v += 1.8) for (const q of [L, R]) { const a = q(0, v), b = q(1, v); logs.push([a[0], a[1], b[0], b[1]]); }
  lines(logs, 'rgba(25,15,8,0.45)', 0.5);
  for (const p of [L(0, 0), R(1, 0)]) for (let v = 1; v < h; v += 1.8) circ(p[0], p[1] - v, 0.8, '#8a6440');   // أطراف الجذوع
  poly([R(0.38, 0), R(0.62, 0), R(0.62, 8), R(0.38, 8)], '#2a1a10');
  wL(x, by, w, d, 0.3, 4.5, 0.16, 3.4, '#f2c86a');
  const roof = ridgeRoof(x, by, w, d, h, 11, { ov: 2.2, gable: true, front: '#5e8a44', back: '#4a7036', end: '#4e3624', wallEnd: '#56392a',
                                                 eave: '#3a5a2a', ridge: '#46683a', ridgeW: 1.2, tile: 'rgba(30,50,20,0.25)' });
  for (const [u, t] of [[0.2, 0.3], [0.55, 0.6], [0.8, 0.25]]) { const [px, py] = roofAt(roof, u, t); el(px, py, 1.8, 0.8, '#7aa858'); }
  const g = R(0.5, 9.6);                                                   // جمجمة الترول بقرنيها فوق الباب
  el(g[0], g[1] - 1.4, 3, 2.6, '#e8e0cc');
  el(g[0] - 1.1, g[1] - 1.6, 0.7, 0.6, '#2a2420'); el(g[0] + 1.1, g[1] - 2, 0.7, 0.6, '#2a2420');
  lines([[g[0] - 2.4, g[1] - 2.6, g[0] - 5, g[1] - 6.4], [g[0] + 2.4, g[1] - 3.4, g[0] + 5, g[1] - 7.6]], '#d8ccb0', 1.1);
  for (const [px, py, c] of [[x - 18, y + 3.4, '#c8392f'], [x - 14.4, y + 5.2, '#2f6db3'], [x - 10.8, y + 7, '#e8c23a']]) {
    el(px, py - 3, 2, 2.4, c); circ(px, py - 3, 0.6, '#c8ccd2');            // دروع مستديرة مسنودة
  }
  const rx = x + 17, ry = y + 4;                                           // حامل رماح وفؤوس
  lines([[rx - 2.4, ry + 1.2, rx - 2.4, ry - 7], [rx + 2.4, ry - 1.2, rx + 2.4, ry - 9.4], [rx - 2.8, ry - 5.2, rx + 2.8, ry - 8]], '#5a3e26', 0.8);
  lines([0, 1, 2].map(k => [rx - 1.6 + k * 1.6, ry + 0.4 - k * 0.8, rx - 1.2 + k * 1.6, ry - 11 - k * 0.8]), '#8a6a48', 0.6);
  for (let k = 0; k < 3; k++) poly([[rx - 1.2 + k * 1.6, ry - 11 - k * 0.8], [rx - 1.7 + k * 1.6, ry - 9 - k * 0.8], [rx - 0.6 + k * 1.6, ry - 9.2 - k * 0.8]], '#c8ccd2');
  for (const [px, py] of [[x + 25, y + 0.5], [x + 23, y + 2]]) { box(px, py, 2.6, 1.3, 1.4, '#6b4a2e', '#8a6440', '#c9a46a'); }
}

const BUILDINGS = { pyramid, dojo, clinic, fortress, khartoum, policeHQ, clock, complex, statue, mercs, souk, triads, stable,
                    cathedral, mine, bank, salwa, observatory, kanoGate, arch: triumph, khan, powder, hunters };

// --- ساحة المبنى المميز (fplaza) ---
// البلاط في طبقة الأرض (chunkCache.js): مربع داخلي بحافة ذهبية خفيفة وفاصلان
export function drawFeaturePaving(ctx, x, y) {
  ctx.beginPath();
  ctx.moveTo(x - 12, y); ctx.lineTo(x, y - 6); ctx.lineTo(x + 12, y); ctx.lineTo(x, y + 6); ctx.closePath();
  ctx.moveTo(x - 6, y - 3); ctx.lineTo(x + 6, y + 3);
  ctx.moveTo(x + 6, y - 3); ctx.lineTo(x - 6, y + 3);
  ctx.strokeStyle = 'rgba(255,226,150,0.32)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

// زينة أركان الساحة (الأركان القطرية للكتلة): مسلات الهرم، وفوانيس الدوجو الحجرية، وفوانيس دار العلاج،
// ومشاعل الحصن وبرج الخرطوم، وفوانيس مركز الشرطة وبرج الساعة، ورايات ريش المجمع، ونخيل ريو، وأعمدة لا بوكا الملونة.
// على أرض يُمشى عليها، فهي صغيرة كأعمدة الإنارة
export function drawFeaturePlaza(map, i, j, x, y) {
  const d = map.districtOf(i, j);
  if (!d || !d.featureBig || d.featureTile === undefined) return;
  const at = tileOf(map, d.featureTile), i0 = at.i - 1, j0 = at.j - 1;
  const corner = (i === i0 - 1 || i === i0 + 2) && (j === j0 - 1 || j === j0 + 2);
  if (!corner) return;
  const saved = getTone(), savedInfo = getToneInfo();
  setTone(null);
  const prop = PROPS[d.feature];
  if (prop) prop(x, y, i, j);
  setTone(saved, savedInfo);
}

const brazier = (x, y) => {
  box(x, y, 2.6, 1.3, 5, '#5a4632', '#6e563d', '#7a6045');
  poly([[x - 2.6, y - 5], [x, y - 13], [x + 2.6, y - 5]], '#ff8a2a');
  poly([[x - 1.3, y - 5.4], [x, y - 10], [x + 1.3, y - 5.4]], '#ffe08a');
};

const PROPS = {
  pyramid(x, y) {
    box(x, y, 2.4, 1.2, 20, '#b0905c', '#d4b47a');
    poly([[x - 2.4, y - 20], [x, y - 25], [x, y - 20 + 1.2]], '#c99a2c');
    poly([[x, y - 20 + 1.2], [x, y - 25], [x + 2.4, y - 20]], '#f6d362');
  },
  dojo(x, y) {
    box(x, y, 2.6, 1.3, 2, '#7d786f', '#9a948a', '#aaa49a');
    box(x, y - 2, 1.1, 0.55, 6, '#8a857b', '#a29c92');
    box(x, y - 8, 2.8, 1.4, 3, '#8a857b', '#a29c92', '#f2d58a');
    poly([[x - 3.6, y - 11], [x, y - 14.5], [x + 3.6, y - 11], [x, y - 9.2]], '#6f6a62');
  },
  clinic(x, y) {
    ln(x, y, x, y - 16, '#3a2a20', 0.9);
    ln(x, y - 16, x + 4, y - 16, '#3a2a20', 0.7);
    el(x + 4, y - 12.4, 2.2, 2.8, '#d8402e');
    ln(x + 2.4, y - 12.4, x + 5.6, y - 12.4, '#f2c14e', 0.5);
  },
  fortress: brazier,
  khartoum: brazier,
  policeHQ(x, y) {                       // فانوس حديدي معلّق
    ln(x, y, x, y - 16, '#2a2d33', 1);
    ln(x, y - 16, x + 3.4, y - 16, '#2a2d33', 0.8);
    poly([[x + 1.8, y - 14.6], [x + 5, y - 14.6], [x + 4.4, y - 10.6], [x + 2.4, y - 10.6]], '#2a2d33');
    poly([[x + 2.5, y - 14], [x + 4.3, y - 14], [x + 3.9, y - 11.2], [x + 2.9, y - 11.2]], '#f4dc8a');
  },
  clock(x, y) {                          // عمود إنارة فيكتوري بكرة بيضاء
    box(x, y, 1.4, 0.7, 2, '#1e2126', '#2c3036', '#24282d');
    ln(x, y - 2, x, y - 17, '#1e2126', 1);
    ln(x - 2.2, y - 15, x + 2.2, y - 15, '#1e2126', 0.6);
    circ(x, y - 18.6, 2.2, '#fff4d0');
    poly([[x - 1.8, y - 20.4], [x + 1.8, y - 20.4], [x, y - 22]], '#1e2126');
  },
  complex(x, y) { featherStandard(x, y, 14); },
  statue: (x, y, i, j) => streetPalm(x, y, i, j),
  triads(x, y) {                         // عمود بلافتة نيون صغيرة
    ln(x, y, x, y - 15, '#2a2a2e', 0.9);
    box(x + 1.6, y - 12, 2.2, 1.1, 5, '#1c1220', '#24182a', '#1c1220');
    ln(x + 0.6, y - 13.5, x + 0.6, y - 17.5, '#ff4fb4', 0.8);
    ln(x + 2.6, y - 13, x + 2.6, y - 16.5, '#4fe3ff', 0.8);
  },
  stable(x, y) { chhatri(x, y, 2.6); },  // كشك صغير بقبة
  cathedral(x, y) {                      // جرس صغير تحت إطار خشبي
    ln(x - 3, y, x - 3, y - 11, '#5a3a22', 0.9);
    ln(x + 3, y, x + 3, y - 11, '#5a3a22', 0.9);
    ln(x - 4, y - 11, x + 4, y - 11, '#5a3a22', 1.1);
    poly([[x - 2.2, y - 5], [x - 1.4, y - 9.6], [x + 1.4, y - 9.6], [x + 2.2, y - 5]], '#d9a93a');
    circ(x, y - 4.8, 0.7, '#8a6a1c');
  },
  mine(x, y) {                           // كومة خام فضي بمعول
    for (const [px, py, r, c] of [[-1.5, 0, 1.8, '#b8bcc2'], [1.2, 0.6, 1.4, '#d9dde2'], [0, -1.4, 1.3, '#eef1f4']]) circ(x + px, y + py, r, c);
    ln(x + 2, y - 1, x + 5, y - 8, '#6b4a2e', 0.8);
    ln(x + 3, y - 8.6, x + 7, y - 7, '#5c5650', 1);
  },
  bank(x, y) { PROPS.clock(x, y); },     // عمود إنارة الثلاثينيات بكرة بيضاء
  souk(x, y) {                           // بسطة توابل بمظلة مخططة
    ln(x - 3, y, x - 3, y - 9, '#5a3a22', 0.7);
    ln(x + 3, y + 1.5, x + 3, y - 7.5, '#5a3a22', 0.7);
    box(x, y + 0.5, 3.2, 1.6, 3, '#7a5432', '#94683f', '#a87a4a');
    ['#c0392b', '#e1a12a', '#7a4a2a'].forEach((col, n) => circ(x - 1.8 + n * 1.8, y - 3.4 + (n % 2) * 0.6, 1.1, col));
    poly([[x - 4, y - 9], [x + 4, y - 7], [x + 4, y - 9.6], [x - 4, y - 11.6]], '#b8382c');
    poly([[x - 1.3, y - 8.35], [x + 1.3, y - 7.7], [x + 1.3, y - 10.3], [x - 1.3, y - 10.95]], '#f1e6cf');
  },
  // مباني مدن الأحداث (12هـ): نخيل الصحراء، وفوانيس آسيا الحجرية، ومشاعل أفريقيا، وأعمدة باريس، ومشاعل النرويج
  salwa: (x, y, i, j) => streetPalm(x, y, i, j),
  khan: (x, y, i, j) => streetPalm(x, y, i, j),
  observatory(x, y) { PROPS.dojo(x, y); },
  powder(x, y) { PROPS.dojo(x, y); },
  kanoGate: brazier,
  hunters: brazier,
  arch(x, y) { PROPS.clock(x, y); },
  mercs(x, y) {                          // عمود بألوان لا بوكا وفانوس
    const cols = ['#c8392f', '#e8c23a', '#2f6db3', '#3f9b5a'];
    for (let k = 0; k < 4; k++) ln(x, y - k * 4, x, y - k * 4 - 4, cols[k], 1.3);
    ln(x, y - 16, x + 2.6, y - 16, '#1e1e22', 0.7);
    el(x + 2.6, y - 13.8, 1.4, 1.9, '#f4dc8a');
  }
};

// --- الشارات: فوق مبنى الميزة، وفوق علم القرية التي لم ينضم أهلها ---
// مكانها كشارة مباني الاقتصاد (empireArt.badgeOf)، وللمس المبنى في input.js
export function featureBadgeOf(state, d) {
  const B = E.badge, map = state.map;
  const building = d.featureTile !== undefined;
  let x, y, top;
  if (building) {
    const at = tileOf(map, d.featureTile), w = worldOf(at.i, at.j);
    x = w.x;
    y = w.y;
    top = d.featureBig ? y - TILE_HALF_H - F[d.feature].top : y - F[d.feature].top * SMALL;
  } else {
    ({ x, y } = worldOf(d.capture.i, d.capture.j));
    top = y - 24;
  }
  const r = Math.max(B.radius, B.minScreen / state.camera.z);
  return { x, y, top, r, cy: top - B.pole - r };
}

const hasBadge = (d) => d.feature && (d.featureTile !== undefined || (villageWaiting(d) && d.capture));

const ICONS = {
  // هرم ذهبي بوجهين
  pyramid(ctx, x, y, s) {
    tri(ctx, [[x - s * 1.1, y + s * 0.7], [x, y - s * 0.95], [x + s * 1.1, y + s * 0.7]], '#e8c45a');
    tri(ctx, [[x, y - s * 0.95], [x + s * 1.1, y + s * 0.7], [x + s * 0.15, y + s * 0.7]], '#b8902e');
  },
  // ثلاثة من أهل القرية
  village(ctx, x, y, s) {
    ctx.fillStyle = '#efe4cc';
    for (const [dx, k] of [[-0.75, 0.85], [0.75, 0.85], [0, 1]]) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y - s * 0.45 * k, s * 0.3 * k, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + dx * s, y + s * 0.5, s * 0.42 * k, s * 0.5 * k, 0, Math.PI, 0);
      ctx.fill();
    }
  },
  // سيفان متقاطعان فوق دائرة حمراء
  dojo(ctx, x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.95, 0, TAU);
    ctx.fillStyle = '#b3262f';
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#f3ead8';
    ctx.lineWidth = s * 0.2;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.8, y + s * 0.8); ctx.lineTo(x + s * 0.8, y - s * 0.8);
    ctx.moveTo(x + s * 0.8, y + s * 0.8); ctx.lineTo(x - s * 0.8, y - s * 0.8);
    ctx.stroke();
  },
  // قرعة الدواء الذهبية
  clinic(ctx, x, y, s) {
    ctx.fillStyle = '#e7b84a';
    ctx.beginPath(); ctx.arc(x, y - s * 0.45, s * 0.42, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y + s * 0.35, s * 0.62, 0, TAU); ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(x - s * 0.5, y - s * 0.1, s, s * 0.16);
  },
  // برج بشُرَف
  fortress(ctx, x, y, s) {
    ctx.fillStyle = '#d9c28a';
    ctx.fillRect(x - s * 0.7, y - s * 0.5, s * 1.4, s * 1.3);
    for (let k = 0; k < 3; k++) ctx.fillRect(x - s * 0.7 + k * s * 0.55, y - s * 0.85, s * 0.3, s * 0.4);
    ctx.fillStyle = '#3a2616';
    ctx.fillRect(x - s * 0.2, y + s * 0.3, s * 0.4, s * 0.5);
  },
  // برج مستدق بشعلة
  khartoum(ctx, x, y, s) {
    tri(ctx, [[x - s * 0.55, y + s * 0.95], [x - s * 0.3, y - s * 0.55], [x + s * 0.3, y - s * 0.55], [x + s * 0.55, y + s * 0.95]], '#d9a866');
    tri(ctx, [[x - s * 0.35, y - s * 0.55], [x, y - s * 1.1], [x + s * 0.35, y - s * 0.55]], '#ff9a3c');
  },
  // درع الشرطة الأزرق بنجمة
  policeHQ(ctx, x, y, s) {
    tri(ctx, [[x - s * 0.8, y - s * 0.8], [x + s * 0.8, y - s * 0.8], [x + s * 0.8, y + s * 0.1], [x, y + s * 0.95], [x - s * 0.8, y + s * 0.1]], '#2f63b8');
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? s * 0.2 : s * 0.48;
      pts.push([x + Math.cos(a) * r, y - s * 0.05 + Math.sin(a) * r]);
    }
    tri(ctx, pts, '#f2f5fa');
  },
  // وجه ساعة بعقربين
  clock(ctx, x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.9, 0, TAU);
    ctx.fillStyle = '#f4efe2';
    ctx.fill();
    ctx.lineWidth = s * 0.18;
    ctx.strokeStyle = '#c9a046';
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#262626';
    ctx.lineWidth = s * 0.15;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.62);
    ctx.moveTo(x, y); ctx.lineTo(x + s * 0.42, y + s * 0.2);
    ctx.stroke();
  },
  // بيت متدرج بحزام فيروزي
  complex(ctx, x, y, s) {
    ctx.fillStyle = '#efe4cc';
    ctx.fillRect(x - s * 0.95, y - s * 0.15, s * 1.9, s * 1.05);
    ctx.fillRect(x - s * 0.55, y - s * 0.7, s * 1.1, s * 0.6);
    ctx.fillStyle = '#36b2a8';
    ctx.fillRect(x - s * 0.95, y - s * 0.15, s * 1.9, s * 0.24);
    ctx.fillStyle = '#a63a2a';
    ctx.fillRect(x - s * 0.22, y + s * 0.35, s * 0.44, s * 0.55);
  },
  // واجهة المعبد: برج على يسارها وجبهة مثلثة وباب وفتحة البرج
  statue(ctx, x, y, s) {
    ctx.fillStyle = '#d77d4e';
    ctx.fillRect(x - s * 0.95, y - s * 0.95, s * 0.5, s * 1.9);
    ctx.fillRect(x - s * 0.45, y - s * 0.1, s * 1.4, s * 1.05);
    tri(ctx, [[x - s * 0.25, y - s * 0.1], [x + s * 0.75, y - s * 0.1], [x + s * 0.25, y - s * 0.62]], '#d77d4e');
    ctx.fillStyle = '#3a2216';
    ctx.fillRect(x + s * 0.1, y + s * 0.4, s * 0.32, s * 0.55);
    ctx.fillRect(x - s * 0.82, y - s * 0.62, s * 0.24, s * 0.36);
  },
  // فانوس أحمر بشرابة ذهبية
  triads(ctx, x, y, s) {
    ctx.fillStyle = '#d8402e';
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.75, s * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8c45a';
    ctx.fillRect(x - s * 0.4, y - s * 0.78, s * 0.8, s * 0.2);
    ctx.fillRect(x - s * 0.4, y + s * 0.58, s * 0.8, s * 0.2);
    ctx.fillRect(x - s * 0.06, y + s * 0.78, s * 0.12, s * 0.3);
    ctx.strokeStyle = 'rgba(120,20,20,0.6)';
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.6); ctx.lineTo(x, y + s * 0.6);
    ctx.stroke();
  },
  // رأس فيل: أذن وخرطوم ونابان
  stable(ctx, x, y, s) {
    ctx.fillStyle = '#b9b4ae';
    ctx.beginPath(); ctx.ellipse(x - s * 0.45, y - s * 0.1, s * 0.45, s * 0.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d6d1cb';
    ctx.beginPath(); ctx.arc(x + s * 0.1, y - s * 0.2, s * 0.55, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d6d1cb';
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.3;
    ctx.beginPath(); ctx.moveTo(x + s * 0.45, y); ctx.quadraticCurveTo(x + s * 0.7, y + s * 0.55, x + s * 0.4, y + s * 0.85); ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = s * 0.12;
    ctx.beginPath(); ctx.moveTo(x + s * 0.25, y + s * 0.2); ctx.lineTo(x + s * 0.05, y + s * 0.45); ctx.stroke();
    ctx.fillStyle = '#2a2420';
    ctx.beginPath(); ctx.arc(x + s * 0.28, y - s * 0.32, s * 0.08, 0, TAU); ctx.fill();
  },
  // جرس ذهبي بلسانه
  cathedral(ctx, x, y, s) {
    ctx.fillStyle = '#e2b84a';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.75, y + s * 0.5);
    ctx.quadraticCurveTo(x - s * 0.62, y - s * 0.75, x, y - s * 0.78);
    ctx.quadraticCurveTo(x + s * 0.62, y - s * 0.75, x + s * 0.75, y + s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - s * 0.85, y + s * 0.42, s * 1.7, s * 0.2);
    ctx.fillStyle = '#8a6a1c';
    ctx.beginPath(); ctx.arc(x, y + s * 0.72, s * 0.18, 0, TAU); ctx.fill();
    ctx.fillRect(x - s * 0.08, y - s * 1.0, s * 0.16, s * 0.26);
  },
  // معول فوق قطعة فضة
  mine(ctx, x, y, s) {
    ctx.fillStyle = '#d9dde2';
    ctx.beginPath(); ctx.ellipse(x, y + s * 0.45, s * 0.6, s * 0.35, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#a0764a';
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.16;
    ctx.beginPath(); ctx.moveTo(x - s * 0.6, y + s * 0.5); ctx.lineTo(x + s * 0.5, y - s * 0.7); ctx.stroke();
    ctx.strokeStyle = '#cfd3d8';
    ctx.lineWidth = s * 0.18;
    ctx.beginPath(); ctx.moveTo(x + s * 0.05, y - s * 0.95); ctx.quadraticCurveTo(x + s * 0.55, y - s * 0.85, x + s * 0.9, y - s * 0.35); ctx.stroke();
  },
  // بنك كلاسيكي: جملون وأعمدة وقاعدة
  bank(ctx, x, y, s) {
    tri(ctx, [[x - s * 0.95, y - s * 0.4], [x, y - s * 0.95], [x + s * 0.95, y - s * 0.4]], '#e8c45a');
    ctx.fillStyle = '#e8c45a';
    for (const px of [-0.7, -0.25, 0.25, 0.7]) ctx.fillRect(x + s * px - s * 0.1, y - s * 0.3, s * 0.2, s * 0.85);
    ctx.fillRect(x - s * 0.95, y + s * 0.6, s * 1.9, s * 0.22);
  },
  // ميزان ذهبي
  souk(ctx, x, y, s) {
    ctx.strokeStyle = '#e8c45a';
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.85); ctx.lineTo(x, y + s * 0.75);
    ctx.moveTo(x - s * 0.8, y - s * 0.55); ctx.lineTo(x + s * 0.8, y - s * 0.55);
    ctx.moveTo(x - s * 0.45, y + s * 0.8); ctx.lineTo(x + s * 0.45, y + s * 0.8);
    ctx.stroke();
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(x + side * s * 0.8, y - s * 0.55); ctx.lineTo(x + side * s * 0.8 - s * 0.3, y + s * 0.15);
      ctx.moveTo(x + side * s * 0.8, y - s * 0.55); ctx.lineTo(x + side * s * 0.8 + s * 0.3, y + s * 0.15);
    }
    ctx.stroke();
    ctx.fillStyle = '#e8c45a';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + side * s * 0.8, y + s * 0.15, s * 0.36, s * 0.14, 0, 0, Math.PI);
      ctx.fill();
    }
  },
  // كيس نقود ذهبي
  mercs(ctx, x, y, s) {
    ctx.fillStyle = '#e8c45a';
    ctx.beginPath();
    ctx.arc(x, y + s * 0.25, s * 0.68, 0, TAU);
    ctx.fill();
    tri(ctx, [[x - s * 0.3, y - s * 0.35], [x + s * 0.3, y - s * 0.35], [x + s * 0.5, y - s * 0.85], [x - s * 0.5, y - s * 0.85]], '#e8c45a');
    ctx.fillStyle = '#8a5a1c';
    ctx.fillRect(x - s * 0.36, y - s * 0.45, s * 0.72, s * 0.14);
  },
  // --- مباني مدن الأحداث (12هـ) ---
  // قصر نجدي بشُرَف مثلثة
  salwa(ctx, x, y, s) {
    ctx.fillStyle = '#e8c45a';
    ctx.fillRect(x - s * 0.85, y - s * 0.35, s * 1.7, s * 1.1);
    for (let k = 0; k < 4; k++) tri(ctx, [[x - s * 0.85 + k * s * 0.425, y - s * 0.35], [x - s * 0.425 + k * s * 0.425, y - s * 0.35], [x - s * 0.64 + k * s * 0.425, y - s * 0.8]], '#e8c45a');
    ctx.fillStyle = '#8a5a1c';
    ctx.fillRect(x - s * 0.18, y + s * 0.2, s * 0.36, s * 0.55);
  },
  // برج القارورة وإطاره المربع
  observatory(ctx, x, y, s) {
    ctx.fillStyle = '#e8c45a';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.7, y + s * 0.85); ctx.quadraticCurveTo(x - s * 0.85, y - s * 0.1, x - s * 0.32, y - s * 0.6);
    ctx.lineTo(x + s * 0.32, y - s * 0.6); ctx.quadraticCurveTo(x + s * 0.85, y - s * 0.1, x + s * 0.7, y + s * 0.85);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(x - s * 0.45, y - s * 0.95, s * 0.9, s * 0.25);
    ctx.fillStyle = '#8a5a1c';
    ctx.fillRect(x - s * 0.15, y - s * 0.05, s * 0.3, s * 0.3);
  },
  // بوابة بقوس مدبب وقرنين
  kanoGate(ctx, x, y, s) {
    ctx.fillStyle = '#e8c45a';
    ctx.fillRect(x - s * 0.8, y - s * 0.5, s * 1.6, s * 1.3);
    for (const dx of [-0.65, 0.65]) tri(ctx, [[x + dx * s - s * 0.15, y - s * 0.5], [x + dx * s + s * 0.15, y - s * 0.5], [x + dx * s, y - s * 0.98]], '#e8c45a');
    tri(ctx, [[x - s * 0.35, y + s * 0.8], [x + s * 0.35, y + s * 0.8], [x + s * 0.35, y], [x, y - s * 0.3], [x - s * 0.35, y]], '#8a5a1c');
  },
  // قوس النصر
  arch(ctx, x, y, s) {
    ctx.fillStyle = '#e8c45a';
    ctx.fillRect(x - s * 0.85, y - s * 0.8, s * 1.7, s * 1.6);
    ctx.fillStyle = '#8a5a1c';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.38, y + s * 0.8); ctx.lineTo(x - s * 0.38, y); ctx.arc(x, y, s * 0.38, Math.PI, 0); ctx.lineTo(x + s * 0.38, y + s * 0.8);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(x - s * 0.85, y - s * 0.5, s * 1.7, s * 0.08);
  },
  // جمل
  khan(ctx, x, y, s) {
    ctx.fillStyle = '#e8c45a';
    ctx.beginPath(); ctx.ellipse(x - s * 0.1, y, s * 0.6, s * 0.35, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - s * 0.15, y - s * 0.3, s * 0.3, s * 0.3, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(x + s * 0.42, y - s * 0.75, s * 0.16, s * 0.75);
    ctx.beginPath(); ctx.ellipse(x + s * 0.65, y - s * 0.78, s * 0.24, s * 0.14, 0, 0, TAU); ctx.fill();
    for (const dx of [-0.55, -0.2, 0.15, 0.4]) ctx.fillRect(x + dx * s, y + s * 0.2, s * 0.12, s * 0.65);
  },
  // صاروخ ورقي مائل بلهبه
  powder(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.6);
    ctx.fillStyle = '#e8c45a';
    ctx.fillRect(-s * 0.16, -s * 0.6, s * 0.32, s * 1.1);
    tri(ctx, [[-s * 0.24, -s * 0.6], [s * 0.24, -s * 0.6], [0, -s * 0.98]], '#e8c45a');
    tri(ctx, [[-s * 0.14, s * 0.5], [s * 0.14, s * 0.5], [0, s * 0.95]], '#ff8a3a');
    ctx.restore();
  },
  // جمجمة بقرنين
  hunters(ctx, x, y, s) {
    ctx.strokeStyle = '#e8c45a';
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.2;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y - s * 0.2); ctx.quadraticCurveTo(x - s * 0.95, y - s * 0.4, x - s * 0.8, y - s * 0.95);
    ctx.moveTo(x + s * 0.4, y - s * 0.2); ctx.quadraticCurveTo(x + s * 0.95, y - s * 0.4, x + s * 0.8, y - s * 0.95);
    ctx.stroke();
    ctx.fillStyle = '#e8c45a';
    ctx.beginPath(); ctx.ellipse(x, y + s * 0.05, s * 0.5, s * 0.58, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a5a1c';
    for (const dx of [-0.2, 0.2]) { ctx.beginPath(); ctx.arc(x + dx * s, y - s * 0.05, s * 0.12, 0, TAU); ctx.fill(); }
  }
};

function tri(ctx, points, color) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let k = 1; k < points.length; k++) ctx.lineTo(points[k][0], points[k][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// فوق طبقة الليل لتُقرأ دائماً (بعد شارات مباني الاقتصاد)
export function drawFeatureBadges(ctx, state, visible) {
  if (!state.feature) return;
  const B = E.badge, z = state.camera.z;
  for (const d of state.map.districts) {
    if (!hasBadge(d)) continue;
    const b = featureBadgeOf(state, d);
    if (!visible(b.x, b.y)) continue;
    ctx.beginPath();
    ctx.moveTo(b.x, b.top + 1);
    ctx.lineTo(b.x, b.cy + b.r);
    ctx.strokeStyle = '#2b2825';
    ctx.lineWidth = Math.max(1.1, 1.6 / z);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x, b.cy, b.r, 0, TAU);
    ctx.fillStyle = B.disc;
    ctx.fill();
    ctx.lineWidth = b.r * 0.24;
    ctx.strokeStyle = d.owner !== null ? state.players[d.owner].color : B.neutral;
    ctx.stroke();
    ICONS[d.feature](ctx, b.x, b.cy, b.r * 0.6);
  }
}

// --- الهالة: حلقة بلون الميزة تنبض حول الكتلة (أو حول علم القرية)، ونجوم صغيرة تدور عليها ---
// تُرسم مع الوحدات بقطر مؤخرة الكتلة، فيلصق المبنى نفسه فوق ما خلفه منها (occlusion.js). null حين لا هالة
export function featureHaloEntry(state, d) {
  let i, j, scale = 1;
  if (d.featureTile !== undefined) {
    const at = tileOf(state.map, d.featureTile);
    i = at.i - (d.featureBig ? 0.5 : 0);
    j = at.j - (d.featureBig ? 0.5 : 0);
    if (!d.featureBig) scale = SMALL + 0.15;
  } else if (villageWaiting(d) && d.capture) {
    ({ i, j } = d.capture);
    scale = 0.7;
  } else return null;
  const w = worldOf(i, j), H = F.halo;
  const rx = H.radius * TILE_HALF_W * Math.SQRT2 * scale;
  return { featureHalo: d, x: w.x, y: w.y, rx, ry: rx / 2, key: Math.floor(i + j) - 1, size: rx / CITY_UNIT_SIDE };
}
const CITY_UNIT_SIDE = 7.5;       // صندوق الفرد العادي في occlusion (CITY_CACHE.occlusion.unitSide)

export function drawFeatureHalo(ctx, state, e, time) {
  const H = F.halo, d = e.featureHalo, color = F.colors[d.feature] || '255,206,84';
  const pulse = 1 - H.pulse + H.pulse * (0.5 + 0.5 * Math.sin(time * H.speed + d.id));
  ctx.beginPath();
  ctx.ellipse(e.x, e.y, e.rx, e.ry, 0, 0, TAU);
  ctx.fillStyle = 'rgba(' + color + ',' + (0.08 * pulse).toFixed(3) + ')';
  ctx.fill();
  ctx.strokeStyle = 'rgba(' + color + ',' + (H.glowAlpha * pulse).toFixed(3) + ')';
  ctx.lineWidth = H.glow;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(' + color + ',' + (H.alpha * pulse).toFixed(3) + ')';
  ctx.lineWidth = H.width;
  ctx.stroke();
  // نجوم صغيرة تدور على الحلقة
  const r = H.sparkleR;
  ctx.fillStyle = 'rgba(255,248,225,' + (0.6 + 0.4 * pulse).toFixed(3) + ')';
  for (let k = 0; k < H.sparkles; k++) {
    const a = time * H.sparkleSpeed + k * TAU / H.sparkles + d.id;
    const x = e.x + Math.cos(a) * e.rx, y = e.y + Math.sin(a) * e.ry;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 2); ctx.lineTo(x + r * 0.5, y - r * 0.5); ctx.lineTo(x + r * 2, y); ctx.lineTo(x + r * 0.5, y + r * 0.5);
    ctx.lineTo(x, y + r * 2); ctx.lineTo(x - r * 0.5, y + r * 0.5); ctx.lineTo(x - r * 2, y); ctx.lineTo(x - r * 0.5, y - r * 0.5);
    ctx.closePath();
    ctx.fill();
  }
}

// المصباح الأزرق الوامض فوق بوابة مركز الشرطة الرئيسي (كمصابيح المراكز، landmarks.drawPoliceLamp)، وnull لغيره.
// (12.5, −8.9) موضعه من وسط الكتلة في policeHQ أعلاه
export function featureLamp(d, x, y) {
  if (d.feature !== 'policeHQ') return null;
  return d.featureBig ? { x: x + 12.5, y: y - TILE_HALF_H - 8.9 } : { x: x + 12.5 * SMALL, y: y - 8.9 * SMALL };
}

// ضوء ليلي فوق المبنى المميز بلون هالته (الطبقة الثابتة، chunkCache.js)
export function featureLight(map, d, x, y) {
  const top = d.featureBig ? F[d.feature].top : F[d.feature].top * SMALL;
  const cy = d.featureBig ? y - TILE_HALF_H : y;
  return { x, y: cy - top * 0.55, r: F.halo.light, c: F.colors[d.feature] || '255,206,84', a: 0.45 };
}

// --- غبار العاصفة الرملية: طبقة لون وخطوط رمل تجري مع الريح، تشتد في أولها وتخف في آخرها ---
let sand = [], lastAt = 0;

export function drawStorm(ctx, state, view) {
  if (state.feature !== 'storm') return;
  const S = F.storm, now = stormAt(state.time);
  if (!now.on) return;
  const k = Math.max(0, Math.min(1, now.since / S.fade, now.left / S.fade));
  ctx.fillStyle = 'rgba(' + S.color + ',' + (S.alpha * k).toFixed(3) + ')';
  ctx.fillRect(0, 0, view.w, view.h);

  // الجزيئات بزمن الشاشة (رسم فقط، لا تدخل المحاكاة)، وتقف مع الإيقاف
  const t = performance.now(), dt = state.paused ? 0 : Math.min(0.1, (t - lastAt) / 1000);
  lastAt = t;
  if (sand.length !== S.particles) {
    sand = [];
    for (let n = 0; n < S.particles; n++) {
      sand.push({ x: Math.random() * view.w, y: Math.random() * view.h, v: 260 + Math.random() * 260, l: 8 + Math.random() * 16 });
    }
  }
  ctx.strokeStyle = 'rgba(' + S.streak + ',' + (0.8 * k).toFixed(3) + ')';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const p of sand) {
    p.x -= p.v * dt;
    p.y += p.v * 0.12 * dt;
    if (p.x < -30) { p.x = view.w + Math.random() * 40; p.y = Math.random() * view.h; }
    if (p.y > view.h + 10) p.y = -10;
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.l, p.y - p.l * 0.12);
  }
  ctx.stroke();
}

// --- مهرجان الألعاب النارية (القسم 3.11): دائرة حمراء على الأرض تنبض وعدّ ثوانيها حتى الانفجار، ثم انفجارات
// ملونة في السماء فوقها تتساقط شراراتها، ووميض على الأرض. من state.fireworks (رسم فقط) ---
const FW_COLORS = ['#ff5a4a', '#ffd25a', '#6ad7ff', '#8cff8a', '#ff8ce6', '#ffffff'];
const RING = F.fireworks.radius * Math.SQRT2;          // نصف قطر الدائرة على الشاشة بوحدة نصف المربع

export function drawFireworksMarks(ctx, state, visible) {
  if (!state.fireworks || !state.fireworks.length) return;
  const now = state.time / TICK_SEC;
  for (const f of state.fireworks) {
    if (f.done) continue;
    const x = (f.x - f.y) * TILE_HALF_W, y = (f.x + f.y) * TILE_HALF_H;
    if (!visible(x, y)) continue;
    const left = Math.max(0, (f.at - now) * TICK_SEC), pulse = 0.5 + 0.5 * Math.sin(state.time * (10 - left));
    const rx = RING * TILE_HALF_W, ry = RING * TILE_HALF_H;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fillStyle = 'rgba(230,40,30,' + (0.1 + 0.14 * pulse).toFixed(3) + ')';
    ctx.fill();
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(255,70,50,0.9)';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(40,0,0,0.75)';
    ctx.fillStyle = '#ffe0d0';
    const text = String(Math.max(1, Math.ceil(left)));
    ctx.strokeText(text, x, y + 3);
    ctx.fillText(text, x, y + 3);
  }
}

export function drawFireworksBursts(ctx, state, visible) {
  if (!state.fireworks || !state.fireworks.length) return;
  const W = F.fireworks, now = state.time / TICK_SEC;
  for (const f of state.fireworks) {
    if (!f.done) continue;
    const age = (now - f.at) * TICK_SEC, k = Math.max(0, 1 - age / W.fade);
    const x = (f.x - f.y) * TILE_HALF_W, y = (f.x + f.y) * TILE_HALF_H;
    if (!visible(x, y) || k <= 0) continue;
    ctx.beginPath();                                         // وميض على الأرض
    ctx.ellipse(x, y, RING * TILE_HALF_W * (0.6 + 0.4 * (1 - k)), RING * TILE_HALF_H * (0.6 + 0.4 * (1 - k)), 0, 0, TAU);
    ctx.fillStyle = 'rgba(255,190,90,' + (0.35 * k * k).toFixed(3) + ')';
    ctx.fill();
    const seed = Math.abs(Math.sin(f.x * 12.9898 + f.y * 78.233)) * 1000;
    for (let b = 0; b < 3; b++) {                            // ثلاثة انفجارات بألوان وارتفاعات مختلفة
      const delay = b * 0.18, t = age - delay;
      if (t <= 0) continue;
      const bx = x + (b - 1) * 14, by = y - 38 - (b % 2) * 12, col = FW_COLORS[(Math.floor(seed) + b * 2) % FW_COLORS.length];
      const a = Math.max(0, 1 - t / (W.fade - delay));
      ctx.globalAlpha = a;
      ctx.fillStyle = col;
      for (let n = 0; n < 16; n++) {
        const ang = n * TAU / 16 + seed + b, dist = 28 * Math.min(1, t * 2.4), drop = 10 * t * t;
        const px = bx + Math.cos(ang) * dist, py = by + Math.sin(ang) * dist * 0.75 + drop;
        ctx.fillRect(px - 1.3, py - 1.3, 2.6, 2.6);
        ctx.fillRect(px - Math.cos(ang) * 3 - 0.5, py - Math.sin(ang) * 2.2 - 0.5, 1, 1);   // ذيل الشرارة
      }
      if (t < 0.25) {                                       // قلب الانفجار
        ctx.beginPath();
        ctx.arc(bx, by, 7 * (1 - t / 0.25), 0, TAU);
        ctx.fillStyle = '#fff6d8';
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ضوء الانفجارات ليلاً (يُجمع مع أضواء المشهد في renderer.js)
export function fireworksLights(state, lights) {
  if (!state.fireworks || !state.fireworks.length) return;
  const W = F.fireworks, now = state.time / TICK_SEC;
  for (const f of state.fireworks) {
    const x = (f.x - f.y) * TILE_HALF_W, y = (f.x + f.y) * TILE_HALF_H;
    if (!f.done) { lights.push({ x, y, r: 26, c: '255,70,50', a: 0.35 }); continue; }
    const k = Math.max(0, 1 - (now - f.at) * TICK_SEC / W.fade);
    if (k > 0) lights.push({ x, y: y - 30, r: 70, c: '255,220,160', a: 0.8 * k });
  }
}

// --- أجراس الكاتدرائية حين تُقرع: حلقات ذهبية تتسع من قمتها ثلاث ثوانٍ ---
export function drawBells(ctx, state, visible) {
  if (state.feature !== 'bells') return;
  for (const d of state.map.districts) {
    if (d.feature !== 'cathedral' || d.featureTile === undefined || !(state.time - d.rangAt < 3)) continue;
    const b = featureBadgeOf(state, d), age = state.time - d.rangAt;
    if (!visible(b.x, b.y)) continue;
    for (let k = 0; k < 3; k++) {
      const t = (age - k * 0.35) / 1.4;
      if (t < 0 || t > 1) continue;
      ctx.beginPath();
      ctx.ellipse(b.x, b.cy + 22, 8 + t * 58, (8 + t * 58) * 0.5, 0, 0, TAU);
      ctx.strokeStyle = 'rgba(255,214,120,' + (0.85 * (1 - t)).toFixed(3) + ')';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  }
}

// المبلغ الذي في خزنة البنك: لوحة صغيرة تحت قرص شارته، فوق طبقة الليل
export function drawVault(ctx, state, visible) {
  if (state.feature !== 'bank') return;
  const z = state.camera.z;
  for (const d of state.map.districts) {
    if (d.feature !== 'bank' || d.featureTile === undefined) continue;
    const b = featureBadgeOf(state, d);
    if (!visible(b.x, b.y)) continue;
    const text = String(Math.floor(d.vault)), size = Math.max(5, 11 / z), y = b.cy + b.r + size * 1.2;
    ctx.font = '700 ' + size.toFixed(2) + 'px system-ui, sans-serif';
    const w = ctx.measureText(text).width + size * 1.6;
    ctx.fillStyle = 'rgba(20,30,20,0.82)';
    ctx.fillRect(b.x - w / 2, y - size * 0.75, w, size * 1.3);
    ctx.fillStyle = '#ffd25a';
    ctx.beginPath(); ctx.arc(b.x - w / 2 + size * 0.55, y - size * 0.1, size * 0.32, 0, TAU); ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9dffb0';
    ctx.fillText(text, b.x + size * 0.25, y + size * 0.3);
  }
}
