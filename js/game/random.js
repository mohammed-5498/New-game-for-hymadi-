// الأرقام العشوائية لمنطق المباراة (القسم 16، اللعب المحلي): Math.random في اللعب العادي كما كان،
// وأثناء تحديث مباراة شبكية مولّدٌ ببذرة مخزّنة في حالة المباراة نفسها (state.netRand)، فتسحب كل الأجهزة
// نفس الأرقام بنفس الترتيب، وتنتقل البذرة مع الحالة عند إعادة المزامنة. الرسم والصوت يبقيان على Math.random
let source = null;     // الحالة التي يُسحب من بذرتها الآن، أو null

export function random() {
  if (!source) return Math.random();
  let t = (source.netRand = (source.netRand + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// تحديث المباراة الشبكية يجري بين هذين
export function seedFrom(state) { source = state; }
export function unseed() { source = null; }
