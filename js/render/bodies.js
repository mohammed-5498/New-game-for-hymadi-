/* الوحدات الست عشرة ووحدتا الشرطة على نظام الوضعيات v2 (drawBody في anim.js).
   كل وحدة تحتفظ بشكلها من docs/units-art.js: غطاء الرأس والسلاح والإكسسوارات والنسب وسُمك الخطوط،
   لكنها تُرسم كإضافات فوق الهيكل الجديد كما في أمثلة U2 في docs/combat-reference.html:
   head (يدور مع ميل الرأس)، weapon من اليد الأمامية بزاوية p.wa، back خلف الجسد، chest، front أمامه.
   الوحدات الأربع الأولى في المرجع (crow_common, hammer_common, hammer_shield, hammer_breaker) منقولة كما هي.

   إضافات اللعبة على صيغة U2:
   - ground(c,col,t): زخارف عند القدمين (حلقة البطل، الهالات).
   - tipLen / butt: طول رأس السلاح ومؤخرته للأسلحة ذات اليدين الأطول من المطرقة.
   - shadowW: عرض الظل.
   - حقول مؤقتة يضعها poseOf في الوضعية: pull (شد القوس)، thrown (أُطلق الحجر)، blocking (يصدّ). */
import { TAU, WOOD, STEEL, DARKW, Pf, dk, lt, limb, ell, rrect, tri, rot, add, wdir } from './anim.js';

// ---------- أغطية الرأس (إحداثيات الرأس: المركز عند 0,0) ----------
function hood(c, col) {                       // قلنسوة الغربان كما في U2 (v3)
  c.beginPath(); c.moveTo(-4, 1); c.quadraticCurveTo(-0.5, -6.4, 3.7, 0.1); c.lineTo(2.5, -0.8);
  c.quadraticCurveTo(-0.4, -3.9, -3, 1.1); c.closePath(); Pf(c, dk(col, 0.45));
}
function helm(c, col) {                       // خوذة المطارق كما في U2 (v3)
  c.beginPath(); c.arc(0, -0.3, 3.9, Math.PI, 0); Pf(c, dk(col, 0.5)); rrect(c, -3.9, -0.9, 8, 1.4, 0.3, dk(col, 0.5));
}
function mask(c, col) { rrect(c, -3.2, -0.8, 6.4, 1.8, 0.4, dk(col, 0.55)); }
function band(c, col) { rrect(c, -3.3, -1.8, 6.6, 1.8, 0.5, dk(col, 0.5)); limb(c, -3.1, -1, -5.5, 1.4, 0.9, dk(col, 0.5)); }
function crown(c, dy = 0) {                   // علامة البطل فوق الرأس
  tri(c, [-2.7, -3.7 + dy], [0.1, -7.2 + dy], [2.9, -3.7 + dy], '#f0c04a');
  rrect(c, -2.9, -3.9 + dy, 5.8, 1.1, 0.3, '#f0c04a');
}
function cap(c, col) {                        // قبعة الشرطة بحافة وشارة
  rrect(c, -3.3, -3.6, 6.6, 2.6, 0.8, dk(col, 0.35));
  rrect(c, -3.4, -1.4, 7.6, 1.2, 0.3, dk(col, 0.55));
  rrect(c, -1.5, -3.3, 2.2, 1.4, 0.3, '#e8d47a');
}

// ---------- زخارف عند القدمين ----------
function heroRing(c) {
  c.beginPath(); c.ellipse(0, 0.6, 6.4, 2.6, 0, 0, TAU);
  c.strokeStyle = 'rgba(240,192,74,0.8)'; c.lineWidth = 0.9; c.stroke();
}
function dashedRing(c, rx, ry, color) {
  c.beginPath(); c.ellipse(0, 0.5, rx, ry, 0, 0, TAU);
  c.strokeStyle = color; c.lineWidth = 1; c.setLineDash([3, 2.4]); c.stroke(); c.setLineDash([]);
}

// ---------- إكسسوارات الجسد ----------
const pads = (w, lw) => (c, J, p, col) => {   // درع الكتف على عرض الصدر
  const l = add(J.chest, rot(-w, 0.8, J.a2)), r = add(J.chest, rot(w, 0.8, J.a2));
  limb(c, l[0], l[1], r[0], r[1], lw, dk(col, 0.2));
};
function cloak(c, J, p, col, big) {           // عباءة الغربان
  const fl = Math.sin((p.py + p.px) * 2) * 1.2;
  tri(c, add(J.chest, [-0.8, 0.6]), add(J.hip, [(big ? -7.4 : -6.2) + fl, (big ? 2.6 : 2) + (p.air || 0) * -3]),
      add(J.hip, [big ? -0.4 : -0.6, big ? 1.2 : 0.4]), dk(col, big ? 0.22 : 0.25));
}
function cape(c, J, p, col) {                 // عباءة الزعيم المزدوجة
  const fl = p.px * 0.4 + (p.air || 0);
  const a = add(J.chest, rot(-2.2, -0.8, J.a2)), b = add(J.chest, rot(1.6, -0.8, J.a2));
  tri(c, a, add(J.hip, [-5.4 - fl, 2.4]), b, dk(col, 0.28));
  tri(c, b, add(J.hip, [4.6 - fl, 2.4]), a, dk(col, 0.12));
}
function medkit(c, x, y, s = 1) {             // علبة إسعاف بصليب أحمر
  rrect(c, x - 1.6 * s, y - 1.4 * s, 3.2 * s, 2.8 * s, 0.6, '#efe6d2');
  rrect(c, x - 0.4 * s, y - 1.2 * s, 0.8 * s, 2.4 * s, 0, '#c0392b');
  rrect(c, x - 1.2 * s, y - 0.35 * s, 2.4 * s, 0.7 * s, 0, '#c0392b');
}
function quiver(c, J, p, col, arrows, w) {    // جعبة على الظهر وسهام بارزة
  const q1 = add(J.chest, rot(-1.8, 0.6, J.a2)), q2 = add(J.mid, rot(-3.4, 1.2, p.pl));
  limb(c, q1[0], q1[1], q2[0], q2[1], w, dk(col, 0.45));
  const d = [q1[0] - q2[0], q1[1] - q2[1]], L = Math.hypot(d[0], d[1]) || 1, u = [d[0] / L, d[1] / L];
  for (let k = 0; k < arrows; k++) {
    const o = (k - (arrows - 1) / 2) * 0.7, s = [q1[0] + u[1] * o, q1[1] - u[0] * o];
    limb(c, s[0], s[1], s[0] + u[0] * 2.8, s[1] + u[1] * 2.8, 0.6, '#d9d3c6');
  }
}
// الدرع على اليد الخلفية: خلف الجسد عادةً، وأمامه عند الصدّ فيغطي الوجه
function sideShield(w, h, boss) {
  const draw = (c, J, p, col) => {
    const hb = J.handB;
    c.save(); c.translate(hb[0] + 0.8, hb[1] - 3.5); c.rotate(J.a2 * 0.6);
    rrect(c, -w / 2, -h / 2, w, h, 1.6, lt(col, 0.28));
    rrect(c, -w / 2 + 1, -h / 2 + 1.4, w - 2, h - 2.8, 0.9, dk(col, 0.12));
    if (boss) ell(c, 0.2, 0, 1.5, 1.5, boss);
    c.restore();
  };
  return {
    back(c, J, p, col) { if (!p.blocking) draw(c, J, p, col); },
    front(c, J, p, col) { if (p.blocking) draw(c, J, p, col); }
  };
}

// ---------- الأسلحة ----------
const blade = (len, w, color) => (c, J, p) => {
  const d = wdir(p.wa), h = J.handF;
  limb(c, h[0], h[1], h[0] + d[0] * len, h[1] + d[1] * len, w, color);
};
function hammerHead(c, e, wa, w, h, face, edge) {
  c.save(); c.translate(e[0], e[1]); c.rotate(wa);
  rrect(c, -w / 2, -h / 2, w, h, 0.9, face);
  if (edge) rrect(c, -w / 2, -h / 2, w * 0.36, h, 0.7, edge);
  c.restore();
}
// قوس: المقبض في اليد الأمامية، والطرفان يرجعان نحو الرامي عند الشد، والوتر إلى اليد الخلفية
function bow(half, lw, arrows) {
  return (c, J, p) => {
    // خارج الرمي يُحمل القوس شبه قائم (زاوية الحراسة للسلاح مخففة)، وعمقه كما في units-art.js
    const aim = p.pull === undefined ? p.wa * 0.4 : p.wa;
    const d = wdir(aim), u = [d[1], -d[0]], h = J.handF, pull = p.pull || 0, b = 1 + pull * 0.55;
    const back = 2.3 * b, t1 = [h[0] - d[0] * back + u[0] * half, h[1] - d[1] * back + u[1] * half];
    const t2 = [h[0] - d[0] * back - u[0] * half, h[1] - d[1] * back - u[1] * half];
    c.beginPath(); c.moveTo(t1[0], t1[1]);
    c.quadraticCurveTo(h[0] + d[0] * 2.3 * b, h[1] + d[1] * 2.3 * b, t2[0], t2[1]);
    c.strokeStyle = WOOD; c.lineWidth = lw; c.lineCap = 'round'; c.stroke();
    const nock = pull > 0.05 ? J.handB : [(t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2];
    c.beginPath(); c.moveTo(t1[0], t1[1]); c.lineTo(nock[0], nock[1]); c.lineTo(t2[0], t2[1]);
    c.strokeStyle = '#d9d3c6'; c.lineWidth = 0.6; c.stroke();
    if (pull > 0.2) for (let k = 0; k < arrows; k++) {
      const o = (k - (arrows - 1) / 2) * 0.9;
      limb(c, nock[0] + u[0] * o * 0.4, nock[1] + u[1] * o * 0.4,
           h[0] + d[0] * 3.8 + u[0] * o, h[1] + d[1] * 3.8 + u[1] * o, 0.8, '#d9d3c6');
    }
  };
}
function bottle(c, x, y) {
  rrect(c, x - 1.1, y - 2.4, 2.2, 4, 0.8, '#5a8a6a');
  tri(c, [x - 1.1, y - 2.4], [x, y - 5.2], [x + 1.1, y - 2.4], '#e8893a');
  tri(c, [x - 0.5, y - 2.6], [x, y - 4], [x + 0.5, y - 2.6], '#f2c14e');
}

export const BODIES = {
  // =============== الغربان: نحيفة وطويلة، قلنسوة وعباءة ===============
  crow_common: { sx: 0.92, sy: 1.06, lw: 2.8, headR: 3.5, wlen: 4.2,
    head(c, p, col) { hood(c, col); },
    back(c, J, p, col) { cloak(c, J, p, col); },
    weapon: blade(4.2, 1.8, STEEL) },

  crow_spear: { sx: 0.94, sy: 1.08, lw: 2.8, headR: 3.5, wlen: 12, twoH: true, tipLen: 16.6, butt: 7,
    head(c, p, col) { hood(c, col); },
    weapon(c, J, p) {                         // رمح طويل باليدين
      const d = wdir(p.wa), h = J.handF, s = [h[0] - d[0] * 7, h[1] - d[1] * 7], e = [h[0] + d[0] * 12, h[1] + d[1] * 12];
      limb(c, s[0], s[1], e[0], e[1], 1.5, WOOD);
      c.save(); c.translate(e[0], e[1]); c.rotate(p.wa);
      tri(c, [-1.8, 2.2], [4.6, 0], [-1.8, -2.2], STEEL); limb(c, -2.6, 0, -1.4, 0, 1.8, '#cdd2d8');
      c.restore();
    } },

  crow_dual: { sx: 0.9, sy: 1.06, lw: 2.8, headR: 3.5, wlen: 5.4,
    head(c, p, col) { hood(c, col); },
    back(c, J, p, col) {                      // العصا الثانية في اليد الخلفية
      const hb = J.handB, sb = J.Sb, a = Math.atan2(hb[1] - sb[1], hb[0] - sb[0]) - 0.9, d = wdir(a);
      limb(c, hb[0], hb[1], hb[0] + d[0] * 5.2, hb[1] + d[1] * 5.2, 2, '#a8845a');
      limb(c, hb[0] + d[0] * 4.1, hb[1] + d[1] * 4.1, hb[0] + d[0] * 5.2, hb[1] + d[1] * 5.2, 2.2, '#8e949c');
    },
    weapon(c, J, p) {
      const d = wdir(p.wa), h = J.handF;
      limb(c, h[0], h[1], h[0] + d[0] * 5.4, h[1] + d[1] * 5.4, 2.1, '#c8a06a');
      limb(c, h[0] + d[0] * 4.2, h[1] + d[1] * 4.2, h[0] + d[0] * 5.4, h[1] + d[1] * 5.4, 2.3, STEEL);
    } },

  crow_hero: { sx: 1, sy: 1.14, lw: 3.0, headR: 3.6, wlen: 12.5, twoH: true, tipLen: 16.3, butt: 5,
    ground(c) { heroRing(c); },
    head(c, p, col) { hood(c, col); crown(c, -1.3); },
    back(c, J, p, col) { cloak(c, J, p, col, true); },
    weapon(c, J, p) {                         // عصا طويلة بنصل
      const d = wdir(p.wa), h = J.handF, s = [h[0] - d[0] * 5, h[1] - d[1] * 5], e = [h[0] + d[0] * 12.5, h[1] + d[1] * 12.5];
      limb(c, s[0], s[1], e[0], e[1], 1.4, WOOD);
      c.save(); c.translate(e[0], e[1]); c.rotate(p.wa); tri(c, [-1.3, 1.4], [3.8, 0], [-1.3, -1.4], STEEL); c.restore();
    } },

  // =============== المطارق: عريضة وقصيرة، خوذة ودرع كتف ===============
  hammer_common: { sx: 1.14, sy: 0.95, lw: 3.3, headR: 3.6, wlen: 5.2,
    head(c, p, col) { helm(c, col); },
    chest: pads(4.4, 2.4),
    weapon(c, J, p) {
      const d = wdir(p.wa), e = [J.handF[0] + d[0] * 5.2, J.handF[1] + d[1] * 5.2];
      limb(c, J.handF[0], J.handF[1], e[0], e[1], 1.9, WOOD);
      c.save(); c.translate(e[0], e[1]); c.rotate(p.wa); rrect(c, -1.2, -2.4, 3.6, 4.8, 0.8, STEEL); c.restore();
    } },

  hammer_shield: { sx: 1.18, sy: 0.94, lw: 3.5, headR: 3.7, wlen: 3,
    head(c, p, col) { c.beginPath(); c.arc(0, -0.3, 4, Math.PI, 0); Pf(c, dk(col, 0.5)); rrect(c, -4, -0.9, 8, 1.6, 0.3, '#5d6169'); },
    chest: pads(4.8, 2.8),
    front(c, J, p, col) {
      c.save(); c.translate(J.handF[0] + 1.2, J.handF[1]); c.rotate(J.a2 * 0.6);
      rrect(c, -2.8, -7.6, 5.6, 15.2, 1.8, lt(col, 0.25)); rrect(c, -1.6, -6, 3.2, 12, 1, dk(col, 0.15));
      ell(c, 0.2, 0, 1.4, 1.4, lt(col, 0.55)); c.restore();
    } },

  hammer_breaker: { sx: 1.18, sy: 0.95, lw: 3.5, headR: 3.7, wlen: 12, twoH: true,
    head(c, p, col) { rrect(c, -3.9, -2.3, 7.8, 2.3, 0.5, dk(col, 0.5)); },
    chest: pads(4.8, 2.8),
    weapon(c, J, p) {
      const d = wdir(p.wa), s = [J.handF[0] - d[0] * 3.4, J.handF[1] - d[1] * 3.4], e = [J.handF[0] + d[0] * 8.6, J.handF[1] + d[1] * 8.6];
      limb(c, s[0], s[1], e[0], e[1], 1.8, WOOD);
      c.save(); c.translate(e[0], e[1]); c.rotate(p.wa); rrect(c, -2.4, -3.4, 5, 6.8, 1.1, DARKW); rrect(c, -2.4, -3.4, 1.8, 6.8, 0.9, '#9aa0a8'); c.restore();
    } },

  hammer_hero: { sx: 1.42, sy: 1.12, lw: 3.5, headR: 3.7, wlen: 4.6, shadowW: 5,
    ground(c) { heroRing(c); },
    head(c, p, col) { c.scale(1.12, 1.12);
      c.beginPath(); c.arc(0, -0.3, 3.6, Math.PI, 0); Pf(c, dk(col, 0.5)); rrect(c, -3.6, -0.7, 7.2, 1.3, 0.3, dk(col, 0.5));
      tri(c, [-0.9, -3.4], [0.1, -6.8], [1.1, -3.4], '#f0c04a'); crown(c, -0.8);
    },
    chest: pads(5.2, 3),
    ...sideShield(6.4, 17.6, '#f0c04a'),
    weapon(c, J, p) {
      const d = wdir(p.wa), e = [J.handF[0] + d[0] * 4.6, J.handF[1] + d[1] * 4.6];
      limb(c, J.handF[0], J.handF[1], e[0], e[1], 1.7, WOOD);
      hammerHead(c, e, p.wa, 4.2, 5.6, DARKW, STEEL);
    } },

  // =============== الأفاعي: منحنية ونحيفة، قناع وجعبة ===============
  viper_common: { sx: 0.93, sy: 0.96, lw: 2.8, headR: 3.5, wlen: 1.5,
    head(c, p, col) { c.scale(1.207, 1.207); mask(c, col); },
    weapon(c, J, p) { if (!p.thrown) ell(c, J.handF[0] + 0.6, J.handF[1] - 0.3, 1.5, 1.4, '#9a948c'); } },

  viper_sniper: { sx: 0.9, sy: 1, lw: 2.8, headR: 3.5, wlen: 2, bow: true,
    head(c, p, col) { c.scale(1.207, 1.207); mask(c, col); },
    back(c, J, p, col) { quiver(c, J, p, col, 3, 2.2); },
    weapon: bow(7.6, 1.4, 1) },

  viper_firebomber: { sx: 0.94, sy: 0.96, lw: 2.8, headR: 3.5, wlen: 2,
    head(c, p, col) { c.scale(1.207, 1.207); mask(c, col); },
    chest(c, J, p) {                          // زجاجتان على الحزام
      const a = add(J.mid, rot(-1.6, 1.4, p.pl)), b = add(J.mid, rot(0.6, 1.4, p.pl));
      rrect(c, a[0] - 1, a[1] - 1.7, 2, 3.4, 0.6, '#5a8a6a'); rrect(c, b[0] - 1, b[1] - 1.7, 2, 3.4, 0.6, '#5a8a6a');
    },
    weapon(c, J, p) { if (!p.thrown) bottle(c, J.handF[0], J.handF[1]); } },

  viper_hero: { sx: 1.06, sy: 1.12, lw: 3.0, headR: 3.6, wlen: 2, bow: true,
    ground(c) { heroRing(c); },
    head(c, p, col) { c.scale(1.161, 1.161); mask(c, col); crown(c); },
    back(c, J, p, col) { quiver(c, J, p, col, 4, 2.6); },
    weapon: bow(9, 1.6, 3) },

  // =============== العقارب: متوسطة، عصابة رأس وقبعة الزعيم ===============
  scorp_common: { sx: 1.03, sy: 0.99, lw: 2.9, headR: 3.5, wlen: 4.4,
    head(c, p, col) { c.scale(1.167, 1.167); band(c, col); },
    weapon: blade(4.4, 1.5, '#8e8880') },

  scorp_boss: { sx: 1.1, sy: 1.05, lw: 3.0, headR: 3.6, wlen: 3.4,
    ground(c, col, t) { const k = 1 + Math.sin(t * 2.4) * 0.05; dashedRing(c, 10.5 * k, 4.2 * k, 'rgba(240,182,74,0.9)'); },
    head(c, p, col) { c.scale(1.161, 1.161);
      ell(c, 0, -2.5, 5.6, 1.3, dk(col, 0.55)); rrect(c, -2.9, -6, 6, 3.8, 1.2, dk(col, 0.55)); rrect(c, -2.9, -3.5, 6, 1, 0.3, col);
    },
    back: cape,
    weapon: blade(3.4, 1.3, STEEL) },

  scorp_medic: { sx: 1.01, sy: 0.99, lw: 2.9, headR: 3.5, wlen: 1.6,
    head(c) { c.scale(1.167, 1.167); rrect(c, -3.3, -2.4, 6.6, 1.8, 0.4, '#efe6d2'); rrect(c, -0.6, -2.4, 1.1, 1.8, 0, '#c0392b'); },
    back(c, J, p) {
      const s1 = add(J.chest, rot(-1.5, 0.5, J.a2)), s2 = add(J.mid, rot(2.5, 1.5, p.pl)), k = add(J.mid, rot(-3.8, 0.4, p.pl));
      limb(c, s1[0], s1[1], s2[0], s2[1], 0.9, '#8a6a4a'); medkit(c, k[0], k[1]);
    },
    weapon(c, J) { medkit(c, J.handF[0] + 0.6, J.handF[1] - 0.6, 0.9); } },

  scorp_hero: { sx: 1.14, sy: 1.1, lw: 3.1, headR: 3.7, wlen: 3.8,
    ground(c, col, t) {
      const k = 1 + Math.sin(t * 2.4) * 0.06;
      dashedRing(c, 11.5 * k, 4.6 * k, 'rgba(240,182,74,0.9)'); dashedRing(c, 8.4 * k, 3.4 * k, 'rgba(127,212,138,0.8)');
    },
    head(c, p, col) { c.scale(1.156, 1.156);
      ell(c, 0, -2.7, 5.8, 1.4, dk(col, 0.55)); rrect(c, -3, -6.3, 6.2, 3.9, 1.2, dk(col, 0.55));
      rrect(c, -3, -3.7, 6.2, 1, 0.3, '#efe6d2'); rrect(c, -0.5, -3.7, 1, 1, 0, '#c0392b'); crown(c, -2.4);
    },
    back(c, J, p, col) { cape(c, J, p, col); const k = add(J.mid, rot(-4, 0.4, p.pl)); medkit(c, k[0], k[1]); },
    weapon: blade(3.8, 1.4, STEEL) },

  // =============== الشرطة (محايدة — لون ثابت) ===============
  police_common: { sx: 1.05, sy: 1, lw: 3.0, headR: 3.5, wlen: 4,
    head(c, p, col) { c.scale(1.167, 1.167); cap(c, col); },
    chest(c, J, p, col) {                     // حزام مائل على الصدر
      const a = add(J.chest, rot(-2.2, 1.2, J.a2)), b = add(J.mid, rot(2.4, 0.5, p.pl));
      limb(c, a[0], a[1], b[0], b[1], 1.2, dk(col, 0.3));
    },
    ...sideShield(4.4, 10.4),
    weapon: blade(4, 1.7, '#2b2825') },

  police_captain: { sx: 1.14, sy: 1.04, lw: 3.2, headR: 3.6, wlen: 4.4,
    ground(c) { dashedRing(c, 8.6, 3.4, 'rgba(120,170,230,0.75)'); },
    head(c, p, col) { c.scale(1.161, 1.161); cap(c, col); rrect(c, -3.4, -6.4, 6.8, 1, 0.3, '#e8d47a'); },
    chest(c, J, p, col) {                     // سترة وكتفيّة وشارة
      limb(c, J.mid[0], J.mid[1], J.chest[0], J.chest[1], 5.2, dk(col, 0.25));
      const l = add(J.chest, rot(-4, 0.2, J.a2)), r = add(J.chest, rot(4.2, 0.2, J.a2)), s = add(J.chest, rot(2.2, 1.8, J.a2));
      limb(c, l[0], l[1], r[0], r[1], 2.4, dk(col, 0.15)); rrect(c, s[0] - 0.8, s[1] - 0.8, 1.6, 1.6, 0.3, '#e8d47a');
    },
    ...sideShield(4.8, 12, '#e8d47a'),
    weapon(c, J, p) {
      const d = wdir(p.wa), h = J.handF, e = [h[0] + d[0] * 4.4, h[1] + d[1] * 4.4];
      limb(c, h[0], h[1], e[0], e[1], 1.8, '#2b2825');
      limb(c, h[0] + d[0] * 3.5, h[1] + d[1] * 3.5, e[0], e[1], 2, '#9aa0a8');
    } }
};

// طول السلاح من اليد إلى رأسه (لمكان الشرر والأثر) — tipOf في المرجع، مع tipLen للأسلحة الأطول
export function tipOf(ud, J, p) {
  const d = wdir(p.wa), L = ud.tipLen || (ud.twoH ? 8.6 : ud.wlen);
  return [J.handF[0] + d[0] * L, J.handF[1] + d[1] * L];
}
