// تأثير الطقس على اللعب: الرصد ليلاً، السرعة في الثلج، ودقة الرمي في المطر
import { WEATHER } from '../config.js';
import { empireSpeedMul } from './empire.js';
import { random } from './random.js';   // عشوائية المنطق: مشتركة بين الأجهزة في اللعب المحلي

// مدى رصد الوحدة بعد تأثير الطقس (ليلاً × 0.75)
// رماة الهوارانغ (سمة كوريا، القسم 3.10) لا يتأثرون بالليل
export function visionRange(state, unit) {
  if (unit.stats.weatherProof) return unit.stats.visionRange;
  return unit.stats.visionRange * WEATHER[state.weather].visionMul;
}

// سرعة الوحدة بعد تأثير الطقس (ثلجاً × 0.85) وبعد الإبطاء من الضربة الأرضية
export function moveSpeed(state, unit) {
  // traits.spd: تنويع بسيط بين الأفراد (القسم 5.4) فلا تسير الصفوف كآلة واحدة
  let speed = unit.stats.speed * WEATHER[state.weather].speedMul * (unit.traits ? unit.traits.spd : 1);
  if (unit.hasteUntil > state.time) speed *= 1 + unit.hasteFactor;    // اندفاع ضربة بطل (القسم 3.10)
  if (state.economy) speed *= empireSpeedMul(state, unit.playerId);   // ترقية سرعة المشي
  if (unit.slowUntil > state.time) return speed * (1 - unit.slowFactor);
  return speed;
}

// هل تصيب الرمية؟ (مطراً 80%)، والضربة الخاطئة تسقط قرب الهدف بلا ضرر
// ورماة الهوارانغ لا يتأثرون بالمطر
export function rangedShotHits(state, unit) {
  if (unit && unit.stats.weatherProof) return true;
  const chance = WEATHER[state.weather].rangedHitChance;
  return chance >= 1 || random() < chance;
}
