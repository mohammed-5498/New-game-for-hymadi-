// المباني المحلية ومعالم المدن الأفريقية (بطلب المستخدم، كفكرة باريس): غوندر وكانو ومروي.
// تُركَّب بـ installLocal (localParts.js) في cityThemes.js، وأوزانها مقتطعة من المبنى الرئيسي.
import { getCtx, paint, TAU, poly, circ, ln, rc, el, box, qL, qR, wL, wR, arch, cyl, cone, glow, damage, hsh, mixc } from './cityThemes.js';
import { baskets, cups, incense, areesh, plaza, plinth, plazaLamps } from './localParts.js';

const lerp = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];

/* ---------- غوندر: بيت قهوة (جبنة وفناجين وعشب أخضر مفروش وبخور)، وبسطة سوق بسلال مسوب وقماش شمّا؛ والمعلم مسلة أكسوم ---------- */
// إبريق الجبنة الإثيوبي: بطن طيني مستدير ورقبة طويلة
function jebena(px, py, s = 1) {
  el(px, py - 1.6 * s, 1.6 * s, 1.5 * s, '#3a2418');
  el(px - 0.5 * s, py - 2.1 * s, 0.6 * s, 0.5 * s, '#5a3a24');
  rc(px - 0.35 * s, py - 5.6 * s, 0.7 * s, 2.6 * s, '#3a2418');
  ln(px + 1.2 * s, py - 1.8 * s, px + 2.2 * s, py - 3.2 * s, '#3a2418', 0.5 * s);
  ln(px - 0.4 * s, py - 4.6 * s, px - 1.8 * s, py - 3.2 * s, '#3a2418', 0.4 * s);
}
function buna(x, y, i, j, T) {
  const r = 6.8;
  cyl(x - 2, y - 1, r, 7, '#9a7450', '#c49a6c');
  wR(x - 2, y - 1, r, r * 0.5, 0.35, 0, 0.2, 5, '#3a2a1c');
  cone(x - 2, y - 8, r + 2.4, 10, '#a8843e', '#c9a25a');
  for (let k = 0; k < 4; k++) ln(x - r - 4 + k * 1.2, y - 8 - k * 0.4, x - 2 - k * 0.3, y - 18 + k * 0.6, 'rgba(90,60,20,0.35)', 0.5);
  damage(x - 2, y - 1, r * 0.7, r * 0.35, 6, i, j, T);
  const px = x + 6.4, py = y + 3.4;
  poly([[px - 5.4, py], [px, py - 2.7], [px + 5.4, py], [px, py + 2.7]], '#5f8a3a');
  for (let k = 0; k < 9; k++) { const a = k * 0.7; ln(px + Math.cos(a) * 3.6, py + Math.sin(a) * 1.8, px + Math.cos(a) * 3.6 + 0.6, py + Math.sin(a) * 1.8 - 0.9, '#7aa84a', 0.4); }
  el(px - 1.4, py + 0.2, 1.4, 0.7, '#5a3a24'); circ(px - 1.4, py, 0.4, '#e8742a');
  jebena(px - 1.4, py - 0.4, 0.8);
  box(px + 1.8, py - 0.2, 1.8, 0.9, 1, '#6a4a2e', '#80593c', '#94683f');
  cups(px + 0.6, py - 1.2, 3, '#f2ede0');
  incense(px + 4.4, py - 0.6);
}
const MESOB = ['#c8322a', '#e8c23a', '#2e8b57', '#2f5a8e'];
function mesob(px, py, cols) {
  el(px, py, 1.6, 0.8, cols[1]);
  poly([[px - 1.6, py], [px - 1, py - 2.4], [px + 1, py - 2.4], [px + 1.6, py]], cols[0]);
  ln(px - 1.3, py - 1.2, px + 1.3, py - 1.2, cols[2], 0.5);
  el(px, py - 2.4, 1.8, 0.8, cols[3]);
  poly([[px - 1.1, py - 3], [px, py - 4.2], [px + 1.1, py - 3]], cols[0]);
}
function mercato(x, y, i, j, T) {
  const w = 12, d = 6, h = 11, S1 = '#6e5e52', S2 = '#857266', qb = qR(x, y, w, d);
  box(x, y, w, d, h, S1, S2, '#7a6a5c');
  arch(qb, 0.12, 0.3, 7, '#2a2018'); arch(qb, 0.55, 0.3, 7, '#2a2018');
  wR(x, y, w, d, 0, h - 1.2, 1, 1.2, '#8a3a2a');
  const A = qb(0.04, 8.6), B = qb(0.96, 8.6);
  for (let k = 0; k < 4; k++) {
    const P = lerp([A[0] + 1.4, A[1] + 1.4], [B[0] + 1.4, B[1] + 1.4], (k + 0.5) / 4);
    rc(P[0] - 1, P[1], 2, 4, '#f2efe6'); rc(P[0] - 1, P[1] + 3.2, 2, 0.6, MESOB[k % 4]);
  }
  ln(A[0] + 1.4, A[1] + 1.4, B[0] + 1.4, B[1] + 1.4, '#5a3a22', 0.4);
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.35, 0);
  mesob(P[0] + 2.6, P[1] + 3.4, MESOB);
  mesob(P[0] + 5.6, P[1] + 2, [MESOB[2], MESOB[3], MESOB[0], MESOB[1]]);
  baskets(P[0] + 6.2, P[1] + 5, ['#b8321e', '#c8462e', '#e8b83a'], 3, '#c9a86a');
}
// المعلم: مسلة أكسوم: شاهد جرانيتي طويل بطوابق منحوتة وأبواب ونوافذ وهمية وقمة مستديرة
function aksum(x, y) {
  plaza(x, y, '#b09c78', '#7a6a5c');
  plazaLamps(x, y, true, '#f2d58a');
  box(x, y + 1, 6.4, 3.2, 2.6, '#6e6a62', '#868076', '#948e84');
  const b = y + 1 - 2.6, H = 34, w = 3.2, dd = 1.3;
  box(x, b, w, dd, H, '#7e786e', '#9a9488');
  for (let f = 0; f < 6; f++) {
    const v = 4 + f * 5;
    const A = qR(x, b, w, dd)(0, v), B = qR(x, b, w, dd)(1, v);
    ln(A[0], A[1], B[0], B[1], '#5e5a52', 0.6);
    wR(x, b, w, dd, 0.2, v + 1, 0.22, 2.4, '#4e4a44'); wR(x, b, w, dd, 0.58, v + 1, 0.22, 2.4, '#4e4a44');
    wL(x, b, w, dd, 0.35, v + 1, 0.3, 2.4, '#4a463f');
  }
  wR(x, b, w, dd, 0.32, 0, 0.36, 3.6, '#3e3a34');
  for (let k = 0; k < 4; k++) circ(qR(x, b, w, dd)(0.15 + k * 0.23, 2.2)[0], qR(x, b, w, dd)(0.15 + k * 0.23, 2.2)[1], 0.35, '#5e5a52');
  const c = getCtx(), T0 = b - H;
  c.beginPath(); c.moveTo(x - w, T0); c.quadraticCurveTo(x - w * 0.4, T0 - 4.4, x + 0.6, T0 - 3.8); c.lineTo(x + w, T0); c.lineTo(x, T0 + dd); c.closePath();
  c.fillStyle = paint('#8a8478'); c.fill();
  plazaLamps(x, y, false, '#f2d58a');
}

/* ---------- كانو: بسطة قماش أنقرة وقرع مجفف، وموقد سويا بأسياخ لحم ودخان؛ والمعلم فارس الدوربار ---------- */
const ANKARA = ['#e8742a', '#2f6aa8', '#e8c23a', '#2e8b57', '#c8322a', '#7a3ac2'];
function hausaBase(x, y, i, j, T, h) {
  const w = 12, d = 6, L = '#b77a4e', R = '#cc8c5c';
  box(x, y, w, d, h, L, R, '#c08452');
  poly([[x - w, y - h], [x, y - d - h], [x + w, y - h], [x + w, y - h - 1.4], [x, y - d - h - 1.4], [x - w, y - h - 1.4]], '#b47a4c');
  [[x - w, y], [x + w, y], [x, y + d]].forEach(([cx, cy]) => poly([[cx - 1.2, cy - h], [cx - 0.5, cy - h - 4], [cx + 0.4, cy - h - 2.8], [cx + 1.2, cy - h]], '#c08452'));
  return qR(x, y, w, d);
}
function kasuwa(x, y, i, j, T) {
  const w = 12, d = 6, h = 12, qb = hausaBase(x, y, i, j, T, h);
  arch(qb, 0.1, 0.56, 8, '#3a2418');
  for (let k = 0; k < 5; k++) {
    wR(x, y, w, d, 0.14 + k * 0.1, 1.4, 0.08, 5, ANKARA[(k + i) % 6]);
    for (let m = 0; m < 3; m++) { const P = qb(0.18 + k * 0.1, 2.2 + m * 1.5); circ(P[0], P[1], 0.25, ANKARA[(k + m + 2) % 6]); }
  }
  damage(x, y, w, d, h, i, j, T);
  const A = qb(0.02, 8.4), B = qb(0.98, 8.4), o = [1.8, 2.8];
  poly([A, B, [B[0] + o[0], B[1] + o[1]], [A[0] + o[0], A[1] + o[1]]], '#8a8a8e');
  for (let k = 1; k < 8; k++) { const P = qb(k / 8, 8.4); ln(P[0], P[1], P[0] + o[0], P[1] + o[1], '#6a6a6e', 0.4); }
  const P = qb(0.3, 0);
  for (let k = 0; k < 3; k++) {
    const gx = P[0] + 2.4 + k * 2.2, gy = P[1] + 3.6 - k * 1.1;
    el(gx, gy - 1, 1.3, 1.1, '#c9a24a'); el(gx, gy - 1.9, 0.8, 0.35, '#8a6a2e');
  }
}
function suya(x, y, i, j, T) {
  const w = 12, d = 6, h = 10, qb = hausaBase(x, y, i, j, T, h);
  wR(x, y, w, d, 0.15, 0, 0.22, 6, '#3a2418');
  wL(x, y, w, d, 0.3, 4.6, 0.14, 2.6, '#3a2418');
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.6, 0), gx = P[0] + 2.4, gy = P[1] + 3.4;
  box(gx, gy, 3.6, 1.8, 2.4, '#3a3a3e', '#4a4a4e', '#2a2a2e');
  for (let k = 0; k < 5; k++) { const sx = gx - 2.2 + k * 1.1, sy = gy - 2.6 - k * 0.55; ln(sx - 0.6, sy + 0.3, sx + 1.6, sy - 0.8, '#c9a86a', 0.3); el(sx + 0.5, sy - 0.25, 0.8, 0.35, '#8a3a1e'); }
  glow(gx, gy - 2.6, 5, 'rgba(255,120,40,0.35)');
  const c = getCtx();
  c.save(); c.globalAlpha = 0.35;
  for (let k = 0; k < 3; k++) el(gx + 0.6 + k * 1.4, gy - 5 - k * 2.4, 1.4 + k * 0.6, 0.9 + k * 0.4, '#8a8682');
  c.restore();
  areesh(gx, gy, 4.6, 2.3, 7.4, ['#9a9a9e', '#6a6a6e']);
  for (const [dx, dy] of [[-4.4, 2.4], [4.2, 3]]) box(gx + dx, gy + dy, 1.4, 0.7, 1, '#6a4a32', '#80593c', '#94683f');
}
// المعلم: فارس الدوربار: حصان بغطاء ملون وفارس بعمامة ورمح، على قاعدة طينية
function durbar(x, y) {
  plaza(x, y, '#cfa070', '#a8744a');
  plazaLamps(x, y, true, '#f2c86a');
  const top = plinth(x, y + 1, 7, 4.4, '#a86e44', '#be8256', '#b47a4c');
  const H = '#e8e2d6', HD = '#c8c0b0', bx = x + 0.6, by = top - 6.4;
  for (const [dx, dy] of [[3.4, -0.4], [-2.2, -1]]) ln(bx + dx, by + dy + 1, bx + dx + 0.2, by + dy + 6.4, HD, 1.1);
  el(bx, by, 5.2, 2.8, H);
  for (const [dx, dy] of [[2, 1.2], [-3, 0.6]]) ln(bx + dx, by + dy + 1, bx + dx - 0.2, by + dy + 6.8 - dy, H, 1.2);
  poly([[bx - 3.4, by - 2.4], [bx + 3.6, by - 2.8], [bx + 4.2, by + 2], [bx - 4, by + 2.4]], '#2f6aa8');
  for (let k = 0; k < 5; k++) poly([[bx - 3.6 + k * 1.8, by + 2.3 - k * 0.1], [bx - 2.7 + k * 1.8, by + 3.6 - k * 0.1], [bx - 1.8 + k * 1.8, by + 2.2 - k * 0.1]], k % 2 ? '#e8c23a' : '#c8322a');
  const c = getCtx();
  c.beginPath(); c.moveTo(bx - 4.4, by - 1); c.quadraticCurveTo(bx - 6.4, by - 4, bx - 7, by - 7);
  c.strokeStyle = paint(H); c.lineWidth = 2.4; c.lineCap = 'round'; c.stroke();
  poly([[bx - 7.6, by - 8.4], [bx - 5.6, by - 8.2], [bx - 8.4, by - 5], [bx - 9.4, by - 5.6]], H);
  poly([[bx - 7, by - 8], [bx - 6.4, by - 9.6], [bx - 6, by - 8]], HD);
  circ(bx - 7.6, by - 7.2, 0.3, '#2a2420');
  c.beginPath(); c.moveTo(bx + 5, by - 1); c.quadraticCurveTo(bx + 7, by + 0.4, bx + 6.4, by + 3.6);
  c.strokeStyle = paint(HD); c.lineWidth = 0.9; c.stroke();
  // الفارس: ثوب أبيض وعمامة كبيرة ووشاح، ورمح بشريط
  const rx = bx - 0.6, ry = by - 3;
  poly([[rx - 2, ry], [rx + 2, ry - 0.6], [rx + 1.4, ry - 6], [rx - 1.4, ry - 5.6]], '#f2efe6');
  poly([[rx - 1.4, ry - 5.6], [rx + 1.4, ry - 6], [rx + 1.2, ry - 3.6], [rx - 1.2, ry - 3.2]], '#c8322a');
  circ(rx, ry - 7, 1.2, '#5a3a24');
  el(rx, ry - 8.6, 2.2, 1.4, '#f2efe6'); el(rx + 0.6, ry - 9.6, 1.4, 0.9, '#e8e2d6');
  ln(rx + 2.4, ry + 2, rx - 2.6, ry - 13, '#5a4632', 0.6);
  poly([[rx - 2.6, ry - 13], [rx - 2.2, ry - 14.6], [rx - 2, ry - 12.8]], '#c8c8cc');
  poly([[rx - 2.2, ry - 12.4], [rx + 0.4, ry - 12], [rx - 1.8, ry - 11]], '#2e8b57');
  plazaLamps(x, y, false, '#f2c86a');
}

/* ---------- مروي والنوبة: بسطة نوبية بسلال تمر وكركديه تحت ظل حصير، وست الشاي بأكواب وكراسٍ صغيرة؛ والمعلم كبش آمون ---------- */
const NUB = ['#2f7fb5', '#e8b23a', '#2f9a8a', '#c8463a'];
function nubBase(x, y, i, j, T, h, k0) {
  const w = 12, d = 6, c = hsh(i, j, k0) < 0.5 ? '#efe9dc' : '#e6d6b8', qb = qR(x, y, w, d);
  box(x, y, w, d, h, mixc(c, '#000000', 0.14), c, mixc(c, '#000000', 0.05));
  const ac = NUB[Math.floor(hsh(i, j, k0 + 1) * NUB.length)];
  for (let k = 0; k < 6; k++) { const A = qb(k / 6, h - 1.2), B = qb((k + 0.5) / 6, h - 2.4), C = qb((k + 1) / 6, h - 1.2); poly([A, B, C], ac); }
  return { qb, ac };
}
function nubSouq(x, y, i, j, T) {
  const w = 12, d = 6, h = 10, { qb, ac } = nubBase(x, y, i, j, T, h, 1050);
  wR(x, y, w, d, 0.12, 0, 0.36, 6.4, ac); arch(qb, 0.16, 0.28, 5.6, '#4a3020');
  wR(x, y, w, d, 0.62, 3, 0.16, 2.6, '#3a2a20');
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.4, 0), sx = P[0] + 3, sy = P[1] + 3.6;
  baskets(sx - 3.4, sy + 0.6, ['#4a2414', '#9a1e3a', '#c8462e', '#e8b83a'], 4, '#c9a86a');
  areesh(sx, sy, 5.4, 2.7, 6.6, ['#d6c08a', '#b09a64']);
}
function shai(x, y, i, j, T) {
  const w = 11, d = 5.5, h = 9, { qb, ac } = nubBase(x, y, i, j, T, h, 1052);
  wR(x, y, w, d, 0.3, 0, 0.3, 6.2, ac); arch(qb, 0.33, 0.24, 5.4, '#4a3020');
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.55, 0), tx = P[0] + 2.6, ty = P[1] + 3.4;
  box(tx, ty, 2.4, 1.2, 1.4, '#7a5a3a', '#8e6a46', '#a07a52');
  for (let k = 0; k < 3; k++) { const gx = tx - 1.4 + k * 1.1, gy = ty - 1.6 - k * 0.5; rc(gx - 0.3, gy - 0.9, 0.6, 0.9, 'rgba(200,120,60,0.85)'); }
  el(tx + 3, ty + 0.8, 1.2, 0.6, '#3a3028'); circ(tx + 3, ty + 0.6, 0.4, '#e8742a');
  el(tx + 3, ty - 0.6, 1, 0.9, '#b8b0a0'); ln(tx + 3.8, ty - 0.8, tx + 4.8, ty - 1.6, '#b8b0a0', 0.4);
  for (const [dx, dy, col] of [[-3, 2.2, '#2f7fb5'], [1.2, 3.4, '#c8463a'], [-0.6, -2.6, '#e8b23a']]) box(tx + dx, ty + dy, 0.7, 0.35, 1, col, mixc(col, '#ffffff', 0.15), mixc(col, '#ffffff', 0.3));
}
// المعلم: كبش آمون الرابض بصوف مجعد وقرن حلزوني كبير على قاعدة (رمز مملكة كوش)
function ram(x, y) {
  plaza(x, y, '#dcc092', '#b8986a');
  plazaLamps(x, y, true, '#f2c86a');
  const top = plinth(x, y + 1, 7.4, 4, '#a87a4a', '#c4945e', '#d0a06a');
  const S = '#c49a62', SL = '#d8b07a', SD = '#9a7044', bx = x + 1, by = top - 3.6;
  el(bx - 3.4, by + 2.4, 1.8, 1, SD); el(bx + 4.2, by + 1.6, 1.8, 1, SD);
  el(bx, by, 7, 3.6, S);
  el(bx + 0.4, by - 1.2, 5.4, 2.2, SL);
  for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) circ(bx - 4 + k * 1.7 + r * 0.8, by - 1.6 + r * 1.6 - k * 0.1, 0.75, r ? S : SL);
  const hx = bx - 6.2, hy = by - 2.8;
  el(hx + 1.4, hy + 1.4, 2, 2, S);
  el(hx, hy, 2.6, 2.2, SL);
  poly([[hx - 1.6, hy - 0.6], [hx - 4.6, hy + 1.4], [hx - 4.2, hy + 2.6], [hx - 1.2, hy + 1.6]], SL);
  el(hx - 4.2, hy + 2, 0.9, 0.7, S);
  circ(hx - 4.4, hy + 1.8, 0.25, '#4a3020');
  const c = getCtx();
  c.beginPath();
  for (let k = 0; k <= 30; k++) {
    const t = k / 30, a = -1.6 + t * TAU * 1.15, r = 2.8 * (1 - t * 0.7);
    const px = hx + 0.9 + Math.cos(a) * r, py = hy + 0.6 + Math.sin(a) * r * 0.9;
    k ? c.lineTo(px, py) : c.moveTo(px, py);
  }
  c.strokeStyle = paint('#8a6038'); c.lineWidth = 1.5; c.lineCap = 'round'; c.stroke();
  c.beginPath(); c.arc(hx + 0.9, hy + 0.6, 2.8, -1.6, -0.2);
  c.strokeStyle = paint('#a87848'); c.lineWidth = 0.6; c.stroke();
  circ(hx - 1.4, hy - 0.4, 0.35, '#2a1a10');
  plazaLamps(x, y, false, '#f2c86a');
}

export const LOCAL_AFRICA = {
  gondar: { split: 'tukul', add: [['buna', 18], ['mercato', 18]], draw: { buna, mercato, monument: aksum },
            light: (x, y) => ({ x, y: y - 20, r: 34, c: '255,210,140', a: 0.4 }) },
  kano: { split: 'hausa', add: [['kasuwa', 18], ['suya', 18]], draw: { kasuwa, suya, monument: durbar },
          light: (x, y) => ({ x, y: y - 14, r: 34, c: '255,200,120', a: 0.42 }) },
  meroe: { split: 'nubian', add: [['souq', 16], ['shai', 16]], draw: { souq: nubSouq, shai, monument: ram },
           light: (x, y) => ({ x, y: y - 10, r: 32, c: '255,210,140', a: 0.4 }) }
};
