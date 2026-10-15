/* الدفعة العربية (المرحلة 9أ، القسم 3.10): اليمن «أبناء سبأ»، السعودية «حراس القوافل»، مصر «فتوات الحارة».
   منقولة من docs/nations/batch1-skins.js: نفس الأشكال والنسب والألوان، مع إضافات اللعبة:
   - حقول السلاح (wlen وtwoH وtipLen وbutt) لمكان الشرر وأثر الضربة، وحلقات الأبطال والهالات من bodies.js
   - الحجر والقِدر يختفيان لحظة الرمي (thrown)، وقوس القوّاس بشدّ الوتر كقوس القناص
   - الصقّار: القوس يظهر في يده أثناء الرمي فقط والصقر على ساعده، وبلا صقر حين ينقضّ (نوع champion_away)
   - نسخة مبسّطة لكل وحدة: الجسد وغطاء الرأس وشكل الثوب والسلاح، بلا حواف ولا خطوط ولا نقوش صغيرة
   - للأداء: الأشكال بلون واحد في مسار واحد (مربعات الشماغ الحمراء رسمة واحدة بدل خمس عشرة)،
     وفي المستوى المبسّط تبدأ الساقان من حاشية الثوب (legFrom = طول الثوب) فلا يُرسم ما يغطيه الثوب */
import { TAU, dk, lt, limb, ell, rrect, tri, rot, add } from './anim.js';
import { heroRing, bow } from './bodies.js';
import {
  registerNation, both, memo, mixHex, GOLD, STEEL2, auraRing, auraHealRings,
  lp, pg, circ, dot, legPt, robe, stripes, belt, staff, triTo
} from './nationArt.js';

const IND = '#2f3f7a', HORN = '#e3d6b0', WOODD = '#6e4f33', WHT = '#f2efe8', SHM = '#c0392b', AGAL = '#1c1c1c';

// ألوان مشتقة من لون اللاعب (مرة لكل لون)
const wrapCol = memo(col => lt(col, 0.72));                       // لفّة العمامة
const wrapLine = memo(col => dk(lt(col, 0.72), 0.15));
const izarCol = memo(col => mixHex(col, '#d8c8a8', 0.25));         // الإزار اليمني
const edgeCol = memo(col => dk(col, 0.3));
const edgeSoft = memo(col => dk(col, 0.25));
const lt55 = memo(col => lt(col, 0.55));
const lt45 = memo(col => lt(col, 0.45));
const thobeCol = memo(col => lt(col, 0.62));                       // الثوب السعودي
const galabCol = memo(col => mixHex(col, '#e6d7bc', 0.55));        // الجلابية المصرية
const SHM_LITE = mixHex(WHT, SHM, 0.3);                             // الشماغ من بعيد: أبيض بحمرة

// ---------- أغطية الرأس (إحداثيات الرأس: المركز 0,0 والوجه نحو +x) ----------
// العمامة اليمنية بشريط نيلي وطرف خلفي. المبسّطة: اللفّة وطرفها رسمة واحدة ثم الشريط
function imama(c, col, big, lite) {
  const w = wrapCol(col), rx = big ? 4.8 : 4.2, ry = big ? 2.9 : 2.4, tx = big ? -6.2 : -5.4, ty = big ? 5 : 3;
  c.beginPath(); c.ellipse(0, -1.7, rx, ry, 0, 0, TAU);
  if (lite) triTo(c, -3.8, -0.8, tx, ty, -2.8, 0.6);
  c.fillStyle = w; c.fill();
  ell(c, 0, -0.9, big ? 4.8 : 4.3, 1, IND);
  if (lite) return;
  c.beginPath(); c.moveTo(-3, -2.7); c.lineTo(3, -2.3); c.moveTo(-2.6, -1.6); c.lineTo(3.2, -1.9);
  c.strokeStyle = wrapLine(col); c.lineWidth = 0.5; c.lineCap = 'round'; c.stroke();
  tri(c, [-3.8, -0.8], [tx, ty], [-2.8, 0.6], w);
  if (big) ell(c, 2.6, -2, 0.9, 0.9, GOLD);
}
// مربعات الشماغ الحمراء (داخل حدود الرأس، وثلاثة على الطرف المتدلي) تُحسب مرة واحدة
const SHM_SQ = [];
for (let x = -3.4; x <= 3.4; x += 1.5) for (let y = -4.2; y <= -1.2; y += 1.3) {
  if ((x / 4.3) ** 2 + ((y + 0.8) / 4) ** 2 < 0.92) SHM_SQ.push(x - 0.3, y - 0.3);
}
for (let k = 0; k < 3; k++) SHM_SQ.push(-4.6 + k * 0.9, 1 + k * 1.3);
// الشماغ الأحمر والأبيض بعقال أسود: القماش رسمة واحدة، والمربعات رسمة، والعقال رسمة
function shemagh(c, veil, lite) {
  c.beginPath();
  c.ellipse(0, -0.8, 4.4, 4.1, 0, Math.PI, 0); c.closePath();
  c.moveTo(-4.4, -0.8); c.lineTo(-5.6, 5.6); c.lineTo(-1.9, 5.1); c.lineTo(-2.1, 0); c.closePath();
  if (veil) { c.moveTo(0.6, 0.4); c.lineTo(3.7, 0); c.lineTo(3.5, 2.5); c.lineTo(0.6, 2.8); c.closePath(); }
  else { c.moveTo(3.4, -0.8); c.lineTo(4.3, 3.1); c.lineTo(2.6, 2.7); c.closePath(); }
  c.fillStyle = lite ? SHM_LITE : WHT; c.fill();
  if (!lite) {
    c.beginPath();
    for (let k = 0; k < SHM_SQ.length; k += 2) c.rect(SHM_SQ[k], SHM_SQ[k + 1], 0.6, 0.6);
    c.fillStyle = SHM; c.fill();
  }
  c.beginPath(); c.ellipse(0, -2.5, 4.05, 1.15, 0, 0, TAU);
  if (!lite) { c.moveTo(3.8, -3.3); c.ellipse(0, -3.3, 3.8, 1.05, 0, 0, TAU); }
  c.strokeStyle = AGAL; c.lineWidth = lite ? 1.1 : 0.8; c.stroke();
}
function turbanEg(c, lite) {
  ell(c, 0, -1.9, 4.2, 2.1, '#efe6d2');
  if (lite) return;
  c.beginPath(); c.moveTo(-3.2, -2.2); c.lineTo(3.3, -1.6); c.moveTo(-3, -1.3); c.lineTo(3.4, -2.4);
  c.strokeStyle = '#d6cbb3'; c.lineWidth = 0.5; c.lineCap = 'round'; c.stroke();
}
function fez(c, lite) {
  pg(c, [[-2.9, -2.4], [2.9, -2.4], [2.3, -7.2], [-2.3, -7.2]], '#a8322a'); ell(c, 0, -7.2, 2.3, 0.7, '#8e2a24');
  if (!lite) { limb(c, 0, -7.2, -3, -4.6, 0.6, '#1c1c1c'); ell(c, -3, -4.4, 0.6, 0.9, '#1c1c1c'); }
}
// تاج ملكة سبأ: الحلقة والأسنان الخمسة رسمة واحدة
function queenCrown(c, lite) {
  c.beginPath(); c.ellipse(0, -2.6, 3.9, 1.2, 0, 0, TAU);
  for (let k = 0; k < 5; k++) { const x = -3 + k * 1.5; c.moveTo(x - 0.6, -3.2); c.lineTo(x, -6.2 + (k === 2 ? -1 : 0)); c.lineTo(x + 0.6, -3.2); c.closePath(); }
  c.fillStyle = GOLD; c.fill();
  if (!lite) ell(c, 0, -3.4, 0.7, 0.7, '#b8322c');
}

// ---------- الأسلحة ----------
function jambiya(c, J, p, L, lite) {
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), hx = J.handF[0], hy = J.handF[1];
  c.beginPath(); c.moveTo(hx, hy);
  c.quadraticCurveTo(hx + dx * L * 0.6 - dy * 1.6, hy + dy * L * 0.6 + dx * 1.6, hx + dx * L, hy + dy * L);
  c.strokeStyle = STEEL2; c.lineWidth = 1.4; c.lineCap = 'round'; c.stroke();
  if (!lite) ell(c, hx - dx * 0.6, hy - dy * 0.6, 0.9, 0.9, HORN);
}
function wornJambiya(c, J, big) {                 // الجنبية في الحزام
  const a = J.pl, o = add(J.hip, rot(0.6, -1.3, a)), s = big ? 1.3 : 1;
  c.beginPath(); c.moveTo(o[0], o[1] - 1.4 * s); c.quadraticCurveTo(o[0] + 0.4 * s, o[1] + 1.8 * s, o[0] + 2.2 * s, o[1] + 1.4 * s);
  c.strokeStyle = GOLD; c.lineWidth = 1.6 * s; c.lineCap = 'round'; c.stroke();
  ell(c, o[0], o[1] - 1.8 * s, 0.8 * s, 0.8 * s, HORN);
}
function censer(c, J, lite) {                     // مبخرة اللبان
  const h = J.handF;
  limb(c, h[0], h[1], h[0] + 0.4, h[1] + 3.2, 0.4, '#8a7a5a'); ell(c, h[0] + 0.4, h[1] + 4, 1.6, 1, '#b8913a');
  c.beginPath(); c.arc(h[0] + 0.4, h[1] + 3.4, 1.2, Math.PI, 0); c.fillStyle = '#a07a2e'; c.fill();
  if (lite) return;
  for (let k = 0; k < 3; k++) {
    c.save(); c.globalAlpha *= 0.4 - k * 0.1; ell(c, h[0] + 0.6 + k * 0.8, h[1] + 1.6 - k * 2.2, 1.1 + k * 0.5, 1.1 + k * 0.5, '#d9d6cf'); c.restore();
  }
}
function sling(c, J, p, lite) {                   // مقلاع: حبلان وحجر (يختفي الحجر لحظة الرمي)
  const dx = Math.cos(p.wa), dy = Math.sin(p.wa), hx = J.handF[0], hy = J.handF[1];
  const px = hx + dx * 3.4 - dy * 1.4, py = hy + dy * 3.4 + dx * 1.4;
  if (!lite) {
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(px, py); c.moveTo(hx, hy); c.lineTo(px - dy * 0.8, py + dx * 0.8);
    c.strokeStyle = '#8a6a44'; c.lineWidth = 0.4; c.lineCap = 'round'; c.stroke();
  }
  if (!p.thrown) dot(c, px, py, 1, '#8a7f72');
}
// وهج قِدر النفّاط: تدرج واحد لكل لوحة رسم يُرسم بالإزاحة (لا تدرج جديد في كل إطار)
const glows = new WeakMap();
function potGlow(c) {
  let g = glows.get(c);
  if (!g) {
    g = c.createRadialGradient(0, 0, 0, 0, 0, 6);
    g.addColorStop(0, 'rgba(255,170,60,0.55)'); g.addColorStop(1, 'rgba(255,170,60,0)');
    glows.set(c, g);
  }
  return g;
}
function firePot(c, J, p, lite) {
  if (p.thrown) return;
  const px = J.handF[0] + Math.cos(p.wa) * 1.4, py = J.handF[1] + Math.sin(p.wa) * 1.4;
  if (!lite) { c.save(); c.translate(px, py - 3); c.fillStyle = potGlow(c); c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill(); c.restore(); }
  ell(c, px, py, 1.9, 2.2, '#a8643a');
  if (!lite) rrect(c, px - 0.8, py - 3, 1.6, 1.4, 0.3, '#8e5230');
  tri(c, [px - 1.2, py - 3], [px, py - 6.6], [px + 1.2, py - 3], '#f0902a');
  if (!lite) tri(c, [px - 0.6, py - 3], [px, py - 5], [px + 0.6, py - 3], '#ffd45a');
}
// الصقر على قفاز الساعد: عند اليد عادةً، وأقرب إلى المرفق حين يمسك القوس
function falconArm(c, J, p, withFalcon, lite) {
  const e = J.elbowF, h = J.handF;
  limb(c, e[0], e[1], h[0], h[1], 2.6, '#7a5a36');
  if (!withFalcon) return;
  const at = p.pull === undefined ? h : lp(e, h, 0.4);
  c.save(); c.translate(at[0], at[1] - 2.4);
  ell(c, 0, 0, 1.7, 2.5, '#7a5a3e');
  if (!lite) ell(c, 0.3, 0.6, 1, 1.4, '#c9b38e');
  circ(c, [0.7, -2.6], 1.3, '#5a3e28');
  tri(c, [1.8, -2.8], [2.9, -2.4], [1.8, -2.1], '#e0b24a');
  if (!lite) tri(c, [-0.8, 2], [-2.2, 4.6], [0.4, 2.4], '#5a3e28');
  c.restore();
}

// ---------- اليمن «أبناء سبأ» (نمط الحشد) ----------
function yemen(lite) {
  return {
    common: { sx: 0.98, sy: 1.02, lw: 2.9, headR: 3.5, wlen: 4.4, legFrom: lite ? 0.5 : 0,
      head: (c, p, col) => imama(c, col, false, lite),
      robe(c, J, p, col) {
        robe(c, J, 0.5, izarCol(col), lite ? null : edgeCol(col), 'waist', 1.2);
        if (!lite) stripes(c, [0.55, 0.8], [IND, GOLD], 0.8);
      },
      over: lite ? undefined : (c, J) => { belt(c, J, '#7a5a36', 1.6); wornJambiya(c, J); },
      weapon: (c, J, p) => jambiya(c, J, p, 4.4, lite) },
    boss: { sx: 1.06, sy: 1.04, lw: 3.2, headR: 3.6, wlen: 5.2, legFrom: lite ? 0.62 : 0,
      ground: auraRing,
      head: (c, p, col) => imama(c, col, true, lite),
      back(c, J) { pg(c, [add(J.chest, rot(-2.2, 0, J.a2)), add(J.chest, rot(1.6, 0, J.a2)), add(J.mid, rot(-1, 1.6, J.pl)), add(J.mid, rot(-4.6, 2.4, J.pl))], IND); },
      robe(c, J, p, col) {
        robe(c, J, 0.62, izarCol(col), lite ? null : edgeCol(col), 'waist', 1.4);
        if (!lite) stripes(c, [0.5, 0.72, 0.9], [IND, GOLD, IND], 0.8);
      },
      over: lite ? undefined : (c, J) => { belt(c, J, GOLD, 2.2); wornJambiya(c, J, true); },
      weapon: (c, J, p) => jambiya(c, J, p, 5.2, lite) },
    medic: { sx: 0.98, sy: 1.02, lw: 2.8, headR: 3.5, wlen: 1.6, legFrom: lite ? 0.86 : 0,
      head: (c, p, col) => imama(c, col, false, lite),
      robe(c, J, p, col) { robe(c, J, 0.86, lt55(col), lite ? null : edgeCol(col), 'chest', 1.4); },
      over: lite ? undefined : (c, J) => {
        const A = add(J.chest, rot(1.8, 0.4, J.a2)), B = add(J.hip, rot(-2.2, 0.4, J.pl));
        limb(c, A[0], A[1], B[0], B[1], 0.8, '#6a4a30'); rrect(c, B[0] - 1.6, B[1] - 0.6, 3, 2.6, 0.6, '#8a6a44');
      },
      weapon: (c, J) => censer(c, J, lite) },
    champion: { sx: 1.0, sy: 1.08, lw: 2.9, headR: 3.5, wlen: 6, legFrom: lite ? 0.96 : 0,
      ground: auraHealRings,
      head: (c) => queenCrown(c, lite),
      back(c, J) {                               // عباءة طويلة نيلية بحافة ذهبية
        const P = lp(J.legB.k, J.legB.f, 0.9);
        pg(c, [add(J.chest, rot(-2.2, -0.4, J.a2)), add(J.chest, rot(1, 0, J.a2)), P, [P[0] - 5, P[1]]], IND, lite ? null : GOLD, 0.8);
      },
      robe(c, J, p, col) {
        robe(c, J, 0.96, lt45(col), lite ? null : edgeCol(col), 'chest', 2.2);
        if (!lite) stripes(c, [0.93], [GOLD], 1.1);
      },
      over: lite ? undefined : (c, J) => belt(c, J, GOLD, 1.6),
      weapon(c, J, p) {
        const s = staff(c, J, p, 6, 6, 1.1, GOLD); dot(c, s.bx, s.by, 2, GOLD);
        if (!lite) dot(c, s.bx, s.by, 1.2, '#f2d46a');
      } }
  };
}

// ---------- السعودية «حراس القوافل» (نمط الرامي) ----------
const thobe = (c, J, col, len, lite) => robe(c, J, len || 0.9, thobeCol(col), lite ? null : edgeSoft(col), 'chest', 1.3);
const archerBow = bow(7.6, 1.4, 1), falconerBow = bow(9, 1.6, 3);
function saudi(lite) {
  const falconer = (withFalcon) => ({ sx: 1.02, sy: 1.06, lw: 3, headR: 3.6, wlen: 2, legFrom: lite ? 0.92 : 0,
    ground: heroRing,
    head: (c) => shemagh(c, false, lite),
    back(c, J) {                                 // البشت
      const hb = lp(J.legB.k, J.legB.f, 0.75);
      pg(c, [add(J.chest, rot(-2.6, -0.6, J.a2)), add(J.chest, rot(1.4, -0.4, J.a2)), [hb[0] + 1, hb[1]], [hb[0] - 4.4, hb[1]]], '#5a3e28', lite ? null : GOLD, 0.9);
    },
    robe: (c, J, p, col) => thobe(c, J, col, 0.92, lite),
    over: lite ? undefined : (c, J) => {
      const A = add(J.chest, rot(1.9, 0.2, J.a2)), B = add(J.hip, rot(2.6, -1, J.pl));
      limb(c, A[0], A[1], B[0], B[1], 1.1, GOLD); belt(c, J, '#7a5a36', 1.1);
    },
    // قواعد بطل الرماة كما هي (ثلاثة سهام في الرمية): القوس في يده أثناء الرمي فقط
    weapon(c, J, p) { if (p.pull !== undefined) falconerBow(c, J, p); },
    front: (c, J, p) => falconArm(c, J, p, withFalcon, lite) });
  return {
    common: { sx: 0.97, sy: 1.03, lw: 2.8, headR: 3.5, wlen: 1.5, legFrom: lite ? 0.9 : 0,
      head: (c) => shemagh(c, false, lite),
      robe: (c, J, p, col) => thobe(c, J, col, 0, lite),
      over: lite ? undefined : (c, J) => belt(c, J, '#7a5a36', 1.2),
      weapon: (c, J, p) => sling(c, J, p, lite) },
    sniper: { sx: 0.97, sy: 1.04, lw: 2.8, headR: 3.5, wlen: 2, legFrom: lite ? 0.82 : 0,
      head: (c) => shemagh(c, false, lite),
      robe: (c, J, p, col) => thobe(c, J, col, 0.82, lite),
      back(c, J) {                               // جعبة السهام
        const A = add(J.chest, rot(-1.6, -1.2, J.a2)), B = add(J.mid, rot(-2.2, 2, J.pl));
        limb(c, A[0], A[1], B[0], B[1], 2, '#7a5a36');
        if (lite) return;
        c.beginPath();
        for (let k = 0; k < 3; k++) { c.moveTo(A[0] - 0.6 + k * 0.6, A[1]); c.lineTo(A[0] - 0.2 + k * 0.6, A[1] - 2); c.lineTo(A[0] + 0.2 + k * 0.6, A[1]); c.closePath(); }
        c.fillStyle = '#e8e2d4'; c.fill();
      },
      over: lite ? undefined : (c, J) => belt(c, J, '#7a5a36', 1.2),
      weapon: archerBow },
    firebomber: { sx: 0.99, sy: 1.02, lw: 2.9, headR: 3.5, wlen: 2, legFrom: lite ? 0.78 : 0,
      head: (c) => shemagh(c, true, lite),
      robe: (c, J, p, col) => thobe(c, J, col, 0.78, lite),
      over(c, J) {                               // مئزر جلدي
        const a = J.pl, A = add(J.hip, rot(-1.6, -1.4, a)), B = add(J.hip, rot(2.8, -1.4, a)), hf = legPt(J.legF, 0.62);
        pg(c, [A, B, [hf[0] + 1.2, hf[1]], [hf[0] - 2.4, hf[1] + 0.4]], '#6a4a30');
      },
      weapon: (c, J, p) => firePot(c, J, p, lite) },
    champion: falconer(true),
    champion_away: falconer(false)
  };
}

// ---------- مصر «فتوات الحارة» (نمط الصامد) ----------
const galab = (c, J, col, len, lite) => robe(c, J, len || 0.88, galabCol(col), lite ? null : edgeSoft(col), 'chest', 1.5);
function egypt(lite) {
  return {
    common: { sx: 1.04, sy: 1.0, lw: 3.1, headR: 3.6, wlen: 8, legFrom: lite ? 0.88 : 0,
      head: (c) => turbanEg(c, lite),
      robe: (c, J, p, col) => galab(c, J, col, 0, lite),
      over: lite ? undefined : (c, J) => {       // شال على الكتف
        const A = add(J.chest, rot(-2, 0.2, J.a2)), B = add(J.hip, rot(2.4, -1.4, J.pl));
        limb(c, A[0], A[1], B[0], B[1], 1.6, '#d9c9a8');
      },
      weapon(c, J, p) {                          // النبّوت
        const s = staff(c, J, p, 3.5, 8, 1.6, WOODD);
        if (!lite) dot(c, s.bx, s.by, 1, '#4a3422');
      } },
    armored: { sx: 1.1, sy: 0.98, lw: 3.4, headR: 3.7, wlen: 3, legFrom: lite ? 0.6 : 0,
      head: (c) => turbanEg(c, lite),
      robe: (c, J, p, col) => galab(c, J, col, 0.6, lite),
      over: lite ? undefined : (c, J) => belt(c, J, '#5a3a22', 1.8),
      front(c, J) {                              // درع خشبي مستدير
        const ox = J.handF[0] + 1.2, oy = J.handF[1];
        dot(c, ox, oy, 5.4, '#5a3a22'); dot(c, ox, oy, 4.6, '#8a5a36');
        if (!lite) {
          c.beginPath();
          for (let k = 0; k < 8; k++) {
            const ca = Math.cos(k * 0.785), sa = Math.sin(k * 0.785);
            c.moveTo(ox + ca * 1.6, oy + sa * 1.6); c.lineTo(ox + ca * 4.2, oy + sa * 4.2);
          }
          c.strokeStyle = '#6e4428'; c.lineWidth = 0.4; c.lineCap = 'round'; c.stroke();
        }
        dot(c, ox, oy, 1.3, GOLD);
      } },
    smasher: { sx: 1.12, sy: 1.0, lw: 3.5, headR: 3.7, wlen: 9.5, twoH: true, tipLen: 9.5, butt: 4.5, legFrom: lite ? 0.56 : 0,
      head(c) { c.beginPath(); c.arc(0, -0.6, 3.6, Math.PI, 0); c.fillStyle = '#efe6d2'; c.fill(); },
      robe: (c, J, p, col) => galab(c, J, col, 0.56, lite),
      over: lite ? undefined : (c, J) => belt(c, J, '#5a3a22', 2),
      weapon(c, J, p) {                          // النبّوت الكبير بحلقتين حديديتين
        const s = staff(c, J, p, 4.5, 9.5, 2.4, '#5e432b');
        if (lite) return;
        const nx = -s.dy * 1.3, ny = s.dx * 1.3;
        c.beginPath();
        for (const t of [0.85, 0.75]) {
          const rx = s.ax + (s.bx - s.ax) * t, ry = s.ay + (s.by - s.ay) * t;
          c.moveTo(rx - nx, ry - ny); c.lineTo(rx + nx, ry + ny);
        }
        c.strokeStyle = '#5a5f66'; c.lineWidth = 0.9; c.lineCap = 'round'; c.stroke();
      } },
    champion: { sx: 1.08, sy: 1.04, lw: 3.3, headR: 3.7, wlen: 6.5, legFrom: lite ? 0.9 : 0,
      ground: heroRing,
      head: (c) => fez(c, lite),
      robe: (c, J, p, col) => galab(c, J, col, 0.9, lite),
      over(c, J) {                               // صديري وأزرار ذهبية وشال
        const a = J.pl;
        pg(c, [add(J.chest, rot(-2, 0.4, J.a2)), add(J.chest, rot(2.2, 0.4, J.a2)), add(J.hip, rot(2.6, -1.6, a)), add(J.hip, rot(-2.2, -1.6, a))], '#2f3a2e');
        if (lite) return;
        const A = add(J.chest, rot(1.8, 1.2, J.a2)), B = add(J.hip, rot(2.2, -2.2, a));
        c.beginPath();
        for (let k = 0; k < 3; k++) { const P = lp(A, B, k / 2.2); c.moveTo(P[0] + 0.4, P[1]); c.arc(P[0], P[1], 0.4, 0, TAU); }
        c.fillStyle = GOLD; c.fill();
        const S = add(J.chest, rot(-2.2, 0, J.a2)), E = lp(J.legB.h, J.legB.k, 0.9);
        limb(c, S[0], S[1], E[0] - 1, E[1], 1.4, '#d9c9a8');
      },
      weapon(c, J, p) { const s = staff(c, J, p, 5, 6.5, 1.5, '#4a3422'); dot(c, s.bx, s.by, 1.5, GOLD); } }
  };
}

// التسجيل: لكل نوع نسختان (الكاملة والمبسّطة)
registerNation('yemen', both(yemen));
registerNation('saudi', both(saudi));
registerNation('egypt', both(egypt));
