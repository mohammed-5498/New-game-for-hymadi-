// مزايا المدن (القسم 3.11): ما يُرسم منها
// - المبنى المميز في الطبقة الثابتة (landmarks.js بالحرف F): بطلب المستخدم أكبر وأفخم، على كتلة 2×2 وسط ساحته،
//   ومرسوم كله من مربعها الأمامي. معلم لا يُصبغ بلون مالكه: مالكه من حلقة شارته وأرض حيه
// - ساحته المرصوفة (fplaza): بلاط في طبقة الأرض، وزينة على أركانها (مسلات، فوانيس، مشاعل)
// - هالته الملونة تنبض حوله ونجوم صغيرة تدور عليها، مع الوحدات فيختفي ما خلف المبنى منها (renderer.js)
// - شارة فوق كل مبنى مميز وفوق علم كل قرية ينتظر أهلها، كشارات مباني الاقتصاد (empireArt.js)
// - غبار العاصفة الرملية فوق المشهد كله
import { TILE_HALF_W, TILE_HALF_H, EMPIRE as E, CITY_FEATURES as F } from '../config.js';
import { poly, ln, circ, el, rc, box, cyl, dome, arch, ridgeRoof, qL, qR, wL, wR, hsh, getCtx, getTone, getToneInfo, setTone } from './cityThemes.js';
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
}

// --- دوجو الساموراي (إيدو): منصة بدرجات، وقاعة خشب داكن بألواح بيضاء وأعمدة حمراء، وسقفان مقعّران
// بحافة ذهبية وزعانف ذهبية، ولوحة اسم، ورايتان طويلتان بشعار دائري ---
function dojo(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(30,20,15,0.22)');
  box(x, y + 2, 33, 16.5, 5, '#77736b', '#96918a', '#a8a39a');
  box(x + 9, y + 9.5, 7, 3.5, 2.5, '#77736b', '#96918a', '#a8a39a');              // درجات المدخل
  const by = y - 3, w = 25, d = 12.5, h = 15;
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
  ridgeRoof(x, by, w, d, h, 12, { ov: 7, sag: 2.8, flare: 4, front: '#3f8f6a', front2: '#367d5c', end: '#327256', end2: '#2b6249',
                                  back: '#22503b', tile: 'rgba(10,40,25,0.35)', ridge: '#d1a33f', ridgeW: 1.8 });
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
}

// --- الحصن (غوندر): سور قاعدة، وبرج أسطواني خلفي أعلى، وقلعة مربعة بشُرَف ونوافذ مقوسة، وبرجان أماميان
// بقباب، وبوابة خشبية، وراية خضراء بحافة ذهبية ---
function roundTower(x, y, r, h) {
  cyl(x, y, r, h, '#76603f', '#a3845b');
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
  box(x, by, w, d, h, '#7b6346', '#9c7d57', '#8b6f4d');
  const ql = qL(x, by, w, d), qr = qR(x, by, w, d);
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
}

const BUILDINGS = { pyramid, dojo, clinic, fortress, khartoum };

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
// ومشاعل الحصن وبرج الخرطوم. على أرض يُمشى عليها، فهي صغيرة كأعمدة الإنارة
export function drawFeaturePlaza(map, i, j, x, y) {
  const d = map.districtOf(i, j);
  if (!d || !d.featureBig || d.featureTile === undefined) return;
  const at = tileOf(map, d.featureTile), i0 = at.i - 1, j0 = at.j - 1;
  const corner = (i === i0 - 1 || i === i0 + 2) && (j === j0 - 1 || j === j0 + 2);
  if (!corner) return;
  const saved = getTone(), savedInfo = getToneInfo();
  setTone(null);
  const prop = PROPS[d.feature];
  if (prop) prop(x, y);
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
  khartoum: brazier
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
