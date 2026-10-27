// تجربة فقط (لا تُضاف للعبة): صورة شخصية مقطّعة أجزاءً تتحرك بعظام "فتى الجبل" نفسها.
// كل عظمة: زاويتها في وضعية اللعبة الآن ناقص زاويتها في الوقفة الأساسية BASE، تُطبَّق على جزء الصورة
// حول مفصله (بأطوال الصورة نفسها: رأس كبير وساقان قصيرتان).
// - الجذع والثوب ينثنيان بشبكة مثلثات (لا مفصل حاد): الجذع بين الحوض وأعلى العمود، والثوب بين الخصر والساقين
// - الساقان بنطال مرسوم (خط سميك بحافة) والحذاء من الصورة
// - الذراع البعيدة (بالساطور) خلف الجسد، والقريبة (القبضة) أمامه، كما في الصورة
// - كل ما كان مخفياً تحت جزء آخر رُمِّم بألوان الصورة
// الصورة نفسها ليست في المستودع (src/char.png، انظر README.md)، والمفاصل والمضلعات مقيسة عليها بالبكسل
import { BASE, ik2, rot, add } from '../../js/render/anim.js';

// ---------- مفاصل الصورة (بكسل في الصورة الأصلية 1144×1375) ----------
export const J = {
  HIP: [625, 862], M: [628, 722], NECK: [655, 442],
  SH_B: [560, 528], EL_B: [515, 748], HAND_B: [548, 942],          // الذراع القريبة (القبضة) = ذراع اللعبة الخلفية
  SH_F: [724, 522], EL_F: [800, 742], HAND_F: [866, 905],          // البعيدة (الساطور) = ذراع اللعبة الأمامية
  HIP_B: [582, 880], KN_B: [523, 1085], AN_B: [490, 1236],         // الساق القريبة = الخلفية
  HIP_F: [706, 880], KN_F: [736, 1085], AN_F: [746, 1236],         // البعيدة = الأمامية
  KNOT: [455, 255], SASH_KNOT: [450, 806]
};
// البنطال: عرض الحافة وعرض اللون للفخذ ثم للساق (الفخذ أنحف ليبقى تحت الثوب)
const PANTS = { thigh: [139, 116], shin: [160, 137] };
// نقاط النعل لتثبيت القدم على الأرض
const SOLE_B = [[378, 1360], [612, 1362]], SOLE_F = [[648, 1356], [922, 1352]];

// ---------- مضلعات القص ----------
const P = {
  head: [[408,232],[430,204],[464,198],[462,150],[512,102],[582,78],[583,20],[612,2],[750,2],[780,26],[782,96],[808,124],[842,146],[868,188],[870,252],[856,274],[855,322],[834,384],[796,424],[742,442],[660,450],[588,440],[538,417],[503,387],[483,347],[480,306],[440,302],[408,278]],
  bandana: [[486,252],[440,214],[392,240],[214,404],[262,428],[286,462],[250,562],[312,540],[358,552],[380,512],[400,476],[417,440],[434,400],[449,365],[464,325],[476,292],[490,282]],
  // الجذع: يمينه يقف عند خط الكم البعيد (الكم جزء مستقل)
  torso: [[486,480],[512,444],[560,428],[600,438],[640,448],[690,446],[726,432],[754,448],[764,476],[760,520],[761,560],[763,600],[763,640],[767,660],[771,680],[776,700],[780,724],[700,772],[560,792],[445,792],[428,762],[440,700],[470,600]],
  sleeve: [[502,488],[520,470],[555,460],[590,465],[612,478],[622,505],[620,570],[615,670],[613,765],[600,776],[560,780],[470,776],[424,768],[416,745],[433,705],[453,652],[475,585],[490,510]],
  forearmB: [[458,742],[572,742],[578,780],[588,850],[594,868],[612,885],[622,918],[618,955],[598,982],[562,994],[518,992],[492,972],[484,945],[462,942],[454,918],[466,880],[462,855],[456,775]],
  // الحزام: طرفه الأيمن عند نهاية القماش الأحمر (بعده الكم البعيد والساعد)
  sash: [[390,758],[470,748],[600,712],[700,700],[788,698],[796,735],[806,760],[807,800],[800,808],[700,814],[620,824],[470,840],[392,834],[384,800]],
  pouch: [[596,686],[656,686],[654,870],[598,870]],
  // الحزام المخفي تحت الذراع القريبة يُعاد رسمه
  sashFill: [[396,764],[606,712],[606,826],[396,838]],
  sashTails: [[482,782],[440,778],[398,798],[118,990],[160,1046],[196,1018],[192,1124],[240,1090],[298,1152],[334,1062],[460,900],[458,840],[460,800]],
  // الثوب كله (تحت الحزام): حافته اليسرى واليمنى وحاشيته من الصورة
  skirt: [[546,800],[620,800],[700,790],[796,782],[802,840],[806,860],[812,900],[818,920],[824,940],[830,960],[840,1000],[848,1040],[858,1080],[868,1100],[871,1106],[860,1110],[840,1120],[820,1128],[800,1136],[780,1142],[760,1146],[740,1148],[720,1150],[680,1154],[640,1156],[600,1156],[560,1154],[520,1150],[480,1146],[440,1141],[396,1141],[390,1136],[394,1120],[410,1080],[430,1040],[451,1000],[470,960],[489,920],[508,880],[527,840],[537,820]],
  // الكم البعيد: الجزء الظاهر في الصورة (حافته اليمنى والكُمّة البيضاء)
  farSliver: [[748,500],[754,520],[756,560],[758,600],[758,640],[762,660],[766,680],[770,700],[784,704],[788,728],[796,736],[824,738],[838,726],[836,708],[828,696],[820,680],[812,660],[806,640],[800,620],[794,600],[790,580],[786,560],[781,540],[776,520],[769,500],[760,482],[752,470]],
  farFore: [[794,740],[830,728],[850,760],[868,796],[882,806],[938,860],[934,872],[880,924],[866,950],[850,962],[834,960],[826,945],[812,926],[804,905],[800,875],[797,840],[795,800]],
  cleaver: [[878,880],[914,860],[944,878],[1098,1044],[1094,1110],[1004,1120],[890,962],[876,930]],
  bootB: [[360,1188],[472,1188],[478,1197],[582,1197],[614,1258],[624,1330],[620,1374],[360,1374]],
  bootF: [[632,1194],[700,1197],[790,1197],[832,1188],[902,1222],[930,1298],[930,1370],[632,1370]]
};
// شبكة الثوب: رباعي يحيط به (أعلاه تحت الحزام)
const SKIRT_Q = { WL: [544, 778], WR: [803, 778], HR: [899, 1170], HL: [362, 1170] };
// شبكة الجذع: مستطيل يحيط به، والانثناء بين y0 (أعلى العمود كله) وy1 (الحوض كله)
const TORSO_G = { x0: 400, y0: 420, x1: 800, y1: 800, bendTop: 630, bendBottom: 780 };

const OUT = '#111014', LW = 11;
const poly = (c, pts) => { c.beginPath(); pts.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); };
const polys = (c, list) => { c.beginPath(); for (const pts of list) { pts.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); } };
const line = (c, pts, w = LW, col = OUT) => {
  c.beginPath(); pts.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y));
  c.lineWidth = w; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
};

function canvasOf(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  return c;
}

// جزء = ما داخل مضلعاته من الصورة
function cut(img, list) {
  const c = canvasOf(img), x = c.getContext('2d');
  x.save(); polys(x, list); x.clip(); x.drawImage(img, 0, 0); x.restore();
  return c;
}
// ترميم: داخل الجزء نفسه وداخل ما كان يغطيه (covers)، يُمسح ثم يُرسم paint
function repair(c, inside, covers, paint) {
  const x = c.getContext('2d');
  x.save();
  poly(x, inside); x.clip();
  polys(x, covers); x.clip();
  x.clearRect(0, 0, c.width, c.height);
  paint(x);
  x.restore();
}

function sample(img, px, py) {
  const c = canvasOf(img), x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(px, py, 1, 1).data;
  return `rgb(${d[0]},${d[1]},${d[2]})`;
}

// ---------- بناء الأجزاء مع الترميم ----------
export function buildParts(img) {
  const ROBE = sample(img, 560, 650), RED = sample(img, 720, 770), CUFF = sample(img, 800, 712);
  const parts = { colors: { B: sample(img, 500, 1172), F: sample(img, 745, 1172) } };
  const fill = (x, pts, col) => { poly(x, pts); x.fillStyle = col; x.fill(); };

  parts.head = cut(img, [P.head]);
  parts.bandana = cut(img, [P.bandana]);

  // الجذع: ما تحت الكم القريب أزرق بحافة الجسد اليسرى، وما تحت الرأس ياقة زرقاء
  const torso = cut(img, [P.torso]);
  repair(torso, P.torso, [P.sleeve], (x) => {
    x.fillStyle = ROBE; x.fillRect(0, 0, 1144, 1375);
    line(x, [[494, 500], [474, 590], [462, 700], [458, 790]]);
  });
  repair(torso, P.torso, [P.head], (x) => { x.fillStyle = ROBE; x.fillRect(0, 0, 1144, 1375); });
  parts.torso = torso;

  parts.sleeve = cut(img, [P.sleeve]);
  parts.forearmB = cut(img, [P.forearmB]);

  // الحزام مع الحقيبة: ما تحت الذراع القريبة أحمر بحافتيه
  const sash = cut(img, [P.sash, P.pouch]);
  repair(sash, P.sash, [P.sleeve, P.forearmB], (x) => {
    fill(x, P.sashFill, RED);
    line(x, [[396, 764], [606, 712]]);
    line(x, [[396, 838], [606, 826]]);
  });
  { const x = sash.getContext('2d'); x.save(); poly(x, P.pouch); x.clip(); x.drawImage(img, 0, 0); x.restore(); }
  parts.sash = sash;

  // أطراف الحزام: ما تحت الساعد مقصوص بحده
  parts.sashTails = cut(img, [P.sashTails]);

  // الثوب: تحت القبضة وتحت الحقيبة أزرق، وحافتاه تحت اليدين خط أسود
  const skirt = cut(img, [P.skirt]);
  repair(skirt, P.skirt, [P.forearmB, P.pouch], (x) => {
    x.fillStyle = ROBE; x.fillRect(0, 0, 1144, 1375);
    line(x, [[548, 800], [474, 966]], 12);
  });
  repair(skirt, P.skirt, [P.farFore, [[786, 790], [830, 790], [830, 960], [800, 960]]], (x) => {
    x.fillStyle = ROBE; x.fillRect(0, 0, 1144, 1375);
    line(x, [[790, 790], [804, 862], [822, 950]], 12);
  });
  parts.skirt = skirt;

  // الكم البعيد: كم كامل مرسوم (يظهر حين ترتفع الذراع) وفوقه ما يظهر منه في الصورة
  const far = canvasOf(img), fx = far.getContext('2d');
  const sleevePoly = [[652, 497], [668, 470], [700, 454], [735, 452], [752, 478], [762, 500], [768, 520], [774, 540],
    [779, 560], [783, 580], [787, 600], [793, 620], [798, 640], [805, 660], [812, 680], [819, 700], [826, 716], [830, 732],
    [714, 778]];
  fill(fx, sleevePoly, ROBE);
  fill(fx, [[824, 700], [830, 732], [714, 778], [702, 746]], CUFF);
  line(fx, [[702, 746], [824, 700]]);
  fx.save(); poly(fx, sleevePoly); fx.lineWidth = LW; fx.strokeStyle = OUT; fx.lineJoin = 'round'; fx.stroke(); fx.restore();
  fx.save(); poly(fx, P.farSliver); fx.clip(); fx.clearRect(0, 0, 1144, 1375); fx.drawImage(img, 0, 0); fx.restore();
  parts.farSleeve = far;

  parts.farFore = cut(img, [P.farFore]);
  // الساطور: مقبضه تحت الكف يُعاد رسمه
  const cleaver = cut(img, [P.cleaver]);
  repair(cleaver, P.cleaver, [P.farFore], (x) => {
    line(x, [[846, 872], [912, 934]], 50, OUT);
    line(x, [[846, 872], [912, 934]], 30, '#3a3a40');
  });
  parts.cleaver = cleaver;

  parts.bootB = cut(img, [P.bootB]);
  parts.bootF = cut(img, [P.bootF]);
  return parts;
}

// ---------- هيكل اللعبة (كما في drawBody) ----------
const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
function legPts(hx, hy, th, fl) {
  const k = [hx + Math.sin(th) * 5.8, hy + Math.cos(th) * 5.8];
  const f = [k[0] + Math.sin(th - fl) * 6, k[1] + Math.cos(th - fl) * 6];
  const toe = [f[0] + Math.sin(th - fl + 1.1) * 2, f[1] + Math.cos(th - fl + 1.1) * 0.9];
  return { h: [hx, hy], k, f, toe };
}
export function skeleton(p) {
  const hp = [p.px, p.py];
  const M = add(hp, rot(0, -4.6, p.pl)), a2 = p.pl + p.cb, C = add(M, rot(0, -4.6, a2)), N = add(C, rot(0, -1.3, a2));
  const ha = a2 + p.ht, H = add(add(N, rot(0, -3.1, ha)), [p.hdx || 0, p.hdy || 0]);
  const Sb = add(C, rot(-0.9, 0.7, a2)), Sf = add(C, rot(0.9, 0.5, a2));
  const b = ik2(Sb, p.bh, 3.7, 3.7, true), f = ik2(Sf, p.fh, 3.7, 3.7, true);
  return { hp, M, C, N, H, Sb, Sf, eB: b.j, hB: b.e, eF: f.j, hF: f.e,
           lB: legPts(p.px - 1.2, p.py, p.tb, p.kb), lF: legPts(p.px + 1.2, p.py, p.tf, p.kf), wa: p.wa };
}
function bones(p) {
  const s = skeleton(p);
  return {
    pelvis: ang(s.hp, s.M), spine: ang(s.M, s.C), head: ang(s.N, s.H),
    armBu: ang(s.Sb, s.eB), armBl: ang(s.eB, s.hB), armFu: ang(s.Sf, s.eF), armFl: ang(s.eF, s.hF), weapon: s.wa,
    thB: ang(s.lB.h, s.lB.k), shB: ang(s.lB.k, s.lB.f), ftB: ang(s.lB.f, s.lB.toe),
    thF: ang(s.lF.h, s.lF.k), shF: ang(s.lF.k, s.lF.f), ftF: ang(s.lF.f, s.lF.toe),
    hip: s.hp, foot: Math.max(s.lB.f[1], s.lB.toe[1], s.lF.f[1], s.lF.toe[1])
  };
}
const REST = bones(BASE);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const smax = (a, b, e = 0.12) => (a + b + Math.sqrt((a - b) * (a - b) + e * e) - e) / 2;
const smin = (a, b, e = 0.12) => (a + b - Math.sqrt((a - b) * (a - b) + e * e) + e) / 2;
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// تحويل جزء: يدور حول مفصله pivot (في الصورة) بزاوية d، ويوضع مفصله في at
const T = (pivot, at, d) => ({ pivot, at, d, c: Math.cos(d), s: Math.sin(d) });
const apply = (t, p) => {
  const x = p[0] - t.pivot[0], y = p[1] - t.pivot[1];
  return [t.at[0] + x * t.c - y * t.s, t.at[1] + x * t.s + y * t.c];
};
const rotV = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

// k: بكسل الصورة لكل وحدة من وحدات الهيكل (لإزاحة الحوض)، sway: تمايل الأشرطة
// opts.bend: نسبة انثناء الجذع من انثناء اللعبة، opts.robe: نسبة اتباع الثوب للساقين
// opts.prev: الوضعية قبل opts.dt ثانية، لتتأخر الأشرطة عن حركة الجسد (كالقماش)
export function rigTransforms(p, opts = {}) {
  const k = opts.k || 31, time = opts.time || 0, sway = opts.sway === undefined ? 0.1 : opts.sway;
  const bend = opts.bend === undefined ? 0.85 : opts.bend, robeK = opts.robe === undefined ? 0.7 : opts.robe;
  const b = bones(p), d = {};
  for (const key of Object.keys(REST)) if (key !== 'hip' && key !== 'foot') d[key] = wrap(b[key] - REST[key]);
  // انثناء الجذع: أعلى العمود يتبع الحوض ثم يزيد عليه جزءاً من انثنائه
  d.spine = d.pelvis + (d.spine - d.pelvis) * bend;
  const root = [J.HIP[0] + (b.hip[0] - REST.hip[0]) * k, J.HIP[1] + (b.hip[1] - REST.hip[1]) * k];
  const t = {};
  t.pelvis = T(J.HIP, root, d.pelvis);
  t.upper = T(J.M, apply(t.pelvis, J.M), d.spine);
  t.sash = t.pelvis;
  t.head = T(J.NECK, apply(t.upper, J.NECK), d.head);
  // الأشرطة تتدلى بالجاذبية: تدور قليلاً مع ما تتعلق به، وتتأخر عن سرعة عقدتها (عكس اتجاه الحركة)
  const knotB = apply(t.head, J.KNOT), knotS = apply(t.pelvis, J.SASH_KNOT);
  let lagB = 0, lagS = 0;
  if (opts.prev) {
    const q = rigTransforms(opts.prev, Object.assign({}, opts, { prev: null }));
    const dt = opts.dt || 0.1, kv = 0.0011;
    const vb = [(knotB[0] - apply(q.t.head, J.KNOT)[0]) / dt, (knotB[1] - apply(q.t.head, J.KNOT)[1]) / dt];
    const vs = [(knotS[0] - apply(q.t.pelvis, J.SASH_KNOT)[0]) / dt, (knotS[1] - apply(q.t.pelvis, J.SASH_KNOT)[1]) / dt];
    lagB = clamp(kv * (vb[0] + vb[1]), -0.9, 0.9);
    lagS = clamp(kv * 0.8 * (vs[0] + vs[1]), -0.7, 0.7);
  }
  t.bandana = T(J.KNOT, knotB, d.head * 0.25 + Math.sin(time * 5.2) * sway * 1.4 + lagB);
  t.sashTails = T(J.SASH_KNOT, knotS, d.pelvis * 0.35 + Math.sin(time * 4.4 + 1) * sway - clamp(d.thB, -1, 1) * 0.2 + lagS);
  // الذراع القريبة (الخلفية في اللعبة)
  t.sleeve = T(J.SH_B, apply(t.upper, J.SH_B), d.armBu);
  t.forearmB = T(J.EL_B, apply(t.sleeve, J.EL_B), d.armBl);
  // البعيدة
  t.farSleeve = T(J.SH_F, apply(t.upper, J.SH_F), d.armFu);
  t.farFore = T(J.EL_F, apply(t.farSleeve, J.EL_F), d.armFl);
  t.cleaver = T(J.HAND_F, apply(t.farFore, J.HAND_F), d.weapon);
  // الساقان من الحوض (لا تدوران مع ميله، كما في اللعبة)
  const off = [root[0] - J.HIP[0], root[1] - J.HIP[1]];
  const legs = {};
  for (const [s, H, K, A] of [['B', J.HIP_B, J.KN_B, J.AN_B], ['F', J.HIP_F, J.KN_F, J.AN_F]]) {
    const hip = [H[0] + off[0], H[1] + off[1]];
    const thigh = T(H, hip, d['th' + s]);
    const knee = apply(thigh, K);
    const shin = T(K, knee, d['sh' + s]);
    const ankle = apply(shin, A);
    t['boot' + s] = T(A, ankle, d['ft' + s]);
    legs[s] = [hip, knee, ankle];
  }
  // الثوب: أعلاه مع الحوض، وحافته الخلفية تتبع الفخذ الأبعد للخلف، والأمامية الأبعد للأمام
  const back = smax(d.thB, d.thF), front = smin(d.thB, d.thF);
  const eB = clamp(lerp(d.pelvis, back, robeK), -1.3, 1.3), eF = clamp(lerp(d.pelvis, front, robeK), -1.3, 1.3);
  const WL = apply(t.pelvis, SKIRT_Q.WL), WR = apply(t.pelvis, SKIRT_Q.WR);
  const HL = add(WL, rotV([SKIRT_Q.HL[0] - SKIRT_Q.WL[0], SKIRT_Q.HL[1] - SKIRT_Q.WL[1]], eB));
  const HR = add(WR, rotV([SKIRT_Q.HR[0] - SKIRT_Q.WR[0], SKIRT_Q.HR[1] - SKIRT_Q.WR[1]], eF));
  const skirt = { WL, WR, HL, HR };
  // القدم على الأرض: أخفض نقطة في النعلين تتحرك كما تتحرك أخفض قدم في اللعبة
  const restLow = Math.max(...SOLE_B.map(q => q[1]), ...SOLE_F.map(q => q[1]));
  const nowLow = Math.max(...SOLE_B.map(q => apply(t.bootB, q)[1]), ...SOLE_F.map(q => apply(t.bootF, q)[1]));
  const lift = (b.foot - REST.foot) * k - (nowLow - restLow);
  return { t, legs, skirt, lift };
}

// ---------- رسم شبكة مثلثات: كل مثلث من المصدر إلى الهدف بتحويل خطي ----------
function triangle(ctx, img, s0, s1, s2, d0, d1, d2, grow) {
  const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
  if (Math.abs(den) < 1e-6) return;
  const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / den;
  const b = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / den;
  const c = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / den;
  const e = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / den;
  const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
  ctx.save();
  ctx.beginPath();
  for (const [k, q] of [d0, d1, d2].entries()) {
    const dx = q[0] - cx, dy = q[1] - cy, n = Math.hypot(dx, dy) || 1;
    const x = q[0] + dx / n * grow, y = q[1] + dy / n * grow;
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, c, b, e, d0[0] - a * s0[0] - b * s0[1], d0[1] - c * s0[0] - e * s0[1]);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
function mesh(ctx, img, src, dst, nu, nv, grow) {
  const S = [], D = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { S.push(src(i / nu, j / nv)); D.push(dst(i / nu, j / nv)); }
  const at = (i, j) => j * (nu + 1) + i;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    triangle(ctx, img, S[a], S[b], S[c], D[a], D[b], D[c], grow);
    triangle(ctx, img, S[a], S[c], S[d], D[a], D[c], D[d], grow);
  }
}
const bil = (q, u, v) => {
  const l = [q.WL[0] + (q.HL[0] - q.WL[0]) * v, q.WL[1] + (q.HL[1] - q.WL[1]) * v];
  const r = [q.WR[0] + (q.HR[0] - q.WR[0]) * v, q.WR[1] + (q.HR[1] - q.WR[1]) * v];
  return [l[0] + (r[0] - l[0]) * u, l[1] + (r[1] - l[1]) * u];
};

// ---------- الرسم ----------
function part(ctx, img, t) {
  ctx.save();
  ctx.translate(t.at[0], t.at[1]);
  ctx.rotate(t.d);
  ctx.translate(-t.pivot[0], -t.pivot[1]);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
function pants(ctx, [hip, knee, ankle], col) {
  line(ctx, [hip, knee], PANTS.thigh[0], OUT);
  line(ctx, [knee, ankle], PANTS.shin[0], OUT);
  line(ctx, [hip, knee], PANTS.thigh[1], col);
  line(ctx, [knee, ankle], PANTS.shin[1], col);
}

// x,y: مكان نقطة الصورة origin على اللوحة، scale: الحجم
export function drawRig(ctx, parts, rig, x, y, scale, origin = [0, 0]) {
  const grow = 0.8 / scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-origin[0], -origin[1] + rig.lift);
  const t = rig.t;
  // الساق البعيدة ثم القريبة
  pants(ctx, rig.legs.F, parts.colors.F);
  part(ctx, parts.bootF, t.bootF);
  pants(ctx, rig.legs.B, parts.colors.B);
  part(ctx, parts.bootB, t.bootB);
  // الثوب
  mesh(ctx, parts.skirt, (u, v) => bil(SKIRT_Q, u, v), (u, v) => bil(rig.skirt, u, v), 8, 8, grow);
  // الذراع البعيدة
  part(ctx, parts.cleaver, t.cleaver);
  part(ctx, parts.farFore, t.farFore);
  part(ctx, parts.farSleeve, t.farSleeve);
  part(ctx, parts.sashTails, t.sashTails);
  part(ctx, parts.bandana, t.bandana);                 // أطراف العصابة خلف الجسد
  // الجذع: كل نقطة بين الحوض وأعلى العمود حسب ارتفاعها
  const G = TORSO_G;
  mesh(ctx, parts.torso,
    (u, v) => [G.x0 + (G.x1 - G.x0) * u, G.y0 + (G.y1 - G.y0) * v],
    (u, v) => {
      const s = [G.x0 + (G.x1 - G.x0) * u, G.y0 + (G.y1 - G.y0) * v];
      const w = smooth((G.bendBottom - s[1]) / (G.bendBottom - G.bendTop));
      const a = apply(t.pelvis, s), b = apply(t.upper, s);
      return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
    }, 6, 8, grow);
  part(ctx, parts.sash, t.sash);
  part(ctx, parts.head, t.head);
  part(ctx, parts.forearmB, t.forearmB);
  part(ctx, parts.sleeve, t.sleeve);
  ctx.restore();
}
