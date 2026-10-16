// المباني المحلية ومعالم المدن الآسيوية (بطلب المستخدم، كفكرة باريس): إيدو والصينية وهونغ كونغ وجايبور
// وكايفنغ وغيونغجو. تُركَّب بـ installLocal (localParts.js) في cityThemes.js، وأوزانها مقتطعة من المبنى الرئيسي.
// هونغ كونغ لها دوار فلا معلم إضافي فيها.
import { getCtx, paint, TAU, poly, circ, ln, rc, el, box, qL, qR, wL, wR, arch, ridgeRoof, dome, glow, damage, hsh, mixc,
  cyl } from './cityThemes.js';
import { awning, cups, hangRow, plaza, plinth, plazaLamps } from './localParts.js';

const lerp = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
// عارضة بين نقطتين بسُمك t نحو الأسفل
const beam = (A, B, t, col) => poly([A, B, [B[0], B[1] + t], [A[0], A[1] + t]], col);
// مظلة دائرية بأضلاع (مظلات المقاهي والبسطات): مركزها على الشاشة وألوان أقسامها
function parasol(px, py, r, cols, n = 8, pole = '#5a4030', h = 9) {
  ln(px, py, px, py - h, pole, 0.5);
  const cy = py - h + 2, apex = cy - r * 0.62;
  el(px, cy + 0.5, r, r * 0.45, mixc(cols[0], '#000000', 0.4));   // باطن المظلة تحت حافتها
  for (let k = 0; k < n; k++) {
    const a0 = k / n * TAU, a1 = (k + 1) / n * TAU, lit = Math.cos((a0 + a1) / 2 + 2.2) * 0.12;
    poly([[px, apex], [px + Math.cos(a0) * r, cy + Math.sin(a0) * r * 0.45], [px + Math.cos(a1) * r, cy + Math.sin(a1) * r * 0.45]],
      mixc(cols[k % cols.length], lit > 0 ? '#ffffff' : '#000000', Math.abs(lit)));
  }
  circ(px, apex, 0.5, pole);
}
// بخار خفيف يتصاعد
function steam(px, py, n = 2) {
  const c = getCtx();
  c.save(); c.globalAlpha = 0.45; c.beginPath();
  for (let k = 0; k < n; k++) {
    const o = (k - (n - 1) / 2) * 1.4;
    c.moveTo(px + o, py); c.quadraticCurveTo(px + o - 1.2, py - 2.4, px + o + 0.3, py - 4.6);
  }
  c.strokeStyle = paint('#f2f0ea'); c.lineWidth = 0.6; c.stroke();
  c.restore();
}

/* ---------- إيدو: حانة بفوانيس ورقية حمراء وستارة نورين، وبيت شاي ببسطة حمراء ومظلة كبيرة ---------- */
const ROOF_J = { front: '#3d4450', front2: '#4a525e', end: '#4f5866', end2: '#5a6370', back: '#2a2e36', ov: 3, sag: 1.2, flare: 1.8,
  tile: 'rgba(0,0,0,0.22)', ridge: '#2a2e36', ridgeW: 1.4 };
function chochin(px, py, col = '#d8382c') {
  ln(px, py - 1.7, px, py - 2.6, '#3a2e26', 0.4);
  el(px, py, 1.3, 1.7, col);
  rc(px - 0.9, py - 1.9, 1.8, 0.45, '#2a2420'); rc(px - 0.9, py + 1.5, 1.8, 0.45, '#2a2420');
  ln(px - 0.2, py - 0.9, px + 0.2, py + 0.9, 'rgba(30,20,10,0.55)', 0.45);
}
function izakaya(x, y, i, j, T) {
  const w = 12, d = 6, h = 9, qb = qR(x, y, w, d), qa = qL(x, y, w, d);
  box(x, y, w, d, h, '#c9b89a', '#ddd0b4');
  [0, 0.5, 1].forEach(u => { const a = qa(u, 0), b = qa(u, h); ln(a[0], a[1], b[0], b[1], '#4a3a2e', 0.8); });
  wR(x, y, w, d, 0.05, 0, 0.9, 6.4, '#5a4030');
  for (let k = 1; k < 14; k++) { const A = qb(0.05 + k * 0.064, 0.2), B = qb(0.05 + k * 0.064, 6.2); ln(A[0], A[1], B[0], B[1], '#8a6a4a', 0.35); }
  wR(x, y, w, d, 0.38, 3, 0.36, 3.4, '#2f3f6e');
  for (const u of [0.5, 0.62]) { const A = qb(u, 3), B = qb(u, 6.4); ln(A[0], A[1], B[0], B[1], '#c9c2b2', 0.35); }
  const M = qb(0.56, 5); circ(M[0], M[1], 0.7, '#e8e2d4');
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 7, ROOF_J);
  for (const u of [0.1, 0.9]) { const P = qb(u, h); chochin(P[0] + 1.6, P[1] + 3.4); }
  const P = qb(0.55, 0);
  box(P[0] + 2.6, P[1] + 3.2, 3.6, 1.8, 1.4, '#6a4a32', '#80593c', '#94683f');
}
function chaya(x, y, i, j, T) {
  const w = 11, d = 5.5, h = 8, qb = qR(x, y, w, d);
  box(x, y, w, d, h, '#c9b89a', '#ddd0b4');
  wR(x, y, w, d, 0.05, 0, 0.9, 5.4, '#3a2e26');
  wR(x, y, w, d, 0.05, 2.8, 0.9, 2.6, '#c9a86a');
  for (let k = 1; k < 10; k++) { const A = qb(0.05 + k * 0.09, 2.8), B = qb(0.05 + k * 0.09, 5.4); ln(A[0], A[1], B[0], B[1], '#9a7a44', 0.3); }
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 6, ROOF_J);
  const P = qb(0.45, 0), bx = P[0] + 2.8, by = P[1] + 3.6;
  box(bx, by, 4, 2, 1.6, '#9a2a24', '#c8322a', '#d8463a');
  cups(bx - 1.2, by - 1.9, 2, '#e8e2d4');
  parasol(bx + 4.4, by + 0.6, 5.5, ['#d8382c', '#c02e26'], 10, '#5a4030', 10);
}
// حجر فانوس ياباني (تورو)
function toro(px, py) {
  box(px, py + 1, 1.8, 0.9, 1.2, '#9c978e', '#b2ada3', '#c2bdb3');
  rc(px - 0.5, py - 4.2, 1, 4.4, '#a8a398');
  box(px, py - 4.2, 1.9, 0.95, 2.4, '#8f8a82', '#a8a398');
  poly([[px - 2.8, py - 6.6], [px, py - 8.4], [px + 2.8, py - 6.6], [px, py - 5.6]], '#7f7a72');
  rc(px - 0.7, py - 6.2, 1.4, 1.2, '#f2d58a');
}
// المعلم: بوابة توري حمراء كبيرة بعارضتين، وفانوسان حجريان خلفها
function torii(x, y) {
  plaza(x, y, '#c6bdab', '#8f8778');
  toro(x - 9, y - 3); toro(x + 9, y - 3);
  const V = '#d8452a', VD = '#b0381f', K = '#2a2420', H = 21;
  const P1 = [x - 7.5, y + 3.75], P2 = [x + 7.5, y - 3.75];
  for (const P of [P1, P2]) { box(P[0], P[1], 1.3, 0.65, H, VD, V); box(P[0], P[1], 1.6, 0.8, 1.6, K, '#3a3430'); }
  const ext = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
  // العارضة السفلى (نوكي) تمر عبر العمودين، والعليا الحمراء ثم السوداء المرفوعة الطرفين (كاساغي)
  beam(ext(P1, P2, -0.12).map((v, k) => v - (k ? H - 5 : 0)), ext(P1, P2, 1.12).map((v, k) => v - (k ? H - 5 : 0)), 1.6, V);
  beam([P1[0] - 1.6, P1[1] + 0.8 - H], [P2[0] + 1.6, P2[1] - 0.8 - H], 1.7, VD);
  const A = ext(P1, P2, -0.22), B = ext(P1, P2, 1.22);
  beam([A[0], A[1] - H - 1.6], [B[0], B[1] - H - 1.6], 1.6, K);
  poly([[A[0], A[1] - H - 1.6], [A[0] - 1.6, A[1] - H - 3.2], [A[0] + 0.6, A[1] - H - 1.6]], K);
  poly([[B[0], B[1] - H - 1.6], [B[0] + 1.6, B[1] - H - 3.4], [B[0] - 0.6, B[1] - H - 1.6]], K);
  const M = ext(P1, P2, 0.5);
  rc(M[0] - 0.9, M[1] - H + 0.4, 1.8, 3.4, K);
}

/* ---------- المدينة الصينية: مطعم زلابية بسلال بخار وفوانيس، ودكان حرير بأثواب ملونة معلقة ---------- */
const ROOF_C = { front: '#4a5260', front2: '#5a6372', end: '#5a6372', end2: '#6a7382', back: '#2e333c', tile: 'rgba(0,0,0,0.25)',
  ridge: '#2e333c', ridgeW: 1.6, ov: 3.4, sag: 1.4, flare: 2 };
function redLantern(px, py, s = 1) {
  ln(px, py - 2.2 * s, px, py - 3 * s, '#4a3a32', 0.4);
  el(px, py, 1.6 * s, 2 * s, '#d33a2c');
  rc(px - 0.8 * s, py - 2.2 * s, 1.6 * s, 0.5 * s, '#d9a63a'); rc(px - 0.8 * s, py + 1.7 * s, 1.6 * s, 0.5 * s, '#d9a63a');
  ln(px, py + 2.2 * s, px, py + 3.4 * s, '#d9a63a', 0.4);
}
function signBoard(x, y, w, d, u, v, du, dv) {
  wR(x, y, w, d, u, v, du, dv, '#2a2420');
  const q = qR(x, y, w, d);
  for (let k = 0; k < 3; k++) { const A = q(u + du * (0.2 + k * 0.28), v + dv * 0.25), B = q(u + du * (0.2 + k * 0.28), v + dv * 0.75); ln(A[0], A[1], B[0], B[1], '#d9b04a', 0.5); }
}
function dumpling(x, y, i, j, T) {
  const w = 12, d = 6, h = 10, qb = qR(x, y, w, d);
  box(x, y, w, d, h, '#8a6a4a', '#a07a56');
  wR(x, y, w, d, 0.08, 0, 0.84, 6.4, '#2e2620');
  wR(x, y, w, d, 0.1, 0.4, 0.8, 1.8, '#f0b860');
  signBoard(x, y, w, d, 0.18, 7, 0.64, 2.2);
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 7, ROOF_C);
  for (const u of [0.08, 0.92]) { const P = qb(u, h); redLantern(P[0] + 1.6, P[1] + 3.6, 0.8); }
  const P = qb(0.3, 0), sx = P[0] + 2.4, sy = P[1] + 3.4;
  box(sx, sy, 2.6, 1.3, 1.8, '#5a4030', '#6e4c36', '#7a5640');
  for (let s = 0; s < 3; s++) { el(sx, sy - 2.2 - s * 1.2, 1.9, 0.8, '#c9a86a'); el(sx, sy - 2.6 - s * 1.2, 1.9, 0.8, '#dcc088'); }
  steam(sx, sy - 6.2, 2);
  const Q = qb(0.75, 0), tx = Q[0] + 2.6, ty = Q[1] + 3.6;
  el(tx, ty - 1.6, 2, 0.9, '#8a3a2a'); ln(tx, ty - 1.6, tx, ty, '#3a2a22', 0.5);
  for (const [dx, dy] of [[-2.4, 0.6], [2.2, 1]]) box(tx + dx, ty + dy, 0.7, 0.35, 1, '#6a4a32', '#80593c', '#94683f');
}
const SILK = ['#c8322a', '#2f6e8e', '#d9a63a', '#3a8a5a', '#a83a7a', '#e8dcc0'];
function silk(x, y, i, j, T) {
  const w = 12, d = 6, h = 12, qb = qR(x, y, w, d);
  box(x, y, w, d, h, '#8e2a26', '#a8332d');
  [0.08, 0.5, 0.92].forEach(u => { const c = qb(u, 0), e = qb(u, h); ln(c[0], c[1], e[0], e[1], '#c23a32', 1.2); });
  wR(x, y, w, d, 0.12, 0, 0.76, 7, '#2e2620');
  for (let k = 0; k < 7; k++) { const u = 0.15 + k * 0.1; wR(x, y, w, d, u, 1.6, 0.07, 5, SILK[(k + i) % 6]); }
  signBoard(x, y, w, d, 0.2, 8.4, 0.6, 2.2);
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 7, ROOF_C);
  const P = qb(0.5, h); redLantern(P[0] + 1.6, P[1] + 3.6, 0.85);
  const Q = qb(0.4, 0), bx = Q[0] + 2.6, by = Q[1] + 3.2;
  box(bx, by, 3.4, 1.7, 1.2, '#5a4030', '#6e4c36', '#7a5640');
  for (let k = 0; k < 3; k++) box(bx - 1.6 + k * 1.6, by - 1.2 - k * 0.8, 1.2, 0.6, 1.6, SILK[k + 2], mixc(SILK[k + 2], '#ffffff', 0.15), mixc(SILK[k + 2], '#ffffff', 0.3));
}
// المعلم: عمود التنين: عمود أحمر يلتف حوله تنين ذهبي، وفي أعلاه لوح السحاب، وفانوسان أحمران على عمودين
function dragonPillar(x, y) {
  plaza(x, y, '#b8af9e', '#8a847a');
  for (const [dx, dy] of [[-9, -3.2], [9, -3.2]]) { ln(x + dx, y + dy, x + dx, y + dy - 9, '#5a3a2a', 0.8); redLantern(x + dx, y + dy - 7.4, 0.8); }
  const top = plinth(x, y + 1, 6.5, 4.4, '#a49e94', '#bdb6ab', '#cbc4b8');
  const H = 27, c = getCtx();
  const pts = [];
  for (let k = 0; k <= 48; k++) { const t = k / 48, a = t * TAU * 2.2; pts.push([x + Math.cos(a) * 3, top - 2 - t * (H - 6) + Math.sin(a) * 1.3, Math.sin(a)]); }
  const coil = (front) => {
    c.beginPath();
    for (let k = 1; k < pts.length; k++) {
      if ((pts[k][2] > 0) !== front) continue;
      c.moveTo(pts[k - 1][0], pts[k - 1][1]); c.lineTo(pts[k][0], pts[k][1]);
    }
    c.strokeStyle = paint(front ? '#e8bb4f' : '#a8842e'); c.lineWidth = 1.7; c.lineCap = 'round'; c.stroke();
  };
  coil(false);
  cyl(x, top, 1.8, H, '#8e2a26', '#c23a32', '#a8332d');
  coil(true);
  for (let k = 3; k < pts.length; k += 4) if (pts[k][2] > 0) circ(pts[k][0], pts[k][1] - 0.4, 0.35, '#c9962e');
  const hd = pts[pts.length - 1];
  poly([[hd[0] - 1.4, hd[1] + 0.6], [hd[0] + 2.6, hd[1] - 0.8], [hd[0] + 1.6, hd[1] + 1.4], [hd[0] - 0.6, hd[1] + 1.8]], '#e8bb4f');
  circ(hd[0] + 0.9, hd[1] - 0.1, 0.35, '#c23a32');
  // لوح السحاب في أعلى العمود
  poly([[x - 5, top - H + 1], [x - 1.5, top - H - 0.4], [x + 5, top - H - 1.6], [x + 1.6, top - H + 1.2]], '#e8e4da');
  el(x, top - H, 2.2, 1, '#d9d4ca');
  box(x, top - H, 1.4, 0.7, 2, '#a49e94', '#bdb6ab', '#cbc4b8');
  dome(x, top - H - 2.4, 1.5, '#d9a63a', '#a8842e');
}

/* ---------- هونغ كونغ: مطعم شعبي بلافتة نيون وبط مشوي وطاولات وكراسٍ، وصيدلية أعشاب بجدار أدراج ---------- */
const HKC = ['#8a9a8e', '#a39484', '#9aa3ad', '#b09a8a', '#8e8a9e', '#a0a890'];
function hkBase(x, y, i, j, w, d, h, k0) {
  const c = HKC[Math.floor(hsh(i, j, k0) * HKC.length)];
  box(x, y, w, d, h, mixc(c, '#000000', 0.25), c, mixc(c, '#000000', 0.1));
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
    const v = hsh(i, j, k0 + 1 + r * 4 + k);
    wL(x, y, w, d, 0.08 + k * 0.23, 7.5 + r * 3, 0.13, 2, v < 0.3 ? '#f2d58a' : '#24252a');
  }
}
function noodle(x, y, i, j, T) {
  const w = 13, d = 6.5, h = 13, qb = qR(x, y, w, d);
  hkBase(x, y, i, j, w, d, h, 940);
  wR(x, y, w, d, 0.06, 0, 0.88, 6.4, '#3a2a22');
  wR(x, y, w, d, 0.08, 0.3, 0.84, 2, '#f0b050');
  for (let k = 0; k < 4; k++) {
    const P = qb(0.16 + k * 0.17, 5.6);
    ln(P[0], P[1], P[0], P[1] + 0.8, '#3a2a22', 0.3);
    poly([[P[0] - 0.7, P[1] + 0.8], [P[0] + 0.7, P[1] + 0.8], [P[0] + 0.4, P[1] + 3], [P[0] - 0.4, P[1] + 3]], '#a8542a');
  }
  const A = qb(0.1, 8.2), B = qb(0.9, 8.2);
  glow((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 1.4, 12, 'rgba(255,79,163,0.3)');
  poly([A, B, [B[0], B[1] - 3], [A[0], A[1] - 3]], '#ff4fa3');
  poly([[A[0] + 1, A[1] - 0.7], [B[0] - 1, B[1] + 0.3], [B[0] - 1, B[1] - 2.3], [A[0] + 1, A[1] - 2.3]], '#fff2f8');
  damage(x, y, w, d, h, i, j, T);
  for (const [u, col] of [[0.3, '#c8322a'], [0.75, '#2f6aa8']]) {
    const P = qb(u, 0), tx = P[0] + 2.6, ty = P[1] + 3.6;
    el(tx, ty - 1.5, 1.9, 0.85, '#e8e2d4'); ln(tx, ty - 1.5, tx, ty, '#5a5a5e', 0.4);
    for (const [dx, dy] of [[-2.2, 0.5], [2, 0.9]]) { box(tx + dx, ty + dy, 0.7, 0.35, 0.9, col, mixc(col, '#ffffff', 0.15), mixc(col, '#ffffff', 0.3)); }
  }
  steam(qb(0.15, 0)[0] + 1.6, qb(0.15, 0)[1] - 2.6, 2);
}
function herbal(x, y, i, j, T) {
  const w = 13, d = 6.5, h = 13, qb = qR(x, y, w, d);
  hkBase(x, y, i, j, w, d, h, 950);
  wR(x, y, w, d, 0.06, 0, 0.88, 6.6, '#5a3a24');
  for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) {
    const u = 0.1 + k * 0.115, v = 0.6 + r * 1.5;
    wR(x, y, w, d, u, v, 0.1, 1.2, '#8a5a34');
    const P = qb(u + 0.05, v + 0.6); circ(P[0], P[1], 0.18, '#d9b04a');
  }
  const A = qb(0.1, 8.2), B = qb(0.9, 8.2);
  glow((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 1.4, 12, 'rgba(124,255,107,0.28)');
  poly([A, B, [B[0], B[1] - 3], [A[0], A[1] - 3]], '#3aa84a');
  poly([[A[0] + 1, A[1] - 0.7], [B[0] - 1, B[1] + 0.3], [B[0] - 1, B[1] - 2.3], [A[0] + 1, A[1] - 2.3]], '#eaffea');
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.35, 0), bx = P[0] + 2.6, by = P[1] + 3.4;
  box(bx, by, 3.6, 1.8, 1.6, '#5a3a24', '#6e4a2e', '#7e5636');
  for (let k = 0; k < 3; k++) { const jx = bx - 1.8 + k * 1.8, jy = by - 1.6 - k * 0.9; el(jx, jy - 1.1, 0.75, 1.1, 'rgba(220,235,240,0.75)'); circ(jx, jy - 1, 0.45, ['#a8542a', '#d9a63a', '#7a3a2a'][k]); }
}

/* ---------- جايبور: كشك شاي بإبريق نحاس كبير وأكواب طين، ودكان ساري بأقمشة ملونة ---------- */
const JP = ['#d98466', '#e3957a', '#cf7a5c', '#e8a07e'];
const SARI = ['#e8892a', '#c23a7a', '#2aa8a0', '#d9b44a', '#7a3ac2', '#c8322a'];
function pinkBox(x, y, i, j, w, d, h, k0) {
  const c = JP[Math.floor(hsh(i, j, k0) * JP.length)], L = mixc(c, '#000000', 0.18), sh = mixc(c, '#000000', 0.3);
  box(x, y, w, d, h, L, c, mixc(c, '#ffffff', 0.08));
  const qb = qR(x, y, w, d);
  for (let k = 0; k < 6; k++) { const p = qb(k / 5, h); box(p[0], p[1] + 0.2, 0.9, 0.45, 1.4, sh, c); }
  const A = qb(0, h - 1.6), B = qb(1, h - 1.6);
  ln(A[0], A[1], B[0], B[1], 'rgba(255,255,255,0.55)', 0.5);
  return sh;
}
function chai(x, y, i, j, T) {
  const w = 11, d = 5.5, h = 10, qb = qR(x, y, w, d);
  pinkBox(x, y, i, j, w, d, h, 960);
  arch(qb, 0.1, 0.8, 7.2, '#4a2a20');
  for (let k = 0; k < 14; k++) { const p = qb(0.1 + k * 0.057, 7.2 + Math.sin(k / 13 * Math.PI) * 1); circ(p[0], p[1], 0.25, '#f6efe6'); }
  const A = qb(0.02, h - 0.4), B = qb(0.98, h - 0.4);
  hangRow([A[0] + 0.6, A[1] + 0.9], [B[0] + 0.6, B[1] + 0.9], 9, ['#f2a020', '#e8c23a'], 'flag');
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.35, 0), sx = P[0] + 2.2, sy = P[1] + 3.2;
  box(sx, sy, 2.2, 1.1, 2, '#6a4a32', '#80593c', '#94683f');
  el(sx, sy - 2.2, 1.5, 0.7, '#3a3028'); circ(sx, sy - 2.3, 0.5, '#e8742a');
  el(sx, sy - 3.6, 1.6, 1.2, '#c98a3a'); el(sx - 0.4, sy - 4, 0.6, 0.3, '#e8b46a');
  ln(sx + 1.4, sy - 3.6, sx + 2.6, sy - 4.4, '#c98a3a', 0.5);
  steam(sx, sy - 5.2, 2);
  const Q = qb(0.75, 0), cx = Q[0] + 2.4, cy = Q[1] + 3.4;
  box(cx, cy, 3.6, 1.8, 1.4, '#7a5a3a', '#8e6a46', '#c9a86a');
  for (let k = 0; k < 3; k++) poly([[cx - 1.6 + k * 1.4, cy - 1.4 - k * 0.7], [cx - 0.8 + k * 1.4, cy - 1.4 - k * 0.7], [cx - 0.95 + k * 1.4, cy - 2.4 - k * 0.7], [cx - 1.45 + k * 1.4, cy - 2.4 - k * 0.7]], '#b8643a');
}
function textile(x, y, i, j, T) {
  const w = 12, d = 6, h = 15, qb = qR(x, y, w, d), qa = qL(x, y, w, d);
  const sh = pinkBox(x, y, i, j, w, d, h, 970);
  arch(qb, 0.1, 0.62, 9.4, '#4a2a20');
  for (let k = 0; k < 6; k++) { const u = 0.14 + k * 0.09; wR(x, y, w, d, u, 1.2, 0.07, 6.4, SARI[(k + i + j) % 6]); }
  arch(qa, 0.3, 0.16, 5, '#4a2a20'); arch(qa, 0.62, 0.16, 5, '#4a2a20');
  awning(qb, 1, 0.06, 0.74, 10.4, ['#e8892a', '#f6efe6'], 6, 2, 1.4);
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.4, 0), bx = P[0] + 2.6, by = P[1] + 3.2;
  box(bx, by, 3.6, 1.8, 0.8, sh, '#a07a56', '#b08a62');
  for (let k = 0; k < 4; k++) box(bx, by - 0.8 - k * 0.7, 3, 1.5, 0.7, SARI[(k + 2) % 6], mixc(SARI[(k + 2) % 6], '#ffffff', 0.15), mixc(SARI[(k + 2) % 6], '#ffffff', 0.3));
}
// المعلم: فيل مزيّن بعباءة ملونة وهودج ورسوم على جبهته، على قاعدة وردية
function elephant(x, y) {
  plaza(x, y, '#dfc09a', '#b3866a');
  plazaLamps(x, y, true, '#f2c86a');
  const top = plinth(x, y + 1, 7.5, 4, '#c47458', '#d9886a', '#e89c7e');
  const G = '#8e8a86', GL = '#a8a49e', GD = '#76726e', bx = x + 0.6, by = top - 6.4;
  for (const [dx, dy, c] of [[3.6, -0.6, GD], [-1.6, -1.4, GD]]) rc(bx + dx - 1, by + dy + 1, 2, 6.6, c);
  el(bx, by, 7.2, 4.6, G);
  el(bx - 0.6, by - 1.4, 5.4, 2.6, GL);
  for (const [dx, dy] of [[2.2, 1.6], [-3.4, 0.8]]) rc(bx + dx - 1.1, by + dy + 1.6, 2.2, 6.2 - dy, G);
  poly([[bx - 4.6, by - 4.2], [bx + 4.4, by - 4.6], [bx + 5.4, by + 1.4], [bx - 5, by + 2]], '#c8322a');
  ln(bx - 5, by + 2, bx + 5.4, by + 1.4, '#d9b44a', 0.8);
  for (let k = 0; k < 6; k++) circ(bx - 3.8 + k * 1.7, by + 1.9 - k * 0.12, 0.4, '#d9b44a');
  box(bx, by - 4.2, 3, 1.5, 2.4, '#c9962e', '#e8bb4f', '#d9a63a');
  dome(bx, by - 6.6, 2.6, '#e8bb4f', '#c9962e', '#c8322a');
  const hx = bx - 6.4, hy = by - 1.6;
  el(hx + 1.4, hy + 0.2, 2.6, 3.4, GD);
  circ(hx, hy, 3, G);
  poly([[hx - 1.6, hy - 2], [hx + 1.2, hy - 2.4], [hx + 1, hy + 0.6], [hx - 1.4, hy + 0.8]], '#d9b44a');
  circ(hx - 0.3, hy - 1, 0.5, '#c8322a'); circ(hx + 0.5, hy - 0.3, 0.35, '#2aa8a0');
  const c = getCtx();
  c.beginPath(); c.moveTo(hx - 1.4, hy + 1.2); c.quadraticCurveTo(hx - 4.6, hy + 3, hx - 3.6, hy + 7.4);
  c.strokeStyle = paint(G); c.lineWidth = 1.6; c.lineCap = 'round'; c.stroke();
  c.beginPath(); c.moveTo(hx - 0.6, hy + 2); c.quadraticCurveTo(hx - 2.4, hy + 3.6, hx - 3.2, hy + 2.6);
  c.strokeStyle = paint('#f2ede0'); c.lineWidth = 0.6; c.stroke();
  circ(hx - 1.2, hy - 0.6, 0.3, '#2a2420');
  plazaLamps(x, y, false, '#f2c86a');
}

/* ---------- كايفنغ (عهد سونغ): مطعم ببوابة احتفالية ملونة وراية خمر، وبسطة تحت مظلة كبيرة كلوحة النهر ---------- */
function restaurant(x, y, i, j, T) {
  const w = 12, d = 6, qb = qR(x, y, w, d);
  box(x, y, w, d, 9, '#8a6a4a', '#a07a56');
  wR(x, y, w, d, 0.1, 0, 0.8, 6, '#2e2620');
  ridgeRoof(x, y, w, d, 9, 2.4, Object.assign({}, ROOF_C, { ov: 3, sag: 0, flare: 1.6, k: 0.85 }));
  box(x, y - 11, w - 1.5, d - 0.75, 8, '#a07a56', '#b88c62');
  wR(x, y - 11, w - 1.5, d - 0.75, 0.1, 1.6, 0.8, 4.4, '#e8dcc0');
  for (let k = 1; k < 6; k++) wR(x, y - 11, w - 1.5, d - 0.75, 0.1 + k * 0.134, 1.6, 0.01, 4.4, '#5a3a22');
  damage(x, y, w, d, 9, i, j, T);
  ridgeRoof(x, y - 11, w - 1.5, d - 0.75, 8, 6, ROOF_C);
  // البوابة الاحتفالية أمام الواجهة: عمودان وعوارض متقاطعة بأشرطة ملونة
  const A = qb(0.06, 0), B = qb(0.94, 0), o = [2.2, 3];
  const PA = [A[0] + o[0], A[1] + o[1]], PB = [B[0] + o[0], B[1] + o[1]];
  for (const P of [PA, PB]) ln(P[0], P[1], P[0], P[1] - 13, '#6a3a22', 0.9);
  for (let k = 0; k < 3; k++) { const v = 13 - k * 2.2; ln(PA[0], PA[1] - v, PB[0], PB[1] - v, k % 2 ? '#d33a2c' : '#2f6e8e', 0.9); }
  for (let k = 0; k < 4; k++) { const t = (k + 0.5) / 4, P = lerp(PA, PB, t); ln(P[0] - 1, P[1] - 13, P[0] + 1, P[1] - 8.6, '#d9a63a', 0.5); }
  const M = lerp(PA, PB, 0.5); redLantern(M[0], M[1] - 6.4, 0.8);
  // راية الخمر على عمود
  const F = qb(0.98, 0);
  ln(F[0] + 0.6, F[1], F[0] + 0.6, F[1] - 20, '#5a4632', 0.8);
  poly([[F[0] + 0.9, F[1] - 19.6], [F[0] + 5.4, F[1] - 21.2], [F[0] + 5.4, F[1] - 14.4], [F[0] + 0.9, F[1] - 12.8]], '#e8dcc0');
  poly([[F[0] + 0.9, F[1] - 19.6], [F[0] + 5.4, F[1] - 21.2], [F[0] + 5.4, F[1] - 20.2], [F[0] + 0.9, F[1] - 18.6]], '#2f5a8e');
  rc(F[0] + 2.6, F[1] - 17.4, 1.2, 1.4, '#3a2a22');
}
function umbrella(x, y, i, j, T) {
  const w = 11, d = 5.5, h = 9, qb = qR(x, y, w, d);
  box(x, y, w, d, h, '#8a6a4a', '#a07a56');
  wR(x, y, w, d, 0.1, 0, 0.8, 6, '#2e2620');
  for (let k = 0; k < 4; k++) { const P = qb(0.15 + k * 0.2, 2.6); rc(P[0] - 0.8, P[1] - 1, 1.6, 1.2, ['#c98a3a', '#a8322a', '#e8d8b0', '#4a7a5a'][k]); }
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 6, ROOF_C);
  const P = qb(0.55, 0), sx = P[0] + 2.8, sy = P[1] + 3.8;
  box(sx, sy, 3.2, 1.6, 1.8, '#6a4a32', '#80593c', '#94683f');
  for (let k = 0; k < 3; k++) circ(sx - 1.4 + k * 1.4, sy - 2.2 + (k - 1) * 0.2, 0.55, ['#e8b83a', '#c8462e', '#6f8a3a'][k]);
  parasol(sx, sy - 0.4, 7, ['#e8dcc0', '#d6c8a8'], 12, '#5a4030', 9.5);
}
// المعلم: البرج الحديدي: باغودا رفيعة ثمانية بطبقات خزف بني داكن وسقوف مرفوعة الأطراف
function ironPagoda(x, y) {
  plaza(x, y, '#b8af9e', '#8a847a');
  for (const [dx, dy] of [[-9, -3.2], [9, -3.2]]) { ln(x + dx, y + dy, x + dx, y + dy - 9, '#5a3a2a', 0.8); redLantern(x + dx, y + dy - 7.4, 0.8); }
  let yy = plinth(x, y + 1, 7, 3.4, '#8a847a', '#a39c8e', '#b3ac9e');
  const L = '#5a3a26', R = '#7a5236', RF = { front: '#4a2e1c', end: '#5a3a26', back: '#3a2414', ov: 1.6, flare: 1.4, k: 0.9 };
  for (let t = 0; t < 7; t++) {
    const w = 5 - t * 0.45, h = t ? 3.6 : 5;
    box(x, yy, w, w / 2, h, L, R);
    wR(x, yy, w, w / 2, 0.38, 0.6, 0.24, h - 1.6, '#2a1a10');
    ridgeRoof(x, yy, w, w / 2, h, 1.2, RF);
    yy -= h + 1.2;
  }
  ln(x, yy + 1.2, x, yy - 4, '#3a2414', 0.8);
  circ(x, yy - 1, 0.9, '#c9962e');
}

/* ---------- غيونغجو: بيت شاي هانوك بمنصة خشبية وطاولة منخفضة، ودكان بجرار أونغي وفلفل مجفف ---------- */
const ROOF_K = { front: '#4c535c', front2: '#5b636c', end: '#5b636c', end2: '#6b737c', back: '#30353c', tile: 'rgba(0,0,0,0.22)',
  ridge: '#e8e4da', ridgeW: 1.4, ov: 3.6, sag: 2, flare: 1.2, k: 0.6 };
function smallHanok(x, y, i, j, T, w, d, h) {
  box(x, y + 1, w + 1, d + 0.5, 1.6, '#a49e94', '#bdb6ab', '#cbc4b8');
  box(x, y, w, d, h, '#e6e1d6', '#f2eee5');
  const qa = qL(x, y, w, d), qb = qR(x, y, w, d);
  [0, 0.5, 1].forEach(u => { let a = qa(u, 0), b = qa(u, h); ln(a[0], a[1], b[0], b[1], '#7a5638', 1); a = qb(u, 0); b = qb(u, h); ln(a[0], a[1], b[0], b[1], '#7a5638', 1); });
  return qb;
}
function koTea(x, y, i, j, T) {
  const w = 11, d = 5.5, h = 8, qb = smallHanok(x, y, i, j, T, w, d, h);
  wR(x, y, w, d, 0.1, 0.5, 0.34, 5, '#d8cfbc'); wR(x, y, w, d, 0.56, 0.5, 0.34, 5, '#d8cfbc');
  for (const u of [0.21, 0.67]) wR(x, y, w, d, u, 0.5, 0.01, 5, '#8a6a4c');
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 7, ROOF_K);
  const P = qb(0.5, 0), mx = P[0] + 2.8, my = P[1] + 3.4;
  box(mx, my, 5, 2.5, 1.4, '#8a6440', '#a07a52', '#b88c5e');
  for (const [dx, dy] of [[-2.6, 0.1], [2.4, -0.3]]) { el(mx + dx, my - 1.6 + dy, 1, 0.45, '#5f8a6a'); }
  box(mx, my - 1.4, 1.8, 0.9, 0.8, '#5a3a24', '#6e4a2e', '#7e5636');
  el(mx - 0.3, my - 2.6, 0.7, 0.5, '#f2ede0'); circ(mx + 0.6, my - 2.4, 0.3, '#f2ede0'); circ(mx + 1.2, my - 2.7, 0.3, '#f2ede0');
  steam(mx - 0.3, my - 3, 1);
  const S = qb(0.2, h - 1);
  ln(S[0] + 1, S[1] + 0.6, S[0] + 1, S[1] + 1.4, '#3a2a22', 0.3);
  rc(S[0] + 0.3, S[1] + 1.4, 1.4, 3, '#6a4a2e');
}
function onggi(x, y, i, j, T) {
  const w = 11, d = 5.5, h = 8, qb = smallHanok(x, y, i, j, T, w, d, h);
  wR(x, y, w, d, 0.12, 0.5, 0.36, 5.4, '#3a2e26');
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 7, ROOF_K);
  const A = qb(0.55, h - 1.4), B = qb(0.95, h - 1.4);
  hangRow([A[0] + 1.6, A[1] + 1.8], [B[0] + 1.6, B[1] + 1.8], 6, ['#c8322a', '#e8742a'], 'cloth');
  const P = qb(0.45, 0), sx = P[0] + 2.4, sy = P[1] + 3.4;
  box(sx, sy, 5.4, 2.7, 1, '#9a948a', '#b0aaa0', '#c0bab0');
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
    const jx = sx - 2.6 + k * 2.6 + r * 1.2, jy = sy - 1 - r * 1.2 + k * -0.2 + r * 1.6;
    el(jx, jy - 1.6, 1.15, 1.6, '#6a3a1e');
    el(jx - 0.3, jy - 2.2, 0.5, 0.6, '#8a5232');
    el(jx, jy - 3.2, 0.95, 0.4, '#4a2a16');
  }
}
// المعلم: جناح الجرس البرونزي الكبير (جرس الملك سونغدوك): أربعة أعمدة حمراء وسقف قرميد، والجرس معلق في وسطه
function bellPavilion(x, y) {
  plaza(x, y, '#c2b9a4', '#8e877a');
  box(x, y + 1, 10, 5, 1.6, '#a49e94', '#bdb6ab', '#cbc4b8');
  const top = y - 0.6, H = 15, cols = [[-8, 0], [0, -4], [8, 0], [0, 4]];
  for (const [dx, dy] of cols.slice(0, 2)) box(x + dx * 0.85, top + dy * 0.85, 0.8, 0.4, H, '#8e2a26', '#a8332d');
  const by = top - H + 3;
  ln(x, by - 1.4, x, by + 0.6, '#3a3028', 0.6);
  el(x, by + 0.8, 2.6, 1, '#2f5a4a');
  poly([[x - 2.6, by + 0.8], [x + 2.6, by + 0.8], [x + 3.4, by + 8.4], [x - 3.4, by + 8.4]], '#3f6a56');
  poly([[x + 0.6, by + 0.8], [x + 2.6, by + 0.8], [x + 3.4, by + 8.4], [x + 1.2, by + 8.4]], '#2f5a4a');
  el(x, by + 8.4, 3.4, 1.2, '#2a4a3c');
  ln(x - 3.2, by + 7, x + 3.2, by + 7, '#c9a04a', 0.5);
  circ(x - 1, by + 4.6, 0.7, '#c9a04a');
  for (const [dx, dy] of cols.slice(2)) box(x + dx * 0.85, top + dy * 0.85, 0.8, 0.4, H, '#8e2a26', '#a8332d');
  ridgeRoof(x, top, 9, 4.5, H, 8, Object.assign({}, ROOF_K, { ov: 4, sag: 2.2 }));
}

export const LOCAL_ASIA = {
  japan: { split: 'house', add: [['izakaya', 20], ['chaya', 20]], draw: { izakaya, chaya, monument: torii },
           light: (x, y) => ({ x, y: y - 12, r: 34, c: '255,190,120', a: 0.4 }) },
  china: { split: 'hall', add: [['dumpling', 22], ['silk', 22]], draw: { dumpling, silk, monument: dragonPillar },
           light: (x, y) => ({ x, y: y - 22, r: 38, c: '255,170,90', a: 0.45 }) },
  hk: { split: 'tower', add: [['noodle', 14], ['herbal', 14]], draw: { noodle, herbal } },
  jaipur: { split: 'haveli', add: [['chai', 20], ['textile', 20]], draw: { chai, textile, monument: elephant },
            light: (x, y) => ({ x, y: y - 14, r: 36, c: '255,200,120', a: 0.42 }) },
  kaifeng: { split: 'shop', add: [['restaurant', 18], ['umbrella', 18]], draw: { restaurant, umbrella, monument: ironPagoda },
             light: (x, y) => ({ x, y: y - 24, r: 36, c: '255,180,100', a: 0.4 }) },
  gyeongju: { split: 'hanok', add: [['teahouse', 18], ['onggi', 18]], draw: { teahouse: koTea, onggi, monument: bellPavilion },
              light: (x, y) => ({ x, y: y - 12, r: 34, c: '255,210,150', a: 0.4 }) }
};
