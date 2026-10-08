// بديل Math.hypot لعددين، مطابق له بت ببت (نفس خوارزمية المحرك V8: التطبيع بالأكبر ثم جمع كاهان)،
// لكن بلا تخصيص ذاكرة: Math.hypot ينشئ مصفوفة داخلية في كل استدعاء، وآلاف الاستدعاءات في التحديث
// تملأ الذاكرة فيكثر جمع القمامة ويتقطع اللعب (المرحلة 8). فُحص على 4 ملايين حالة في Node وChromium.
export function hypot(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  const max = a > b ? a : b;
  if (max === Infinity) return Infinity;
  if (a !== a || b !== b) return NaN;
  if (max === 0) return 0;
  const n0 = a / max, n1 = b / max;
  const s0 = n0 * n0;
  const summand = n1 * n1 - ((s0 - 0) - s0);
  return Math.sqrt(s0 + summand) * max;
}
