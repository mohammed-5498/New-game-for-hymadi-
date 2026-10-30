// المخلوقات (القسم 3.11): الفيل الحربي (جايبور) وترول الجبل (القرية النرويجية) يُرسمان بشكلهما لا بهيكل الوحدات.
// الرسم بوحدات محلية: الفرد العادي نحو 30 وحدة طولاً بمقياس 1، فيُضرب كل شيء في مقياس الوحدة (artScale)،
// ويُعكس حسب اتجاهها (facing). المشي يحرك الأرجل، والضربة (cMove) تحرك الخرطوم أو الهراوة، والموت يُسقطه ويخفيه.
// يُرسمان بصورتي المستخدم (أسفل الملف)، وبالرسم بالكود هنا حتى تُحمَّل الصورة
import { COMBAT, COMBAT_REALISM } from '../config.js';
import { CREATURE_SPRITES as CS } from './creatureSpritesData.js';
import { paintAtlas } from './unitSprites.js';

const TAU = 6.2831853;

function ell(ctx, x, y, rx, ry, color, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

function shape(ctx, pts, color) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function stroke(ctx, pts, color, width) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// تقدّم الضربة الجارية من 0 إلى 1 (0 بلا ضربة)
const swingOf = (unit) => (unit.cMove && unit.cPhases ? Math.min(1, unit.cMoveT / unit.cPhases.total) : 0);

// --- الفيل الحربي: جسد رمادي بأرجل غليظة، ورأس بأذن وخرطوم ونابين، وكسوة مزخرفة وغطاء جبهة بلون مالكه،
// وهودج ذهبي بقبة حمراء وفيه فارس بعمامة بلون مالكه ---
function elephant(ctx, color, walkT, swing, flash) {
  const skin = '#8d8884', dark = '#6e6966', light = '#a6a19c';
  const step = (k) => Math.sin(walkT + k * Math.PI) * 1.6;
  const lift = (k) => Math.max(0, Math.sin(walkT + k * Math.PI)) * 1.1;
  const bob = Math.abs(Math.sin(walkT)) * 0.5;
  const lunge = Math.sin(swing * Math.PI) * 2;
  ell(ctx, 1, 0, 15, 4.2, 'rgba(0,0,0,0.25)');
  // الرجلان البعيدتان أولاً
  ctx.fillStyle = dark;
  for (const [lx, k] of [[-8, 1], [6, 0]]) ctx.fillRect(lx - 2 + step(k), -11 - lift(k), 4, 10.6);
  ctx.save();
  ctx.translate(lunge, -bob);
  // الذيل والجسد والبطن
  stroke(ctx, [[-13, -18], [-15.5, -13], [-15, -9]], dark, 0.9);
  ell(ctx, -1, -17, 13.5, 9, skin);
  ell(ctx, 0, -12, 10, 4, dark);
  ell(ctx, -3, -21, 8, 3, light);
  // الكسوة المزخرفة بلون المالك وحافتها الذهبية وشراشيبها
  shape(ctx, [[-10, -24], [7, -24], [8, -14], [-11, -14]], color);
  stroke(ctx, [[-11, -14], [8, -14]], '#e8c45a', 1);
  for (let n = 0; n < 6; n++) ell(ctx, -9.5 + n * 3.3, -12.8, 0.7, 1, '#e8c45a');
  for (let n = 0; n < 3; n++) ell(ctx, -6 + n * 6, -19, 1.3, 1.3, '#e8c45a');
  // الرأس والأذن والعين
  ctx.save();
  ctx.translate(11, -19);
  ctx.rotate(-0.35 * Math.sin(swing * Math.PI));
  ell(ctx, 1.5, -1, 6.5, 6, skin);
  ell(ctx, -1.2, 0, 4, 5.6, dark);
  shape(ctx, [[-0.5, -6], [5, -6.5], [6.5, -2], [0, -2.5]], color);       // غطاء الجبهة
  stroke(ctx, [[0, -2.5], [6.5, -2]], '#e8c45a', 0.8);
  ell(ctx, 4.3, -1.3, 0.8, 0.8, '#1d1a18');
  // الخرطوم: يرتفع مع الضربة، ثم النابان
  const up = Math.sin(swing * Math.PI);
  stroke(ctx, [[6.5, 1], [8.5, 5 - up * 4], [8.6, 10 - up * 9], [10.5, 12 - up * 13]], skin, 3.2);
  stroke(ctx, [[5.5, 2.5], [9.5, 4.2], [11.5, 2.6]], '#f2ecdf', 1.3);
  ctx.restore();
  // الهودج وقبته والفارس
  ctx.fillStyle = '#a8432f';
  ctx.fillRect(-7, -31, 12, 7);
  stroke(ctx, [[-7, -31], [5, -31]], '#e8c45a', 1.2);
  stroke(ctx, [[-7, -24.5], [5, -24.5]], '#e8c45a', 1);
  for (const px of [-6.2, 4.2]) stroke(ctx, [[px, -31], [px, -37]], '#e8c45a', 0.9);
  ell(ctx, -1, -32.5, 1.9, 2.4, '#c98f6a');                                 // وجه الفارس
  ell(ctx, -1, -34.6, 2.2, 1.4, color);                                     // عمامته
  shape(ctx, [[-3, -30.5], [1, -30.5], [1.6, -27.5], [-3.6, -27.5]], color); // كتفاه
  ctx.beginPath();
  ctx.ellipse(-1, -37, 7, 4.2, 0, Math.PI, 0);
  ctx.fillStyle = '#c0392b';
  ctx.fill();
  stroke(ctx, [[-1, -41.2], [-1, -43.5]], '#e8c45a', 0.9);
  ctx.restore();
  // الرجلان القريبتان
  for (const [lx, k] of [[-5, 0], [9, 1]]) {
    ctx.fillStyle = skin;
    ctx.fillRect(lx - 2.3 + step(k), -11 - lift(k), 4.6, 11);
    ctx.fillStyle = '#d8d2c8';
    ctx.fillRect(lx - 2.3 + step(k), -1.2 - lift(k), 4.6, 1.2);
  }
  if (flash) ell(ctx, 0, -18, 14, 10, 'rgba(255,255,255,0.35)');
}

// --- ترول الجبل: جسد ضخم منحنٍ بلون الطحلب، ورأس صغير بأنف كبير وأذنين مدببتين ونابين، وإزار من الفرو،
// وذراعان طويلتان، وهراوة خشبية تُرفع فوق رأسه ثم تهوي مع الضربة ---
function troll(ctx, color, walkT, swing, flash) {
  const skin = color, dark = '#46523f', light = '#86957a';
  const step = (k) => Math.sin(walkT + k * Math.PI) * 2;
  const lift = (k) => Math.max(0, Math.sin(walkT + k * Math.PI)) * 1.3;
  const bob = Math.abs(Math.sin(walkT)) * 0.7;
  ell(ctx, 0, 0, 11, 3.4, 'rgba(0,0,0,0.25)');
  // الرجلان
  for (const k of [0, 1]) {
    const lx = (k ? 3.5 : -3.5) + step(k);
    shape(ctx, [[lx - 2.6, -11], [lx + 2.6, -11], [lx + 2.2, -1.5 - lift(k)], [lx - 2.4, -1.5 - lift(k)]], k ? skin : dark);
    ell(ctx, lx + 0.8, -1 - lift(k), 3.2, 1.4, k ? dark : '#38412f');
  }
  ctx.save();
  ctx.translate(0, -bob);
  // الذراع البعيدة خلف الجسد
  stroke(ctx, [[-4, -22], [-8, -15], [-7.5, -8]], dark, 3.4);
  // الجسد والبطن وبقع الطحلب والإزار
  ell(ctx, 0, -18, 8.5, 9, skin);
  ell(ctx, 2, -15, 5, 5.5, light);
  for (const [px, py] of [[-5, -23], [-3, -19], [-6, -16]]) ell(ctx, px, py, 1.4, 1, '#9fb07c');
  shape(ctx, [[-7.5, -12], [7.5, -12], [6.5, -8], [3, -9.5], [0, -7.5], [-3, -9.5], [-6.5, -8]], '#6b4a2e');
  // الرأس منخفضاً إلى الأمام: الأذن والأنف والعين والنابان والشعر
  ell(ctx, 4.5, -26.5, 4.2, 3.8, skin);
  shape(ctx, [[1.5, -28], [-1.5, -32], [2.5, -29.5]], skin);
  ell(ctx, 8.6, -25.4, 2.6, 1.8, dark);
  ell(ctx, 5.6, -28, 0.6, 0.6, '#1d1a18');
  shape(ctx, [[6, -23.4], [6.8, -21.4], [7.4, -23.4]], '#f2ecdf');
  shape(ctx, [[3.6, -23.6], [4.3, -21.8], [4.9, -23.6]], '#f2ecdf');
  stroke(ctx, [[2, -30], [4, -31.5], [6.5, -30.5]], '#38412f', 1.2);
  // الذراع القريبة بالهراوة: مرفوعة خلف رأسه ثم تهوي إلى الأمام مع الضربة
  const a = swing ? -2.4 + swing * 3.2 : -0.35;
  ctx.save();
  ctx.translate(4, -21);
  ctx.rotate(a);
  stroke(ctx, [[0, 0], [5, 3], [8.5, 4]], skin, 3.6);
  shape(ctx, [[8, 2.4], [22, 1], [23, 5.6], [8.5, 5.6]], '#5a3e26');
  for (const px of [12, 16, 20]) ell(ctx, px, 3, 0.8, 0.8, '#3a2716');
  ell(ctx, 9, 4, 2, 2, skin);
  ctx.restore();
  ctx.restore();
  if (flash) ell(ctx, 0, -18, 9, 10, 'rgba(255,255,255,0.35)');
}

const DRAW = { elephant, troll };

// ================= صورتا المستخدم: الترول والفيل أجزاءً من أطلس تتحرك (scripts/cut_creatures.py) =================
// الحساب كله بإحداثيات الصورة الأصلية (بكسل) والقدمان عند origin، وSIZE طول المخلوق (حتى height) بالوحدات المحلية.
// الجسد قطعة واحدة تعلو وتهبط وتميل حول hip، وأسفله (من mesh.y0) شبكة مثلثات: كل ساق بما حولها كتلة واحدة تخطو
// وتُرفع، وأعلى الشبكة مع الجسد وأسفلها على الأرض، فلا فجوات
const K = 1 / CS.scale;                         // بكسل من الصورة لكل بكسل من الأطلس
const SIZE = { troll: 29, elephant: 33 };
// عرض المخلوق نسبة إلى طوله مقارنة بالفرد العادي: صندوقه عند إخفائه خلف المباني وحلقة تحديده (units.js)
export const CREATURE_WIDTH = { troll: 1.8, elephant: 2.2 };
// pace سرعة الخطو (راديان/ث)، وstride وlift وbob مدى الخطوة ورفع القدم وصعود الجسد (بكسل)
const GAIT = {
  troll:    { pace: 8, stride: 55, lift: 24, bob: 14, hip: [515, 640] },
  elephant: { pace: 6.5, stride: 48, lift: 20, bob: 10, hip: [688, 690] }
};
const CLUB_REST = 0.75;                         // ميل الهراوة في قبضة الترول واقفاً (راديان تحت الأفق، للأمام)
const atlases = {}, waiting = {}, painted = new Map();

// صورة المخلوق بعد تحميلها (null قبله، ثم then)
function load(kind, then) {
  if (atlases[kind]) return atlases[kind];
  if (!waiting[kind]) {
    waiting[kind] = [];
    const im = new Image();
    im.onload = () => { atlases[kind] = im; for (const fn of waiting[kind].splice(0)) fn(); };
    im.src = CS[kind].src;
  }
  if (then) waiting[kind].push(then);
  return null;
}

// تُحمَّل صورة مخلوق المدينة مع بداية مباراتها، فلا يظهر رسمه القديم لحظة نزوله
const OF_FEATURE = { troll: 'troll', elephants: 'elephant' };
export function preloadCreature(feature) {
  if (OF_FEATURE[feature]) load(OF_FEATURE[feature]);
}

// أطلس المخلوق للرسم، والفيل مصبوغ بلون مالكه مرة لكل لون
function sheetOf(kind, color, then) {
  const img = load(kind, then);
  if (!img || !CS[kind].tint) return img;
  const id = kind + color;
  let S = painted.get(id);
  if (!S) painted.set(id, S = paintAtlas(img, CS[kind].h, CS[kind].tint, color));
  return S;
}

// الجزء p في مكانه من الصورة الأصلية (أو ما فوق السطر y منه وحده)
function piece(ctx, S, p, y = Infinity) {
  const h = Math.min(p[3], (y - p[5]) / K);
  if (h > 0) ctx.drawImage(S, p[0], p[1], p[2], h, p[4], p[5], p[2] * K, h * K);
}

function turnAt(ctx, c, ang) {
  ctx.translate(c[0], c[1]);
  ctx.rotate(ang);
  ctx.translate(-c[0], -c[1]);
}

// الجسد B: ميل ang حول hip ثم إزاحة (dx, dy)، على اللوحة (bodyOn) أو لنقطة (bodyAt)
function bodyOn(ctx, G, B) {
  ctx.translate(B.dx, B.dy);
  turnAt(ctx, G.hip, B.ang);
}
function bodyAt(G, B, x, y) {
  const c = Math.cos(B.ang), s = Math.sin(B.ang), u = x - G.hip[0], v = y - G.hip[1];
  return [G.hip[0] + u * c - v * s + B.dx, G.hip[1] + u * s + v * c + B.dy];
}

// مثلث من الجزء p: من رؤوسه في الصورة (src) إلى رؤوسه الآن (dst)، مكبَّراً e حول مركزه فلا تظهر خطوط بين المثلثات
function tri(ctx, S, p, src, dst, i, j, k, e) {
  const sx = src[i], sy = src[i + 1], ux = src[j] - sx, uy = src[j + 1] - sy, vx = src[k] - sx, vy = src[k + 1] - sy;
  const det = ux * vy - vx * uy;
  if (!det) return;
  const dx = dst[i], dy = dst[i + 1], px = dst[j] - dx, py = dst[j + 1] - dy, qx = dst[k] - dx, qy = dst[k + 1] - dy;
  const a = (px * vy - qx * uy) / det, c = (qx * ux - px * vx) / det;
  const b = (py * vy - qy * uy) / det, d = (qy * ux - py * vx) / det;
  const cx = (dst[i] + dst[j] + dst[k]) / 3, cy = (dst[i + 1] + dst[j + 1] + dst[k + 1]) / 3;
  ctx.save();
  ctx.beginPath();
  for (const v of [i, j, k]) {
    const x = dst[v], y = dst[v + 1], l = Math.hypot(x - cx, y - cy) || 1;
    ctx.lineTo(x + (x - cx) / l * e, y + (y - cy) / l * e);
  }
  ctx.clip();
  ctx.transform(a, b, c, d, dx - a * sx - c * sy, dy - b * sx - d * sy);
  piece(ctx, S, p);
  ctx.restore();
}

// أسفل الجسد بالشبكة: الأعمدة mesh.xs (نصفها الأول للساق الخلفية ونصفها الثاني للأمامية) والصفوف ny.
// step لكل ساق [إزاحتها للأمام، رفعها] عند القدم، وتقل نحو أعلاها
function legs(ctx, S, p, M, G, B, step) {
  const n = M.xs.length, src = [], dst = [];
  for (let r = 0; r <= M.ny; r++) {
    const t = r / M.ny, y = M.y0 + (M.y1 - M.y0) * t;
    for (let c = 0; c < n; c++) {
      const x = M.xs[c], b = bodyAt(G, B, x, y), L = step[c < n / 2 ? 0 : 1];
      src.push(x, y);
      dst.push(b[0] + (x - b[0]) * t + L[0] * t ** 1.3, b[1] + (y - b[1]) * t - L[1] * t ** 1.5);
    }
  }
  const m = ctx.getTransform(), e = 0.9 / Math.hypot(m.a, m.b);
  for (let r = 0; r < M.ny; r++) {
    for (let c = 0; c < n - 1; c++) {
      const a = 2 * (r * n + c), w = 2 * n;
      tri(ctx, S, p, src, dst, a, a + 2, a + w + 2, e);
      tri(ctx, S, p, src, dst, a, a + w + 2, a + w, e);
    }
  }
}

// الخطو: الساقان متعاكستان، وكل ساق تُرفع وهي تتقدم
function gait(G, o) {
  if (!o.walking) return [[0, 0], [0, 0]];
  const s = Math.sin(o.walkT), c = Math.cos(o.walkT);
  return [[G.stride * s, G.lift * Math.max(0, c)], [-G.stride * s, G.lift * Math.max(0, -c)]];
}

// الجسد: يعلو حين تتجاوز الساقان إحداهما الأخرى (أو يتنفس واقفاً)، ويهبط حين يموت
function bodyRise(G, o, breath) {
  const sink = Math.min(1, o.deadT * 2.5) * 70;
  return (o.walking ? -G.bob * (1 - Math.abs(Math.sin(o.walkT))) : Math.sin(o.time * 2) * breath) + sink;
}

// الضربة من -1 إلى 1: يستعد (إلى -1) حتى نهاية الاستعداد w، ثم يضرب (إلى 1) حتى لحظة الإصابة h،
// ويثبت حتى g، ثم يعود إلى 0
function strike(o) {
  const s = o.swing;
  if (!s) return 0;
  if (s < o.w) { const u = s / o.w; return -u * (2 - u); }
  if (s < o.h) { const u = (s - o.w) / (o.h - o.w); return -1 + 2 * u * u; }
  if (s < o.g) return 1;
  const u = (s - o.g) / (1 - o.g);
  return 1 - u * u * (3 - 2 * u);
}

// ومضة الإصابة: الجسد يُعاد رسمه فوق نفسه مضيئاً
function flashOn(ctx, S, p, y, f) {
  if (f <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= 0.45 * f;
  piece(ctx, S, p, y);
  ctx.restore();
}

// --- الترول: يرفع الهراوة بساعده فوق رأسه ويميل للخلف، ثم يهوي بها إلى الأرض أمامه فيثور الغبار.
// ويمشي والهراوة تتأرجح في يده ---
function trollSprite(ctx, S, o) {
  const D = CS.troll, P = D.parts, G = GAIT.troll, M = D.mesh, r = strike(o);
  const arm = (r < 0 ? 2.3 * r : 0.3 * r) - (o.walking ? 0.15 * Math.sin(o.walkT) : 0);
  const B = { ang: r < 0 ? 0.05 * r : 0.08 * r, dx: 0, dy: bodyRise(G, o, 4) };
  ell(ctx, 520, D.origin[1], 470, 90, 'rgba(0,0,0,0.25)');
  legs(ctx, S, P.base, M, G, B, gait(G, o));
  ctx.save();
  bodyOn(ctx, G, B);
  piece(ctx, S, P.base, M.y0 + 3);
  flashOn(ctx, S, P.base, M.y0 + 3, o.flash);
  // الساعد والهراوة في قبضته (تحت أصابعها)
  turnAt(ctx, D.elbow, arm);
  ctx.save();
  ctx.translate(D.fist[0], D.fist[1]);
  ctx.rotate(CLUB_REST - D.clubAngle);
  ctx.translate(-D.clubGrip[0], -D.clubGrip[1]);
  piece(ctx, S, P.club);
  ctx.restore();
  piece(ctx, S, P.fore);
  ctx.restore();
  // غبار الضربة على الأرض أمامه
  const u = o.swing && o.swing >= o.h ? (o.swing - o.h) / (1 - o.h) / 0.5 : 1;
  if (u < 1) {
    ctx.save();
    ctx.globalAlpha *= 0.6 * (1 - u);
    ctx.beginPath();
    ctx.ellipse(1040, 1075, 90 + 240 * u, (90 + 240 * u) * 0.28, 0, 0, TAU);
    ctx.strokeStyle = '#d9c9a6';
    ctx.lineWidth = 18;
    ctx.stroke();
    ctx.restore();
  }
}

// --- الفيل: يخفض رأسه ويميل للخلف، ثم يندفع للأمام رافعاً رأسه فيطعن بنابيه، ويومئ مع خطوه ---
function elephantSprite(ctx, S, o) {
  const D = CS.elephant, P = D.parts, G = GAIT.elephant, M = D.mesh, r = strike(o);
  const B = { ang: r < 0 ? 0.03 * r : 0.02 * r, dx: 40 * Math.max(0, r), dy: bodyRise(G, o, 3) };
  const nod = (o.walking ? 0.04 * Math.sin(2 * o.walkT) : 0.02 * Math.sin(o.time * 1.3)) + (r < 0 ? -0.12 * r : -0.2 * r);
  ell(ctx, 690, D.origin[1], 520, 90, 'rgba(0,0,0,0.25)');
  legs(ctx, S, P.body, M, G, B, gait(G, o));
  ctx.save();
  bodyOn(ctx, G, B);
  piece(ctx, S, P.body, M.y0 + 3);
  flashOn(ctx, S, P.body, M.y0 + 3, o.flash);
  turnAt(ctx, D.neck, nod);
  piece(ctx, S, P.head);
  flashOn(ctx, S, P.head, Infinity, o.flash);
  ctx.restore();
}

const SPRITE = { elephant: elephantSprite, troll: trollSprite };

function sprite(ctx, kind, S, o) {
  const D = CS[kind], k = SIZE[kind] / D.height;
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(-D.origin[0], -D.origin[1]);
  SPRITE[kind](ctx, S, o);
  ctx.restore();
}

// x وy موضع القدمين، وscale مقياس الوحدة، وcolor لون مالكها
export function drawCreature(ctx, unit, x, y, scale, color, time, walking) {
  const draw = DRAW[unit.creature];
  if (!draw) return;
  const dead = unit.state === 'dead';
  const deadT = dead ? Math.min(1, 1 - unit.deathTimer / COMBAT.deathTime) : 0;
  ctx.save();
  ctx.translate(x, y);
  if (dead) {
    ctx.globalAlpha = deadT > 0.6 ? Math.max(0, 1 - (deadT - 0.6) / 0.4) : 1;
    ctx.rotate(-(unit.facing || 1) * Math.min(1, deadT * 2.2) * 1.2);
  }
  ctx.scale(scale * (unit.facing || 1), scale);
  const S = sheetOf(unit.creature, color), P = !dead && unit.cPhases;
  if (S) {
    sprite(ctx, unit.creature, S, {
      walking: walking && !dead, walkT: time * GAIT[unit.creature].pace, time, deadT,
      swing: P ? swingOf(unit) : 0, flash: dead ? 0 : unit.hitFlash / COMBAT.hitFlashTime,
      w: P ? P.wind / P.total : 0, h: P ? (P.wind + P.strike * COMBAT_REALISM.strikeMoment) / P.total : 0,
      g: P ? (P.wind + P.strike + P.hold) / P.total : 0
    });
  } else {
    draw(ctx, color, walking && !dead ? time * 7 : 0, dead ? 0 : swingOf(unit), unit.hitFlash > 0);
  }
  ctx.restore();
}

const REST = { walking: false, walkT: 0, time: 0, deadT: 0, swing: 0, flash: 0, w: 0, h: 0, g: 0 };

// صورة المخلوق في خانة التجنيد (قائمة الإسطبل)، تُعاد حين تُحمَّل صورته
export function drawCreatureIcon(canvas, kind, color) {
  const box = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.width = Math.max(1, Math.round((box.width || 120) * dpr));
  const h = canvas.height = Math.max(1, Math.round((box.height || 80) * dpr));
  const ctx = canvas.getContext('2d');
  const draw = DRAW[kind];
  if (!draw) return;
  const S = sheetOf(kind, color, () => { if (canvas.isConnected) drawCreatureIcon(canvas, kind, color); });
  ctx.save();
  if (S) {
    // حدود أجزائه بالوحدات المحلية: يتوسط الخانة
    const D = CS[kind], k = SIZE[kind] / D.height;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity;
    for (const p of Object.values(D.parts)) {
      x0 = Math.min(x0, p[4]);
      x1 = Math.max(x1, p[4] + p[2] * K);
      y0 = Math.min(y0, p[5]);
    }
    const s = Math.min(w / ((x1 - x0) * k * 1.06), h * 0.92 / ((D.origin[1] - y0) * k));
    ctx.translate(w / 2 - ((x0 + x1) / 2 - D.origin[0]) * k * s, h * 0.95);
    ctx.scale(s, s);
    sprite(ctx, kind, S, REST);
  } else {
    const s = Math.min(w / 34, h / 48);
    ctx.translate(w / 2, h * 0.94);
    ctx.scale(s, s);
    draw(ctx, color, 0, 0, false);
  }
  ctx.restore();
}
