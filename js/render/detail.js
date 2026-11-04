// تفاصيل المباني العادية وأرض الأحياء (12ج، بطلب المستخدم: "تحسين شامل وإضافة تفاصيل أكثر للمباني والأحياء").
// طبقة واحدة فوق رسم المدن الـ24 بلا لمس طوابعها، بطابع منطقة كل مدينة (REGIONS)، رسم فقط وحتمية من موضع المربع:
// - جسم المبنى (box): ظل عند قاعدته، وضوء على أعلى وجهه المضاء، وحافة أمامية فاتحة، وأشياء على سطحه المسطح
//   (خزانات ماء، سخانات شمسية، صحون، مكيفات، حبال غسيل، أحواض نبات، وخزان خشبي على أسطح شيكاغو)
// - النوافذ (wL وwR بلون داكن صغير، وarch فوق الأرض): عتبة فاتحة، وأحواض زهور في أوروبا، ومكيفات في المدن الحديثة
//   والعربية، ومصاريع ملونة في الأمريكتين، وإطارات ملونة في أفريقيا
// - الأبواب (arch من قاعدة المبنى): عتبة حجرية، وأصيص نبات بطابع المنطقة بجانبها
// - أرض الحي الفارغة: أشياء صغيرة بطابع المنطقة (جرار، سجاد، سلال، براميل، دراجات، مقاعد، صناديق، صبار، حطب...)
// تعمل فقط أثناء رسم مبنى عادي أو أرض فارغة (beginDetail/endDetail في cityRender.js)، فلا تمس المباني المميزة ولا مباني
// الاقتصاد. ترسم بالسياق مباشرة بلا صبغ المالك (أشياء بألوانها). الأرقام في CITY_DETAIL في config.js
import { CITY_DETAIL as CD, REGIONS } from '../config.js';
import { gfx } from '../graphics.js';
import { getCtx, hsh, setDetailHooks } from './cityThemes.js';

const TAU = Math.PI * 2;
const REGION = new Map();
for (const r of REGIONS.order) for (const c of REGIONS[r].cities || []) REGION.set(c, r);

let busy = false, city = 'arab', region = 'arabic', modern = false, ti = 0, tj = 0, seq = 0, base = null;
// رقم ثابت لكل استعمال داخل المربع نفسه: الرسم بالترتيب نفسه دائماً
const rnd = () => hsh(ti, tj, 700 + (seq++ % 97));

// الخطافات يستدعيها cityThemes.js حين يكون on فقط، فلا كلفة على بقية الرسم
const HOOKS = { on: false, pre: null, box: null, win: null, arch: null };
export function beginDetail(c, i, j) {
  if (!CD.enabled || !gfx().detail) return;
  city = c; region = REGION.get(c) || 'arabic'; modern = CD.modern.includes(c);
  ti = i; tj = j; seq = 0; base = null; HOOKS.on = true;
}
export function endDetail() { flush(); HOOKS.on = false; base = null; }

// ما يتكرر مع كل نافذة (العتبات وآثار المطر وأحواض الزهور) يُجمع ويُرسم بمسارات قليلة: قبل كل جسم مبنى تالٍ
// (فلا يُرسم فوق جدار يغطيه) وفي آخر المربع
const PETALS = ['#e2484a', '#f2a8c2', '#f4d04a'];
const pend = { n: 0, sill: [], stain: [], fbox: [], leaf: [], petal: [[], [], []], shut: new Map(), frame: new Map() };
const addTo = (map, key, pts) => { let a = map.get(key); if (!a) map.set(key, a = []); a.push(...pts); };
function flush() {
  if (!pend.n) return;
  const ctx = getCtx(), seg = (list) => { ctx.beginPath(); for (let k = 0; k < list.length; k += 4) { ctx.moveTo(list[k], list[k + 1]); ctx.lineTo(list[k + 2], list[k + 3]); } };
  const dots = (list, r, ry) => { ctx.beginPath(); for (let k = 0; k < list.length; k += 2) { ctx.moveTo(list[k] + r, list[k + 1]); ctx.ellipse(list[k], list[k + 1], r, ry, 0, 0, TAU); } };
  if (pend.stain.length) { seg(pend.stain); ctx.strokeStyle = 'rgba(40,28,16,0.16)'; ctx.lineWidth = 0.9; ctx.stroke(); }
  if (pend.sill.length) { seg(pend.sill); ctx.strokeStyle = 'rgba(255,248,235,0.55)'; ctx.lineWidth = 0.7; ctx.stroke(); }
  if (pend.fbox.length) {
    ctx.beginPath();
    for (let k = 0; k < pend.fbox.length; k += 8) {
      ctx.moveTo(pend.fbox[k], pend.fbox[k + 1]);
      for (let m = 2; m < 8; m += 2) ctx.lineTo(pend.fbox[k + m], pend.fbox[k + m + 1]);
      ctx.closePath();
    }
    ctx.fillStyle = '#6b4a2e'; ctx.fill();
    dots(pend.leaf, 0.75, 0.6); ctx.fillStyle = '#4f8a3e'; ctx.fill();
    pend.petal.forEach((list, k) => { if (list.length) { dots(list, 0.42, 0.42); ctx.fillStyle = PETALS[k]; ctx.fill(); } });
  }
  for (const [col, list] of pend.shut) {                            // المصاريع: رباعيات بلون واحد في مسار واحد
    ctx.beginPath();
    for (let k = 0; k < list.length; k += 8) { ctx.moveTo(list[k], list[k + 1]); for (let m = 2; m < 8; m += 2) ctx.lineTo(list[k + m], list[k + m + 1]); ctx.closePath(); }
    ctx.fillStyle = col; ctx.fill();
  }
  for (const [col, list] of pend.frame) { seg(list); ctx.strokeStyle = col; ctx.lineWidth = 0.6; ctx.stroke(); }
  pend.shut.clear(); pend.frame.clear();
  pend.n = 0; pend.sill.length = 0; pend.stain.length = 0; pend.fbox.length = 0; pend.leaf.length = 0;
  for (const list of pend.petal) list.length = 0;
}

// --- أدوات رسم بالسياق مباشرة ---
const poly = (ctx, pts, col) => {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
  ctx.closePath(); ctx.fillStyle = col; ctx.fill();
};
const line = (ctx, a, b, col, w) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
const el = (ctx, x, y, rx, ry, col) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fillStyle = col; ctx.fill(); };
const cube = (ctx, x, y, w, h, L, R, T) => {
  const d = w / 2;
  poly(ctx, [[x - w, y], [x, y + d], [x, y + d - h], [x - w, y - h]], L);
  poly(ctx, [[x, y + d], [x + w, y], [x + w, y - h], [x, y + d - h]], R);
  poly(ctx, [[x - w, y - h], [x, y - d - h], [x + w, y - h], [x, y + d - h]], T);
};
const can = (ctx, x, y, r, h, side, top) => {
  ctx.beginPath(); ctx.moveTo(x - r, y - h); ctx.lineTo(x - r, y); ctx.ellipse(x, y, r, r / 2, 0, Math.PI, 0, true); ctx.lineTo(x + r, y - h);
  ctx.closePath(); ctx.fillStyle = side; ctx.fill();
  el(ctx, x, y - h, r, r / 2, top);
};
// لون داكن (نافذة أو باب)؟ من ستة أرقام سداسية فقط
const dark = (c) => {
  if (typeof c !== 'string' || c[0] !== '#' || c.length !== 7) return false;
  const n = parseInt(c.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.32;
};

// ================= جسم المبنى =================
function boxHook(x, y, w, d, h, T) {
  if (w < CD.minBox.w || h < CD.minBox.h) return;
  const ctx = getCtx();
  base = { x, y, w, d };
  ctx.fillStyle = 'rgba(24,16,8,' + CD.ao + ')';                  // ظل القاعدة
  ctx.beginPath();
  ctx.moveTo(x - w, y); ctx.lineTo(x, y + d); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y - 2.4); ctx.lineTo(x, y + d - 2.4); ctx.lineTo(x - w, y - 2.4);
  ctx.closePath(); ctx.fill();
  poly(ctx, [[x, y + d - h], [x + w, y - h], [x + w, y - h + 3], [x, y + d - h + 3]], 'rgba(255,248,230,' + CD.topLight + ')');
  line(ctx, [x, y + d - 0.6], [x, y + d - h + 0.4], 'rgba(255,250,240,' + CD.edge + ')', 0.5);
  if (T && rnd() < CD.roof) roofProps(ctx, x, y - h, w, d);
}

// نقطة على السطح المسطح: u وv من −1 إلى 1 على قطريه
const onRoof = (x, yt, w, d, u, v) => [x + (u - v) * w / 2, yt + (u + v) * d / 2];

const ROOF = {
  tank(ctx, x, y) {                                                // خزان ماء أبيض على قوائم
    line(ctx, [x - 1.6, y], [x - 1.6, y - 2.4], '#5a5650', 0.5); line(ctx, [x + 1.6, y], [x + 1.6, y - 2.4], '#5a5650', 0.5);
    can(ctx, x, y - 2.2, 2.2, 3.4, '#d9d6cc', '#efede6');
    line(ctx, [x - 2.2, y - 3.6], [x + 2.2, y - 3.6], 'rgba(0,0,0,0.15)', 0.5);
  },
  solar(ctx, x, y) {                                               // سخان شمسي: لوح مائل وخزان فوقه
    poly(ctx, [[x - 3, y], [x + 1.4, y + 2.2], [x + 2.8, y - 1.2], [x - 1.6, y - 3.4]], '#2c4a6a');
    line(ctx, [x - 0.8, y + 1], [x + 0.6, y - 2.3], 'rgba(255,255,255,0.3)', 0.4);
    can(ctx, x - 0.4, y - 3.2, 1.3, 0.1, '#e6e3da', '#e6e3da');
    poly(ctx, [[x - 2.6, y - 3.8], [x + 2.2, y - 1.6], [x + 2.2, y - 2.8], [x - 2.6, y - 5]], '#e6e3da');
  },
  dish(ctx, x, y) {                                                // صحن لاقط
    line(ctx, [x, y], [x, y - 2.2], '#6a6862', 0.6);
    ctx.save(); ctx.translate(x - 0.4, y - 3); ctx.rotate(-0.5);
    el(ctx, 0, 0, 2, 1.3, '#e8e6e0'); el(ctx, 0.3, 0.1, 1.4, 0.8, '#cfccc4');
    ctx.restore();
  },
  ac(ctx, x, y) { cube(ctx, x, y, 2, 1.8, '#9aa0a4', '#b8bdc0', '#c9cdd0'); el(ctx, x + 1, y - 0.6, 0.6, 0.6, '#5a5f63'); },
  laundry(ctx, x, y) {                                             // حبل غسيل بين عمودين بثياب ملونة
    line(ctx, [x - 3.5, y + 1.6], [x - 3.5, y - 3], '#6b5a44', 0.5); line(ctx, [x + 3.5, y - 1.6], [x + 3.5, y - 6.2], '#6b5a44', 0.5);
    line(ctx, [x - 3.5, y - 2.8], [x + 3.5, y - 6], 'rgba(60,50,40,0.7)', 0.35);
    ['#c8473a', '#3a7ab8', '#e8d24a', '#f2efe6'].forEach((c, k) => {
      const px = x - 2.6 + k * 1.8, py = y - 3.2 - k * 0.82;
      poly(ctx, [[px - 0.6, py], [px + 0.6, py - 0.3], [px + 0.6, py + 1.6], [px - 0.6, py + 1.9]], c);
    });
  },
  plants(ctx, x, y) {                                              // أحواض نبات
    for (const [dx, dy] of [[-1.6, 0.4], [1.4, -0.4]]) {
      cube(ctx, x + dx, y + dy, 1.2, 1.3, '#8a5a3a', '#a86c44', '#5a3a24');
      el(ctx, x + dx, y + dy - 2.2, 1.5, 1.2, '#4f8a3e'); el(ctx, x + dx - 0.4, y + dy - 2.8, 0.8, 0.6, '#6fae52');
    }
  },
  antenna(ctx, x, y) {
    line(ctx, [x, y], [x, y - 8], '#4a4a4e', 0.5);
    for (const k of [0, 1, 2]) line(ctx, [x - 1.6 + k * 0.4, y - 4 - k * 1.5], [x + 1.6 - k * 0.4, y - 4 - k * 1.5], '#4a4a4e', 0.4);
  },
  waterTower(ctx, x, y) {                                          // خزان ماء خشبي (شيكاغو ونيويورك القديمة)
    for (const dx of [-1.8, 1.8]) line(ctx, [x + dx, y], [x + dx * 0.8, y - 3.4], '#3a3430', 0.6);
    can(ctx, x, y - 3.2, 2.4, 4, '#7a5436', '#8a6040');
    for (const v of [4.2, 5.8]) line(ctx, [x - 2.4, y - v], [x + 2.4, y - v], '#3a3430', 0.4);
    poly(ctx, [[x - 2.7, y - 7.2], [x, y - 9.6], [x + 2.7, y - 7.2], [x, y - 6]], '#4a3a30');
  }
};
const ROOF_SET = { arabic: ['tank', 'solar', 'dish', 'laundry', 'ac'], african: ['tank', 'laundry', 'plants', 'dish'],
                   asian: ['tank', 'plants', 'laundry', 'ac'], european: ['plants', 'antenna', 'ac'], american: ['tank', 'laundry', 'plants', 'dish'] };
const ROOF_MODERN = { hk: ['ac', 'antenna', 'tank', 'ac'], chicago: ['waterTower', 'ac', 'antenna'], birmingham: ['antenna', 'ac', 'plants'] };

function roofProps(ctx, x, yt, w, d) {
  const set = ROOF_MODERN[city] || ROOF_SET[region] || ROOF_SET.arabic;
  const count = w > 11 && rnd() < 0.55 ? 2 : 1;
  for (let k = 0; k < count; k++) {
    // في الخلف أو على الجانبين لا في الوسط (القباب والطوابق العليا في وسط السطح غالباً)
    const u = k ? -0.45 : 0.15 + rnd() * 0.3, v = k ? 0.1 : -0.5 + rnd() * 0.2;
    const [px, py] = onRoof(x, yt, w, d, u, v);
    ROOF[set[Math.floor(rnd() * set.length)]](ctx, px, py);
  }
}

// ================= النوافذ =================
const SHUTTERS = ['#2f8a7a', '#3a6ea8', '#c8473a', '#6aa84f', '#e0a83a'];
const FRAMES = ['#2f6db3', '#3f9b5a', '#e0a83a', '#f2efe6'];
function winHook(q, u, v, du, dv, c) {
  if (du > 0.42 || dv < 1.5 || dv > 9 || !dark(c)) return;
  const ctx = getCtx();
  pend.n++;
  pend.sill.push(...q(u - 0.015, v - 0.2), ...q(u + du + 0.015, v - 0.2));                        // العتبة
  if (rnd() < CD.stains && v > 3) pend.stain.push(...q(u + du * 0.5, v - 0.5), ...q(u + du * 0.5, v - 1.6 - rnd() * 2));   // أثر المطر
  const r = rnd();
  if (region === 'european' && !modern && r < CD.flowers) {        // حوض زهور تحت النافذة
    pend.fbox.push(...q(u - 0.02, v - 1.5), ...q(u + du + 0.02, v - 1.5), ...q(u + du + 0.02, v - 0.3), ...q(u - 0.02, v - 0.3));
    for (let k = 0; k < 4; k++) {
      const p = q(u + du * (0.1 + k * 0.27), v - 0.1);
      pend.leaf.push(p[0], p[1]);
      pend.petal[k % 3].push(p[0] + 0.2, p[1] - 0.4);
    }
  } else if ((modern || region === 'arabic') && r < CD.ac) {       // مكيف تحت النافذة
    const p = q(u + du * 0.25, v - 2.6), w = q(u + du * 0.75, v - 2.6);
    poly(ctx, [p, w, [w[0], w[1] + 2], [p[0], p[1] + 2]], '#b8bdc0');
    line(ctx, [p[0], p[1] + 1], [w[0], w[1] + 1], '#7a8084', 0.4);
  } else if (region === 'american' && city !== 'chicago' && r < CD.shutters) {   // مصراعان ملونان
    const col = SHUTTERS[Math.floor(rnd() * SHUTTERS.length)], sw = Math.min(0.08, du * 0.45);
    addTo(pend.shut, col, [...q(u - sw - 0.01, v), ...q(u - 0.01, v), ...q(u - 0.01, v + dv), ...q(u - sw - 0.01, v + dv),
                           ...q(u + du + 0.01, v), ...q(u + du + sw + 0.01, v), ...q(u + du + sw + 0.01, v + dv), ...q(u + du + 0.01, v + dv)]);
  } else if (region === 'african' && r < CD.frames) {              // إطار ملون
    const col = FRAMES[Math.floor(rnd() * FRAMES.length)], A = q(u, v), B = q(u + du, v), C = q(u + du, v + dv), D2 = q(u, v + dv);
    addTo(pend.frame, col, [...A, ...B, ...B, ...C, ...C, ...D2, ...D2, ...A]);
  }
}

// ================= الأبواب (والنوافذ المقوسة) =================
// باب = قوس يبدأ من قاعدة آخر جسم مبنى رُسم؛ وإلا فنافذة مقوسة: عتبة تحتها فقط
function onBase(p) {
  if (!base) return false;
  const { x, y, w, d } = base;
  if (p[0] < x - w - 0.5 || p[0] > x + w + 0.5) return false;
  const by = p[0] <= x ? y + (p[0] - (x - w)) / w * d : y + d - (p[0] - x) / w * d;
  return Math.abs(p[1] - by) < 0.8;
}
const POTS = {
  arabic: (ctx, x, y) => { poly(ctx, [[x - 1.2, y], [x + 1.2, y], [x + 1.5, y - 2.4], [x - 1.5, y - 2.4]], '#b8743e');      // نخلة صغيرة في جرة
    for (const a of [-2.4, -1.6, -0.9, -0.2, 0.5]) line(ctx, [x, y - 3.4], [x + Math.cos(a) * 2.6, y - 3.4 + Math.sin(a) * 1.6 + 0.8], '#4f8a3e', 0.6);
    line(ctx, [x, y - 2.4], [x, y - 3.6], '#7a5a3a', 0.6); },
  african: (ctx, x, y) => { el(ctx, x, y - 1.2, 1.5, 1.4, '#9a5a32'); el(ctx, x, y - 2.4, 0.9, 0.4, '#5a3220');
    for (const a of [-2.2, -1.2, -0.3]) line(ctx, [x, y - 2.4], [x + Math.cos(a) * 1.8, y - 2.6 + Math.sin(a) * 2], '#5f9a3e', 0.6); },
  asian: (ctx, x, y) => { cube(ctx, x, y, 1.3, 1.4, '#3a4a5a', '#4a5f72', '#2a3440'); el(ctx, x, y - 2.6, 1.8, 1.1, '#3f7a3e');
    el(ctx, x + 0.6, y - 3.3, 1, 0.7, '#5f9a4e'); },
  european: (ctx, x, y) => { poly(ctx, [[x - 1.1, y], [x + 1.1, y], [x + 1.3, y - 2], [x - 1.3, y - 2]], '#b0653e');
    el(ctx, x, y - 3, 1.6, 1.3, '#4f8a3e'); for (const [dx, dy] of [[-0.6, -3.4], [0.6, -3], [0, -4]]) el(ctx, x + dx, y + dy, 0.35, 0.35, '#e2484a'); },
  american: (ctx, x, y) => { poly(ctx, [[x - 1.1, y], [x + 1.1, y], [x + 1.3, y - 1.8], [x - 1.3, y - 1.8]], '#c8673a');     // صبار
    ctx.beginPath(); ctx.moveTo(x, y - 1.8); ctx.lineTo(x, y - 5.6); ctx.moveTo(x, y - 3.4); ctx.lineTo(x - 1.2, y - 3.6); ctx.lineTo(x - 1.2, y - 4.8);
    ctx.moveTo(x, y - 4); ctx.lineTo(x + 1.1, y - 4.2); ctx.lineTo(x + 1.1, y - 5.2); ctx.strokeStyle = '#3f8a4a'; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.stroke(); }
};
function archHook(q, u, du, dv, c) {
  if (!dark(c) || du > 0.5) return;
  const ctx = getCtx(), a = q(u, 0), b = q(u + du, 0);
  if (onBase(a) && dv >= 5) {
    poly(ctx, [[a[0] - 0.6, a[1] + 0.3], [b[0] + 0.6, b[1] + 0.3], [b[0] + 1.6, b[1] + 1.1], [a[0] + 0.4, a[1] + 1.1]], 'rgba(205,195,175,0.9)');   // عتبة حجرية
    if (rnd() < CD.pot) {
      const left = a[0] < b[0] ? a : b, right = a[0] < b[0] ? b : a, side = rnd() < 0.5;
      const p = side ? [left[0] - 1.6, left[1] + 1] : [right[0] + 1.8, right[1] + 1];
      (POTS[region] || POTS.arabic)(ctx, p[0], p[1]);
    }
  } else if (dv <= 9) line(ctx, q(u - 0.015, -0.2), q(u + du + 0.015, -0.2), 'rgba(255,248,235,0.5)', 0.65);
}

// ================= أرض الحي الفارغة =================
const GROUND = {
  jars(ctx, x, y, dark2) {
    const c = dark2 ? ['#5a3a2a', '#3a2418'] : ['#b8743e', '#8a5230'];
    for (const [dx, dy, s] of [[-1.6, 0, 1], [1, 0.8, 0.85], [0.2, -1, 0.7]]) {
      el(ctx, x + dx, y + dy - 1.8 * s, 1.5 * s, 1.9 * s, c[0]); el(ctx, x + dx, y + dy - 3.6 * s, 0.8 * s, 0.35 * s, c[1]);
      el(ctx, x + dx - 0.5 * s, y + dy - 2.2 * s, 0.4 * s, 0.9 * s, 'rgba(255,255,255,0.18)');
    }
  },
  rug(ctx, x, y) {
    poly(ctx, [[x - 6, y], [x, y - 3], [x + 6, y], [x, y + 3]], '#a8322a');
    poly(ctx, [[x - 4.4, y], [x, y - 2.2], [x + 4.4, y], [x, y + 2.2]], '#d9a44a');
    poly(ctx, [[x - 2.6, y], [x, y - 1.3], [x + 2.6, y], [x, y + 1.3]], '#2f4a7a');
  },
  crates(ctx, x, y) {
    cube(ctx, x - 1.4, y + 0.6, 2.2, 3, '#7a5a3a', '#9a7448', '#a88452');
    cube(ctx, x + 2, y + 0.2, 1.8, 2.4, '#7a5a3a', '#9a7448', '#a88452');
    cube(ctx, x - 1.4, y - 2.4, 1.6, 2, '#7a5a3a', '#9a7448', '#a88452');
  },
  barrels(ctx, x, y) {
    for (const [dx, dy] of [[-1.6, 0], [1.6, 0.6]]) {
      can(ctx, x + dx, y + dy, 1.5, 3.4, '#6b4a2e', '#8a6440');
      line(ctx, [x + dx - 1.5, y + dy - 1], [x + dx + 1.5, y + dy - 1], '#3a3430', 0.4);
      line(ctx, [x + dx - 1.5, y + dy - 2.4], [x + dx + 1.5, y + dy - 2.4], '#3a3430', 0.4);
    }
  },
  basket(ctx, x, y) {
    el(ctx, x, y - 1, 2.6, 1.6, '#b08a4a'); el(ctx, x, y - 1.8, 2.2, 0.9, '#7a5a2a');
    for (const [dx, col] of [[-1, '#e2484a'], [0, '#f4a83a'], [1, '#6aae4a'], [0.4, '#e2484a']]) el(ctx, x + dx, y - 2.2, 0.55, 0.45, col);
  },
  bicycle(ctx, x, y) {
    ctx.lineWidth = 0.45; ctx.strokeStyle = '#2f3236';
    for (const dx of [-2.2, 2.2]) { ctx.beginPath(); ctx.ellipse(x + dx, y - 1.4 + dx * 0.25, 1.4, 1.4, 0, 0, TAU); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x - 2.2, y - 1.95); ctx.lineTo(x - 0.4, y - 3.6); ctx.lineTo(x + 1.2, y - 2.1); ctx.lineTo(x - 0.6, y - 1.6); ctx.closePath();
    ctx.moveTo(x + 1.2, y - 2.1); ctx.lineTo(x + 2.2, y - 0.85); ctx.moveTo(x - 0.4, y - 3.6); ctx.lineTo(x - 0.6, y - 4.4);
    ctx.strokeStyle = city === 'china' || city === 'kaifeng' ? '#2f3236' : '#b8432e'; ctx.lineWidth = 0.6; ctx.stroke();
  },
  bench(ctx, x, y) {
    poly(ctx, [[x - 4, y - 1.6], [x + 1, y + 0.9], [x + 1, y + 0.1], [x - 4, y - 2.4]], '#7a5a3a');
    poly(ctx, [[x - 4, y - 2.4], [x + 1, y + 0.1], [x + 1.7, y - 0.3], [x - 3.3, y - 2.8]], '#9a7448');
    poly(ctx, [[x - 4, y - 2.4], [x + 1, y + 0.1], [x + 1, y - 1.9], [x - 4, y - 4.4]], '#8a6440');
    line(ctx, [x - 3.6, y - 1.4], [x - 3.6, y + 0.2], '#3a3430', 0.5); line(ctx, [x + 0.6, y + 0.8], [x + 0.6, y + 2.2], '#3a3430', 0.5);
  },
  woodpile(ctx, x, y) {
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - r; k++) {
      const px = x - 2.4 + k * 1.6 + r * 0.8, py = y - r * 1.4;
      el(ctx, px, py - 0.8, 0.85, 0.85, '#8a6440'); el(ctx, px, py - 0.8, 0.45, 0.45, '#c9a06a');
    }
  },
  cactus(ctx, x, y) { POTS.american(ctx, x, y + 0.6); },
  planter(ctx, x, y) { (POTS[region] || POTS.european)(ctx, x, y + 0.6); },
  trash(ctx, x, y) {
    can(ctx, x - 1, y + 0.3, 1.4, 2.8, '#6a7076', '#8a9096');
    poly(ctx, [[x + 0.6, y + 0.6], [x + 3, y - 0.4], [x + 3.4, y + 0.8], [x + 1, y + 1.6]], '#3a3a3e');   // كيس قمامة
  },
  hydrant(ctx, x, y) { can(ctx, x, y, 0.9, 2.6, '#c8392f', '#e05a48'); el(ctx, x, y - 3, 0.6, 0.6, '#c8392f'); line(ctx, [x - 1.3, y - 1.6], [x + 1.3, y - 1.6], '#a82a22', 0.7); },
  lantern(ctx, x, y) {                                             // فانوس حجري ياباني
    cube(ctx, x, y, 1, 1, '#8c8a84', '#a3a19a', '#b5b3ac'); cube(ctx, x, y - 1, 0.5, 2, '#8c8a84', '#a3a19a', '#b5b3ac');
    cube(ctx, x, y - 3, 1.3, 1.3, '#8c8a84', '#a3a19a', '#b5b3ac'); el(ctx, x + 0.4, y - 3.6, 0.4, 0.4, '#f2d070');
    poly(ctx, [[x - 2.2, y - 4.3], [x, y - 5.6], [x + 2.2, y - 4.3], [x, y - 3.3]], '#7a7872');
  },
  cart(ctx, x, y) {
    poly(ctx, [[x - 4, y - 1.4], [x + 1, y + 1.1], [x + 1, y - 0.6], [x - 4, y - 3.1]], '#8a6440');
    poly(ctx, [[x - 4, y - 3.1], [x + 1, y - 0.6], [x + 2.6, y - 1.4], [x - 2.4, y - 3.9]], '#a87c4c');
    ctx.beginPath(); ctx.ellipse(x - 1.4, y + 0.2, 1.5, 1.5, 0, 0, TAU); ctx.strokeStyle = '#4a3424'; ctx.lineWidth = 0.6; ctx.stroke();
    line(ctx, [x + 1, y - 0.6], [x + 4.4, y + 0.6], '#6b4a2e', 0.6);
  }
};
const GROUND_SET = {
  arabic: ['jars', 'rug', 'crates', 'cart', 'planter'], african: ['jars', 'basket', 'woodpile', 'cart'],
  asian: ['basket', 'bicycle', 'planter', 'jars', 'crates'], european: ['barrels', 'crates', 'bench', 'bicycle', 'planter'],
  american: ['crates', 'barrels', 'cactus', 'bicycle', 'trash']
};
const GROUND_CITY = { japan: ['lantern', 'planter', 'basket', 'bicycle'], gyeongju: ['jars', 'planter', 'basket'], chicago: ['trash', 'hydrant', 'crates', 'barrels'],
                      hk: ['bicycle', 'crates', 'trash', 'planter'], norway: ['woodpile', 'barrels', 'crates', 'bench'], birmingham: ['barrels', 'crates', 'trash', 'bench'],
                      laboca: ['crates', 'barrels', 'trash', 'bicycle'] };

const ARID = ['arabic', 'african'];
export function detailGround(x, y, i, j, c, snow = false) {
  if (!CD.enabled || !gfx().detail) return;
  beginDetail(c, i, j);
  const ctx0 = getCtx(), arid = ARID.includes(region) || c === 'tenoch' || c === 'mexico';
  ctx0.beginPath();                                                // حصى في المدن الجافة، وخصل عشب في غيرها: مسار واحد
  for (let k = 0; k < (snow ? 0 : CD.tufts); k++) {
    const dx = (rnd() - 0.5) * 22, dy = (rnd() - 0.5) * 10;
    if (Math.abs(dx) / 18 + Math.abs(dy) / 9 > 0.8) continue;
    if (arid) { ctx0.moveTo(x + dx + 1, y + dy); ctx0.ellipse(x + dx, y + dy, 1, 0.45, 0, 0, TAU); }
    else for (const a of [-0.5, 0, 0.5]) { ctx0.moveTo(x + dx, y + dy); ctx0.lineTo(x + dx + a * 1.4, y + dy - 1.6); }
  }
  if (arid) { ctx0.fillStyle = 'rgba(110,88,60,0.45)'; ctx0.fill(); }
  else { ctx0.strokeStyle = 'rgba(70,120,50,0.55)'; ctx0.lineWidth = 0.45; ctx0.stroke(); }
  if (rnd() < CD.ground) {
    const ctx = getCtx(), set = GROUND_CITY[c] || GROUND_SET[region];
    const count = rnd() < 0.4 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const name = set[Math.floor(rnd() * set.length)];
      const dx = (k ? 4.5 : -3.5) + (rnd() - 0.5) * 3, dy = (k ? -1.2 : 1.2) + (rnd() - 0.5) * 1.6;
      ctx.save();
      GROUND[name](ctx, x + dx, y + dy, c === 'gyeongju');
      ctx.restore();
    }
  }
  endDetail();
}

// --- الربط بأدوات الرسم في cityThemes.js (busy يمنع الدخول المتكرر، وأشياء التفاصيل ترسم بالسياق مباشرة أصلاً) ---
HOOKS.pre = () => { if (!busy) flush(); };
HOOKS.box = (x, y, w, d, h, T) => { if (busy) return; busy = true; boxHook(x, y, w, d, h, T); busy = false; };
HOOKS.win = (q, u, v, du, dv, c) => { if (busy) return; busy = true; winHook(q, u, v, du, dv, c); busy = false; };
HOOKS.arch = (q, u, du, dv, c) => { if (busy) return; busy = true; archHook(q, u, du, dv, c); busy = false; };
setDetailHooks(HOOKS);
