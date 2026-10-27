// قطع مشتركة للمباني المحلية ومعالم المدن (بطلب المستخدم: كل مدينة بمتاجرها وأسواقها ومقاهيها، ومعلم
// يميز منطقتها في وسطها). كلها بأدوات cityThemes.js فتمر ألوانها عبر paint() (صبغ المالك والطقس)،
// وحتمية من الموضع (نفس الخريطة ← نفس الرسم). الأرقام شكل فقط مثل بقية الطوابع.
import { getCtx, paint, TAU, poly, circ, ln, rc, el, box } from './cityThemes.js';

// مظلة مخططة على واجهة: q دالة الواجهة (qR أو qL)، side 1 للواجهة اليمنى و-1 لليسرى،
// من u0 إلى u1 على الارتفاع v، تميل للخارج out وتنزل drop
export function awning(q, side, u0, u1, v, cols, n = 6, drop = 2.6, out = 1.8) {
  const du = (u1 - u0) / n;
  for (let k = 0; k < n; k++) {
    const A = q(u0 + k * du, v), B = q(u0 + (k + 1) * du, v);
    poly([A, B, [B[0] + side * out, B[1] + drop], [A[0] + side * out, A[1] + drop]], cols[k % cols.length]);
  }
}

// بسطة سوق: طاولة خشب ببضاعة ملونة، وعمودان، ومظلة (canopy: لونان للتخطيط، أو لون واحد)
export function stall(px, py, goods, canopy, wood = '#7a5a3a') {
  el(px, py + 0.5, 4.2, 1.8, 'rgba(0,0,0,0.18)');
  box(px, py, 3.6, 1.8, 2.4, wood, '#8e6a46', '#a07a52');
  for (let k = 0; k < 3; k++) circ(px - 1.8 + k * 1.8, py - 2.9 + (k - 1) * 0.15, 0.6, goods[k % goods.length]);
  ln(px - 3.4, py - 0.2, px - 3.4, py - 6.6, '#5a4030', 0.5);
  ln(px + 3.4, py - 0.2, px + 3.4, py - 6.6, '#5a4030', 0.5);
  for (let k = 0; k < 4; k++) {
    const u0 = -3.9 + k * 1.95, u1 = u0 + 1.95;
    poly([[px + u0, py - 6.9], [px + u1, py - 6.9], [px + u1, py - 5.3], [px + u0, py - 5.3]], canopy[k % canopy.length]);
  }
  poly([[px - 3.9, py - 6.9], [px + 3.9, py - 6.9], [px + 3.1, py - 8.4], [px - 3.1, py - 8.4]], canopy[0]);
}

// سلال مستديرة بأكوام من البهارات أو التمر أو الحبوب: n سلة متتالية على خط مائل
export function baskets(px, py, cols, n = 3, basket = '#9a7448') {
  for (let k = 0; k < n; k++) {
    const bx = px + k * 2.6, by = py - k * 1.3;
    el(bx, by + 0.4, 1.4, 0.7, 'rgba(0,0,0,0.18)');
    el(bx, by, 1.3, 0.65, basket);
    poly([[bx - 1.2, by - 0.2], [bx, by - 1.9], [bx + 1.2, by - 0.2]], cols[k % cols.length]);
  }
}

// سجادة على الأرض (معين) بإطار، ومساند على حافتها الخلفية
export function carpet(px, py, w, d, col, border, cushion) {
  poly([[px - w, py], [px, py - d], [px + w, py], [px, py + d]], border);
  poly([[px - w * 0.8, py], [px, py - d * 0.8], [px + w * 0.8, py], [px, py + d * 0.8]], col);
  if (cushion) {
    box(px - w * 0.5, py - d * 0.5 + 0.3, w * 0.42, d * 0.42, 1.3, cushion, cushion, cushion);
    box(px + w * 0.5, py - d * 0.5 + 0.3, w * 0.42, d * 0.42, 1.3, cushion, cushion, cushion);
  }
}

// دلة قهوة عربية بحجم s: قاعدة وبطن ورقبة وغطاء مدبب ومنقار طويل
export function dallah(px, py, s, col = '#c9a04a', shade = '#9a7a34') {
  el(px, py, 1.6 * s, 0.7 * s, shade);
  poly([[px - 1.6 * s, py], [px - 1.1 * s, py - 2.6 * s], [px + 1.1 * s, py - 2.6 * s], [px + 1.6 * s, py]], col);
  poly([[px - 0.7 * s, py - 2.6 * s], [px - 0.5 * s, py - 4.2 * s], [px + 0.5 * s, py - 4.2 * s], [px + 0.7 * s, py - 2.6 * s]], shade);
  poly([[px - 0.9 * s, py - 4.2 * s], [px, py - 5.6 * s], [px + 0.9 * s, py - 4.2 * s]], col);
  circ(px, py - 5.9 * s, 0.3 * s, col);
  const c = getCtx();
  c.beginPath(); c.moveTo(px + 1.2 * s, py - 1.6 * s); c.quadraticCurveTo(px + 2.6 * s, py - 2.4 * s, px + 3 * s, py - 4.4 * s);
  c.strokeStyle = paint(col); c.lineWidth = 0.55 * s; c.lineCap = 'round'; c.stroke();
}

// فناجين صغيرة على خط
export function cups(px, py, n = 3, col = '#f2ede0') {
  for (let k = 0; k < n; k++) poly([[px + k * 1.3 - 0.45, py - k * 0.2], [px + k * 1.3 + 0.45, py - k * 0.2], [px + k * 1.3 + 0.3, py - 0.7 - k * 0.2], [px + k * 1.3 - 0.3, py - 0.7 - k * 0.2]], col);
}

// موقد صغير بجمر متوهج (قهوة المجلس)
export function firePit(px, py) {
  el(px, py, 1.8, 0.9, '#5a4a3a');
  el(px, py - 0.3, 1.3, 0.6, '#e8742a');
  circ(px - 0.4, py - 0.6, 0.35, '#ffd25a');
  circ(px + 0.5, py - 0.5, 0.3, '#ffb03a');
}

// أرجيلة: قاعدة زجاجية وعمود وصحن الجمر وخرطوم
export function shisha(px, py, glass = '#3f8f8a') {
  el(px, py - 1, 1.1, 1.1, glass);
  ln(px, py - 2, px, py - 5.4, '#c9a04a', 0.5);
  el(px, py - 5.6, 0.8, 0.35, '#7a5a3a');
  circ(px, py - 6, 0.35, '#e8742a');
  const c = getCtx();
  c.beginPath(); c.moveTo(px, py - 3.4); c.quadraticCurveTo(px + 2.6, py - 3, px + 2.8, py - 0.6);
  c.strokeStyle = paint('#4a3a2e'); c.lineWidth = 0.35; c.stroke();
}

// جرار ومرطبانات (عسل، زيت، مخللات) على خط
export function jars(px, py, n, cols) {
  for (let k = 0; k < n; k++) {
    const jx = px + k * 1.6, jy = py - k * 0.8, col = cols[k % cols.length];
    el(jx, jy - 0.9, 0.7, 0.95, col);
    rc(jx - 0.35, jy - 2.2, 0.7, 0.45, '#5a4030');
  }
}

// صف معلّقات على حبل بين نقطتين: فوانيس ملونة، أو أعلام، أو قماش
export function hangRow(A, B, n, cols, shape = 'lantern') {
  ln(A[0], A[1], B[0], B[1], '#3a3028', 0.3);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, px = A[0] + (B[0] - A[0]) * t, py = A[1] + (B[1] - A[1]) * t + Math.sin(t * Math.PI) * 1.2;
    const col = cols[k % cols.length];
    if (shape === 'lantern') {
      ln(px, py, px, py + 0.8, '#3a3028', 0.3);
      poly([[px - 0.7, py + 0.8], [px + 0.7, py + 0.8], [px + 0.9, py + 2.2], [px, py + 3.2], [px - 0.9, py + 2.2]], col);
    } else if (shape === 'flag') {
      poly([[px - 0.8, py], [px + 0.8, py], [px, py + 1.8]], col);
    } else {
      rc(px - 0.7, py, 1.4, 2.6, col);
    }
  }
}

// ساحة المعلم: رصف معين المربع بحافة داكنة وخط داخلي، تحت قاعدته (المعلم على قطعة مبنى في وسط المدينة)
export function plaza(x, y, top, edge, s = 1) {
  const w = 14.5 * s, d = 7.25 * s;
  poly([[x - w, y + 0.8], [x, y + d + 0.8], [x + w, y + 0.8], [x, y - d + 0.8]], edge);
  poly([[x - w, y], [x, y + d], [x + w, y], [x, y - d]], top);
  const c = getCtx();
  c.beginPath();
  c.moveTo(x - w * 0.72, y); c.lineTo(x, y + d * 0.72); c.lineTo(x + w * 0.72, y); c.lineTo(x, y - d * 0.72); c.closePath();
  c.strokeStyle = paint('rgba(0,0,0,0.14)'); c.lineWidth = 0.5; c.stroke();
}

// قاعدة متدرجة للتمثال: درجتان
export function plinth(x, y, w, h, L, R, T) {
  box(x, y, w, w / 2, h * 0.4, L, R, T);
  box(x, y - h * 0.4, w * 0.72, w * 0.36, h * 0.6, L, R, T);
  return y - h;
}

// أعمدة إنارة صغيرة على ركني الساحة الخلفيين (قبل المعلم) أو الأماميين (بعده)
export function plazaLamps(x, y, back, col = '#f2d58a', s = 1) {
  const pts = back ? [[-9 * s, -3.2 * s], [9 * s, -3.2 * s]] : [[-9 * s, 3.2 * s], [9 * s, 3.2 * s]];
  for (const [dx, dy] of pts) {
    const px = x + dx, py = y + dy;
    ln(px, py, px, py - 9, '#2b2825', 0.7);
    poly([[px - 1.2, py - 9], [px, py - 11.2], [px + 1.2, py - 9], [px, py - 8.4]], '#2b2825');
    rc(px - 0.6, py - 10.2, 1.2, 1.1, col);
  }
}

// قوس نصف دائري (بوابة أو عقد) بين نقطتين على الشاشة
export function arc2(cx, cy, rx, ry, col, w) {
  const c = getCtx();
  c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, Math.PI, TAU);
  c.strokeStyle = paint(col); c.lineWidth = w; c.stroke();
}

// تركيب إضافات مدينة على طابعها: local = { city: { split, add, draw } }
// - split: نوع المبنى الرئيسي الذي تُقتطع منه أوزان الأنواع المحلية add ([[نوع، وزن]...]) في كل pool
//   (وأنماط الأحياء styles)، وتوضع بعده مباشرة: مجموع الأوزان وترتيب بقية الأنواع كما هما، فكل قطعة
//   تبقى مبنى أو أرضاً أو أطلالاً كما كانت (الشوارع والأحياء والممرات لا تتغير)، ويتغير شكل المبنى فقط
// - draw: دوال رسم الأنواع الجديدة ومعلم المدينة (monument)، وlight (اختياري): إضاءة المعلم ليلاً
export function installLocal(THEMES, local) {
  for (const [city, add] of Object.entries(local)) {
    const T = THEMES[city];
    if (!T) continue;
    const pools = T.styles ? T.styles.map(style => style.pool) : [T.pool];
    for (const pool of pools) {
      const k = pool.findIndex(([kind]) => kind === add.split);
      if (k < 0) continue;
      // add بالنسبة المئوية من وزن المبنى الرئيسي (فيعمل مع أي pool)، مقربة لأعداد صحيحة: الجمع والطرح
      // دقيقان تماماً، فحدود بقية الأنواع في pickWeighted لا تتحرك ولو بكسر صغير
      const total = pool[k][1], parts = add.add.map(([kind, w]) => [kind, Math.round(w * total / 100)]).filter(([, w]) => w > 0);
      const rest = total - parts.reduce((sum, [, w]) => sum + w, 0);
      pool.splice(k, 1, [add.split, rest], ...parts);
    }
    Object.assign(T.draw, add.draw);
    if (add.light) T.monumentLight = add.light;   // إضاءة المعلم ليلاً (chunkCache)، وإلا وهج دافئ عام
  }
}

// عريش من سعف النخيل على أربعة أعمدة: ظل للبسطات والمجالس في المدن العربية
export function areesh(px, py, w, d, h, frond = ['#b8935a', '#94703f']) {
  const corners = [[-w, 0], [0, -d], [w, 0], [0, d]];
  for (const [dx, dy] of corners) ln(px + dx * 0.88, py + dy * 0.88, px + dx * 0.88, py + dy * 0.88 - h, '#6a4a2e', 0.6);
  const top = corners.map(([dx, dy]) => [px + dx, py + dy - h]);
  poly([top[0], top[3], top[2], [top[2][0], top[2][1] + 0.9], [top[3][0], top[3][1] + 0.9], [top[0][0], top[0][1] + 0.9]], frond[1]);
  poly(top, frond[0]);
  for (let k = 1; k < 7; k++) {
    const t = k / 7;
    const A = [top[0][0] + (top[1][0] - top[0][0]) * t, top[0][1] + (top[1][1] - top[0][1]) * t];
    const B = [top[3][0] + (top[2][0] - top[3][0]) * t, top[3][1] + (top[2][1] - top[3][1]) * t];
    ln(A[0], A[1], B[0], B[1], frond[1], 0.45);
  }
}

// مبخرة خشبية بجمر ودخان خفيف
export function incense(px, py) {
  box(px, py, 1, 0.5, 1.6, '#7a4a2e', '#9a5a36', '#b06a40');
  el(px, py - 2, 0.9, 0.4, '#5a3a24');
  circ(px, py - 2.1, 0.35, '#e8742a');
  const c = getCtx();
  c.save(); c.globalAlpha = 0.4; c.beginPath();
  c.moveTo(px, py - 2.4); c.quadraticCurveTo(px - 1.2, py - 4.4, px + 0.4, py - 6.2);
  c.moveTo(px + 0.2, py - 2.4); c.quadraticCurveTo(px + 1.4, py - 4.8, px + 0.9, py - 7.4);
  c.strokeStyle = paint('#e8e2d6'); c.lineWidth = 0.5; c.stroke();
  c.restore();
}

// نقطة على الأرض بإحداثيات المربع (u على i، v على j) حول مركز على الشاشة، ومكعب بأبعاد حرة:
// a نصف طوله على i، وb نصف طوله على j (box() يرسم المربع المتساوي الأضلاع فقط)
export const isoAt = (x, y, u, v) => [x + (u - v) * 18, y + (u + v) * 9];
export function isoBox(x, y, a, b, h, L, R, T) {
  const left = isoAt(x, y, -a, b), front = isoAt(x, y, a, b), right = isoAt(x, y, a, -b), back = isoAt(x, y, -a, -b);
  const up = (p) => [p[0], p[1] - h];
  poly([left, front, up(front), up(left)], L);
  poly([front, right, up(right), up(front)], R);
  if (T) poly([up(left), up(front), up(right), up(back)], T);
}
