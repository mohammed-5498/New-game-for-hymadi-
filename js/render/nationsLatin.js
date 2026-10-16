/* الدفعة اللاتينية (المرحلة 9ب، القسم 3.10): البرازيل «المالتاس»، الأرجنتين «الكومبادريتوس»، المكسيك «فرسان النسر والجاغوار».
   منقولة من docs/nations/batch5-skins.js: نفس الأشكال والنسب والألوان، مع إضافات اللعبة كما في الدفعات السابقة:
   حقول السلاح، وحلقات الأبطال، والحجر وسهم الأتلاتل يختفيان لحظة الرمي، والقوس بشد الوتر (pullBow)،
   ونسخة مبسّطة لكل وحدة، والنقاط أعداد مباشرة بلا مصفوفات جديدة في كل إطار، وأشكال اللون الواحد برسمة واحدة.
   - رامي الأتلاتل: سهمه يطير سهماً مشتعلاً (shotLook 'firearrow' كالكوري)، وقواعده قواعد رامي النار
   - السراويل الواسعة تغطي الساقين، فالمبسّطة لا ترسم من الساق إلا آخرها (legFrom) */
import { TAU, dk, limb, ell } from './anim.js';
import { heroRing } from './bodies.js';
import {
  registerNation, both, memo, mixHex, GOLD, STEEL2, CREAM, dot, robe, stripes, belt, staff, ellTo, triTo, at, PT,
  torso, hStripes, pullBow, glowAt
} from './nationArt.js';

const QUET = '#2f8f5a', TURQ = '#2fa8a0', JAG = '#d9a23a', TANGO = '#1e1e22', RED3 = '#b8322c';

// سروال واسع فوق الساقين: خط عريض من الورك إلى الركبة ثم إلى len من الساق السفلى (len > 0.5)، والخلفي أغمق قليلاً
// (المبسّطة: الساقان برسمة واحدة بلون واحد)
function pantLeg(c, L, len) {
  const u = (len - 0.5) / 0.5;
  c.moveTo(L.h[0], L.h[1]); c.lineTo(L.k[0], L.k[1]);
  c.lineTo(L.k[0] + (L.f[0] - L.k[0]) * u, L.k[1] + (L.f[1] - L.k[1]) * u);
}
function pants(c, J, col, w, lite, len = 0.92) {
  c.lineWidth = w;
  c.beginPath(); pantLeg(c, J.legB, len);
  if (lite) { pantLeg(c, J.legF, len); c.strokeStyle = col; c.stroke(); return; }
  c.strokeStyle = dk(col, 0.12); c.stroke();
  c.beginPath(); pantLeg(c, J.legF, len); c.strokeStyle = col; c.stroke();
}

// ---------- البرازيل «المالتاس» (نمط الخاطف): سروال الكابويرا الأبيض، حبل الخصر، شريط الرأس، صدر عارٍ ----------
const capoCol = memo(col => mixHex(col, '#f6f3ec', 0.72));
// شريط الرأس بطرف متدلٍّ خلف الرأس (رسمة واحدة)
function ribbonBand(c, col) {
  c.beginPath(); ellTo(c, 0, -2.2, 4, 0.8); triTo(c, -3.6, -2.2, -6.4, 1.4, -3, -1.2);
  c.fillStyle = col; c.fill();
}
// حبل الخصر (الكوردا) بلون الرتبة وطرفه متدلٍّ على الفخذ (المبسّطة: الحزام وحده)
function corda(c, J, col, lite) {
  belt(c, J, col, 1.2);
  if (lite) return;
  at(J.hip, 1.6, -1.3, J.pl);
  const L = J.legF;
  limb(c, PT.x, PT.y, L.h[0] + (L.k[0] - L.h[0]) * 0.8 + 0.6, L.h[1] + (L.k[1] - L.h[1]) * 0.8, 0.6, col);
}
// البيريمباو يقاتل به كعصا طويلة: العصا والوتر والقرعة (المبسّطة: العصا والقرعة)
function berimbau(c, J, p, lite) {
  const s = staff(c, J, p, 5, 9, 1, '#8a6a3e'), nx = -s.dy, ny = s.dx, ax = s.ax, ay = s.ay, bx = s.bx, by = s.by;
  if (!lite) {
    c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx) / 2 + nx * 2.4, (ay + by) / 2 + ny * 2.4, bx, by);
    c.strokeStyle = '#d9d4c8'; c.lineWidth = 0.35; c.stroke();
  }
  const gx = ax + (bx - ax) * 0.18 + nx * 1.6, gy = ay + (by - ay) * 0.18 + ny * 1.6;
  dot(c, gx, gy, 1.7, '#c9a25a');
  if (!lite) dot(c, gx, gy, 0.8, '#7a5a2e');
}
// هراوة قصيرة برأس مدوّر (المبسّطة: بلا الرأس)
function club(c, J, p, L, lite) {
  const s = staff(c, J, p, 1.2, L, 1.3, '#6a4a2a');
  if (!lite) dot(c, s.bx, s.by, 1.1, '#5a3a22');
}
// سكين من النقطة (x, y) بالزاوية a: مقبض داكن ونصل (المبسّطة: النصل وحده)
function knifeB(c, x, y, a, L, lite) {
  const dx = Math.cos(a), dy = Math.sin(a);
  if (!lite) limb(c, x - dx * 0.8, y - dy * 0.8, x + dx * 0.8, y + dy * 0.8, 1.2, '#3a2a22');
  limb(c, x + dx * 0.8, y + dy * 0.8, x + dx * L, y + dy * L, 0.9, STEEL2);
}
// قبعة القش بشريط أحمر (المعلّم، على طراز لابا القديم)
function strawHat(c, lite) {
  ell(c, 0, -2.2, 5.6, 1.1, '#e8d8a8');
  c.beginPath(); c.ellipse(0, -2.4, 3.4, 2.8, 0, Math.PI, 0); c.fillStyle = '#efe2b8'; c.fill();
  if (!lite) ell(c, 0, -2.6, 3.4, 0.6, RED3);
}
function brazil(lite) {
  const legFrom = lite ? 0.9 : 0;      // السروال يغطي الساق حتى 0.92 منها
  return {
    common: { sx: 0.96, sy: 1.04, lw: 2.8, headR: 3.4, wlen: 5.4, legFrom,
      head: (c) => ribbonBand(c, '#f2efe6'),
      robe: (c, J, p, col) => pants(c, J, capoCol(col), 3.6, lite),
      over: (c, J) => corda(c, J, '#e8c23a', lite),
      weapon: (c, J, p) => club(c, J, p, 5.4, lite) },
    spear: { sx: 0.97, sy: 1.05, lw: 2.8, headR: 3.4, wlen: 9, butt: 5, legFrom,
      head: (c) => ribbonBand(c, RED3),
      robe: (c, J, p, col) => pants(c, J, capoCol(col), 3.6, lite),
      over: (c, J) => corda(c, J, '#2f8f5a', lite),
      weapon: (c, J, p) => berimbau(c, J, p, lite) },
    dual: { sx: 0.94, sy: 1.05, lw: 2.7, headR: 3.4, wlen: 4.2, legFrom,
      head(c) { ell(c, -0.4, -1.8, 3.6, 2, '#2a2220'); },          // شعر قصير
      robe: (c, J, p, col) => pants(c, J, capoCol(col), 3.6, lite),
      over: (c, J) => corda(c, J, '#3a7ac2', lite),
      back: (c, J, p) => knifeB(c, J.handB[0], J.handB[1], p.wa + 0.8, 3.8, lite),
      weapon: (c, J, p) => knifeB(c, J.handF[0], J.handF[1], p.wa, 4.2, lite) },
    champion: { sx: 1.0, sy: 1.07, lw: 2.9, headR: 3.5, wlen: 4.6, legFrom,
      ground: heroRing,
      head: (c) => strawHat(c, lite),
      chest(c, J, p, col) {                      // البذلة البيضاء: لوح الجذع وخط الصدر، وربطة بلون اللاعب
        const T = torso(c, J, '#f4f1ea', lite ? null : dk(col, 0.25));
        if (!lite) limb(c, (T.x0 + T.x1) / 2, (T.y0 + T.y1) / 2, (T.x3 + T.x2) / 2, (T.y3 + T.y2) / 2, 0.5, '#d8d2c4');
        at(J.chest, 0.4, -1, J.a2); const ax = PT.x, ay = PT.y;
        at(J.chest, 1.2, 1.6, J.a2);
        limb(c, ax, ay, PT.x, PT.y, 0.9, col);
      },
      robe: (c, J) => pants(c, J, '#f4f1ea', 3.4, lite),
      over: lite ? undefined : (c, J) => belt(c, J, GOLD, 0.8),
      weapon: (c, J, p) => knifeB(c, J.handF[0], J.handF[1], p.wa, 4.6, lite) }
  };
}

// ---------- الأرجنتين «الكومبادريتوس» (نمط الخاطف): قبعة مائلة، منديل حريري أبيض، سترة داكنة، فاكون، معطف على الذراع ----------
// قبعة "تشامبيرغو" مائلة: الحافة والتاج برسمة واحدة، ثم الشريط والثنية (المبسّطة: الشكل وحده)
function chambergo(c, col, lite) {
  c.rotate(0.16);
  c.beginPath(); ellTo(c, 0, -2.2, 5.4, 1);
  c.moveTo(-3, -2.2); c.lineTo(-2.6, -5.4); c.quadraticCurveTo(0, -6.4, 2.6, -5.4); c.lineTo(3, -2.2); c.closePath();
  c.fillStyle = col; c.fill();
  if (!lite) { ell(c, 0, -2.8, 3, 0.5, dk(col, 0.3)); limb(c, -1, -5.8, 1, -5.8, 0.6, dk(col, 0.25)); }
  c.rotate(-0.16);
}
// منديل حريري أبيض حول العنق بطرف متدلٍّ
function silkScarf(c, J) {
  at(J.chest, -1.6, -1.2, J.a2); const ax = PT.x, ay = PT.y;
  at(J.chest, 2, -1.2, J.a2); const bx = PT.x, by = PT.y;
  limb(c, ax, ay, bx, by, 1.3, '#f4f1ea');
  limb(c, bx, by, bx + 0.6, by + 3, 1, '#f4f1ea');
}
// الفاكون: مقبض فاتح وواقٍ ذهبي ونصل مثلث (المبسّطة: النصل وحده، فالمقبض تحت اليد)
function facon(c, J, p, L, lite) {
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), nx = -dy, ny = dx, hx = J.handF[0], hy = J.handF[1];
  if (!lite) {
    limb(c, hx - dx, hy - dy, hx + dx * 0.6, hy + dy * 0.6, 1.3, '#c9c4b8');
    limb(c, hx + dx * 0.6 + nx * 1.2, hy + dy * 0.6 + ny * 1.2, hx + dx * 0.6 - nx * 1.2, hy + dy * 0.6 - ny * 1.2, 0.7, GOLD);
  }
  c.beginPath();
  triTo(c, hx + dx * 0.8 + nx * 0.6, hy + dy * 0.8 + ny * 0.6, hx + dx * L, hy + dy * L, hx + dx * 0.8 - nx * 0.5, hy + dy * 0.8 - ny * 0.5);
  c.fillStyle = STEEL2; c.fill();
}
// المعطف ملفوفاً على الذراع الخلفية كدرع: اللفّة وطرفها برسمة واحدة، وثنيات (لا يُرسم في المبسّطة: صغير خلف الجسد)
function wrappedCoat(c, J, col) {
  const hx = J.handB[0], hy = J.handB[1];
  c.beginPath(); ellTo(c, hx, hy, 2.3, 2.3); triTo(c, hx - 1, hy + 1.6, hx - 2.4, hy + 5, hx + 1, hy + 2);
  c.fillStyle = col; c.fill();
  c.beginPath();
  for (let k = 0; k < 3; k++) { c.moveTo(hx - 2, hy - 1 + k); c.lineTo(hx + 2, hy - 0.6 + k); }
  c.strokeStyle = dk(col, 0.25); c.lineWidth = 0.4; c.stroke();
}
// السترة الداكنة مفتوحة على قميص بلون اللاعب الفاتح، وخط الصدر (المبسّطة: السترة وحدها، ولون اللاعب
// على السروال والذراعين والرأس)
const SUIT = { x0: 0, y0: 0, x1: 0, y1: 0, x2: 0, y2: 0, x3: 0, y3: 0 };
const shirtCol = memo(col => mixHex(col, '#f4f1ea', 0.5));
function suitTorso(c, J, col, lite) {
  const P = torso(c, J, TANGO, lite ? null : dk(col, 0.4), 0, SUIT);
  if (lite) return;
  torso(c, J, shirtCol(col), null, 1.3);
  limb(c, (P.x0 + P.x1) / 2, (P.y0 + P.y1) / 2, P.x3 + (P.x2 - P.x3) * 0.4, P.y3 + (P.y2 - P.y3) * 0.4, 0.6, '#4a4a50');
}
// البونشو من الكتفين إلى منتصف الفخذين بخطين (المبسّطة: البونشو وحده)
const ponchoCol = memo(col => mixHex(col, '#8a5a36', 0.35));
const bombachaCol = memo(col => mixHex(col, '#f4f1ea', 0.6));
function poncho(c, J, col, stripe, lite) {
  at(J.chest, -3.2, -0.6, J.a2); const s1x = PT.x, s1y = PT.y;
  at(J.chest, 3.4, -0.4, J.a2); const s2x = PT.x, s2y = PT.y;
  const F = J.legF, B = J.legB;
  const fx = F.h[0] + (F.k[0] - F.h[0]) * 0.55, fy = F.h[1] + (F.k[1] - F.h[1]) * 0.55;
  const bx = B.h[0] + (B.k[0] - B.h[0]) * 0.55, by = B.h[1] + (B.k[1] - B.h[1]) * 0.55;
  c.beginPath(); c.moveTo(s1x, s1y); c.lineTo(s2x, s2y); c.lineTo(fx + 2.6, fy);
  c.lineTo((fx + bx) / 2, Math.max(fy, by) + 1.4); c.lineTo(bx - 2.6, by); c.closePath();
  c.fillStyle = col; c.fill();
  if (lite) return;
  c.strokeStyle = dk(col, 0.3); c.lineWidth = 0.5; c.stroke();
  c.beginPath();
  for (let k = 1; k <= 2; k++) {
    const t = k * 0.3;
    c.moveTo(s1x + (bx - 2.6 - s1x) * t, s1y + (by - s1y) * t); c.lineTo(s2x + (fx + 2.6 - s2x) * t, s2y + (fy - s2y) * t);
  }
  c.strokeStyle = stripe; c.lineWidth = 0.7; c.stroke();
}
// البولياداس: ثلاثة حبال من اليد بكرات حجرية في أطرافها (الحبال برسمة والكرات برسمة)
function bolas(c, J, p) {
  const hx = J.handF[0], hy = J.handF[1], a0 = p.wa - 0.6;
  c.beginPath();
  for (let k = 0; k < 3; k++) { const a = a0 + (k - 1) * 0.5; c.moveTo(hx, hy); c.lineTo(hx + Math.cos(a) * 5.4, hy + Math.sin(a) * 5.4); }
  c.strokeStyle = '#8a6a44'; c.lineWidth = 0.4; c.stroke();
  c.beginPath();
  for (let k = 0; k < 3; k++) { const a = a0 + (k - 1) * 0.5; ellTo(c, hx + Math.cos(a) * 5.4, hy + Math.sin(a) * 5.4, 1, 1); }
  c.fillStyle = '#7a6a5a'; c.fill();
}
function argentina(lite) {
  const legFrom = lite ? 0.9 : 0;
  return {
    common: { sx: 0.96, sy: 1.05, lw: 2.8, headR: 3.4, wlen: 5.2, legFrom,
      head: (c) => chambergo(c, TANGO, lite),
      chest: (c, J, p, col) => suitTorso(c, J, col, lite),
      robe: (c, J, p, col) => pants(c, J, dk(col, 0.15), 3.2, lite),
      over: lite ? undefined : (c, J) => silkScarf(c, J),
      back: lite ? undefined : (c, J) => wrappedCoat(c, J, '#3a3a40'),
      weapon: (c, J, p) => facon(c, J, p, 5.2, lite) },
    spear: { sx: 0.98, sy: 1.05, lw: 2.9, headR: 3.5, wlen: 5.4, legFrom: lite ? 0.78 : 0,
      head(c) { c.beginPath(); c.ellipse(-0.26, -2.587, 4.2, 1.6, -0.1, 0, TAU); c.fillStyle = '#2a2a2e'; c.fill(); },   // قبعة الغاوتشو مائلة
      robe(c, J, p, col) { pants(c, J, bombachaCol(col), 4.4, lite, 0.8); belt(c, J, RED3, 1.8); },
      over: (c, J, p, col) => poncho(c, J, ponchoCol(col), '#e8c23a', lite),
      weapon: (c, J, p) => bolas(c, J, p) },
    dual: { sx: 0.95, sy: 1.05, lw: 2.7, headR: 3.4, wlen: 4.8, legFrom,
      head: (c) => chambergo(c, '#4a3a2e', lite),
      chest: (c, J, p, col) => suitTorso(c, J, col, lite),
      robe: (c, J, p, col) => pants(c, J, dk(col, 0.15), 3.2, lite),
      over: lite ? undefined : (c, J) => silkScarf(c, J),
      back(c, J) {                               // الشال الأحمر على اليد الخلفية بحاشية صفراء
        const hx = J.handB[0], hy = J.handB[1];
        c.beginPath(); triTo(c, hx, hy, hx - 4, hy + 5, hx + 1, hy + 6.4); c.fillStyle = RED3; c.fill();
        if (!lite) limb(c, hx - 4, hy + 5, hx + 1, hy + 6.4, 0.5, '#e8c23a');
      },
      weapon: (c, J, p) => facon(c, J, p, 4.8, lite) },
    champion: { sx: 1.0, sy: 1.08, lw: 2.9, headR: 3.5, wlen: 6.2, legFrom,
      ground: heroRing,
      head: (c) => chambergo(c, TANGO, lite),
      back(c, J, p, col) {                       // المعطف الأسود الطويل، والمعطف الملفوف على الذراع
        const L = J.legB, hx = L.h[0] + (L.k[0] - L.h[0]) * 0.85, hy = L.h[1] + (L.k[1] - L.h[1]) * 0.85;
        at(J.chest, -2.6, -0.6, J.a2); const ax = PT.x, ay = PT.y;
        at(J.chest, 1.2, -0.4, J.a2);
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(PT.x, PT.y); c.lineTo(hx + 1.4, hy); c.lineTo(hx - 3.6, hy); c.closePath();
        c.fillStyle = TANGO; c.fill();
        if (lite) return;
        c.strokeStyle = dk(col, 0.2); c.lineWidth = 0.8; c.stroke();
        wrappedCoat(c, J, '#2a2a2e');
      },
      chest: (c, J, p, col) => suitTorso(c, J, col, lite),
      robe: (c, J) => pants(c, J, TANGO, 3.2, lite),
      over: lite ? undefined : (c, J) => {      // المنديل، وسلسلة الساعة الذهبية، وقرنفلة حمراء
        silkScarf(c, J);
        at(J.chest, 1.6, 1.6, J.a2); const ax = PT.x, ay = PT.y;
        at(J.hip, 2.4, -2, J.pl);
        c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(ax + 1.6, (ay + PT.y) / 2, PT.x, PT.y);
        c.strokeStyle = GOLD; c.lineWidth = 0.5; c.stroke();
        at(J.chest, -1.2, 0.4, J.a2); dot(c, PT.x, PT.y, 0.9, RED3);
      },
      weapon: (c, J, p) => facon(c, J, p, 6.2, lite) }
  };
}

// ---------- المكسيك «فرسان النسر والجاغوار» (نمط الرامي): درع قطني محشو، إزار ملون، خوذتا النسر والجاغوار ----------
// الدرع القطني المحشو بلون كريمي وخطّي حشو (المبسّطة: اللوح وحده)
function ichca(c, J, col, lite) {
  const T = torso(c, J, CREAM, lite ? null : dk(col, 0.3));
  if (!lite) hStripes(c, T, 2, '#c8bca4', 0.4);
  return T;
}
// الإزار بلون اللاعب بخط فيروزي وطرف أحمر متدلٍّ في الأمام. لا يُرسم في المبسّطة: بلون الجسد نفسه فلا يُرى صغيراً
const MAX_TS = [0.7], MAX_COLS = [TURQ];
function maxtlatl(c, J, col) {
  const r = robe(c, J, 0.4, col, dk(col, 0.3), 'waist', 0.6);
  stripes(c, MAX_TS, MAX_COLS, 0.8);
  const mx = r.bx + (r.fx - r.bx) * 0.6, my = r.by + (r.fy - r.by) * 0.6;
  c.beginPath();
  c.moveTo(r.w1x + (r.w2x - r.w1x) * 0.45, r.w1y + (r.w2y - r.w1y) * 0.45);
  c.lineTo(r.w1x + (r.w2x - r.w1x) * 0.75, r.w1y + (r.w2y - r.w1y) * 0.75);
  c.lineTo(mx + 1, my + 3.4); c.lineTo(mx - 1, my + 3.4); c.closePath();
  c.fillStyle = RED3; c.fill();
}
function feather(c, x, col) {
  c.beginPath(); c.moveTo(x, -2.4); c.quadraticCurveTo(x - 1.6, -6.4, x - 0.4, -8.6); c.lineTo(x + 0.4, -8.2);
  c.quadraticCurveTo(x - 0.6, -6, x + 0.6, -2.4); c.closePath(); c.fillStyle = col; c.fill();
}
// عصابة حمراء بريشتين خضراء وفيروزية (المبسّطة: الريشة الخضراء وحدها)
function featherHB(c, lite) {
  if (!lite) ell(c, 0, -2, 4, 0.8, RED3);
  feather(c, -1.6, QUET);
  if (!lite) feather(c, -0.4, TURQ);
}
// خوذة الجاغوار: الرأس والفك والأذن برسمة واحدة، ثم الأنياب والبقع والعين (المبسّطة: الرسمة الأولى وحدها)
const JAG_SPOTS = [-2.6, -3.6, 0, -4.6, -3.6, -1, 2.4, -3];
function jaguarHelm(c, lite) {
  c.beginPath();
  c.ellipse(-0.4, -1.2, 4.4, 4.2, 0, Math.PI * 0.95, Math.PI * 2.05); c.closePath();
  c.moveTo(-1, -4); c.lineTo(5.6, -3.4); c.lineTo(5.8, -1.6); c.lineTo(1.6, -1.8); c.closePath();
  triTo(c, -2.6, -4.6, -2, -6.6, -0.8, -4.8);
  c.fillStyle = JAG; c.fill();
  if (lite) return;
  c.beginPath();
  for (let k = 0; k < 3; k++) triTo(c, 2 + k * 1.2, -1.8, 2.5 + k * 1.2, -0.8, 3 + k * 1.2, -1.8);
  c.fillStyle = '#f4f1ea'; c.fill();
  c.beginPath();
  for (let k = 0; k < 8; k += 2) { const x = JAG_SPOTS[k], y = JAG_SPOTS[k + 1]; c.moveTo(x + 0.6, y); c.arc(x, y, 0.6, 0, TAU); }
  c.strokeStyle = '#3a2a1a'; c.lineWidth = 0.4; c.stroke();
  ell(c, 4.4, -3.2, 0.6, 0.5, '#2a1a10');
}
// خوذة النسر: رأس بني بريش أبيض وبني (كل لون برسمة) ومنقار أصفر (المبسّطة: الرأس والمنقار)
function eagleHelm(c, lite) {
  c.beginPath(); c.ellipse(-0.4, -1.2, 4.4, 4.2, 0, Math.PI * 0.95, Math.PI * 2.05); c.fillStyle = '#7a5a3a'; c.fill();
  if (!lite) for (let pass = 0; pass < 2; pass++) {
    c.beginPath();
    for (let k = pass; k < 5; k += 2) triTo(c, -4 + k * 1.4, -3.6, -4.6 + k * 1.4, -7.4, -3 + k * 1.4, -4);
    c.fillStyle = pass ? '#f2efe6' : '#a87a4a'; c.fill();
  }
  c.beginPath(); c.moveTo(0.4, -4.4); c.quadraticCurveTo(6.8, -4.6, 6.4, -1.6); c.lineTo(4.8, -2.2);
  c.quadraticCurveTo(4.6, -3.4, 0.8, -2.8); c.closePath();
  c.fillStyle = '#e8b23a'; c.fill();
  if (!lite) ell(c, 2, -3.6, 0.6, 0.5, '#2a1a10');
}
// الشيمالي: درع دائري فيروزي بقلب أبيض، وأشرطة وريش حول الحافة كل لون برسمة (المبسّطة: قرص فيروزي)
function chimalli(c, x, y, r, lite) {
  dot(c, x, y, r, TURQ);
  if (lite) return;
  dot(c, x, y, r * 0.8, '#f2efe6');
  for (let pass = 0; pass < 2; pass++) {
    c.beginPath();
    for (let k = pass; k < 3; k += 2) { const yy = y - r * 0.4 + k * r * 0.4; c.moveTo(x - r * 0.7, yy); c.lineTo(x + r * 0.7, yy); }
    c.strokeStyle = pass ? RED3 : '#2a2a2e'; c.lineWidth = 0.6; c.stroke();
  }
  for (let pass = 0; pass < 2; pass++) {
    c.beginPath();
    for (let k = pass; k < 5; k += 2) {
      const a = Math.PI * 0.3 + k * 0.3, b = a + 0.15;
      triTo(c, x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * (r + 2.6), y + Math.sin(a) * (r + 2.6), x + Math.cos(b) * r, y + Math.sin(b) * r);
    }
    c.fillStyle = pass ? QUET : RED3; c.fill();
  }
}
// المقلاع: حبلان من اليد وحجر في الكفة (الحجر يختفي لحظة الرمي فهو نفسه ما يُرمى). المبسّطة: الحجر وحده
function slingM(c, J, p, lite) {
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), nx = -dy, ny = dx, hx = J.handF[0], hy = J.handF[1];
  const qx = hx + dx * 3.4 + nx * 1.4, qy = hy + dy * 3.4 + ny * 1.4;
  if (!lite) {
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(qx, qy); c.moveTo(hx, hy); c.lineTo(qx + nx * 0.8, qy + ny * 0.8);
    c.strokeStyle = '#c8bca4'; c.lineWidth = 0.4; c.stroke();
  }
  if (!p.thrown) dot(c, qx, qy, 1, '#7a7a72');
}
// الأتلاتل: قاذفة خشبية وسهم في آخره لهب بوهج (السهم يختفي لحظة الرمي). المبسّطة: بلا وهج ولا قلب اللهب
function atlatl(c, J, p, lite) {
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), hx = J.handF[0], hy = J.handF[1];
  limb(c, hx - dx, hy - dy, hx + dx * 3.6, hy + dy * 3.6, 1.1, '#7a5a3a');
  if (p.thrown) return;
  const tx = hx + dx * 8, ty = hy + dy * 8;
  limb(c, hx - dx * 2.4, hy - dy * 2.4, tx, ty, 0.5, '#d8c8a8');
  if (!lite) glowAt(c, tx, ty, 4, 'rgba(255,170,60,0.6)');
  ell(c, tx, ty, 1, 1.3, '#f0902a');
  if (!lite) ell(c, tx, ty - 0.4, 0.5, 0.8, '#ffd45a');
}
// مروحة ريش ملوّن على الظهر (كبيرة للبطل): ريشات كل لون برسمة (المبسّطة: لونان للبطل، ولون واحد للصغيرة)
const FAN_COLS = [QUET, RED3, TURQ, '#e8b23a'];
function featherFan(c, J, big, lite) {
  at(J.chest, -1.8, -0.4, J.a2); const bx = PT.x, by = PT.y;
  const n = big ? 7 : 4, L = big ? 13 : 8, m = lite ? (big ? 2 : 1) : 4;
  c.lineWidth = big ? 1.6 : 1.2;
  for (let pass = 0; pass < m; pass++) {
    c.beginPath();
    for (let k = pass; k < n; k += m) {
      const a = -Math.PI / 2 - 0.9 + k * (1.8 / (n - 1)), ex = bx + Math.cos(a) * L - 2, ey = by + Math.sin(a) * L;
      c.moveTo(bx, by); c.quadraticCurveTo((bx + ex) / 2 - 1, (by + ey) / 2, ex, ey);
    }
    c.strokeStyle = FAN_COLS[pass]; c.stroke();
  }
}
// الماكواويتل معلّقة على الظهر: هراوة بحواف من حجر الزجاج البركاني (المبسّطة: الهراوة وحدها)
function macuahuitl(c, J, lite) {
  at(J.chest, -2.4, 0, J.a2); const ax = PT.x, ay = PT.y - 3;
  at(J.mid, -3.8, 4, J.pl); const ex = PT.x, ey = PT.y;
  limb(c, ax, ay, ex, ey, 1.2, '#6a4a2a');
  if (lite) return;
  c.beginPath();
  for (let k = 0; k < 5; k++) {
    const t = 0.15 + k * 0.17, px = ax + (ex - ax) * t, py = ay + (ey - ay) * t;
    triTo(c, px - 0.4, py, px - 1.6, py + 0.4, px - 0.4, py + 0.9);
  }
  c.fillStyle = '#1e1e24'; c.fill();
}
// نقطة على لوح الجذع: u من الخلف إلى الأمام، وv من الكتفين إلى الحوض (في PT)
function onTorso(T, u, v) {
  const tx = T.x0 + (T.x1 - T.x0) * u, ty = T.y0 + (T.y1 - T.y0) * u;
  const bx = T.x3 + (T.x2 - T.x3) * u, by = T.y3 + (T.y2 - T.y3) * u;
  PT.x = tx + (bx - tx) * v; PT.y = ty + (by - ty) * v;
  return PT;
}
const jagBow = pullBow(7.4, 1.2, '#6a4a2a', 1), eagleBow = pullBow(7.4, 1.2, GOLD, 3);
function mexico(lite) {
  const legFrom = 0;                   // الساقان كاملتان (الإزار القصير لا يُرسم في المبسّطة)
  return {
    common: { sx: 0.97, sy: 1.04, lw: 2.8, headR: 3.5, wlen: 3.4, legFrom,
      head: (c) => featherHB(c, lite),
      chest: (c, J, p, col) => ichca(c, J, col, lite),
      robe: lite ? undefined : (c, J, p, col) => maxtlatl(c, J, col),
      back: (c, J) => chimalli(c, J.handB[0], J.handB[1], 3, lite),
      weapon: (c, J, p) => slingM(c, J, p, lite) },
    sniper: { sx: 0.98, sy: 1.05, lw: 2.9, headR: 3.5, wlen: 2, legFrom,
      head: (c) => jaguarHelm(c, lite),
      chest(c, J, p, col) {                      // الدرع القطني ببقع الجاغوار
        const T = ichca(c, J, col, lite);
        if (lite) return;
        c.beginPath();
        for (let k = 0; k < 4; k++) { onTorso(T, 0.3 + k * 0.15, 0.3 + (k % 2) * 0.4); c.moveTo(PT.x + 0.6, PT.y); c.arc(PT.x, PT.y, 0.6, 0, TAU); }
        c.strokeStyle = '#3a2a1a'; c.lineWidth = 0.4; c.stroke();
      },
      robe: lite ? undefined : (c, J, p, col) => maxtlatl(c, J, col),
      back: (c, J) => featherFan(c, J, false, lite),
      weapon: jagBow },
    firebomber: { sx: 0.99, sy: 1.04, lw: 2.9, headR: 3.5, wlen: 4, legFrom,
      head: (c) => featherHB(c, lite),
      chest: (c, J, p, col) => ichca(c, J, col, lite),
      robe: lite ? undefined : (c, J, p, col) => maxtlatl(c, J, col),
      back: lite ? undefined : (c, J) => {       // ثلاثة سهام احتياطية على الظهر
        c.beginPath();
        for (let k = 0; k < 3; k++) {
          at(J.chest, -2 + k * 0.6, -1.4, J.a2); c.moveTo(PT.x, PT.y);
          at(J.mid, -2.6 + k * 0.6, 2.6, J.pl); c.lineTo(PT.x, PT.y);
        }
        c.strokeStyle = '#d8c8a8'; c.lineWidth = 0.5; c.stroke();
      },
      weapon: (c, J, p) => atlatl(c, J, p, lite) },
    champion: { sx: 1.02, sy: 1.08, lw: 3, headR: 3.6, wlen: 2, legFrom,
      ground: heroRing,
      head: (c) => eagleHelm(c, lite),
      back(c, J) { featherFan(c, J, true, lite); macuahuitl(c, J, lite); },
      chest(c, J, p, col) {                      // صدرية بنية بريش أبيض وبني صفاً صفاً
        const T = torso(c, J, '#8a6a46', lite ? null : dk(col, 0.3));
        if (lite) return;
        for (let pass = 0; pass < 2; pass++) {
          c.beginPath();
          for (let r = pass; r < 3; r += 2) for (let k = 0; k < 3; k++) {
            onTorso(T, 0.2 + k * 0.3, 0.2 + r * 0.3);
            triTo(c, PT.x - 0.6, PT.y, PT.x, PT.y + 1, PT.x + 0.6, PT.y);
          }
          c.fillStyle = pass ? '#f2efe6' : '#a87a4a'; c.fill();
        }
      },
      robe: lite ? undefined : (c, J, p, col) => maxtlatl(c, J, col),
      weapon: eagleBow }
  };
}

registerNation('brazil', both(brazil));
registerNation('argentina', both(argentina));
registerNation('mexico', both(mexico), { firebomber: 'firearrow' });
