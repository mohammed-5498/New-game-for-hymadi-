/* الدفعة الأوروبية (المرحلة 9ب، القسم 3.10): فرنسا «الأباتشي»، بريطانيا «فتيان سمول هيث»، ألمانيا «اللاندسكنخت».
   منقولة من docs/nations/batch3-skins.js: نفس الأشكال والنسب والألوان، مع إضافات اللعبة كما في الدفعات السابقة:
   حقول السلاح (wlen وtwoH وtipLen وbutt)، وحلقات الأبطال، ونسخة مبسّطة لكل وحدة (الجسد وغطاء الرأس والثياب
   والسلاح، بلا خطوط ولا نقوش صغيرة)، والنقاط أعداد مباشرة بلا مصفوفات جديدة في كل إطار (at وtorso في nationArt.js).
   - حامل الراية بلا رايته حين يغرسها (النوع champion_away، unit.awayUntil): يقاتل بالسيف القصير
   - لوح الجذع torso مشترك بين الدفعات 3 و4 و5 (nationArt.js)
   (المرحلة 9ج) بالنمط المظلَّل: المعطف والنصال وخطوط الراية أشكال مستقلة في النسخ الكاملة (تأخذ تدرجها)،
   وكرات اللاندسكنخت المنفوخة أصغر (batch3 المحدث)، وتفاصيل skins-v6.js: حزام وأساور القميص لفرنسا، وشريط
   القبعة النحاسي والياقة والأكمام لبريطانيا، وصدرية ألمانيا بخطوط ملونة وحزام بحقيبة وشقوق السراويل. */
import { TAU, dk, lt, limb, ell, rrect } from './anim.js';
import { heroRing } from './bodies.js';
import {
  registerNation, both, memo, STEEL2, pg, dot, belt, staff, ellTo, triTo, at, PT, torso, hStripes, vStripes,
  collarV, armband, cuff, pouchX
} from './nationArt.js';

const RED2 = '#c22f2f', COAL = '#3a3a3e', BRASS = '#c9a04a', LGOLD = '#d9a83a', CUIR = '#b8bec6';
const CREAM_SHIRT = '#f2efe8', DARKW = '#5f646b';

// ---------- غطاء الرأس (إحداثيات الرأس: المركز 0,0 والوجه نحو +x). drawBody يعيد تحويل الرأس بعده ----------
const CAP_PEAK = [[1.6, -1.6], [5.6, -0.8], [5.2, 0], [1.4, -0.4]];
// القبعة المسطحة مائلة بزاوية tilt، ثم يعود الدوران حتى يُرسم ما بعدها مستقيماً
function flatCap(c, col, tilt) {
  c.rotate(tilt);
  ell(c, -0.3, -2.2, 4, 2.2, col);
  pg(c, CAP_PEAK, dk(col, 0.25));
  c.rotate(-tilt);
}
// قبعة الأباتشي الداكنة بشريط أحمر
function apacheCap(c) { flatCap(c, '#2b2b30', 0.18); ell(c, -0.4, -1.5, 3.9, 0.5, RED2); }
// القبعة المستديرة (بولر) بشريط بني
function bowler(c, lite) {
  ell(c, 0, -1.4, 5, 1, '#1e1e22');
  c.beginPath(); c.ellipse(0, -1.6, 3.2, 3.4, 0, Math.PI, 0); c.fillStyle = '#26262b'; c.fill();
  if (!lite) ell(c, 0, -1.9, 3.2, 0.5, '#5a3a2a');
}
// قبعة اللاندسكنخت العريضة المائلة بريش أبيض وأحمر (المبسّطة: الريش الأبيض وحده)
function landsHat(c, col, big, lite) {
  const s = big ? 1.25 : 1, n = big ? 4 : 3;
  c.rotate(-0.25);
  ell(c, 0, -2.6, 5.6 * s, 1.5 * s, col); ell(c, 0.4, -3.4, 3 * s, 1.4 * s, dk(col, 0.2));
  for (let pass = 0; pass < (lite ? 1 : 2); pass++) {      // الريشات بلونين: رسمة لكل لون
    c.beginPath();
    for (let k = pass ? 0 : 1; k < n; k += 2) {
      c.moveTo(-1 + k * 0.6, -3.6); c.quadraticCurveTo(-4 - k * 1.2, -8 - k * 1.4, -7.6 - k * 0.8, -4.2 - k * 0.6);
    }
    c.strokeStyle = pass ? RED2 : CREAM_SHIRT; c.lineWidth = 0.9; c.stroke();
  }
  c.rotate(0.25);
}
// خوذة المريون لحامل الرمح الطويل
function morion(c) {
  c.beginPath(); c.ellipse(0, -1.4, 4.2, 3.6, 0, Math.PI, 0); c.fillStyle = CUIR; c.fill();
  ell(c, 0, -1.4, 5.2, 0.8, '#9aa0a8');
}

// ---------- منديل العنق (علامة الأباتشي، ووشاح سمول هيث) ----------
function neckerchief(c, J, col) {
  const a = J.a2;
  at(J.chest, -1.6, -1.2, a); const ax = PT.x, ay = PT.y;
  at(J.chest, 2, -1.2, a); limb(c, ax, ay, PT.x, PT.y, 1.4, col);
  at(J.chest, 1.4, -1.4, a); const p1x = PT.x, p1y = PT.y;
  at(J.chest, 3.4, 1.2, a); const p2x = PT.x, p2y = PT.y;
  at(J.chest, 2.2, -0.6, a);
  c.beginPath(); triTo(c, p1x, p1y, p2x, p2y, PT.x, PT.y); c.fillStyle = col; c.fill();
}
// خط مائل من الصدر إلى الورك (حمالة أو طرف المعطف)
function strap(c, J, cxo, cyo, hxo, hyo, w, col) {
  at(J.chest, cxo, cyo, J.a2); const ax = PT.x, ay = PT.y;
  at(J.hip, hxo, hyo, J.pl); limb(c, ax, ay, PT.x, PT.y, w, col);
}
// معطف طويل خلف الجسد حتى الساق: من الكتف (back) إلى الحاشية عند (hbx, hby) بعرض hem خلفها
// (الكاملة بحافتها مضلع pg يأخذ تدرجه بالنمط المظلَّل)
function longCoat(c, J, hbx, hby, back, hem, fill, edge) {
  at(J.chest, back, -0.6, J.a2); const ax = PT.x, ay = PT.y;
  at(J.chest, 1.2, -0.4, J.a2);
  if (edge) { pg(c, [[ax, ay], [PT.x, PT.y], [hbx + 1.4, hby], [hbx - hem, hby]], fill, edge, 0.8); return; }
  c.beginPath(); c.moveTo(ax, ay); c.lineTo(PT.x, PT.y); c.lineTo(hbx + 1.4, hby); c.lineTo(hbx - hem, hby); c.closePath();
  c.fillStyle = fill; c.fill();
}

// ---------- الأسلحة ----------
function knife(c, J, a, L, from) {                 // سكين: مقبض ونصل (from: اليد)
  const dx = Math.cos(a), dy = Math.sin(a), hx = from[0], hy = from[1];
  limb(c, hx - dx * 0.8, hy - dy * 0.8, hx + dx * 0.8, hy + dy * 0.8, 1.3, '#3a2a22');
  limb(c, hx + dx * 0.8, hy + dy * 0.8, hx + dx * L, hy + dy * L, 1, STEEL2);
}
// مسدس الأباتشي: جسم المسدس وقبضة نحاسية من أربع حلقات وسكين قابل للطي
function apachePistol(c, J, p, lite) {
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), nx = -dy, ny = dx, hx = J.handF[0], hy = J.handF[1];
  c.beginPath();
  c.moveTo(hx - nx * 1.2, hy - ny * 1.2); c.lineTo(hx + dx * 2.2 - nx * 1.2, hy + dy * 2.2 - ny * 1.2);
  c.lineTo(hx + dx * 2.2 + nx, hy + dy * 2.2 + ny); c.lineTo(hx + nx, hy + ny); c.closePath();
  c.fillStyle = '#4a4a50'; c.fill();
  if (!lite) {
    c.beginPath();
    for (let k = 0; k < 4; k++) ellTo(c, hx + dx * 0.4 + nx * (-1 + k * 0.66), hy + dy * 0.4 + ny * (-1 + k * 0.66), 0.45, 0.45);
    c.fillStyle = BRASS; c.fill();
  }
  limb(c, hx + dx * 2.2, hy + dy * 2.2, hx + dx * 5.6, hy + dy * 5.6, 0.9, STEEL2);
}
// عصا بمقبض مستدير (فن «لا كان»، وعصا زعيم الحي)
function cane(c, J, p, back, L, w, col, knob, kr) {
  const s = staff(c, J, p, back, L, w, col);
  dot(c, s.ax, s.ay, kr, knob);
}
// حزام بإبزيم نحاسي ثقيل يُلوَّح به
function buckleBelt(c, J, p, lite) {
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), nx = -dy, ny = dx, hx = J.handF[0], hy = J.handF[1];
  const ex = hx + dx * 6, ey = hy + dy * 6;
  c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo(hx + dx * 3 + nx * 1.6, hy + dy * 3 + ny * 1.6, ex, ey);
  c.strokeStyle = '#4a3424'; c.lineWidth = 1; c.stroke();
  rrect(c, ex - 1.2, ey - 1, 2.4, 2, lite ? 0 : 0.3, BRASS);
}
// قبضة نحاسية: أربع حلقات على اليد
function knuckles(c, P) {
  c.beginPath();
  for (let k = 0; k < 4; k++) ellTo(c, P[0] + 0.3, P[1] - 1 + k * 0.66, 0.5, 0.5);
  c.fillStyle = BRASS; c.fill();
}
// غطاء البرميل درعاً مستديراً
function barrelLid(c, J, lite) {
  const ox = J.handF[0] + 1.2, oy = J.handF[1];
  dot(c, ox, oy, 5.2, '#6e737a'); dot(c, ox, oy, 4.4, '#8a9098');
  if (!lite) {
    c.beginPath();
    for (let k = 0; k < 3; k++) { const r = 1.4 + k; c.moveTo(ox + r, oy); c.arc(ox, oy, r, 0, TAU); }
    c.strokeStyle = '#6e737a'; c.lineWidth = 0.4; c.stroke();
  }
  rrect(c, ox - 1, oy - 0.6, 2, 1.2, 0.4, '#4a4e54');
}
// الكاتسبالغر: سيف اللاندسكنخت القصير بواقٍ على شكل S
function katzbalger(c, J, p, lite) {
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), nx = -dy, ny = dx, hx = J.handF[0], hy = J.handF[1];
  const ax = hx + dx, ay = hy + dy;
  if (lite) {
    c.beginPath(); c.moveTo(ax, ay);
    c.lineTo(hx + dx * 6 + nx * 0.6, hy + dy * 6 + ny * 0.6); c.lineTo(hx + dx * 6.8, hy + dy * 6.8);
    c.lineTo(hx + dx * 6 - nx * 0.6, hy + dy * 6 - ny * 0.6); c.closePath();
    c.fillStyle = STEEL2; c.fill();
  } else pg(c, [[ax, ay], [hx + dx * 6 + nx * 0.6, hy + dy * 6 + ny * 0.6], [hx + dx * 6.8, hy + dy * 6.8], [hx + dx * 6 - nx * 0.6, hy + dy * 6 - ny * 0.6]], STEEL2);
  if (!lite) {
    c.beginPath(); c.moveTo(ax + nx * 1.8, ay + ny * 1.8);
    c.quadraticCurveTo(ax + nx * 0.6 - dx, ay + ny * 0.6 - dy, ax, ay);
    c.quadraticCurveTo(ax - nx * 0.6 + dx, ay - ny * 0.6 + dy, ax - nx * 1.8, ay - ny * 1.8);
    c.strokeStyle = BRASS; c.lineWidth = 0.7; c.stroke();
  }
  limb(c, hx - dx, hy - dy, ax, ay, 1.3, '#3a2a22');
}
// السيف ذو اليدين (التسفايهندر): مقبض طويل ونصل طويل وواقيان
function zweihander(c, J, p, lite) {
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), nx = -dy, ny = dx, hx = J.handF[0], hy = J.handF[1];
  const gx = hx + dx * 1.6, gy = hy + dy * 1.6;
  limb(c, hx - dx * 3, hy - dy * 3, gx, gy, 1.4, '#3a2a22');
  limb(c, gx, gy, hx + dx * 13, hy + dy * 13, 1.5, STEEL2);
  c.beginPath(); c.moveTo(gx + nx * 2.6, gy + ny * 2.6); c.lineTo(gx - nx * 2.6, gy - ny * 2.6);
  if (!lite) { const rx = gx + dx * 2.6, ry = gy + dy * 2.6; c.moveTo(rx + nx * 1.4, ry + ny * 1.4); c.lineTo(rx - nx * 1.4, ry - ny * 1.4); }
  c.strokeStyle = DARKW; c.lineWidth = 0.9; c.stroke();
}
// الرمح الطويل (البايك) باليدين
function pike(c, J, p) {
  const s = staff(c, J, p, 5, 14, 1.1, '#7a5a3a'), dx = s.dx, dy = s.dy, bx = s.bx, by = s.by;
  c.beginPath(); triTo(c, bx - dy * 0.8, by + dx * 0.8, bx + dx * 2.6, by + dy * 2.6, bx + dy * 0.8, by - dx * 0.8);
  c.fillStyle = STEEL2; c.fill();
}
// راية حامل الراية الضخمة: سارية قائمة في يده، وقماش بخطوط بلون اللاعب والذهبي يتموج، وذيل مشقوق
function bigBanner(c, J, p, col, lite) {
  const hx = J.handF[0], hy = J.handF[1], tx = hx + 1.4, ty = hy - 20;
  limb(c, hx - 0.6, hy + 6, tx, ty, 1, '#5a4632');
  dot(c, tx, ty, 0.9, BRASS);
  const t = (p.cb || 0) * 2;
  if (!lite) {                                       // الكاملة: كل خط مضلع مستقل يأخذ تدرجه (كالمرجع)
    for (let k = 0; k < 5; k++) {
      const y0 = ty + 1 + k * 2, wv = Math.sin(k * 0.9 + t) * 0.8;
      pg(c, [[tx - 0.2, y0], [tx - 11, y0 + wv], [tx - 11, y0 + 2 + wv], [tx - 0.2, y0 + 2]], k % 2 ? LGOLD : col);
    }
    pg(c, [[tx - 11, ty + 1], [tx - 14, ty + 3.5], [tx - 11, ty + 6]], LGOLD);
    return;
  }
  for (let pass = 0; pass < 2; pass++) {             // الخطوط بلونين: رسمة لكل لون
    c.beginPath();
    for (let k = pass; k < 5; k += 2) {
      const y0 = ty + 1 + k * 2, wv = Math.sin(k * 0.9 + t) * 0.8;
      c.moveTo(tx - 0.2, y0); c.lineTo(tx - 11, y0 + wv); c.lineTo(tx - 11, y0 + 2 + wv); c.lineTo(tx - 0.2, y0 + 2); c.closePath();
    }
    if (pass) { c.moveTo(tx - 11, ty + 1); c.lineTo(tx - 14, ty + 3.5); c.lineTo(tx - 11, ty + 6); c.closePath(); }
    c.fillStyle = pass ? LGOLD : col; c.fill();
  }
}

// ---------- ثياب اللاندسكنخت المشقوقة المنفوخة ----------
// كرة منفوخة بثلاثة شقوق بلون آخر (المبسّطة: الكرة وحدها)
function puff(c, x, y, r, col, alt, lite) {
  dot(c, x, y, r, col);
  if (lite) return;
  c.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = -1 + k * 0.9, ca = Math.cos(a), sa = Math.sin(a);
    c.moveTo(x + ca * r * 0.2, y + sa * r * 0.2 - r * 0.6); c.lineTo(x + ca * r * 0.3, y + sa * r * 0.2 + r * 0.6);
  }
  c.strokeStyle = alt; c.lineWidth = 0.5; c.stroke();
}
const puffDark = memo(col => dk(col, 0.2));
// الكرات المنفوخة على الفخذين، وفي الكاملة (skins-v6) شقوق ملونة فوقها
function landsLegs(c, J, col, lite) {
  const B = J.legB, F = J.legF;
  puff(c, B.h[0] + (B.k[0] - B.h[0]) * 0.45, B.h[1] + (B.k[1] - B.h[1]) * 0.45, 1.7, puffDark(col), LGOLD, lite);
  puff(c, F.h[0] + (F.k[0] - F.h[0]) * 0.45, F.h[1] + (F.k[1] - F.h[1]) * 0.45, 1.8, col, CREAM_SHIRT, lite);
  if (lite) return;
  for (let n = 0; n < 2; n++) {
    const L = n ? F : B, x = L.h[0] + (L.k[0] - L.h[0]) * 0.45, y = L.h[1] + (L.k[1] - L.h[1]) * 0.45;
    limb(c, x - 0.9, y - 1.4, x - 0.6, y + 1.4, 0.55, n ? RED2 : CREAM_SHIRT);
    limb(c, x + 0.8, y - 1.4, x + 1, y + 1.4, 0.55, LGOLD);
  }
}
function landsSleeve(c, J, col, lite) {
  if (J.elbowF) puff(c, (J.Sf[0] + J.elbowF[0]) / 2, (J.Sf[1] + J.elbowF[1]) / 2, 1.5, LGOLD, col, lite);
}
const BRACES = [0.25, 0.75], MIDLINE = [0.5];
// الصدرية المشقوقة: في الكاملة (skins-v6) أربعة خطوط طولية ملونة (أبيض وأحمر وذهبي وأبيض)
const DOUBLET_BANDS = [[0, CREAM_SHIRT], [1, RED2], [2, LGOLD], [3, CREAM_SHIRT]];
function landsDoublet(c, J, col, lite) {
  const T = torso(c, J, col, lite ? null : dk(col, 0.3));
  if (lite) return;
  for (const [k, band] of DOUBLET_BANDS) {
    const u0 = 0.12 + k * 0.21, u1 = u0 + 0.09;
    pg(c, [[T.x0 + (T.x1 - T.x0) * u0, T.y0 + (T.y1 - T.y0) * u0], [T.x0 + (T.x1 - T.x0) * u1, T.y0 + (T.y1 - T.y0) * u1],
           [T.x3 + (T.x2 - T.x3) * u1, T.y3 + (T.y2 - T.y3) * u1], [T.x3 + (T.x2 - T.x3) * u0, T.y3 + (T.y2 - T.y3) * u0]], band);
  }
}
// حزام بحقيبة (skins-v6)
function landsBelt(c, J) { belt(c, J, '#5a3a22', 1.3); pouchX(c, J, -2, '#6a4428'); }

// ---------- فرنسا «الأباتشي» (نمط الخاطف) ----------
// القميص المخطط: أبيض بخطوط بلون اللاعب (المبسّطة: القميص بلا خطوط)
function stripedShirt(c, J, col, lite) {
  const T = torso(c, J, CREAM_SHIRT, lite ? null : dk(col, 0.3));
  if (!lite) hStripes(c, T, 4, col, 0.8);
}
// أساور القميص الأبيض على الساعد والعضد (skins-v6)
function sleeves(c, J) { cuff(c, J, CREAM_SHIRT); armband(c, J, CREAM_SHIRT, null, 0.35); }
function france(lite) {
  const front = lite ? undefined : sleeves;
  return {
    common: { sx: 0.96, sy: 1.04, lw: 2.8, headR: 3.5, wlen: 4.6,
      head: apacheCap,
      chest: (c, J, p, col) => stripedShirt(c, J, col, lite),
      over: lite ? undefined : (c, J) => { neckerchief(c, J, RED2); belt(c, J, '#2b2b30', 1.3); },
      front,
      weapon: (c, J, p) => knife(c, J, p.wa, 4.6, J.handF) },
    spear: { sx: 0.97, sy: 1.05, lw: 2.8, headR: 3.5, wlen: 9, butt: 2.4,
      head: apacheCap,
      chest: (c, J, p, col) => stripedShirt(c, J, col, lite),
      over: lite ? undefined : (c, J) => { neckerchief(c, J, RED2); belt(c, J, '#2b2b30', 1.3); },
      front,
      weapon: (c, J, p) => cane(c, J, p, 2.4, 9, 1, '#3a2a22', '#d9d4c8', 0.9) },
    dual: { sx: 0.94, sy: 1.05, lw: 2.7, headR: 3.5, wlen: 4.4,
      head(c) { ell(c, -0.4, -1.6, 3.7, 2.3, '#2b2b30'); },
      chest(c, J, p, col) {                      // صدرية بلون اللاعب وحمالة بيضاء
        torso(c, J, col, lite ? null : dk(col, 0.3));
        if (!lite) strap(c, J, -1.8, 0, -1.8, -1, 0.6, CREAM_SHIRT);
      },
      over: lite ? undefined : (c, J) => { neckerchief(c, J, RED2); belt(c, J, RED2, 1.6); },
      front,
      back(c, J, p) {                            // السكين الثانية في اليد الخلفية
        const a = p.wa + 0.8, hx = J.handB[0], hy = J.handB[1];
        limb(c, hx, hy, hx + Math.cos(a) * 4, hy + Math.sin(a) * 4, 1, STEEL2);
      },
      weapon: (c, J, p) => knife(c, J, p.wa, 4.4, J.handF) },
    champion: { sx: 1.0, sy: 1.07, lw: 3.0, headR: 3.5, wlen: 5.6,
      ground: heroRing,
      head: (c) => bowler(c, lite),
      back(c, J, p, col) {                       // المعطف الطويل
        const L = J.legB, hbx = L.k[0] + (L.f[0] - L.k[0]) * 0.5, hby = L.k[1] + (L.f[1] - L.k[1]) * 0.5;
        longCoat(c, J, hbx, hby, -2.6, 3.6, '#2b2b30', lite ? null : dk(col, 0.2));
      },
      chest: (c, J, p, col) => stripedShirt(c, J, col, lite),
      over: lite ? undefined : (c, J) => { neckerchief(c, J, RED2); strap(c, J, 1.9, 0.4, 2.4, -1, 1.2, '#2b2b30'); belt(c, J, '#2b2b30', 1.3); },
      front,
      weapon: (c, J, p) => apachePistol(c, J, p, lite) }
  };
}

// ---------- بريطانيا «فتيان سمول هيث» (نمط الصامد) ----------
const shirtCol = memo(col => lt(col, 0.55));
const OUTER = { x0: 0, y0: 0, x1: 0, y1: 0, x2: 0, y2: 0, x3: 0, y3: 0 };   // القميص تحت الصديري
// الصديري الفحمي فوق قميص بلون اللاعب الفاتح، وثلاثة أزرار نحاسية في وسطه (المبسّطة: بلا أزرار)
function waistcoat(c, J, col, lite) {
  torso(c, J, shirtCol(col), lite ? null : dk(col, 0.3), 0, OUTER);
  const Q = torso(c, J, COAL, null, 0.9);
  if (lite) return;
  const tx = (Q.x0 + Q.x1) / 2, ty = (Q.y0 + Q.y1) / 2, bx = (Q.x3 + Q.x2) / 2, by = (Q.y3 + Q.y2) / 2;
  c.beginPath();
  for (let k = 0; k < 3; k++) { const t = 0.2 + k * 0.28; ellTo(c, tx + (bx - tx) * t, ty + (by - ty) * t, 0.35, 0.35); }
  c.fillStyle = BRASS; c.fill();
}
const scarfCol = memo(col => dk(col, 0.1));
// القبعة المسطحة، وفي الكاملة (skins-v6) شريط نحاسي عليها
function smallHeathCap(c, col, tilt, lite) {
  flatCap(c, col, tilt);
  if (lite) return;
  c.rotate(0.18); ell(c, -0.3, -1.2, 4, 0.4, BRASS); c.rotate(-0.18);
}
const SLEEVE_ROLL = '#e8e0cc';
function britain(lite) {
  return {
    common: { sx: 0.98, sy: 1.04, lw: 2.9, headR: 3.5, wlen: 6,
      head: (c) => smallHeathCap(c, '#4a4640', 0.2, lite),
      chest: (c, J, p, col) => waistcoat(c, J, col, lite),
      over: lite ? undefined : (c, J, p, col) => { neckerchief(c, J, scarfCol(col)); collarV(c, J, CREAM_SHIRT); },
      front: lite ? undefined : (c, J) => cuff(c, J, SLEEVE_ROLL),
      weapon: (c, J, p) => buckleBelt(c, J, p, lite) },
    armored: { sx: 0.98, sy: 1.04, lw: 2.9, headR: 3.5, wlen: 3,
      head: (c) => smallHeathCap(c, '#3e3a36', 0.15, lite),
      chest: (c, J, p, col) => waistcoat(c, J, col, lite),
      over: lite ? undefined : (c, J) => collarV(c, J, CREAM_SHIRT),
      front(c, J) { barrelLid(c, J, lite); if (!lite) cuff(c, J, SLEEVE_ROLL); } },
    smasher: { sx: 0.98, sy: 1.04, lw: 2.9, headR: 3.5, wlen: 1.5,
      head(c) { ell(c, -0.6, -2.4, 3.2, 1.4, '#3a2e26'); },
      chest(c, J, p, col) {                      // قميص فاتح وحمالتان
        const T = torso(c, J, lt(col, 0.6), lite ? null : dk(col, 0.3));
        if (!lite) vStripes(c, T, BRACES, '#3a2e26', 0.8);
      },
      front(c, J) { knuckles(c, J.handF); if (!lite) cuff(c, J, SLEEVE_ROLL); },
      back: (c, J) => knuckles(c, J.handB) },
    champion: { sx: 1.0, sy: 1.06, lw: 3.0, headR: 3.5, wlen: 8,
      ground: heroRing,
      head: (c) => smallHeathCap(c, '#2e2c2a', 0.22, lite),
      back(c, J, p, col) {                       // المعطف الطويل
        const L = J.legB, hbx = L.k[0] + (L.f[0] - L.k[0]) * 0.55, hby = L.k[1] + (L.f[1] - L.k[1]) * 0.55;
        longCoat(c, J, hbx, hby, -2.8, 4, '#3a3632', lite ? null : dk(col, 0.2));
      },
      chest(c, J, p, col) {                      // الصديري وسلسلة ساعة الجيب
        waistcoat(c, J, col, lite);
        if (lite) return;
        const P = OUTER, ax = ((P.x0 + P.x1) / 2) * 0.45 + ((P.x3 + P.x2) / 2) * 0.55, ay = ((P.y0 + P.y1) / 2) * 0.45 + ((P.y3 + P.y2) / 2) * 0.55;
        const bx = P.x1 + (P.x2 - P.x1) * 0.6, by = P.y1 + (P.y2 - P.y1) * 0.6;
        c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 1.2, bx, by);
        c.strokeStyle = BRASS; c.lineWidth = 0.5; c.stroke();
      },
      over: lite ? undefined : (c, J) => { neckerchief(c, J, '#7a1f2a'); collarV(c, J, CREAM_SHIRT); },
      weapon: (c, J, p) => cane(c, J, p, 1.6, 8, 0.9, '#2a2220', '#d9dde2', 1.1) }
  };
}

// ---------- ألمانيا «اللاندسكنخت» (نمط الصامد) ----------
const hatCol = (k) => memo(col => dk(col, k));
const hat15 = hatCol(0.15), hat20 = hatCol(0.2), hat10 = hatCol(0.1);
function germany(lite) {
  const doublet = (c, J, p, col) => landsDoublet(c, J, col, lite);
  const legs = (c, J, p, col) => landsLegs(c, J, col, lite);
  const sleeve = (c, J, p, col) => landsSleeve(c, J, col, lite);
  const over = lite ? undefined : landsBelt;
  const bannerBearer = (planted) => ({ sx: 1.0, sy: 1.06, lw: 3.0, headR: 3.5,
    ground: heroRing,
    head: (c, p, col) => landsHat(c, hat10(col), true, lite),
    chest: doublet, robe: legs, over, front: sleeve,
    // يحمل الراية بيديه، وحين يغرسها يقاتل بالسيف القصير
    ...(planted ? { wlen: 6.8, weapon: (c, J, p) => katzbalger(c, J, p, lite) }
                : { wlen: 20, twoH: true, tipLen: 6, weapon: (c, J, p, col) => bigBanner(c, J, p, col, lite) }) });
  return {
    common: { sx: 0.98, sy: 1.04, lw: 2.9, headR: 3.5, wlen: 6.8,
      head: (c, p, col) => landsHat(c, hat15(col), false, lite),
      chest: doublet, robe: legs, over, front: sleeve,
      weapon: (c, J, p) => katzbalger(c, J, p, lite) },
    armored: { sx: 0.98, sy: 1.04, lw: 2.9, headR: 3.5, wlen: 14, twoH: true, tipLen: 16.6, butt: 5,
      head: morion,
      chest(c, J, p, col) {                      // صدرية مشقوقة ودرع صدر فولاذي فوقها
        landsDoublet(c, J, col, lite);
        const T = torso(c, J, CUIR, lite ? null : '#7a8088', 0.4);
        if (!lite) vStripes(c, T, MIDLINE, '#e6eaee', 0.6);
      },
      robe: legs, over, front: sleeve,
      weapon: pike },
    smasher: { sx: 0.98, sy: 1.04, lw: 2.9, headR: 3.5, wlen: 13, twoH: true, tipLen: 13, butt: 3,
      head: (c, p, col) => landsHat(c, hat20(col), false, lite),
      chest: doublet, robe: legs, over, front: sleeve,
      weapon: (c, J, p) => zweihander(c, J, p, lite) },
    champion: bannerBearer(false),
    champion_away: bannerBearer(true)
  };
}

registerNation('france', both(france));
registerNation('britain', both(britain));
registerNation('germany', both(germany));
