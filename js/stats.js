// الإحصائيات الدائمة (القائمة الرئيسية ← الإحصائيات): مجموع كل المباريات المنتهية
// تُحفظ في localStorage فتبقى بعد إغلاق اللعبة، في المتصفح وداخل التطبيق.
// تُسجَّل المباراة عند ظهور شاشة النهاية فقط؛ المتروكة في منتصفها وساحة التجربة لا تُحسب.
import { UI } from './config.js';

const EMPTY = {
  played: 0,
  wins: 0,
  losses: 0,
  kills: 0,            // أعداء قتلتهم
  unitsLost: 0,        // وحداتك التي ماتت
  bestDistricts: 0,    // أكبر عدد أحياء امتلكته في مباراة واحدة
  fastestWin: 0,       // أسرع فوز بالثواني (0 = لا فوز بعد)
  totalSeconds: 0      // مجموع زمن المباريات
};

// نقبل من التخزين الأرقام السليمة فقط، فلا تُفسد بيانات تالفة الشاشة
function clean(saved) {
  const stats = { ...EMPTY, gangs: {} };
  if (!saved || typeof saved !== 'object') return stats;
  for (const key of Object.keys(EMPTY)) {
    const value = saved[key];
    if (Number.isFinite(value) && value >= 0) stats[key] = value;
  }
  if (saved.gangs && typeof saved.gangs === 'object') {
    for (const [gang, count] of Object.entries(saved.gangs)) {
      if (Number.isFinite(count) && count > 0) stats.gangs[gang] = count;
    }
  }
  return stats;
}

export function loadStats() {
  try { return clean(JSON.parse(localStorage.getItem(UI.statsKey) || 'null')); }
  catch { return clean(null); }      // تخزين غير متاح أو تالف: نبدأ من الصفر
}

// result من victory.js: {won, duration, maxDistricts, kills, losses}، وgang عصابة اللاعب
export function recordMatch(result, gang) {
  const stats = loadStats();
  stats.played++;
  if (result.won) {
    stats.wins++;
    if (!stats.fastestWin || result.duration < stats.fastestWin) stats.fastestWin = result.duration;
  } else {
    stats.losses++;
  }
  stats.kills += result.kills || 0;
  stats.unitsLost += result.losses || 0;
  stats.bestDistricts = Math.max(stats.bestDistricts, result.maxDistricts || 0);
  stats.totalSeconds += result.duration || 0;
  if (gang) stats.gangs[gang] = (stats.gangs[gang] || 0) + 1;

  try { localStorage.setItem(UI.statsKey, JSON.stringify(stats)); } catch { /* لا تخزين: تضيع هذه المباراة فقط */ }
  return stats;
}

// العصابة التي لعبت بها أكثر من غيرها، أو null قبل أول مباراة
export function favoriteGang(stats) {
  let best = null;
  for (const [gang, count] of Object.entries(stats.gangs)) {
    if (!best || count > stats.gangs[best]) best = gang;
  }
  return best;
}
