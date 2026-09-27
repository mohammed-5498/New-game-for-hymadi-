// تفضيلات اللاعب البسيطة المحفوظة في localStorage (تعمل في المتصفح وداخل التطبيق)
// الأصوات لها حفظها الخاص في audio/sound.js؛ هنا ما سواها.
const KEY = 'gangcity.prefs';
const DEFAULTS = {
  pops: true              // الكلمات الطائرة فوق أحداث القتال (القسم 5.4.4ب): مفعّلة افتراضياً
};

let prefs = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  prefs = { ...DEFAULTS, ...saved };
} catch { /* تخزين غير متاح: نبقى على الافتراضي */ }

export const getPref = (name) => prefs[name];

export function setPref(name, value) {
  prefs[name] = value;
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* لا تخزين: يبقى للجلسة */ }
}
