/* الدفعة الآسيوية (المرحلة 9ب، القسم 3.10): الصين «إخوة الجبل»، اليابان «الكابوكيمونو»، كوريا «الهوارانغ».
   منقولة من docs/nations/batch2-skins.js: نفس الأشكال والنسب والألوان، مع إضافات اللعبة كما في الدفعة العربية
   (nationsArab.js): حقول السلاح (wlen وtwoH وtipLen وbutt)، وحلقات الأبطال والهالات من bodies.js، والحجر
   يختفي لحظة الرمي، ونسخة مبسّطة لكل وحدة (الجسد وغطاء الرأس وشكل الثوب والسلاح فقط)، والأشكال بلون واحد
   في مسار واحد. وفوق ذلك:
   - القوس الكوري المنحني: قوس اللعبة نفسه بشد الوتر (bodies.js)، وطرفاه مرتدان للأمام والوتر مربوط بهما
   - رامي السهام المشتعلة يرمي بالقوس لا باليد (shoots)، وزجاجته تطير سهماً مشتعلاً (shotLook في nationArt.js)،
     وقواعده كلها قواعد رامي النار (السهم يشعل الأرض حيث يسقط)
   - البطل الصيني يحمل راية ليانغشان المشمشية على ظهره
   (المرحلة 9ج) بالنمط المظلَّل: الأشكال الكبيرة التي يرسمها المرجع بـ ell وpg مستقلة في النسخ الكاملة (فتأخذ
   تدرجها)، والسهم المشتعل بلهب الطبقات، وتفاصيل skins-v6.js: حافة بيضاء وشق جانبي للصين، وحافة سوداء بخط ذهبي
   وياقة وشرّابة الأوبي وموج السيغايها لليابان، وحافة بيضاء وسحب وياقة وشرّابة النوريغاي لكوريا. */
import { TAU, dk, lt, limb, ell, rrect, tri, rot, add, flame } from './anim.js';
import { heroRing } from './bodies.js';
import {
  registerNation, both, memo, mixHex, GOLD, STEEL2, auraRing, auraHealRings,
  lp, pg, dot, robe, stripes, belt, staff, ellTo, triTo, pullBow, quiverBack, at, PT,
  hemBand, hemLine, hemCloud, collarV, tassel
} from './nationArt.js';

const JADE = '#3f8f6a', APRI = '#e0b23a', CRIM = '#b8283a', INK = '#232328', PINK = '#e07a9a', SKY = '#6aa8d8';

const songCol = memo(col => mixHex(col, '#d9d2c0', 0.35));         // ثوب سونغ بأكمام واسعة

// ---------- أغطية الرأس (إحداثيات الرأس: المركز 0,0 والوجه نحو +x) ----------
// منديل الرأس وكعكة الشعر وطرفا المنديل خلف الرأس
function kerchief(c, lite) {
  if (lite) { c.beginPath(); ellTo(c, -0.2, -1.6, 4.1, 2.6); }
  else { ell(c, -0.2, -1.6, 4.1, 2.6, INK); c.beginPath(); }        // الكاملة: الرأس شكل مستقل يأخذ تدرجه
  ellTo(c, 0.2, -4.2, 1.4, 1.2);
  triTo(c, -3.4, -1, -6, 2.6, -2.6, 0.4);
  c.fillStyle = INK; c.fill();
  if (!lite) tri(c, [-3, -0.2], [-5, 3.6], [-2.2, 0.6], '#3a3a40');
}
// قبعة القش المخروطية للطبيب الجوال
function douli(c, lite) {
  tri(c, [-6.6, -0.6], [0.2, -6.2], [7, -0.6], '#c9a86a');
  if (lite) return;
  limb(c, -6.6, -0.6, 7, -0.6, 0.6, '#8a6e3e');
  c.beginPath();
  for (let k = -2; k <= 2; k++) { c.moveTo(0.2, -6); c.lineTo(k * 2.8, -0.8); }
  c.strokeStyle = '#a8884e'; c.lineWidth = 0.3; c.stroke();
}
// عصابة رأس بطرفين متطايرين (شيخ العصا)
function headbandRibbon(c, col, lite) {
  c.beginPath();
  if (lite) ellTo(c, 0, -2.2, 4, 0.9); else { ell(c, 0, -2.2, 4, 0.9, col); c.beginPath(); }
  triTo(c, -3.6, -2.2, -7, 1, -3, -1.2);
  triTo(c, -3.2, -1.8, -6.4, 3.2, -2.6, -0.8);
  c.fillStyle = col; c.fill();
}
// قبعة زعيم ليانغشان العالية بشريط قرمزي
function chiefHat(c, lite) {
  if (!lite) { ell(c, 0, -2, 4, 2.4, INK); rrect(c, -1.8, -6.6, 3.6, 3.2, 0.6, INK); limb(c, -1.6, -5, -5, -2, 0.6, CRIM); return; }
  c.beginPath();
  ellTo(c, 0, -2, 4, 2.4);
  if (c.roundRect) c.roundRect(-1.8, -6.6, 3.6, 3.2, 0.6); else c.rect(-1.8, -6.6, 3.6, 3.2);
  c.fillStyle = INK; c.fill();
}
// شعر منفوش بخصلات حادة وعقدة (الكابوكيمونو): كله بلون واحد في رسمة واحدة
const SPIKES = [];
for (let k = 0; k < 6; k++) {
  const a = -2.6 + k * 0.42, ca = Math.cos(a), sa = Math.sin(a);
  SPIKES.push(ca * 2.4 - 0.6, sa * 2.4 - 0.4, ca * 5.6, sa * 5.6 - 1, ca * 2.4 + 0.6, sa * 2.4 - 0.4);
}
// الكاملة: الخصلات ثم الرأس بشكل بيضاوي مستقل (يأخذ تدرجه بالنمط المظلَّل) ثم العقدة، كالمرجع
function spikesPath(c) { c.beginPath(); for (let k = 0; k < SPIKES.length; k += 6) triTo(c, SPIKES[k], SPIKES[k + 1], SPIKES[k + 2], SPIKES[k + 3], SPIKES[k + 4], SPIKES[k + 5]); }
function wildHair(c) {
  spikesPath(c);
  ellTo(c, -0.4, -1.6, 3.7, 2.4);
  if (c.roundRect) c.roundRect(-0.6, -6.4, 1.4, 2.6, 0.4); else c.rect(-0.6, -6.4, 1.4, 2.6);
  c.fillStyle = INK; c.fill();
}
function wildHairFull(c) {
  spikesPath(c); c.fillStyle = INK; c.fill();
  ell(c, -0.4, -1.6, 3.7, 2.4, INK); rrect(c, -0.6, -6.4, 1.4, 2.6, 0.4, INK);
}
// عقدة شعر بدبوس ذهبي وزهرة (الهوارانغ)، وتاج من خمس زهرات للقائد
const PETALS = [];
for (let p = 0; p < 5; p++) PETALS.push(Math.cos(p * 1.2566) * 0.8, Math.sin(p * 1.2566) * 0.8);
const ONE_FLOWER = [[1.6, -4.6]], CROWN = [[-2.6, -3.6], [-0.8, -5.6], [1.4, -5.4], [2.8, -3.4], [0, -6.6]];
function topknotFlower(c, big, lite) {
  if (lite) { c.beginPath(); ellTo(c, -0.2, -1.8, 3.7, 2.2); ellTo(c, 0, -4.4, 1.2, 1.2); c.fillStyle = INK; c.fill(); }
  else { ell(c, -0.2, -1.8, 3.7, 2.2, INK); ell(c, 0, -4.4, 1.2, 1.2, INK); }
  const flowers = big ? CROWN : ONE_FLOWER;
  if (lite) {                                    // من بعيد: كل زهرة دائرة وردية واحدة
    c.beginPath();
    for (let k = 0; k < flowers.length; k++) ellTo(c, flowers[k][0], flowers[k][1], 1.2, 1.2);
    c.fillStyle = PINK; c.fill();
    return;
  }
  limb(c, -1, -4.6, 1, -4.6, 0.5, GOLD);
  for (let k = 0; k < flowers.length; k++) {     // بترتيب المرجع: بتلات الزهرة ثم وسطها، زهرةً زهرة
    const x = flowers[k][0], y = flowers[k][1];
    c.beginPath();
    for (let p = 0; p < 10; p += 2) ellTo(c, x + PETALS[p], y + PETALS[p + 1], 0.55, 0.55);
    c.fillStyle = k % 2 ? '#f2a0b8' : PINK; c.fill();
    ell(c, x, y, 0.4, 0.4, '#f2d46a');
  }
}

// ---------- الأسلحة ----------
// سيف الداو: نصل عريض بحد منحنٍ قليلاً، ومقبض، وواقٍ ذهبي
function dao(c, J, p, L, lite) {
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), nx = -dy, ny = dx, hx = J.handF[0], hy = J.handF[1];
  const ax = hx + dx, ay = hy + dy, bx = hx + dx * L, by = hy + dy * L;
  if (lite) {
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx + nx * 0.4, by + ny * 0.4); c.lineTo(bx - nx * 1.6, by - ny * 1.6);
    c.lineTo(ax - nx, ay - ny); c.closePath();
    c.fillStyle = STEEL2; c.fill();
  } else pg(c, [[ax, ay], [bx + nx * 0.4, by + ny * 0.4], [bx - nx * 1.6, by - ny * 1.6], [ax - nx, ay - ny]], STEEL2);
  limb(c, hx, hy, ax, ay, 1.2, '#5a3a22');
  if (!lite) limb(c, ax + nx * 1.2, ay + ny * 1.2, ax - nx * 1.8, ay - ny * 1.8, 0.8, GOLD);
}
// الكاتانا: نصل منحنٍ رفيع، ومقبض داكن، وواقٍ ذهبي مستدير
function katana(c, fx, fy, a, L, w, lite) {
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  c.beginPath(); c.moveTo(fx + dx * 1.3, fy + dy * 1.3);
  c.quadraticCurveTo(fx + dx * L * 0.6 - nx * 0.8, fy + dy * L * 0.6 - ny * 0.8, fx + dx * L, fy + dy * L);
  c.strokeStyle = '#e4e8ec'; c.lineWidth = w; c.stroke();
  limb(c, fx - dx * 1.6, fy - dy * 1.6, fx + dx, fy + dy, 1.3, '#2a2026');
  if (!lite) ell(c, fx + dx * 1.1, fy + dy * 1.1, 1, 1, GOLD);
}
// القوس الكوري المنحني: قوس اللعبة بشد الوتر وطرفان مرتدان للأمام (pullBow في nationArt.js)
const recurve = (half, lw, col, arrows) => pullBow(half, lw, col, arrows, 1.6, 0.5);
// رامي السهام المشتعلة: القوس، والسهم المشتعل في يده ثم على الوتر عند الشد، ولا سهم بعد الإطلاق
const fireBow = recurve(6.4, 1.2, '#5a2a22', 0);
function fireArcher(lite) {
  return (c, J, p) => {
    fireBow(c, J, p);
    if (p.pull !== undefined && p.pull < 0.05) return;
    const aim = p.pull === undefined ? p.wa * 0.4 : p.wa;
    const dx = Math.cos(aim), dy = Math.sin(aim), hx = J.handF[0], hy = J.handF[1];
    const drawn = p.pull !== undefined;
    const sx = drawn ? J.handB[0] : hx - dx, sy = drawn ? J.handB[1] : hy - dy;
    const tx = hx + dx * (drawn ? 3.8 : 5), ty = hy + dy * (drawn ? 3.8 : 5);
    limb(c, sx, sy, tx, ty, 0.5, '#d8c8a8');
    if (lite) ell(c, tx, ty, 1, 1.3, '#f0902a');
    else flame(c, tx, ty + 0.8, 0.75);           // لهب بطبقات (batch2 المحدث)
  };
}

// ---------- ثياب ----------
// ثوب سونغ، وفي الكاملة (skins-v6) حافة بيضاء وشق جانبي أبيض في حده الأمامي
function songRobe(c, J, col, len, lite) {
  const r = robe(c, J, len, songCol(col), lite ? null : dk(col, 0.3), 'chest', 1.8);
  if (lite) return;
  hemBand(c, 0.93, 1, '#f2efe6');
  const ax = r.w2x + (r.fx - r.w2x) * 0.55, ay = r.w2y + (r.fy - r.w2y) * 0.55;
  limb(c, ax - 0.6, ay, r.fx - 1.2, r.fy, 0.5, '#f2efe6');
}
// كيمونو بلون اللاعب، ونقشان صاخبان (قرمزي وذهبي) في وسطه، وخط داكن قرب الحاشية،
// وفي الكاملة (skins-v6) حافة سوداء بخط ذهبي وياقة بيضاء وسوداء
function kimono(c, J, col, len, lite) {
  const r = robe(c, J, len, col, lite ? null : dk(col, 0.35), 'chest', 1.2);
  if (lite) return;
  for (let i = 0; i < 2; i++) {
    const t = i ? 0.62 : 0.3;
    const mx = (r.w1x + (r.bx - r.w1x) * t + r.w2x + (r.fx - r.w2x) * t) / 2;
    const my = (r.w1y + (r.by - r.w1y) * t + r.w2y + (r.fy - r.w2y) * t) / 2;
    ell(c, mx, my, 1.8, 1.4, i ? GOLD : CRIM);
  }
  stripes(c, [0.85], [INK], 0.9);
  hemBand(c, 0.9, 1, INK); hemLine(c, 0.9, GOLD, 0.45); collarV(c, J, '#f2efe6', INK);
}
// شرّابة الأوبي القرمزية بعقدة ذهبية (skins-v6)
function obiTassel(c, J) { at(J.hip, 1.6, -0.4, J.pl); tassel(c, PT.x, PT.y, CRIM, 3.4, GOLD); }
// حزام الأوبي العريض بعقدة خلفية
function obi(c, J, col) {
  const ca = Math.cos(J.pl), sa = Math.sin(J.pl), hx = J.hip[0], hy = J.hip[1];
  const ax = hx - 2.6 * ca + 1.6 * sa, ay = hy - 2.6 * sa - 1.6 * ca;          // add(J.hip, rot(-2.6, -1.6, J.pl))
  limb(c, ax, ay, hx + 2.8 * ca + 1.6 * sa, hy + 2.8 * sa - 1.6 * ca, 2.4, col);
  ell(c, ax - 0.6, ay, 1.2, 1, col);
}
// هانبوك قصير فاتح بلون اللاعب، وفي الكاملة (skins-v6) حافة بيضاء وسحب زرقاء وياقة بيضاء
function hanbok(c, J, col, len, lite) {
  robe(c, J, len, lt(col, 0.5), lite ? null : dk(col, 0.25), 'chest', 1.4);
  if (lite) return;
  hemBand(c, 0.9, 1, '#f4f2ec'); hemCloud(c, '#8ab4d8', 0.8); collarV(c, J, '#f4f2ec');
}
// حلية النوريغاي المعلقة بالوشاح (skins-v6)
function norigae(c, J, col) { at(J.hip, 1.4, 0.2, J.pl); tassel(c, PT.x, PT.y, col, 4, GOLD); }
// وشاح الخصر بطرفين متدليين (الهوارانغ). النقاط أعداد مباشرة بلا مصفوفات (يُرسم لكل فرد في كل إطار)
function sash(c, J, col) {
  belt(c, J, col, 1.4);
  const ca = Math.cos(J.pl), sa = Math.sin(J.pl);
  const ox = J.hip[0] - 1.8 * ca + 1.3 * sa, oy = J.hip[1] - 1.8 * sa - 1.3 * ca;      // add(J.hip, rot(-1.8, -1.3, J.pl))
  const L = J.legB, tx = L.h[0] + (L.k[0] - L.h[0]) * 1.2, ty = L.h[1] + (L.k[1] - L.h[1]) * 1.2;   // lp(legB.h, legB.k, 1.2)
  c.beginPath(); c.moveTo(ox, oy); c.lineTo(tx - 0.6, ty); c.moveTo(ox + 0.6, oy); c.lineTo(tx + 0.6, ty + 0.4);
  c.strokeStyle = col; c.lineWidth = 0.9; c.stroke();
}

// ---------- الصين «إخوة الجبل» (نمط الحشد) ----------
function china(lite) {
  return {
    common: { sx: 0.98, sy: 1.02, lw: 2.9, headR: 3.5, wlen: 5.4, legFrom: lite ? 0.66 : 0,
      head: (c) => kerchief(c, lite),
      robe: (c, J, p, col) => songRobe(c, J, col, 0.66, lite),
      over: lite ? undefined : (c, J) => belt(c, J, CRIM, 1.6),
      weapon: (c, J, p) => dao(c, J, p, 5.4, lite) },
    boss: { sx: 0.98, sy: 1.04, lw: 2.9, headR: 3.5, wlen: 8, twoH: true, tipLen: 8, butt: 6, legFrom: lite ? 0.6 : 0,
      ground: auraRing,
      head: (c) => headbandRibbon(c, CRIM, lite),
      robe: (c, J, p, col) => songRobe(c, J, col, 0.6, lite),
      over: lite ? undefined : (c, J) => belt(c, J, JADE, 1.8),
      weapon(c, J, p) {                          // عصا طويلة باليدين بطرفين معدنيين
        const s = staff(c, J, p, 6, 8, 1.4, '#7a5a3a');
        if (lite) return;
        c.beginPath(); ellTo(c, s.bx, s.by, 0.8, 0.8); ellTo(c, s.ax, s.ay, 0.8, 0.8); c.fillStyle = '#5a4632'; c.fill();
      } },
    medic: { sx: 0.98, sy: 1.02, lw: 2.8, headR: 3.5, wlen: 1.6, legFrom: lite ? 0.8 : 0,
      head: (c) => douli(c, lite),
      robe: (c, J, p, col) => songRobe(c, J, col, 0.8, lite),
      back(c, J) {                               // سلة الأعشاب على ظهره
        const ca = Math.cos(J.pl), sa = Math.sin(J.pl);
        const qx = J.mid[0] - 2.6 * ca + 0.6 * sa, qy = J.mid[1] - 2.6 * sa - 0.6 * ca;     // add(J.mid, rot(-2.6, -0.6, J.pl))
        rrect(c, qx - 2.4, qy - 3, 4.2, 5, 1, '#a8884e');
        if (lite) return;
        c.beginPath();
        for (let k = 0; k < 3; k++) { const y = qy - 2 + k * 1.6; c.moveTo(qx - 2.2, y); c.lineTo(qx + 1.6, y); }
        c.strokeStyle = '#7a6234'; c.lineWidth = 0.35; c.stroke();
      },
      over: lite ? undefined : (c, J) => {       // حزام وقرعة دواء على الورك
        belt(c, J, JADE, 1.4);
        const ca = Math.cos(J.pl), sa = Math.sin(J.pl);
        const ox = J.hip[0] + 2.4 * ca + 0.6 * sa, oy = J.hip[1] + 2.4 * sa - 0.6 * ca;     // add(J.hip, rot(2.4, -0.6, J.pl))
        c.beginPath(); ellTo(c, ox, oy + 1.6, 1.1, 1.4); ellTo(c, ox, oy - 0.2, 0.7, 0.8); c.fillStyle = '#c98a3a'; c.fill();
      },
      weapon(c, J) {                             // قرعة الدواء في يده
        const hx = J.handF[0], hy = J.handF[1];
        c.beginPath(); ellTo(c, hx + 0.4, hy - 0.6, 1.4, 1.7); ellTo(c, hx + 0.4, hy - 2.6, 0.9, 1); c.fillStyle = '#c98a3a'; c.fill();
        if (!lite) limb(c, hx - 0.6, hy - 1.6, hx + 1.4, hy - 1.6, 0.5, CRIM);
      } },
    champion: { sx: 1.0, sy: 1.06, lw: 3.0, headR: 3.5, wlen: 13.6, twoH: true, tipLen: 13.6, butt: 4, legFrom: lite ? 0.82 : 0,
      ground: auraHealRings,
      head: (c) => chiefHat(c, lite),
      back(c, J) {                               // راية ليانغشان المشمشية على ظهره
        const b = add(J.chest, rot(-1.6, -0.4, J.a2)), tx = b[0] - 1.4, ty = b[1] - 15;
        limb(c, b[0], b[1] + 3, tx, ty, 0.9, '#5a4632');
        pg(c, [[tx, ty], [tx - 8, ty + 1], [tx - 8, ty + 7.5], [tx, ty + 6.5]], APRI, lite ? null : CRIM, 0.8);
        if (lite) return;
        c.beginPath();
        for (let k = 0; k < 3; k++) { const x = tx - 6.4 + k * 2.2; c.moveTo(x, ty + 2.4); c.lineTo(x, ty + 5.6); }
        c.strokeStyle = CRIM; c.lineWidth = 0.5; c.stroke();
      },
      robe: (c, J, p, col) => songRobe(c, J, col, 0.82, lite),
      over: lite ? undefined : (c, J) => belt(c, J, GOLD, 2),
      weapon(c, J, p) {                          // عصا بنصل في رأسها
        const s = staff(c, J, p, 4, 9, 1.3, '#5a3a22'), nx = -s.dy, ny = s.dx;
        if (!lite) {
          pg(c, [[s.bx, s.by], [s.bx + s.dx * 4.6 + nx * 0.6, s.by + s.dy * 4.6 + ny * 0.6], [s.bx + s.dx * 2.4 - nx * 1.8, s.by + s.dy * 2.4 - ny * 1.8]], STEEL2);
          return;
        }
        c.beginPath(); c.moveTo(s.bx, s.by);
        c.lineTo(s.bx + s.dx * 4.6 + nx * 0.6, s.by + s.dy * 4.6 + ny * 0.6);
        c.lineTo(s.bx + s.dx * 2.4 - nx * 1.8, s.by + s.dy * 2.4 - ny * 1.8); c.closePath();
        c.fillStyle = STEEL2; c.fill();
      } }
  };
}

// ---------- اليابان «الكابوكيمونو» (نمط الخاطف) ----------
// موج السيغايها الذهبي على هاوري الزعيم: تسعة أقواس مزدوجة في ثلاثة صفوف (رسمة واحدة)
function seigaiha(c, J, hb) {
  const A = add(J.chest, rot(-2.6, -0.6, J.a2)), L = [hb[0] - 4.2, hb[1]], R = [hb[0] + 1, hb[1]];
  c.beginPath();
  for (let r = 0; r < 3; r++) {
    const u = 0.3 + r * 0.25, l = lp(A, L, u), q = lp(A, R, u);
    for (let k = 0; k < 3; k++) {
      const P = lp(l, q, 0.15 + k * 0.3), x = P[0], y = P[1] + 0.8;
      c.moveTo(x - 1, y); c.arc(x, y, 1, Math.PI, 0); c.moveTo(x - 0.5, y); c.arc(x, y, 0.5, Math.PI, 0);
    }
  }
  c.strokeStyle = GOLD; c.lineWidth = 0.4; c.stroke();
}
function japan(lite) {
  const hair = lite ? wildHair : wildHairFull;
  const o = {
    common: { sx: 0.96, sy: 1.05, lw: 2.8, headR: 3.5, wlen: 7, legFrom: lite ? 0.72 : 0,
      head: hair,
      robe: (c, J, p, col) => kimono(c, J, col, 0.72, lite),
      over: lite ? undefined : (c, J) => { obi(c, J, GOLD); obiTassel(c, J); },
      weapon: (c, J, p) => katana(c, J.handF[0], J.handF[1], p.wa, 7, 1.2, lite) },
    spear: { sx: 0.97, sy: 1.05, lw: 2.8, headR: 3.5, wlen: 11, twoH: true, tipLen: 12.3, butt: 3, legFrom: lite ? 0.76 : 0,
      head: hair,
      robe: (c, J, p, col) => kimono(c, J, col, 0.76, lite),
      over: lite ? undefined : (c, J) => { obi(c, J, CRIM); obiTassel(c, J); },
      weapon(c, J, p) {                          // الغليون الطويل (كيسيرو): ساق داكنة ووعاء ذهبي وفم ذهبي ودخان
        const s = staff(c, J, p, 3, 11, 1, '#3a2a26');
        ell(c, s.bx, s.by, 1.3, 0.9, GOLD);
        if (lite) return;
        limb(c, s.ax, s.ay, s.ax + s.dx * 1.4, s.ay + s.dy * 1.4, 1.2, GOLD);
        const ga = c.globalAlpha; c.globalAlpha = ga * 0.4;
        ell(c, s.bx + 0.6, s.by - 2.6, 1.2, 1.2, '#d9d6cf'); ell(c, s.bx + 1.4, s.by - 4.8, 1.6, 1.6, '#d9d6cf');
        c.globalAlpha = ga;
      } },
    dual: { sx: 0.95, sy: 1.05, lw: 2.7, headR: 3.5, wlen: 6.5, legFrom: lite ? 0.68 : 0,
      head(c) { hair(c); ell(c, 0, -2.1, 4, 0.8, CRIM); },
      robe: (c, J, p, col) => kimono(c, J, col, 0.68, lite),
      over: lite ? undefined : (c, J) => { obi(c, J, INK); obiTassel(c, J); },
      back: (c, J, p) => katana(c, J.handB[0], J.handB[1], p.wa + 0.9, 5, 1, lite),   // السيف الثاني
      weapon: (c, J, p) => katana(c, J.handF[0], J.handF[1], p.wa, 6.5, 1.2, lite) },
    champion: { sx: 1.0, sy: 1.07, lw: 3.0, headR: 3.5, wlen: 8.6, legFrom: lite ? 0.82 : 0,
      ground: heroRing,
      head(c) { hair(c); if (!lite) { rrect(c, -0.4, -8.2, 0.8, 2.4, 0.3, GOLD); ell(c, 0, -8.4, 1, 0.6, CRIM); } },
      back(c, J) {                               // هاوري داكن بحافة ذهبية، وفي الكاملة موج السيغايها الذهبي (skins-v6)
        const hb = lp(J.legB.h, J.legB.k, 0.9);
        pg(c, [add(J.chest, rot(-2.6, -0.6, J.a2)), add(J.chest, rot(1.2, -0.4, J.a2)), [hb[0] + 1, hb[1]], [hb[0] - 4.2, hb[1]]], INK, lite ? null : GOLD, 0.8);
        if (lite) return;
        c.beginPath();
        for (let k = 0; k < 4; k++) ellTo(c, hb[0] - 3.6 + k * 1.3, hb[1] + 0.2, 0.5, 0.5);
        c.fillStyle = '#6a6a70'; c.fill();
        seigaiha(c, J, hb);
      },
      robe: (c, J, p, col) => kimono(c, J, col, 0.82, lite),
      over: lite ? undefined : (c, J) => {
        obi(c, J, GOLD);
        const A = add(J.chest, rot(1.8, 0, J.a2)), B = add(J.hip, rot(2.4, -1, J.pl));
        limb(c, A[0], A[1], B[0], B[1], 1.2, INK);
        obiTassel(c, J);
      },
      weapon: (c, J, p) => katana(c, J.handF[0], J.handF[1], p.wa, 8.6, 1.4, lite) }
  };
  o.samurai = o.common;            // ساموراي الدوجو (lookKind): صورته في الأطلس، وبالكود مثل الكابوكيمونو
  return o;
}

// ---------- كوريا «الهوارانغ» (نمط الرامي) ----------
const archerBow = recurve(6.4, 1.2, '#3a2a22', 1), heroBow = recurve(6.4, 1.3, GOLD, 3);
function korea(lite) {
  const flower = (c) => topknotFlower(c, false, lite);
  return {
    common: { sx: 0.97, sy: 1.04, lw: 2.8, headR: 3.5, wlen: 1.5, legFrom: lite ? 0.42 : 0,
      head: flower,
      robe: (c, J, p, col) => hanbok(c, J, col, 0.42, lite),
      over: lite ? undefined : (c, J) => { sash(c, J, PINK); norigae(c, J, PINK); },
      weapon(c, J, p) { if (!p.thrown) dot(c, J.handF[0] + 0.6, J.handF[1] - 0.6, 1.3, '#8a857c'); } },   // حجر
    sniper: { sx: 0.97, sy: 1.05, lw: 2.8, headR: 3.5, wlen: 2, legFrom: lite ? 0.5 : 0,
      head: flower,
      robe: (c, J, p, col) => hanbok(c, J, col, 0.5, lite),
      back: (c, J) => quiverBack(c, J, '#5a3a2a', '#f2f0e8', lite),     // جعبة السهام
      over: lite ? undefined : (c, J) => { sash(c, J, SKY); norigae(c, J, PINK); },
      weapon: archerBow },
    firebomber: { sx: 0.98, sy: 1.04, lw: 2.9, headR: 3.5, wlen: 2, shoots: true, legFrom: lite ? 0.46 : 0,
      head: flower,
      robe: (c, J, p, col) => hanbok(c, J, col, 0.46, lite),
      over: lite ? undefined : (c, J) => { sash(c, J, CRIM); norigae(c, J, CRIM); },
      weapon: fireArcher(lite) },
    champion: { sx: 1.0, sy: 1.07, lw: 3.0, headR: 3.5, wlen: 2, legFrom: lite ? 0.62 : 0,
      ground: heroRing,
      head: (c) => topknotFlower(c, true, lite),
      back(c, J) {                               // عباءة بيضاء بحافة زرقاء، وفي الكاملة ثلاث سحب ذهبية (skins-v6)
        const hb = lp(J.legB.k, J.legB.f, 0.6), A = add(J.chest, rot(-2.4, -0.6, J.a2));
        pg(c, [A, add(J.chest, rot(1.2, -0.4, J.a2)), [hb[0] + 1, hb[1]], [hb[0] - 4.6, hb[1]]], '#f2f0e8', lite ? null : SKY, 0.9);
        if (lite) return;
        c.beginPath();
        for (let k = 0; k < 3; k++) {
          const P = lp(A, [hb[0] - 2, hb[1]], 0.4 + k * 0.18);
          c.moveTo(P[0] - 1.1, P[1]); c.arc(P[0], P[1], 1.1, Math.PI, 0); c.arc(P[0] + 1.2, P[1], 0.7, Math.PI, 0);
        }
        c.strokeStyle = GOLD; c.lineWidth = 0.45; c.stroke();
      },
      robe: (c, J, p, col) => hanbok(c, J, col, 0.62, lite),
      over: lite ? undefined : (c, J) => { sash(c, J, PINK); norigae(c, J, PINK); },
      weapon: heroBow }
  };
}

registerNation('china', both(china));
registerNation('japan', both(japan));
registerNation('korea', both(korea), { firebomber: 'firearrow' });
