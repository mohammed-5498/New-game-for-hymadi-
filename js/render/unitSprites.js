// صور الشخصيات المعتمدة (القسم 13.1): العصابات الكلاسيكية الأربع والأمم الـ15 والشرطة. كل صورة مقطّعة بالأداة
// scripts/slice_units.py إلى جذع ورأس وعضد وساعد وفخذ وساق بقدم و"إزار" (ما تحت الحوض: ثوب أو معطف) وسلاح،
// بأطوال هيكل drawBody نفسه. drawSpriteBody تحسب المفاصل كما يحسبها drawBody حرفياً ثم ترسم الأجزاء عليها
// بدل الخطوط، وتعيد J نفسها، فكل الوضعيات والآثار (الشرر، الأثر، الوميض، التفادي، السقوط) تعمل كما هي.
// الجسد يأخذ لون اللاعب: تُصبغ بكسلات لون العصابة (أو لون جسد الأمة) مرة واحدة لكل (أطلس، لون).
import { SPRITES } from './unitSpritesData.js';
import { BODIES } from './bodies.js';
import { rot, add, ik2, wdir, limb, flame } from './anim.js';

const UPP = SPRITES.upp;           // وحدة رسم لكل بكسل من الأطلس
const loaded = {};                 // الأطلس ← صورته بعد اكتمال التحميل
const waiting = {};                // الأطلس ← دوال تنتظر تحميله (صور المتجر)
const painted = new Map();         // 'أطلس|لون' ← أطلس مصبوغ بلون اللاعب

function load(gang) {
  if (waiting[gang]) return;
  waiting[gang] = [];
  const img = new Image();
  img.onload = () => {
    loaded[gang] = img;
    for (const fn of waiting[gang]) fn();
    waiting[gang].length = 0;
  };
  img.src = SPRITES.gangs[gang].src;
}
// الكلاسيكية والشرطة في كل مباراة فتُحمَّل فوراً، والأمم عند أول حاجة إليها؛ وحتى يكتمل التحميل تُرسم بالكود
for (const gang of ['crows', 'hammers', 'vipers', 'scorpions', 'police']) load(gang);

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

// المباراة فيها حتى 8 لاعبين (أمة ولون لكل منهم) والشرطة، والمتجر يرسم الأمم كلها: يبقى آخر 16 أطلساً مصبوغاً
const PAINTED_MAX = 16;
function sheet(gang, color) {
  const id = gang + '|' + color;
  let S = painted.get(id);
  if (!S) {
    if (painted.size >= PAINTED_MAX) painted.delete(painted.keys().next().value);
    painted.set(id, S = paint(gang, color));
  }
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

// رجل: فخذ وساق بقدم بزوايا leg في anim.js وأطوالها. تعيد نقاط الورك والركبة والقدم (J.legB وJ.legF)
function legPart(c, S, th, sn, hx, hy, t, fl) {
  const kx = hx + Math.sin(t) * 5.8, ky = hy + Math.cos(t) * 5.8;
  part(c, S, th, hx, hy, Math.atan2(ky - hy, kx - hx));
  part(c, S, sn, kx, ky, Math.atan2(Math.cos(t - fl), Math.sin(t - fl)));
  return { h: [hx, hy], k: [kx, ky], f: [kx + Math.sin(t - fl) * 6, ky + Math.cos(t - fl) * 6] };
}

// ذراع: عضد من الكتف إلى المرفق وساعد إلى اليد (نتيجة ik2)
function armPart(c, S, ua, la, s, k) {
  part(c, S, ua, s[0], s[1], angleOf(s, k.j));
  part(c, S, la, k.j[0], k.j[1], angleOf(k.j, k.e));
}

// نقطة على الساق: 0 الورك، 0.5 الركبة، 1 القدم (legPt في nationArt.js)
function legPt(L, t) {
  const A = t <= 0.5 ? L.h : L.k, B = t <= 0.5 ? L.k : L.f, u = t <= 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u];
}

// الإزار (ما تحت الحوض: ثوب، معطف، تنورة، حزام) معلّق من الحوض: أفقه مع ميل الحوض، ونزوله نحو منتصف
// الساقين عند طول حاشيته s[8] فيتمايل معهما (كالثوب في nationArt.js)، بحدود حتى لا يتشوه عند الركلة والسقوط
function skirtPart(c, S, s, J) {
  const L = s[8], B = legPt(J.legB, Math.min(1, L / 11.8)), F = legPt(J.legF, Math.min(1, L / 11.8));
  const ca = Math.cos(J.pl), sa = Math.sin(J.pl);
  const dx = (B[0] + F[0]) / 2 - J.hip[0], dy = (B[1] + F[1]) / 2 - J.hip[1];
  const d = Math.hypot(dx, dy) || 1, m = Math.min(1.1, Math.max(0.75, d / L));
  // ميل النزول عن عمود الحوض محدود بـ 0.9
  const tilt = Math.max(-0.9, Math.min(0.9, Math.atan2(dx * ca + dy * sa, dy * ca - dx * sa)));
  const yx = (-sa * Math.cos(tilt) + ca * Math.sin(tilt)) * m, yy = (ca * Math.cos(tilt) + sa * Math.sin(tilt)) * m;
  c.save();
  c.transform(ca * UPP, sa * UPP, yx * UPP, yy * UPP, J.hip[0], J.hip[1]);
  c.drawImage(S, s[0], s[1], s[2], s[3], -s[4], -s[5], s[2], s[3]);
  c.restore();
}

// القوس: المقبض في اليد الأمامية ويتحدب للأمام، والوتر يُشد إلى اليد الخلفية (مثل bow في bodies.js)
function bowArt(arrows, fire, name = 'bow') {
  return (c, S, P, J, p) => {
    const w = P[name], aim = p.pull === undefined ? p.wa * 0.4 : p.wa, pull = p.pull || 0;
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
// سلاح ثانٍ في اليد الخلفية (زاوية bodies.js)
const inBack = (name) => (c, S, P, J) => part(c, S, P[name], J.handB[0], J.handB[1], angleOf(J.Sb, J.handB) - 0.9, P[name][7]);
// درع مستدير عند يد ما مائل مع الجذع (مكان الدرع في bodies.js)
const shieldAt = (c, S, w, x, y, J) => part(c, S, w, x, y, w[6] + J.a2 * 0.6, w[7]);

// لكل وحدة كلاسيكية: ما في يدها الأمامية (held)، وما خلف الجذع (back)، وما أمامه (front)
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

// --- الأمم والشرطة: طريقة حمل كل قطعة من بيانات الأداة (uses)، فلا جدول يدوي لكل وحدة ---
// قطعة قائمة بلا دوران (قِدر، مشعل، فانوس معلّق، صقر) مقبضها عند النقطة (x, y)
const still = (c, S, w, x, y) => part(c, S, w, x, y, w[6], w[7]);
const USES = {
  hand: (n) => ({ held: inHand(n) }),
  pair: (n) => ({ back: inBack(n) }),
  shield: (n) => ({ front: (c, S, P, J) => shieldAt(c, S, P[n], J.handF[0] + 1.2, J.handF[1], J) }),
  side: (n) => ({                             // درع الشرطة على اليد الخلفية: خلفه، وأمامه عند الصدّ
    back(c, S, P, J, p) { if (!p.blocking) shieldAt(c, S, P[n], J.handB[0] + 0.8, J.handB[1] - 3.5, J); },
    front(c, S, P, J, p) { if (p.blocking) shieldAt(c, S, P[n], J.handB[0] + 0.8, J.handB[1] - 3.5, J); }
  }),
  hang: (n) => ({ held: (c, S, P, J) => still(c, S, P[n], J.handF[0], J.handF[1]) }),
  upright: (n) => ({ held: (c, S, P, J) => still(c, S, P[n], J.handF[0], J.handF[1] - 0.3) }),
  // على القبضة: أعلاها (المفاصل) باتجاه الساعد
  fist: (n) => ({ front: (c, S, P, J) => part(c, S, P[n], J.handF[0], J.handF[1], angleOf(J.elbowF, J.handF), P[n][7]) }),
  falcon: (n) => ({ front: (c, S, P, J) => still(c, S, P[n], J.handF[0], J.handF[1]) }),
  back: (n) => ({                             // جعبة على الظهر (مكان جعبة viper_hero)
    back(c, S, P, J, p) {
      const q1 = add(J.chest, rot(-1.8, 0.6, J.a2)), q2 = add(J.mid, rot(-3.4, 1.2, p.pl));
      part(c, S, P[n], (q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2, angleOf(q2, q1), P[n][7]);
    }
  }),
  belt: (n) => ({ mid: (c, S, P, J) => { const b = add(J.hip, rot(2.2, -0.6, J.pl)); still(c, S, P[n], b[0], b[1]); } })
};

function nationArt(key, P, A, away) {
  const hooks = { held: [], back: [], front: [], mid: [] };
  for (const [n, use] of Object.entries(A.uses)) {
    if (away && use === 'falcon') continue;   // الصقر في انقضاضه (unit.awayUntil)
    if (use === 'bow') { hooks.held.push(bowArt(A.arrows || 1, A.fire, n)); continue; }
    for (const [hook, fn] of Object.entries(USES[use](n))) hooks[hook].push(fn);
    if (use === 'hand' && A.pair) hooks.back.push(inBack(n));
  }
  if (key === 'saudi_champion') {             // الصقّار: القوس في يده أثناء الرمي فقط (قوس القوّاس من الأطلس نفسه)
    const bow = bowArt(3, false), Q = { bow: SPRITES.gangs.saudi.units.saudi_sniper.bow };
    hooks.held.push((c, S, P2, J, p) => { if (p.pull !== undefined) bow(c, S, Q, J, p); });
  }
  const all = (list) => list.length ? (c, S, P2, J, p) => { for (const fn of list) fn(c, S, P2, J, p); } : null;
  return { held: all(hooks.held) || (() => {}), back: all(hooks.back), front: all(hooks.front), mid: all(hooks.mid),
           twoH: !!A.twoH };
}

// الأطلس ← مفاتيح وحداته؛ ووصف الرسم لكل مفتاح يُبنى عند أول طلب (مظاهر الأمم تُسجَّل في BODIES بعد هذا الملف)
const ATLAS_OF = {};
for (const [gang, g] of Object.entries(SPRITES.gangs)) for (const key of Object.keys(g.units)) ATLAS_OF[key] = gang;
const DESC = {};

// وصف الرسم: وصف bodies.js (الحلقات والظل والهالة) مع الصور وأطوال أسلحتها. sx وsy متساويان: نسب الصورة بلا مط.
// للأمم: المفتاح بلاحقته _lite (المستوى المبسّط بالكود) أو _away (الصقر غائب) يرسم الصورة نفسها
function describe(key) {
  const away = /_away(_lite)?$/.test(key), base = key.replace(/_lite$/, '').replace(/_away$/, '');
  const gang = ATLAS_OF[base];
  if (!gang) return (DESC[key] = null);
  if (!BODIES[key]) return null;
  const P = SPRITES.gangs[gang].units[base], A = P._;
  if (!A) {                                    // العصابات الكلاسيكية: جدول ART
    const art = ART[key], w = Object.values(P).find(v => v.length > 7 && v[8] > 0);
    const size = key === 'hammer_hero' ? 1.1 : 1;           // بطل المطارق أضخم الجميع (القسم 6.6)
    return (DESC[key] = Object.assign({}, BODIES[key], {
      sx: size, sy: size, gang, P, art, sprite: true,
      tipLen: w ? w[8] : BODIES[key].tipLen, butt: w && w[9] > 0 ? w[9] : BODIES[key].butt,
      twoH: art.twoH || BODIES[key].twoH, shoots: art.shoots
    }));
  }
  const art = nationArt(base, P, A, away), body = BODIES[key];
  const hand = Object.keys(A.uses).find(n => A.uses[n] === 'hand'), w = hand && P[hand];
  // الحجم كأكبر بُعدي مظهر الكود (الأبطال أطول قليلاً)
  const size = Math.max(body.sx || 1, body.sy || 1);
  return (DESC[key] = Object.assign({}, body, {
    sx: size, sy: size, gang, P, art, sprite: true,
    tipLen: w ? w[8] : body.tipLen, butt: w && w[9] > 0 ? w[9] : body.butt, twoH: art.twoH
  }));
}

// وصف الوحدة بالصور إن كانت لها صور وتم تحميلها، وإلا null فتُرسم بالكود (ويبدأ تحميل أطلس الأمة)
export function spriteBody(key) {
  const d = key in DESC ? DESC[key] : describe(key);
  if (!d) return null;
  if (loaded[d.gang]) return d;
  load(d.gang);
  return null;
}

// يستدعي fn مرة واحدة حين يكتمل تحميل صور هذه الوحدة (إن لم تكن جاهزة): لإعادة رسم صورة ثابتة في المتجر
export function whenSpriteReady(key, fn) {
  const d = key in DESC ? DESC[key] : describe(key);
  if (!d || loaded[d.gang]) return;
  load(d.gang);
  waiting[d.gang].push(fn);
}

// رامي النار الكلاسيكي بصورته (قوس) يطلق سهماً مشتعلاً بدل الزجاجة: الشكل فقط، والقواعد كما هي
export function spriteShotLook(shot) {
  const a = shot.attacker;
  return a && !a.nation && a.hero === 'firebomber' && spriteBody('viper_firebomber') ? 'firearrow' : null;
}

// مثل drawBody في anim.js: نفس المفاصل ونفس J، والأجزاء من الصور. الساقان قبل الجذع لأن الإزار والثوب يغطيان أعلاهما
export function drawSpriteBody(c, p, col, ud) {
  const S = sheet(ud.gang, col), P = ud.P, A = ud.art;
  const hp = [p.px, p.py];
  const M = add(hp, rot(0, -4.6, p.pl)), a2 = p.pl + p.cb, C = add(M, rot(0, -4.6, a2)), N = add(C, rot(0, -1.3, a2));
  const ha = a2 + p.ht, H = add(add(N, rot(0, -3.1, ha)), [p.hdx, p.hdy]);
  const Sb = add(C, rot(-0.9, 0.7, a2)), Sf = add(C, rot(0.9, 0.5, a2));
  const J = { hip: hp, mid: M, chest: C, neck: N, head: H, ha, Sf, Sb, a2, pl: p.pl, legB: null, legF: null };

  J.legB = legPart(c, S, P.thD, P.snD, p.px - 1.2, p.py, p.tb, p.kb);
  J.legF = legPart(c, S, P.th, P.sn, p.px + 1.2, p.py, p.tf, p.kf);
  const b = ik2(Sb, p.bh, 3.7, 3.7, true);
  J.handB = b.e;
  armPart(c, S, P.uaD, P.laD, Sb, b);
  if (A.back) A.back(c, S, P, J, p);
  if (P.skirt) skirtPart(c, S, P.skirt, J);
  part(c, S, P.torso, hp[0], hp[1], angleOf(hp, C));
  if (A.mid) A.mid(c, S, P, J, p);
  part(c, S, P.head, H[0], H[1], ha + P.head[6]);
  const f = ik2(Sf, p.fh, 3.7, 3.7, true);
  J.handF = f.e;
  J.elbowF = f.j;
  A.held(c, S, P, J, p);
  armPart(c, S, P.ua, P.la, Sf, f);
  if (A.front) A.front(c, S, P, J, p);
  return J;
}
