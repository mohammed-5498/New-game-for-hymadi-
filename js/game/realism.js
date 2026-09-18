// القتال الواقعي (القسم 5.4): بذرة الشخصية، تنوع الحركات، وردود الأفعال.
// ليس ذكاءً اصطناعياً لكل وحدة، بل ثلاثة أنظمة برمجية رخيصة.
import { TICK_SEC, combatRealism as CR } from '../config.js';
import { onScreen } from './alerts.js';

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

// --- 5.4.1 بذرة الشخصية: قيم ثابتة لكل وحدة تُشتق من رقم واحد ---
// مولّد بسيط يعطي أرقاماً مختلفة ومستقرة من نفس البذرة
function fromSeed(seed, index) {
  const x = Math.sin(seed * 127.1 + index * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const between = (t, min, max) => min + t * (max - min);

export function personality(seed) {
  const s = CR.seed;
  return {
    boldness:   between(fromSeed(seed, 1), s.boldnessMin, s.boldnessMax),
    dodgeSkill: between(fromSeed(seed, 2), s.dodgeSkillMin, s.dodgeSkillMax),
    reaction:   between(fromSeed(seed, 3), s.reactionMin, s.reactionMax),
    speedScale: 1 + (fromSeed(seed, 4) * 2 - 1) * s.speedVariation,
    sizeScale:  1 + (fromSeed(seed, 5) * 2 - 1) * s.sizeVariation
  };
}

// --- حالات الوحدة اللحظية ---
export const isStaggered = (state, unit) => unit.staggerUntil > state.time;
// التعافي هو ما بعد وقوع الضربة، لا زمن الاستعداد قبلها:
// هنا تكون الوحدة مكشوفة فعلاً، وهنا تستحق الضربة القوية نقاطها
export const isRecovering = (state, unit) =>
  state.time >= unit.recoverFrom && state.time < unit.recoverUntil;
export const isDodging = (state, unit) => unit.dodgeUntil > state.time;
export const isBlocking = (state, unit) => unit.blockUntil > state.time;

// الوحدة المترنّحة لا تهاجم
export const canAct = (state, unit) => !isStaggered(state, unit);

export function updateStamina(unit) {
  if (unit.stamina >= CR.reaction.stamina) return;
  unit.stamina = Math.min(CR.reaction.stamina, unit.stamina + CR.reaction.staminaPerSecond * TICK_SEC);
}

// --- قاعدة الزاوية: من أين جاءت الضربة بالنسبة لاتجاه المدافع ---
export function attackAngle(defender, attacker) {
  const dx = attacker.x - defender.x, dy = attacker.y - defender.y;
  const toAttacker = Math.atan2(dy, dx);
  let diff = Math.abs(normalizeAngle(toAttacker - defender.faceAngle));
  const a = CR.angle;
  if (diff <= a.frontDegrees * RAD) return a.front;
  if (diff <= a.sideDegrees * RAD) return a.side;
  return a.back;
}

function normalizeAngle(angle) {
  let a = angle % TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}

// هل يرى المدافع مهاجمه؟ (داخل قوس 120 درجة أمامه)
export function sees(defender, attacker) {
  const dx = attacker.x - defender.x, dy = attacker.y - defender.y;
  const diff = Math.abs(normalizeAngle(Math.atan2(dy, dx) - defender.faceAngle));
  return diff <= (CR.reaction.visionArcDegrees / 2) * RAD;
}

// --- 5.4.2 اختيار الحركة بنظام نقاط ---
const hasSpin = (unit) =>
  (CR.spinUnits.champions && unit.champion) || CR.spinUnits.heroes.includes(unit.hero);

const canBlock = (unit) => {
  const b = CR.reaction.blockers;
  if (b.police && unit.gang === 'police') return true;
  if (unit.champion) return b.champions.includes(unit.gang);
  return b.heroes.includes(unit.hero);
};
export { canBlock, hasSpin };

// عدد الأعداء الملتحمين بالوحدة (للضربة الدائرية)
function crowdAround(state, unit, isEnemy, forEachNearby) {
  let n = 0;
  const r = CR.score.crowdRadius, r2 = r * r;
  forEachNearby(state, unit.x, unit.y, r, (other) => {
    if (other === unit || other.state === 'dead' || other.hp <= 0) return;
    const dx = other.x - unit.x, dy = other.y - unit.y;
    if (dx * dx + dy * dy > r2) return;
    if (isEnemy(state, unit, other)) n++;
  });
  return n;
}

// يختار الحركة حسب الموقف، مع 15% عشوائية حتى لا يصير السلوك مكشوفاً
export function chooseMove(state, unit, target, distance, range, helpers) {
  const S = CR.score;
  const scores = { quick: S.base.quick, heavy: S.base.heavy, thrust: S.base.thrust };
  if (hasSpin(unit)) scores.spin = S.base.spin;

  // الهدف في زمن تعافٍ: فرصة للضربة القوية
  if (isRecovering(state, target)) scores.heavy += S.targetRecovering;

  // الهدف أبعد قليلاً: خرج عن المدى العادي وما زال في متناول الطعنة
  if (distance > range && distance <= range + S.farGapTiles) scores.thrust += S.targetFarther;

  // ثلاثة أعداء أو أكثر حوله: دائرية
  if (scores.spin !== undefined &&
      crowdAround(state, unit, helpers.isEnemy, helpers.forEachNearby) >= S.crowdEnemies) {
    scores.spin += S.crowdBonus;
  }

  // دمه منخفض: ضربة سريعة حذرة
  if (unit.hp / unit.maxHp < S.lowHealthRatio) scores.quick += S.lowHealthBonus;

  // الجرأة ترفع القوية والدائرية
  const bold = (unit.boldness - 1) * S.boldnessWeight;
  scores.heavy += bold;
  if (scores.spin !== undefined) scores.spin += bold;

  let best = 'quick', bestScore = -Infinity;
  for (const key of Object.keys(scores)) {
    const value = scores[key] * (1 + (Math.random() * 2 - 1) * S.randomness);
    if (value > bestScore) { bestScore = value; best = key; }
  }
  return best;
}

// --- 5.4.3 ردود الأفعال ---
// المهاجم بدأ استعداده: إن رآه المدافع جدول رد فعله بعد زمن رد فعله
export function noticeAttack(state, defender, attacker) {
  if (!CR.enabled || defender.detail !== 'full') return;
  if (isStaggered(state, defender) || isRecovering(state, defender)) return;
  if (!sees(defender, attacker)) return;
  defender.reactAt = state.time + defender.reaction;
  defender.reactTo = attacker;
}

// يحاول التفادي أو الصدّ عند حلول زمن رد الفعل
export function tryReact(state, unit) {
  if (unit.reactAt < 0 || state.time < unit.reactAt) return;
  const attacker = unit.reactTo;
  unit.reactAt = -1;
  unit.reactTo = null;
  if (!attacker || attacker.state === 'dead') return;
  if (isStaggered(state, unit) || isRecovering(state, unit)) return;   // المترنّح لا يتفادى

  const R = CR.reaction;
  const angle = attackAngle(unit, attacker);
  if (angle.defense <= 0) return;                    // من الخلف: لا تفادي ولا صدّ أبداً

  // أصحاب الدروع يصدّون أولاً، وغيرهم يتفادى
  if (canBlock(unit) && unit.stamina >= R.blockCost &&
      Math.random() < R.blockChance * angle.defense) {
    unit.stamina -= R.blockCost;
    unit.blockUntil = state.time + R.blockSeconds;
    return;
  }

  if (state.time - unit.dodgeAt < R.dodgeCooldown) return;
  if (unit.stamina < R.dodgeCost) return;            // بلا تحمّل: يُجبر على تلقي الضرب
  if (Math.random() >= R.dodgeChance * unit.dodgeSkill * angle.defense) return;

  unit.stamina -= R.dodgeCost;
  unit.dodgeAt = state.time;
  unit.dodgeUntil = state.time + R.dodgeSeconds;
  unit.dodgeStart = state.time;
  hop(state, unit, attacker, R.dodgeDistance);
}

// قفزة للخلف أو للجانب بعيداً عن المهاجم (قد توقعه في مدى عدو آخر)
function hop(state, unit, attacker, distance) {
  const dx = unit.x - attacker.x, dy = unit.y - attacker.y;
  const length = Math.hypot(dx, dy) || 1;
  // نصف الوقت للجانب لا للخلف، فلا تتشابه القفزات
  const side = Math.random() < 0.5 ? 1 : -1;
  const toSide = Math.random() < 0.5;
  const ux = toSide ? -dy / length * side : dx / length;
  const uy = toSide ?  dx / length * side : dy / length;
  shove(state, unit, ux, uy, distance);
}

// يزحزح وحدة مسافة ما دام المربع موصولاً
export function shove(state, unit, ux, uy, distance) {
  const toX = unit.x + ux * distance, toY = unit.y + uy * distance;
  if (!state.map.isConnected(Math.round(toX), Math.round(toY))) return false;
  unit.x = toX;
  unit.y = toY;
  unit.path = [];
  return true;
}

// --- 5.4.4 الارتداد يدفع الحلفاء فيترنّح الاثنان ---
export function bumpAllies(state, unit, helpers) {
  const B = CR.bump, r2 = B.allyRadius * B.allyRadius;
  helpers.forEachNearby(state, unit.x, unit.y, B.allyRadius, (other) => {
    if (other === unit || other.state === 'dead' || other.hp <= 0) return;
    const dx = other.x - unit.x, dy = other.y - unit.y;
    if (dx * dx + dy * dy > r2) return;
    if (helpers.isEnemy(state, unit, other)) return;         // الحلفاء فقط
    other.staggerUntil = Math.max(other.staggerUntil, state.time + B.allyStagger);
    unit.staggerUntil = Math.max(unit.staggerUntil, state.time + B.allyStagger);
  });
}

// الجثة ترتد وتتدحرج بقدر قوة الضربة القاتلة، وتزحزح من في طريقها
export function rollCorpse(state, unit, attacker, damage, helpers) {
  const B = CR.bump;
  const distance = Math.min(B.corpseRollMax, damage * B.corpseRollPerDamage);
  if (distance <= 0.05) return;

  const dx = unit.x - attacker.x, dy = unit.y - attacker.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length, uy = dy / length;

  // حد الأجساد المتدحرجة: الأقدم يُحذف
  state.rolling = state.rolling.filter(r => r.unit.state === 'dead');
  while (state.rolling.length >= B.maxRollingBodies) state.rolling.shift();
  state.rolling.push({ unit, ux, uy, left: distance, seconds: B.corpseSeconds, helpers });
}

export function updateRolling(state, helpers) {
  if (!state.rolling.length) return;
  const remaining = [];

  for (const roll of state.rolling) {
    const step = Math.min(roll.left, (roll.left / roll.seconds) * TICK_SEC * 2);
    roll.left -= step;
    if (step > 0) {
      shove(state, roll.unit, roll.ux, roll.uy, step);
      // تصطدم بمن في طريقها فتزحزحهم قليلاً
      helpers.forEachNearby(state, roll.unit.x, roll.unit.y, CR.bump.allyRadius, (other) => {
        if (other === roll.unit || other.state === 'dead') return;
        const dx = other.x - roll.unit.x, dy = other.y - roll.unit.y;
        const d = Math.hypot(dx, dy);
        if (d > CR.bump.allyRadius || d === 0) return;
        shove(state, other, dx / d, dy / d, CR.bump.corpseShove);
      });
    }
    if (roll.left > 0.01) remaining.push(roll);
  }
  state.rolling = remaining;
}

// --- 5.4.5 مستويات التفصيل: تُعاد كل نصف ثانية لا كل إطار ---
export function updateDetailLevels(state) {
  state.detailTimer -= TICK_SEC;
  if (state.detailTimer > 0) return;
  state.detailTimer = CR.detail.recalcSeconds;

  const D = CR.detail;
  const limit = state.units.length > D.crowdedMatch ? D.fullUnitsCrowded : D.fullUnits;
  const visible = [];

  for (const unit of state.units) {
    if (!onScreen(state, unit.x, unit.y)) { unit.detail = 'stat'; continue; }
    unit.detail = 'simple';
    visible.push(unit);
  }

  if (visible.length > limit) {
    // الأقرب للكاميرا يأخذ المستوى الكامل
    const cx = state.camera.x, cy = state.camera.y;
    const distance = (u) => {
      const wx = (u.x - u.y) * 18 - cx, wy = (u.x + u.y) * 9 - cy;
      return wx * wx + wy * wy;
    };
    visible.sort((a, b) => distance(a) - distance(b));
  }
  for (let k = 0; k < Math.min(limit, visible.length); k++) visible[k].detail = 'full';
}
