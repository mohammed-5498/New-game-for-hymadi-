// مباني الاقتصاد بطراز كل منطقة ومدينة (القسم 3.12، المرحلة 11هـ، بطلب المستخدم): برج الرماية والمستشفى
// - لكل مدينة برجها من عمارة منطقتها (نجدي، يمني، ياباني، صيني، كوري، راجبوتي، برج أوروبي مستدير، خشبي نرويجي،
//   قوطي من الحجر الجيري، ساحلي أفريقي، حجري حبشي، استعماري، مدرّج أزتيكي، صفيح ملون) بألوان المدينة
// - المستشفى مبنى أفتح بنوافذ صفوف ومظلة مدخل ولوحة على الواجهة، وسقفه من طراز المنطقة، وعلامته
//   الهلال الأحمر في المدن العربية والمسلمة والصليب الأحمر في غيرها (MEDIC في config.js)
// - وكل مبنى بحجم حيه (القسم 3.12: "يتأقلم مع حدوده"): الصغير أقصر وأبسط، والكبير أعلى بطابق أو شرفة وراية
// كلها على مربع واحد داخل معينه، فيبقى ترتيب الرسم كما هو. واليمامة بصورها (EMPIRE.art) لا تمر من هنا.
import { poly, circ, ln, box, qL, qR, wL, wR, arch, ridgeRoof, dome, cyl, cone, asRoof, mixc, hsh, bellGable, getCtx, glow, el } from './cityThemes.js';
import { MEDIC, EMPIRE } from '../config.js';

const lt = (c, t = 0.22) => mixc(c, '#ffffff', t), dk = (c, t = 0.18) => mixc(c, '#000000', t);
const DARK = '#2a2420';

// ارتفاع كل حجم ومزاياه: الكبير أعلى وبطابق إضافي، والصغير أقصر
const SIZES = { small: { h: 0.8, big: false, small: true }, medium: { h: 1, big: false }, large: { h: 1.2, big: true } };
export const sizeStyle = (size) => SIZES[size] || SIZES.medium;

// --- أدوات الأشكال ---
// جذع مخروطي مربع: قاعدته نصف عرضها w0 وقمته w1 (الأسوار الطينية تضيق للأعلى)
function frustum(x, y, w0, w1, h, L, R, top) {
  const d0 = w0 / 2, d1 = w1 / 2;
  poly([[x - w0, y], [x, y + d0], [x, y + d1 - h], [x - w1, y - h]], L);
  poly([[x, y + d0], [x + w0, y], [x + w1, y - h], [x, y + d1 - h]], R);
  if (top) asRoof(() => poly([[x - w1, y - h], [x, y - d1 - h], [x + w1, y - h], [x, y + d1 - h]], top));
}
// نقطة على وجه الجذع: u من الركن الجانبي (0) إلى الأمامي (1)، وv الارتفاع
const fL = (x, y, w0, w1, h) => (u, v) => { const w = w0 + (w1 - w0) * v / h; return [x - w + u * w, y + u * w / 2 - v]; };
const fR = (x, y, w0, w1, h) => (u, v) => { const w = w0 + (w1 - w0) * v / h; return [x + u * w, y + w / 2 - u * w / 2 - v]; };
const quad = (q, u, v, du, dv, c) => poly([q(u, v), q(u + du, v), q(u + du, v + dv), q(u, v + dv)], c);
const tri = (q, u, v, du, dv, c) => poly([q(u, v), q(u + du, v), q(u + du / 2, v + dv)], c);

// نقاط على حواف سطح مربع (نصف عرضه W وعمقه W/2) عند الارتفاع yt: الخلفيتان أو الأماميتان
function rim(x, yt, W, back, n = 4) {
  const D = W / 2, pts = [];
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) / n;
    if (back) pts.push([x - W + u * W, yt - u * D], [x + u * W, yt - D + u * D]);
    else pts.push([x - W + u * W, yt + u * D], [x + u * W, yt + D - u * D]);
  }
  return pts;
}
// شُرَف مربعة فوق سطح (الخلفية قبل السطح والأمامية بعده: drawTop بينهما)
function merlons(x, yt, W, L, R, top, drawTop, n = 4, mw = 1.5, mh = 2.6) {
  for (const [px, py] of rim(x, yt, W, true, n)) box(px, py, mw, mw / 2, mh, L, R, top);
  drawTop();
  for (const [px, py] of rim(x, yt, W, false, n)) box(px, py, mw, mw / 2, mh, L, R, top);
}
// شُرَف مثلثة (نجدية): مسننات على حواف السطح الأمامية والخلفية
function teeth(x, yt, W, col, n = 5, th = 3) {
  for (const back of [true, false]) {
    for (const [px, py] of rim(x, yt, W, back, n)) poly([[px - 1.2, py], [px, py - th], [px + 1.2, py]], col);
  }
}
// راية صغيرة على سارية فوق القمة (للبرج الكبير)
function pennant(x, yt, col) {
  ln(x, yt, x, yt - 9, '#3a322a', 0.9);
  poly([[x, yt - 9], [x + 6, yt - 7.5], [x, yt - 6]], col);
}

// ================= أبراج الرماية =================
// كل دالة: (x, y, i, j, T, s) بمركز المربع وطابع المدينة وحجم الحي
const TOWERS = {
  // نجدي (العربية والدرعية والقاهرة): جذع طيني يضيق، ونطاق جص أبيض، وفتحات مثلثة، وشُرَف مسننة، وميازيب خشبية
  najdi(x, y, i, j, T, s) {
    const L = T.wallL, R = T.wallR, h = 30 * s.h, w0 = 10.5, w1 = 8;
    box(x, y + 1, 11.5, 5.75, 1.5, dk(L, 0.2), dk(R, 0.2), lt(R, 0.1));
    frustum(x, y, w0, w1, h, L, R, lt(R, 0.18));
    const ql = fL(x, y, w0, w1, h), qr = fR(x, y, w0, w1, h);
    quad(ql, 0, h - 6, 1, 3, lt(L, 0.45)); quad(qr, 0, h - 6, 1, 3, lt(R, 0.45));      // نطاق الجص
    for (const q of [ql, qr]) for (let k = 0; k < 3; k++) tri(q, 0.18 + k * 0.25, h - 10, 0.12, -2.4, DARK);
    for (let r = 0; r < (s.small ? 1 : 2); r++) {
      tri(ql, 0.42, 10 + r * 8, 0.16, 3, DARK); tri(qr, 0.42, 10 + r * 8, 0.16, 3, DARK);
    }
    arch(qR(x, y, w0, w0 / 2), 0.32, 0.34, 7, '#4a3324');
    for (const [a, b] of [[ql(0.5, h - 4), -4], [qr(0.5, h - 4), 4]]) ln(a[0], a[1], a[0] + b, a[1] + 1.5, '#6b4a2e', 1.2);
    teeth(x, y - h, w1, lt(R, 0.3), 5, 3);
    if (s.big) {
      box(x, y - h, 4.5, 2.25, 6, L, R, lt(R, 0.18));
      teeth(x, y - h - 6, 4.5, lt(R, 0.3), 3, 2.4);
      pennant(x, y - h - 8, '#2f7a4a');
    }
    return { w: (w0 + w1) / 2, h };
  },
  // يمني (شبام): برج طيني عالٍ بأعلاه أبيض ونوافذ مزخرفة بإطار جص
  yemen(x, y, i, j, T, s) {
    const L = T.wallL, R = T.wallR, h = 32 * s.h;
    box(x, y, 9, 4.5, h, L, R, '#f1ece2');
    wL(x, y, 9, 4.5, 0, h - 7, 1, 7, '#efe8dc'); wR(x, y, 9, 4.5, 0, h - 7, 1, 7, '#f6f1e8');
    for (let r = 0; r < (s.small ? 2 : 3); r++) {
      const v = 6 + r * 7;
      wL(x, y, 9, 4.5, 0.3, v, 0.36, 4.2, '#f4efe6'); wL(x, y, 9, 4.5, 0.36, v + 0.6, 0.24, 3, DARK);
      wR(x, y, 9, 4.5, 0.3, v, 0.36, 4.2, '#f4efe6'); wR(x, y, 9, 4.5, 0.36, v + 0.6, 0.24, 3, DARK);
    }
    teeth(x, y - h, 9, '#f6f1e8', 4, 2.6);
    if (s.big) { box(x - 3, y - h - 1, 3, 1.5, 5, '#e6dfd2', '#f2ede4', '#ffffff'); pennant(x + 4, y - h, '#c0392b'); }
    return { w: 9, h };
  },
  // ياباني (إيدو وغيونغجو بألوانها): قاعدة حجرية مائلة، وجسم جصي أبيض بإطار خشبي، وسقف منحنٍ بطرفين مرفوعين
  yagura(x, y, i, j, T, s) {
    const st = T.yagura || { stone: '#8c8a84', wall: '#ece6d8', wood: '#3a2a20', roof: '#3d4656', trim: null };
    const hb = 9 * s.h, hu = 13 * s.h;
    frustum(x, y, 12, 10, hb, dk(st.stone, 0.1), st.stone, null);
    for (let k = 1; k < 3; k++) {
      const a = fL(x, y, 12, 10, hb)(0, k * hb / 3), b = fL(x, y, 12, 10, hb)(1, k * hb / 3), c = fR(x, y, 12, 10, hb)(1, k * hb / 3);
      ln(a[0], a[1], b[0], b[1], dk(st.stone, 0.3), 0.5); ln(b[0], b[1], c[0], c[1], dk(st.stone, 0.3), 0.5);
    }
    box(x, y - hb, 9.5, 4.75, hu, dk(st.wall, 0.08), st.wall, null);
    for (const u of [0, 0.5, 1]) {
      const a = qL(x, y - hb, 9.5, 4.75)(u, 0), b = qL(x, y - hb, 9.5, 4.75)(u, hu);
      ln(a[0], a[1], b[0], b[1], st.wood, 0.9);
      const c = qR(x, y - hb, 9.5, 4.75)(u, 0), d = qR(x, y - hb, 9.5, 4.75)(u, hu);
      ln(c[0], c[1], d[0], d[1], st.wood, 0.9);
    }
    wL(x, y - hb, 9.5, 4.75, 0.2, 5, 0.22, 4, st.wood); wR(x, y - hb, 9.5, 4.75, 0.58, 5, 0.22, 4, st.wood);
    const roof = { ov: 3, sag: 2.2, flare: 2.2, front: st.roof, front2: dk(st.roof, 0.12), end: dk(st.roof, 0.2), end2: dk(st.roof, 0.3),
                   ridge: '#1e2228', tile: dk(st.roof, 0.35) };
    if (st.trim) roof.ridge = st.trim;
    ridgeRoof(x, y, 9.5, 4.75, hb + hu, 7, roof);
    if (s.big) {
      box(x, y - hb - hu - 4, 5, 2.5, 6, dk(st.wall, 0.08), st.wall, null);
      ridgeRoof(x, y - hb - hu - 4, 5, 2.5, 6, 5, { ...roof, ov: 2, sag: 1.4, flare: 1.6 });
    }
    return { w: 10, h: hb + hu };
  },
  // صيني (الصينية وكايفنغ): منصة حجرية، وأعمدة حمراء وحاجز، وسقف أخضر رمادي منحنٍ وذهب على السنام
  pavilion(x, y, i, j, T, s) {
    const roofC = T.pavilionRoof || '#4d6a5a', h0 = 7 * s.h, h1 = 14 * s.h;
    box(x, y, 12, 6, h0, '#8a8478', '#a39d90', '#b9b2a4');
    for (const [u, side] of [[0.12, 'L'], [0.88, 'L'], [0.12, 'R'], [0.88, 'R']]) {
      const q = side === 'L' ? qL(x, y - h0, 10, 5) : qR(x, y - h0, 10, 5), a = q(u, 0), b = q(u, h1);
      ln(a[0], a[1], b[0], b[1], '#a8322a', 1.6);
    }
    box(x, y - h0, 7, 3.5, h1, '#c9b48a', '#d8c49a', null);
    wL(x, y - h0, 7, 3.5, 0.25, 4, 0.5, 6, '#7a2a22'); wR(x, y - h0, 7, 3.5, 0.25, 4, 0.5, 6, '#8a3028');
    const roof = { ov: 4, sag: 2.6, flare: 2.6, front: roofC, front2: dk(roofC, 0.12), end: dk(roofC, 0.2), end2: dk(roofC, 0.3),
                   ridge: '#d9b44a', ridgeW: 1.4, tile: dk(roofC, 0.35) };
    ridgeRoof(x, y, 10, 5, h0 + h1, 7, roof);
    if (s.big) ridgeRoof(x, y - 6, 6, 3, h0 + h1, 6, { ...roof, ov: 2.4, sag: 1.6, flare: 1.8 });
    return { w: 10, h: h0 + h1 };
  },
  // برج مراقبة حديث (هونغ كونغ): هيكل خرساني بشريط نيون ولافتة
  neon(x, y, i, j, T, s) {
    const h = 30 * s.h;
    box(x, y, 8, 4, h, '#5c5f66', '#70737a', '#80838a');
    for (let r = 0; r < Math.floor(h / 6); r++) {
      wL(x, y, 8, 4, 0.15, 3 + r * 6, 0.7, 2, r % 2 ? '#2a2c32' : '#3c4048');
      wR(x, y, 8, 4, 0.15, 3 + r * 6, 0.7, 2, '#2a2c32');
    }
    box(x, y - h, 10, 5, 3, '#4a4c52', '#5a5c62', '#6a6c72');
    wR(x, y - h, 10, 5, 0, 0.5, 1, 1.4, '#3fe0ff'); wL(x, y - h, 10, 5, 0, 0.5, 1, 1.4, '#ff4fa3');
    if (s.big) { ln(x, y - h - 3, x, y - h - 14, '#9aa3ad', 0.9); circ(x, y - h - 14, 1.2, '#ff4fa3'); }
    return { w: 8, h };
  },
  // راجبوتي (جايبور): برج وردي من الحجر الرملي، وشرفة جهاروكا، وقبة كشك (شاتري) في أعلاه
  rajput(x, y, i, j, T, s) {
    const c = T.wallR, sh = T.wallL, h = 26 * s.h;
    box(x, y, 9, 4.5, h, sh, c, lt(c, 0.15));
    for (let r = 0; r < (s.small ? 1 : 2); r++) {
      arch(qL(x, y, 9, 4.5), 0.35, 0.3, 5 + r * 9 + 5, '#6a2e22'); arch(qR(x, y, 9, 4.5), 0.35, 0.3, 5 + r * 9 + 5, '#6a2e22');
    }
    for (const [px, py] of rim(x, y - h, 9, false, 3)) box(px, py, 1, 0.5, 1.6, sh, c, lt(c, 0.25));
    const top = y - h;
    [[-4, 0], [4, 0], [0, 2], [0, -2]].forEach(([dx, dy]) => ln(x + dx, top + dy, x + dx, top + dy - 6, dk(sh, 0.1), 1));
    box(x, top - 6, 5.5, 2.75, 1.2, sh, c, lt(c, 0.2));
    dome(x, top - 7.2, 4.6, lt(c, 0.25), sh, '#d9b44a');
    if (s.big) { dome(x - 6.5, top + 1, 2.2, lt(c, 0.25), sh, '#d9b44a'); dome(x + 6.5, top + 1, 2.2, lt(c, 0.25), sh, '#d9b44a'); }
    return { w: 9, h };
  },
  // برج أوروبي مستدير (الأوروبية وباريس وروتنبورغ بألوانها): حجر بشقوق رماية، وسقف مخروطي، وشرفة بشُرَف للكبير
  round(x, y, i, j, T, s) {
    const L = T.wallL, R = T.wallR, roofC = T.roundRoof || '#5a6470', h = 26 * s.h, r = 8;
    cyl(x, y, r, h, dk(L, 0.12), lt(R, 0.1), null);
    for (let k = 0; k < (s.small ? 1 : 2); k++) { poly([[x - 1, y - 8 - k * 9], [x + 1, y - 8 - k * 9], [x + 1, y - 13 - k * 9], [x - 1, y - 13 - k * 9]], DARK); }
    poly([[x + 4, y + 3.5], [x + 7, y + 2], [x + 7, y - 4], [x + 4, y - 2.5]], '#4a3324');
    if (s.big) {
      cyl(x, y - h, r + 1.5, 3, dk(L, 0.2), R, lt(R, 0.15));
      for (let k = 0; k < 6; k++) {
        const a = Math.PI * (0.1 + k * 0.16);
        box(x - Math.cos(a) * (r + 0.6), y - h - 3 + Math.sin(a) * (r + 0.6) * 0.5, 1.2, 0.6, 2.2, L, R, lt(R, 0.2));
      }
      cone(x, y - h - 3, r - 1, 13, roofC, dk(roofC, 0.25));
      pennant(x, y - h - 16, '#c0392b');
    } else {
      cone(x, y - h, r + 1.2, 14 * s.h, roofC, dk(roofC, 0.25));
    }
    return { w: r, h, round: true };
  },
  // قوطي من الحجر الجيري (شيكاغو وبرمنغهام بلون طوبها): برج مربع بأبراج أركان صغيرة وشُرَف ونافذة طويلة
  gothic(x, y, i, j, T, s) {
    const L = T.gothicL || T.wallL, R = T.gothicR || T.wallR, h = 30 * s.h;
    box(x, y, 8.5, 4.25, h, L, R, lt(R, 0.15));
    arch(qL(x, y, 8.5, 4.25), 0.38, 0.24, 14, DARK); arch(qR(x, y, 8.5, 4.25), 0.38, 0.24, 14, DARK);
    for (const [px, py] of [[x - 8.5, y - h], [x + 8.5, y - h], [x, y - h + 4.25]]) {
      box(px, py + 1, 1.6, 0.8, 5, dk(L, 0.05), R, lt(R, 0.2));
      poly([[px - 1.6, py - 4], [px, py - 9], [px + 1.6, py - 4]], dk(L, 0.15));
    }
    merlons(x, y - h, 8.5, L, R, lt(R, 0.2), () => {}, 3, 1.2, 2);
    if (s.big) { box(x, y - h, 3.6, 1.8, 6, L, R, lt(R, 0.15)); poly([[x - 3.6, y - h - 6], [x, y - h - 16], [x + 3.6, y - h - 6]], dk(L, 0.2)); }
    return { w: 8.5, h };
  },
  // خشبي (النرويجية): ألواح حمراء داكنة، وطوابق تضيق، وسقف حاد بطبقات وتنينين على الأطراف
  stave(x, y, i, j, T, s) {
    const L = '#5a2a22', R = '#6e3428', roofC = '#3a2a22', h = 18 * s.h;
    box(x, y, 9, 4.5, h, L, R, null);
    for (let k = 1; k < 5; k++) { const a = qL(x, y, 9, 4.5)(k / 5, 0), b = qL(x, y, 9, 4.5)(k / 5, h); ln(a[0], a[1], b[0], b[1], dk(L, 0.25), 0.5); }
    for (let k = 1; k < 5; k++) { const a = qR(x, y, 9, 4.5)(k / 5, 0), b = qR(x, y, 9, 4.5)(k / 5, h); ln(a[0], a[1], b[0], b[1], dk(R, 0.25), 0.5); }
    wR(x, y, 9, 4.5, 0.4, 0, 0.22, 6, DARK);
    const roof = { ov: 2.5, gable: false, front: roofC, end: dk(roofC, 0.2), ridge: '#1a1410', tile: dk(roofC, 0.3) };
    ridgeRoof(x, y, 9, 4.5, h, 8, roof);
    box(x, y - h - 6, 4, 2, 6, L, R, null);
    ridgeRoof(x, y - h - 6, 4, 2, 6, 7, { ...roof, ov: 1.6 });
    if (s.big) pennant(x, y - h - 19, '#c0392b');
    return { w: 9, h };
  },
  // ساحلي أفريقي (كانو): برج طيني بأعمدة قمم على الأركان وأوتاد خشبية بارزة (طورون)
  sahel(x, y, i, j, T, s) {
    const L = T.wallL, R = T.wallR, h = 26 * s.h, w0 = 10, w1 = 8;
    frustum(x, y, w0, w1, h, L, R, lt(R, 0.12));
    const ql = fL(x, y, w0, w1, h), qr = fR(x, y, w0, w1, h);
    for (const q of [ql, qr]) {
      for (let r = 0; r < (s.small ? 2 : 3); r++) for (let k = 0; k < 3; k++) {
        const p = q(0.2 + k * 0.3, 7 + r * 7);
        ln(p[0], p[1], p[0] + (q === ql ? -2.4 : 2.4), p[1] + 1.2, '#6b4a2e', 1);
      }
      quad(q, 0.38, 2, 0.24, 6, '#4a3324');
    }
    for (const [px, py] of [[x - w1, y - h], [x + w1, y - h], [x, y - h + w1 / 2]]) {
      poly([[px - 1.6, py + 1], [px, py - 6], [px + 1.6, py + 1]], lt(L, 0.05));
      circ(px, py - 6, 0.7, '#e8dcc4');
    }
    if (s.big) { poly([[x - 2.4, y - h - 2], [x, y - h - 10], [x + 2.4, y - h - 2]], lt(R, 0.08)); circ(x, y - h - 10, 0.9, '#f2c14e'); }
    return { w: (w0 + w1) / 2, h };
  },
  // نوبي (مروي): برج طيني أبيض بقبة نوبية وزخارف مثلثة ملونة
  nubian(x, y, i, j, T, s) {
    const L = T.wallL, R = T.wallR, h = 22 * s.h;
    box(x, y, 9, 4.5, h, L, R, lt(R, 0.1));
    for (const q of [qL(x, y, 9, 4.5), qR(x, y, 9, 4.5)]) {
      for (let k = 0; k < 4; k++) tri(q, 0.1 + k * 0.22, h - 7, 0.16, 3, k % 2 ? '#3a7aa8' : '#c0533a');
      arch(q, 0.36, 0.28, 8, '#5a3a2a');
    }
    dome(x, y - h, 7, lt(R, 0.1), dk(L, 0.08), null);
    if (s.big) { dome(x, y - h - 8, 3, lt(R, 0.15), dk(L, 0.08), '#d9b44a'); }
    return { w: 9, h };
  },
  // حبشي (غوندر): برج حجري مستدير بقبة وحزام حجر أحمر
  abyssinian(x, y, i, j, T, s) {
    const L = T.wallL, R = T.wallR, h = 24 * s.h, r = 8;
    cyl(x, y, r, h, dk(L, 0.1), lt(R, 0.08), null);
    cyl(x, y - h * 0.55, r + 0.3, 2, '#7a3a2a', '#9a4a36', null);
    for (let k = 0; k < (s.small ? 1 : 2); k++) arch(qR(x, y, r, r / 2), 0.4, 0.2, 7 + k * 9, DARK);
    cyl(x, y - h, r + 1, 2.5, dk(L, 0.2), R, lt(R, 0.12));
    dome(x, y - h - 2.5, 7, lt(R, 0.12), dk(L, 0.05), s.big ? '#d9b44a' : null);
    if (s.big) { for (const dx of [-7, 7]) { cyl(x + dx, y - h * 0.4, 2.4, h * 0.6, dk(L, 0.1), R, null); dome(x + dx, y - h, 2.4, lt(R, 0.1), dk(L, 0.05), null); } }
    return { w: r, h, round: true };
  },
  // استعماري (المكسيكية وريو بألوانها): برج جصي ملون بزوايا حجرية، وجملون جرس منحنٍ وجرس
  colonial(x, y, i, j, T, s) {
    const c = T.colonial || '#e3708c', trim = T.colonialTrim || '#f3e6cc', h = 24 * s.h;
    box(x, y, 8.5, 4.25, h, dk(c, 0.12), c, null);
    for (const u of [0, 1]) { wL(x, y, 8.5, 4.25, u ? 0.88 : 0, 0, 0.12, h, trim); wR(x, y, 8.5, 4.25, u ? 0.88 : 0, 0, 0.12, h, trim); }
    arch(qR(x, y, 8.5, 4.25), 0.36, 0.28, 8, '#4a3324');
    arch(qL(x, y, 8.5, 4.25), 0.36, 0.28, h - 6, DARK);
    box(x, y - h, 9.5, 4.75, 1.4, trim, lt(trim, 0.1), lt(trim, 0.2));
    bellGable(x, y - h - 1.4, 8.5, 4.25, 0, 7, c, trim);
    const bell = qR(x, y - h - 1.4, 8.5, 4.25)(0.5, 3.4);
    circ(bell[0], bell[1], 1.4, '#c49a3a');
    if (s.big) pennant(x - 6, y - h - 2, '#2f7a4a');
    return { w: 8.5, h };
  },
  // أزتيكي مدرّج (تينوتشتيتلان): مصاطب حجرية تضيق، ودرج أمامي، ومعبد صغير بسقف ملون
  aztec(x, y, i, j, T, s) {
    const L = '#a39a86', R = '#bab19c', levels = s.small ? 3 : s.big ? 5 : 4, step = 6.2;
    let w = 12;
    for (let k = 0; k < levels; k++) { box(x, y - k * step, w, w / 2, step, dk(L, k * 0.02), R, lt(R, 0.08)); w -= 1.5; }
    const top = y - levels * step;
    poly([[x + 1, y + 6], [x + 5, y + 4], [x + 5 - levels * 0.8, top + 2], [x + 1 - levels * 0.8, top + 4]], '#8a8070');
    box(x, top, 5, 2.5, 6, '#c9c0aa', '#ddd4be', null);
    poly([[x - 5, top - 6], [x, top - 8.5], [x + 5, top - 6], [x, top - 3.5]], s.big ? '#2f8a7a' : '#c0533a');
    poly([[x - 5, top - 6], [x, top - 3.5], [x + 5, top - 6], [x + 5, top - 8], [x, top - 5.5], [x - 5, top - 8]], s.big ? '#3aa08c' : '#d8643f');
    return { w: w + 1.5, h: levels * step };
  },
  // صفيح ملون (لا بوكا): برج مراقبة من صناديق صفيح بألوان مختلفة ودرج خارجي ونافذة شرفة
  tin(x, y, i, j, T, s) {
    const cols = ['#c84a3a', '#e0c23a', '#3a7aa8', '#5aa05a'], h = 9 * s.h, n = s.small ? 2 : s.big ? 4 : 3;
    for (let k = 0; k < n; k++) {
      const c = cols[(k + Math.floor(hsh(i, j, 77) * 4)) % 4], w = 9 - k * 0.8;
      box(x, y - k * h, w, w / 2, h, dk(c, 0.12), c, null);
      for (let t = 1; t < 5; t++) {
        const a = qR(x, y - k * h, w, w / 2)(t / 5, 0), b = qR(x, y - k * h, w, w / 2)(t / 5, h);
        ln(a[0], a[1], b[0], b[1], dk(c, 0.25), 0.4);
      }
      wR(x, y - k * h, w, w / 2, 0.3, 3, 0.3, 3, DARK);
    }
    const top = y - n * h, w = 9 - n * 0.8;
    poly([[x - w - 1, top], [x, top - w / 2 - 3], [x + w + 1, top], [x, top + w / 2 - 1]], '#8a8f94');
    for (let k = 0; k < n; k++) { const a = qL(x, y - k * h, 9 - k * 0.8, (9 - k * 0.8) / 2)(0.15, 0), b = qL(x, y - k * h, 9 - k * 0.8, (9 - k * 0.8) / 2)(0.75, h); ln(a[0], a[1], b[0], b[1], '#3a3530', 0.8); }
    return { w: 9 - (n - 1) * 0.8, h: n * h };
  }
};

// برج كل مدينة وألوانه الخاصة (تُضاف إلى طابعها T وقت الرسم)
const CITY_TOWER = {
  arab: ['najdi'], diriyah: ['najdi'], cairo: ['najdi'], shibam: ['yemen'],
  japan: ['yagura'], gyeongju: ['yagura', { yagura: { stone: '#8c8a84', wall: '#e8e2d4', wood: '#2f5a3a', roof: '#4a5058', trim: '#c0533a' } }],
  china: ['pavilion'], kaifeng: ['pavilion', { pavilionRoof: '#5a5a5e' }], hk: ['neon'], jaipur: ['rajput'],
  europe: ['round'], paris: ['round', { roundRoof: '#4e5866' }], rothenburg: ['round', { roundRoof: '#a8452e' }],
  birmingham: ['gothic'], chicago: ['gothic', { gothicL: '#b8ae96', gothicR: '#cfc6ae' }], norway: ['stave'],
  kano: ['sahel'], meroe: ['nubian'], gondar: ['abyssinian'],
  mexico: ['colonial'], rio: ['colonial', { colonial: '#f2efe6', colonialTrim: '#3a6ea8' }], tenoch: ['aztec'], laboca: ['tin']
};

// يعيد جذع البرج { w نصف عرضه، h ارتفاعه، round مستدير } لرسم ترقياته فوقه (towerUpgrades)
export function drawCityTower(x, y, i, j, T, city, size) {
  const [kind, extra] = CITY_TOWER[city] || CITY_TOWER.arab;
  return TOWERS[kind](x, y, i, j, extra ? { ...T, ...extra } : T, sizeStyle(size));
}

// ================= المستشفيات =================
export const medicOf = (city) => MEDIC.crescent.includes(city) ? 'crescent' : 'cross';

// العلامة على قرص أبيض بحافة حمراء: صليب أو هلال (بلا صبغ المالك ولا الطقس، plain)
export function medicSign(ctx, x, y, r, kind) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fillStyle = MEDIC.white; ctx.fill();
  ctx.lineWidth = r * 0.16; ctx.strokeStyle = MEDIC.red; ctx.stroke();
  ctx.fillStyle = MEDIC.red;
  if (kind === 'crescent') {
    ctx.beginPath(); ctx.arc(x - r * 0.08, y, r * 0.62, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * 0.18, y - r * 0.08, r * 0.5, 0, 6.2832); ctx.fillStyle = MEDIC.white; ctx.fill();
  } else {
    ctx.fillRect(x - r * 0.18, y - r * 0.6, r * 0.36, r * 1.2);
    ctx.fillRect(x - r * 0.6, y - r * 0.18, r * 1.2, r * 0.36);
  }
}

// طراز مستشفى كل مدينة: السقف (flat مسطح بحاجز، hip قرميد منحنٍ، gable جملون، modern حديث بلوحة)، والنوافذ
// (arch مقوسة، rect مستطيلة، glass زجاج أزرق)، ولون المظلة، ولون الجدار إن خالف جدران المدينة
const H_STYLE = {
  arab: { roof: 'flat', win: 'arch', awning: '#2f7a4a' }, diriyah: { roof: 'flat', win: 'arch', awning: '#2f7a4a' },
  cairo: { roof: 'flat', win: 'arch', awning: '#2f6a8a' }, shibam: { roof: 'flat', win: 'arch', awning: '#2f7a4a' },
  japan: { roof: 'hip', win: 'rect', awning: '#3d4656', roofC: '#3d4656' }, gyeongju: { roof: 'hip', win: 'rect', awning: '#2f5a3a', roofC: '#4a5058' },
  china: { roof: 'hip', win: 'rect', awning: '#a8322a', roofC: '#4d6a5a' }, kaifeng: { roof: 'hip', win: 'rect', awning: '#a8322a', roofC: '#5a5a5e' },
  hk: { roof: 'modern', win: 'glass', awning: '#2f6a8a' }, jaipur: { roof: 'flat', win: 'arch', awning: '#c0533a', dome: true },
  europe: { roof: 'gable', win: 'rect', awning: '#2f6a8a', roofC: '#5a6470' }, paris: { roof: 'gable', win: 'rect', awning: '#2f4a6a', roofC: '#4e5866' },
  rothenburg: { roof: 'gable', win: 'rect', awning: '#7a2a22', roofC: '#a8452e' }, norway: { roof: 'gable', win: 'rect', awning: '#2f4a5e', roofC: '#3a2a22', wall: '#ece8de' },
  birmingham: { roof: 'modern', win: 'rect', awning: '#2f4a5e', wall: '#c9b8a0' }, chicago: { roof: 'modern', win: 'glass', awning: '#2a2a2c', wall: '#cfc6ae' },
  kano: { roof: 'flat', win: 'arch', awning: '#2f7a4a' }, meroe: { roof: 'flat', win: 'arch', awning: '#3a7aa8' },
  gondar: { roof: 'flat', win: 'arch', awning: '#7a3a2a' },
  mexico: { roof: 'flat', win: 'rect', awning: '#3fb5a8', trim: '#e3708c' }, rio: { roof: 'flat', win: 'rect', awning: '#3a6ea8', trim: '#3a6ea8' },
  tenoch: { roof: 'flat', win: 'rect', awning: '#2f8a7a', trim: '#c0533a' }, laboca: { roof: 'modern', win: 'rect', awning: '#c84a3a', wall: '#e0c23a' }
};

// نافذة على وجه (q دالة الوجه) عند u وارتفاع v
function win(q, u, v, style, light) {
  if (style === 'arch') { arch((a, b) => q(a, b + v), u, 0.13, 3.4, DARK); return; }
  quad(q, u, v, 0.14, 3, style === 'glass' ? '#5a7a9a' : DARK);
  if (light) quad(q, u, v + 2.2, 0.14, 0.5, 'rgba(255,255,255,0.35)');
}

export function drawCityHospital(x, y, i, j, T, city, size, plain) {
  const st = H_STYLE[city] || H_STYLE.arab, s = sizeStyle(size);
  const wall = st.wall || lt(T.wallR, 0.55), side = dk(wall, 0.1), floors = s.small ? 1 : s.big ? 3 : 2, fh = 7.5;
  const w = 12, d = 6, h = floors * fh + 2;
  box(x, y + 0.5, w + 0.8, d + 0.4, 1.2, dk(side, 0.15), dk(wall, 0.1), null);       // عتبة القاعدة
  box(x, y, w, d, h, side, wall, st.roof === 'flat' || st.roof === 'modern' ? lt(wall, 0.12) : null);
  const ql = qL(x, y, w, d), qr = qR(x, y, w, d);
  for (let f = 0; f < floors; f++) {
    const v = 2.5 + f * fh;
    for (const u of [0.12, 0.32, 0.52, 0.72]) win(ql, u, v + (st.win === 'arch' ? 0 : 0.5), st.win, true);
    for (const u of [0.1, 0.72]) win(qr, u, v + (st.win === 'arch' ? 0 : 0.5), st.win, true);
    if (st.trim) { const a = ql(0, v + fh - 1.2), b = ql(1, v + fh - 1.2), c = qr(1, v + fh - 1.2); ln(a[0], a[1], b[0], b[1], st.trim, 0.9); ln(b[0], b[1], c[0], c[1], st.trim, 0.9); }
  }
  // المدخل: باب زجاجي ومظلة بلون المنطقة، ولوحة العلامة فوقها
  quad(qr, 0.36, 0, 0.24, 5, '#3a4a58');
  quad(qr, 0.4, 0.4, 0.16, 4.2, '#7a9ab4');
  const a1 = qr(0.32, 5.6), a2 = qr(0.64, 5.6);
  poly([a1, a2, [a2[0] + 2.2, a2[1] + 2.2], [a1[0] + 2.2, a1[1] + 2.2]], st.awning);
  const sign = qr(0.48, Math.min(h - 3, 8.6));
  plain(() => medicSign(getCtx(), sign[0], sign[1], 2.3, medicOf(city)));
  // السقف من طراز المنطقة
  const top = y - h;
  if (st.roof === 'flat') {
    for (const [px, py] of rim(x, top, w, false, 6)) poly([[px - 1, py], [px - 1, py - 1.2], [px + 1, py - 1.2], [px + 1, py]], side);
    if (st.dome) dome(x - 5, top + 1, 2.6, lt(T.wallR, 0.3), T.wallL, '#d9b44a');
    plain(() => roofPlate(getCtx(), x, top, s.big ? 5.4 : 4.4, medicOf(city)));
  } else if (st.roof === 'modern') {
    plain(() => roofPlate(getCtx(), x, top, s.big ? 5.8 : 4.6, medicOf(city), s.big));
  } else if (st.roof === 'hip') {
    const roofC = st.roofC;
    ridgeRoof(x, y, w, d, h, 7, { ov: 3, sag: 2, flare: 2, front: roofC, front2: dk(roofC, 0.12), end: dk(roofC, 0.2), end2: dk(roofC, 0.3),
                                  ridge: '#1e2228', tile: dk(roofC, 0.35) });
  } else {
    const roofC = st.roofC;
    ridgeRoof(x, y, w, d, h, 8, { ov: 1.5, gable: true, front: roofC, end: dk(roofC, 0.2), wallEnd: lt(wall, 0.05), eave: dk(roofC, 0.3),
                                  ridge: dk(roofC, 0.4), tile: dk(roofC, 0.3) });
  }
  if (s.big && (st.roof === 'hip' || st.roof === 'gable')) pennant(x + 7, top - 2, MEDIC.white);
  return { w, h, top: h + (st.roof === 'hip' ? 7 : st.roof === 'gable' ? 8 : 1.2) };
}

// لوحة العلامة على السطح المسطح (تُرى من بعيد)، ومهبط مروحية للمستشفى الحديث الكبير
function roofPlate(ctx, x, top, r, kind, heli) {
  ctx.save();
  ctx.translate(x, top);
  ctx.scale(1, 0.5);                          // مسطحة على السطح بزاوية الكاميرا
  if (heli) {
    ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, 6.2832); ctx.fillStyle = '#4a4c52'; ctx.fill();
    ctx.lineWidth = r * 0.12; ctx.strokeStyle = '#f2c14e'; ctx.stroke();
  }
  medicSign(ctx, 0, 0, r, kind);
  ctx.restore();
}

// ================= تطور المباني مع ترقياتها (بطلب المستخدم بعد 11هـ) =================
// كل ترقية تُرى على مبناها: البرج بضرره وسرعته، والمستشفى بمداه وسرعة علاجه، والقاعدة بمستواها (hqTier).
// تُرسم فوق المبنى بلا صبغ المالك (plain في landmarks.js)، وa جذع المبنى الذي أعاده رسمه { w, h, top }
const WOOD = '#7a5a3a', WOOD_D = '#5a4028', IRON = '#3a3a40', STEEL = '#c8ccd2';

// مستوى القاعدة: سرعة إنتاجها وترقيات جنود مالكها معاً (EMPIRE.evolve)، فتتطور بأي منهما
export function hqTier(state, d) {
  if (!d || d.owner === null || !state.modeState.levels) return 0;
  const V = EMPIRE.evolve, lv = state.modeState.levels[d.owner] || {};
  const score = ((d.blv && d.blv.production) || 0) + V.gangWeight * ((lv.hp || 0) + (lv.damage || 0) + (lv.armor || 0) + (lv.speed || 0));
  return V.hqTiers.filter(t => score >= t).length;
}

// ما يتطور في كل مبنى، أو null: مفتاحه يعيد رسم قطع الحي حين يتغير (chunkCache.js)
export function evolveOf(state, d) {
  if (!d || !state.economy) return null;
  const b = d.blv || {};
  if (d.building === 'tower') return { damage: b.damage || 0, rate: b.rate || 0 };
  if (d.building === 'hospital') return { radius: b.radius || 0, rate: b.rate || 0 };
  if (d.building === 'hq') return { tier: hqTier(state, d) };
  return null;
}
export const evolveKey = (t) => t ? '|e' + Object.values(t).join('') : '';

// --- البرج ---
// السرعة: شرفة رماة خشبية حول جذعه (ورامٍ عليها وجعبة سهام عند قاعدته في المستوى 2)
// والضرر: قوس منجنيق ثقيل على وجهه الأيمن (وآخر على الأيسر ومجمرتان مشتعلتان عند قاعدته في المستوى 2)
export function towerUpgrades(x, y, a, tech) {
  if (!a || !tech) return;
  if (tech.rate) gallery(x, y, a, tech.rate);
  if (tech.damage) {
    ballista(x, y, a, 1);
    if (tech.damage > 1) { ballista(x, y, a, -1); brazier(x - 13.5, y + 1.6); brazier(x + 13.5, y + 1.6); }
  }
}

function gallery(x, y, a, level) {
  const gh = a.h * 0.62, bh = 3.4, w = a.w + 1.8, d = w / 2;
  if (a.round) cyl(x, y - gh, w, bh, WOOD_D, WOOD, null);
  else {
    poly([[x - w, y - gh], [x, y + d - gh], [x, y + d - gh - bh], [x - w, y - gh - bh]], WOOD_D);
    poly([[x, y + d - gh], [x + w, y - gh], [x + w, y - gh - bh], [x, y + d - gh - bh]], WOOD);
  }
  for (const u of [0.2, 0.45, 0.7]) {                      // شقوق الرمي في الشرفة
    for (const sx of [-1, 1]) {
      const px = x + sx * w * (1 - u), py = y - gh + d * u - bh * 0.35;
      poly([[px - 0.5, py], [px + 0.5, py], [px + 0.5, py - 1.6], [px - 0.5, py - 1.6]], '#2a1e14');
    }
  }
  for (const sx of [-1, 1]) ln(x + sx * w * 0.8, y - gh + d * 0.2, x + sx * a.w * 0.9, y - gh + 5, WOOD_D, 0.8);   // دعامتان
  if (level < 2) return;
  const ax = x + 3, ay = y + d - gh - bh - 0.6;             // رامٍ على الشرفة بقوسه
  ln(ax, ay, ax, ay - 4.2, '#3a2e24', 1.3);
  circ(ax, ay - 5.2, 1.1, '#e0b896');
  ctx().beginPath(); ctx().arc(ax + 1.4, ay - 3.2, 2.4, -1.2, 1.2); ctx().strokeStyle = '#6b4a2e'; ctx().lineWidth = 0.7; ctx().stroke();
  const qx = x - 11, qy = y + 2.4;                          // جعبة سهام عند القاعدة
  box(qx, qy, 1.6, 0.8, 3, WOOD_D, WOOD, null);
  for (let k = 0; k < 4; k++) ln(qx - 1 + k * 0.7, qy - 3, qx - 1.2 + k * 0.7, qy - 6, '#d8c8a8', 0.5);
}

// قوس منجنيق: ساق خشبية بارزة من الوجه (side 1 الأيمن، −1 الأيسر) وقوس حديدي ووتر ورأس سهم
function ballista(x, y, a, side) {
  const ch = a.h * 0.86, bx = x + side * a.w * 0.5, by = y + a.w * 0.25 - ch;
  const dx = side * 10, dy = 4.8, tx = bx + dx, ty = by + dy;
  ln(bx, by + 3, bx + dx * 0.32, by + dy * 0.32, IRON, 1.3);                     // دعامة
  ln(bx, by, tx, ty, WOOD, 2.4);                                                // الساق
  const mx = bx + dx * 0.72, my = by + dy * 0.72, n = Math.hypot(dx, dy), px = -dy / n, py = dx / n;   // عمودي على الساق
  const c = ctx();
  c.beginPath(); c.moveTo(mx - px * 4.6, my - py * 4.6); c.quadraticCurveTo(mx + dx * 0.1, my + dy * 0.1, mx + px * 4.6, my + py * 4.6);
  c.strokeStyle = IRON; c.lineWidth = 1.6; c.stroke();
  c.beginPath(); c.moveTo(mx - px * 4.6, my - py * 4.6); c.lineTo(bx + dx * 0.4, by + dy * 0.4); c.lineTo(mx + px * 4.6, my + py * 4.6);
  c.strokeStyle = '#e8e2d4'; c.lineWidth = 0.6; c.stroke();
  poly([[tx + dx * 0.14, ty + dy * 0.14], [tx - px * 1.3, ty - py * 1.3], [tx + px * 1.3, ty + py * 1.3]], STEEL);
}

// مجمرة مشتعلة على قائم: وعاء حديدي ولهب بطبقتين ووهج
function brazier(px, py) {
  ln(px, py, px, py - 5, IRON, 1);
  ln(px - 1.4, py, px + 1.4, py, IRON, 0.9);
  glow(px, py - 7, 8, 'rgba(255,150,60,0.35)');
  el(px, py - 5, 2.2, 1, '#2a2a2e');
  poly([[px - 1.8, py - 5], [px - 0.6, py - 9.5], [px + 0.4, py - 7], [px + 1, py - 10], [px + 1.8, py - 5]], '#e8762a');
  poly([[px - 1, py - 5], [px - 0.2, py - 7.8], [px + 1, py - 5]], '#f8d04a');
}

// --- المستشفى ---
// المدى: خيمة إسعاف عند ركنه (وثانية عند الركن الآخر في المستوى 2)، وحلقة علاج خضراء حوله (empireArt.js)
// والسرعة: سيارة إسعاف عند مدخله (ومنارة وامضة على سطحه في المستوى 2)
export function hospitalUpgrades(x, y, a, tech, city) {
  if (!a || !tech) return;
  if (tech.radius) { tent(x - 13.6, y + 1.6, city); if (tech.radius > 1) tent(x + 13.6, y + 1.6, city); }
  if (tech.rate) { ambulance(x + 6.2, y + 6.4, city); if (tech.rate > 1) beacon(x - 3, y - a.top); }
}

function tent(px, py, city) {
  poly([[px - 4.4, py], [px, py + 2.2], [px, py - 6.6]], '#f4f1e8');
  poly([[px, py + 2.2], [px + 4.4, py], [px, py - 6.6]], '#d8d3c6');
  poly([[px + 1, py + 1.7], [px + 3, py + 0.7], [px + 1.4, py - 2.8]], '#3a3530');
  medicSign(ctx(), px - 1.9, py - 1.6, 1.4, medicOf(city));
}

function ambulance(px, py, city) {
  el(px - 2, py + 1.4, 0.9, 0.5, '#1e1e20'); el(px + 2.2, py + 0.4, 0.9, 0.5, '#1e1e20');
  box(px, py, 4, 2, 3.6, '#e2e0da', '#f6f4ee', '#ffffff');
  wR(px, py, 4, 2, 0.62, 1.8, 0.3, 1.4, '#5a7a9a');                  // زجاج المقدمة
  wL(px, py, 4, 2, 0, 1.2, 1, 0.6, MEDIC.red); wR(px, py, 4, 2, 0, 1.2, 0.6, 0.6, MEDIC.red);   // الشريط
  circ(px - 0.6, py - 3.9, 0.5, '#e84a3a'); circ(px + 0.6, py - 4.3, 0.5, '#3a7ae8');   // أضواء السقف
  medicSign(ctx(), px - 2.2, py - 1.9, 0.9, medicOf(city));
}

function beacon(px, py) {
  ln(px, py, px, py - 3, IRON, 0.9);
  glow(px, py - 4, 6, 'rgba(255,80,60,0.45)');
  circ(px, py - 4, 1.2, '#ff5a3a');
  circ(px - 0.3, py - 4.3, 0.4, '#ffe0d0');
}

// --- القاعدة الرئيسية: ساحة علم حيها تصير ساحة تدريب بمستواها ---
// 1 حاملا رماح على ركنيها الجانبيين، 2 ودميتا تدريب على الأمامي والخلفي، 3 ومجمرتان ذهبيتان حول العلم
export function hqYard(x, y, tier) {
  if (tier >= 2) { dummy(x, y - 5.2); }
  for (const sx of [-1, 1]) rack(x + sx * 11, y);
  if (tier >= 2) dummy(x, y + 5.4);
  if (tier >= 3) { brazier(x - 5, y + 2); brazier(x + 5, y + 2); }
}

function rack(px, py) {
  ln(px - 2.6, py + 1.3, px - 2.6, py - 5.2, WOOD_D, 1.1); ln(px + 2.6, py - 1.3, px + 2.6, py - 7.8, WOOD_D, 1.1);
  ln(px - 3.1, py - 3.9, px + 3.1, py - 6.5, WOOD, 1.3);
  for (let k = 0; k < 3; k++) {
    const sx = px - 1.8 + k * 1.8;
    ln(sx, py + 0.8 - k * 0.8, sx + 1, py - 10.4 - k * 0.8, '#8a6a48', 0.9);
    poly([[sx + 1, py - 10.4 - k * 0.8], [sx + 0.5, py - 8.8 - k * 0.8], [sx + 1.7, py - 9 - k * 0.8]], STEEL);
  }
}

function dummy(px, py) {
  ln(px, py + 1.3, px, py - 9, WOOD_D, 1.3);
  ln(px - 3.4, py - 6.5, px + 3.4, py - 6.5, WOOD_D, 1.1);
  el(px, py - 5.2, 2.2, 3.4, '#c9a85a');
  circ(px, py - 9.9, 1.7, '#d8bc72');
  ln(px - 1.6, py - 4.2, px + 1.6, py - 5.7, '#8a6a30', 0.8);
}

const ctx = () => getCtx();
