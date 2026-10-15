/* مظاهر الأمم (القسم 3.10): سجل واحد لكل الأمم. كل وحدة = نمطها القتالي + إكسسوارات فوق drawBody
   (head وback وchest وrobe وover وweapon وfront وground كما في bodies.js). لون اللاعب يبقى لون الجسد،
   والهوية من غطاء الرأس وشكل الثوب والسلاح ولون ثانوي ثابت للأمة.
   لكل وحدة نسختان: الكاملة، والمبسّطة للمستوى المبسّط (القسم 5.4.5): الجسد وغطاء الرأس وشكل الثوب
   والسلاح فقط، بلا خطوط ولا نقوش صغيرة.
   أدوات الرسم المشتركة هنا منقولة من docs/nations/batch1-skins.js (تتكرر في الدفعات الأخرى)،
   وتعريفات كل دفعة في ملفها (nationsArab.js للدفعة العربية). */
import { BODIES, dashedRing } from './bodies.js';
import { PERFORMANCE } from '../config.js';
import { limb } from './anim.js';

// أمة ← نوع الوحدة (common، الشخصيتان المميزتان، champion، و'<نوع>_away') ← [مفتاح الكامل، مفتاح المبسّط]
export const NATION_ART = {};
// أمة ← نوع الوحدة ← شكل مقذوفها وهو يطير، إن اختلف عن نوعه في القواعد (سهم مشتعل بدل الزجاجة)
const NATION_SHOTS = {};

// تسجيل مظاهر أمة: units = { common: {full, lite}, boss: {full, lite}, ..., champion: {full, lite} }
// المفاتيح في BODIES: '<أمة>_<نوع>' و'<أمة>_<نوع>_lite'. نقاط الساقين لازمة لكل مظهر أمة (legs)
// النوع '<نوع>_away': نفس الوحدة وقد غاب عنها شيء مؤقتاً (صقر الصقّار في انقضاضه، unit.awayUntil)
// shots: { <نوع>: شكل المقذوف } (اختياري)، يقرؤه shotLook
export function registerNation(id, units, shots = null) {
  const art = {};
  for (const [kind, { full, lite }] of Object.entries(units)) {
    const key = id + '_' + kind;
    BODIES[key] = { legs: true, ...full };
    BODIES[key + '_lite'] = { legs: true, ...(lite || full) };
    art[kind] = [key, key + '_lite'];
  }
  NATION_ART[id] = art;
  if (shots) NATION_SHOTS[id] = shots;
}

// شكل المقذوف وهو يطير: شكل أمة صاحبه إن كان لها شكل خاص، وإلا نوعه (stone، arrow، bottle...)
// الشكل رسم فقط: القواعد كلها من نوعه (الزجاجة تبقى تشعل الأرض)
export function shotLook(shot) {
  const a = shot.attacker, shots = a && a.nation ? NATION_SHOTS[a.nation] : null;
  if (!shots) return shot.kind;
  return shots[a.champion ? 'champion' : (a.hero || 'common')] || shot.kind;
}

// لكل نوع نسختان: الكاملة (make(false)) والمبسّطة (make(true))
export function both(make) {
  const full = make(false), lite = make(true), out = {};
  for (const kind of Object.keys(full)) out[kind] = { full: full[kind], lite: lite[kind] };
  return out;
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
export const STEEL2 = '#cfd3d8';
export const CREAM = '#efe9dc';

// ---------- علامات النمط عند القدمين (كما في bodies.js) ----------
// هالة الزعيم، وهالتا بطل الحشد (الضرر والعلاج)
export const auraRing = (c, col, t) => { const k = 1 + Math.sin(t * 2.4) * 0.05; dashedRing(c, 10.5 * k, 4.2 * k, 'rgba(240,182,74,0.9)'); };
export const auraHealRings = (c, col, t) => {
  const k = 1 + Math.sin(t * 2.4) * 0.06;
  dashedRing(c, 11.5 * k, 4.6 * k, 'rgba(240,182,74,0.9)'); dashedRing(c, 8.4 * k, 3.4 * k, 'rgba(127,212,138,0.8)');
};

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
// شكل بيضاوي يضاف إلى المسار الجاري (بلا خط يصله بما قبله)
export function ellTo(c, x, y, rx, ry) { c.moveTo(x + rx, y); c.ellipse(x, y, rx, ry, 0, 0, 6.2831853); }
// مثلث يضاف إلى المسار الجاري بدوران الشكل البيضاوي نفسه (مع عقارب الساعة على الشاشة):
// أشكال متداخلة بدوران معاكس في مسار واحد يصير تداخلها ثقباً (قاعدة الملء nonzero)
export function triTo(c, ax, ay, bx, by, dx, dy) {
  if ((bx - ax) * (dy - ay) - (by - ay) * (dx - ax) < 0) { c.moveTo(ax, ay); c.lineTo(dx, dy); c.lineTo(bx, by); }
  else { c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(dx, dy); }
  c.closePath();
}

// نقطة على الجسد: (x, y) مدوّرة بالزاوية a حول O، في PT (كائن ثابت يُعاد ملؤه، بلا مصفوفة جديدة)
export const PT = { x: 0, y: 0 };
export function at(O, x, y, a) {
  const ca = Math.cos(a), sa = Math.sin(a);
  PT.x = O[0] + x * ca - y * sa; PT.y = O[1] + x * sa + y * ca;
  return PT;
}

// لوح على الجذع (قميص، صديري، درع صدر) من الكتفين إلى الحوض، كما في torso بالدفعات 3 و4 و5.
// inset يضيّقه من الجانبين. زواياه الأربع في out (TB افتراضياً): 0 أعلى الخلف، 1 أعلى الأمام، 2 أسفل الأمام، 3 أسفل الخلف
export const TB = { x0: 0, y0: 0, x1: 0, y1: 0, x2: 0, y2: 0, x3: 0, y3: 0 };
export function torso(c, J, fill, st, inset, out) {
  const i = inset || 0, T = out || TB;
  const ca = Math.cos(J.a2), sa = Math.sin(J.a2), cb = Math.cos(J.pl), sb = Math.sin(J.pl);
  const cx = J.chest[0], cy = J.chest[1], hx = J.hip[0], hy = J.hip[1];
  T.x0 = cx + (-2.2 + i) * ca + 0.2 * sa; T.y0 = cy + (-2.2 + i) * sa - 0.2 * ca;     // add(J.chest, rot(-2.2+i, -0.2, a2))
  T.x1 = cx + (2.4 - i) * ca + 0.2 * sa;  T.y1 = cy + (2.4 - i) * sa - 0.2 * ca;      // add(J.chest, rot(2.4-i, -0.2, a2))
  T.x2 = hx + (2.6 - i) * cb + sb;        T.y2 = hy + (2.6 - i) * sb - cb;            // add(J.hip, rot(2.6-i, -1, pl))
  T.x3 = hx + (-2.4 + i) * cb + sb;       T.y3 = hy + (-2.4 + i) * sb - cb;           // add(J.hip, rot(-2.4+i, -1, pl))
  c.beginPath(); c.moveTo(T.x0, T.y0); c.lineTo(T.x1, T.y1); c.lineTo(T.x2, T.y2); c.lineTo(T.x3, T.y3); c.closePath();
  c.fillStyle = fill; c.fill();
  if (st) { c.strokeStyle = st; c.lineWidth = 0.5; c.stroke(); }
  return T;
}
// n خطوط عرضية على اللوح (قميص مخطط) بلون واحد في رسمة واحدة: من الحد الخلفي إلى الأمامي
export function hStripes(c, T, n, col, w) {
  c.beginPath();
  for (let k = 1; k <= n; k++) {
    const t = k / (n + 1);
    c.moveTo(T.x0 + (T.x3 - T.x0) * t, T.y0 + (T.y3 - T.y0) * t);
    c.lineTo(T.x1 + (T.x2 - T.x1) * t, T.y1 + (T.y2 - T.y1) * t);
  }
  c.strokeStyle = col; c.lineWidth = w || 0.7; c.stroke();
}
// خطوط طولية على اللوح عند المواضع ts (من الخلف 0 إلى الأمام 1)، من الكتفين إلى الحوض
export function vStripes(c, T, ts, col, w) {
  c.beginPath();
  for (const t of ts) {
    c.moveTo(T.x0 + (T.x1 - T.x0) * t, T.y0 + (T.y1 - T.y0) * t);
    c.lineTo(T.x3 + (T.x2 - T.x3) * t, T.y3 + (T.y2 - T.y3) * t);
  }
  c.strokeStyle = col; c.lineWidth = w || 0.6; c.stroke();
}

// ---------- أدوات الرماة (كوريا والسودان) ----------
// قوس بشد الوتر بلون col، بهندسة قوس اللعبة (bow في bodies.js): الطرفان خلف اليد والبطن أمامها.
// curlF وcurlO: طرفان مرتدان للأمام وللخارج بهذا القدر (القوس الكوري المنحني)، والوتر مربوط بهما.
// arrows: سهام على الوتر عند الشد (بطل الرماة يرمي ثلاثة)
export function pullBow(half, lw, col, arrows, curlF = 0, curlO = 0) {
  return (c, J, p) => {
    // خارج الرمي يُحمل القوس شبه قائم كقوس اللعبة
    const aim = p.pull === undefined ? p.wa * 0.4 : p.wa;
    const dx = Math.cos(aim), dy = Math.sin(aim), ux = dy, uy = -dx, hx = J.handF[0], hy = J.handF[1];
    const pull = p.pull || 0, b = 1 + pull * 0.55, back = 2.3 * b;
    const t1x = hx - dx * back + ux * half, t1y = hy - dy * back + uy * half;
    const t2x = hx - dx * back - ux * half, t2y = hy - dy * back - uy * half;
    const r1x = t1x + dx * curlF + ux * curlO, r1y = t1y + dy * curlF + uy * curlO;
    const r2x = t2x + dx * curlF - ux * curlO, r2y = t2y + dy * curlF - uy * curlO;
    c.beginPath();
    if (curlF) { c.moveTo(r1x, r1y); c.lineTo(t1x, t1y); } else c.moveTo(t1x, t1y);
    c.quadraticCurveTo(hx + dx * 2.3 * b, hy + dy * 2.3 * b, t2x, t2y);
    if (curlF) c.lineTo(r2x, r2y);
    c.strokeStyle = col; c.lineWidth = lw; c.stroke();
    const nx = pull > 0.05 ? J.handB[0] : (r1x + r2x) / 2, ny = pull > 0.05 ? J.handB[1] : (r1y + r2y) / 2;
    c.beginPath(); c.moveTo(r1x, r1y); c.lineTo(nx, ny); c.lineTo(r2x, r2y);
    c.strokeStyle = '#ece6d6'; c.lineWidth = 0.4; c.stroke();
    if (pull > 0.2 && arrows) {
      c.beginPath();
      for (let k = 0; k < arrows; k++) {
        const o = (k - (arrows - 1) / 2) * 0.9;
        c.moveTo(nx + ux * o * 0.4, ny + uy * o * 0.4); c.lineTo(hx + dx * 3.8 + ux * o, hy + dy * 3.8 + uy * o);
      }
      c.strokeStyle = '#d9d3c6'; c.lineWidth = 0.8; c.stroke();
    }
  };
}
// جعبة سهام على الظهر من الكتف إلى الورك، وثلاثة ريش بارزة (المبسّطة: الجعبة وحدها)
export function quiverBack(c, J, strap, fletch, lite) {
  const ca = Math.cos(J.a2), sa = Math.sin(J.a2), cb = Math.cos(J.pl), sb = Math.sin(J.pl);
  const ax = J.chest[0] - 1.6 * ca + 1.2 * sa, ay = J.chest[1] - 1.6 * sa - 1.2 * ca;   // add(J.chest, rot(-1.6, -1.2, J.a2))
  limb(c, ax, ay, J.mid[0] - 2.2 * cb - 2 * sb, J.mid[1] - 2.2 * sb + 2 * cb, 2, strap);   // إلى add(J.mid, rot(-2.2, 2, J.pl))
  if (lite) return;
  c.beginPath();
  for (let k = 0; k < 3; k++) triTo(c, ax - 0.6 + k * 0.6, ay, ax - 0.2 + k * 0.6, ay - 2, ax + 0.2 + k * 0.6, ay);
  c.fillStyle = fletch; c.fill();
}
// وهج دائري حول نقطة (سهم مشتعل، مشعل): تدرج واحد لكل لوحة ونصف قطر ولون، يُرسم بالإزاحة (لا تدرج جديد في كل إطار)
const glows = new WeakMap();
export function glowAt(c, x, y, r, color) {
  let byCanvas = glows.get(c);
  if (!byCanvas) glows.set(c, byCanvas = new Map());
  const key = r + color;
  let g = byCanvas.get(key);
  if (!g) {
    g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, color); g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    byCanvas.set(key, g);
  }
  c.save(); c.translate(x, y); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, 6.2831853); c.fill(); c.restore();
}

