// صور أولية للمباني المقترحة (GAME_SPEC 3.14) بأدوات رسم اللعبة نفسها، ليطورها المستخدم. ليست في اللعبة.
// كل دالة ترسم كتلة 2×2 مركزها (x, y) كما يرسم drawFeatureBuilding المباني المميزة
import { poly, circ, ln, rc, el, box, qL, qR, wL, wR, arch, ridgeRoof, hipRoof, dome, cyl, cone, getCtx } from '/js/render/cityThemes.js';
import { frustum, fL, fR } from '/js/render/empireBuildings.js';
import { streetPalm } from '/js/render/openCity.js';

const TAU = Math.PI * 2;
const shadow = (x, y) => el(x, y + 6, 37, 16, 'rgba(30,25,20,0.22)');
const base = (x, y, h, c) => { shadow(x, y); box(x, y + 2, 33, 16.5, h, c[0], c[1], c[2]); };
const STONE = ['#7c766c', '#9a9388', '#a8a196'], SAND = ['#a88f66', '#c4aa7e', '#d2b98e'], MUD = ['#a07c52', '#c9a476', '#d6b488'];
const ring = (x, y, rx, ry, col, w) => { const c = getCtx(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
const flagPole = (px, py, h, col, left = false) => {
  ln(px, py, px, py - h, '#2b2420', 1);
  const s = left ? -1 : 1;
  poly([[px, py - h], [px + s * 8, py - h + 2.5], [px, py - h + 5]], col);
};
const banner = (px, py, h, col, emblem) => {
  ln(px, py, px, py - h, '#2b2420', 1.1);
  poly([[px, py - h + 1], [px + 6, py - h + 1], [px + 6, py - h + 15], [px + 3, py - h + 12.5], [px, py - h + 15]], col);
  if (emblem) circ(px + 3, py - h + 7, 1.8, emblem);
};
const fire = (px, py) => {
  el(px, py, 3, 1.4, '#3a2a1e');
  poly([[px - 2, py], [px, py - 6], [px + 2, py]], '#e8893a');
  poly([[px - 1, py], [px, py - 3.6], [px + 1, py]], '#f2c14e');
};
const barrel = (px, py) => cyl(px, py, 1.8, 3.6, '#6b4a2e', '#8a6440', '#7a5636');
const crate = (px, py, s = 2.4) => box(px, py, s, s / 2, s, '#6b4a2e', '#8a6440', '#9c7450');
const lantern = (px, py, col = '#c8322a') => { ln(px, py - 4, px, py - 2.6, '#2b2420', 0.4); el(px, py, 1.4, 1.8, col); };
const cactus = (px, py) => {
  ln(px, py, px, py - 9, '#4f7a44', 2.2);
  ln(px - 2.6, py - 4, px - 2.6, py - 7, '#4f7a44', 1.6); ln(px - 2.6, py - 4, px, py - 4, '#4f7a44', 1.6);
  ln(px + 2.4, py - 5.5, px + 2.4, py - 8.5, '#5e8a50', 1.5); ln(px + 2.4, py - 5.5, px, py - 5.5, '#5e8a50', 1.5);
};
const roundHut = (px, py, r, h, wall, thatch) => {
  cyl(px, py, r, h, wall[0], wall[1]);
  cone(px, py - h + 0.6, r + 1.6, r * 1.3, thatch[0], thatch[1]);
  const q = (a, b) => [px - r * 0.3 + a * r * 0.6, py + r * 0.45 - b];
  arch(q, 0.2, 0.6, h * 0.62, '#2a1d14');
};
const pine = (px, py) => {
  ln(px, py, px, py - 9, '#5a3a22', 1.2);
  for (const [dy, r] of [[-6, 4], [-9, 3.4], [-11.6, 2.4]]) el(px, py + dy, r, r * 0.45, '#3f6a3a');
};

// ================= المعابد (الوسط) =================

// شبام: معبد أوام (محرم بلقيس) — سور بيضاوي من حجر الرمل، وثمانية أعمدة حجرية عالية أمامه، ودرج
function awwam(x, y, i, j) {
  base(x, y, 2.5, SAND);
  cyl(x - 6, y - 6, 22, 13, '#b39467', '#d6bc8e', '#c8ad80');
  el(x - 6, y - 19, 19, 9.5, '#8a7556');
  for (let k = 0; k < 9; k++) rc(x - 26 + k * 5, y - 15 - Math.abs(k - 4) * 0.5, 0.6, 1.4, '#7a6446');
  const P = [];
  for (let k = 0; k < 8; k++) P.push([x - 4 + k * 3.6, y + 9 - k * 1.8]);
  for (const [px, py] of P) box(px, py, 1.3, 0.65, 27, '#a88d62', '#d0b585', '#dcc49a');
  poly([[P[0][0] - 1.3, P[0][1] - 27], [P[7][0] + 1.3, P[7][1] - 27], [P[7][0] + 1.3, P[7][1] - 29], [P[0][0] - 1.3, P[0][1] - 29]], '#c8ad80');
  box(x + 10, y + 11, 9, 4.5, 1.2, ...SAND);
  box(x + 10, y + 12.4, 7, 3.5, 1.2, ...SAND);
  for (const [px, py] of [[x - 28, y + 1], [x + 27, y]]) { const c = getCtx(); c.save(); streetPalm(px, py, i, j); c.restore(); }
}

// إيدو: معبد سينسو-جي — القاعة الرئيسية الحمراء بسقف رمادي ضخم، والباغودا الخماسية، والفانوس الأحمر الكبير في البوابة
function sensoji(x, y, i, j) {
  base(x, y, 4, STONE);
  const px = x - 20, py = y - 2;                                             // الباغودا
  for (let k = 0; k < 5; k++) {
    const w = 5.2 - k * 0.6, by = py - 4 - k * 7.4;
    box(px, by, w, w / 2, 5.2, '#8a2a22', '#b3362b');
    ridgeRoof(px, by, w, w / 2, 5.2, 2.2, { ov: 4, sag: 0.8, flare: 1.8, front: '#3a3f4b', front2: '#2e333e', end: '#353a45', back: '#23262e', ridge: '#2b2f39', k: 0.2 });
  }
  ln(px, py - 41, px, py - 52, '#d4af4f', 1);
  for (let k = 0; k < 5; k++) circ(px, py - 43 - k * 1.8, 0.9, '#d4af4f');
  const hx = x + 3, hy = y - 4, w = 18, d = 9, h = 11;                       // القاعة
  box(hx, hy, w, d, h, '#7a2a22', '#a8382c');
  const R = qR(hx, hy, w, d), L = qL(hx, hy, w, d);
  for (let k = 0; k <= 5; k++) { const u = 0.04 + k * 0.18, a = R(u, 0), b = R(u, h); ln(a[0], a[1], b[0], b[1], '#5a1a14', 0.8); }
  for (let k = 0; k < 4; k++) wL(hx, hy, w, d, 0.1 + k * 0.22, 3, 0.14, 6, '#d9cdb2');
  poly([R(0.3, 0), R(0.7, 0), R(0.7, 8), R(0.3, 8)], '#2a1a12');
  ridgeRoof(hx, hy, w, d, h, 15, { ov: 7, sag: 3, flare: 3.6, front: '#3a3f4b', front2: '#2e333e', end: '#353a45', end2: '#2b2f39', back: '#23262e', tile: 'rgba(0,0,0,0.28)', ridge: '#c9a046', ridgeW: 1.8 });
  const gx = x + 20, gy = y + 9;                                             // بوابة كامينارمون بالفانوس
  for (const [a, b] of [[gx - 5, gy + 1.5], [gx + 5, gy - 3.5]]) ln(a, b, a, b - 11, '#b3362b', 1.6);
  ridgeRoof(gx, gy - 1, 6.5, 3.2, 11, 4, { ov: 3, sag: 0.8, flare: 1.6, front: '#3a3f4b', end: '#353a45', back: '#23262e', ridge: '#2b2f39' });
  el(gx, gy - 5.5, 3.2, 4.4, '#c8322a');
  ln(gx - 3, gy - 7.5, gx + 3, gy - 7.5, '#1c1410', 0.8); ln(gx - 3, gy - 3.4, gx + 3, gy - 3.4, '#1c1410', 0.8);
  rc(gx - 1.2, gy - 6.4, 2.4, 1.8, '#1c1410');
}

// الصينية: معبد السماء — ثلاث مصاطب رخام بيضاء دائرية، وقاعة حمراء مستديرة بثلاثة سقوف زرقاء وقمة ذهبية
function heaven(x, y) {
  shadow(x, y);
  for (const [r, v] of [[31, 0], [25, 2.6], [19.5, 5.2]]) {
    cyl(x, y + 2 - v, r, 2.6, '#cfcac0', '#f2eee6', '#f6f3ec');
    ring(x, y + 2 - v - 2.6, r - 0.6, (r - 0.6) / 2, 'rgba(150,140,125,0.6)', 0.5);
  }
  cyl(x, y - 5.2, 12.5, 9, '#8a2a22', '#c43a2c');
  for (let k = 0; k < 7; k++) { const a = Math.PI * (0.1 + k * 0.13), px = x - Math.cos(a) * 12.5, py = y - 5.2 + Math.sin(a) * 6.25; ln(px, py, px, py - 9, '#5a1a14', 0.7); }
  cone(x, y - 13.6, 17.5, 7, '#1f3f8a', '#2f5fb0');
  cyl(x, y - 17.2, 9.5, 5, '#8a2a22', '#c43a2c');
  cone(x, y - 21.6, 13.5, 6.4, '#1f3f8a', '#2f5fb0');
  cyl(x, y - 24.8, 7, 4.4, '#8a2a22', '#c43a2c');
  cone(x, y - 28.6, 10, 10, '#1f3f8a', '#2f5fb0');
  el(x, y - 38.5, 1.6, 2.2, '#e2bd4f');
  ln(x, y - 40.5, x, y - 43, '#e2bd4f', 0.9);
}

// هونغ كونغ: معبد مان مو — قاعة حجرية بسقف أخضر مزجج وتنانين على الحافة، وأبواب حمراء، ولفائف بخور معلقة ومبخرة
function manmo(x, y) {
  base(x, y, 2.5, STONE);
  const hx = x - 2, hy = y - 3, w = 22, d = 11, h = 11;
  box(hx, hy, w, d, h, '#8f8270', '#ad9f88');
  const R = qR(hx, hy, w, d);
  for (const u of [0.18, 0.5]) poly([R(u, 0), R(u + 0.2, 0), R(u + 0.2, 8.5), R(u, 8.5)], '#b3262f');
  for (const u of [0.18, 0.5]) { const a = R(u + 0.1, 0), b = R(u + 0.1, 8.5); ln(a[0], a[1], b[0], b[1], '#d4af4f', 0.6); }
  poly([R(0.25, 9.4), R(0.65, 9.4), R(0.65, 11), R(0.25, 11)], '#2a1a12');
  const top = ridgeRoof(hx, hy, w, d, h, 9, { ov: 4, sag: 1.6, flare: 2.6, front: '#3f7a4a', front2: '#356a40', end: '#3a7045', end2: '#30603a', back: '#2a4a30', tile: 'rgba(0,0,0,0.25)', ridge: '#c9a046', ridgeW: 1.8 });
  for (const [P, s] of [[top.P1, -1], [top.P2, 1]]) {                         // تنانين الحافة
    poly([[P[0], P[1]], [P[0] + s * 1.5, P[1] - 5], [P[0] + s * 4, P[1] - 5.5], [P[0] + s * 2.5, P[1] - 2.8], [P[0] + s * 3.4, P[1]]], '#c9a046');
    circ(P[0] + s * 1.6, P[1] - 5.6, 0.9, '#c9a046');
  }
  { const a = top.P1, b = top.P2; circ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 2, 1.8, '#c43a2c'); }
  for (let k = 0; k < 3; k++) {                                               // لفائف البخور
    const cx = x + 10 + k * 5, cy = y + 7 - k * 2.5;
    ln(cx, cy - 15, cx, cy - 11, '#2b2420', 0.4);
    for (let r = 0; r < 3; r++) ring(cx, cy - 8 + r * 1.6, 3 - r * 0.8, (3 - r * 0.8) * 0.4, '#b98a3a', 0.6);
  }
  box(x + 15, y + 10, 3, 1.5, 3, '#6a5a3a', '#8a7a52', '#9c8c62');            // المبخرة ودخانها
  for (let k = 0; k < 3; k++) ln(x + 14 + k, y + 6, x + 13 + k * 1.6, y - 2, 'rgba(220,220,220,0.5)', 0.5);
  lantern(x - 22, y + 2); lantern(x + 22, y - 2);
}

// جايبور: هوا محل (قصر الرياح) — واجهة وردية متدرجة بخمسة طوابق من الشرفات الصغيرة بقباب
function hawaMahal(x, y) {
  base(x, y, 2.5, ['#a86a58', '#c98270', '#d6927e']);
  const tiers = 5;
  for (let t = 0; t < tiers; t++) {
    const w0 = 28 - t * 4.6, by = y - t * 8;
    frustum(x, by, w0, w0 - 0.4, 8, '#c0624e', '#e08a70', '#e9a088');
    const L = fL(x, by, w0, w0 - 0.4, 8), R = fR(x, by, w0, w0 - 0.4, 8), n = Math.max(2, 7 - t);
    for (const q of [L, R]) {
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n - 0.05;
        arch((a, b) => q(a, b + 1.2), u, 0.1, 5, '#f2e6d8');
        arch((a, b) => q(a + 0.015, b + 1.6), u, 0.07, 3.6, '#5a2e22');
        const p = q(u + 0.05, 7.6);
        dome(p[0], p[1], 1.3, '#f4e8da', '#d8c4ae');
      }
    }
  }
  const ty = y - tiers * 8;
  for (const dx of [-7, 0, 7]) dome(x + dx, ty + 1 - Math.abs(dx) * 0.2, 2.6, '#f4e8da', '#d8c4ae', '#d4af4f');
}

// كايفنغ: الباغودا الحديدية — برج طوب مثمن نحيل بثلاثة عشر طابقاً بلون الحديد، وأطراف بارزة لكل طابق
function ironPagoda(x, y) {
  base(x, y, 3, STONE);
  box(x, y - 1, 12, 6, 3, '#6f695f', '#8b857a', '#9a9388');
  let by = y - 4;
  for (let k = 0; k < 12; k++) {
    const r = 8.6 - k * 0.42, h = 5.2 - k * 0.12;
    cyl(x, by, r, h, '#4a3022', '#7a5236');
    rc(x - 0.8, by - h * 0.75, 1.6, h * 0.55, '#1c140e');
    by -= h;
    el(x, by + 0.6, r + 2.6, (r + 2.6) * 0.42, '#3a2a20');
    el(x, by, r + 2.2, (r + 2.2) * 0.38, '#5a3e2a');
  }
  cone(x, by, 4, 9, '#3a2a20', '#5a3e2a');
  ln(x, by - 9, x, by - 14, '#d4af4f', 1);
  circ(x, by - 12, 1.2, '#d4af4f');
  pine(x - 26, y); pine(x + 25, y - 1);
}

// النرويجية: كنيسة الألواح الخشبية — طبقات سقوف خشبية داكنة شديدة الميل، ورؤوس تنانين على الأطراف، وبرج مدبب
function staveChurch(x, y) {
  base(x, y, 2, STONE);
  const dark = { gable: true, front: '#2e2218', back: '#21180f', wallEnd: '#4a3324', eave: '#1a120b', ridge: '#140d08', ridgeW: 1, tile: 'rgba(0,0,0,0.35)' };
  const dragon = (P, s) => {
    const c = getCtx(); c.beginPath(); c.moveTo(P[0], P[1]);
    c.quadraticCurveTo(P[0] + s * 4, P[1] - 6, P[0] + s * 1.5, P[1] - 9); c.strokeStyle = '#1a120b'; c.lineWidth = 1.4; c.stroke();
    circ(P[0] + s * 1.5, P[1] - 9, 1, '#1a120b');
  };
  box(x, y - 2, 20, 10, 8, '#4a3324', '#5e4230');
  for (let k = 0; k < 6; k++) { const a = qR(x, y - 2, 20, 10)(0.08 + k * 0.16, 0), b = qR(x, y - 2, 20, 10)(0.08 + k * 0.16, 8); ln(a[0], a[1], b[0], b[1], '#3a281c', 0.6); }
  let r = ridgeRoof(x, y - 2, 20, 10, 8, 9, { ...dark, ov: 2 });
  dragon(r.P2, 1);
  box(x, y - 13, 13, 6.5, 7, '#4a3324', '#5e4230');
  r = ridgeRoof(x, y - 13, 13, 6.5, 7, 8, { ...dark, ov: 2 });
  dragon(r.P2, 1); dragon(r.P1, -1);
  box(x, y - 23, 7, 3.5, 6, '#4a3324', '#5e4230');
  ridgeRoof(x, y - 23, 7, 3.5, 6, 6, { ...dark, ov: 1.5 });
  box(x, y - 35, 2.6, 1.3, 4, '#4a3324', '#5e4230');
  cone(x, y - 39, 3.6, 14, '#21180f', '#2e2218');
  ln(x, y - 53, x, y - 57, '#d4af4f', 0.8); ln(x - 1.6, y - 55.6, x + 1.6, y - 55.6, '#d4af4f', 0.8);
  pine(x - 27, y); pine(x + 26, y - 1); pine(x - 20, y + 9);
}

// غوندر: كنيسة دبرا برهان سلاسي — قاعة حجرية بسقف قش، وصليب حبشي مزخرف، وسور حجري وبرج بوابة دائري
function debreBerhan(x, y) {
  base(x, y, 2, ['#6e5a46', '#8a7058', '#9a7e64']);
  for (let k = 0; k <= 12; k++) {                                              // سور حجري منخفض على الحافتين الخلفيتين
    const t = k / 12;
    box(x - 30 + t * 30, y + 1 - t * 15, 1.6, 0.8, 4, '#6e5a46', '#8a7058', '#9a7e64');
    box(x + t * 30, y - 14 + t * 15, 1.6, 0.8, 4, '#6e5a46', '#8a7058', '#9a7e64');
  }
  const hx = x + 1, hy = y - 2, w = 16, d = 8, h = 12;
  box(hx, hy, w, d, h, '#7a6048', '#9c7c5e');
  const R = qR(hx, hy, w, d);
  arch(R, 0.38, 0.26, 8, '#3a2618');
  for (const u of [0.12, 0.72]) wR(hx, hy, w, d, u, 6, 0.1, 3, '#2a1d14');
  hipRoof(hx, hy, w + 2, d + 1, h, 9, '#9c7a44', '#b8945a');
  const cx = hx, cy = hy - h - 9;                                             // الصليب الحبشي
  ln(cx, cy, cx, cy - 7, '#d4af4f', 0.9);
  ring(cx, cy - 8.4, 1.6, 1.6, '#d4af4f', 0.8);
  ln(cx - 3, cy - 5.6, cx + 3, cy - 5.6, '#d4af4f', 0.8);
  for (const s of [-1, 1]) ring(cx + s * 3.2, cy - 5.6, 0.9, 0.9, '#d4af4f', 0.6);
  const tx = x - 20, ty = y + 6;                                              // برج البوابة الدائري
  cyl(tx, ty, 5.5, 14, '#6e5a46', '#9a7e64');
  cone(tx, ty - 13.4, 7, 9, '#8a6a3a', '#a6844c');
  arch((a, b) => [tx - 2 + a * 4, ty + 2.4 - b], 0, 1, 6, '#2a1d14');
}

// مروي: معبد آمون — بوابة صرحية من الحجر الرملي بنقوش، وقاعة أعمدة خلفها، وكباش حجرية على جانبي الطريق
function amun(x, y) {
  base(x, y, 2, SAND);
  box(x - 6, y - 7, 16, 8, 12, '#a8875a', '#c9a674', '#d2b080');            // قاعة الأعمدة
  for (let k = 0; k < 5; k++) { const p = qR(x - 6, y - 7, 16, 8)(0.1 + k * 0.2, 0); box(p[0], p[1] + 1, 1.2, 0.6, 12, '#a07c4e', '#c8a06c'); }
  const gx = x + 6, gy = y + 3;                                               // الصرح بقسميه
  for (const s of [-1, 1]) {
    const px = gx + s * 9, py = gy - s * 4.5;
    frustum(px, py, 9, 7, 24, '#b08a5a', '#d6b07c', '#dcba88');
    const R = fR(px, py, 9, 7, 24);
    for (let v = 4; v < 22; v += 3.5) { const a = R(0.15, v), b = R(0.85, v); ln(a[0], a[1], b[0], b[1], 'rgba(90,60,30,0.35)', 0.5); }
    for (let k = 0; k < 6; k++) { const p = R(0.2 + (k % 3) * 0.25, 8 + Math.floor(k / 3) * 7); rc(p[0] - 0.6, p[1] - 1.6, 1.2, 1.6, 'rgba(70,45,20,0.55)'); }
  }
  const R = qR(gx, gy, 4, 2);
  poly([R(0, 0), R(1, 0), R(1, 15), R(0, 15)], '#3a2618');
  poly([R(-0.3, 15), R(1.3, 15), R(1.3, 17.5), R(-0.3, 17.5)], '#c9a674');
  for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {                       // الكباش
    const px = gx + 8 + k * 6 + s * 4, py = gy + 10 - k * 3 + s * 2;
    box(px, py, 2, 1, 1.6, '#a07c4e', '#c8a06c', '#d2b080');
    el(px + 0.6, py - 3, 1.8, 1.2, '#c8a06c'); circ(px + 2, py - 3.6, 1.1, '#b8925e');
  }
}

// المكسيكية: الكاتدرائية الكبرى — حجر وردي، وبرجا أجراس بقبتين صغيرتين، وقبة كبرى على أسطوانة، وبوابة باروكية
function catedral(x, y) {
  base(x, y, 3, ['#8a6a5a', '#a8826e', '#b6907c']);
  const nx = x - 7, ny = y - 4;
  box(nx, ny, 18, 9, 15, '#a07a64', '#c09a82', '#c9a48c');
  for (const u of [0.15, 0.45, 0.75]) arch((a, b) => qL(nx, ny, 18, 9)(a, b + 6), u, 0.12, 6, '#3a2620');
  cyl(nx, ny - 15, 6.5, 6, '#b08a72', '#d0aa90');
  dome(nx, ny - 21, 6.5, '#d8c4a8', '#b8a080', '#d4af4f');
  const fx = x + 9, fy = y + 4, fw = 14, fd = 7, fh = 20;
  const tower = (tx, ty) => {
    box(tx, ty, 4.4, 2.2, fh + 10, '#a07a64', '#c4a088');
    for (const q of [qR(tx, ty, 4.4, 2.2), qL(tx, ty, 4.4, 2.2)]) arch((a, b) => q(a, b + fh + 2), 0.25, 0.5, 6, '#2a1d18');
    dome(tx, ty - fh - 10, 4.4, '#d8c4a8', '#b8a080');
    ln(tx, ty - fh - 15, tx, ty - fh - 19.5, '#d4af4f', 0.8); ln(tx - 1.4, ty - fh - 18, tx + 1.4, ty - fh - 18, '#d4af4f', 0.8);
  };
  tower(fx + fw, fy);
  box(fx, fy, fw, fd, fh, '#ab846c', '#ccaa90');
  const R = qR(fx, fy, fw, fd);
  arch(R, 0.38, 0.26, 11, '#d8c4a8'); arch((a, b) => R(a + 0.03, b), 0.38, 0.2, 9.4, '#3a2620');
  for (const u of [0.2, 0.74]) { const a = R(u, 0), b = R(u, fh - 2); ln(a[0], a[1], b[0], b[1], '#d8c4a8', 1.2); }
  poly([R(0.3, fh), R(0.75, fh), R(0.52, fh + 7)], '#c09a82');
  tower(fx, fy + fd);
}

// لا بوكا: كنيسة سان خوان — صحن أبيض بسقف رمادي، وبرج قوطي مدبب، ونافذة وردية، ورايات بلوني الحي
function sanJuan(x, y) {
  base(x, y, 2.5, STONE);
  const nx = x - 6, ny = y - 4;
  box(nx, ny, 18, 9, 14, '#cfc8bc', '#ece6dc');
  for (const u of [0.15, 0.45, 0.75]) { arch((a, b) => qL(nx, ny, 18, 9)(a, b + 3), u, 0.12, 8, '#2c3a5a'); }
  ridgeRoof(nx, ny, 18, 9, 14, 11, { ov: 1.5, front: '#5a6470', back: '#3d454e', end: '#6a7480', ridge: '#2b3137' });
  const tx = x + 12, ty = y + 5;
  box(tx, ty, 5.5, 2.75, 30, '#d8d2c6', '#f2ece2');
  const T = qR(tx, ty, 5.5, 2.75);
  arch(T, 0.25, 0.5, 9, '#3a2c22');
  { const c = T(0.5, 18); ring(c[0], c[1], 2.4, 2.4, '#2c3a5a', 1.4); circ(c[0], c[1], 1.6, '#e2c04a'); }
  arch((a, b) => T(a, b + 23), 0.25, 0.5, 5, '#1c1820');
  cone(tx, ty - 30, 6.2, 18, '#4a5662', '#6a7682');
  ln(tx, ty - 48, tx, ty - 53, '#d4af4f', 0.9); ln(tx - 1.6, ty - 51, tx + 1.6, ty - 51, '#d4af4f', 0.9);
  banner(x - 27, y + 3, 20, '#1d4fa0', '#f2c230'); banner(x + 25, y - 3, 20, '#f2c230', '#1d4fa0');
}

// تينوتشتيتلان: تمبلو مايور — هرم مدرّج بأربع طبقات، ودرجان مزدوجان، ومعبدان على القمة: أحمر وأزرق
function templo(x, y) {
  shadow(x, y);
  const tiers = 4, th = 7;
  for (let t = 0; t < tiers; t++) {
    const w = 32 - t * 6;
    box(x, y + 2 - t * th, w, w / 2, th, '#8a8070', '#a89c88', '#b6aa96');
    const R = qR(x, y + 2 - t * th, w, w / 2);
    for (let k = 1; k < 8; k++) { const a = R(k / 8, 0), b = R(k / 8, th); ln(a[0], a[1], b[0], b[1], 'rgba(60,52,42,0.25)', 0.4); }
  }
  for (const u of [0.28, 0.56]) {                                               // الدرجان
    const R0 = qR(x, y + 2, 32, 16), Rt = qR(x, y + 2 - (tiers - 1) * th, 14, 7);
    const a = R0(u - 0.05, 0), b = R0(u + 0.05, 0), c = Rt(u + 0.05, th), d = Rt(u - 0.05, th);
    poly([a, b, c, d], '#5a5246');
    for (let k = 1; k < 12; k++) { const t = k / 12, p = [a[0] + (d[0] - a[0]) * t, a[1] + (d[1] - a[1]) * t], q = [b[0] + (c[0] - b[0]) * t, b[1] + (c[1] - b[1]) * t]; ln(p[0], p[1], q[0], q[1], 'rgba(180,170,150,0.5)', 0.4); }
  }
  const top = y + 2 - tiers * th;
  for (const [s, col, roof] of [[-1, '#a8382c', '#6a1e18'], [1, '#2f6db3', '#1c4478']]) {
    const sx = x + s * 6, sy = top - s * 3;
    box(sx, sy, 5, 2.5, 7, col, col, roof);
    poly([qR(sx, sy, 5, 2.5)(0.3, 0), qR(sx, sy, 5, 2.5)(0.7, 0), qR(sx, sy, 5, 2.5)(0.7, 4.5), qR(sx, sy, 5, 2.5)(0.3, 4.5)], '#1c140e');
    for (let k = 0; k < 4; k++) rc(sx - 4.5 + k * 3, sy - 10.5 + k * 0.4, 1.6, 1.8, '#e8e0d0');
  }
}

// ================= المرتزقة (الزوايا) =================

// اليمامة: مضارب البدو — بيتا شعر أسودان طويلان، وسجاد، ودلال القهوة على النار، وسروج
function bedouin(x, y, i, j) {
  shadow(x, y);
  poly([[x - 30, y + 2], [x, y + 17], [x + 30, y + 2], [x, y - 13]], '#d8c39a');
  const tent = (tx, ty, w, d) => {
    box(tx, ty, w, d, 3, '#3a2c22', '#4a3a2c');
    ridgeRoof(tx, ty, w, d, 3, 4.5, { ov: 2, front: '#2a2420', back: '#1c1814', end: '#33291f', ridge: '#120e0b', tile: 'rgba(180,160,120,0.25)' });
    for (let k = 0; k < 4; k++) { const p = qR(tx, ty, w, d)(0.12 + k * 0.25, 0); ln(p[0], p[1], p[0], p[1] - 4.6, '#6b4a2e', 0.6); }
  };
  tent(x - 8, y - 5, 18, 7);
  tent(x + 14, y + 4, 12, 5);
  poly([[x - 4, y + 9], [x + 4, y + 13], [x + 10, y + 10], [x + 2, y + 6]], '#a8322a');   // السجاد
  poly([[x - 2, y + 9.4], [x + 4, y + 12.4], [x + 8, y + 10.2], [x + 2, y + 7.2]], '#d8a13a');
  fire(x - 16, y + 9);
  for (const [px, py] of [[x - 13, y + 10.5], [x - 12, y + 9]]) { el(px, py - 1.6, 1, 1.6, '#c9a03a'); ln(px + 0.8, py - 2.6, px + 1.8, py - 3.6, '#c9a03a', 0.5); }
  crate(x + 22, y + 9);
  { const c = getCtx(); c.save(); streetPalm(x + 27, y - 4, i, j); c.restore(); }
}

// العربية: دار السيوف — بيت طين بعقد كبير، وكور الحداد بناره، والسندان، وحامل السيوف
function swordHouse(x, y) {
  base(x, y, 2, MUD);
  const hx = x - 4, hy = y - 4, w = 18, d = 9, h = 15;
  box(hx, hy, w, d, h, ...MUD);
  for (let k = 0; k < 8; k++) { const p = qR(hx, hy, w, d)(k / 8 + 0.05, h); poly([[p[0] - 1, p[1]], [p[0], p[1] - 2.4], [p[0] + 1, p[1]]], '#efe2c8'); }
  arch(qR(hx, hy, w, d), 0.3, 0.32, 10, '#3a2618');
  wL(hx, hy, w, d, 0.3, 9, 0.16, 3.2, '#3a2618');
  const fx = x + 16, fy = y + 6;                                               // الكور
  box(fx, fy, 4.5, 2.25, 5, '#6e5a46', '#8a7058', '#3a2a20');
  fire(fx, fy - 5);
  box(fx - 9, fy + 4, 2, 1, 2.4, '#3a3a3e', '#4a4a50', '#5a5a62');          // السندان
  const rx = x - 22, ry = y + 4;                                               // حامل السيوف
  ln(rx - 4, ry + 2, rx + 4, ry - 2, '#6b4a2e', 1.2);
  for (let k = 0; k < 4; k++) { const sx = rx - 3 + k * 2, sy = ry + 1.5 - k; ln(sx, sy, sx + 0.4, sy - 10, '#d8dce0', 0.7); ln(sx - 1, sy - 1, sx + 1, sy - 1, '#c9a046', 0.8); }
  flagPole(x + 26, y - 4, 26, '#2f7a3a');
}

// الدرعية: مجلس الفرسان — بيت نجدي بفتحات مثلثة، ومظلة سعف للخيل، وحامل رماح برايات
function knights(x, y) {
  base(x, y, 2.5, MUD);
  const hx = x - 8, hy = y - 4, w = 16, d = 8, h = 16;
  box(hx, hy, w, d, h, ...MUD);
  for (const q of [qL(hx, hy, w, d), qR(hx, hy, w, d)]) for (let k = 0; k < 4; k++) { const u = 0.12 + k * 0.22, a = q(u, h - 4), b = q(u + 0.07, h - 4), m = q(u + 0.035, h - 2); poly([a, b, m], '#3a2618'); }
  for (let k = 0; k < 7; k++) { const p = qR(hx, hy, w, d)(k / 7 + 0.06, h); poly([[p[0] - 0.9, p[1]], [p[0], p[1] - 2.2], [p[0] + 0.9, p[1]]], '#efe2c8'); }
  poly([qR(hx, hy, w, d)(0.4, 0), qR(hx, hy, w, d)(0.6, 0), qR(hx, hy, w, d)(0.6, 9), qR(hx, hy, w, d)(0.4, 9)], '#6b4526');
  const ax = x + 14, ay = y + 4;                                               // مظلة السعف
  for (const [a, b] of [[ax - 9, ay + 3], [ax + 9, ay - 6], [ax - 1, ay + 7.5], [ax + 1, ay - 9]]) ln(a, b, a, b - 9, '#6b4a2e', 0.9);
  poly([[ax - 11, ay - 6], [ax, ay - 12], [ax + 11, ay - 15], [ax, ay - 9.5]], '#8a7a3a');
  for (let k = 0; k < 8; k++) ln(ax - 10 + k * 2.8, ay - 6.5 - k * 1.2, ax - 9 + k * 2.8, ay - 4.5 - k * 1.2, '#6a5a2a', 0.5);
  ln(ax - 8, ay + 1, ax + 6, ay - 6, '#6b4a2e', 0.8);                         // حبل الخيل
  for (let k = 0; k < 4; k++) { const px = x - 26 + k * 2.2, py = y + 4 - k * 1.1; ln(px, py, px, py - 20, '#5a3a22', 0.6); poly([[px, py - 20], [px + 3.4, py - 19], [px, py - 17.6]], k % 2 ? '#2f7a3a' : '#f4ecdc'); }
}

// القاهرة: بيوت الفتوات — بيت قاهري بمشربية خشبية، ومقهى بكراسي وطاولات، وحزمة نبابيت
function futuwwa(x, y) {
  base(x, y, 2, ['#8a7a62', '#a8977c', '#b8a88c']);
  const hx = x - 6, hy = y - 4, w = 17, d = 8.5, h = 20;
  box(hx, hy, w, d, h, '#b8a07a', '#d6c09a', '#cdb690');
  const R = qR(hx, hy, w, d);
  for (const u of [0.15, 0.6]) {                                               // المشربيات
    const a = R(u, 9), b = R(u + 0.25, 9);
    poly([[a[0] + 1.4, a[1] + 0.7], [b[0] + 1.4, b[1] + 0.7], [b[0] + 1.4, b[1] - 7], [a[0] + 1.4, a[1] - 7]], '#6b4526');
    for (let k = 1; k < 5; k++) { const t = k / 5; ln(a[0] + 1.4 + (b[0] - a[0]) * t, a[1] + 0.7 + (b[1] - a[1]) * t, a[0] + 1.4 + (b[0] - a[0]) * t, a[1] - 7 + (b[1] - a[1]) * t, '#a8784a', 0.4); }
  }
  arch(R, 0.4, 0.2, 7, '#3a2618');
  for (const [px, py] of [[x + 9, y + 10], [x + 25, y + 2]]) ln(px, py, px, py - 10, '#5a3a22', 0.8);   // مظلة المقهى على عمودين
  for (let k = 0; k < 5; k++) {
    const a = [x + 6 + k * 3.6, y - 6 - k * 1.8], b = [x + 9.6 + k * 3.6, y - 7.8 - k * 1.8];
    poly([a, b, [b[0] + 1.4, b[1] + 3.6], [a[0] + 1.4, a[1] + 3.6]], k % 2 ? '#f2ece2' : '#b3362b');
  }
  for (const [px, py] of [[x + 12, y + 8], [x + 18, y + 5], [x + 15, y + 11]]) {
    cyl(px, py, 1.8, 3, '#6b4a2e', '#8a6440', '#9c7450');
    el(px + 2.6, py + 0.6, 0.8, 0.5, '#6b4a2e'); el(px - 2.6, py + 0.6, 0.8, 0.5, '#6b4a2e');
  }
  for (let k = 0; k < 4; k++) ln(x - 24 + k, y + 6, x - 21 + k * 1.6, y - 6, '#5a3a22', 0.9);   // النبابيت
  lantern(x + 2, y - 2, '#e8b04a');
}

// الصينية: دار الكونغ فو — سور وبوابة بأعمدة حمراء ولوحة، وقاعة بسقف رمادي، ودمى التدريب الخشبية وحامل الأسلحة
function kungfu(x, y) {
  base(x, y, 2.5, STONE);
  const hx = x - 8, hy = y - 6, w = 16, d = 8, h = 10;
  box(hx, hy, w, d, h, '#8a2a22', '#b3362b');
  for (let k = 0; k < 4; k++) wR(hx, hy, w, d, 0.08 + k * 0.23, 3, 0.15, 5, '#f0e7cf');
  ridgeRoof(hx, hy, w, d, h, 8, { ov: 4, sag: 1.4, flare: 2.4, front: '#3a3f4b', front2: '#2e333e', end: '#353a45', back: '#23262e', ridge: '#c9a046', ridgeW: 1.4 });
  const gx = x + 16, gy = y + 6;                                               // البوابة
  for (const [a, b] of [[gx - 5, gy + 2], [gx + 5, gy - 3]]) ln(a, b, a, b - 12, '#b3362b', 1.6);
  ridgeRoof(gx, gy - 0.5, 6.5, 3.2, 12, 4, { ov: 2.5, sag: 0.8, flare: 1.6, front: '#3a3f4b', end: '#353a45', back: '#23262e', ridge: '#c9a046' });
  poly([[gx - 3, gy - 8], [gx + 3, gy - 11], [gx + 3, gy - 9], [gx - 3, gy - 6]], '#1c140e');
  for (const [px, py] of [[x - 10, y + 8], [x - 3, y + 11], [x + 4, y + 9]]) {  // دمى التدريب
    cyl(px, py, 1.3, 9, '#6b4a2e', '#8a6440', '#9c7450');
    ln(px - 2.4, py - 6.5, px + 2.4, py - 5.5, '#5a3a22', 0.8); ln(px - 2, py - 4, px + 2, py - 3.4, '#5a3a22', 0.8);
  }
  const rx = x - 25, ry = y + 2;
  ln(rx - 3, ry + 1.5, rx + 3, ry - 1.5, '#6b4a2e', 1);
  for (let k = 0; k < 4; k++) ln(rx - 2 + k * 1.4, ry + 1 - k * 0.7, rx - 1.4 + k * 1.4, ry - 12 - k * 0.7, k % 2 ? '#c9c1b2' : '#8a6440', 0.6);
}

// غيونغجو وكانو: معسكر قطاع الطرق — سياج أوتاد، وخيام، وبرج مراقبة، ونار، ورايات حمراء
function banditCamp(x, y, style = 'korea') {
  shadow(x, y);
  poly([[x - 30, y + 2], [x, y + 17], [x + 30, y + 2], [x, y - 13]], style === 'korea' ? '#8a7a5a' : '#b08a5a');
  for (let k = 0; k <= 16; k++) {                                             // سياج الأوتاد الخلفي
    const t = k / 16, px = x - 30 + t * 30, py = y + 2 - t * 15;
    ln(px, py, px, py - 7, '#6b4a2e', 1.2);
    const qx = x + t * 30, qy = y - 13 + t * 15;
    ln(qx, qy, qx, qy - 7, '#7a5636', 1.2);
  }
  if (style === 'korea') {
    for (const [px, py] of [[x - 8, y - 2], [x + 8, y + 2]]) {                 // خيام
      cone(px, py, 6, 9, '#7a6a4a', '#9a8a62');
      poly([[px - 1.2, py + 2.8], [px + 1.6, py + 3], [px + 0.2, py - 3]], '#2a1d14');
    }
  } else {
    roundHut(x - 8, y - 2, 5, 6, ['#8a5a36', '#b07a4c'], ['#8a6a3a', '#a6844c']);
    roundHut(x + 8, y + 2, 5, 6, ['#8a5a36', '#b07a4c'], ['#8a6a3a', '#a6844c']);
    const rx = x + 2, ry = y + 10;                                            // حلبة الدامبي بحبالها
    for (const [a, b] of [[rx - 7, ry], [rx, ry + 3.5], [rx + 7, ry], [rx, ry - 3.5]]) ln(a, b, a, b - 4, '#6b4a2e', 0.8);
    poly([[rx - 7, ry - 3.5], [rx, ry - 0], [rx + 7, ry - 3.5], [rx, ry - 7]], 'rgba(0,0,0,0)');
    for (const v of [2, 3.4]) { ln(rx - 7, ry - v, rx, ry + 3.5 - v, '#c8322a', 0.5); ln(rx, ry + 3.5 - v, rx + 7, ry - v, '#c8322a', 0.5); }
  }
  const tx = x - 20, ty = y + 4;                                               // برج المراقبة
  for (const [a, b] of [[tx - 3, ty], [tx + 3, ty], [tx, ty + 1.5], [tx, ty - 1.5]]) ln(a, b, a, b - 18, '#5a3a22', 1);
  box(tx, ty - 18, 4, 2, 1, '#6b4a2e', '#8a6440', '#9c7450');
  cone(tx, ty - 20, 5.5, 5, '#7a6a4a', '#9a8a62');
  fire(x + 18, y + 8);
  flagPole(x + 26, y + 1, 22, '#b3262f'); flagPole(x - 27, y + 2, 20, '#b3262f', true);
}
const banditKorea = (x, y) => banditCamp(x, y, 'korea');
const banditKano = (x, y) => banditCamp(x, y, 'kano');

// الأوروبية: نُزل المرتزقة — بيت بعوارض خشبية وسقف قرميد، ولوحة معلقة، وبراميل، وحامل رماح طويلة
function mercInn(x, y) {
  base(x, y, 2, STONE);
  const hx = x - 4, hy = y - 4, w = 18, d = 9, h = 16;
  box(hx, hy, w, d, 6, '#8a8478', '#a8a296');
  box(hx, hy - 6, w, d, h - 6, '#e8e0cc', '#f4ecdc');
  const R = qR(hx, hy, w, d), L = qL(hx, hy, w, d);
  for (const q of [R, L]) {
    for (let k = 0; k <= 4; k++) { const a = q(k / 4, 6), b = q(k / 4, h); ln(a[0], a[1], b[0], b[1], '#5a3a22', 0.9); }
    { const a = q(0, 11), b = q(1, 11); ln(a[0], a[1], b[0], b[1], '#5a3a22', 0.8); }
    for (let k = 0; k < 4; k++) { const a = q(k / 4, 6), b = q((k + 1) / 4, 11); ln(a[0], a[1], b[0], b[1], '#5a3a22', 0.6); }
  }
  arch(R, 0.4, 0.2, 5.5, '#3a2618');
  ridgeRoof(hx, hy, w, d, h, 12, { gable: true, ov: 1.5, front: '#9a3e2a', back: '#6e2a1c', wallEnd: '#e8e0cc', eave: '#5a3a22', tile: 'rgba(60,20,10,0.35)' });
  const sx = x + 15, sy = y + 1;                                              // اللوحة المعلقة
  ln(sx - 4, sy - 12, sx + 2, sy - 15, '#2b2420', 0.8);
  poly([[sx - 2, sy - 12], [sx + 2, sy - 14], [sx + 2, sy - 9.5], [sx - 2, sy - 7.5]], '#c9a046');
  barrel(x + 18, y + 8); barrel(x + 22, y + 6); barrel(x + 20, y + 4);
  for (let k = 0; k < 4; k++) { const px = x - 25 + k * 1.6, py = y + 4 - k * 0.8; ln(px, py, px, py - 24, '#6b4a2e', 0.6); poly([[px - 0.8, py - 24], [px, py - 27], [px + 0.8, py - 24]], '#c9c1b2'); }
}

// باريس: حانة الأباتشي — بناية باريسية بسقف مانسارد، ومظلة مخططة حمراء، وطاولات، وفانوس شارع
function apacheBar(x, y) {
  base(x, y, 2, STONE);
  const hx = x - 4, hy = y - 4, w = 18, d = 9, h = 18;
  box(hx, hy, w, d, h, '#cfc4ae', '#e6dcc6');
  for (const u of [0.12, 0.42, 0.72]) { wR(hx, hy, w, d, u, 10, 0.16, 5, '#3a4a5a'); wL(hx, hy, w, d, u, 10, 0.16, 5, '#3a4a5a'); }
  hipRoof(hx, hy, w, d, h, 8, '#4a5662', '#5e6a76');
  for (const u of [0.25, 0.65]) { const p = qR(hx, hy - h, w * 0.7, d * 0.7)(u, 3); box(p[0], p[1] + 3, 1.6, 0.8, 3, '#d8d0c0', '#e6dcc6', '#4a5662'); }
  const R = qR(hx, hy, w, d);                                                   // المظلة المخططة
  for (let k = 0; k < 6; k++) { const a = R(k / 6, 8), b = R((k + 1) / 6, 8); poly([a, b, [b[0] + 2.4, b[1] + 4], [a[0] + 2.4, a[1] + 4]], k % 2 ? '#f2ece2' : '#b3262f'); }
  poly([R(0.05, 0), R(0.95, 0), R(0.95, 6.5), R(0.05, 6.5)], '#2a2420');
  for (const [px, py] of [[x + 14, y + 9], [x + 20, y + 6]]) { el(px, py - 3, 2, 1, '#2b2825'); ln(px, py - 3, px, py, '#2b2825', 0.6); }
  ln(x - 22, y + 4, x - 22, y - 16, '#2b2825', 0.9); el(x - 22, y - 17, 1.6, 1.4, '#f2d58a');
  poly([qR(hx, hy, w, d)(0.2, 15), qR(hx, hy, w, d)(0.6, 15), qR(hx, hy, w, d)(0.6, 17), qR(hx, hy, w, d)(0.2, 17)], '#1a2a4a');
}

// برمنغهام: مصنع الفتيان — طوب أحمر بسقف مسنن، ومدخنتان عاليتان بدخانهما، وبوابة حديد وصناديق
function factory(x, y) {
  base(x, y, 2, STONE);
  const hx = x - 2, hy = y - 2, w = 22, d = 11, h = 12;
  box(hx, hy, w, d, h, '#7a3a2a', '#9c4e36');
  const R = qR(hx, hy, w, d);
  for (let k = 0; k < 5; k++) wR(hx, hy, w, d, 0.06 + k * 0.19, 4, 0.12, 6, '#3a3e44');
  for (let k = 0; k < 4; k++) {                                               // السقف المسنن
    const a = qL(hx, hy - h, w, d)(k / 4, 0), b = qL(hx, hy - h, w, d)((k + 1) / 4, 0);
    poly([a, [a[0] + w, a[1] - d], [a[0] + w, a[1] - d - 5], [a[0], a[1] - 5]], '#6a6e74');
    poly([a, b, [b[0], b[1] - 0.2], [a[0], a[1] - 5]], '#8a8e94');
  }
  for (const [px, py] of [[x - 14, y - 10], [x - 4, y - 14]]) {
    cyl(px, py, 2.4, 32, '#6a2e20', '#9c4e36');
    for (const v of [8, 18, 28]) ring(px, py - v, 2.4, 1.2, '#5a2418', 0.5);
    for (let k = 0; k < 3; k++) el(px + 2 + k * 2.4, py - 34 - k * 3, 2.4 + k * 0.8, 1.6 + k * 0.5, 'rgba(90,90,95,0.55)');
  }
  poly([R(0.75, 0), R(0.95, 0), R(0.95, 7), R(0.75, 7)], '#2a2a2e');
  crate(x + 20, y + 9); crate(x + 23, y + 7); crate(x + 21, y + 5.5, 2);
}

// روتنبورغ: نُزل الحارس الليلي — بيت عالٍ بعوارض وسقف شديد الميل، وفانوس الحارس، ومطارد مسنودة
function nightWatch(x, y) {
  base(x, y, 2, STONE);
  const hx = x - 4, hy = y - 3, w = 13, d = 6.5, h = 22;
  box(hx, hy, w, d, 7, '#8a8478', '#a8a296');
  box(hx, hy - 7, w, d, h - 7, '#efe2c8', '#f6ecd6');
  for (const q of [qR(hx, hy, w, d), qL(hx, hy, w, d)]) {
    for (let k = 0; k <= 3; k++) { const a = q(k / 3, 7), b = q(k / 3, h); ln(a[0], a[1], b[0], b[1], '#4a2e1c', 0.9); }
    for (const v of [13, 18]) { const a = q(0, v), b = q(1, v); ln(a[0], a[1], b[0], b[1], '#4a2e1c', 0.7); }
  }
  for (const u of [0.12, 0.56]) wR(hx, hy, w, d, u, 14, 0.2, 3, '#3a4a5a');
  arch(qR(hx, hy, w, d), 0.38, 0.24, 5.5, '#3a2618');
  ridgeRoof(hx, hy, w, d, h, 16, { gable: true, ov: 1.2, front: '#a8452e', back: '#7a3020', wallEnd: '#efe2c8', eave: '#4a2e1c', tile: 'rgba(60,20,10,0.35)' });
  const lx = x + 9, ly = y + 2;
  ln(lx, ly - 13, lx + 4, ly - 15, '#2b2420', 0.7); box(lx + 4, ly - 11, 1.2, 0.6, 3, '#2b2420', '#3a3a3a', '#f2d58a');
  for (let k = 0; k < 3; k++) { const px = x + 16 + k * 2.2, py = y + 6 - k * 1.1; ln(px, py, px - 1.2, py - 22, '#6b4a2e', 0.6); poly([[px - 1.2, py - 22], [px - 3.4, py - 20], [px - 1, py - 18.6]], '#c9c1b2'); }
}

// مروي: مخيم رماة النوبة — أكواخ دائرية بأسقف قش، وأهداف رماية على حوامل، وحامل أقواس، ونخيل
function nubianCamp(x, y, i, j) {
  shadow(x, y);
  poly([[x - 30, y + 2], [x, y + 17], [x + 30, y + 2], [x, y - 13]], '#c9a46e');
  roundHut(x - 10, y - 4, 6, 7, ['#9a6a3e', '#c08a56'], ['#8a6a3a', '#a6844c']);
  roundHut(x + 6, y - 6, 5, 6, ['#9a6a3e', '#c08a56'], ['#8a6a3a', '#a6844c']);
  for (const [px, py] of [[x + 14, y + 8], [x + 22, y + 4]]) {                // أهداف الرماية
    ln(px - 1.5, py, px, py - 6, '#6b4a2e', 0.7); ln(px + 1.5, py, px, py - 6, '#6b4a2e', 0.7);
    for (const [r, c] of [[3.4, '#f2ece2'], [2.5, '#b3262f'], [1.6, '#f2ece2'], [0.8, '#b3262f']]) el(px, py - 7, r * 0.7, r, c);
  }
  const rx = x - 22, ry = y + 6;                                                // حامل الأقواس
  ln(rx - 3, ry + 1.5, rx + 3, ry - 1.5, '#6b4a2e', 1);
  for (let k = 0; k < 3; k++) { const c = getCtx(); c.beginPath(); c.ellipse(rx - 1.5 + k * 1.6, ry - 6 - k * 0.8, 1.6, 6, 0, -Math.PI / 2, Math.PI / 2); c.strokeStyle = '#5a3a22'; c.lineWidth = 0.7; c.stroke(); }
  { const c = getCtx(); c.save(); streetPalm(x + 26, y - 4, i, j); streetPalm(x - 27, y - 2, i + 1, j); c.restore(); }
}

// المكسيكية: مزرعة الفاكيروس — بيت أبيض برواق مقنطر وسقف قرميد، وحظيرة بسياج خشبي، وصبار، وحدوة فوق البوابة
function hacienda(x, y) {
  base(x, y, 2, ['#9a8a72', '#b8a88e', '#c4b49a']);
  const hx = x - 6, hy = y - 5, w = 18, d = 9, h = 11;
  box(hx, hy, w, d, h, '#e6ddcc', '#f6efe2');
  const R = qR(hx, hy, w, d);
  for (let k = 0; k < 4; k++) arch(R, 0.06 + k * 0.235, 0.18, 7.5, '#6a4a32');
  ridgeRoof(hx, hy, w, d, h, 6, { ov: 2, front: '#b85a35', back: '#8a3e22', end: '#c86a42', tile: 'rgba(90,30,10,0.35)', ridge: '#7a3018' });
  const cx = x + 14, cy = y + 6;                                               // الحظيرة
  for (const [a, b, c2, d2] of [[cx - 10, cy, cx, cy + 5], [cx, cy + 5, cx + 10, cy], [cx + 10, cy, cx, cy - 5]]) {
    for (const v of [1.6, 3.2]) ln(a, b - v, c2, d2 - v, '#7a5636', 0.7);
    ln(a, b, a, b - 4, '#6b4a2e', 0.8);
  }
  ring(x + 14, y - 1, 1.4, 1.6, '#8a8e94', 0.7);
  cactus(x - 24, y + 4); cactus(x + 26, y - 6);
}

// شيكاغو: الحانة السرية — طوب بطابقين، وعمود الحلاق المخطط عند الباب الخفي، وسيارة قديمة، وبراميل ويسكي
function speakeasy(x, y) {
  base(x, y, 2, STONE);
  const hx = x - 4, hy = y - 4, w = 17, d = 8.5, h = 20;
  box(hx, hy, w, d, h, '#6a3020', '#8c4430', '#5a5a5e');
  for (const u of [0.1, 0.4, 0.7]) { wR(hx, hy, w, d, u, 12, 0.16, 5, '#e8c56a'); wL(hx, hy, w, d, u, 12, 0.16, 5, '#3a3e44'); }
  const R = qR(hx, hy, w, d);
  poly([R(0.08, 0), R(0.4, 0), R(0.4, 7), R(0.08, 7)], '#3a4a5a');
  poly([R(0.55, 0), R(0.68, 0), R(0.68, 7), R(0.55, 7)], '#2a1a12');
  const bp = R(0.48, 0);
  for (let k = 0; k < 5; k++) rc(bp[0] - 0.6, bp[1] - 7 + k * 1.4, 1.2, 0.7, k % 2 ? '#f2ece2' : '#b3262f');
  poly([R(0.1, 9), R(0.9, 9), R(0.9, 11), R(0.1, 11)], '#2a2420');
  const cx = x + 18, cy = y + 7;                                               // السيارة القديمة
  box(cx, cy, 6, 3, 2.6, '#1c1c1e', '#2a2a2e', '#323236');
  box(cx - 1.4, cy - 2.6, 3.2, 1.6, 2.4, '#1c1c1e', '#2a2a2e', '#3a3a3e');
  for (const [px, py] of [[cx - 4, cy + 1], [cx + 2, cy + 2.6], [cx + 4.6, cy - 1]]) el(px, py, 1.2, 1.2, '#0e0e10');
  barrel(x - 22, y + 4); barrel(x - 18, y + 6);
}

// ريو: مدرسة الكابويرا — مظلة سعف على أعمدة، وجدار ملون بالأخضر والأصفر، وآلات البيريمباو، وطبل
function capoeira(x, y, i, j) {
  base(x, y, 1.5, ['#8a7a5a', '#a8977a', '#b8a88a']);
  box(x - 10, y - 8, 14, 2, 10, '#2f8a4a', '#3fa35a', '#f2c230');
  for (let k = 0; k < 6; k++) { const p = qL(x - 10, y - 8, 14, 2)(0.1 + k * 0.15, 4); circ(p[0], p[1], 1.2, k % 2 ? '#f2c230' : '#1d4fa0'); }
  const px = x + 4, py = y + 2;
  for (const [a, b] of [[px - 12, py], [px + 12, py], [px, py + 6], [px, py - 6]]) ln(a, b, a, b - 11, '#6b4a2e', 1);
  hipRoof(px, py, 14, 7, 11, 7, '#8a7a3a', '#a6964c');
  for (let k = 0; k < 8; k++) ln(px - 12 + k * 3, py - 11 + Math.abs(k - 3.5) * 0.5, px - 12.5 + k * 3, py - 9 + Math.abs(k - 3.5) * 0.5, '#6a5a2a', 0.5);
  for (let k = 0; k < 2; k++) {                                                 // البيريمباو
    const bx = x - 20 + k * 3, by = y + 6 - k * 1.5, c = getCtx();
    ln(bx, by, bx + 1, by - 13, '#8a6440', 0.7);
    c.beginPath(); c.ellipse(bx + 1.2, by - 6.5, 1.2, 6.5, 0.08, -Math.PI / 2, Math.PI / 2); c.strokeStyle = '#3a2a1e'; c.lineWidth = 0.4; c.stroke();
    el(bx + 0.2, by - 2.5, 1.4, 1.4, '#c98a3a');
  }
  cyl(x + 20, y + 9, 2.2, 4, '#7a4a2a', '#a8683a', '#e6dcc6');
  { const c = getCtx(); c.save(); streetPalm(x + 27, y - 4, i, j); c.restore(); }
}

// تينوتشتيتلان: بيوت محاربي النسر والجاغوار — مصطبة مدرجة، وبيت حجري بشرفات، ورايتا النسر والجاغوار بالريش، وصبار
function eagleJaguar(x, y) {
  shadow(x, y);
  box(x, y + 2, 32, 16, 3, '#8a8070', '#a89c88', '#b6aa96');
  box(x, y - 1, 26, 13, 3, '#8a8070', '#a89c88', '#b6aa96');
  const hx = x - 4, hy = y - 5, w = 15, d = 7.5, h = 11;
  box(hx, hy, w, d, h, '#9a8e7a', '#b6aa94', '#c4b8a2');
  const R = qR(hx, hy, w, d);
  poly([R(0.35, 0), R(0.65, 0), R(0.65, 7), R(0.35, 7)], '#2a1d14');
  for (let k = 0; k < 6; k++) { const a = R(k / 6, h - 3), b = R((k + 1) / 6, h - 3); ln(a[0], a[1], b[0], b[1], k % 2 ? '#c8322a' : '#2f6db3', 1.2); }
  for (let k = 0; k < 6; k++) { const p = R(k / 6 + 0.08, h); rc(p[0] - 0.8, p[1] - 2.4, 1.6, 2.4, '#e8e0d0'); }
  const std = (px, py, col, emblem) => {                                      // راية بالريش
    ln(px, py, px, py - 24, '#5a3a22', 1);
    for (let k = 0; k < 5; k++) poly([[px, py - 24], [px - 4 + k * 2, py - 31], [px - 3 + k * 2, py - 30]], ['#2f8a4a', '#2f6db3', '#c8322a', '#f2c230', '#2f8a4a'][k]);
    poly([[px - 3.5, py - 22], [px + 3.5, py - 22], [px + 3.5, py - 15], [px - 3.5, py - 15]], col);
    el(px, py - 18.5, 2, 2, emblem);
  };
  std(x + 16, y + 4, '#3a2a1a', '#e8c25a');                                    // النسر
  std(x + 23, y + 0.5, '#d8a13a', '#2a1d14');                                  // الجاغوار
  for (const [px, py] of [[x - 24, y + 2], [x - 20, y + 6]]) { el(px, py - 3, 2, 3, '#4f7a44'); el(px + 2, py - 6, 1.6, 2.4, '#5e8a50'); el(px - 1.6, py - 6.5, 1.4, 2, '#5e8a50'); }
  for (const [px, py] of [[x + 6, y + 11], [x - 8, y + 9]]) { cyl(px, py, 1.4, 3, '#6a5a4a', '#8a7a6a'); fire(px, py - 3); }
}

export const DRAFTS = [
  // [المعرّف، الاسم، المدينة، النوع، دالة الرسم]
  ['temple_shibam', 'معبد أوام (محرم بلقيس)', 'شبام', 'معبد', awwam],
  ['temple_edo', 'معبد سينسو-جي', 'إيدو', 'معبد', sensoji],
  ['temple_china', 'معبد السماء', 'الصينية', 'معبد', heaven],
  ['temple_hk', 'معبد مان مو', 'هونغ كونغ', 'معبد', manmo],
  ['temple_jaipur', 'هوا محل (قصر الرياح)', 'جايبور', 'معبد', hawaMahal],
  ['temple_kaifeng', 'الباغودا الحديدية', 'كايفنغ', 'معبد', ironPagoda],
  ['temple_norway', 'كنيسة الألواح الخشبية', 'النرويجية', 'معبد', staveChurch],
  ['temple_gondar', 'كنيسة دبرا برهان سلاسي', 'غوندر', 'معبد', debreBerhan],
  ['temple_meroe', 'معبد آمون', 'مروي', 'معبد', amun],
  ['temple_mexico', 'الكاتدرائية الكبرى', 'المكسيكية', 'معبد', catedral],
  ['temple_laboca', 'كنيسة سان خوان', 'لا بوكا', 'معبد', sanJuan],
  ['temple_tenoch', 'تمبلو مايور', 'تينوتشتيتلان', 'معبد', templo],
  ['mercs_yamamah', 'مضارب البدو', 'اليمامة', 'مرتزقة', bedouin],
  ['mercs_arab', 'دار السيوف', 'العربية', 'مرتزقة', swordHouse],
  ['mercs_diriyah', 'مجلس الفرسان', 'الدرعية', 'مرتزقة', knights],
  ['mercs_cairo', 'بيوت الفتوات', 'القاهرة', 'مرتزقة', futuwwa],
  ['mercs_china', 'دار الكونغ فو', 'الصينية', 'مرتزقة', kungfu],
  ['mercs_gyeongju', 'معسكر قطاع الطرق', 'غيونغجو', 'مرتزقة', banditKorea],
  ['mercs_europe', 'نُزل المرتزقة', 'الأوروبية', 'مرتزقة', mercInn],
  ['mercs_paris', 'حانة الأباتشي', 'باريس', 'مرتزقة', apacheBar],
  ['mercs_birmingham', 'مصنع الفتيان', 'برمنغهام', 'مرتزقة', factory],
  ['mercs_rothenburg', 'نُزل الحارس الليلي', 'روتنبورغ', 'مرتزقة', nightWatch],
  ['mercs_kano', 'معسكر قطاع الطرق', 'كانو', 'مرتزقة', banditKano],
  ['mercs_meroe', 'مخيم رماة النوبة', 'مروي', 'مرتزقة', nubianCamp],
  ['mercs_mexico', 'مزرعة الفاكيروس', 'المكسيكية', 'مرتزقة', hacienda],
  ['mercs_chicago', 'الحانة السرية', 'شيكاغو', 'مرتزقة', speakeasy],
  ['mercs_rio', 'مدرسة الكابويرا', 'ريو', 'مرتزقة', capoeira],
  ['mercs_tenoch', 'بيوت محاربي النسر والجاغوار', 'تينوتشتيتلان', 'مرتزقة', eagleJaguar],
];
