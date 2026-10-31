/* أنميشن القتال حسب السلاح (القسم 5.4.8): نفس الهيكل ونفس الوضعيات المفتاحية (drawBody في anim.js)، لكن لكل
   سلاح لغة حركة: السكين طعنات قصيرة قريبة من الجسد، والرمح طعنات مستقيمة بخطوة، والمطرقة رفع بطيء فوق الكتف وضربة
   قوسية بدوران الجذع، والقبضات لكمات بدوران الورك والكتف، والدرع دفع وضرب بحافته، والسيف والعصا تلويح بالاتجاهين.
   كل حركة على الخط الزمني القياسي للقتال (combatArt.js): 0 الوقفة، 0.34 قمة الاستعداد، 0.40 الارتطام (لحظة الضرر
   نفسها: الاستعداد + 0.6 من زمن الضرب)، 0.47 الامتداد بعده، 0.53 نهاية التجمّد، 1 العودة إلى وقفة السلاح.
   العقد من شجرة التتابع (FIGHT في config.js، وتختارها game/realism.js): L1..L4 خفيفة، H1 قوية، D اندفاع،
   S1 خاصة (لفّة أو ركلة عالية أو دفعة، حسب ما تملكه الوحدة)، F إنهاء القائد، P لكمة، KF وKH ركلتان.
   القدمان تُحلّان بحل عكسي (legIK) فتبقيان على الأرض والحوض يتحرك. tw دوران الجذع: يُقدّم الكتف الخلفي ويُرجع الأمامي. */
import { COMBAT_REALISM as CR } from '../config.js';
import { ATK, P, mixPose, ease } from './anim.js';

const GROUND = 0.9;          // ارتفاع الكاحل والقدم على الأرض
// قدما كل وضعية مؤلَّفة (للتأليف وحده): في جدول جانبي لا في الوضعية، فتبقى كائناً بسيطاً سريع النسخ والمزج
const FEET = new WeakMap();

// زاويتا الفخذ والركبة لكاحل في (fx, fy) من ورك في (hx, hy): الركبة للأمام (عكس leg في anim.js)
function legIK(hx, hy, fx, fy) {
  const dx = fx - hx, dy = fy - hy, d = Math.max(0.3, Math.min(11.75, Math.hypot(dx, dy)));
  const a = Math.acos(Math.max(-1, Math.min(1, (33.64 + d * d - 36) / (11.6 * d))));
  const th = Math.atan2(dx, dy) + a, kx = hx + Math.sin(th) * 5.8, ky = hy + Math.cos(th) * 5.8;
  return [th, th - Math.atan2(fx - kx, fy - ky)];
}

// وضعية من أساس وتعديلات: القدمان (ff الأمامية وbf الخلفية) تبقيان حيث كانتا في الأساس ما لم تُعطيا،
// فيتحرك الحوض والقدمان ثابتتان. tf/kf أو tb/kb صريحة تلغي الحل العكسي لساقها (القفز والركل).
// fa وba: اليد بالاتجاه من كتفها [زاوية، امتداد] (0 للأمام وسالب للأعلى، 1 ذراع ممدودة تماماً)، فتمتد الضربة
// من الكتف أمام الرأس مهما مال الجسد بدل موضع ثابت قد يقع عند الوجه
const ARM = 7.35, AUTHOR = { ff: 1, bf: 1, fa: 1, ba: 1 };
function S(base, o = {}) {
  const p = Object.assign({}, base), feet = FEET.get(base) || {};
  for (const k in o) if (!AUTHOR[k]) p[k] = o[k];     // بلا delete: يبقى الكائن سريع الشكل
  const ff = o.tf !== undefined ? null : o.ff || feet.ff, bf = o.tb !== undefined ? null : o.bf || feet.bf;
  if (ff) [p.tf, p.kf] = legIK(p.px + 1.2, p.py, ff[0], ff[1]);
  if (bf) [p.tb, p.kb] = legIK(p.px - 1.2, p.py, bf[0], bf[1]);
  if (o.fa || o.ba) {
    const a2 = p.pl + p.cb, tw = p.tw || 0;
    const cx = p.px + 4.6 * Math.sin(p.pl) + 4.6 * Math.sin(a2), cy = p.py - 4.6 * Math.cos(p.pl) - 4.6 * Math.cos(a2);
    const at = (x, y, [an, k]) => [cx + x * Math.cos(a2) - y * Math.sin(a2) + Math.cos(an) * ARM * k,
                                   cy + x * Math.sin(a2) + y * Math.cos(a2) + Math.sin(an) * ARM * k];
    if (o.fa) p.fh = at(0.9 - 0.9 * tw, 0.5, o.fa);
    if (o.ba) p.bh = at(-0.9 + 1.5 * tw, 0.7, o.ba);
  }
  FEET.set(p, { ff: ff || feet.ff, bf: bf || feet.bf });
  return p;
}

// مفاتيح على الخط الزمني: [t, وضعية, تسارع المقطع الداخل إليها]
// 'in' يتسارع نحو المفتاح (الضرب: أسرع لحظة عند الارتطام)، 'out' يتباطأ (السحب للخلف ثم التمهّل في القمة)
const EASE = { in: x => x * x * x, out: x => 1 - (1 - x) * (1 - x), lin: x => x };
function keyAt(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (t <= k[0]) {
      const [t0, p0] = keys[i - 1], u = (t - t0) / (k[0] - t0);
      return mixPose(p0, k[1], k[2] ? EASE[k[2]](u) : ease(u));
    }
  }
  return keys[keys.length - 1][1];
}

// ضربة قياسية من وقفة g: استعداد ثم ارتطام ثم امتداد ثم عودة. o: {w0 بداية الاستعداد، w قمته، c الارتطام،
// f الامتداد، r منتصف العودة} وكلها تعديلات على الوقفة (والارتطام على قمة الاستعداد، والامتداد على الارتطام).
// slow: رفع بطيء متساوٍ على طول الاستعداد بدل سحب سريع ثم تمهّل (المطرقة)
function strike(g, o, slow) {
  const w0 = o.w0 && S(g, o.w0), w = S(g, o.w), c = S(w, o.c), f = S(c, o.f || {}), r = S(g, o.r || {});
  const e = slow ? undefined : 'out';
  return [[0, g], ...(w0 ? [[0.17, w0, e]] : []), [0.34, w, e], [0.40, c, 'in'], [0.47, f, 'out'], [0.53, f],
          [0.74, r], [1, g]];
}

/* ===================== وقفات القتال لكل سلاح ===================== */
const G0 = P({ tw: 0 });          // وقفة المرجع (GUARD) بقدمين على الأرض
const GUARDS = {
  // السكين: الجسد منحنٍ للأمام قليلاً، والسكين قريبة من البطن ونصلها للأمام، واليد الأخرى تحمي الوجه
  knife: S(G0, { px: 0, py: -9.6, pl: 0.22, cb: 0.14, ht: -0.2, fh: [5.8, -14.2], bh: [4.4, -18.6], wa: -0.35,
                 ff: [4.6, GROUND], bf: [-4.2, GROUND] }),
  // السيف والعصا: وقفة المرجع، والسلاح مرفوع للأمام
  blade: S(G0, { py: -9.8, fh: [4.6, -15], bh: [3, -13.4], wa: -1.35, ff: [4.4, GROUND], bf: [-4.6, GROUND] }),
  // الرمح: جانبي عريض، والرمح أفقي بارتفاع الخصر ورأسه للأمام، والمرفق مثني ليمتد في الطعنة
  spear: S(G0, { py: -10.1, pl: 0.06, cb: 0.02, ht: 0.02, fh: [4.2, -14.8], bh: [1.4, -14.4], wa: -0.12,
                 ff: [5.6, GROUND], bf: [-5.4, GROUND] }),
  // المطرقة: منخفض عريض، والمطرقة مائلة للأعلى أمام الصدر
  hammer: S(G0, { py: -9.3, pl: 0.14, cb: 0.12, ht: 0.06, fh: [4.4, -14.4], bh: [1.6, -13], wa: -1.15,
                  ff: [5, GROUND], bf: [-5.2, GROUND] }),
  // القبضات: وقفة ملاكم، القبضتان عند الذقن والذقن للأسفل، والوزن على القدم الخلفية
  fists: S(G0, { py: -9.9, pl: 0.1, cb: 0.08, ht: 0.12, fh: [5.4, -18.2], bh: [3.4, -18.6], wa: -1.4,
                 ff: [3.8, GROUND], bf: [-4.4, GROUND] }),
  // الدرع: الدرع للأمام والجسد خلفه منحنياً
  shield: S(G0, { py: -9.6, pl: 0.18, cb: 0.16, ht: 0.24, fh: [5.8, -14.8], bh: [2.2, -12.6], wa: -1.2,
                  ff: [4.6, GROUND], bf: [-4.8, GROUND] }),
  // الرامي: سلاحه منخفض للخلف قليلاً، والقبضة الأخرى عند الصدر
  ranged: S(G0, { py: -9.9, pl: 0.12, cb: 0.08, ht: 0.04, fh: [5, -13.6], bh: [3.4, -17.6], wa: -0.9,
                  ff: [4.2, GROUND], bf: [-4.4, GROUND] })
};

// اليد الحاملة للسلاح أثناء اللكم والركل: قريبة من الصدر بزاوية تناسب السلاح
const TUCK = {
  knife: { fh: [3.6, -15.2], wa: -0.9 }, blade: { fh: [2.4, -14.6], wa: -1.7 }, spear: { fh: [3.2, -14.4], wa: -0.5 },
  hammer: { fh: [2.6, -15.2], wa: -1.6 }, fists: { fh: [4.4, -18], wa: -1.4 }, shield: { fh: [5.8, -15], wa: -1.2 },
  ranged: { fh: [2.6, -14.6], wa: -1.3 }
};

/* ===================== الحركات لكل سلاح ===================== */
const N = {};

// ---- السكين: قصيرة سريعة متكررة، قريبة من الجسد، طعن وضربة عكسية واندفاع قصير ----
{
  const g = GUARDS.knife;
  N.knife = {
    // L1 طعنة: السكين تُسحب إلى الخاصرة ثم تمتد بالجسد كله وخطوة قصيرة
    L1: strike(g, {
      w: { px: -0.6, pl: 0.16, cb: 0.04, ht: -0.16, tw: -0.5, fh: [2.4, -13.4], wa: -0.12, bh: [4.2, -18.8] },
      c: { px: 2, pl: 0.22, cb: 0.1, ht: -0.1, tw: 0.4, fa: [0.06, 0.98], wa: -0.06, bh: [2.6, -17.8], ff: [6.8, GROUND] },
      f: { px: 2.3, fa: [0.08, 1] },
      r: { px: 0.9, fh: [7.2, -14.6], ff: [5.6, GROUND] } }),
    // L2 ضربة عكسية: السكين تعبر الصدر إلى الكتف الآخر ثم تُجلد للخارج أفقياً
    L2: strike(g, {
      w: { px: -0.3, pl: 0.28, cb: 0.3, ht: 0.02, tw: 0.5, fh: [1.2, -18.4], wa: -2.95, bh: [2.4, -15.6] },
      c: { px: 1.6, pl: 0.22, cb: 0.06, ht: -0.1, tw: -0.5, fa: [-0.14, 0.95], wa: 0.22, bh: [-1.4, -15], ff: [6, GROUND] },
      f: { px: 1.8, fa: [-0.5, 0.95], wa: -0.55 },
      r: { px: 0.8, fh: [7, -16], wa: -0.4 } }),
    // L3 اندفاع قصير: انخفاض والسكين عند الورك، ثم وثبة للأمام بطعنة صاعدة والذراع الأخرى للخلف
    L3: strike(g, {
      w: { py: -8.6, pl: 0.36, cb: 0.24, ht: -0.32, tw: -0.4, fh: [2.4, -11.6], wa: -0.2, bh: [3.6, -16.8], ff: [3.6, GROUND], bf: [-4.6, GROUND] },
      c: { px: 4.2, py: -9.2, pl: 0.32, cb: 0.12, ht: -0.16, tw: 0.45, fa: [-0.1, 1], wa: -0.3, bh: [-2.6, -13], ff: [10.4, GROUND], bf: [-2.6, GROUND] },
      f: { px: 4.6, fa: [-0.18, 1], wa: -0.42 },
      r: { px: 2, py: -9.4, fh: [8, -14], ff: [7, GROUND], bf: [-3.4, GROUND] } }),
    // H1 طعنة نازلة: السكين تُرفع فوق الرأس والجسد يتقوس، ثم تهوي بانحناء كامل وخطوة
    H1: strike(g, {
      w0: { py: -10.2, pl: 0.1, cb: -0.1, fh: [3, -21.6], wa: -1.9, bh: [5.4, -17] },
      w: { py: -10.9, pl: 0, cb: -0.3, ht: -0.32, tw: -0.6, fh: [0.6, -25.4], wa: -2.5, bh: [6.6, -17.6], ff: [4, GROUND] },
      c: { px: 2.6, py: -8.6, pl: 0.38, cb: 0.48, ht: 0.3, tw: 0.6, fa: [0.62, 0.98], wa: 1.1, bh: [-2.6, -14], ff: [7.6, GROUND] },
      f: { py: -8.2, cb: 0.56, fa: [0.8, 0.98], wa: 1.35 },
      r: { px: 1.2, py: -9, fh: [7.4, -13.8], wa: 0.2, ff: [5.6, GROUND] } }),
    // D ضربة الاندفاع: يصل راكضاً منحنياً والسكين للخلف، ثم يقفز بطعنة طويلة
    D: strike(g, {
      w: { px: 0.6, py: -9.5, pl: 0.44, cb: 0.26, ht: -0.36, tw: -0.6, fh: [-1.4, -12.4], wa: 0.1, bh: [6, -16.4], ff: [5.6, 0.5], bf: [-5.4, GROUND] },
      c: { px: 5.6, py: -9.9, pl: 0.34, cb: 0.12, ht: -0.14, tw: 0.55, fa: [-0.04, 1], wa: -0.12, bh: [-3.6, -12.6], ff: [12.4, GROUND], bf: [-1.2, 0.2] },
      f: { px: 6, fa: [-0.04, 1] },
      r: { px: 3, py: -9.6, fh: [9.4, -14.2], ff: [8.6, GROUND], bf: [-2.8, GROUND] } })
  };
}

// ---- السيف والعصا: تلويح أمامي وعكسي وصاعد، وضربة قوية من فوق الرأس ----
{
  const g = GUARDS.blade;
  N.blade = {
    // L1 تلويح أمامي (من المرجع، بخطوة)
    L1: strike(g, {
      w: { pl: 0.02, cb: -0.28, ht: -0.12, tw: -0.55, fh: [-2, -13.5], bh: [3, -10], wa: -2.6 },
      c: { px: 2.4, pl: 0.22, cb: 0.3, ht: 0.16, tw: 0.5, fa: [0.5, 0.96], bh: [-4.5, -9], wa: 0.15, ff: [7, GROUND] },
      f: { fa: [0.78, 0.95], wa: 0.55 },
      r: { px: 1.2, fh: [7, -12.4], wa: -0.5, ff: [5.6, GROUND] } }),
    // L2 تلويح عكسي: السلاح يعود من الأسفل للأعلى عبر الجسد
    L2: strike(g, {
      w: { px: 0.4, pl: 0.3, cb: 0.34, ht: 0.12, tw: 0.55, fh: [1.6, -9.6], wa: 2.5, bh: [-1.6, -12.4] },
      c: { px: 1.8, pl: 0.16, cb: 0, ht: -0.14, tw: -0.5, fa: [-0.45, 0.95], wa: -0.55, bh: [-3.2, -12], ff: [6.6, GROUND] },
      f: { fa: [-0.78, 0.92], wa: -1.15 },
      r: { px: 0.8, fh: [6.4, -16.4], wa: -1.25 } }),
    // L3 ضربة صاعدة مائلة بخطوة عميقة
    L3: strike(g, {
      w: { py: -8.8, pl: 0.36, cb: 0.28, ht: 0.1, tw: -0.4, fh: [-1.6, -9.6], wa: 2.7, bh: [4.4, -14.4], ff: [3.8, GROUND] },
      c: { px: 3.2, py: -10.2, pl: 0.1, cb: -0.1, ht: -0.24, tw: 0.5, fa: [-0.82, 0.96], wa: -1.0, bh: [-3.6, -14.2], ff: [8.6, GROUND] },
      f: { px: 3.4, fa: [-1.08, 0.95], wa: -1.6 },
      r: { px: 1.6, fh: [6, -17.6], wa: -1.4, ff: [6, GROUND] } }),
    // H1 من فوق الرأس (من المرجع) بخطوة أوسع
    H1: strike(g, {
      w0: { py: -10.8, pl: -0.04, cb: -0.2, fh: [2, -21], bh: [0, -18], wa: -1.7 },
      w: { py: -11.6, pl: -0.14, cb: -0.4, ht: -0.35, tw: -0.5, fh: [-1, -26], bh: [-3, -21.5], wa: -2.05 },
      c: { px: 3.2, py: -8.4, pl: 0.36, cb: 0.6, ht: 0.4, tw: 0.5, fa: [0.92, 1], bh: [5.5, -5.5], wa: 1.1, ff: [8.2, GROUND] },
      f: { fa: [1.06, 1], wa: 1.3 },
      r: { px: 1.4, py: -9.2, fh: [7, -10], wa: 0.2, ff: [6, GROUND] } }),
    // D اندفاع بطعنة: يصل راكضاً والسلاح للخلف، ثم امتداد كامل بوثبة
    D: strike(g, {
      w: { px: 0.4, py: -9.6, pl: 0.42, cb: 0.26, ht: -0.3, tw: -0.5, fh: [-3, -11.4], wa: 0.05, bh: [4.6, -15.6], ff: [5.4, 0.5] },
      c: { px: 5.4, py: -10.1, pl: 0.34, cb: 0.12, ht: -0.08, tw: 0.4, fa: [0.04, 1], wa: 0, bh: [-6.6, -10.4], ff: [12.4, GROUND], bf: [-1.6, 0.3] },
      f: { px: 5.8, fa: [0.04, 1] },
      r: { px: 3, fh: [9.2, -13], wa: -0.8, ff: [8.4, GROUND], bf: [-3, GROUND] } })
  };
}

// ---- الرمح: طعنات مستقيمة سريعة بخطوة قبل الطعن، دفع وسحب، بلا تأرجح دائري ----
{
  const g = GUARDS.spear;
  N.spear = {
    // L1 طعنة مستقيمة: خطوة قصيرة للأمام والرمح يُسحب، ثم يمتد أفقياً بالذراعين
    L1: strike(g, {
      w0: { px: 0.6, pl: 0.06, fh: [2.6, -14.4], ff: [6.8, GROUND] },
      w: { px: 0.4, pl: 0.02, cb: -0.06, ht: -0.04, tw: -0.4, fh: [1.4, -14.2], wa: -0.08, ff: [7, GROUND] },
      c: { px: 3.4, pl: 0.2, cb: 0.08, ht: 0.04, tw: 0.4, fa: [0.42, 1], wa: -0.04, ff: [8.6, GROUND], bf: [-4.2, GROUND] },
      f: { px: 3.6, fa: [0.42, 1] },
      r: { px: 1.2, fh: [6, -14.6], ff: [6.6, GROUND], bf: [-5, GROUND] } }),
    // L2 طعنة عالية بدفع وسحب: الرمح يُسحب حتى الكتف ثم يُدفع للوجه
    L2: strike(g, {
      w: { px: -1.6, py: -10.6, pl: -0.08, cb: -0.16, ht: -0.12, tw: -0.5, fh: [0.2, -16.8], wa: -0.22 },
      c: { px: 3, py: -10.4, pl: 0.18, cb: 0.06, ht: -0.1, tw: 0.4, fa: [0.06, 1], wa: -0.2, ff: [8, GROUND] },
      f: { px: 3.2, fa: [0.04, 1] },
      r: { px: 0.8, fh: [5.6, -15.6], wa: -0.16 } }),
    // L3 طعنة منخفضة بخطوة عميقة: الركبة الأمامية تنثني والرمح يمتد نحو البطن
    L3: strike(g, {
      w: { px: -0.8, py: -9.4, pl: 0.1, cb: 0.06, ht: 0, tw: -0.4, fh: [1.6, -12.8], wa: 0.08 },
      c: { px: 4.4, py: -8.2, pl: 0.3, cb: 0.12, ht: -0.08, tw: 0.45, fa: [0.72, 1], wa: 0.06, ff: [10.4, GROUND], bf: [-4.6, GROUND] },
      f: { px: 4.6, fa: [0.72, 1] },
      r: { px: 2, py: -9.2, fh: [7, -13.4], ff: [7.6, GROUND], bf: [-5, GROUND] } }),
    // H1 طعنة بكامل الجسد: الرمح يُسحب بعيداً للخلف والجسد يلتف، ثم يندفع بخطوة طويلة
    H1: strike(g, {
      w0: { px: -1.4, pl: -0.1, cb: -0.12, fh: [0.4, -14.6], wa: -0.18 },
      w: { px: -2.6, py: -10.8, pl: -0.22, cb: -0.24, ht: -0.16, tw: -0.8, fh: [-2.4, -15.4], wa: -0.26, ff: [4.6, GROUND], bf: [-6, GROUND] },
      c: { px: 5, py: -9.4, pl: 0.36, cb: 0.12, ht: 0.04, tw: 0.6, fa: [0.4, 1], wa: -0.02, ff: [11.6, GROUND], bf: [-3.2, GROUND] },
      f: { px: 5.4, fa: [0.4, 1] },
      r: { px: 2.2, fh: [7.4, -14.4], ff: [7.8, GROUND], bf: [-4.6, GROUND] } }),
    // D طعنة راكضة: الرمح مسدد والجسد منحنٍ، ثم وثبة طويلة
    D: strike(g, {
      w: { px: 0.4, py: -9.8, pl: 0.3, cb: 0.16, ht: -0.14, tw: -0.3, fh: [2.4, -13.4], wa: -0.06, ff: [6, 0.5] },
      c: { px: 6.2, py: -10, pl: 0.32, cb: 0.12, ht: -0.06, tw: 0.5, fa: [0.38, 1], wa: -0.03, ff: [13, GROUND], bf: [-1.6, 0.2] },
      f: { px: 6.6, fa: [0.38, 1] },
      r: { px: 3, fh: [8, -14.2], ff: [9, GROUND], bf: [-3.4, GROUND] } })
  };
}

// ---- المطرقة: رفع بطيء فوق الكتف، ضربة قوسية ثقيلة بدوران الجذع والحوض منخفض، وتعافٍ أطول ----
{
  const g = GUARDS.hammer;
  N.hammer = {
    // L1 ضربة مائلة قصيرة من الكتف
    L1: strike(g, {
      w: { px: -0.6, pl: 0.02, cb: -0.18, ht: -0.1, tw: -0.6, fh: [-0.6, -19.6], wa: -2.4, bh: [3.2, -14.4] },
      c: { px: 2.2, py: -8.8, pl: 0.3, cb: 0.36, ht: 0.2, tw: 0.55, fa: [0.72, 0.96], wa: 0.45, bh: [-2.8, -11], ff: [7, GROUND] },
      f: { py: -8.6, fa: [0.95, 0.95], wa: 0.85 },
      r: { px: 1.2, fh: [6.4, -12], wa: -0.3, ff: [6, GROUND] } }),
    // L2 ضربة صاعدة عكسية: المطرقة تعود من أسفل الخصر للأعلى
    L2: strike(g, {
      w: { px: 0.2, py: -8.8, pl: 0.36, cb: 0.4, ht: 0.2, tw: 0.5, fh: [1.4, -9.2], wa: 2.3, bh: [-1.8, -11.6] },
      c: { px: 2, py: -9.8, pl: 0.1, cb: -0.04, ht: -0.16, tw: -0.5, fa: [-0.42, 0.96], wa: -0.7, bh: [-3.4, -12.4], ff: [6.8, GROUND] },
      f: { fa: [-0.78, 0.92], wa: -1.3 },
      r: { px: 0.8, fh: [5.8, -16.4], wa: -1.3 } }),
    // L3 ضربة أفقية واسعة بالتفاف
    L3: strike(g, {
      w: { px: -0.8, pl: 0.02, cb: -0.24, ht: -0.1, tw: -0.8, fh: [-4.6, -15], wa: 3, bh: [-2, -13.4] },
      c: { px: 2.4, py: -9, pl: 0.26, cb: 0.22, ht: 0.12, tw: 0.7, fa: [0.12, 0.97], wa: 0.1, bh: [-3, -11], ff: [7.6, GROUND] },
      f: { fa: [0.4, 0.95], wa: 0.6 },
      r: { px: 1.2, fh: [6.6, -13.4], wa: -0.4, ff: [6, GROUND] } }),
    // H1 رفع بطيء فوق الكتف ثم هوي قوسي ثقيل: الجذع يلتف والحوض ينخفض والقدم الأمامية تخطو
    H1: strike(g, {
      w0: { px: -0.8, py: -9.8, pl: 0, cb: -0.2, ht: -0.1, tw: -0.5, fh: [-1.6, -19.6], wa: -2.3, bh: [0.4, -17.4] },
      w: { px: -1.6, py: -10.6, pl: -0.2, cb: -0.46, ht: -0.36, tw: -0.9, fh: [-3.4, -25.2], wa: -2.6, bh: [-1.4, -22], ff: [4.2, GROUND] },
      c: { px: 3, py: -7.4, pl: 0.42, cb: 0.72, ht: 0.46, tw: 0.8, fa: [1.02, 1], wa: 1.3, bh: [5.6, -5], ff: [8.6, GROUND], bf: [-4.6, GROUND] },
      f: { py: -7.1, cb: 0.76, fa: [1.12, 1], wa: 1.4 },
      r: { px: 1.8, py: -8.2, pl: 0.32, cb: 0.5, fh: [8, -6.6], wa: 0.9, ff: [7, GROUND] } }, true),
    // D اندفاع بضربة كتف وتلويح: يصل منحنياً والمطرقة خلفه
    D: strike(g, {
      w: { px: 0.4, py: -9.2, pl: 0.4, cb: 0.26, ht: -0.24, tw: -0.7, fh: [-3.6, -12.4], wa: 2.6, bh: [4.4, -15.2], ff: [5.4, 0.5] },
      c: { px: 4.8, py: -9, pl: 0.34, cb: 0.28, ht: 0.12, tw: 0.6, fa: [0.32, 0.97], wa: 0.25, bh: [-3.8, -11.4], ff: [11, GROUND], bf: [-2.2, 0.3] },
      f: { px: 5.2, fa: [0.6, 0.95], wa: 0.6 },
      r: { px: 2.6, fh: [8.4, -12.6], wa: -0.3, ff: [8, GROUND], bf: [-3.6, GROUND] } })
  };
}

// ---- القبضات: لكمة، لكمة مزدوجة، خطاف، ضربة كتف، دفع، وضربة أرضية؛ دوران الورك والكتف واندفاع قصير ----
{
  const g = GUARDS.fists;
  N.fists = {
    // L1 لكمة مستقيمة باليد الأمامية (جاب) بخطوة قصيرة والكتف الأمامي يتقدم
    L1: strike(g, {
      w: { px: -0.4, pl: 0.06, cb: 0.02, tw: -0.2, fh: [4.4, -18], bh: [3.4, -18.8] },
      c: { px: 1.6, pl: 0.12, cb: 0.06, ht: 0.06, tw: -0.5, fa: [-0.06, 0.98], bh: [3.4, -18.6], ff: [5.8, GROUND] },
      f: { px: 1.8, fa: [-0.06, 1] },
      r: { px: 0.6, fh: [8, -18.4], ff: [4.6, GROUND] } }),
    // L2 لكمة مزدوجة: جاب سريع في الاستعداد ثم لكمة خلفية قوية بدوران الورك والكتف (الضرر مع الثانية)
    L2: [[0, g],
      [0.14, S(g, { px: 1.2, pl: 0.12, cb: 0.06, tw: -0.5, fa: [-0.06, 0.95], ff: [5, GROUND] }), 'in'],
      [0.24, S(g, { px: 0.5, pl: 0.08, cb: 0.04, tw: -0.6, fh: [6, -18.4], bh: [2.6, -18.4], ff: [5, GROUND] }), 'out'],
      [0.34, S(g, { px: -0.2, pl: 0.04, cb: 0, ht: 0.04, tw: -0.8, fh: [6.2, -18.6], bh: [1.6, -18.2], ff: [5, GROUND] }), 'out'],
      [0.40, S(g, { px: 2.2, pl: 0.18, cb: 0.08, ht: 0.1, tw: 1, fh: [6.4, -18.6], ba: [-0.05, 1], ff: [6.4, GROUND], bf: [-3.6, GROUND] }), 'in'],
      [0.47, S(g, { px: 2.4, pl: 0.2, cb: 0.08, ht: 0.1, tw: 1, fh: [6.6, -18.6], ba: [-0.05, 1], ff: [6.4, GROUND], bf: [-3.6, GROUND] }), 'out'],
      [0.53, S(g, { px: 2.4, pl: 0.2, cb: 0.08, ht: 0.1, tw: 1, fh: [6.6, -18.6], ba: [-0.05, 1], ff: [6.4, GROUND], bf: [-3.6, GROUND] })],
      [0.74, S(g, { px: 0.8, tw: 0.3, bh: [6, -18.8], ff: [4.6, GROUND] })], [1, g]],
    // L3 خطاف: قوس أفقي باليد الأمامية مع التفاف الجذع كله والوزن على القدم الأمامية
    L3: strike(g, {
      w: { px: -0.4, pl: 0.04, cb: -0.06, ht: 0.04, tw: -0.9, fh: [1.8, -17.4], bh: [3.4, -19] },
      c: { px: 2, py: -9.6, pl: 0.18, cb: 0.14, ht: 0.14, tw: 0.9, fa: [-0.22, 0.82], bh: [2.6, -18.4], ff: [5.8, GROUND] },
      f: { px: 2.2, tw: 1, fa: [-0.4, 0.75] },
      r: { px: 0.8, tw: 0.3, fh: [7.4, -18.8], ff: [4.6, GROUND] } }),
    // H1 ضربة كتف: انخفاض ثم اندفاع بالكتف والقبضتان مضمومتان
    H1: strike(g, {
      w0: { px: -0.6, py: -9.2, pl: 0.16, cb: 0.18, tw: -0.4, fh: [4.6, -16.4], bh: [2.6, -17.6] },
      w: { px: -1.4, py: -8.6, pl: 0.26, cb: 0.28, ht: -0.1, tw: -0.8, fh: [2.8, -14.6], bh: [0.6, -15.8], ff: [4, GROUND], bf: [-5, GROUND] },
      c: { px: 4.4, py: -8.8, pl: 0.5, cb: 0.3, ht: 0.3, tw: 0.5, fh: [7.4, -14.4], bh: [4.8, -15.6], ff: [9.6, GROUND], bf: [-2.4, GROUND] },
      f: { px: 4.8, pl: 0.54 },
      r: { px: 2, py: -9.4, pl: 0.28, fh: [6.6, -17], bh: [4, -18], ff: [6.6, GROUND], bf: [-3.6, GROUND] } }),
    // D لكمة اندفاع: يقفز من الركض بلكمة طائرة باليد الخلفية
    D: strike(g, {
      w: { px: 0.4, py: -9.2, pl: 0.36, cb: 0.2, ht: -0.16, tw: -0.6, fh: [5, -17], bh: [-1.4, -15.6], ff: [5.2, 0.5] },
      c: { px: 5.4, py: -10.6, pl: 0.26, cb: 0.1, ht: 0.06, tw: 0.9, fh: [6.8, -17.8], ba: [-0.08, 1], ff: [11.2, -0.4], bf: [-0.8, -1.2] },
      f: { px: 5.8, ba: [-0.08, 1] },
      r: { px: 2.8, py: -9.8, tw: 0.2, bh: [7, -18.8], ff: [8.4, GROUND], bf: [-2.6, GROUND] } }),
    // S1 (اللفّة عند القبضات) ضربة أرضية: قفزة صغيرة ثم القبضتان تهويان إلى الأرض فتهزها
    S1: [[0, g],
      [0.2, S(g, { py: -8.4, pl: 0.3, cb: 0.3, ht: -0.1, fh: [5, -15], bh: [3.4, -15.6] }), 'out'],
      [0.34, S(g, { px: 0.6, py: -12.2, pl: -0.1, cb: -0.36, ht: -0.4, tw: 0, fh: [3, -27.4], bh: [0.6, -27], tf: 0.9, kf: 1.5, tb: -0.4, kb: 1.4, air: 1 }), 'out'],
      [0.40, S(g, { px: 2.4, py: -4.6, pl: 0.5, cb: 0.65, ht: 0.4, tw: 0.2, fh: [9.4, -2.6], bh: [8, -2.2], ff: [6.4, GROUND], bf: [-4.6, GROUND] }), 'in'],
      [0.53, S(g, { px: 2.4, py: -4.4, pl: 0.52, cb: 0.66, ht: 0.42, tw: 0.2, fh: [9.4, -2.4], bh: [8, -2], ff: [6.4, GROUND], bf: [-4.6, GROUND] })],
      [0.76, S(g, { px: 1, py: -8.2, pl: 0.32, cb: 0.32, fh: [7, -12], bh: [5, -13], ff: [5, GROUND] })], [1, g]],
    // KF (الركلة الأمامية عند القبضات) دفعة باليدين: صدر للأمام والذراعان تمتدان معاً
    KF: strike(g, {
      w: { px: -1, py: -9.6, pl: 0.04, cb: -0.04, tw: 0, fh: [4.8, -16.6], bh: [3.2, -16.2], ff: [3.8, GROUND] },
      c: { px: 3.2, py: -9.4, pl: 0.26, cb: 0.12, ht: 0.1, fa: [0.12, 0.96], ba: [0.16, 1], ff: [7.6, GROUND], bf: [-3.4, GROUND] },
      f: { px: 3.4, fa: [0.12, 0.98], ba: [0.16, 1] },
      r: { px: 1.4, fh: [8, -17.6], bh: [6, -17.4], ff: [5.6, GROUND] } })
  };
}

// ---- الدرع: ضرب بحافة الدرع ودفع وضربة كتف خلفه ----
{
  const g = GUARDS.shield;
  N.shield = {
    // L1 ضربة بحافة الدرع للأمام
    L1: strike(g, {
      w: { px: -0.8, pl: 0.1, cb: 0.1, tw: -0.4, fh: [3.4, -14.8] },
      c: { px: 2.2, pl: 0.2, cb: 0.16, ht: 0.3, tw: 0.4, fa: [0.24, 0.96], ff: [6.6, GROUND] },
      f: { px: 2.4, fa: [0.24, 0.98] },
      r: { px: 1, fh: [7.6, -15], ff: [5.6, GROUND] } }),
    // L2 دفعة بالدرع والجسد خلفه بخطوة كاملة
    L2: strike(g, {
      w: { px: -1.2, py: -9.2, pl: 0.2, cb: 0.2, tw: -0.5, fh: [3.6, -13.8], bh: [1.4, -12.4] },
      c: { px: 3.4, py: -9.4, pl: 0.3, cb: 0.2, ht: 0.36, tw: 0.5, fa: [0.26, 0.86], bh: [5.6, -13.6], ff: [8.6, GROUND], bf: [-3.6, GROUND] },
      f: { px: 3.6 },
      r: { px: 1.6, fh: [8, -14.6], ff: [6.4, GROUND] } }),
    // L3 ضربة صاعدة بحافة الدرع: انخفاض والدرع منخفض، ثم يُرفع للأمام والأعلى بخطوة
    L3: strike(g, {
      w: { px: -0.6, py: -8.8, pl: 0.3, cb: 0.3, ht: 0.3, tw: -0.4, fh: [4.6, -11.6], bh: [1.4, -11.8], ff: [4, GROUND] },
      c: { px: 2.6, py: -10, pl: 0.14, cb: 0.02, ht: 0.12, tw: 0.4, fa: [-0.5, 0.95], ff: [7.2, GROUND] },
      f: { px: 2.8, fa: [-0.7, 0.95] },
      r: { px: 1.2, fh: [7.4, -15.6], ff: [5.8, GROUND] } }),
    // H1 ضربة الدرع النازلة: يُرفع الدرع ويهوي بحافته
    H1: strike(g, {
      w0: { py: -10.4, pl: 0.04, cb: -0.1, fh: [5.4, -20.6] },
      w: { px: -0.8, py: -11.2, pl: -0.1, cb: -0.3, ht: -0.2, tw: -0.5, fh: [4.6, -25], bh: [0, -17] },
      c: { px: 2.8, py: -8, pl: 0.4, cb: 0.46, ht: 0.4, tw: 0.4, fa: [0.86, 0.96], bh: [4.6, -9.6], ff: [8, GROUND] },
      f: { py: -7.8, fa: [0.96, 0.96] },
      r: { px: 1.4, py: -9, fh: [8, -12.6], ff: [6, GROUND] } }),
    // D اندفاع بالدرع
    D: strike(g, {
      w: { px: 0.4, py: -9.2, pl: 0.36, cb: 0.24, ht: 0.1, tw: -0.4, fh: [6, -13.6], ff: [5.6, 0.5] },
      c: { px: 5.4, py: -9.4, pl: 0.36, cb: 0.2, ht: 0.36, tw: 0.4, fa: [0.26, 0.86], bh: [7, -13], ff: [11.4, GROUND], bf: [-2, 0.3] },
      f: { px: 5.8 },
      r: { px: 2.8, fh: [9, -14.8], ff: [8.4, GROUND], bf: [-3.4, GROUND] } })
  };
  // الخاصة (الدفعة) والركلة الأمامية عند الدرع: اندفاع بالكتف خلف الدرع
  N.shield.KF = N.shield.D;
}

// ---- الرامي: يضرب بما في يده ضربات قصيرة ----
{
  const g = GUARDS.ranged;
  N.ranged = {
    L1: strike(g, {
      w: { px: -0.4, pl: 0.06, cb: -0.16, ht: -0.08, tw: -0.5, fh: [-0.4, -16.6], wa: -2.4, bh: [4, -17.6] },
      c: { px: 2, pl: 0.22, cb: 0.26, ht: 0.14, tw: 0.4, fa: [0.42, 0.95], wa: 0.3, bh: [-2, -14], ff: [6.2, GROUND] },
      f: { fa: [0.66, 0.95], wa: 0.6 },
      r: { px: 1, fh: [6.6, -13.4], wa: -0.4, ff: [5.2, GROUND] } }),
    L2: strike(g, {
      w: { px: 0.2, pl: 0.26, cb: 0.26, ht: 0.1, tw: 0.5, fh: [1.6, -10.6], wa: 2.2, bh: [0.4, -15] },
      c: { px: 1.8, pl: 0.12, cb: 0, ht: -0.12, tw: -0.4, fa: [-0.42, 0.95], wa: -0.6, bh: [-2.4, -14], ff: [6, GROUND] },
      f: { fa: [-0.72, 0.92], wa: -1.1 },
      r: { px: 0.8, fh: [6, -15.6], wa: -1 } }),
    L3: strike(g, {
      w: { px: -0.6, py: -9.2, pl: 0.26, cb: 0.16, tw: -0.4, fh: [2, -12.4], wa: -0.2, bh: [4, -17] },
      c: { px: 3.4, py: -9.6, pl: 0.3, cb: 0.12, ht: 0.04, tw: 0.4, fa: [0.08, 1], wa: -0.1, bh: [-2.4, -14], ff: [8.4, GROUND] },
      f: { px: 3.6, fa: [0.08, 1] },
      r: { px: 1.6, fh: [7.6, -13.8], ff: [6, GROUND] } }),
    H1: strike(g, {
      w: { py: -11.2, pl: -0.12, cb: -0.36, ht: -0.3, tw: -0.5, fh: [-0.8, -25], wa: -2.1, bh: [3.6, -20] },
      c: { px: 2.8, py: -8.4, pl: 0.36, cb: 0.56, ht: 0.36, tw: 0.4, fa: [0.88, 1], wa: 1.1, bh: [-2.2, -12], ff: [7.8, GROUND] },
      f: { fa: [1.02, 1], wa: 1.3 },
      r: { px: 1.4, py: -9.2, fh: [7, -11], wa: 0.2, ff: [5.8, GROUND] } }),
    D: strike(g, {
      w: { px: 0.4, py: -9.4, pl: 0.4, cb: 0.24, ht: -0.24, tw: -0.5, fh: [-2.4, -12], wa: 0.1, bh: [4.6, -16.6], ff: [5.4, 0.5] },
      c: { px: 5, py: -9.8, pl: 0.34, cb: 0.14, ht: -0.06, tw: 0.4, fa: [0.06, 1], wa: -0.1, bh: [-3.6, -12.4], ff: [11.4, GROUND], bf: [-1.8, 0.3] },
      f: { px: 5.4, fa: [0.06, 1] },
      r: { px: 2.8, fh: [8.6, -13.6], ff: [8, GROUND], bf: [-3.2, GROUND] } })
  };
}

/* ===================== حركات مشتركة بنَفَس كل سلاح =====================
   اللكمة والركلتان من المرجع (ATK في anim.js) بجسدها وساقيها، ومن وقفة السلاح وإليها، واليد الحاملة للسلاح مضمومة.
   والخاصة حسب ما تملكه الوحدة: لفّة (spin) أو ركلة عالية بلفّة (kick_high) أو دفعة (kick_front)،
   ورابعة القائد L4 لفّة بركلة، وإنهاؤه F قفزة بضربة من فوق الرأس */
const BODY_KEYS = ['px', 'py', 'pl', 'cb', 'ht', 'hdx', 'hdy', 'tf', 'kf', 'tb', 'kb', 'bh'];
function fromRef(keys, g, tuck, extra = {}) {
  return keys.map(([t, k], i) => {
    if (i === 0 || i === keys.length - 1) return [t, g];
    const o = {};
    for (const n of BODY_KEYS) o[n] = k[n];
    return [t, Object.assign(S(g, o), tuck, extra)];
  });
}

for (const [name, g] of Object.entries(GUARDS)) {
  const n = N[name], tuck = TUCK[name];
  n.P = fromRef(ATK.punch, g, tuck, { tw: 0.9 });
  if (!n.KF) n.KF = fromRef(ATK.kick_front, g, tuck);
  n.KH = fromRef(ATK.kick_high, g, tuck);
  // الخاصة بالركلة العالية: لفّة نصف دائرة في الاستعداد (الوجه للخلف، flip) ثم الركلة
  n.SKH = n.KH;
  // الخاصة بالدفعة: اندفاع الأسلوب نفسه
  n.SKF = n.KF;
  // الخاصة باللفّة: لفّة المرجع بسلاح هذا الأسلوب (للقبضات ضربة أرضية)
  if (!n.S1) n.S1 = fromRefSpin(g);
  if (!n.L3) n.L3 = n.L1;
  // L4 للقائد: لفّة بركلة خلفية عالية والسلاح يلحقها
  n.L4 = n.SKH;
  // F إنهاء القائد: قفزة عالية ثم ضربة الأسلوب القوية بوقع أشد
  n.F = finisher(g, n.H1);
}

function fromRefSpin(g) {
  const keys = ATK.spin;
  return keys.map(([t, k], i) => {
    if (i === 0 || i === keys.length - 1) return [t, g];
    const o = {};
    for (const n of ['px', 'py', 'pl', 'cb', 'ht', 'tf', 'kf', 'tb', 'kb', 'fh', 'bh', 'wa']) o[n] = k[n];
    return [t, S(g, o)];
  });
}

// قفزة ثم هوي: الاستعداد ركوع وقفز (air)، والارتطام وضعية H1 بانخفاض أعمق
function finisher(g, h1) {
  const hit = h1[h1.findIndex(k => k[0] === 0.40)][1], top = h1[h1.findIndex(k => k[0] === 0.34)][1];
  return [[0, g],
    [0.16, S(g, { py: -7.6, pl: 0.4, cb: 0.36, ht: -0.1, fh: [4, -12], bh: [2, -11] }), 'out'],
    [0.34, Object.assign(S(top, { px: 1.4, py: -15.4 }), { tf: 0.9, kf: 1.6, tb: -0.2, kb: 1.5, air: 1 }), 'out'],
    [0.40, S(hit, { py: hit.py + 0.8, cb: hit.cb + 0.08 }), 'in'],
    [0.53, S(hit, { py: hit.py + 1, cb: hit.cb + 0.1 })],
    [0.76, S(g, { px: 1.4, py: g.py + 0.6, pl: 0.3, cb: 0.3 })], [1, g]];
}

// العقد التي تُلفّ فيها الوحدة نصف دائرة (الوجه للخلف) بين لحظتين من الخط الزمني (لفّة القبضات ضربة أرضية بلا لفّ)
const FLIP = { S1: [0.35, 0.42], SKH: [0.16, 0.3], L4: [0.16, 0.3] };

// الطرف الضارب في كل عقدة (لأثره وشرره): w السلاح، fh اليد الأمامية، bh الخلفية، leg الرجل الأمامية، null بلا أثر
const STRIKER = {
  fists: { L1: 'fh', L2: 'bh', L3: 'fh', L4: 'leg', H1: null, D: 'bh', S1: 'fh', SKF: 'fh', KF: 'fh', F: 'fh' },
  shield: { L1: 'fh', L2: 'fh', L3: 'fh', H1: 'fh', D: 'fh', F: 'fh', KF: 'fh', SKF: 'fh' }
};
const STRIKER_ALL = { P: 'bh', KF: 'leg', KH: 'leg', SKH: 'leg', L4: 'leg' };

/* ===================== العضو الضخم =====================
   نفس الحركات بثقل: الحوض أخفض والوقفة أعرض، والاستعداد يبلغ قمته مبكراً ويتمهّل فيها، والامتداد بعد الارتطام
   يبقى أطول ثم يعود متأخراً (تعافٍ أثقل). الأزمنة الحقيقية كما هي: هذا تشكيل للخط الزمني نفسه */
function bigPose(p) {
  return Object.assign({}, p, { py: p.py + 0.5, pl: p.pl * 1.08, cb: p.cb * 1.1, tf: p.tf * 1.06, tb: p.tb * 1.06 });
}
const BIG = {};
for (const [name, n] of Object.entries(N)) {
  BIG[name] = {};
  for (const [node, keys] of Object.entries(n)) BIG[name][node] = keys.map(([t, p, e]) => [t, bigPose(p), e]);
}
const BIG_GUARD = {};
for (const [name, g] of Object.entries(GUARDS)) BIG_GUARD[name] = bigPose(g);
// تشكيل الزمن للضخم: قمة الاستعداد عند 0.26 ثم ثبات، والامتداد يبقى حتى 0.66 ثم عودة بطيئة
function bigTime(a) {
  if (a < 0.34) return Math.min(0.34, a * 0.34 / 0.26);
  if (a < 0.53) return a;
  if (a < 0.66) return 0.53;
  return 0.53 + (a - 0.66) / 0.34 * 0.47;
}

// العقدة التي تُرسم: الخاصة حسب الحركة الفعلية (لفّة، ركلة عالية، دفعة)
function nodeKey(node, move) {
  if (node === 'S1') return move === 'kick_high' ? 'SKH' : move === 'kick_front' ? 'SKF' : 'S1';
  return node;
}

// الوضعية في العقدة عند التقدم a من الخط الزمني القياسي
export function nodePose(style, node, move, a, big) {
  const key = nodeKey(node, move), set = (big ? BIG : N)[style] || N.blade;
  const keys = set[key] || set.L1;
  return keyAt(keys, big ? bigTime(a) : a);
}

// هل تُلفّ الوحدة (الوجه للخلف) في هذه اللحظة من العقدة
export function nodeFlip(style, node, move, a) {
  const key = nodeKey(node, move), f = FLIP[key];
  return !!f && a > f[0] && a < f[1] && !(style === 'fists' && key === 'S1');
}

// الطرف الضارب: 'w' أو 'fh' أو 'bh' أو 'leg' أو null
export function nodeStriker(style, node, move) {
  const key = nodeKey(node, move), own = STRIKER[style];
  if (own && key in own) return own[key];
  return STRIKER_ALL[key] || 'w';
}

// وقفة القتال بالسلاح مع تنفس خفيف (والقبضات بقفزة ملاكم، والضخم أبطأ)
export function guardPose(style, t, big) {
  const g = (big ? BIG_GUARD : GUARDS)[style] || GUARDS.blade;
  const fists = style === 'fists', w = big ? 2.6 : fists ? 6.2 : 3.8, b = Math.sin(t * w);
  return Object.assign({}, g, {
    py: g.py + b * (fists ? 0.45 : 0.25), cb: g.cb + b * 0.035, ht: g.ht - b * 0.03,
    fh: [g.fh[0] + Math.sin(t * w * 0.5) * 0.3, g.fh[1] + b * 0.35], bh: [g.bh[0], g.bh[1] + b * 0.3]
  });
}

// المشي في القتال بذراعي وقفة السلاح (الساقان من poseWalk)
export function walkArms(p, style, t, big) {
  const g = (big ? BIG_GUARD : GUARDS)[style] || GUARDS.blade, s = Math.sin(t * 6);
  p.fh = [g.fh[0] - 0.6 + s * 0.6, g.fh[1] + 0.8]; p.bh = [g.bh[0] - 0.4, g.bh[1] + 0.6 - s * 0.4]; p.wa = g.wa; p.tw = 0;
  return p;
}

/* ===================== التجمّد عند الارتطام =====================
   T زمن الحركة الحقيقي، ph أزمنتها، hit لحظة الضرر، hs التجمّد: يتوقف الضارب على وضعية الارتطام hs ثانية، ثم يُكمل
   الباقي أسرع قليلاً فينتهي في وقته تماماً. يعيد الزمن المرسوم */
export function hitstopTime(T, ph, hs) {
  const hit = ph.wind + ph.strike * CR.strikeMoment, end = ph.total;
  hs = Math.min(hs, (end - hit) * 0.6);
  if (T <= hit) return T;
  if (T < hit + hs) return hit;
  return hit + (T - hit - hs) * (end - hit) / (end - hit - hs);
}

/* ===================== أثر الارتطام في العالم ===================== */
// نوع أثر الارتطام حسب سلاح الضارب: 'slash' ومضة قوس سريعة (السكين والسيف)، 'pierce' خط سرعة (الرمح)،
// 'smash' نجمة وغبار (القبضات والدرع والمطرقة الخفيفة واللكمات والركلات)، 'quake' وميض قوي وغبار واهتزاز أرض
// (ضربة المطرقة القوية والخاصة، والعضو الضخم، وضربة القبضات الأرضية، والإنهاء)، 'star' النجمة القديمة (الصقر)
const HEAVY_NODE = { H1: 1, S1: 1, F: 1, D: 1 }, UNARMED_NODE = { P: 1, KF: 1, KH: 1 };
export function impactKind(fx) {
  const s = fx.style, n = fx.node;
  if (!s) return 'star';
  if (fx.echo) return 'smash';
  if (n === 'F' || (s === 'fists' && n === 'S1') || (HEAVY_NODE[n] && (s === 'hammer' || fx.bigA)) || (fx.bigA && n === 'KF')) return 'quake';
  if (UNARMED_NODE[n] || s === 'fists' || s === 'shield' || s === 'hammer') return 'smash';
  return s === 'spear' ? 'pierce' : 'slash';
}

/* ===================== ردود الأفعال ===================== */
// الإصابة الخفيفة حسب سلاح الضارب: الطعنة تثني المصاب على بطنه، والضربة الثقيلة تثني ركبتيه، والباقي ارتداد الرأس
const STAB = { knife: { L1: 1, L3: 1, D: 1 }, spear: { L1: 1, L2: 1, L3: 1, H1: 1, D: 1, F: 1 }, blade: { D: 1 }, ranged: { L3: 1, D: 1 } };
const BLUNT = { hammer: 1, shield: 1 };
export function hitKind(style, node) {
  if (STAB[style] && STAB[style][node]) return 'stab';
  if (BLUNT[style] || node === 'H1' || node === 'F') return 'blunt';
  return 'snap';
}
// f من 0 إلى 1 (منحنى الارتداد)، k: 'stab' | 'blunt' | 'snap'، heavy: المصاب ضخم فيرتد أقل
export function flinchPose(p, f, fromBack, k, heavy) {
  const s = fromBack ? -1 : 1, m = heavy ? 0.6 : 1;
  p = Object.assign({}, p);
  if (k === 'stab') {             // انثناء على البطن واليدان إليه
    f *= m;
    p.px -= 1.6 * f * s; p.pl -= 0.1 * f; p.cb += 0.62 * f; p.ht += 0.5 * f; p.py += 0.7 * f;
    p.fh = [p.fh[0] - 2.6 * f, p.fh[1] + 3.4 * f]; p.bh = [p.bh[0] + 1.6 * f, p.bh[1] + 4.2 * f];
    p.tf += 0.3 * f; p.kf += 0.5 * f;
    return p;
  }
  if (k === 'blunt') {            // الركبتان تنثنيان والرأس يهتز للأسفل والذراعان للخارج
    f *= m;
    p.px -= 1.8 * f * s; p.py += 1.6 * f; p.cb -= 0.3 * f * s; p.ht += 0.4 * f;
    p.fh = [p.fh[0] + 1.6 * f, p.fh[1] - 2 * f]; p.bh = [p.bh[0] - 3.6 * f, p.bh[1] - 1.6 * f];
    p.tf += 0.25 * f; p.kf += 0.7 * f; p.kb += 0.6 * f;
    return p;
  }
  f *= m;                          // ارتداد الرأس للخلف (addFlinch في المرجع)
  p.cb -= 0.72 * f * s; p.pl -= 0.2 * f * s; p.ht -= 0.95 * f * s; p.px -= 2.2 * f * s; p.py += 0.4 * f;
  p.fh = [p.fh[0] - 2.4 * f, p.fh[1] - 3 * f]; p.bh = [p.bh[0] - 3.2 * f, p.bh[1] - 4 * f];
  p.tf += 0.75 * f; p.kf += 0.95 * f;
  return p;
}

// الارتداد بقوة (Knockback): ينزلق للخلف منحنياً على بطنه، والقدمان تجرّان، والذراعان للأمام. k من 0 إلى 1
const KNOCK = S(G0, { px: -1.4, py: -9, pl: -0.18, cb: 0.5, ht: 0.46, fh: [6.6, -12.6], bh: [4.4, -11.6], ff: [5.2, GROUND], bf: [-2.6, GROUND] });
export function knockPose(p, k) { return mixPose(p, KNOCK, k); }

// الموت على الظهر (ضربة من الأمام) وعلى الوجه (من الخلف): وضعيات على زمن السقوط e بالثواني
const DEATH_BACK = [
  [0, S(G0, { px: -1.2, py: -10.6, pl: -0.25, cb: -0.45, ht: -0.6, fh: [6, -22], bh: [-4, -21], wa: -2.2, ff: [3.6, GROUND], bf: [-4.4, GROUND] })],
  [0.22, S(G0, { px: -1.6, py: -7.8, pl: -0.06, cb: -0.2, ht: -0.32, fh: [5.4, -16], bh: [-5, -14], wa: -1.2, ff: [3.4, GROUND], bf: [-4, GROUND] })],
  [0.5, P({ py: -9, pl: 0.3, cb: 0.55, ht: 0.65, fh: [4, -3], bh: [-2, -3], wa: 1.3, tf: 0.55, kf: 1.0, tb: -0.45, kb: 1.0 })],
  [0.62, P({ py: -9, pl: 0.36, cb: 0.62, ht: 0.8, fh: [3, -2], bh: [-1, -2.6], wa: 1.4, tf: 0.4, kf: 0.8, tb: -0.5, kb: 0.9 })]
];
const DEATH_FRONT = [
  [0, S(G0, { px: 1.2, py: -10.2, pl: 0.34, cb: 0.66, ht: 0.55, fh: [3, -10.6], bh: [-5.4, -12.4], wa: 0.6, ff: [4, GROUND], bf: [-4, GROUND] })],
  [0.26, S(G0, { px: 0.8, py: -5.6, pl: 0.3, cb: 0.4, ht: 0.3, fh: [6.4, -6], bh: [3.6, -5.6], wa: 1.2, ff: [5.4, GROUND], bf: [-4, GROUND] })],
  [0.52, P({ px: 0.6, py: -6, pl: 0.18, cb: 0.2, ht: -0.2, fh: [6, -16], bh: [4, -15], wa: -1, tf: 1.4, kf: 2.2, tb: 0.9, kb: 2.2 })],
  [0.62, P({ px: 0.6, py: -6, pl: 0.12, cb: 0.12, ht: -0.3, fh: [7, -17], bh: [5, -16], wa: -1.1, tf: 1.4, kf: 2.2, tb: 0.9, kb: 2.2 })]
];
export function deathPose(front, e) { return keyAt(front ? DEATH_FRONT : DEATH_BACK, e); }
// زاوية الجسد كله ونقطة دورانه: يميل بعد الارتداد ثم يرتطم بالأرض ويرتد قليلاً
export function deathTilt(front, e) {
  const start = front ? 0.24 : 0.16, k = ease(Math.min(1, Math.max(0, (e - start) / 0.34)));
  const land = e - start - 0.34, bounce = land > 0 ? Math.sin(land * 22) * 0.07 * Math.max(0, 1 - land * 4) : 0;
  return (front ? 1 : -1) * (k * 1.5708 - bounce);
}

/* ===================== مزج الوضعيات (لا قفزة إلى الوقفة) =====================
   لكل وحدة آخر وضعية رُسمت؛ إن تبدّل مصدر الوضعية (بداية ضربة، العودة للوقفة، رد فعل) تُمزج القديمة بالجديدة */
const MEM = new WeakMap();
export function blendPose(unit, src, pose, t, dur) {
  let m = MEM.get(unit);
  if (!m) { MEM.set(unit, m = { src, from: null, t0: 0, dur: 0, last: pose }); return pose; }
  if (m.src !== src) {
    m.from = m.last; m.t0 = t; m.dur = dur; m.src = src;
  }
  let out = pose;
  if (m.from && t - m.t0 < m.dur && t >= m.t0) out = mixPose(m.from, pose, ease((t - m.t0) / m.dur));
  else m.from = null;
  m.last = out;
  return out;
}
