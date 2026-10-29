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
}

// --- تمثال ريو: تل من الغرانيت تكسو الغابة سفحه وتعلوه صخرة عارية، وعلى قمته منصة وقاعدة بطراز آرت ديكو،
// والتمثال بذراعين مفتوحتين من الحجر الفاتح ---
function statue(x, y, i, j) {
  el(x, y + 7, 38, 17, 'rgba(25,30,20,0.24)');
  const P = [x + 1, y - 30];
  // نقطة على سطح التل: u من −1 (يسار) إلى 1 (يمين) على قوس القاعدة، وt من القاعدة (0) إلى القمة (1)، بانتفاخ يجعله قبة
  const S = (u, t) => {
    const bx = x + 34 * u, by = y + 1 + 16 * Math.sqrt(Math.max(0, 1 - u * u)), s = Math.sin(Math.PI * t);
    return [bx + (P[0] - bx) * t + 7 * u * s, by + (P[1] - by) * t - 6 * s];
  };
  // ما بين u0 وu1 من الحد السفلي tb(u) حتى القمة
  const side = (u0, u1, tb, color) => {
    const pts = [];
    for (let k = 0; k <= 12; k++) { const u = u0 + (u1 - u0) * k / 12; pts.push(S(u, tb(u))); }
    for (let k = 1; k <= 10; k++) pts.push(S(u1, tb(u1) + (1 - tb(u1)) * k / 10));
    for (let k = 9; k > 0; k--) pts.push(S(u0, tb(u0) + (1 - tb(u0)) * k / 10));
    poly(pts, color);
  };
  const ground = () => 0, rock = (u) => 0.42 + 0.07 * Math.sin(u * 7 + 1.3);
  side(-1, 0, ground, '#3f6a3a');                                                   // الغابة
  side(0, 1, ground, '#55874a');
  side(-1, 0, rock, '#76746c');                                                     // الصخرة العارية
  side(0, 1, rock, '#9a978d');
  const edge = [];                                                                   // حد الغابة المتعرج
  for (let k = 0; k <= 20; k++) { const u = -1 + k / 10; edge.push(S(u, rock(u) - 0.02)); }
  edge.forEach(([px, py], k) => circ(px, py, 2.3, k < 10 ? '#3a6334' : '#4f8044'));
  for (let k = 0; k < 44; k++) {                                                     // تيجان الأشجار، مواضعها ثابتة لكل خريطة
    const u = -0.95 + 1.9 * hsh(i, j, 900 + k), t = 0.04 + (rock(u) - 0.12) * hsh(i, j, 940 + k);
    const [px, py] = S(u, t), r = 1.8 + hsh(i, j, 980 + k) * 1.3;
    circ(px + 0.5, py + 0.6, r, u < 0 ? '#2c4e28' : '#3d6c36');                          // ظل التاج
    circ(px, py, r, u < 0 ? (k % 2 ? '#3b6635' : '#4a7a42') : (k % 2 ? '#6aa055' : '#579048'));
  }
  for (const u of [-0.45, -0.2, 0.25, 0.55]) {                                       // شقوق الصخرة
    const a = S(u, rock(u) + 0.06), b = S(u + 0.08, 0.9);
    ln(a[0], a[1], b[0], b[1], 'rgba(255,255,255,0.22)', 0.6);
  }
  // المنصة والقاعدة
  el(P[0], P[1] + 1.2, 9, 3.8, '#8f8b80');
  el(P[0], P[1], 8.4, 3.4, '#bdb7a8');
  const pedestal = P[1] - 0.5;
  box(P[0], pedestal, 3.4, 1.7, 9, '#cbc4b4', '#e4ded0', '#dcd6c8');
  box(P[0], pedestal - 9, 2.5, 1.25, 2, '#cbc4b4', '#e4ded0', '#dcd6c8');
  // التمثال: حد داكن حوله ليُقرأ على الأرض الفاتحة، ثم الثوب والذراعان المفتوحتان والرأس
  const fx = P[0], fy = pedestal - 11, sh = fy - 20, c = getCtx();
  c.beginPath();
  [[fx - 15.5, sh], [fx + 15.5, sh], [fx + 15.5, sh + 2.6], [fx + 2.6, sh + 6], [fx + 3, fy], [fx - 3, fy],
   [fx - 2.6, sh + 6], [fx - 15.5, sh + 2.6]].forEach(([px, py], k) => (k ? c.lineTo(px, py) : c.moveTo(px, py)));
  c.closePath();
  c.moveTo(fx + 2.4, sh - 3);
  c.arc(fx, sh - 3, 2.4, 0, TAU);
  c.strokeStyle = 'rgba(55,55,50,0.55)';
  c.lineWidth = 1.4;
  c.stroke();
  poly([[fx - 3, fy], [fx, fy + 0.7], [fx, sh], [fx - 2.5, sh]], '#cdc7b9');
  poly([[fx, fy + 0.7], [fx + 3, fy], [fx + 2.5, sh], [fx, sh]], '#f1ede4');
  poly([[fx - 15.5, sh], [fx, sh - 0.5], [fx, sh + 4], [fx - 2.6, sh + 6], [fx - 15.5, sh + 2.6]], '#cdc7b9');
  poly([[fx, sh - 0.5], [fx + 15.5, sh], [fx + 15.5, sh + 2.6], [fx + 2.6, sh + 6], [fx, sh + 4]], '#f1ede4');
  ln(fx, sh + 6, fx, fy, 'rgba(0,0,0,0.12)', 0.5);                                   // ثنية الثوب
  circ(fx, sh - 3, 2.4, '#f1ede4');
  el(fx - 0.9, sh - 3, 1.2, 2.1, 'rgba(0,0,0,0.12)');
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
}

// --- محطة القطار (المدينة الأوروبية): رصيف حجري بقضيبين خارجين منه، وقاعة من الطوب بواجهة حجرية وقوس زجاجي كبير
// بأضلاع، وساعة فوق المدخل، وبرجان صغيران بسقفين مدببين، وسقيفة حديدية مقوسة خلفها ---
function station(x, y, i, j) {
  el(x, y + 6, 37, 16, 'rgba(30,25,20,0.22)');
  box(x, y + 2, 33, 16.5, 2.5, '#8a8479', '#a59e92', '#b0a99c');
  for (const off of [-3.2, 3.2]) {                                   // القضيبان على الرصيف نحو الحافة اليمنى
    ln(x + 6 + off, y + 5 + off * 0.5, x + 30 + off, y - 7 + off * 0.5, '#5c5650', 0.8);
  }
  for (let k = 0; k < 8; k++) {
    const t = k / 7, px = x + 6 + 24 * t, py = y + 5 - 12 * t;
    ln(px - 4.2, py - 2.1, px + 4.2, py + 2.1, '#6e5a44', 0.9);
  }
  const by = y - 2;
  // السقيفة الحديدية المقوسة خلف القاعة
  const ctx = getCtx();
  ctx.beginPath();
  ctx.ellipse(x - 4, by - 20, 18, 12, -0.46, Math.PI, 0);
  ctx.fillStyle = '#5d6b78';
  ctx.fill();
  for (let k = 1; k < 6; k++) {
    const a = Math.PI + k * Math.PI / 6;
    ln(x - 4, by - 20, x - 4 + Math.cos(a) * 17.5, by - 20 + Math.sin(a) * 11.5, 'rgba(220,235,245,0.35)', 0.6);
  }
  const w = 22, d = 11, h = 20;
  box(x, by, w, d, h, '#9a4f3a', '#b45f45');
  const L = qL(x, by, w, d), R = qR(x, by, w, d);
  for (const q of [L, R]) {                                          // حزام حجري وأركان
    const a = q(0, h - 1.5), b = q(1, h - 1.5);
    ln(a[0], a[1], b[0], b[1], '#e2d3b6', 1.6);
    const c = q(0, 1), e = q(1, 1);
    ln(c[0], c[1], e[0], e[1], '#d2c2a4', 1.1);
  }
  for (const u of [0.12, 0.38, 0.64]) arch(L, u, 0.16, 9, '#2b3442');   // نوافذ مقوسة
  // القوس الزجاجي الكبير بأضلاعه، والمدخل تحته
  arch(R, 0.18, 0.64, 17, '#e2d3b6');
  arch((a, b) => R(a + 0.02, b), 0.18, 0.6, 15.8, '#7fa3bf');
  const c0 = R(0.5, 9.4);
  for (let k = 0; k <= 6; k++) {
    const t = k / 6, p = R(0.2 + 0.6 * t, 9.4 + Math.sin(Math.PI * t) * 5.6);
    ln(c0[0], c0[1], p[0], p[1], 'rgba(40,50,60,0.6)', 0.5);
  }
  poly([R(0.4, 0), R(0.6, 0), R(0.6, 6), R(0.4, 6)], '#3a2c22');
  const ck = R(0.5, h + 3.2);                                        // الساعة فوق المدخل
  poly([R(0.4, h - 0.5), R(0.6, h - 0.5), R(0.6, h + 6.5), R(0.4, h + 6.5)], '#b45f45');
  faceDisc(R, 0.5, h + 3, 2.6, w, '#f4efe2');
  ln(ck[0], ck[1] - 0.2, ck[0], ck[1] - 2, '#262626', 0.45);
  ln(ck[0], ck[1] - 0.2, ck[0] + 1.3, ck[1] + 0.2, '#262626', 0.55);
  ridgeRoof(x, by, w, d, h, 7, { ov: 2, front: '#4b5661', back: '#3a434c', end: '#5a6670', ridge: '#2e353c', ridgeW: 1 });
  for (const [px, py] of [[x - w, by], [x + w, by]]) {               // البرجان الصغيران
    box(px, py, 3.2, 1.6, h + 7, '#9a4f3a', '#b45f45');
    hipRoof(px, py - h - 7, 3.6, 1.8, 0, 7, '#4b5661', '#66737f');
  }
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
  // القضبان والعربة المحمّلة بالفضة
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
}

const BUILDINGS = { pyramid, dojo, clinic, fortress, khartoum, policeHQ, clock, complex, statue, mercs, souk, triads, stable,
                    station, mine, bank };

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
  station(x, y) {                        // إشارة سكة بذراع حمراء ومصباح
    ln(x, y, x, y - 16, '#2a2d33', 0.9);
    poly([[x, y - 15], [x + 6, y - 16.6], [x + 6, y - 15.2], [x, y - 13.6]], '#c0392b');
    circ(x - 1.2, y - 12, 1, '#8cff8a');
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
  // تمثال بذراعين مفتوحتين
  statue(ctx, x, y, s) {
    ctx.fillStyle = '#f2efe6';
    ctx.fillRect(x - s * 0.95, y - s * 0.5, s * 1.9, s * 0.28);
    tri(ctx, [[x - s * 0.28, y - s * 0.5], [x + s * 0.28, y - s * 0.5], [x + s * 0.4, y + s * 0.95], [x - s * 0.4, y + s * 0.95]], '#f2efe6');
    ctx.beginPath();
    ctx.arc(x, y - s * 0.78, s * 0.22, 0, TAU);
    ctx.fill();
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
  // قاطرة بمدخنة ودخان
  station(ctx, x, y, s) {
    ctx.fillStyle = '#2a2d33';
    ctx.fillRect(x - s * 0.85, y - s * 0.25, s * 1.4, s * 0.7);
    ctx.fillRect(x + s * 0.2, y - s * 0.75, s * 0.55, s * 0.5);
    ctx.fillRect(x - s * 0.6, y - s * 0.7, s * 0.25, s * 0.45);
    ctx.fillStyle = '#c0392b';
    for (const px of [-0.55, 0, 0.45]) { ctx.beginPath(); ctx.arc(x + s * px, y + s * 0.55, s * 0.22, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(240,240,240,0.85)';
    ctx.beginPath(); ctx.arc(x - s * 0.5, y - s * 0.95, s * 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x - s * 0.25, y - s * 1.05, s * 0.15, 0, TAU); ctx.fill();
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

// --- القطار في الطريق: خط متقطع بين المحطتين وقاطرة صغيرة تمضي عليه، والخزنة فوق البنك ---
export function drawTrains(ctx, state, visible) {
  if (!state.trains || !state.trains.length) return;
  const map = state.map, now = state.time / TICK_SEC, total = F.station.seconds / TICK_SEC;
  for (const train of state.trains) {
    const a = map.districts[train.from].capture, b = map.districts[train.to].capture;
    const p = worldOf(a.i, a.j), q = worldOf(b.i, b.j), t = Math.max(0, Math.min(1, 1 - (train.at - now) / total));
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 4);
    ctx.lineTo(q.x, q.y - 4);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(120,170,255,0.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.setLineDash([]);
    const x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t - 8;
    if (!visible(x, y)) continue;
    const dir = q.x >= p.x ? 1 : -1;
    ctx.fillStyle = '#2a2d33';
    ctx.fillRect(x - 6, y - 3, 12, 6);
    ctx.fillRect(x + (dir > 0 ? 1 : -5), y - 7, 4, 4);
    ctx.fillStyle = '#c0392b';
    for (const dx of [-4, 0, 4]) { ctx.beginPath(); ctx.arc(x + dx, y + 3.4, 1.6, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(240,240,240,0.8)';
    ctx.beginPath(); ctx.arc(x - dir * 4, y - 9 - (t * 40 % 3), 2, 0, TAU); ctx.fill();
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
