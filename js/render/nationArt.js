/* مظاهر الأمم (القسم 3.10): سجل واحد لكل الأمم. كل وحدة = نمطها القتالي + إكسسوارات فوق drawBody
   (head وback وchest وrobe وover وweapon وfront وground كما في bodies.js). لون اللاعب يبقى لون الجسد،
   والهوية من غطاء الرأس وشكل الثوب والسلاح ولون ثانوي ثابت للأمة.
   لكل وحدة نسختان: الكاملة، والمبسّطة للمستوى المبسّط (القسم 5.4.5): الجسد وغطاء الرأس وشكل الثوب
   والسلاح فقط، بلا خطوط ولا نقوش صغيرة.
   أدوات الرسم المشتركة هنا منقولة من docs/nations/batch1-skins.js (تتكرر في الدفعات الأخرى)،
   وتعريفات كل دفعة في ملفها (nationsArab.js للدفعة العربية). */
import { BODIES, dashedRing } from './bodies.js';
import { limb, dk, lt, rrect, tri, STYLE, isHex, shadeEll, fillLinear } from './anim.js';

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

// مفتاح رسم وحدة الأمة، أو null (عصابة كلاسيكية أو أمة بلا مظهر بعد)
// (المرحلة 9ج) النسخة الكاملة بكل تفاصيلها للوحدة المظللة (أقرب وحدات المستوى الكامل، renderer.js) وتُرسم
// بالنمط المظلَّل، والمبسّطة لغيرها بالرسم القديم
export function nationArtKey(unit, kind, time, shaded) {
  const art = NATION_ART[unit.nation];
  if (!art) return null;
  const away = unit.awayUntil > time ? art[kind + '_away'] : null;
  const keys = away || art[kind] || art.common;
  return shaded ? keys[0] : keys[1];
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
// (المرحلة 9ج) بالنمط المظلَّل: المضلع الكبير بلون واحد (مساحة إطاره أكثر من 10) يُملأ بتدرج من زاوية إطاره
// العليا اليسرى إلى السفلى اليمنى وحافة داكنة خفيفة إن لم تكن له حافة، كما في style-v5
export function pg(c, pts, f, st, w) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  let x0 = pts[0][0], y0 = pts[0][1], x1 = x0, y1 = y0;
  for (let i = 1; i < pts.length; i++) {
    const x = pts[i][0], y = pts[i][1];
    c.lineTo(x, y);
    if (x < x0) x0 = x; else if (x > x1) x1 = x;
    if (y < y0) y0 = y; else if (y > y1) y1 = y;
  }
  c.closePath();
  shadeFill(c, f, st, w, x0, y0, x1, y1);
}
// ملء المسار الجاري بلون f وحده st، أو بتدرج النمط المظلَّل إن كان مشغلاً والشكل كبيراً (إطاره x0,y0 إلى x1,y1)
function shadeFill(c, f, st, w, x0, y0, x1, y1) {
  if (STYLE.on && (x1 - x0) * (y1 - y0) > 10 && isHex(f)) {
    fillLinear(c, f, x0, y0, x1, y1);
    c.strokeStyle = st || dk(f, 0.35); c.lineWidth = st ? (w || 0.5) : 0.45; c.stroke();
    return;
  }
  c.fillStyle = f; c.fill();
  if (st) { c.strokeStyle = st; c.lineWidth = w || 0.5; c.stroke(); }
}
// دائرة: بالنمط المظلَّل الكبيرة منها (نصف قطرها أكثر من 1.58) بتدرج دائري كالشكل البيضاوي (circ2 في المرجع)
export function circ(c, P, r, f) { dot(c, P[0], P[1], r, f); }
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
  c.closePath();
  if (STYLE.on && isHex(fill)) { robeShaded(c, J, fill, edge, top); return RB; }
  c.fillStyle = fill; c.fill();
  if (edge) { c.strokeStyle = edge; c.lineWidth = 0.5; c.stroke(); }
  return RB;
}
// الثوب بالنمط المظلَّل (robe في style-v5): تدرج وحافة، وطيّتان من الخصر إلى الحاشية، وخط داكن على الحاشية
function robeShaded(c, J, fill, edge, top) {
  let x0 = Math.min(RB.w1x, RB.w2x, RB.fx, RB.bx), x1 = Math.max(RB.w1x, RB.w2x, RB.fx, RB.bx);
  let y0 = Math.min(RB.w1y, RB.w2y, RB.fy, RB.by), y1 = Math.max(RB.w1y, RB.w2y, RB.fy, RB.by);
  if (top === 'chest') {
    const cb = Math.cos(J.a2), sb = Math.sin(J.a2), cx = J.chest[0], cy = J.chest[1];
    const ax = cx - 2.1 * cb - 0.5 * sb, ay = cy - 2.1 * sb + 0.5 * cb, bx = cx + 2.3 * cb - 0.5 * sb, by = cy + 2.3 * sb + 0.5 * cb;
    x0 = Math.min(x0, ax, bx); x1 = Math.max(x1, ax, bx); y0 = Math.min(y0, ay, by); y1 = Math.max(y1, ay, by);
  }
  shadeFill(c, fill, edge, 0.5, x0, y0, x1, y1);
  c.beginPath();
  for (const t of ROBE_FOLDS) {
    const u = t + (t - 0.5) * 0.3;
    const ax = RB.w1x + (RB.w2x - RB.w1x) * t, ay = RB.w1y + (RB.w2y - RB.w1y) * t;
    const bx = RB.bx + (RB.fx - RB.bx) * u, by = RB.by + (RB.fy - RB.by) * u;
    c.moveTo(ax, ay + 0.6); c.quadraticCurveTo((ax + bx) / 2 + 0.5, (ay + by) / 2, bx, by - 0.3);
  }
  const a = c.globalAlpha;
  c.strokeStyle = dk(fill, 0.16); c.lineWidth = 0.5; c.globalAlpha = a * 0.8; c.stroke(); c.globalAlpha = a;
  limb(c, RB.bx, RB.by, RB.fx, RB.fy, 0.6, dk(fill, 0.22));
}
const ROBE_FOLDS = [0.3, 0.62];
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
// حزام على الحوض. بالنمط المظلَّل (belt في style-v5): جلد بحافة داكنة ولمعة، وإبزيم نحاسي للعريض منه
export function belt(c, J, col, w) {
  const ca = Math.cos(J.pl), sa = Math.sin(J.pl), hx = J.hip[0], hy = J.hip[1];
  const ax = hx - 2.5 * ca + 1.3 * sa, ay = hy - 2.5 * sa - 1.3 * ca, bx = hx + 2.7 * ca + 1.3 * sa, by = hy + 2.7 * sa - 1.3 * ca;
  w = w || 1.5;
  if (!STYLE.on) { limb(c, ax, ay, bx, by, w, col); return; }
  limb(c, ax, ay, bx, by, w + 0.5, dk(col, 0.45)); limb(c, ax, ay, bx, by, w, col);
  limb(c, ax, ay - w * 0.25, bx, by - w * 0.25, w * 0.25, lt(col, 0.3));
  if (w >= 1.1) {
    const kx = ax + (bx - ax) * 0.72, ky = ay + (by - ay) * 0.72;
    rrect(c, kx - w * 0.6, ky - w * 0.75, w * 1.2, w * 1.5, 0.25, BRASS_BUCKLE); rrect(c, kx - w * 0.3, ky - w * 0.4, w * 0.6, w * 0.8, 0.15, dk(col, 0.2));
  }
}
const BRASS_BUCKLE = '#d9b45a';
// عصا في اليد الأمامية: back خلف اليد وfwd أمامها. تعيد رأسها في SB (كائن ثابت) لمن يرسم عليه مقبضاً
export const SB = { ax: 0, ay: 0, bx: 0, by: 0, dx: 0, dy: 0 };
export function staff(c, J, p, back, fwd, w, col) {
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), hx = J.handF[0], hy = J.handF[1];
  SB.ax = hx - dx * back; SB.ay = hy - dy * back; SB.bx = hx + dx * fwd; SB.by = hy + dy * fwd; SB.dx = dx; SB.dy = dy;
  limb(c, SB.ax, SB.ay, SB.bx, SB.by, w, col);
  return SB;
}
// دائرة ممتلئة بإحداثيين (بلا مصفوفة)
export function dot(c, x, y, r, f) {
  c.beginPath(); c.arc(x, y, r, 0, 6.2831853);
  if (STYLE.on && r * r > 2.5 && isHex(f)) shadeEll(c, x, y, r, r, f);
  else { c.fillStyle = f; c.fill(); }
}
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
  shadeFill(c, fill, st, 0.5, Math.min(T.x0, T.x1, T.x2, T.x3), Math.min(T.y0, T.y1, T.y2, T.y3),
            Math.max(T.x0, T.x1, T.x2, T.x3), Math.max(T.y0, T.y1, T.y2, T.y3));
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

// ---------- أدوات الزخرفة (المرحلة 9ج، من docs/nations/skins-v6.js) ----------
// للنسخ الكاملة وحدها. حواف الثوب تقرأ آخر ثوب رُسم (RB) وحلقات العصا آخر عصا (SB)، كـ LAST_ROBE وLAST_STAFF
// في المرجع، والأشكال المتكررة بلون واحد في مسار واحد ورسمة واحدة
const EA = [0, 0], EB = [0, 0];
function edgeAt(t) {              // عرض الثوب عند t (0 الخصر، 1 الحاشية): من حده الخلفي EA إلى الأمامي EB
  EA[0] = RB.w1x + (RB.bx - RB.w1x) * t; EA[1] = RB.w1y + (RB.by - RB.w1y) * t;
  EB[0] = RB.w2x + (RB.fx - RB.w2x) * t; EB[1] = RB.w2y + (RB.fy - RB.w2y) * t;
}
// شريط عرضي على الثوب من t0 إلى t1
export function hemBand(c, t0, t1, col) {
  edgeAt(t0); const a = [EA[0], EA[1]], b = [EB[0], EB[1]];
  edgeAt(t1); pg(c, [a, b, [EB[0], EB[1]], [EA[0], EA[1]]], col);
}
// خط عرضي واحد على الثوب عند t
export function hemLine(c, t, col, w) { edgeAt(t); limb(c, EA[0], EA[1], EB[0], EB[1], w, col); }
// حافة متعرجة: n مثلثات على عرض الثوب عند t بارتفاع h
export function hemZig(c, col, t, n, h) {
  edgeAt(t || 0.88);
  const N = n || 7, H = h || 1.3, w = Math.hypot(EB[0] - EA[0], EB[1] - EA[1]) / N * 0.42;
  c.beginPath();
  for (let k = 0; k < N; k++) {
    const u = (k + 0.5) / N, x = EA[0] + (EB[0] - EA[0]) * u, y = EA[1] + (EB[1] - EA[1]) * u;
    c.moveTo(x - w, y + H * 0.4); c.lineTo(x, y - H * 0.6); c.lineTo(x + w, y + H * 0.4); c.closePath();
  }
  c.fillStyle = col; c.fill();
}
// n معينات صغيرة على عرض الثوب عند t
export function hemDiamonds(c, col, t, n) {
  edgeAt(t || 0.6);
  const N = n || 4;
  c.beginPath();
  for (let k = 0; k < N; k++) {
    const u = (k + 0.5) / N, x = EA[0] + (EB[0] - EA[0]) * u, y = EA[1] + (EB[1] - EA[1]) * u;
    c.moveTo(x, y - 0.9); c.lineTo(x + 0.6, y); c.lineTo(x, y + 0.9); c.lineTo(x - 0.6, y); c.closePath();
  }
  c.fillStyle = col; c.fill();
}
// أربع سحب صغيرة (قوسان لكل سحابة) على عرض الثوب عند t
export function hemCloud(c, col, t) {
  edgeAt(t || 0.82);
  c.beginPath();
  for (let k = 0; k < 4; k++) {
    const u = (k + 0.5) / 4, x = EA[0] + (EB[0] - EA[0]) * u, y = EA[1] + (EB[1] - EA[1]) * u;
    c.moveTo(x - 0.9, y); c.arc(x, y, 0.9, Math.PI, 0); c.arc(x + 1, y, 0.6, Math.PI, 0);
  }
  c.strokeStyle = col; c.lineWidth = 0.45; c.stroke();
}
// مريلة من الخصر إلى قرب الحاشية، وبحافتين ومعين وسطها إن كان لها لون حافة
export function apron(c, col, trim) {
  const tx = RB.w1x + (RB.w2x - RB.w1x) * 0.58, ty = RB.w1y + (RB.w2y - RB.w1y) * 0.58;
  const bx = RB.bx + (RB.fx - RB.bx) * 0.62, by = RB.by + (RB.fy - RB.by) * 0.62;
  pg(c, [[tx - 1.1, ty + 0.6], [tx + 1.1, ty + 0.6], [bx + 1.4, by - 0.4], [bx - 1.4, by - 0.4]], col);
  if (!trim) return;
  c.beginPath(); c.moveTo(tx - 1.1, ty + 0.6); c.lineTo(bx - 1.4, by - 0.4); c.moveTo(tx + 1.1, ty + 0.6); c.lineTo(bx + 1.4, by - 0.4);
  c.strokeStyle = trim; c.lineWidth = 0.45; c.stroke();
  const mx = tx + (bx - tx) * 0.55, my = ty + (by - ty) * 0.55;
  c.beginPath(); c.moveTo(mx, my - 1); c.lineTo(mx + 0.7, my); c.lineTo(mx, my + 1); c.lineTo(mx - 0.7, my); c.closePath();
  c.fillStyle = trim; c.fill();
}
// ياقة على شكل V عند الرقبة، وخط ثانٍ تحتها إن كان لها لون ثانٍ
export function collarV(c, J, c1, c2) {
  at(J.chest, -1.5, -1.4, J.a2); const ax = PT.x, ay = PT.y;
  at(J.chest, 1.7, -1.4, J.a2); const bx = PT.x, by = PT.y;
  at(J.chest, 0.7, 2.4, J.a2); const mx = PT.x, my = PT.y;
  c.beginPath(); c.moveTo(ax, ay); c.lineTo(mx, my); c.lineTo(bx, by); c.strokeStyle = c1; c.lineWidth = 1.3; c.stroke();
  if (c2) { c.beginPath(); c.moveTo(ax, ay + 0.5); c.lineTo(mx, my + 0.3); c.lineTo(bx, by + 0.5); c.strokeStyle = c2; c.lineWidth = 0.5; c.stroke(); }
}
// شريط على أعلى الذراع الأمامية (بين الكتف والمرفق عند t)، وزر وسطه إن كان له لون
export function armband(c, J, col, trim, t) {
  const S = J.Sf, E = J.elbowF;
  if (!E) return;
  const u = t || 0.55, px = S[0] + (E[0] - S[0]) * u, py = S[1] + (E[1] - S[1]) * u;
  const dx = E[0] - S[0], dy = E[1] - S[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * 1.9, ny = dx / L * 1.9;
  limb(c, px - nx, py - ny, px + nx, py + ny, 1.2, col);
  if (trim) dot(c, px, py, 0.45, trim);
}
// كُمّ عند الساعد الأمامي
export function cuff(c, J, col) {
  const E = J.elbowF, H = J.handF;
  if (!E) return;
  const px = E[0] + (H[0] - E[0]) * 0.62, py = E[1] + (H[1] - E[1]) * 0.62;
  const dx = H[0] - E[0], dy = H[1] - E[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * 1.8, ny = dx / L * 1.8;
  limb(c, px - nx, py - ny, px + nx, py + ny, 0.9, col);
}
// شرّابة: عقدة وثلاثة خيوط متدلية بطول len
export function tassel(c, x, y, col, len, knot) {
  dot(c, x, y, 0.7, knot || GOLD);
  const L = len || 3;
  c.beginPath();
  for (let k = -1; k <= 1; k++) { c.moveTo(x + k * 0.3, y + 0.5); c.lineTo(x + k * 0.4, y + L); }
  c.strokeStyle = col; c.lineWidth = 0.4; c.stroke();
}
// لفائف الصنادل المتقاطعة على الساقين من الركبة إلى القدم (الخلفية أغمق)
export function legWraps(c, J, col) {
  for (let n = 0; n < 2; n++) {
    const L = n ? J.legF : J.legB, k = L.k, f = L.f;
    const ax = k[0] + (f[0] - k[0]) * 0.15, ay = k[1] + (f[1] - k[1]) * 0.15;
    const bx = k[0] + (f[0] - k[0]) * 0.95, by = k[1] + (f[1] - k[1]) * 0.95;
    c.beginPath();
    for (let q = 0; q < 4; q++) {
      const px = ax + (bx - ax) * q / 4, py = ay + (by - ay) * q / 4, qx = ax + (bx - ax) * (q + 1) / 4, qy = ay + (by - ay) * (q + 1) / 4;
      c.moveTo(px - 1.3, py); c.lineTo(qx + 1.3, qy); c.moveTo(px + 1.3, py); c.lineTo(qx - 1.3, qy);
    }
    c.strokeStyle = n ? col : dk(col, 0.2); c.lineWidth = 0.4; c.stroke();
  }
}
// حلقات نحاسية على آخر عصا رُسمت عند المواضع ts (0 مؤخرتها، 1 رأسها)
export function staffBands(c, ts, col) {
  const nx = -SB.dy * 1.1, ny = SB.dx * 1.1;
  c.beginPath();
  for (const t of ts) { const x = SB.ax + (SB.bx - SB.ax) * t, y = SB.ay + (SB.by - SB.ay) * t; c.moveTo(x - nx, y - ny); c.lineTo(x + nx, y + ny); }
  c.strokeStyle = col; c.lineWidth = 0.8; c.stroke();
}
// حقيبة جلدية صغيرة على الحزام (side: موضعها على الحوض) بغطاء أفتح وزر نحاسي
export function pouchX(c, J, side, col) {
  at(J.hip, side, -0.6, J.pl); const x = PT.x, y = PT.y, f = col || '#7a5232';
  rrect(c, x - 1.5, y - 0.3, 3, 2.6, 0.5, f); rrect(c, x - 1.5, y - 0.3, 3, 1.1, 0.4, lt(f, 0.15)); dot(c, x, y + 0.5, 0.3, '#d9b45a');
}
// خيط دخان متموج فوق نقطة (المبخرة)
export function smokeWisp(c, x, y) {
  const a = c.globalAlpha; c.globalAlpha = a * 0.55;
  c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + 1.6, y - 1.6, x - 1.4, y - 3, x + 0.4, y - 4.6); c.bezierCurveTo(x + 1.8, y - 5.8, x - 0.6, y - 7, x + 0.8, y - 8.4);
  c.strokeStyle = '#c8c4bc'; c.lineWidth = 0.7; c.stroke(); c.globalAlpha = a;
}
