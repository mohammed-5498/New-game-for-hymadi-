/* الدفعة العربية (المرحلة 9أ، القسم 3.10): اليمن «أبناء سبأ»، السعودية «حراس القوافل»، مصر «فتوات الحارة».
   منقولة من docs/nations/batch1-skins.js: نفس الأشكال والنسب والألوان، مع إضافات اللعبة:
   - حقول السلاح (wlen وtwoH وtipLen وbutt) لمكان الشرر وأثر الضربة، وحلقات الأبطال والهالات من bodies.js
   - الحجر والقِدر يختفيان لحظة الرمي (thrown)، وقوس القوّاس بشدّ الوتر كقوس القناص
   - الصقّار: القوس يظهر في يده أثناء الرمي فقط والصقر على ساعده، وبلا صقر حين ينقضّ (نوع champion_away)
   - نسخة مبسّطة لكل وحدة: الجسد وغطاء الرأس وشكل الثوب والسلاح، بلا حواف ولا خطوط ولا نقوش صغيرة
   - للأداء: الأشكال بلون واحد في مسار واحد (خطوط الشماغ الحمراء رسمة واحدة)، وفي المستوى المبسّط تبدأ
     الساقان من حاشية الثوب (legFrom = طول الثوب) فلا يُرسم ما يغطيه الثوب
   (المرحلة 9ج) السعودية v2 من batch1-skins.js المحدث (الشماغ بنقشه، والمقلاع الحبلي، والقوس بطرفين ذهبيين،
   والجعبة بريشها، وقِدر النار بلهب الطبقات، والصقر المفصّل على القفاز)، وتفاصيل skins-v6.js لليمن ومصر
   في النسخ الكاملة (حلية العمامة، وحواف الأثواب، والمبخرة المخرّمة، والصولجان، وحلقات النبابيت، وإطار الدرع). */
import { TAU, dk, lt, limb, ell, rrect, tri, rot, add, STYLE, flame } from './anim.js';
import { heroRing } from './bodies.js';
import {
  registerNation, both, memo, mixHex, GOLD, STEEL2, auraRing, auraHealRings,
  lp, pg, circ, dot, legPt, robe, stripes, belt, staff, triTo, glowAt,
  hemBand, hemZig, apron, staffBands, smokeWisp
} from './nationArt.js';

const IND = '#2f3f7a', HORN = '#e3d6b0', WOODD = '#6e4f33', WHT = '#f2efe8', SHM = '#c0392b', AGAL = '#1c1c1c';
const LEATHER = '#7a5232', BRASS = '#d9b45a';

// ألوان مشتقة من لون اللاعب (مرة لكل لون)
const wrapCol = memo(col => lt(col, 0.72));                       // لفّة العمامة
const wrapLine = memo(col => dk(lt(col, 0.72), 0.15));
const izarCol = memo(col => mixHex(col, '#d8c8a8', 0.25));         // الإزار اليمني
const edgeCol = memo(col => dk(col, 0.3));
const edgeSoft = memo(col => dk(col, 0.25));
const lt55 = memo(col => lt(col, 0.55));
const lt45 = memo(col => lt(col, 0.45));
const thobeCol = memo(col => lt(col, 0.62));                       // الثوب السعودي
const galabCol = memo(col => mixHex(col, '#e6d7bc', 0.55));        // الجلابية المصرية
const SHM_LITE = mixHex(WHT, SHM, 0.3);                             // الشماغ من بعيد: أبيض بحمرة

// ---------- أغطية الرأس (إحداثيات الرأس: المركز 0,0 والوجه نحو +x) ----------
// حلية العمامة الذهبية (skins-v6): قرص وسلسلة وقطرة على جانب الوجه
function headJewel(c) { dot(c, 2.9, -1.7, 0.75, GOLD); limb(c, 2.9, -1.1, 3.1, 1.6, 0.4, GOLD); ell(c, 3.1, 2, 0.45, 0.7, GOLD); }
// العمامة اليمنية بشريط نيلي وطرف خلفي. المبسّطة: اللفّة وطرفها رسمة واحدة ثم الشريط
function imama(c, col, big, lite) {
  const w = wrapCol(col), rx = big ? 4.8 : 4.2, ry = big ? 2.9 : 2.4, tx = big ? -6.2 : -5.4, ty = big ? 5 : 3;
  if (lite) {
    c.beginPath(); c.ellipse(0, -1.7, rx, ry, 0, 0, TAU); triTo(c, -3.8, -0.8, tx, ty, -2.8, 0.6);
    c.fillStyle = w; c.fill();
    ell(c, 0, -0.9, big ? 4.8 : 4.3, 1, IND);
    return;
  }
  ell(c, 0, -1.7, rx, ry, w);
  ell(c, 0, -0.9, big ? 4.8 : 4.3, 1, IND);
  c.beginPath(); c.moveTo(-3, -2.7); c.lineTo(3, -2.3); c.moveTo(-2.6, -1.6); c.lineTo(3.2, -1.9);
  c.strokeStyle = wrapLine(col); c.lineWidth = 0.5; c.lineCap = 'round'; c.stroke();
  tri(c, [-3.8, -0.8], [tx, ty], [-2.8, 0.6], w);
  if (big) ell(c, 2.6, -2, 0.9, 0.9, GOLD);
  headJewel(c);
}
// الشماغ v2: قماش أبيض بتدرج ونقش أحمر مائل مقصوص على شكله، وطرف متدلٍّ بنقشه وحافة، وعقال مزدوج بلمعة.
// المبسّطة: نفس الشكل بلون واحد (أبيض بحمرة) وعقال واحد
const SHM_TOP = [-6, -4.7, -3.4, -2.1, -0.8, 0.5, 1.8, 3.1, 4.4, 5.7];     // k من -6 إلى 6 بخطوة 1.3 كالمرجع
const SHM_DRAPE = [-8, -6.7, -5.4, -4.1, -2.8, -1.5, -0.2, 1.1];          // k من -8 إلى 2
const shemaghGrads = new WeakMap();
function shemaghTopFill(c) {
  if (!STYLE.on) return WHT;
  let g = shemaghGrads.get(c);
  if (!g) { g = c.createLinearGradient(-4, -5, 4, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dcd7cc'); shemaghGrads.set(c, g); }
  return g;
}
function drapePath(c) { c.beginPath(); c.moveTo(-4.5, -0.8); c.lineTo(-5.8, 5.8); c.lineTo(-1.8, 5.2); c.lineTo(-2.1, 0); c.closePath(); }
function shemagh(c, veil, lite) {
  if (lite) {
    c.beginPath();
    c.ellipse(0, -0.8, 4.5, 4.2, 0, Math.PI, 0); c.closePath();
    c.moveTo(-4.5, -0.8); c.lineTo(-5.8, 5.8); c.lineTo(-1.8, 5.2); c.lineTo(-2.1, 0); c.closePath();
    if (veil) { c.moveTo(0.6, 0.4); c.lineTo(3.8, 0); c.lineTo(3.6, 2.6); c.lineTo(0.6, 2.9); c.closePath(); }
    else { c.moveTo(3.4, -0.8); c.lineTo(4.4, 3.2); c.lineTo(2.6, 2.8); c.closePath(); }
    c.fillStyle = SHM_LITE; c.fill();
    c.beginPath(); c.ellipse(0, -2.4, 4.05, 1.15, 0, 0, TAU);
    c.strokeStyle = AGAL; c.lineWidth = 1.1; c.stroke();
    return;
  }
  // أعلى الشماغ ونقشه المتقاطع
  c.save();
  c.beginPath(); c.ellipse(0, -0.8, 4.5, 4.2, 0, Math.PI, 0); c.lineTo(-4.5, -0.8); c.closePath();
  c.fillStyle = shemaghTopFill(c); c.fill(); c.clip();
  c.beginPath();
  for (const k of SHM_TOP) { c.moveTo(k, -6); c.lineTo(k + 3, 0); c.moveTo(k, -6); c.lineTo(k - 3, 0); }
  c.strokeStyle = SHM; c.lineWidth = 0.32; c.stroke();
  c.restore();
  // الطرف المتدلي ونقشه
  c.save();
  drapePath(c); c.fillStyle = STYLE.on ? '#ece8e0' : WHT; c.fill(); c.clip();
  c.beginPath();
  for (const k of SHM_DRAPE) { c.moveTo(k, -1); c.lineTo(k + 5, 7); }
  c.strokeStyle = SHM; c.lineWidth = 0.32; c.stroke();
  c.restore();
  if (STYLE.on) { drapePath(c); c.strokeStyle = '#b8b2a6'; c.lineWidth = 0.4; c.stroke(); limb(c, -3.6, 0.4, -4.4, 5, 0.4, 'rgba(0,0,0,0.12)'); }
  if (veil) pg(c, [[0.6, 0.4], [3.8, 0], [3.6, 2.6], [0.6, 2.9]], WHT); else pg(c, [[3.4, -0.8], [4.4, 3.2], [2.6, 2.8]], WHT);
  // العقال: حلقتان، ولمعة على كل منهما
  c.beginPath(); c.ellipse(0, -2.4, 4.05, 1.15, 0, 0, TAU); c.moveTo(3.8, -3.25); c.ellipse(0, -3.25, 3.8, 1.05, 0, 0, TAU);
  c.strokeStyle = AGAL; c.lineWidth = 0.95; c.stroke();
  if (STYLE.on) {
    c.beginPath(); c.ellipse(0, -2.4, 4.05, 1.15, 0, Math.PI * 1.1, Math.PI * 1.6);
    c.moveTo(3.8 * Math.cos(Math.PI * 1.1), -3.25 + 1.05 * Math.sin(Math.PI * 1.1)); c.ellipse(0, -3.25, 3.8, 1.05, 0, Math.PI * 1.1, Math.PI * 1.6);
    c.strokeStyle = '#6a6a70'; c.lineWidth = 0.35; c.stroke();
  }
}
function turbanEg(c, lite) {
  ell(c, 0, -1.9, 4.2, 2.1, '#efe6d2');
  if (lite) return;
  c.beginPath(); c.moveTo(-3.2, -2.2); c.lineTo(3.3, -1.6); c.moveTo(-3, -1.3); c.lineTo(3.4, -2.4);
  c.strokeStyle = '#d6cbb3'; c.lineWidth = 0.5; c.lineCap = 'round'; c.stroke();
}
function fez(c, lite) {
  pg(c, [[-2.9, -2.4], [2.9, -2.4], [2.3, -7.2], [-2.3, -7.2]], '#a8322a'); ell(c, 0, -7.2, 2.3, 0.7, '#8e2a24');
  if (!lite) { limb(c, 0, -7.2, -3, -4.6, 0.6, '#1c1c1c'); ell(c, -3, -4.4, 0.6, 0.9, '#1c1c1c'); }
}
// تاج ملكة سبأ: الحلقة والأسنان الخمسة (المبسّطة رسمة واحدة)، وجوهرة حمراء فوقه وحلية العمامة في الكاملة
function crownTeeth(c) {
  for (let k = 0; k < 5; k++) { const x = -3 + k * 1.5; c.moveTo(x - 0.6, -3.2); c.lineTo(x, -6.2 + (k === 2 ? -1 : 0)); c.lineTo(x + 0.6, -3.2); c.closePath(); }
}
function queenCrown(c, lite) {
  if (lite) {
    c.beginPath(); c.ellipse(0, -2.6, 3.9, 1.2, 0, 0, TAU); crownTeeth(c);
    c.fillStyle = GOLD; c.fill();
    return;
  }
  ell(c, 0, -2.6, 3.9, 1.2, GOLD);
  c.beginPath(); crownTeeth(c); c.fillStyle = GOLD; c.fill();
  ell(c, 0, -3.4, 0.7, 0.7, '#b8322c');
  headJewel(c);
  dot(c, 0, -3.6, 0.9, '#c8322c'); dot(c, -0.25, -3.85, 0.3, '#ff9a90');
}

// ---------- الأسلحة ----------
function jambiya(c, J, p, L, lite) {
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), hx = J.handF[0], hy = J.handF[1];
  c.beginPath(); c.moveTo(hx, hy);
  c.quadraticCurveTo(hx + dx * L * 0.6 - dy * 1.6, hy + dy * L * 0.6 + dx * 1.6, hx + dx * L, hy + dy * L);
  c.strokeStyle = STEEL2; c.lineWidth = 1.4; c.lineCap = 'round'; c.stroke();
  if (!lite) ell(c, hx - dx * 0.6, hy - dy * 0.6, 0.9, 0.9, HORN);
}
function wornJambiya(c, J, big) {                 // الجنبية في الحزام
  const a = J.pl, o = add(J.hip, rot(0.6, -1.3, a)), s = big ? 1.3 : 1;
  c.beginPath(); c.moveTo(o[0], o[1] - 1.4 * s); c.quadraticCurveTo(o[0] + 0.4 * s, o[1] + 1.8 * s, o[0] + 2.2 * s, o[1] + 1.4 * s);
  c.strokeStyle = GOLD; c.lineWidth = 1.6 * s; c.lineCap = 'round'; c.stroke();
  ell(c, o[0], o[1] - 1.8 * s, 0.8 * s, 0.8 * s, HORN);
}
function censer(c, J, lite) {                     // مبخرة اللبان (المبسّطة)
  const h = J.handF;
  limb(c, h[0], h[1], h[0] + 0.4, h[1] + 3.2, 0.4, '#8a7a5a'); ell(c, h[0] + 0.4, h[1] + 4, 1.6, 1, '#b8913a');
  c.beginPath(); c.arc(h[0] + 0.4, h[1] + 3.4, 1.2, Math.PI, 0); c.fillStyle = '#a07a2e'; c.fill();
}
// المبخرة المخرّمة (skins-v6): سلسلتان، وجسم نحاسي بقضبان، وغطاء مقبب، ووهج الجمر، وخيط دخان
function filigreeCenser(c, J) {
  const h = J.handF, X = h[0] + 0.4, Y = h[1] + 4.2;
  c.beginPath(); c.moveTo(h[0], h[1]); c.lineTo(X - 0.6, Y - 2.2); c.moveTo(h[0], h[1]); c.lineTo(X + 0.6, Y - 2.2);
  c.strokeStyle = '#b8913a'; c.lineWidth = 0.35; c.stroke();
  if (!STYLE.on) { ell(c, X, Y, 1.6, 1, '#b8913a'); return; }
  rrect(c, X - 1.3, Y - 1.8, 2.6, 3.2, 0.5, GOLD);
  c.beginPath();
  for (let k = 0; k < 3; k++) { c.moveTo(X - 0.8 + k * 0.8, Y - 1.5); c.lineTo(X - 0.8 + k * 0.8, Y + 1.1); }
  c.moveTo(X - 1.3, Y - 0.2); c.lineTo(X + 1.3, Y - 0.2);
  c.strokeStyle = '#6a4a1a'; c.lineWidth = 0.35; c.stroke();
  c.beginPath(); c.arc(X, Y - 1.8, 1.3, Math.PI, 0); c.fillStyle = BRASS; c.fill();
  dot(c, X, Y - 3.2, 0.4, BRASS);
  ell(c, X, Y + 1.6, 1.5, 0.5, '#a07a2e');
  glowAt(c, X, Y, 2.4, 'rgba(255,190,90,0.6)');
  smokeWisp(c, X, Y - 3.4);
}
// صولجان ملكة سبأ (skins-v6): عصا ذهبية بحلقتين، وحلقة في رأسها حول جوهرة حمراء وأربع حبات ذهبية
function scepter(c, J, p, lite) {
  const s = staff(c, J, p, 6, 6, 1.1, GOLD);
  if (lite) { dot(c, s.bx, s.by, 2, GOLD); return; }
  staffBands(c, [0.2, 0.5], '#a07a2e');
  const x = s.bx, y = s.by;
  c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.strokeStyle = GOLD; c.lineWidth = 0.9; c.stroke();
  dot(c, x, y, 1.2, '#c8322c'); dot(c, x - 0.35, y - 0.4, 0.35, '#ff9a90');
  c.beginPath();
  for (let k = 0; k < 4; k++) { const bx = x + Math.cos(k * Math.PI / 2) * 2.2, by = y + Math.sin(k * Math.PI / 2) * 2.2; c.moveTo(bx + 0.45, by); c.arc(bx, by, 0.45, 0, TAU); }
  c.fillStyle = GOLD; c.fill();
}
// المقلاع الحبلي v2: حبلان منحنيان إلى جيب جلدي يتدلى تحت اليد وفيه الحجر (يختفي لحظة الرمي).
// المبسّطة: الحجر وحده
function sling(c, J, p, lite) {
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), hx = J.handF[0], hy = J.handF[1];
  const qx = hx + dx * 1.2 - dy * 4.6, qy = hy + dy * 1.2 + dx * 4.6;
  const sx = qx + dx * 0.35 + dy * 0.3, sy = qy + dy * 0.35 - dx * 0.3;
  if (lite) { if (!p.thrown) dot(c, sx, sy, 0.95, '#8a857c'); return; }
  const cx = hx - dy * 2.4 + dx * 1.8, cy = hy + dx * 2.4 + dy * 1.8;
  c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(cx, cy, qx, qy); c.strokeStyle = '#a88a5a'; c.lineWidth = 0.45; c.stroke();
  c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(cx + dx * 0.7, cy + dy * 0.7, qx + dx * 0.7, qy + dy * 0.7); c.strokeStyle = '#8a6c44'; c.stroke();
  ell(c, qx + dx * 0.35, qy + dy * 0.35, 1.5, 1, '#6a4a2c');
  if (!p.thrown) dot(c, sx, sy, 0.95, '#8a857c');
}
// القوس v2: طرفان منحنيان للأمام ومقبض ورأسان ذهبيان، بشد الوتر حتى اليد الخلفية عند الرمي كقوس اللعبة
// (خارج الرمي يُحمل شبه قائم)، وعلى الوتر arrows سهام (بطل الرماة ثلاثة) وs حجمه. المبسّطة: القوس والوتر خطان
function bow2(c, J, p, lite, arrows = 1, s = 1) {
  const aim = p.pull === undefined ? p.wa * 0.4 : p.wa, pull = p.pull || 0, hx = J.handF[0], hy = J.handF[1];
  const ca = Math.cos(aim) / s, sa = Math.sin(aim) / s, tx = 0.2 - pull * 1.4;
  c.save(); c.translate(hx, hy); c.rotate(aim); if (s !== 1) c.scale(s, s);
  c.beginPath(); c.moveTo(tx, -7); c.quadraticCurveTo(3.6, -3, 1.4, 0); c.quadraticCurveTo(3.6, 3, tx, 7);
  if (!lite) { c.strokeStyle = '#4a2e1c'; c.lineWidth = 1.7; c.stroke(); }
  c.strokeStyle = LEATHER; c.lineWidth = lite ? 1.4 : 1.1; c.stroke();
  if (!lite) {
    rrect(c, 0.6, -1.2, 1.6, 2.4, 0.4, '#3a2418');
    c.beginPath(); c.moveTo(tx + 0.6, -7); c.arc(tx, -7, 0.6, 0, TAU); c.moveTo(tx + 0.6, 7); c.arc(tx, 7, 0.6, 0, TAU);
    c.fillStyle = BRASS; c.fill();
  }
  // الوتر: مشدود إلى اليد الخلفية، أو مستقيم خلف الطرفين
  const sx = tx - 0.9;
  let nx = sx, ny = 0;
  if (pull > 0.05) { const bx = J.handB[0] - hx, by = J.handB[1] - hy; nx = bx * ca + by * sa; ny = -bx * sa + by * ca; }
  c.beginPath(); c.moveTo(sx, -6.8); c.lineTo(nx, ny); c.lineTo(sx, 6.8);
  c.strokeStyle = '#f2efe6'; c.lineWidth = lite ? 0.4 : 0.3; c.stroke();
  if (pull > 0.2) {
    c.beginPath();
    for (let k = 0; k < arrows; k++) { const o = (k - (arrows - 1) / 2) * 0.9; c.moveTo(nx, ny + o * 0.4); c.lineTo(3.8, o); }
    c.strokeStyle = '#d9d3c6'; c.lineWidth = 0.8; c.stroke();
  }
  c.restore();
}
// قِدر النار v2: قِدر فخاري بحزامين وعنق وفوهة ومقبض، ولهب بطبقات (يختفي لحظة الرمي).
// المبسّطة: القِدر ولسان لهب واحد
function firePot(c, J, p, lite) {
  if (p.thrown) return;
  const qx = J.handF[0] + Math.cos(p.wa) * 1.4, qy = J.handF[1] + Math.sin(p.wa) * 1.4;
  ell(c, qx, qy + 0.2, 2.2, 2.5, '#b0683a');
  if (lite) { tri(c, [qx - 1.2, qy - 3.2], [qx, qy - 6.8], [qx + 1.2, qy - 3.2], '#f0902a'); return; }
  limb(c, qx - 1.9, qy - 0.4, qx + 1.9, qy - 0.4, 0.5, '#7a4426'); limb(c, qx - 1.6, qy + 1.2, qx + 1.6, qy + 1.2, 0.35, '#d08a5a');
  rrect(c, qx - 1, qy - 3.2, 2, 1.4, 0.3, '#8e5230'); ell(c, qx, qy - 3.2, 1.1, 0.45, '#2a1810');
  c.beginPath(); c.moveTo(qx - 1.9, qy - 0.6); c.quadraticCurveTo(qx, qy - 5, qx + 1.9, qy - 0.6); c.strokeStyle = '#8a6c44'; c.lineWidth = 0.4; c.stroke();
  flame(c, qx, qy - 3.4, 1);
}
// حقيبة جلدية على الحزام (السعودية v2)
function pouch(c, J, side) {
  const P = add(J.hip, rot(side, -0.6, J.pl));
  rrect(c, P[0] - 1.6, P[1] - 0.4, 3.2, 2.8, 0.5, LEATHER); rrect(c, P[0] - 1.6, P[1] - 0.4, 3.2, 1.2, 0.4, '#8e6240'); dot(c, P[0], P[1] + 0.6, 0.35, BRASS);
}
// حزام الكتف المائل بإبزيم نحاسي (القوّاس)
function shoulderStrap(c, J) {
  const A = add(J.chest, rot(1.8, -0.6, J.a2)), B = add(J.hip, rot(-2.4, -0.6, J.pl));
  limb(c, A[0], A[1], B[0], B[1], 1.2, '#5a3a22'); limb(c, A[0], A[1], B[0], B[1], 0.8, LEATHER);
  const K = lp(A, B, 0.35); rrect(c, K[0] - 0.6, K[1] - 0.6, 1.2, 1.2, 0.2, BRASS);
}
// جعبة القوّاس v2: جلد بحافة داكنة وشريط نحاسي، وأربعة سهام بريش أبيض متناوب. المبسّطة: الجعبة وحدها
function archerQuiver(c, J, lite) {
  const A = add(J.chest, rot(-1.4, -2.6, J.a2)), B = add(J.mid, rot(-2.4, 1.8, J.pl));
  if (lite) { limb(c, A[0], A[1], B[0], B[1], 2.1, LEATHER); return; }
  limb(c, A[0], A[1], B[0], B[1], 2.6, '#4a2e1c'); limb(c, A[0], A[1], B[0], B[1], 2.1, LEATHER);
  const P = lp(A, B, 0.15); limb(c, P[0], P[1], P[0] + 0.8, P[1] - 0.4, 1.2, BRASS);
  c.beginPath();
  for (let k = 0; k < 4; k++) { const sx = A[0] - 1 + k * 0.65, sy = A[1] - 0.2; c.moveTo(sx, sy); c.lineTo(sx + 0.3, sy - 1.2); }
  c.strokeStyle = '#6a4a2c'; c.lineWidth = 0.35; c.stroke();
  for (let m = 0; m < 2; m++) {
    c.beginPath();
    for (let k = m; k < 4; k += 2) { const sx = A[0] - 1 + k * 0.65, sy = A[1] - 0.2; c.moveTo(sx - 0.5, sy - 1.2); c.lineTo(sx + 0.35, sy - 3.4); c.lineTo(sx + 0.9, sy - 1.2); c.closePath(); }
    c.fillStyle = m ? '#f2efe6' : '#e0dacb'; c.fill();
  }
}
// الصقر المفصّل (السعودية v2): ذيل مخطط، وجسد وصدر مرقّط، وجناح بخطوط، ورأس بخد وشارب وعين وأنف معقوف، ومخالب
function falcon(c, x, y) {
  c.save(); c.translate(x, y);
  pg(c, [[-0.6, 2], [-2.8, 5.6], [-1.4, 5.8], [0.6, 2.4]], '#5a3e28');
  c.beginPath(); for (let k = 0; k < 3; k++) { c.moveTo(-1.2 - k * 0.5, 3.2 + k * 0.8); c.lineTo(-0.2 - k * 0.4, 3.4 + k * 0.8); }
  c.strokeStyle = '#d8c8a8'; c.lineWidth = 0.3; c.stroke();
  ell(c, 0, 0, 1.9, 2.7, '#7a5a3e'); ell(c, 0.5, 0.4, 1.1, 1.8, '#efe6d2');
  c.beginPath(); for (let k = 0; k < 6; k++) { const sx = 0.2 + (k % 2) * 0.7, sy = -0.4 + k * 0.45; c.moveTo(sx + 0.18, sy); c.arc(sx, sy, 0.18, 0, TAU); }
  c.fillStyle = '#6a4a2e'; c.fill();
  pg(c, [[-1.6, -1.4], [0.4, -1], [-0.2, 2.6], [-2.2, 2.2]], '#5e4430');
  c.beginPath(); for (let k = 0; k < 3; k++) { c.moveTo(-1.8 + k * 0.5, -0.6 + k * 0.9); c.lineTo(-0.4 + k * 0.4, -0.2 + k * 0.9); }
  c.strokeStyle = '#3e2a1a'; c.lineWidth = 0.3; c.stroke();
  dot(c, 0.7, -3, 1.45, '#6a4a2e'); ell(c, 1.1, -2.5, 0.9, 0.7, '#efe6d2'); limb(c, 1, -2.9, 1.2, -2, 0.35, '#2a1a10');
  dot(c, 1.2, -3.2, 0.42, '#f0c040'); dot(c, 1.25, -3.2, 0.22, '#1a1008');
  c.beginPath(); c.moveTo(1.9, -3.2); c.quadraticCurveTo(3.1, -3.1, 2.6, -2.2); c.lineTo(2, -2.6); c.closePath(); c.fillStyle = '#e8c040'; c.fill();
  dot(c, 2.5, -2.4, 0.18, '#3a3a3a');
  c.beginPath(); c.moveTo(-0.4, 2.4); c.lineTo(-0.2, 3.2); c.moveTo(0.6, 2.5); c.lineTo(0.8, 3.3);
  c.strokeStyle = '#e8c040'; c.lineWidth = 0.4; c.stroke();
  c.restore();
}
// قفاز الصقّار والصقر عليه: عند اليد عادةً، وأقرب إلى المرفق حين يمسك القوس.
// الكاملة: قفاز جلدي بحافة وشريط نحاسي وشرّابة ذهبية والصقر المفصّل؛ المبسّطة: القفاز وصقر بسيط
function falconArm(c, J, p, withFalcon, lite) {
  const e = J.elbowF, h = J.handF, at = p.pull === undefined ? h : lp(e, h, 0.4);
  if (!lite) {
    limb(c, e[0], e[1], h[0], h[1], 3.4, '#4a2e1c'); limb(c, e[0], e[1], h[0], h[1], 2.8, LEATHER);
    const P = lp(e, h, 0.2); limb(c, P[0], P[1], P[0] + 0.4, P[1] + 1.2, 0.5, BRASS);
    const T = lp(e, h, 0.55); limb(c, T[0], T[1] + 1, T[0] - 0.2, T[1] + 3.6, 0.4, BRASS); ell(c, T[0] - 0.2, T[1] + 4.4, 0.6, 1, BRASS);
    if (withFalcon) falcon(c, at[0] + 0.2, at[1] - 2.6);
    return;
  }
  limb(c, e[0], e[1], h[0], h[1], 2.6, '#7a5a36');
  if (!withFalcon) return;
  c.save(); c.translate(at[0], at[1] - 2.4);
  ell(c, 0, 0, 1.7, 2.5, '#7a5a3e');
  circ(c, [0.7, -2.6], 1.3, '#5a3e28');
  tri(c, [1.8, -2.8], [2.9, -2.4], [1.8, -2.1], '#e0b24a');
  c.restore();
}

// ---------- اليمن «أبناء سبأ» (نمط الحشد) ----------
function yemen(lite) {
  return {
    common: { sx: 0.98, sy: 1.02, lw: 2.9, headR: 3.5, wlen: 4.4, legFrom: lite ? 0.5 : 0,
      head: (c, p, col) => imama(c, col, false, lite),
      robe(c, J, p, col) {
        robe(c, J, 0.5, izarCol(col), lite ? null : edgeCol(col), 'waist', 1.2);
        if (lite) return;
        stripes(c, [0.55, 0.8], [IND, GOLD], 0.8);
        hemBand(c, 0.86, 0.98, IND); hemZig(c, GOLD, 0.92, 6, 1);
      },
      over: lite ? undefined : (c, J) => { belt(c, J, '#7a5a36', 1.6); wornJambiya(c, J); },
      weapon: (c, J, p) => jambiya(c, J, p, 4.4, lite) },
    boss: { sx: 0.98, sy: 1.04, lw: 2.9, headR: 3.5, wlen: 5.2, legFrom: lite ? 0.62 : 0,
      ground: auraRing,
      head: (c, p, col) => imama(c, col, true, lite),
      back(c, J) { pg(c, [add(J.chest, rot(-2.2, 0, J.a2)), add(J.chest, rot(1.6, 0, J.a2)), add(J.mid, rot(-1, 1.6, J.pl)), add(J.mid, rot(-4.6, 2.4, J.pl))], IND); },
      robe(c, J, p, col) {
        robe(c, J, 0.62, izarCol(col), lite ? null : edgeCol(col), 'waist', 1.4);
        if (lite) return;
        stripes(c, [0.5, 0.72, 0.9], [IND, GOLD, IND], 0.8);
        hemBand(c, 0.86, 0.98, IND); hemZig(c, GOLD, 0.92, 7, 1.1); apron(c, IND, GOLD);
      },
      over: lite ? undefined : (c, J) => { belt(c, J, GOLD, 2.2); wornJambiya(c, J, true); },
      weapon(c, J, p) { jambiya(c, J, p, 5.2, lite); if (!lite) dot(c, J.handF[0], J.handF[1], 0.55, '#b8322c'); } },
    medic: { sx: 0.98, sy: 1.02, lw: 2.8, headR: 3.5, wlen: 1.6, legFrom: lite ? 0.86 : 0,
      head: (c, p, col) => imama(c, col, false, lite),
      robe(c, J, p, col) {
        robe(c, J, 0.86, lt55(col), lite ? null : edgeCol(col), 'chest', 1.4);
        if (!lite) { hemBand(c, 0.9, 0.99, IND); hemZig(c, GOLD, 0.94, 7, 1); }
      },
      over: lite ? undefined : (c, J) => {
        const A = add(J.chest, rot(1.8, 0.4, J.a2)), B = add(J.hip, rot(-2.2, 0.4, J.pl));
        limb(c, A[0], A[1], B[0], B[1], 0.8, '#6a4a30'); rrect(c, B[0] - 1.6, B[1] - 0.6, 3, 2.6, 0.6, '#8a6a44');
        ell(c, B[0] - 0.8, B[1] - 1.6, 0.5, 1.1, '#5f8a3a'); ell(c, B[0] + 0.2, B[1] - 2.2, 0.5, 1.1, '#4d7a30'); ell(c, B[0] + 1, B[1] - 1.4, 0.5, 1.1, '#6f9a44');
      },
      weapon: (c, J) => { if (lite) censer(c, J, true); else filigreeCenser(c, J); } },
    champion: { sx: 1.0, sy: 1.08, lw: 3.0, headR: 3.5, wlen: 6, legFrom: lite ? 0.96 : 0,
      ground: auraHealRings,
      head: (c) => queenCrown(c, lite),
      back(c, J) {                               // عباءة طويلة نيلية بحافة ذهبية
        const P = lp(J.legB.k, J.legB.f, 0.9);
        pg(c, [add(J.chest, rot(-2.2, -0.4, J.a2)), add(J.chest, rot(1, 0, J.a2)), P, [P[0] - 5, P[1]]], IND, lite ? null : GOLD, 0.8);
      },
      robe(c, J, p, col) {
        robe(c, J, 0.96, lt45(col), lite ? null : edgeCol(col), 'chest', 2.2);
        if (lite) return;
        stripes(c, [0.93], [GOLD], 1.1);
        apron(c, IND, GOLD); hemZig(c, GOLD, 0.86, 8, 1.2);
      },
      over: lite ? undefined : (c, J) => belt(c, J, GOLD, 1.6),
      weapon: (c, J, p) => scepter(c, J, p, lite) }
  };
}

// ---------- السعودية «حراس القوافل» (نمط الرامي) ----------
const thobe = (c, J, col, len, lite) => robe(c, J, len || 0.9, thobeCol(col), lite ? null : edgeSoft(col), 'chest', 1.3);
function saudi(lite) {
  const falconer = (withFalcon) => ({ sx: 1.0, sy: 1.06, lw: 3.0, headR: 3.5, wlen: 2, legFrom: lite ? 0.92 : 0,
    ground: heroRing,
    head: (c) => shemagh(c, false, lite),
    back(c, J) {                                 // البشت
      const hb = lp(J.legB.k, J.legB.f, 0.75);
      pg(c, [add(J.chest, rot(-2.8, -0.6, J.a2)), add(J.chest, rot(1.4, -0.4, J.a2)), [hb[0] + 1, hb[1]], [hb[0] - 4.8, hb[1]]], '#5a3e28', lite ? null : GOLD, 0.9);
    },
    robe: (c, J, p, col) => thobe(c, J, col, 0.92, lite),
    over: lite ? undefined : (c, J) => {
      const A = add(J.chest, rot(1.9, 0.2, J.a2)), B = add(J.hip, rot(2.6, -1, J.pl));
      limb(c, A[0], A[1], B[0], B[1], 1.2, '#5a3e28'); limb(c, A[0], A[1], B[0], B[1], 0.5, GOLD); belt(c, J, LEATHER, 1.4);
    },
    // قواعد بطل الرماة كما هي (ثلاثة سهام في الرمية): القوس في يده أثناء الرمي فقط
    weapon(c, J, p) { if (p.pull !== undefined) bow2(c, J, p, lite, 3, 1.2); },
    front: (c, J, p) => falconArm(c, J, p, withFalcon, lite) });
  return {
    common: { sx: 0.97, sy: 1.03, lw: 2.8, headR: 3.5, wlen: 1.5, legFrom: lite ? 0.9 : 0,
      head: (c) => shemagh(c, false, lite),
      robe: (c, J, p, col) => thobe(c, J, col, 0, lite),
      over: lite ? undefined : (c, J) => { belt(c, J, LEATHER, 1.3); pouch(c, J, 2.2); },
      weapon: (c, J, p) => sling(c, J, p, lite) },
    sniper: { sx: 0.97, sy: 1.04, lw: 2.8, headR: 3.5, wlen: 2, legFrom: lite ? 0.82 : 0,
      head: (c) => shemagh(c, false, lite),
      robe: (c, J, p, col) => thobe(c, J, col, 0.82, lite),
      back: (c, J) => archerQuiver(c, J, lite),
      over: lite ? undefined : (c, J) => { belt(c, J, LEATHER, 1.3); shoulderStrap(c, J); },
      weapon: (c, J, p) => bow2(c, J, p, lite) },
    firebomber: { sx: 0.98, sy: 1.02, lw: 2.9, headR: 3.5, wlen: 2, legFrom: lite ? 0.78 : 0,
      head: (c) => shemagh(c, true, lite),
      robe: (c, J, p, col) => thobe(c, J, col, 0.78, lite),
      over(c, J) {                               // مئزر جلدي، وفي الكاملة حزام وحقيبة
        const a = J.pl, A = add(J.hip, rot(-1.6, -1.4, a)), B = add(J.hip, rot(2.8, -1.4, a)), hf = legPt(J.legF, 0.62);
        pg(c, [A, B, [hf[0] + 1.2, hf[1]], [hf[0] - 2.4, hf[1] + 0.4]], '#6a4a30');
        if (!lite) { belt(c, J, LEATHER, 1.3); pouch(c, J, -1.8); }
      },
      weapon: (c, J, p) => firePot(c, J, p, lite) },
    champion: falconer(true),
    champion_away: falconer(false)
  };
}

// ---------- مصر «فتوات الحارة» (نمط الصامد) ----------
const galab = (c, J, col, len, lite) => robe(c, J, len || 0.88, galabCol(col), lite ? null : edgeSoft(col), 'chest', 1.5);
const BRASS_EG = '#c9a04a';
function egypt(lite) {
  return {
    common: { sx: 0.98, sy: 1.0, lw: 2.9, headR: 3.5, wlen: 8, legFrom: lite ? 0.88 : 0,
      head: (c) => turbanEg(c, lite),
      robe: (c, J, p, col) => galab(c, J, col, 0, lite),
      over: lite ? undefined : (c, J) => {       // شال على الكتف
        const A = add(J.chest, rot(-2, 0.2, J.a2)), B = add(J.hip, rot(2.4, -1.4, J.pl));
        limb(c, A[0], A[1], B[0], B[1], 1.6, '#d9c9a8');
      },
      weapon(c, J, p) {                          // النبّوت بحلقتين نحاسيتين
        const s = staff(c, J, p, 3.5, 8, 1.6, WOODD);
        if (lite) return;
        dot(c, s.bx, s.by, 1, '#4a3422'); staffBands(c, [0.12, 0.86], BRASS_EG);
      } },
    armored: { sx: 0.98, sy: 0.98, lw: 2.9, headR: 3.5, wlen: 3, legFrom: lite ? 0.6 : 0,
      head: (c) => turbanEg(c, lite),
      robe: (c, J, p, col) => galab(c, J, col, 0.6, lite),
      over: lite ? undefined : (c, J) => belt(c, J, '#5a3a22', 1.8),
      front(c, J) {                              // درع خشبي مستدير، وفي الكاملة إطار نحاسي ومسامير
        const ox = J.handF[0] + 1.2, oy = J.handF[1];
        dot(c, ox, oy, 5.4, '#5a3a22'); dot(c, ox, oy, 4.6, '#8a5a36');
        if (!lite) {
          c.beginPath();
          for (let k = 0; k < 8; k++) {
            const ca = Math.cos(k * 0.785), sa = Math.sin(k * 0.785);
            c.moveTo(ox + ca * 1.6, oy + sa * 1.6); c.lineTo(ox + ca * 4.2, oy + sa * 4.2);
          }
          c.strokeStyle = '#6e4428'; c.lineWidth = 0.4; c.lineCap = 'round'; c.stroke();
        }
        dot(c, ox, oy, 1.3, GOLD);
        if (lite) return;
        c.beginPath(); c.arc(ox, oy, 5.1, 0, TAU); c.strokeStyle = BRASS_EG; c.lineWidth = 0.8; c.stroke();
        c.beginPath();
        for (let k = 0; k < 10; k++) { const x = ox + Math.cos(k * 0.628) * 4.6, y = oy + Math.sin(k * 0.628) * 4.6; c.moveTo(x + 0.3, y); c.arc(x, y, 0.3, 0, TAU); }
        c.fillStyle = '#e0c070'; c.fill();
      } },
    smasher: { sx: 0.98, sy: 1.0, lw: 2.9, headR: 3.5, wlen: 9.5, twoH: true, tipLen: 9.5, butt: 4.5, legFrom: lite ? 0.56 : 0,
      head(c) { c.beginPath(); c.arc(0, -0.6, 3.6, Math.PI, 0); c.fillStyle = '#efe6d2'; c.fill(); },
      robe: (c, J, p, col) => galab(c, J, col, 0.56, lite),
      over: lite ? undefined : (c, J) => belt(c, J, '#5a3a22', 2),
      weapon(c, J, p) {                          // النبّوت الكبير بحلقتين حديديتين وحلقة نحاسية عند مؤخرته
        const s = staff(c, J, p, 4.5, 9.5, 2.4, '#5e432b');
        if (lite) return;
        const nx = -s.dy * 1.3, ny = s.dx * 1.3;
        c.beginPath();
        for (const t of [0.85, 0.75]) {
          const rx = s.ax + (s.bx - s.ax) * t, ry = s.ay + (s.by - s.ay) * t;
          c.moveTo(rx - nx, ry - ny); c.lineTo(rx + nx, ry + ny);
        }
        c.strokeStyle = '#5a5f66'; c.lineWidth = 0.9; c.lineCap = 'round'; c.stroke();
        staffBands(c, [0.08], BRASS_EG);
      } },
    champion: { sx: 1.0, sy: 1.04, lw: 3.0, headR: 3.5, wlen: 6.5, legFrom: lite ? 0.9 : 0,
      ground: heroRing,
      head: (c) => fez(c, lite),
      robe: (c, J, p, col) => galab(c, J, col, 0.9, lite),
      over(c, J) {                               // صديري وأزرار ذهبية وشال
        const a = J.pl;
        pg(c, [add(J.chest, rot(-2, 0.4, J.a2)), add(J.chest, rot(2.2, 0.4, J.a2)), add(J.hip, rot(2.6, -1.6, a)), add(J.hip, rot(-2.2, -1.6, a))], '#2f3a2e');
        if (lite) return;
        const A = add(J.chest, rot(1.8, 1.2, J.a2)), B = add(J.hip, rot(2.2, -2.2, a));
        c.beginPath();
        for (let k = 0; k < 3; k++) { const P = lp(A, B, k / 2.2); c.moveTo(P[0] + 0.4, P[1]); c.arc(P[0], P[1], 0.4, 0, TAU); }
        c.fillStyle = GOLD; c.fill();
        const S = add(J.chest, rot(-2.2, 0, J.a2)), E = lp(J.legB.h, J.legB.k, 0.9);
        limb(c, S[0], S[1], E[0] - 1, E[1], 1.4, '#d9c9a8');
      },
      weapon(c, J, p) {
        const s = staff(c, J, p, 5, 6.5, 1.5, '#4a3422'); dot(c, s.bx, s.by, 1.5, GOLD);
        if (!lite) staffBands(c, [0.3, 0.82], BRASS_EG);
      } }
  };
}

// التسجيل: لكل نوع نسختان (الكاملة والمبسّطة)
registerNation('yemen', both(yemen));
registerNation('saudi', both(saudi));
registerNation('egypt', both(egypt));
