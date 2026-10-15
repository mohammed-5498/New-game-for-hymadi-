/* مظاهر الأمم (القسم 3.10): سجل واحد لكل الأمم. كل وحدة = نمطها القتالي + إكسسوارات فوق drawBody
   (head وback وchest وrobe وover وweapon وfront وground كما في bodies.js). لون اللاعب يبقى لون الجسد،
   والهوية من غطاء الرأس وشكل الثوب والسلاح ولون ثانوي ثابت للأمة.
   لكل وحدة نسختان: الكاملة، والمبسّطة للمستوى المبسّط (القسم 5.4.5): الجسد وغطاء الرأس وشكل الثوب
   والسلاح فقط، بلا خطوط ولا نقوش صغيرة.
   أدوات الرسم المشتركة هنا منقولة من docs/nations/batch1-skins.js (تتكرر في الدفعات الأخرى)،
   وتعريفات كل دفعة في ملفها (nationsArab.js للدفعة العربية). */
import { BODIES } from './bodies.js';
import { PERFORMANCE } from '../config.js';
import { limb } from './anim.js';

// أمة ← نوع الوحدة (common، الشخصيتان المميزتان، champion، و'<نوع>_away') ← [مفتاح الكامل، مفتاح المبسّط]
export const NATION_ART = {};

// تسجيل مظاهر أمة: units = { common: {full, lite}, boss: {full, lite}, ..., champion: {full, lite} }
// المفاتيح في BODIES: '<أمة>_<نوع>' و'<أمة>_<نوع>_lite'. نقاط الساقين لازمة لكل مظهر أمة (legs)
// النوع '<نوع>_away': نفس الوحدة وقد غاب عنها شيء مؤقتاً (صقر الصقّار في انقضاضه، unit.awayUntil)
export function registerNation(id, units) {
  const art = {};
  for (const [kind, { full, lite }] of Object.entries(units)) {
    const key = id + '_' + kind;
    BODIES[key] = { legs: true, ...full };
    BODIES[key + '_lite'] = { legs: true, ...(lite || full) };
    art[kind] = [key, key + '_lite'];
  }
  NATION_ART[id] = art;
}

// مفتاح رسم وحدة الأمة حسب مستوى تفصيلها، أو null (عصابة كلاسيكية أو أمة بلا مظهر بعد)
// النسخة الكاملة لوحدات المستوى الكامل حين تكون الكاميرا قريبة بما يكفي لرؤية تفاصيلها
export function nationArtKey(unit, kind, time, zoom) {
  const art = NATION_ART[unit.nation];
  if (!art) return null;
  const away = unit.awayUntil > time ? art[kind + '_away'] : null;
  const keys = away || art[kind] || art.common;
  return unit.lod === 'full' && zoom >= PERFORMANCE.nationFullZoom ? keys[0] : keys[1];
}

// ---------- ألوان ----------
const hx2 = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
export function mixHex(a, b, t) {
  const A = hx2(a), B = hx2(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
// لون مشتق من لون اللاعب يُحسب مرة لكل لون لا في كل إطار (الرسم يطلبه لكل وحدة في كل إطار)
export function memo(fn) {
  const cache = new Map();
  return (col) => {
    let v = cache.get(col);
    if (v === undefined) { v = fn(col); cache.set(col, v); }
    return v;
  };
}
export const GOLD = '#c9a04a';

// ---------- أدوات الرسم المشتركة (من batch1-skins.js) ----------
// تُرسم مئات الوحدات في كل إطار: الأدوات تحسب نقاطها أعداداً مباشرة بلا مصفوفات جديدة،
// والأشكال بلون واحد تُجمع في مسار واحد ورسمة واحدة (نفس الشكل تماماً بأوامر أقل)
export const lp = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
export function pg(c, pts, f, st, w) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath(); c.fillStyle = f; c.fill();
  if (st) { c.strokeStyle = st; c.lineWidth = w || 0.5; c.stroke(); }
}
export function circ(c, P, r, f) { c.beginPath(); c.arc(P[0], P[1], r, 0, 6.2831853); c.fillStyle = f; c.fill(); }
// نقطة على الساق: 0 الورك، 0.5 الركبة، 1 القدم
export function legPt(L, t) { return t <= 0.5 ? lp(L.h, L.k, t / 0.5) : lp(L.k, L.f, (t - 0.5) / 0.5); }

// نقاط آخر ثوب رُسم (الخصر والحاشية): كائن ثابت يُعاد ملؤه، تقرؤه stripes بعد robe مباشرة
const RB = { w1x: 0, w1y: 0, w2x: 0, w2y: 0, fx: 0, fy: 0, bx: 0, by: 0 };
let HX = 0, HY = 0;
function hemOf(L, t, fl) {          // نقطة الحاشية على الساق L عند t مزاحة أفقياً fl، في HX وHY
  const A = t <= 0.5 ? L.h : L.k, B = t <= 0.5 ? L.k : L.f, u = t <= 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  HX = A[0] + (B[0] - A[0]) * u + fl; HY = A[1] + (B[1] - A[1]) * u;
}
// ثوب يتمايل مع الساقين: top='chest' ثوب كامل، top='waist' إزار. edge: حدّه (لا حدّ في المستوى المبسّط)
export function robe(c, J, len, fill, edge, top, flare) {
  const fl = flare == null ? 1.6 : flare, ca = Math.cos(J.pl), sa = Math.sin(J.pl), hx = J.hip[0], hy = J.hip[1];
  RB.w1x = hx - 2.4 * ca + 1.1 * sa; RB.w1y = hy - 2.4 * sa - 1.1 * ca;    // add(J.hip, rot(-2.4, -1.1, J.pl))
  RB.w2x = hx + 2.6 * ca + 1.1 * sa; RB.w2y = hy + 2.6 * sa - 1.1 * ca;    // add(J.hip, rot(2.6, -1.1, J.pl))
  hemOf(J.legF, len, fl); RB.fx = HX; RB.fy = HY;
  hemOf(J.legB, len, -fl); RB.bx = HX; RB.by = HY;
  c.beginPath();
  if (top === 'chest') {
    const cb = Math.cos(J.a2), sb = Math.sin(J.a2), cx = J.chest[0], cy = J.chest[1];
    c.moveTo(cx - 2.1 * cb - 0.5 * sb, cy - 2.1 * sb + 0.5 * cb);           // add(J.chest, rot(-2.1, 0.5, J.a2))
    c.lineTo(cx + 2.3 * cb - 0.5 * sb, cy + 2.3 * sb + 0.5 * cb);           // add(J.chest, rot(2.3, 0.5, J.a2))
    c.lineTo(RB.w2x, RB.w2y);
  } else {
    c.moveTo(RB.w1x, RB.w1y); c.lineTo(RB.w2x, RB.w2y);
  }
  c.lineTo(RB.fx, RB.fy); c.lineTo(RB.bx, RB.by);
  if (top === 'chest') c.lineTo(RB.w1x, RB.w1y);
  c.closePath(); c.fillStyle = fill; c.fill();
  if (edge) { c.strokeStyle = edge; c.lineWidth = 0.5; c.stroke(); }
  return RB;
}
// خطوط عرضية على آخر ثوب (إزار مخطط، حاشية): ts مواضعها من الخصر إلى الحاشية، والخطوط بلون واحد في رسمة واحدة
export function stripes(c, ts, cols, w) {
  c.lineWidth = w || 0.9; c.lineCap = 'round';
  for (let k = 0; k < cols.length && k < ts.length; k++) {
    c.beginPath();
    for (let i = k; i < ts.length; i += cols.length) {
      const t = ts[i];
      c.moveTo(RB.w1x + (RB.bx - RB.w1x) * t, RB.w1y + (RB.by - RB.w1y) * t);
      c.lineTo(RB.w2x + (RB.fx - RB.w2x) * t, RB.w2y + (RB.fy - RB.w2y) * t);
    }
    c.strokeStyle = cols[k]; c.stroke();
  }
}
export function belt(c, J, col, w) {
  const ca = Math.cos(J.pl), sa = Math.sin(J.pl), hx = J.hip[0], hy = J.hip[1];
  limb(c, hx - 2.5 * ca + 1.3 * sa, hy - 2.5 * sa - 1.3 * ca, hx + 2.7 * ca + 1.3 * sa, hy + 2.7 * sa - 1.3 * ca, w || 1.5, col);
}
// عصا في اليد الأمامية: back خلف اليد وfwd أمامها. تعيد رأسها في SB (كائن ثابت) لمن يرسم عليه مقبضاً
export const SB = { ax: 0, ay: 0, bx: 0, by: 0, dx: 0, dy: 0 };
export function staff(c, J, p, back, fwd, w, col) {
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), hx = J.handF[0], hy = J.handF[1];
  SB.ax = hx - dx * back; SB.ay = hy - dy * back; SB.bx = hx + dx * fwd; SB.by = hy + dy * fwd; SB.dx = dx; SB.dy = dy;
  limb(c, SB.ax, SB.ay, SB.bx, SB.by, w, col);
  return SB;
}
// دائرة ممتلئة بإحداثيين (بلا مصفوفة)
export function dot(c, x, y, r, f) { c.beginPath(); c.arc(x, y, r, 0, 6.2831853); c.fillStyle = f; c.fill(); }
