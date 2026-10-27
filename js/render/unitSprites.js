// صور الشخصيات المعتمدة للعصابات الكلاسيكية الأربع (القسم 13.1): كل صورة مقطّعة بالأداة
// scripts/slice_units.py إلى جذع ورأس وعضد وساعد وفخذ وساق بقدم وسلاح، بأطوال هيكل drawBody نفسه.
// drawSpriteBody تحسب المفاصل كما يحسبها drawBody حرفياً ثم ترسم الأجزاء عليها بدل الخطوط، وتعيد J نفسها،
// فكل الوضعيات والآثار (الشرر، الأثر، الوميض، التفادي، السقوط) تعمل كما هي.
// الجسد يأخذ لون اللاعب: تُصبغ بكسلات لون العصابة مرة واحدة لكل (عصابة، لون).
// الأمم والشرطة بلا صور هنا، فتبقى مرسومة بالكود.
import { SPRITES } from './unitSpritesData.js';
import { BODIES } from './bodies.js';
import { rot, add, ik2, wdir, limb, flame } from './anim.js';

const UPP = SPRITES.upp;           // وحدة رسم لكل بكسل من الأطلس
const loaded = {};                 // العصابة ← صورة أطلسها بعد اكتمال التحميل
const painted = new Map();         // 'عصابة|لون' ← أطلس مصبوغ بلون اللاعب

// التحميل يبدأ فوراً؛ وحتى يكتمل تُرسم الوحدات بالكود
for (const [gang, g] of Object.entries(SPRITES.gangs)) {
  const img = new Image();
  img.onload = () => { loaded[gang] = img; };
  img.src = g.src;
}

// --- الصبغ بلون اللاعب: نغيّر درجة اللون ونحفظ نسبة التشبع والإضاءة إلى لون العصابة الأصلي ---
function hexHsv(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  const h = !d ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h, mx ? d / mx : 0, mx / 255];
}

// ترتيب (v, p, q, t) في (أحمر، أخضر، أزرق) لكل سدس من دائرة الألوان
const SECTORS = [[0, 3, 1], [2, 0, 1], [1, 0, 3], [1, 2, 0], [3, 1, 0], [0, 1, 2]];

function paint(gang, color) {
  const g = SPRITES.gangs[gang], img = loaded[gang], w = img.width, h = g.h;
  const work = document.createElement('canvas');
  work.width = w;
  work.height = h * 2;
  const c = work.getContext('2d', { willReadFrequently: true });
  c.drawImage(img, 0, 0);
  const all = c.getImageData(0, 0, w, h * 2), px = all.data, half = w * h * 4;

  const [hue, sat, val] = hexHsv(color);
  const ks = sat / g.sat, kv = val / g.val, f = hue % 1, order = SECTORS[Math.floor(hue) % 6];
  const vpqt = [0, 0, 0, 0];
  for (let i = 0; i < half; i += 4) {
    const m = px[i + half + 3] / 255;          // القناع في النصف السفلي من الأطلس
    if (!m) continue;
    const r = px[i], gg = px[i + 1], b = px[i + 2];
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    const s = Math.min(1, (mx ? (mx - mn) / mx : 0) * ks), v = Math.min(255, mx * kv);
    vpqt[0] = v; vpqt[1] = v * (1 - s); vpqt[2] = v * (1 - s * f); vpqt[3] = v * (1 - s * (1 - f));
    px[i] = r + (vpqt[order[0]] - r) * m;
    px[i + 1] = gg + (vpqt[order[1]] - gg) * m;
    px[i + 2] = b + (vpqt[order[2]] - b) * m;
  }
  work.height = h;                              // نصف الألوان وحده
  c.putImageData(all, 0, 0);
  // لوحة القراءة السريعة تبقى في ذاكرة المعالج؛ ننسخها إلى لوحة عادية يرسمها كرت الشاشة
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').drawImage(work, 0, 0);
  return out;
}

function sheet(gang, color) {
  const id = gang + '|' + color;
  let S = painted.get(id);
  if (!S) painted.set(id, S = paint(gang, color));
  return S;
}

// --- جزء من الأطلس: مفصله الأول عند (x,y) ومحوره باتجاه الزاوية ang (k مقياس السلاح) ---
function part(c, S, p, x, y, ang, k = 1) {
  c.save();
  c.translate(x, y);
  c.rotate(ang - p[6]);
  c.scale(UPP * k, UPP * k);
  c.drawImage(S, p[0], p[1], p[2], p[3], -p[4], -p[5], p[2], p[3]);
  c.restore();
}
const angleOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);

// رجل: فخذ وساق بقدم بزوايا leg في anim.js وأطوالها
function legPart(c, S, th, sn, hx, hy, t, fl) {
  const kx = hx + Math.sin(t) * 5.8, ky = hy + Math.cos(t) * 5.8;
  part(c, S, th, hx, hy, Math.atan2(ky - hy, kx - hx));
  part(c, S, sn, kx, ky, Math.atan2(Math.cos(t - fl), Math.sin(t - fl)));
}

// ذراع: عضد من الكتف إلى المرفق وساعد إلى اليد (نتيجة ik2)
function armPart(c, S, ua, la, s, k) {
  part(c, S, ua, s[0], s[1], angleOf(s, k.j));
  part(c, S, la, k.j[0], k.j[1], angleOf(k.j, k.e));
}

// القوس: المقبض في اليد الأمامية ويتحدب للأمام، والوتر يُشد إلى اليد الخلفية (مثل bow في bodies.js)
function bowArt(arrows, fire) {
  return (c, S, P, J, p) => {
    const w = P.bow, aim = p.pull === undefined ? p.wa * 0.4 : p.wa, pull = p.pull || 0;
    const d = wdir(aim), u = [d[1], -d[0]], h = J.handF, k = UPP * w[7];
    part(c, S, w, h[0], h[1], aim + w[6], w[7]);
    if (pull <= 0.05) return;
    const depth = w[4] * k, half = w[3] * 0.47 * k;
    const t1 = [h[0] - d[0] * depth + u[0] * half, h[1] - d[1] * depth + u[1] * half];
    const t2 = [h[0] - d[0] * depth - u[0] * half, h[1] - d[1] * depth - u[1] * half];
    const nock = J.handB;
    c.beginPath(); c.moveTo(t1[0], t1[1]); c.lineTo(nock[0], nock[1]); c.lineTo(t2[0], t2[1]);
    c.strokeStyle = '#d9d3c6'; c.lineWidth = 0.6; c.stroke();
    if (pull > 0.2) for (let i = 0; i < arrows; i++) {
      const o = (i - (arrows - 1) / 2) * 0.9;
      const tip = [h[0] + d[0] * 3.8 + u[0] * o, h[1] + d[1] * 3.8 + u[1] * o];
      limb(c, nock[0] + u[0] * o * 0.4, nock[1] + u[1] * o * 0.4, tip[0], tip[1], 0.8, '#d9d3c6');
      if (fire) flame(c, tip[0], tip[1] + 0.6, 0.55);     // سهم مشتعل كما في صورة رامي النار
    }
  };
}

// سلاح في اليد الأمامية على زاوية الوضعية
const inHand = (name) => (c, S, P, J, p) => part(c, S, P[name], J.handF[0], J.handF[1], p.wa, P[name][7]);
// درع مستدير عند يد ما مائل مع الجذع (مكان الدرع في bodies.js)
const shieldAt = (c, S, w, x, y, J) => part(c, S, w, x, y, w[6] + J.a2 * 0.6, w[7]);

// لكل وحدة: ما في يدها الأمامية (held)، وما خلف الجذع (back)، وما أمامه (front)
const ART = {
  crow_common:   { held: inHand('dagger') },
  crow_spear:    { held: inHand('spear') },
  crow_hero:     { held: inHand('spear') },
  crow_dual: {
    held: inHand('blade'),
    back(c, S, P, J) {                        // السيف الثاني في اليد الخلفية (زاوية bodies.js)
      const hb = J.handB;
      part(c, S, P.blade2, hb[0], hb[1], angleOf(J.Sb, hb) - 0.9, P.blade2[7]);
    }
  },
  hammer_common: { held: inHand('hammer') },
  hammer_breaker: { held: inHand('hammer') },
  hammer_shield: {
    held() {},
    front(c, S, P, J) { shieldAt(c, S, P.shield, J.handF[0] + 1.2, J.handF[1], J); }
  },
  hammer_hero: {                              // الدرع على اليد الخلفية: خلفه، وأمامه عند الصدّ
    held: inHand('hammer'),
    back(c, S, P, J, p) { if (!p.blocking) shieldAt(c, S, P.shield, J.handB[0] + 0.8, J.handB[1] - 3.5, J); },
    front(c, S, P, J, p) { if (p.blocking) shieldAt(c, S, P.shield, J.handB[0] + 0.8, J.handB[1] - 3.5, J); }
  },
  viper_common:  { held: inHand('dagger') },
  viper_sniper:  { held: bowArt(1) },
  viper_firebomber: { held: bowArt(1, true), shoots: true },
  viper_hero: {
    held: bowArt(3),
    back(c, S, P, J, p) {                     // الجعبة على الظهر بين الصدر ومنتصف العمود (مكانها في bodies.js)
      const q1 = add(J.chest, rot(-1.8, 0.6, J.a2)), q2 = add(J.mid, rot(-3.4, 1.2, p.pl));
      part(c, S, P.quiver, (q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2, angleOf(q2, q1), P.quiver[7]);
    }
  },
  scorp_common:  { held: inHand('club') },
  scorp_boss:    { held: inHand('club') },
  scorp_medic: {                              // حقيبة الإسعاف معلّقة من مقبضها في اليد
    held(c, S, P, J) { part(c, S, P.kit, J.handF[0] + 0.4, J.handF[1] - 0.3, Math.PI / 2, P.kit[7]); }
  },
  scorp_hero: {                               // العصا باليدين، وحقيبة الإسعاف على الظهر
    held: inHand('staff'), twoH: true,
    back(c, S, P, J, p) { const k = add(J.mid, rot(-4, 0.4, p.pl)); part(c, S, P.kit, k[0], k[1] - 1.6, Math.PI / 2, P.kit[7]); }
  }
};

// وصف الرسم لكل وحدة: وصف bodies.js (الحلقات والظل والسلاح ذو اليدين) مع الصور وأطوال أسلحتها.
// sx وsy متساويان: نسب الصورة نفسها بلا مط
const DESC = {};
for (const [gang, g] of Object.entries(SPRITES.gangs)) {
  for (const [key, P] of Object.entries(g.units)) {
    const art = ART[key], w = Object.values(P).find(v => v.length > 7 && v[8] > 0);
    const size = key === 'hammer_hero' ? 1.1 : 1;           // بطل المطارق أضخم الجميع (القسم 6.6)
    DESC[key] = Object.assign({}, BODIES[key], {
      sx: size, sy: size, gang, P, art, sprite: true,
      tipLen: w ? w[8] : BODIES[key].tipLen, butt: w && w[9] > 0 ? w[9] : BODIES[key].butt,
      twoH: art.twoH || BODIES[key].twoH, shoots: art.shoots
    });
  }
}

// وصف الوحدة بالصور إن كانت لها صور وتم تحميلها، وإلا null فتُرسم بالكود
export function spriteBody(key) {
  const d = DESC[key];
  return d && loaded[d.gang] ? d : null;
}

// رامي النار الكلاسيكي بصورته (قوس) يطلق سهماً مشتعلاً بدل الزجاجة: الشكل فقط، والقواعد كما هي
export function spriteShotLook(shot) {
  const a = shot.attacker;
  return a && !a.nation && a.hero === 'firebomber' && spriteBody('viper_firebomber') ? 'firearrow' : null;
}

// مثل drawBody في anim.js: نفس المفاصل ونفس J، والأجزاء من الصور. الساقان قبل الجذع لأن المئزر يغطي أعلاهما
export function drawSpriteBody(c, p, col, ud) {
  const S = sheet(ud.gang, col), P = ud.P, A = ud.art;
  const hp = [p.px, p.py];
  const M = add(hp, rot(0, -4.6, p.pl)), a2 = p.pl + p.cb, C = add(M, rot(0, -4.6, a2)), N = add(C, rot(0, -1.3, a2));
  const ha = a2 + p.ht, H = add(add(N, rot(0, -3.1, ha)), [p.hdx, p.hdy]);
  const Sb = add(C, rot(-0.9, 0.7, a2)), Sf = add(C, rot(0.9, 0.5, a2));
  const J = { hip: hp, mid: M, chest: C, neck: N, head: H, ha, Sf, Sb, a2, pl: p.pl, legB: null, legF: null };

  legPart(c, S, P.thD, P.snD, p.px - 1.2, p.py, p.tb, p.kb);
  legPart(c, S, P.th, P.sn, p.px + 1.2, p.py, p.tf, p.kf);
  const b = ik2(Sb, p.bh, 3.7, 3.7, true);
  J.handB = b.e;
  armPart(c, S, P.uaD, P.laD, Sb, b);
  if (A.back) A.back(c, S, P, J, p);
  part(c, S, P.torso, hp[0], hp[1], angleOf(hp, C));
  part(c, S, P.head, H[0], H[1], ha + P.head[6]);
  const f = ik2(Sf, p.fh, 3.7, 3.7, true);
  J.handF = f.e;
  J.elbowF = f.j;
  A.held(c, S, P, J, p);
  armPart(c, S, P.ua, P.la, Sf, f);
  if (A.front) A.front(c, S, P, J, p);
  return J;
}
