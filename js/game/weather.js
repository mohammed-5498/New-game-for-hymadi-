// تأثير الطقس على اللعب: الرصد ليلاً، السرعة في الثلج، ودقة الرمي في المطر
import { WEATHER } from '../config.js';

// مدى رصد الوحدة بعد تأثير الطقس (ليلاً × 0.75)
export function visionRange(state, unit) {
  return unit.stats.visionRange * WEATHER[state.weather].visionMul;
}

// سرعة الوحدة بعد تأثير الطقس (ثلجاً × 0.85)
export function moveSpeed(state, unit) {
  return unit.stats.speed * WEATHER[state.weather].speedMul;
}

// هل تصيب الرمية؟ (مطراً 80%)، والضربة الخاطئة تسقط قرب الهدف بلا ضرر
export function rangedShotHits(state) {
  const chance = WEATHER[state.weather].rangedHitChance;
  return chance >= 1 || Math.random() < chance;
}
