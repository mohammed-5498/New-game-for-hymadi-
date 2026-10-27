// المباني المحلية ومعالم مدن الأمريكتين (بطلب المستخدم، كفكرة باريس): المكسيكية وشيكاغو وريو ولا بوكا
// وتينوتشتيتلان. تُركَّب بـ installLocal (localParts.js) في cityThemes.js، وأوزانها مقتطعة من المبنى الرئيسي.
import { getCtx, paint, TAU, poly, circ, ln, rc, el, box, qL, qR, wL, wR, arch, ridgeRoof, glow, damage, hsh, mixc } from './cityThemes.js';
import { awning, baskets, hangRow, plaza, plinth, plazaLamps } from './localParts.js';

const lerp = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
const smoke = (px, py) => {
  const c = getCtx();
  c.save(); c.globalAlpha = 0.32;
  for (let k = 0; k < 3; k++) el(px + k * 1.2, py - k * 2.4, 1.3 + k * 0.6, 0.9 + k * 0.4, '#8a8682');
  c.restore();
};
const stool = (px, py, col) => box(px, py, 0.7, 0.35, 1, col, mixc(col, '#ffffff', 0.15), mixc(col, '#ffffff', 0.3));

/* ---------- المدينة المكسيكية: تاكيريا بأعلام ورقية ملونة وموقد، ودكان فواكه وبينياتا؛ والمعلم ملاك الاستقلال ---------- */
const MX = ['#e3708c', '#3fb5a8', '#f0b84a', '#e07b39', '#6a8fd8', '#9fcf6a'];
function mxBase(x, y, i, j, h, k0) {
  const c = MX[Math.floor(hsh(i, j, k0) * MX.length)], w = 12, d = 6;
  box(x, y, w, d, h, mixc(c, '#000000', 0.2), c, mixc(c, '#ffffff', 0.15));
  poly([[x - w, y - h], [x, y - d - h], [x + w, y - h], [x + w, y - h - 1.6], [x, y - d - h - 1.6], [x - w, y - h - 1.6]], mixc(c, '#000000', 0.1));
  return { c, qb: qR(x, y, w, d), qa: qL(x, y, w, d) };
}
function taqueria(x, y, i, j, T) {
  const w = 12, d = 6, h = 11, { qb } = mxBase(x, y, i, j, h, 1400);
  wR(x, y, w, d, 0.08, 0, 0.6, 6.4, '#3a2a20');
  wR(x, y, w, d, 0.1, 0.4, 0.56, 2, '#f0b050');
  wR(x, y, w, d, 0.1, 7, 0.8, 2.4, '#f4efe4');
  for (let k = 0; k < 5; k++) { const A = qb(0.16 + k * 0.14, 7.6), B = qb(0.24 + k * 0.14, 8.8); ln(A[0], A[1], B[0], B[1], k % 2 ? '#c8322a' : '#2e8b57', 0.6); }
  const A = qb(0.02, h + 1.4), B = qb(0.98, h + 1.4);
  hangRow([A[0] + 1.2, A[1] + 1.6], [B[0] + 1.2, B[1] + 1.6], 9, MX, 'flag');
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.3, 0), gx = P[0] + 2.6, gy = P[1] + 3.4;
  box(gx, gy, 2.8, 1.4, 2.4, '#5a5a5e', '#6e6e72', '#3a3a3e');
  el(gx, gy - 2.6, 2, 0.8, '#2a2a2e'); circ(gx - 0.6, gy - 2.7, 0.4, '#e8c86a'); circ(gx + 0.6, gy - 2.5, 0.4, '#c8642a');
  smoke(gx, gy - 3.6);
  for (const [dx, dy] of [[3.4, 0.4], [5.6, -0.8], [4.6, 1.8]]) stool(gx + dx, gy + dy, '#c8322a');
}
function frutas(x, y, i, j, T) {
  const w = 12, d = 6, h = 14, { qb } = mxBase(x, y, i, j, h, 1401);
  arch(qb, 0.1, 0.56, 8.4, '#3a2a20');
  for (let k = 0; k < 3; k++) {
    const P = qb(0.2 + k * 0.18, 9.2);
    ln(P[0], P[1], P[0], P[1] + 1, '#3a2a22', 0.3);
    const cx = P[0], cy = P[1] + 2.4, col = MX[(k + i) % 6];
    for (let s = 0; s < 5; s++) { const a = s / 5 * TAU - 1.57; poly([[cx, cy], [cx + Math.cos(a) * 2, cy + Math.sin(a) * 2], [cx + Math.cos(a + 0.6) * 0.8, cy + Math.sin(a + 0.6) * 0.8]], s % 2 ? col : MX[(k + 3) % 6]); }
    circ(cx, cy, 0.8, '#f4efe4');
  }
  awning(qb, 1, 0.04, 0.72, 10.2, ['#2e8b57', '#f4efe4', '#c8322a'], 6, 2.2, 1.6);
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.4, 0);
  baskets(P[0] + 2.2, P[1] + 3.4, ['#f28a2a', '#7aba3a', '#e8c23a', '#c8322a'], 4, '#a07a52');
  const W = [P[0] + 7.4, P[1] + 1.4]; el(W[0], W[1], 1.4, 0.9, '#3a7a3a'); el(W[0] - 0.4, W[1] - 0.3, 0.8, 0.4, '#6aa84a');
}
// المعلم: ملاك الاستقلال: عمود طويل على قاعدة مدرجة وفي قمته ملاك ذهبي بجناحين وإكليل
function angel(x, y) {
  plaza(x, y, '#dcc39a', '#b39672');
  plazaLamps(x, y, true, '#f2c86a');
  const top = plinth(x, y + 1, 7, 6, '#c9c2b4', '#ddd6c8', '#e8e2d6');
  box(x, top, 2.6, 1.3, 3, '#b8b0a2', '#ccc4b6', '#d8d0c2');
  const H = 26, c = getCtx(), cb = top - 3;
  c.beginPath(); c.moveTo(x - 1.6, cb); c.lineTo(x - 1.2, cb - H); c.lineTo(x + 1.2, cb - H); c.lineTo(x + 1.6, cb); c.closePath();
  c.fillStyle = paint('#d8d0c2'); c.fill();
  for (let k = 1; k < 6; k++) ln(x - 1.5 + k * 0.02, cb - k * 4.4, x + 1.5 - k * 0.02, cb - k * 4.4, 'rgba(0,0,0,0.12)', 0.5);
  ln(x + 0.4, cb, x + 0.3, cb - H, 'rgba(255,255,255,0.35)', 0.5);
  box(x, cb - H, 1.8, 0.9, 1, '#c9a04a', '#e8bb4f', '#d9b04a');
  const ay = cb - H - 1, G = '#e8c04a', GD = '#b8902a';
  poly([[x - 0.9, ay], [x + 0.9, ay], [x + 0.6, ay - 4.2], [x - 0.6, ay - 4.2]], G);
  poly([[x - 0.5, ay - 3.4], [x - 5.4, ay - 6.6], [x - 3.6, ay - 3.8], [x - 0.6, ay - 2.4]], GD);
  poly([[x + 0.5, ay - 3.4], [x + 5.4, ay - 7.2], [x + 3.8, ay - 4], [x + 0.6, ay - 2.4]], G);
  circ(x, ay - 4.9, 0.75, G);
  ln(x + 0.6, ay - 4.2, x + 1.8, ay - 6.4, G, 0.5);
  c.beginPath(); c.arc(x + 2, ay - 6.8, 0.6, 0, TAU); c.strokeStyle = paint(G); c.lineWidth = 0.4; c.stroke();
  glow(x, ay - 4, 6, 'rgba(255,215,110,0.3)');
  plazaLamps(x, y, false, '#f2c86a');
}

/* ---------- شيكاغو الثلاثينيات: مطعم دينر معدني بخط أحمر ولافتة نيون، وسينما بمظلة مصابيح ولافتة عمودية؛ والمعلم نافورة باكنغهام ---------- */
function diner(x, y, i, j, T) {
  const w = 13, d = 6.5, h = 9, qb = qR(x, y, w, d), qa = qL(x, y, w, d);
  box(x, y + 1, w + 0.6, d + 0.3, 1.4, '#4a4a4e', '#5a5a5e', '#3a3a3e');
  box(x, y - 0.4, w, d, h, '#a8acb0', '#c8ccd0');
  for (let k = 1; k < 12; k++) { const A = qa(k / 12, 0), B = qa(k / 12, h); ln(A[0], A[1], B[0], B[1], 'rgba(255,255,255,0.25)', 0.3); }
  wR(x, y - 0.4, w, d, 0, 1.6, 1, 1.2, '#c8322a'); wL(x, y - 0.4, w, d, 0, 1.6, 1, 1.2, '#a82a24');
  for (let k = 0; k < 5; k++) wR(x, y - 0.4, w, d, 0.06 + k * 0.19, 3.4, 0.15, 3.4, '#f2d58a');
  poly([[x - w, y - 0.4 - h], [x, y - 0.4 - d - h - 2], [x + w, y - 0.4 - h], [x, y - 0.4 + d - h]], '#8a8e92');
  damage(x, y - 0.4, w, d, h, i, j, T);
  const S = qb(0.5, h + 0.4), sx = S[0], sy = S[1] - 3;
  ln(sx, S[1], sx, sy + 2, '#2a2a2e', 0.5);
  glow(sx, sy, 9, 'rgba(255,90,90,0.3)');
  poly([[sx - 5, sy + 1.2], [sx + 5, sy - 1.3], [sx + 5, sy - 4.3], [sx - 5, sy - 1.8]], '#2a2a2e');
  for (let k = 0; k < 5; k++) { const P = [sx - 4 + k * 2, sy + 0.4 - k * 0.5]; rc(P[0] - 0.6, P[1] - 2.2, 1.2, 1.8, '#ff5a5a'); }
}
function cinema(x, y, i, j, T) {
  const w = 13, d = 6.5, h = 20, qb = qR(x, y, w, d), qa = qL(x, y, w, d);
  box(x, y, w, d, h, '#6a4a3a', '#7e5a48', '#5a4a40');
  for (let k = 0; k < 3; k++) wL(x, y, w, d, 0.1 + k * 0.3, 10, 0.16, 6, '#262422');
  wR(x, y, w, d, 0.15, 0, 0.7, 6, '#2a2018');
  for (let k = 0; k < 3; k++) wR(x, y, w, d, 0.2 + k * 0.22, 1.2, 0.16, 3.6, '#c8402e');
  const A = qb(0.05, 7.4), B = qb(0.95, 7.4), o = [2.4, 2];
  poly([A, B, [B[0] + o[0], B[1] + o[1]], [A[0] + o[0], A[1] + o[1]]], '#e8dcc0');
  poly([A, B, [B[0], B[1] - 3], [A[0], A[1] - 3]], '#f4efe4');
  for (let k = 0; k < 3; k++) { const P = qb(0.2 + k * 0.25, 5.2); rc(P[0] - 1, P[1] - 0.6, 2, 1.2, '#2a2a2e'); }
  for (let k = 0; k < 14; k++) { const P = lerp([A[0], A[1] - 3], [B[0], B[1] - 3], k / 13); circ(P[0], P[1], 0.35, '#fff2b0'); }
  glow((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 1, 12, 'rgba(255,220,120,0.3)');
  damage(x, y, w, d, h, i, j, T);
  const V = qb(0.98, 9);
  poly([[V[0], V[1]], [V[0] + 2.6, V[1] - 1.3], [V[0] + 2.6, V[1] - 13.3], [V[0], V[1] - 12]], '#c8322a');
  for (let k = 0; k < 5; k++) { const P = [V[0] + 1.3, V[1] - 2 - k * 2.2 - 0.65]; rc(P[0] - 0.7, P[1] - 0.9, 1.4, 1.6, '#fff2b0'); }
}
// المعلم: نافورة باكنغهام (1927): ثلاث طبقات من الرخام الوردي فوق حوض واسع ونافورة عالية في وسطها
function buckingham(x, y) {
  plaza(x, y, '#8f8b82', '#5e5a54');
  const P = '#d8b8a8', PD = '#b89888', W = '#6aa8c8', c = getCtx();
  el(x, y + 1.6, 13, 6.4, PD); el(x, y + 0.8, 13, 6.4, P); el(x, y + 0.6, 11.4, 5.6, W);
  for (const [t, r, h] of [[0, 7, 2.4], [1, 4.6, 2], [2, 2.6, 1.6]]) {
    const cy = y - 1.4 - t * 4.2;
    poly([[x - r * 0.4, cy + 2], [x + r * 0.4, cy + 2], [x + r * 0.3, cy + 3.6 + t * 0.4], [x - r * 0.3, cy + 3.6 + t * 0.4]], PD);
    el(x, cy + h * 0.4, r, r * 0.45, PD); el(x, cy, r, r * 0.45, P); el(x, cy - 0.2, r * 0.82, r * 0.36, W);
  }
  c.save(); c.globalAlpha = 0.6; c.beginPath();
  c.moveTo(x, y - 12); c.lineTo(x, y - 24);
  for (const s of [-1, 1]) { c.moveTo(x + s * 0.4, y - 23); c.quadraticCurveTo(x + s * 3.4, y - 22, x + s * 4.4, y - 10); c.moveTo(x + s * 6, y - 1); c.quadraticCurveTo(x + s * 8.4, y - 4, x + s * 10, y + 1); }
  c.strokeStyle = paint('#d8f0ff'); c.lineWidth = 0.7; c.stroke(); c.restore();
  for (const [dx, dy] of [[-11, 2.4], [11, 0.6], [0, 6.4]]) { el(x + dx, y + dy, 1.4, 0.8, '#5a7a6a'); poly([[x + dx - 0.6, y + dy], [x + dx, y + dy - 2.6], [x + dx + 0.6, y + dy]], '#4a6a5a'); }
}

/* ---------- ريو: بوتيكو بطاولات وكراسٍ صفراء، وكشك عصير وفواكه استوائية؛ والمعلم كرة قدم عملاقة بألوان البرازيل ---------- */
const RIO = ['#e8c25a', '#e88a6a', '#7ab8c8', '#f0e6d2', '#9cc48a', '#e6a8b8'];
function rioBase(x, y, i, j, h, k0) {
  const c = RIO[Math.floor(hsh(i, j, k0) * RIO.length)], w = 12, d = 6;
  box(x, y, w, d, h, mixc(c, '#000000', 0.18), c);
  return qR(x, y, w, d);
}
function boteco(x, y, i, j, T) {
  const w = 12, d = 6, h = 12, qb = rioBase(x, y, i, j, h, 1450);
  wR(x, y, w, d, 0.06, 0, 0.88, 6.6, '#3a2a20');
  wR(x, y, w, d, 0.08, 0.4, 0.84, 2.2, '#f0b050');
  wR(x, y, w, d, 0.06, 7.2, 0.88, 2, '#2f6e4e');
  { const A = qb(0.2, 7.8), B = qb(0.8, 8.6); ln(A[0], A[1], B[0], B[1], '#f2d23a', 0.7); }
  for (let k = 0; k < 2; k++) wR(x, y, w, d, 0.2 + k * 0.4, 9.6, 0.18, 2, '#2e3a40');
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 4, { front: '#b5523a', end: '#c9654a', back: '#7a3428', ov: 1.6, k: 0.8, tile: 'rgba(80,20,10,0.3)' });
  for (const u of [0.28, 0.74]) {
    const P = qb(u, 0), tx = P[0] + 2.6, ty = P[1] + 3.6;
    box(tx, ty, 1.6, 0.8, 1.8, '#d8a81a', '#f2c42a', '#f8d84a');
    for (const [dx, dy] of [[-2.2, 0.4], [2.1, 0.9]]) stool(tx + dx, ty + dy, '#f2c42a');
    rc(tx - 0.3, ty - 3.2, 0.6, 1.2, '#7a4a1a');
  }
}
function fruta(x, y, i, j, T) {
  const w = 11, d = 5.5, h = 10, qb = rioBase(x, y, i, j, h, 1451);
  wR(x, y, w, d, 0.08, 0, 0.84, 6, '#2a2018');
  for (let k = 0; k < 4; k++) { const P = qb(0.15 + k * 0.2, 6.4); for (let b = 0; b < 3; b++) ln(P[0] - 0.4 + b * 0.4, P[1], P[0] - 0.6 + b * 0.4, P[1] + 2, '#f2d23a', 0.6); }
  awning(qb, 1, 0.04, 0.96, 7.4, ['#2e8b57', '#f2d23a'], 7, 2.2, 1.6);
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 4, { front: '#b5523a', end: '#c9654a', back: '#7a3428', ov: 1.6, k: 0.8, tile: 'rgba(80,20,10,0.3)' });
  const P = qb(0.35, 0), bx = P[0] + 2.6, by = P[1] + 3.4;
  box(bx, by, 4, 2, 1.6, '#7a5a3a', '#8e6a46', '#a07a52');
  for (let k = 0; k < 3; k++) { const cx = bx - 2 + k * 2, cy = by - 2.2 - k * 1; el(cx, cy, 0.9, 0.8, '#6a8a3a'); }
  const pa = [bx + 1.6, by - 3.4]; el(pa[0], pa[1], 0.8, 1.1, '#e8a83a'); for (let k = 0; k < 4; k++) ln(pa[0], pa[1] - 1, pa[0] - 1 + k * 0.7, pa[1] - 2.4, '#4f8a3a', 0.4);
  el(bx - 1.6, by - 3, 0.7, 0.6, '#e85a2a');
}
// المعلم: كرة قدم عملاقة (أسود وأبيض) على قاعدة بالأخضر والأصفر والأزرق
function football(x, y) {
  plaza(x, y, '#e2dccd', '#a89a82');
  plazaLamps(x, y, true, '#f2d58a');
  const top = plinth(x, y + 1, 7, 6, '#2a9a4a', '#3ab85a', '#f2d23a');
  el(x, top + 0.2, 4.4, 2, '#2a4a9a');
  const r = 7, cy = top - r + 0.6, c = getCtx();
  el(x + 1, top + 0.4, 5.4, 1.4, 'rgba(0,0,0,0.25)');
  circ(x, cy, r, '#f4f2ec');
  const pent = (px, py, s) => { const pts = []; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU - 1.57; pts.push([px + Math.cos(a) * s, py + Math.sin(a) * s]); } poly(pts, '#2a2a2e'); };
  pent(x - 0.6, cy - 0.6, 2.2);
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * TAU - 1.57 + 0.63, px = x - 0.6 + Math.cos(a) * 5.2, py = cy - 0.6 + Math.sin(a) * 5.2;
    if ((px - x) ** 2 + (py - cy) ** 2 < (r - 1.2) ** 2) pent(px, py, 1.5);
    ln(x - 0.6 + Math.cos(a) * 2.2, cy - 0.6 + Math.sin(a) * 2.2, px - Math.cos(a) * 1.4, py - Math.sin(a) * 1.4, '#6a6a6e', 0.4);
  }
  c.beginPath(); c.arc(x, cy, r, 0, TAU); c.strokeStyle = paint('#8a8a8e'); c.lineWidth = 0.5; c.stroke();
  c.beginPath(); c.arc(x - 2, cy - 2.4, r * 0.55, 3.6, 4.6); c.strokeStyle = paint('rgba(255,255,255,0.8)'); c.lineWidth = 0.8; c.stroke();
  plazaLamps(x, y, false, '#f2d58a');
}

/* ---------- لا بوكا: مطعم باريّا بشواية لحم ودخان، ومقهى تانغو بلافتة ورسم راقصين؛ والمعلم تمثال زوجين يرقصان التانغو ---------- */
const BOCA = ['#e2463a', '#f0c23a', '#3a8ad0', '#5aaa5a', '#e88a2a', '#2fa8a0', '#c84a8a'];
function bocaBase(x, y, i, j, h, k0) {
  const w = 12, d = 6, cs = [0, 1, 2].map(k => BOCA[Math.floor(hsh(i, j, k0 + k) * BOCA.length)]), qb = qR(x, y, w, d), qa = qL(x, y, w, d);
  box(x, y, w, d, h, '#5a5a5e', '#6e6e72');
  poly([qb(0, 0), qb(1, 0), qb(1, h), qb(0, h)], cs[0]);
  poly([qa(0, 0), qa(1, 0), qa(1, h), qa(0, h)], mixc(cs[1], '#000000', 0.2));
  for (let k = 1; k < 10; k++) { let A = qb(k / 10, 0), B = qb(k / 10, h); ln(A[0], A[1], B[0], B[1], 'rgba(0,0,0,0.16)', 0.4); A = qa(k / 10, 0); B = qa(k / 10, h); ln(A[0], A[1], B[0], B[1], 'rgba(0,0,0,0.16)', 0.4); }
  return { qb, cs };
}
function parrilla(x, y, i, j, T) {
  const w = 12, d = 6, h = 12, { qb, cs } = bocaBase(x, y, i, j, h, 1460);
  wR(x, y, w, d, 0.1, 0, 0.5, 6.4, '#2a2018'); wR(x, y, w, d, 0.12, 0.4, 0.46, 2, '#f0b050');
  wR(x, y, w, d, 0.66, 3, 0.2, 3.6, '#2a3a46');
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 4, { front: '#8a8e92', end: '#9a9ea2', back: '#5a5e62', k: 0.9, tile: 'rgba(0,0,0,0.25)' });
  const P = qb(0.45, 0), gx = P[0] + 3, gy = P[1] + 3.6;
  box(gx, gy, 3.6, 1.8, 2.2, '#3a3a3e', '#4a4a4e', '#2a2a2e');
  for (let k = 0; k < 5; k++) { const A = [gx - 3 + k * 1.3, gy - 2.2 + 0.9 - k * 0.65]; ln(A[0], A[1], A[0] + 2.4, A[1] - 1.2, '#6a6a6e', 0.3); }
  for (const [dx, dy, s] of [[-1.4, -2.4, 1.1], [0.8, -3.2, 0.9], [1.6, -2.4, 0.7]]) el(gx + dx, gy + dy, s * 1.2, s * 0.6, '#8a3a24');
  glow(gx, gy - 2.4, 5, 'rgba(255,110,40,0.3)');
  smoke(gx + 0.4, gy - 4);
  stool(gx - 4.4, gy + 1.2, cs[2]); stool(gx + 4.6, gy - 1.4, cs[2]);
}
function tango(x, y, i, j, T) {
  const w = 12, d = 6, h = 13, { qb, cs } = bocaBase(x, y, i, j, h, 1463);
  wR(x, y, w, d, 0.08, 0, 0.36, 6.4, '#2a2018'); wR(x, y, w, d, 0.1, 0.4, 0.32, 2.4, '#f0b050');
  wR(x, y, w, d, 0.5, 7.2, 0.44, 2.6, '#1e1e22');
  { const A = qb(0.54, 8), B = qb(0.9, 8.6); ln(A[0], A[1], B[0], B[1], '#f2d23a', 0.7); }
  // رسم راقصين على الواجهة: ظلان داكنان، والراقصة بفستان أحمر
  const D = qb(0.7, 0.6);
  poly([[D[0] - 0.4, D[1]], [D[0] + 0.6, D[1] - 0.4], [D[0] + 0.4, D[1] - 4.4], [D[0] - 0.4, D[1] - 4]], '#1e1e22');
  circ(D[0], D[1] - 4.9, 0.55, '#1e1e22');
  poly([[D[0] + 0.6, D[1] - 3.6], [D[0] + 2.8, D[1] - 1], [D[0] + 1.4, D[1] - 0.4], [D[0] + 0.8, D[1] - 2]], '#c8322a');
  circ(D[0] + 1, D[1] - 4.4, 0.5, '#1e1e22');
  damage(x, y, w, d, h, i, j, T);
  ridgeRoof(x, y, w, d, h, 4, { front: '#8a8e92', end: '#9a9ea2', back: '#5a5e62', k: 0.9, tile: 'rgba(0,0,0,0.25)' });
  const P = qb(0.25, 0), tx = P[0] + 2.6, ty = P[1] + 3.4;
  el(tx, ty - 1.5, 1.6, 0.75, '#f4efe4'); ln(tx, ty - 1.5, tx, ty, '#2a2a2e', 0.4);
  stool(tx - 2, ty + 0.4, cs[1]); stool(tx + 1.9, ty + 0.8, cs[1]);
}
// المعلم: تمثال زوجين يرقصان التانغو: هو ببدلة سوداء وقبعة، وهي بفستان أحمر وساق ممدودة، على قاعدة ملونة
function tangoCouple(x, y) {
  plaza(x, y, '#8f8a80', '#625e57');
  plazaLamps(x, y, true, '#f2d58a');
  const top = plinth(x, y + 1, 6.6, 4.4, '#3a8ad0', '#f0c23a', '#e2463a');
  const K = '#1e1e22', R = '#c8322a', S = '#d8a888', mx = x - 2, fx = x + 2.2, by = top;
  poly([[mx - 1.6, by], [mx - 0.6, by], [mx - 0.2, by - 7], [mx - 1.4, by - 7]], K);
  poly([[mx + 0.2, by], [mx + 1.2, by - 0.4], [mx + 0.4, by - 7], [mx - 0.6, by - 7]], K);
  poly([[mx - 1.8, by - 7], [mx + 1.2, by - 7.4], [mx + 1.8, by - 13.6], [mx - 1.4, by - 13.2]], K);
  circ(mx + 0.2, by - 14.8, 1.2, S);
  poly([[mx - 1.6, by - 15.6], [mx + 2, by - 16.2], [mx + 1.6, by - 17.6], [mx - 1.2, by - 17]], K);
  ln(mx - 2.2, by - 15.8, mx + 2.6, by - 16.4, K, 0.6);
  ln(mx + 1.6, by - 12.6, fx - 0.4, by - 13.4, K, 0.9);
  poly([[fx - 1.2, by - 7.6], [fx + 1.4, by - 8], [fx + 1, by - 13.6], [fx - 1, by - 13.2]], R);
  poly([[fx - 1.4, by - 7.6], [fx + 2.2, by - 8.2], [fx + 0.8, by - 3.6]], R);
  ln(fx - 0.2, by - 7.6, fx - 0.6, by, S, 0.9);
  ln(fx + 0.8, by - 7.8, fx + 5.4, by - 3.4, S, 0.9);
  circ(fx, by - 14.6, 1.1, S);
  el(fx - 0.4, by - 15.4, 1.3, 0.8, K);
  ln(fx - 0.8, by - 12.4, mx + 1.6, by - 11.2, S, 0.6);
  plazaLamps(x, y, false, '#f2d58a');
}

/* ---------- تينوتشتيتلان: سوق تيانغيس بحصر وبضائع تحت مظلات قماش، ودكان فخار بجرار وفرن؛ والمعلم حجر الشمس ---------- */
function aztecBase(x, y, i, j, T, h) {
  const w = 12, d = 6;
  box(x, y + 1, w + 2, d + 1, 2.6, '#b8aa8e', '#cfc2a4', '#c4b698');
  box(x, y - 1.6, w, d, h, '#e6e0d2', '#f4f0e6', '#ece6d8');
  wR(x, y - 1.6, w, d, 0, h - 2, 1, 2, '#b8322c'); wL(x, y - 1.6, w, d, 0, h - 2, 1, 2, '#9a2a24');
  return qR(x, y - 1.6, w, d);
}
function tianguis(x, y, i, j, T) {
  const h = 9, qb = aztecBase(x, y, i, j, T, h);
  wR(x, y - 1.6, 12, 6, 0.3, 0, 0.22, 5.6, '#3a2a1c');
  damage(x, y - 1.6, 12, 6, h, i, j, T);
  const P = qb(0.5, 0), mx = P[0] + 3, my = P[1] + 4.4;
  poly([[mx - 6, my], [mx, my - 3], [mx + 6, my], [mx, my + 3]], '#c9a86a');
  for (let k = 1; k < 5; k++) { const A = lerp([mx - 6, my], [mx, my - 3], k / 5), B = lerp([mx, my + 3], [mx + 6, my], k / 5); ln(A[0], A[1], B[0], B[1], '#a8884a', 0.35); }
  baskets(mx - 3.4, my + 0.4, ['#e8c23a', '#c8322a', '#5a3a24', '#2e8b57'], 4, '#9a7448');
  for (let k = 0; k < 3; k++) { const fx = mx + 2.4 + k * 0.9, fy = my - 1.2 - k * 0.45; ln(fx, fy, fx + 0.6, fy - 3, ['#2fa8a0', '#e8742a', '#2e8b57'][k], 0.6); }
  for (const [dx, dy] of [[-4.6, -1.6], [4.6, 1.4]]) ln(mx + dx, my + dy, mx + dx, my + dy - 7, '#6a4a2a', 0.5);
  poly([[mx - 5.4, my - 8.6], [mx + 5.4, my - 6.2], [mx + 4.6, my - 4.8], [mx - 6.2, my - 7.2]], '#2fa8a0');
  poly([[mx - 5.4, my - 8.6], [mx + 5.4, my - 6.2], [mx + 5.4, my - 5.6], [mx - 5.4, my - 8]], '#e8742a');
}
function pottery(x, y, i, j, T) {
  const h = 10, qb = aztecBase(x, y, i, j, T, h);
  wR(x, y - 1.6, 12, 6, 0.15, 0, 0.22, 5.6, '#3a2a1c');
  damage(x, y - 1.6, 12, 6, h, i, j, T);
  const P = qb(0.55, 0), kx = P[0] + 4, ky = P[1] + 2.4;
  el(kx, ky, 2.6, 1.3, '#8a5a3a'); el(kx, ky - 2.6, 2.2, 2.4, '#a86a44'); el(kx - 0.6, ky - 1.8, 0.8, 0.9, '#e8742a');
  ln(kx + 0.6, ky - 5, kx + 0.6, ky - 6.4, '#6a4a2e', 0.8); smoke(kx + 0.6, ky - 7);
  const Q = qb(0.2, 0);
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
    const jx = Q[0] + 2.4 + k * 2.2 + r * 1.2, jy = Q[1] + 3.4 - k * 1.1 + r * 1.4;
    el(jx, jy - 1.2, 1, 1.2, k % 2 ? '#b8643a' : '#c8784a');
    el(jx, jy - 2.3, 0.6, 0.3, '#8a4a2a');
    ln(jx - 0.9, jy - 1.4, jx + 0.9, jy - 1.4, '#f2ede0', 0.3);
  }
}
// المعلم: حجر الشمس الأزتيكي: قرص حجري قائم بحلقات منقوشة ووجه في وسطه، على قاعدة
function sunStone(x, y) {
  plaza(x, y, '#d8ccb0', '#b8aa8e');
  plazaLamps(x, y, true, '#f2c86a');
  box(x, y + 1, 7, 3.5, 3, '#9a8a6e', '#b4a486', '#c4b496');
  const cx = x, cy = y + 1 - 3 - 9.4, R = 9.2, c = getCtx();
  el(cx + 1.2, cy + 0.6, R, R * 1.02, '#7a6a52');
  el(cx, cy, R, R * 1.02, '#a89878');
  for (const [r, col, w] of [[R - 0.8, '#7a6a52', 0.6], [R - 2.6, '#6a5a44', 0.8], [R - 4.6, '#7a6a52', 0.6]]) {
    c.beginPath(); c.ellipse(cx, cy, r, r * 1.02, 0, 0, TAU); c.strokeStyle = paint(col); c.lineWidth = w; c.stroke();
  }
  for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, r0 = R - 2.6, r1 = R - 0.9; ln(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, '#6a5a44', 0.45); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2, r0 = R - 4.6, rx = cx + Math.cos(a) * r0, ry = cy + Math.sin(a) * r0; poly([[rx, ry], [cx + Math.cos(a + 0.18) * (r0 - 1.8), cy + Math.sin(a + 0.18) * (r0 - 1.8)], [cx + Math.cos(a - 0.18) * (r0 - 1.8), cy + Math.sin(a - 0.18) * (r0 - 1.8)]], '#8a7a5e'); }
  circ(cx, cy, 2.6, '#b8a888');
  circ(cx - 0.9, cy - 0.6, 0.4, '#4a3a28'); circ(cx + 0.9, cy - 0.6, 0.4, '#4a3a28');
  poly([[cx - 0.5, cy + 0.9], [cx + 0.5, cy + 0.9], [cx, cy + 2.2]], '#c8322a');
  c.beginPath(); c.ellipse(cx, cy, R, R * 1.02, 0, 0, TAU); c.strokeStyle = paint('#5a4a36'); c.lineWidth = 0.6; c.stroke();
  plazaLamps(x, y, false, '#f2c86a');
}

export const LOCAL_AMERICAS = {
  mexico: { split: 'adobe', add: [['taqueria', 20], ['frutas', 20]], draw: { taqueria, frutas, monument: angel },
            light: (x, y) => ({ x, y: y - 30, r: 36, c: '255,210,120', a: 0.45 }) },
  chicago: { split: 'brick', add: [['diner', 16], ['cinema', 16]], draw: { diner, cinema, monument: buckingham },
             light: (x, y) => ({ x, y: y - 8, r: 38, c: '200,230,255', a: 0.45 }) },
  rio: { split: 'colonial', add: [['boteco', 16], ['fruta', 16]], draw: { boteco, fruta, monument: football },
         light: (x, y) => ({ x, y: y - 14, r: 34, c: '255,225,150', a: 0.42 }) },
  laboca: { split: 'conv', add: [['parrilla', 14], ['tango', 14]], draw: { parrilla, tango, monument: tangoCouple },
            light: (x, y) => ({ x, y: y - 14, r: 34, c: '255,215,140', a: 0.42 }) },
  tenoch: { split: 'house', add: [['tianguis', 18], ['pottery', 18]], draw: { tianguis, pottery, monument: sunStone },
            light: (x, y) => ({ x, y: y - 14, r: 34, c: '255,200,120', a: 0.42 }) }
};
