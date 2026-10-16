// المباني المحلية ومعالم المدن العربية (بطلب المستخدم، كفكرة باريس): متاجر وأسواق ومقاهٍ بطابع كل مدينة،
// ومعلم يميز منطقتها في وسطها بدل الدوار. تُركَّب على الطوابع بـ installLocal (localParts.js) في cityThemes.js:
// تُقتطع أوزانها من المبنى الرئيسي فلا تتغير الشوارع ولا الأحياء ولا ما يُمشى عليه.
import { getCtx, paint, poly, circ, ln, rc, el, box, qL, qR, wL, wR, arch, glow, damage, hsh, mixc } from './cityThemes.js';
import { awning, baskets, carpet, dallah, cups, shisha, firePit, jars, hangRow, areesh, incense, isoAt, isoBox,
  plaza, plinth, plazaLamps } from './localParts.js';
import { najdiTop, triVents, CAI, mashrabiya } from './citiesArab.js';
import { art } from './yamamah.js';

const SPICES = ['#c8462e', '#e8b83a', '#6f8a3a', '#9a5a2e'];
const JARS = ['#c8462e', '#e8b83a', '#3f8f8a', '#b06a2e', '#7a3a6a'];
const parapet = (x, y, w, d, h, col) =>
  poly([[x - w, y - h], [x, y - d - h], [x + w, y - h], [x + w, y - h - 1.4], [x, y - d - h - 1.4], [x - w, y - h - 1.4]], col);

/* ---------- مدينة عربية ---------- */
// مقهى شعبي: ثلاثة أقواس مضاءة بمظلة مخططة ولوحة خضراء، وأمامه سجادة بمساند ودلة وفناجين وأرجيلة
function qahwa(x, y, i, j, T) {
  const w = 12, d = 6, h = 10, qb = qR(x, y, w, d), qa = qL(x, y, w, d);
  box(x, y, w, d, h, '#d2c09c', '#e6d8b8', '#dccca8');
  parapet(x, y, w, d, h, '#c6b28c');
  for (let k = 0; k < 3; k++) { arch(qb, 0.07 + k * 0.31, 0.24, 7, '#4a3426'); wR(x, y, w, d, 0.1 + k * 0.31, 0.4, 0.18, 2.4, '#e0a850'); }
  wL(x, y, w, d, 0.2, 4.4, 0.6, 2.8, '#2f5a4a');
  const A = qa(0.27, 5.8), B = qa(0.73, 5.8);
  ln(A[0], A[1], B[0], B[1], '#d9b04a', 0.6);
  awning(qb, 1, 0.03, 0.97, 8, ['#2f6e5a', '#efe6d2'], 8, 2.2, 1.5);
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.55, 0);
  carpet(P[0] + 2.6, P[1] + 3.4, 5.4, 2.7, '#a8322a', '#d9b04a', '#7a2a22');
  dallah(P[0] + 1.2, P[1] + 3.8, 0.8);
  cups(P[0] + 3, P[1] + 4.3, 3);
  shisha(P[0] + 6.4, P[1] + 2.4);
}

// عطارة: قوس كبير برفوف مرطبانات ملونة، وفانوس معلق، ونوافذ خشب، وسلال بهارات أمامه
function attar(x, y, i, j, T) {
  const w = 12, d = 6, h = 17, qb = qR(x, y, w, d);
  box(x, y, w, d, h, '#d8c7a6', '#ecdfc4', '#e3d4b4');
  parapet(x, y, w, d, h, '#cbb994');
  arch(qb, 0.12, 0.5, 9.5, '#3e2c20');
  for (let r = 0; r < 2; r++) {
    const A = qb(0.16, 1.8 + r * 2.8), B = qb(0.58, 1.8 + r * 2.8);
    ln(A[0], A[1], B[0], B[1], '#7a5a3a', 0.5);
    for (let k = 0; k < 5; k++) { const P = qb(0.19 + k * 0.085, 2 + r * 2.8); el(P[0], P[1] - 0.6, 0.45, 0.65, JARS[(k + r * 2) % 5]); }
  }
  wL(x, y, w, d, 0.28, 11, 0.2, 3.6, '#8a5d3b'); wL(x, y, w, d, 0.6, 11, 0.2, 3.6, '#8a5d3b');
  wR(x, y, w, d, 0.74, 11, 0.16, 3.6, '#5a4334');
  const L = qb(0.37, 9.8);
  ln(L[0], L[1], L[0], L[1] + 1.4, '#3a3028', 0.3);
  poly([[L[0] - 0.8, L[1] + 1.4], [L[0] + 0.8, L[1] + 1.4], [L[0] + 0.6, L[1] + 3.2], [L[0] - 0.6, L[1] + 3.2]], '#e8b84a');
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.25, 0);
  baskets(P[0] + 2.4, P[1] + 3.4, SPICES, 4);
}

// المعلم: فانوس رمضان كبير بزجاج ملون على قاعدة في ساحة، يضيء ليلاً
function lanternMonument(x, y) {
  plaza(x, y, '#e2d0ab', '#b39c78');
  plazaLamps(x, y, true);
  const top = plinth(x, y + 1, 7, 5.4, '#b8a07a', '#cdb690', '#d9c4a0');
  const y0 = top - 2.2, brassL = '#a8842e', brassR = '#c9a04a', W = 4.8, D = 2.4, H = 14;
  box(x, top, 2.6, 1.3, 2.2, brassL, brassR, brassR);
  glow(x, y0 - 7, 18, 'rgba(255,200,110,0.35)');
  box(x, y0, W, D, H, brassL, brassR);
  const panes = [['#c83a3a', '#3a9a5a'], ['#3a6ac8', '#e8c23a']];
  for (let k = 0; k < 2; k++) {
    wL(x, y0, W, D, 0.1 + k * 0.44, 1.2, 0.36, H - 2.6, panes[0][k]);
    wR(x, y0, W, D, 0.1 + k * 0.44, 1.2, 0.36, H - 2.6, panes[1][k]);
  }
  const s = qR(x, y0, W, D)(0.18, H - 2);
  ln(s[0], s[1], s[0], s[1] + 8.5, 'rgba(255,255,255,0.4)', 0.5);
  // سقف هرمي نحاسي، وقبة صغيرة بحلقة تعليق
  const cy = y0 - H;
  poly([[x - W - 0.5, cy], [x, cy + D + 0.3], [x, cy - 5]], brassL);
  poly([[x, cy + D + 0.3], [x + W + 0.5, cy], [x, cy - 5]], brassR);
  circ(x, cy - 5.8, 1.3, brassR);
  const c = getCtx();
  c.beginPath(); c.ellipse(x, cy - 8.3, 1.2, 1.5, 0, 0, Math.PI * 2);
  c.strokeStyle = paint(brassL); c.lineWidth = 0.6; c.stroke();
  plazaLamps(x, y, false);
}

/* ---------- صحراء اليمامة: صور بيوتها نفسها، وأمامها بسطة تمر وبهارات تحت عريش، أو مجلس قهوة ---------- */
const DATES = ['#4a2414', '#6a3418', '#c8462e', '#e8b83a'];
function yamSouq(x, y, i, j, T) {
  art(hsh(i, j, 770) < 0.5 ? 'house_a' : 'house_b', x, y);
  damage(x, y, 15, 7.5, 8, i, j, T);
  baskets(x + 4.4, y + 6.4, DATES, 4, '#8a6a42');
  areesh(x + 8, y + 4.2, 5, 2.5, 6.5);
}
function yamMajlis(x, y, i, j, T) {
  art(hsh(i, j, 771) < 0.5 ? 'house_b' : 'house_a', x, y);
  damage(x, y, 15, 7.5, 8, i, j, T);
  const px = x + 8, py = y + 4.6;
  carpet(px, py, 6, 3, '#9a2a24', '#d9b04a', '#6a2a20');
  firePit(px + 0.6, py + 0.9);
  dallah(px - 2.2, py + 0.6, 0.75);
  dallah(px + 3, py + 1.4, 0.6, '#c8c0b0', '#8a8478');
  cups(px - 1, py + 2.3, 3);
}
// المعلم: دلة نحاسية ضخمة على قاعدة، وأمامها ثلاثة فناجين كبيرة
function dallahMonument(x, y) {
  plaza(x, y, '#e6d4ad', '#b8986a');
  plazaLamps(x, y, true, '#ffcf6a');
  const top = plinth(x, y + 1, 7, 5.4, '#c9ac80', '#dcc29a', '#e6d0aa');
  glow(x, top - 10, 17, 'rgba(255,210,120,0.25)');
  dallah(x - 1.4, top + 0.4, 3.5, '#d9b04a', '#a8842e');
  for (let k = 0; k < 3; k++) {
    const cx = x - 9 + k * 2.8, cy = y + 4.2 + k * 1.4;
    poly([[cx - 1.3, cy - 1.8], [cx + 1.3, cy - 1.8], [cx + 0.8, cy], [cx - 0.8, cy]], '#efe3c8');
    el(cx, cy - 1.8, 1.3, 0.45, '#c9a04a');
  }
  plazaLamps(x, y, false, '#ffcf6a');
}

/* ---------- شبام: مبانٍ طينية منخفضة بأعلى أبيض كالأبراج: دكان عسل دوعني، ومقهى قِشر بمجلس ومبخرة ---------- */
function shibamLow(x, y, h) {
  const w = 12, d = 6;
  box(x, y, w, d, h, '#a57f55', '#b98f62');
  wL(x, y, w, d, 0, h - 3.2, 1, 3.2, '#e2dbcd'); wR(x, y, w, d, 0, h - 3.2, 1, 3.2, '#f1ebdf');
  poly([[x - w, y - h], [x, y - d - h], [x + w, y - h], [x, y + d - h]], '#ebe4d6');
  [[x - w, y], [x + w, y], [x, y + d]].forEach(([cx, cy]) => poly([[cx - 1, cy - h], [cx, cy - h - 2.6], [cx + 1, cy - h]], '#f4eee2'));
}
const HONEY = ['#e8a830', '#c8862a', '#e0b84a'];
function honey(x, y, i, j, T) {
  const w = 12, d = 6, h = 14, qb = qR(x, y, w, d), qa = qL(x, y, w, d);
  shibamLow(x, y, h);
  arch(qb, 0.1, 0.46, 8, '#3a2a1c');
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
    const P = qb(0.15 + k * 0.095, 1.6 + r * 2.8);
    el(P[0], P[1] - 0.6, 0.5, 0.7, HONEY[(k + r) % 3]);
    rc(P[0] - 0.3, P[1] - 1.6, 0.6, 0.35, '#f2ede0');
  }
  wL(x, y, w, d, 0.3, 6.6, 0.42, 3, '#6a4a2a');
  const B = qa(0.51, 8.1);
  el(B[0], B[1], 1.3, 0.8, '#e8b83a');
  for (const o of [-0.5, 0.4]) ln(B[0] + o, B[1] - 0.8, B[0] + o, B[1] + 0.8, '#2a2018', 0.4);
  wR(x, y, w, d, 0.72, 4.4, 0.14, 2.6, '#3a2c20');
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.28, 0), bx = P[0] + 3, by = P[1] + 3.2;
  box(bx, by, 3.4, 1.7, 1.4, '#7a5a3a', '#8e6a46', '#a07a52');
  jars(bx - 1.2, by - 1.2, 3, HONEY);
}
function qishr(x, y, i, j, T) {
  const w = 12, d = 6, h = 11, qb = qR(x, y, w, d);
  shibamLow(x, y, h);
  for (let k = 0; k < 2; k++) { arch(qb, 0.12 + k * 0.42, 0.3, 7, '#3a2a1c'); wR(x, y, w, d, 0.15 + k * 0.42, 0.4, 0.24, 2.2, '#e0a850'); }
  wL(x, y, w, d, 0.4, 4.6, 0.16, 2.6, '#3a2c20');
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.5, 0);
  carpet(P[0] + 2.4, P[1] + 3.2, 5.4, 2.7, '#2f5a3a', '#c8322a', '#d9b04a');
  dallah(P[0] + 1.4, P[1] + 3.6, 0.7, '#b86a3a', '#8a4a2a');
  cups(P[0] + 3.2, P[1] + 4.1, 3);
  incense(P[0] + 6.6, P[1] + 2.2);
}
// المعلم: أعمدة عرش بلقيس (معبد مأرب): ستة أعمدة حجرية في صف على منصة، الرابع مكسور، وحجارة ساقطة
function bilqis(x, y) {
  plaza(x, y, '#d6ba8e', '#a8865a');
  box(x, y + 1, 13, 6.5, 2.4, '#c2ad86', '#d6c19a', '#e0cda8');
  const S = ['#cdbf9f', '#e2d6bc', '#ece2cc'];
  for (let k = 0; k < 6; k++) {
    const px = x - 8.5 + k * 3.4, py = y - 1.4 + k * 1.7 - 1.7;
    if (k === 3) {
      box(px, py, 1.3, 0.65, 7, S[0], S[1], S[2]);
      poly([[px - 1.3, py - 7], [px - 0.4, py - 8.6], [px + 0.5, py - 7.6], [px + 1.3, py - 8.2], [px + 1.3, py - 7], [px, py + 0.65 - 7]], S[2]);
      continue;
    }
    const H = 22 - (k % 2) * 1.6;
    box(px, py, 1.3, 0.65, H, S[0], S[1], S[2]);
    box(px, py - H, 1.8, 0.9, 1.3, S[0], S[1], S[2]);
  }
  box(x + 3, y + 4.4, 1.8, 0.9, 1.2, S[0], S[1], S[2]);
  box(x - 6, y + 2.6, 1.4, 0.7, 1, S[0], S[1], S[2]);
}

/* ---------- الدرعية: سوق نجدي بأبواب خشب ملونة وعريش، ومجلس قهوة بسجادة سدو وموقد ودلال ---------- */
const DOOR = ['#b8322c', '#2f6e4e', '#d9a43a', '#2f4a7a'];
function najdiSouq(x, y, i, j, T) {
  const w = 12, d = 6, h = 11, qb = qR(x, y, w, d), qa = qL(x, y, w, d);
  box(x, y, w, d, h, '#b98c5e', '#cfa274', '#c49868');
  triVents(qa, 0.12, h - 4, 6, '#4e3620');
  for (let k = 0; k < 3; k++) {
    const u = 0.07 + k * 0.31;
    wR(x, y, w, d, u, 0, 0.22, 6.2, '#3a2a1c');
    for (let g = 0; g < 3; g++) { const P = qb(u + 0.05 + g * 0.06, 0.6); el(P[0], P[1] - 0.4, 0.45, 0.4, DATES[(g + k) % 4]); }
    wR(x, y, w, d, u, 0, 0.07, 6.2, DOOR[(k + i + j) % 4]);
    const D = qb(u + 0.035, 3);
    poly([[D[0] - 0.3, D[1] + 0.5], [D[0] + 0.3, D[1] + 0.2], [D[0], D[1] - 0.6]], '#f2ede0');
  }
  najdiTop(x, y, w, d, h, '#c99d6e');
  damage(x, y, w, d, h, i, j, T);
  const A = qb(0.02, 7.4), B = qb(0.98, 7.4), o = [1.9, 2.9];
  ln(A[0] + o[0], A[1] + o[1], A[0] + o[0], A[1] + o[1] + 7.2, '#6a4a2e', 0.6);
  ln(B[0] + o[0], B[1] + o[1], B[0] + o[0], B[1] + o[1] + 7.2, '#6a4a2e', 0.6);
  poly([A, B, [B[0] + o[0], B[1] + o[1]], [A[0] + o[0], A[1] + o[1]]], '#b8935a');
  for (let k = 1; k < 8; k++) { const P = qb(k / 8, 7.4); ln(P[0], P[1], P[0] + o[0], P[1] + o[1], '#94703f', 0.4); }
  baskets(qb(0.2, 0)[0] + 2.6, qb(0.2, 0)[1] + 3.6, DATES, 4, '#8a6a42');
}
function najdiQahwa(x, y, i, j, T) {
  const w = 12, d = 6, h = 9, qb = qR(x, y, w, d), qa = qL(x, y, w, d);
  box(x, y, w, d, h, '#b98c5e', '#cfa274', '#c49868');
  triVents(qb, 0.1, h - 3.8, 6, '#5a3e26'); triVents(qa, 0.1, h - 3.8, 6, '#4e3620');
  wR(x, y, w, d, 0.12, 0, 0.2, 6, '#6a4a2a');
  poly([qb(0.15, 5), qb(0.29, 5), qb(0.22, 5.9)], DOOR[(i + j) % 4]);
  najdiTop(x, y, w, d, h, '#c99d6e');
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.62, 0), px = P[0] + 2.6, py = P[1] + 3.4;
  carpet(px, py, 6, 3, '#9a2a24', '#2a2420', '#f2ede0');
  for (const t of [-0.35, 0.35]) ln(px - 4.2 + Math.abs(t) * 0, py + t * 3, px + 4.2, py + t * 3, 'rgba(242,237,224,0.6)', 0.35);
  firePit(px + 0.4, py + 0.8);
  dallah(px - 2.4, py + 0.6, 0.7);
  dallah(px + 2.8, py + 1.5, 0.6);
  cups(px - 1.2, py + 2.2, 3);
  areesh(px, py, 6.6, 3.3, 7.4);
}
// المعلم: شعار النخلة والسيفين المتقاطعين على قاعدة طينية
function emblem(x, y) {
  plaza(x, y, '#dcc29c', '#b8935f');
  plazaLamps(x, y, true);
  const top = plinth(x, y + 1, 7, 5.4, '#b98c5e', '#cfa274', '#c49868');
  const c = getCtx(), gold = '#d9b04a', goldD = '#a8842e';
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(x - s * 7, top - 3); c.quadraticCurveTo(x - s * 1.5, top - 3.6, x + s * 6.8, top - 12.5);
    c.strokeStyle = paint(gold); c.lineWidth = 1.3; c.lineCap = 'round'; c.stroke();
    ln(x - s * 8.2, top - 4.4, x - s * 6, top - 1.6, goldD, 1);
    ln(x - s * 7, top - 3, x - s * 8.6, top - 2.2, goldD, 1.2);
  }
  c.beginPath(); c.moveTo(x, top - 1); c.quadraticCurveTo(x + 0.8, top - 11, x, top - 21);
  c.strokeStyle = paint('#8a6a45'); c.lineWidth = 1.8; c.stroke();
  for (let k = 0; k < 4; k++) ln(x - 0.9, top - 4 - k * 4, x + 1, top - 4.6 - k * 4, gold, 0.4);
  const tx = x, ty = top - 21;
  for (let k = 0; k < 9; k++) {
    const a = k * 0.7 + 0.1, dx = Math.cos(a) * 9.5, dy = Math.sin(a) * 3.8 + 2.4;
    poly([[tx, ty], [tx + dx, ty + dy], [tx + dx * 0.55, ty + dy - 1.8]], k % 2 ? '#3f8a4a' : '#2f7a3e');
  }
  plazaLamps(x, y, false);
}

/* ---------- القاهرة القديمة: دكان فوانيس في خان الخليلي، وعطارة بشيش خشب وأجولة بهارات ---------- */
const LANTERNS = ['#e8b84a', '#c83a3a', '#3a9a5a', '#3a6ac8', '#d86a2a'];
function cairoBase(x, y, i, j, h) {
  const c = CAI[Math.floor(hsh(i, j, 780) * CAI.length)], w = 12, d = 6;
  box(x, y, w, d, h, mixc(c, '#000000', 0.18), c, mixc(c, '#000000', 0.08));
  wL(x, y, w, d, 0, 0, 1, 5, '#b3a07c'); wR(x, y, w, d, 0, 0, 1, 5, '#c9b590');
  poly([[x - w, y - h], [x, y - d - h], [x + w, y - h], [x + w, y - h - 1.4], [x, y - d - h - 1.4], [x - w, y - h - 1.4]], mixc(c, '#000000', 0.12));
}
function fawanees(x, y, i, j, T) {
  const w = 12, d = 6, h = 18, qb = qR(x, y, w, d), qa = qL(x, y, w, d);
  cairoBase(x, y, i, j, h);
  arch(qb, 0.1, 0.56, 10.5, '#2e2014');
  glow(qb(0.38, 4)[0], qb(0.38, 4)[1], 7, 'rgba(255,190,90,0.35)');
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
    const P = qb(0.17 + k * 0.12, 2 + r * 3.4);
    poly([[P[0] - 0.6, P[1] - 1.6], [P[0] + 0.6, P[1] - 1.6], [P[0] + 0.8, P[1] - 0.4], [P[0], P[1] + 0.4], [P[0] - 0.8, P[1] - 0.4]], LANTERNS[(k + r * 2) % 5]);
  }
  for (let k = 0; k < 3; k++) { const P = qa(0.22 + k * 0.26, 8.5); el(P[0], P[1], 1.5, 1.7, '#a8842e'); el(P[0], P[1], 1.1, 1.3, '#d9b04a'); }
  mashrabiya(qb(0.68, 12));
  const A = qb(0.06, 11.2), B = qb(0.7, 11.2);
  hangRow([A[0] + 1.6, A[1] + 2.4], [B[0] + 1.6, B[1] + 2.4], 5, LANTERNS, 'lantern');
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.75, 0);
  for (let k = 0; k < 2; k++) {
    const lx = P[0] + 2.2 + k * 2.4, ly = P[1] + 3.2 - k * 1.2;
    poly([[lx - 0.9, ly - 2.6], [lx + 0.9, ly - 2.6], [lx + 1.1, ly - 0.8], [lx, ly], [lx - 1.1, ly - 0.8]], LANTERNS[k + 1]);
    poly([[lx - 0.9, ly - 2.6], [lx, ly - 3.8], [lx + 0.9, ly - 2.6]], '#a8842e');
  }
}
function attara(x, y, i, j, T) {
  const w = 12, d = 6, h = 15, qb = qR(x, y, w, d), qa = qL(x, y, w, d);
  cairoBase(x, y, i, j, h);
  wR(x, y, w, d, 0.16, 0, 0.5, 7.4, '#2e2014');
  for (let r = 0; r < 3; r++) { const A = qb(0.18, 1.5 + r * 2.2), B = qb(0.64, 1.5 + r * 2.2); ln(A[0], A[1], B[0], B[1], '#6a4a2a', 0.5); }
  for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) { const P = qb(0.2 + k * 0.09, 1.7 + r * 2.2); el(P[0], P[1] - 0.5, 0.4, 0.5, SPICES[(k + r) % 4]); }
  for (const [u, s] of [[0.16, -1], [0.66, 1]]) {
    const A = qb(u, 0), B = qb(u, 7.4);
    poly([A, B, [B[0] + s * 1.8, B[1] + 0.6], [A[0] + s * 1.8, A[1] + 0.6]], '#6a4428');
  }
  wL(x, y, w, d, 0.24, 9.4, 0.52, 2.6, '#2f5a4a');
  const S1 = qa(0.3, 10.7), S2 = qa(0.7, 10.7);
  ln(S1[0], S1[1], S2[0], S2[1], '#d9b04a', 0.6);
  wL(x, y, w, d, 0.3, 4, 0.16, 3.2, '#294f42'); wR(x, y, w, d, 0.78, 10, 0.14, 3, '#2f5a4a');
  const A = qb(0.1, 8.4), B = qb(0.7, 8.4);
  hangRow([A[0] + 1.4, A[1] + 2], [B[0] + 1.4, B[1] + 2], 6, ['#5f7f3e', '#8a6a3a', '#6f8a4a'], 'cloth');
  damage(x, y, w, d, h, i, j, T);
  const P = qb(0.22, 0);
  baskets(P[0] + 2.4, P[1] + 3.4, SPICES, 4, '#c9b48a');
}
// المعلم: أبو الهول على قاعدة طويلة، رأسه بغطاء النمس نحو الشارع، وجنبه الطويل ومخالبه الممدودة ظاهرة
function sphinx(x, y) {
  plaza(x, y, '#cfba94', '#a38c69');
  plazaLamps(x, y, true);
  isoBox(x, y + 1, 0.25, 0.44, 3.4, '#b8a07a', '#cdb690', '#d9c4a0');
  const b = y + 1 - 3.4, S = ['#c4a374', '#d6b98a', '#e2c79c'];
  const at = (u, v) => isoAt(x, b, u, v);
  let p = at(0, -0.28); isoBox(p[0], p[1], 0.15, 0.11, 6.4, S[0], S[1], S[2]);
  p = at(0, -0.02); isoBox(p[0], p[1], 0.14, 0.26, 5, S[0], S[1], S[2]);
  for (const u of [-0.085, 0.085]) { p = at(u, 0.33); isoBox(p[0], p[1], 0.045, 0.1, 1.6, S[0], S[1], S[2]); }
  // الرأس فوق مقدمة الجسم: رقبة ثم رأس مخطط، والوجه ولحيتا النمس على الواجهة الأمامية
  p = at(0, 0.15);
  const hx = p[0], hy = p[1] - 5;
  isoBox(hx, hy, 0.12, 0.09, 1.6, S[0], S[1], S[2]);
  const ty = hy - 1.6;
  isoBox(hx, ty, 0.11, 0.08, 6.4, '#b89a6c', '#ccad7e', '#d6b98a');
  for (let k = 1; k < 6; k++) {
    const A = isoAt(hx, ty - k * 1.05, 0.11, 0.08), B = isoAt(hx, ty - k * 1.05, 0.11, -0.08);
    ln(A[0], A[1], B[0], B[1], '#2f4a7a', 0.45);
  }
  const fl = isoAt(hx, ty, -0.065, 0.08), fr = isoAt(hx, ty, 0.065, 0.08);
  for (const [P, Q] of [[isoAt(hx, ty, -0.11, 0.08), fl], [fr, isoAt(hx, ty, 0.11, 0.08)]]) {
    poly([[P[0], P[1] - 0.2], [Q[0], Q[1] - 0.2], [Q[0], Q[1] - 6.2], [P[0], P[1] - 6.2]], '#c9a85e');
    for (let k = 1; k < 5; k++) ln(P[0], P[1] - k * 1.2, Q[0], Q[1] - k * 1.2, '#2f4a7a', 0.4);
  }
  poly([[fl[0], fl[1] - 0.6], [fr[0], fr[1] - 0.6], [fr[0], fr[1] - 5], [fl[0], fl[1] - 5]], '#dcc092');
  const m = [(fl[0] + fr[0]) / 2, (fl[1] + fr[1]) / 2];
  circ(m[0] - 1, m[1] - 3.9, 0.35, '#3a2a1c'); circ(m[0] + 0.9, m[1] - 3.4, 0.35, '#3a2a1c');
  ln(m[0], m[1] - 3.4, m[0] - 0.1, m[1] - 2.2, '#8a6a44', 0.4);
  ln(m[0] - 0.7, m[1] - 1.5, m[0] + 0.6, m[1] - 1.2, '#8a6a44', 0.35);
  poly([[m[0] - 0.5, m[1] - 0.8], [m[0] + 0.5, m[1] - 0.6], [m[0] + 0.3, m[1] + 1.4], [m[0] - 0.3, m[1] + 1.2]], '#b89a6c');
  plazaLamps(x, y, false);
}

export const LOCAL_ARAB = {
  arab: { split: 'house', add: [['qahwa', 22], ['attar', 22]], draw: { qahwa, attar, monument: lanternMonument },
          light: (x, y) => ({ x, y: y - 22, r: 40, c: '255,190,100', a: 0.55 }) },
  yamamah: { split: 'house', add: [['souq', 14], ['majlis', 14]], draw: { souq: yamSouq, majlis: yamMajlis, monument: dallahMonument },
             light: (x, y) => ({ x, y: y - 18, r: 36, c: '255,205,120', a: 0.45 }) },
  shibam: { split: 'tower', add: [['honey', 12], ['qishr', 12]], draw: { honey, qishr, monument: bilqis },
            light: (x, y) => ({ x, y: y - 14, r: 38, c: '255,215,150', a: 0.4 }) },
  diriyah: { split: 'najdi', add: [['souq', 20], ['qahwa', 20]], draw: { souq: najdiSouq, qahwa: najdiQahwa, monument: emblem },
             light: (x, y) => ({ x, y: y - 20, r: 38, c: '255,210,130', a: 0.45 }) },
  cairo: { split: 'house', add: [['fawanees', 16], ['attara', 16]], draw: { fawanees, attara, monument: sphinx },
           light: (x, y) => ({ x, y: y - 10, r: 34, c: '255,215,150', a: 0.4 }) }
};
