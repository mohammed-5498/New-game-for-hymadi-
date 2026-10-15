/* مظاهر الأمم (القسم 3.10): سجل واحد لكل الأمم. كل وحدة = نمطها القتالي + إكسسوارات فوق drawBody
   (head وback وchest وrobe وover وweapon وfront وground كما في bodies.js). لون اللاعب يبقى لون الجسد،
   والهوية من غطاء الرأس وشكل الثوب والسلاح ولون ثانوي ثابت للأمة.
   لكل وحدة نسختان: الكاملة، والمبسّطة للمستوى المبسّط (القسم 5.4.5): الجسد وغطاء الرأس وشكل الثوب
   والسلاح فقط، بلا خطوط ولا نقوش صغيرة. */
import { BODIES } from './bodies.js';

// أمة ← نوع الوحدة (common، الشخصيتان المميزتان، champion) ← [مفتاح الكامل، مفتاح المبسّط] في BODIES
export const NATION_ART = {};

// تسجيل مظاهر أمة: units = { common: {full, lite}, boss: {full, lite}, ..., champion: {full, lite} }
// المفاتيح في BODIES: '<أمة>_<نوع>' و'<أمة>_<نوع>_lite'. نقاط الساقين لازمة لكل مظهر أمة (legs)
export function registerNation(id, units) {
  const art = {};
  for (const [kind, { full, lite }] of Object.entries(units)) {
    const key = id + '_' + kind;
    BODIES[key] = { legs: true, ...full };
    BODIES[key + '_lite'] = { legs: true, ...(lite || full) };
    art[kind] = [key, key + '_lite'];
  }
  NATION_ART[id] = art;
}

// مفتاح رسم وحدة الأمة حسب مستوى تفصيلها، أو null (عصابة كلاسيكية أو أمة بلا مظهر بعد)
export function nationArtKey(unit, kind) {
  const art = NATION_ART[unit.nation];
  if (!art) return null;
  const keys = art[kind] || art.common;
  return unit.lod === 'full' ? keys[0] : keys[1];
}
