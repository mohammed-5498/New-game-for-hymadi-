// المباني المحلية ومعالم المدن الأوروبية (بطلب المستخدم، كفكرة باريس): الأوروبية والنرويجية وبرمنغهام
// (باريس وروتنبورغ لهما مبانيهما المحلية ودوارهما في citiesEurope.js). تُركَّب بـ installLocal في cityThemes.js،
// وأوزانها مقتطعة من المبنى الرئيسي.
import { getCtx, paint, TAU, poly, circ, ln, rc, el, box, qL, qR, wL, wR, arch, ridgeRoof, glow, damage, hsh, mixc } from './cityThemes.js';
import { awning, hangRow, plaza, plinth, plazaLamps } from './localParts.js';

const lerp = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];

/* ---------- المدينة الأوروبية (أمستردام وبروج): دكان زهور بدلاء توليب، ودكان أجبان بعجلات صفراء؛ والمعلم طاحونة هواء ---------- */
const EU2 = ['#e0bd62', '#d27a60', '#7ea7c8', '#e6a8ad', '#9dbd87', '#efe2c6', '#c3a9d2', '#e39a54'];
const TULIPS = ['#e83a3a', '#f2d23a', '#e86ab0', '#f28a2a', '#f4f1ea', '#a83ac8'];
// بيت ضيق بطابقين وواجهة مثلثة: أساس دكاني المدينة الأوروبية
function gableShop(x, y, i, j, T, k0) {
  const c = EU2[Math.floor(hsh(i, j, k0) * EU2.length)], w = 14, d = 7, h = 19, qb = qR(x, y, w, d);
  box(x, y, w, d, h, mixc(c, '#000000', 0.2), c);
  for (let k = 0; k < 2; k++) {
    wR(x, y, w, d, 0.16 + k * 0.42, 11, 0.2, 5, '#f4efe4'); wR(x, y, w, d, 0.18 + k * 0.42, 11.5, 0.16, 4, '#34505f');
    wL(x, y, w, d, 0.24 + k * 0.4, 11, 0.16, 4.6, '#2e4552');
  }
  const A = qb(0, 9.6), B = qb(1, 9.6);
  ln(A[0], A[1], B[0], B[1], 'rgba(255,255,255,0.4)', 0.6);
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 11, { front: '#8a3e2e', back: '#5a2a22', gable: true, wallEnd: c, eave: '#f4efe4', tile: 'rgba(0,0,0,0.2)' });
  return qb;
}
function flowers(x, y, i, j, T) {
  const w = 14, d = 7, qb = gableShop(x, y, i, j, T, 980);
  wR(x, y, w, d, 0.08, 0.6, 0.84, 6.4, '#2c3a44');
  for (let k = 0; k < 8; k++) { const P = qb(0.12 + k * 0.1, 1.6); circ(P[0], P[1] - 0.4, 0.6, TULIPS[(k + i) % 6]); }
  awning(qb, 1, 0.05, 0.95, 8.4, ['#2f6e4e', '#efe6d2'], 8, 2.6, 1.8);
  const P = qb(0.2, 0);
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
    const bx = P[0] + 2.4 + k * 2.2 + r * 1.6, by = P[1] + 3.6 - k * 1.1 + r * 1.6;
    rc(bx - 0.8, by - 1.6, 1.6, 1.6, '#5a6a72');
    for (let f = 0; f < 3; f++) circ(bx - 0.6 + f * 0.6, by - 2.4 - (f % 2) * 0.5, 0.55, TULIPS[(k + r * 2 + f) % 6]);
    ln(bx, by - 1.6, bx, by - 2.2, '#4f7a3a', 0.4);
  }
}
function cheese(x, y, i, j, T) {
  const w = 14, d = 7, qb = gableShop(x, y, i, j, T, 981);
  wR(x, y, w, d, 0.08, 0.6, 0.84, 6.4, '#5a3a24');
  for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) { const P = qb(0.14 + k * 0.15, 1.4 + r * 2.4); el(P[0], P[1] - 0.4, 1, 0.7, r ? '#f2c23a' : '#e8a83a'); }
  wR(x, y, w, d, 0.2, 7.6, 0.6, 1.6, '#f2d23a');
  const S = qb(0.5, 8.4); el(S[0], S[1], 1.6, 0.6, '#c8322a');
  damage(x, y, w, d, 19, i, j, T);
  const P = qb(0.35, 0), bx = P[0] + 2.8, by = P[1] + 3.4;
  box(bx, by, 4, 2, 1.4, '#7a5a3a', '#8e6a46', '#a07a52');
  for (let k = 0; k < 3; k++) for (let s = 0; s < 2 - (k % 2); s++) {
    const cx = bx - 2 + k * 2, cy = by - 1.4 - k * 1 - s * 1.2;
    el(cx, cy + 0.5, 1.4, 0.65, '#c8902a'); el(cx, cy, 1.4, 0.65, '#f2c23a');
  }
}
// المعلم: طاحونة هواء هولندية: برج خشبي مثمن يضيق للأعلى بشرفة، وقبعة، وأربعة أشرعة شبكية
function windmill(x, y) {
  plaza(x, y, '#a19b8e', '#7a766f');
  plazaLamps(x, y, true);
  box(x, y + 1, 6, 3, 4, '#8a5a44', '#a06a50', '#7a4a36');
  const b = y + 1 - 4, H = 22, w0 = 4.6, w1 = 2.8;
  poly([[x - w0, b], [x, b + w0 / 2], [x, b + w1 / 2 - H], [x - w1, b - H]], '#4a5a4e');
  poly([[x, b + w0 / 2], [x + w0, b], [x + w1, b - H], [x, b + w1 / 2 - H]], '#5e7062');
  for (let k = 1; k < 5; k++) { const t = k / 5, yy = b - H * t, ww = w0 + (w1 - w0) * t; ln(x - ww, yy, x, yy + ww / 2, 'rgba(0,0,0,0.15)', 0.4); }
  wR(x, b, w0, w0 / 2, 0.35, 2, 0.3, 4.6, '#2a2420');
  const gy = b - 8;
  poly([[x - 6.6, gy], [x, gy + 3.3], [x + 6.6, gy], [x, gy - 3.3]], '#6a4a32');
  ln(x - 6.6, gy, x, gy + 3.3, '#3a2a22', 0.5); ln(x, gy + 3.3, x + 6.6, gy, '#3a2a22', 0.5);
  const cy = b - H;
  poly([[x - w1 - 0.6, cy], [x, cy + w1 / 2 + 0.3], [x - 0.4, cy - 4.4], [x - w1, cy - 2.6]], '#3a3a3e');
  poly([[x, cy + w1 / 2 + 0.3], [x + w1 + 0.6, cy], [x + w1, cy - 2.6], [x - 0.4, cy - 4.4]], '#4a4a50');
  // الأشرعة في مستوى يواجه الأمام اليسار: U على امتداد الواجهة اليسرى وV عمودي
  const hub = [x - 2.6, cy - 0.4], U = [0.89, 0.45], V = [0, -1], L = 15;
  for (let k = 0; k < 4; k++) {
    const a = 0.45 + k * TAU / 4, dir = [Math.cos(a) * U[0] + Math.sin(a) * V[0], Math.cos(a) * U[1] + Math.sin(a) * V[1]];
    const nrm = [Math.cos(a + TAU / 4) * U[0], Math.cos(a + TAU / 4) * U[1] - Math.sin(a + TAU / 4)];
    const P = (t, s) => [hub[0] + dir[0] * t + nrm[0] * s, hub[1] + dir[1] * t + nrm[1] * s];
    poly([P(3, 0), P(L, 0), P(L, 2.6), P(3, 2.6)], 'rgba(236,230,214,0.85)');
    for (let m = 1; m < 5; m++) { const A = P(3 + m * (L - 3) / 5, 0), B = P(3 + m * (L - 3) / 5, 2.6); ln(A[0], A[1], B[0], B[1], '#6a4a32', 0.35); }
    ln(...P(0, 0), ...P(L, 0), '#5a3a26', 0.7);
  }
  circ(hub[0], hub[1], 1, '#3a2a22');
}

/* ---------- القرية النرويجية: سوق سمك ببسطة ثلج ومظلة، ومقهى خشبي بنوافذ دافئة ومقاعد بفرو؛ والمعلم سفينة فايكنغ ---------- */
const NO2 = ['#9c2f2a', '#b8382f', '#d9a43a', '#ece8de', '#2f4a5e'];
function woodHouse(x, y, i, j, T, k0, h) {
  const c = NO2[Math.floor(hsh(i, j, k0) * NO2.length)], L = mixc(c, '#000000', 0.24), w = 12, d = 6;
  box(x, y, w, d, h, L, c);
  const qa = qL(x, y, w, d), qb = qR(x, y, w, d);
  for (let k = 1; k < 9; k++) { let a = qb(k / 9, 0), b = qb(k / 9, h); ln(a[0], a[1], b[0], b[1], 'rgba(0,0,0,0.13)', 0.4); a = qa(k / 9, 0); b = qa(k / 9, h); ln(a[0], a[1], b[0], b[1], 'rgba(0,0,0,0.16)', 0.4); }
  return { c, qb };
}
function fishmarket(x, y, i, j, T) {
  const w = 12, d = 6, h = 11, { c, qb } = woodHouse(x, y, i, j, T, 990, h);
  wR(x, y, w, d, 0.1, 0, 0.36, 7, '#2a2a2e');
  wR(x, y, w, d, 0.6, 3, 0.2, 3.4, '#f4efe4'); wR(x, y, w, d, 0.62, 3.4, 0.16, 2.6, '#34505f');
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 8, { front: '#3a3a3e', back: '#2a2a2e', gable: true, wallEnd: c, eave: '#f4efe4', tile: 'rgba(0,0,0,0.22)' });
  const P = qb(0.45, 0), bx = P[0] + 3, by = P[1] + 3.6;
  box(bx, by, 4.4, 2.2, 2, '#5a6a72', '#6a7a82', '#e8f2f6');
  for (let k = 0; k < 4; k++) { const fx = bx - 2.6 + k * 1.7, fy = by - 2.2 - k * 0.85; el(fx, fy, 1.1, 0.4, '#a8b8c0'); poly([[fx + 1, fy], [fx + 1.7, fy - 0.5], [fx + 1.7, fy + 0.5]], '#8898a0'); }
  circ(bx + 1.6, by - 2.8, 0.6, '#c8322a'); circ(bx + 2.4, by - 2.3, 0.5, '#d8463a');
  for (const s of [-1, 1]) ln(bx + s * 4, by - 0.2 - s * 0.4, bx + s * 4, by - 7, '#3a3a3e', 0.5);
  for (let k = 0; k < 4; k++) poly([[bx - 4.6 + k * 2.3, by - 7.4 + k * 0.1], [bx - 2.3 + k * 2.3, by - 7.4 + k * 0.1], [bx - 2.3 + k * 2.3, by - 6], [bx - 4.6 + k * 2.3, by - 6]], k % 2 ? '#f4efe4' : '#c8322a');
}
function kafe(x, y, i, j, T) {
  const w = 12, d = 6, h = 10, { c, qb } = woodHouse(x, y, i, j, T, 991, h);
  for (let k = 0; k < 2; k++) { wR(x, y, w, d, 0.12 + k * 0.44, 2.4, 0.28, 4, '#f4efe4'); wR(x, y, w, d, 0.14 + k * 0.44, 2.8, 0.24, 3.2, '#f2c86a'); }
  wL(x, y, w, d, 0.4, 0, 0.2, 6, '#3a2a22');
  const S = qb(0.98, 7.6); ln(S[0], S[1], S[0] + 3, S[1] - 1.4, '#2a2a2e', 0.5); el(S[0] + 2.6, S[1] + 0.4, 1.3, 1.3, '#c9a04a'); circ(S[0] + 2.6, S[1] + 0.4, 0.6, '#8a5a2a');
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 8, { front: '#3a3a3e', back: '#2a2a2e', gable: true, wallEnd: c, eave: '#f4efe4', tile: 'rgba(0,0,0,0.22)' });
  const P = qb(0.5, 0), bx = P[0] + 2.8, by = P[1] + 3.4;
  box(bx, by, 3.4, 1.7, 1.6, '#6a4a32', '#80593c', '#94683f');
  el(bx - 1.2, by - 1.9, 1.1, 0.5, '#f2ede0'); el(bx + 1, by - 2.4, 1.1, 0.5, '#e8e2d4');
  for (const [dx, dy] of [[-3.4, 1.4], [3.2, -0.2]]) { box(bx + dx, by + dy, 1.4, 0.7, 1, '#6a4a32', '#80593c', '#94683f'); el(bx + dx, by + dy - 1.1, 1.2, 0.55, '#ece6da'); }
}
// المعلم: سفينة فايكنغ برأس تنين وتروس ملونة على جانبها وشراع مخطط، على قاعدة حجرية
function longship(x, y) {
  plaza(x, y, '#c2c8cc', '#7a7e82');
  plazaLamps(x, y, true);
  box(x, y + 1, 9, 4.5, 2.4, '#7a7e82', '#8b9095', '#9ea3a8');
  const b = y + 1 - 2.4, A = [x - 11, b + 2.6], B = [x + 11, b - 2.6], s = (t, v) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - v];
  const hull = []; for (let k = 0; k <= 16; k++) { const t = k / 16; hull.push(s(t, 4.4 - Math.sin(t * Math.PI) * 3.6 + 1.6)); }
  for (let k = 16; k >= 0; k--) { const t = k / 16; hull.push(s(t, 0.6 + Math.sin(t * Math.PI) * 0.4)); }
  poly(hull, '#6a4428');
  for (let r = 1; r < 3; r++) { const c = getCtx(); c.beginPath(); for (let k = 0; k <= 16; k++) { const t = k / 16, P = s(t, 4.4 - Math.sin(t * Math.PI) * 3.6 + 1.6 - r * 1.3); k ? c.lineTo(P[0], P[1]) : c.moveTo(P[0], P[1]); } c.strokeStyle = paint('#4a2e18'); c.lineWidth = 0.4; c.stroke(); }
  const SH = ['#c8322a', '#e8c23a', '#2f5a8e', '#f2ede0'];
  for (let k = 0; k < 6; k++) { const P = s(0.2 + k * 0.12, 3.6); circ(P[0], P[1], 1.15, SH[k % 4]); circ(P[0], P[1], 0.35, '#5a4a3a'); }
  const st = s(0, 6), sb = s(1, 6);
  const c = getCtx();
  c.beginPath(); c.moveTo(...s(0.02, 4.6)); c.quadraticCurveTo(st[0] - 2, st[1] - 3, st[0] + 0.6, st[1] - 6.4);
  c.strokeStyle = paint('#6a4428'); c.lineWidth = 1.4; c.lineCap = 'round'; c.stroke();
  poly([[st[0] + 0.6, st[1] - 6.4], [st[0] + 2.6, st[1] - 6], [st[0] + 1, st[1] - 5]], '#6a4428');
  c.beginPath(); c.moveTo(...s(0.98, 4.6)); c.quadraticCurveTo(sb[0] + 2, sb[1] - 2.4, sb[0] - 0.4, sb[1] - 4.6);
  c.stroke();
  const m = s(0.5, 3.4);
  ln(m[0], m[1], m[0], m[1] - 18, '#4a2e18', 0.9);
  const sl = [m[0] - 5.4, m[1] - 15.4], sr = [m[0] + 5.4, m[1] - 18.1];
  for (let k = 0; k < 5; k++) {
    const t0 = k / 5, t1 = (k + 1) / 5;
    poly([lerp(sl, sr, t0), lerp(sl, sr, t1), [lerp(sl, sr, t1)[0], lerp(sl, sr, t1)[1] + 9], [lerp(sl, sr, t0)[0], lerp(sl, sr, t0)[1] + 9]], k % 2 ? '#f2ede0' : '#b8382f');
  }
  ln(sl[0], sl[1], sr[0], sr[1], '#4a2e18', 0.7);
}

/* ---------- برمنغهام: محل سمك وبطاطا بلافتة زرقاء، وصالة شاي بأعلام صغيرة وطاولات؛ والمعلم ثور البرونز وكابينة هاتف حمراء ---------- */
function brickShop(x, y, i, j, T, h) {
  const w = 13, d = 6.5;
  box(x, y, w, d, h, '#7a3428', '#934236');
  for (let k = 0; k < 2; k++) { wR(x, y, w, d, 0.15 + k * 0.42, 10, 0.2, 3.8, '#e8e0cc'); wR(x, y, w, d, 0.16 + k * 0.42, 10.4, 0.18, 3, '#34444e'); }
  for (let k = 0; k < 2; k++) wL(x, y, w, d, 0.2 + k * 0.4, 9, 0.16, 3.6, '#2c3a44');
  return qR(x, y, w, d);
}
function chippy(x, y, i, j, T) {
  const w = 13, d = 6.5, h = 15, qb = brickShop(x, y, i, j, T, h);
  wR(x, y, w, d, 0.08, 0, 0.84, 7, '#2a3a5a');
  wR(x, y, w, d, 0.12, 1.4, 0.5, 4.4, '#f2d58a');
  wR(x, y, w, d, 0.68, 0, 0.18, 6, '#1e2a3a');
  wR(x, y, w, d, 0.06, 7.4, 0.88, 2, '#f2ede0');
  for (let k = 0; k < 6; k++) { const A = qb(0.14 + k * 0.12, 7.9), B = qb(0.2 + k * 0.12, 8.9); ln(A[0], A[1], B[0], B[1], '#2a3a7a', 0.6); }
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 6, { front: '#4a4f56', back: '#2e3238', k: 0.9, tile: 'rgba(0,0,0,0.22)' });
  const P = qb(0.35, 0), bx = P[0] + 2.4, by = P[1] + 3.2;
  box(bx, by, 1.6, 0.8, 4.2, '#2a2a2e', '#3a3a3e', '#4a4a4e');
  rc(bx - 0.4, by - 4.4, 2.2, 1.6, '#f2ede0');
  for (let k = 0; k < 3; k++) { const fx = bx + 2.6 + k * 1.5, fy = by + 1.2 - k * 0.75; poly([[fx - 0.9, fy], [fx + 0.9, fy - 0.6], [fx + 0.6, fy - 1.6], [fx - 0.9, fy - 1]], '#e8e2d4'); circ(fx, fy - 1.2, 0.35, '#e8b83a'); }
}
function tearoom(x, y, i, j, T) {
  const w = 13, d = 6.5, h = 14, qb = brickShop(x, y, i, j, T, h);
  wR(x, y, w, d, 0.08, 0, 0.84, 7, '#2f4a3a');
  for (let k = 0; k < 2; k++) { wR(x, y, w, d, 0.12 + k * 0.44, 1.4, 0.32, 4.4, '#f4efe4'); wR(x, y, w, d, 0.14 + k * 0.44, 1.8, 0.28, 3.6, '#f2c86a'); }
  wR(x, y, w, d, 0.1, 7.6, 0.8, 1.6, '#c9a04a');
  const A = qb(0.02, 9.4), B = qb(0.98, 9.4);
  hangRow([A[0] + 1, A[1] + 1.4], [B[0] + 1, B[1] + 1.4], 9, ['#c8322a', '#f2ede0', '#2a3e8a'], 'flag');
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 6, { front: '#4a4f56', back: '#2e3238', k: 0.9, tile: 'rgba(0,0,0,0.22)' });
  for (const u of [0.3, 0.78]) {
    const P = qb(u, 0), tx = P[0] + 2.6, ty = P[1] + 3.6;
    el(tx, ty - 1.6, 1.8, 0.85, '#f4efe4'); ln(tx, ty - 1.6, tx, ty, '#2a2a2e', 0.5);
    el(tx - 0.4, ty - 2.2, 0.6, 0.45, '#f4efe4'); circ(tx - 0.4, ty - 2.5, 0.2, '#2a3e8a'); el(tx + 0.7, ty - 1.9, 0.35, 0.2, '#f4efe4');
    for (const dx of [-2.2, 2]) box(tx + dx, ty + 0.4 + dx * 0.15, 0.6, 0.3, 1.6, '#2a2a2e', '#3a3a3e', '#4a4a4e');
  }
}
// المعلم: ثور البرونز (ثور البُل رينغ) على قاعدة، وكابينة هاتف حمراء على ركن الساحة الخلفي
function bull(x, y) {
  plaza(x, y, '#8a867c', '#5e5b56');
  const kx = x + 8, ky = y - 3.6;
  box(kx, ky, 1.8, 0.9, 8, '#a82020', '#c8322a', '#b02828');
  for (let r = 0; r < 3; r++) wR(kx, ky, 1.8, 0.9, 0.15, 1.6 + r * 2, 0.7, 1.6, '#e8eef2');
  poly([[kx - 1.8, ky - 8], [kx, ky - 9.4], [kx + 1.8, ky - 8], [kx, ky - 7.1]], '#a82020');
  plazaLamps(x, y, true, '#f2d58a', 0.9);
  const top = plinth(x - 1, y + 1.4, 6, 3.6, '#5a5654', '#6e6a66', '#7e7a76');
  const B = '#6a4a2a', BL = '#8a6436', BD = '#4a3218', bx = x - 0.4, by = top - 5.2;
  for (const [dx, dy, c] of [[3.6, -0.6, BD], [-2.4, -1, BD]]) rc(bx + dx - 0.7, by + dy + 1, 1.4, 5.2, c);
  el(bx, by, 6.2, 3.2, B);
  el(bx + 1.2, by - 1.2, 4, 1.6, BL);
  for (const [dx, dy] of [[2.2, 1.2], [-3.4, 0.8]]) rc(bx + dx - 0.8, by + dy + 1.2, 1.6, 4.8 - dy, B);
  const c = getCtx();
  c.beginPath(); c.moveTo(bx + 5.8, by - 0.4); c.quadraticCurveTo(bx + 8, by + 0.6, bx + 7.2, by + 3.6);
  c.strokeStyle = paint(BD); c.lineWidth = 0.6; c.stroke();
  const hx = bx - 6.2, hy = by + 0.6;
  el(hx + 1.6, hy - 1, 2.4, 2.2, B);
  poly([[hx - 1.2, hy - 1.8], [hx + 1.4, hy - 2.6], [hx + 1, hy + 1.6], [hx - 1.6, hy + 1.2]], BL);
  el(hx - 1.4, hy + 1, 1.2, 0.8, BD);
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(hx + 0.2, hy - 2.2); c.quadraticCurveTo(hx + s * 2.4 + 0.2, hy - 3, hx + s * 2.6 + 0.6, hy - 5); c.strokeStyle = paint('#e8dcc0'); c.lineWidth = 0.7; c.lineCap = 'round'; c.stroke(); }
  circ(hx - 0.4, hy - 0.8, 0.3, '#1e1e20');
  plazaLamps(x, y, false, '#f2d58a', 0.9);
}

export const LOCAL_EUROPE = {
  europe: { split: 'row', add: [['flowers', 16], ['cheese', 16]], draw: { flowers, cheese, monument: windmill },
            light: (x, y) => ({ x, y: y - 12, r: 34, c: '255,215,150', a: 0.4 }) },
  norway: { split: 'wood', add: [['fishmarket', 18], ['kafe', 18]], draw: { fishmarket, kafe, monument: longship },
            light: (x, y) => ({ x, y: y - 10, r: 34, c: '255,215,150', a: 0.4 }) },
  birmingham: { split: 'terrace', add: [['chippy', 14], ['tearoom', 14]], draw: { chippy, tearoom, monument: bull },
                light: (x, y) => ({ x, y: y - 10, r: 34, c: '255,215,150', a: 0.45 }) }
};
