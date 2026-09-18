// الضربات المميزة (القسم 6.7): الشحن، شرط الإطلاق، والتأثير الفعلي
// الأفراد العاديون لا يملكون ضربة مميزة، فلا شحن لهم.
import { TICK_SEC, COMBAT, ULT } from '../config.js';
import { isEnemy, applyDamage, spawnProjectile } from './combat.js';
import { createFire } from './abilities.js';
import { faceTowards } from './units.js';
import { forEachNearby } from './spatialHash.js';
import { soundAt } from '../audio/sound.js';

const isAlive = (unit) => unit && unit.state !== 'dead' && unit.hp > 0;
const allied = (state, a, b) => a.playerId === b.playerId || !isEnemy(state, a, b);
const distanceSq = (a, b) => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const hasUlt = (unit) => !!unit.stats.ult;
export const ultReady = (unit) => hasUlt(unit) && unit.ultCharge >= ULT.max;
// --- الشحن ---
// نغمة اكتمال الشحن تُسمع مرة واحدة عند امتلاء الشريط لا في كل تحديث
function announceReady(state, unit) {
  if (unit.ultCharge < ULT.max || unit.ultAnnounced) return;
  unit.ultAnnounced = true;
  soundAt(state, 'ult_ready', unit.x, unit.y);
}

export function chargeOverTime(state, unit) {
  if (!hasUlt(unit) || unit.ultCharge >= ULT.max) return;
  const rate = unit.champion ? ULT.championPerSecond : ULT.perSecond;
  unit.ultCharge = Math.min(ULT.max, unit.ultCharge + rate * TICK_SEC);
  announceReady(state, unit);
}

// عن كل ضربة تُصيب
export function chargeOnHit(state, unit) {
  if (!unit || !unit.stats || !hasUlt(unit)) return;
  const amount = unit.champion ? ULT.championPerHit : ULT.perHit;
  unit.ultCharge = Math.min(ULT.max, unit.ultCharge + amount);
  announceReady(state, unit);
}

// عن كل 50 ضرراً تتلقاه
export function chargeOnDamageTaken(state, unit, taken) {
  if (!hasUlt(unit)) return;
  unit.damageTaken += taken;
  while (unit.damageTaken >= ULT.damageChunk) {
    unit.damageTaken -= ULT.damageChunk;
    unit.ultCharge = Math.min(ULT.max, unit.ultCharge + ULT.perDamageChunk);
  }
  announceReady(state, unit);
}

// --- الإطلاق التلقائي عند اكتمال الشحن وتحقق الشرط ---

// مدى التحقق من الشرط: مدى الضربة أو نصف قطرها، وإلا مدى رصد الوحدة
const ultRange = (unit, ult) => ult.range || ult.radius || unit.stats.visionRange;

// أقرب عدو داخل مدى الضربة
function nearestEnemy(state, unit, range) {
  let best = null, bestSq = range * range;
  forEachNearby(state, unit.x, unit.y, range, (other) => {
    if (other === unit) return;
    const d2 = distanceSq(unit, other);
    if (d2 >= bestSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    bestSq = d2;
    best = other;
  });
  return best;
}

// أكثر حليف متضرر داخل مدى الضربة (تشمل الوحدة نفسها)
function woundedAlly(state, unit, range) {
  let best = null, worst = 0;
  const rangeSq = range * range;
  forEachNearby(state, unit.x, unit.y, range, (other) => {
    const missing = other.maxHp - other.hp;
    if (missing <= worst) return;
    if (distanceSq(unit, other) > rangeSq) return;
    if (!isAlive(other) || !allied(state, unit, other)) return;
    worst = missing;
    best = other;
  });
  return best;
}

// شرط الضربة: عدو في المدى، أو حليف متضرر للعلاج
function ultTarget(state, unit, ult) {
  const range = ultRange(unit, ult);
  if (ult.needs === 'ally') return woundedAlly(state, unit, range);
  if (ult.needs === 'either') return nearestEnemy(state, unit, range) || woundedAlly(state, unit, range);
  return nearestEnemy(state, unit, range);
}

// تبدأ حركة الضربة الآن، ويقع تأثيرها عند لحظة الارتطام (47%) مثل الضربة العادية
export function tryCastUlt(state, unit) {
  if (!ultReady(unit) || unit.pendingUlt || unit.attackCooldown > 0) return false;

  const ult = unit.stats.ult;
  const target = ultTarget(state, unit, ult);
  if (!target) return false;

  const rate = ULT.castSeconds;
  unit.ultCharge = 0;
  unit.ultAnnounced = false;
  soundAt(state, 'ult_cast', unit.x, unit.y);
  unit.pendingHit = null;          // تلغي ضربة عادية كانت في منتصفها
  unit.attackStart = state.time;
  unit.attackRate = rate;
  unit.attackCooldown = rate;
  unit.ultStart = state.time;
  unit.ultRate = rate;
  unit.pendingUlt = { target, at: state.time + rate * COMBAT.hitMoment };
  // المشتبكة تتوقف لتضرب، أما المتقدمة في هجوم متحرك فتواصل طريقها
  if (unit.state === 'attacking') unit.path = [];
  if (target !== unit) faceTowards(unit, target.x, target.y);
  return true;
}

// --- لحظة تأثير الضربة ---
export function resolveUlt(state, unit) {
  const pending = unit.pendingUlt;
  unit.pendingUlt = null;
  if (!isAlive(unit)) return;

  const ult = unit.stats.ult;
  const target = isAlive(pending.target) ? pending.target : null;

  switch (ult.kind) {
    case 'harden':  harden(state, unit, ult.duration); break;
    case 'slam':    slam(state, unit, ult); break;
    case 'arc':     arc(state, unit, ult, pending.target); break;
    case 'pierce':  pierce(state, unit, ult, pending.target); break;
    case 'flurry':  startFlurry(state, unit, ult, target); break;
    case 'buff':    buffAllies(state, unit, ult); break;
    case 'heal':    healAllies(state, unit, ult); break;
    case 'shot':    if (target) spawnProjectile(state, unit, target, ultDamage(unit, ult.damage)); break;
    case 'fire':    createFire(state, unit.playerId, (target || unit).x, (target || unit).y, ult.fire); break;
    case 'arrows':  fireArrows(state, unit, ult, target); break;
    case 'bash':    bash(state, unit, ult, target); break;
  }
}

// ضرر الضربة يتأثر بمكافآت الضرر مثل الضربة العادية (مخزن السلاح، الهالات)
const ultDamage = (unit, amount) => amount * unit.damageMultiplier;

function harden(state, unit, duration) {
  unit.invulnUntil = state.time + duration;
}

// ضربة أرضية حول الوحدة، وقد يرافقها تصلّب (بطل المطارق)
function slam(state, unit, ult) {
  if (ult.harden) harden(state, unit, ult.harden);
  const radiusSq = ult.radius * ult.radius;

  forEachNearby(state, unit.x, unit.y, ult.radius, (other) => {
    if (distanceSq(unit, other) > radiusSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    applyDamage(state, unit, other, ultDamage(unit, ult.damage));
    if (ult.slow) {
      other.slowFactor = ult.slow;
      other.slowUntil = state.time + ult.slowDuration;
    }
  });
}

// قوس أمام الوحدة باتجاه هدفها (بطل الغربان)
function arc(state, unit, ult, target) {
  const dx = target ? target.x - unit.x : 1;
  const dy = target ? target.y - unit.y : 0;
  const length = Math.hypot(dx, dy) || 1;
  const fx = dx / length, fy = dy / length;
  const radiusSq = ult.radius * ult.radius;

  forEachNearby(state, unit.x, unit.y, ult.radius, (other) => {
    if (distanceSq(unit, other) > radiusSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    // أمامه فقط: نصف الدائرة في اتجاه الهدف
    if ((other.x - unit.x) * fx + (other.y - unit.y) * fy < 0) return;
    applyDamage(state, unit, other, ultDamage(unit, ult.damage));
  });
}

// طعنة تخترق أول عدوين في خط الطعنة (حامل الرمح)
function pierce(state, unit, ult, target) {
  const dx = target ? target.x - unit.x : 1;
  const dy = target ? target.y - unit.y : 0;
  const length = Math.hypot(dx, dy) || 1;
  const fx = dx / length, fy = dy / length;
  const reach = ult.range + COMBAT.pierceReachBonus;

  const online = [];
  forEachNearby(state, unit.x, unit.y, reach, (other) => {
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    const ox = other.x - unit.x, oy = other.y - unit.y;
    const along = ox * fx + oy * fy;                    // البعد على خط الطعنة
    if (along <= 0 || along > reach) return;
    const side = Math.abs(ox * -fy + oy * fx);          // البعد الجانبي عن الخط
    if (side > COMBAT.pierceWidth) return;
    online.push({ unit: other, along });
  });

  online.sort((a, b) => a.along - b.along);
  for (const hit of online.slice(0, ult.targets)) {
    applyDamage(state, unit, hit.unit, ultDamage(unit, ult.damage));
  }
}

// وابل: عدة ضربات متتالية على نفس الهدف خلال مدة قصيرة (المزدوج)
function startFlurry(state, unit, ult, target) {
  if (!target) return;
  unit.flurry = {
    target,
    left: ult.hits,
    damage: ult.damage,
    interval: ult.duration / ult.hits,
    next: state.time
  };
}

export function updateFlurry(state, unit) {
  const flurry = unit.flurry;
  if (!flurry) return;
  if (!isAlive(unit) || !isAlive(flurry.target)) { unit.flurry = null; return; }
  if (state.time < flurry.next) return;

  applyDamage(state, unit, flurry.target, ultDamage(unit, flurry.damage));
  flurry.left--;
  flurry.next = state.time + flurry.interval;
  if (flurry.left <= 0) unit.flurry = null;
}

// تحفيز الحلفاء (الزعيم وبطل العقارب)، وقد يرافقه علاج فوري
function buffAllies(state, unit, ult) {
  forEachAlly(state, unit, ult.radius, (ally) => {
    ally.buffUntil = state.time + ult.duration;
    ally.buffDamage = ult.damageBonus;
    ally.buffAttackSpeed = ult.attackSpeedBonus || 0;
    if (ult.heal) heal(ally, ult.heal);
  });
  if (ult.heal) soundAt(state, 'heal', unit.x, unit.y);
}

// علاج جماعي دفعة واحدة (الطبيب)
function healAllies(state, unit, ult) {
  forEachAlly(state, unit, ult.radius, (ally) => heal(ally, ult.heal));
  soundAt(state, 'heal', unit.x, unit.y);
}

function forEachAlly(state, unit, radius, action) {
  const radiusSq = radius * radius;
  forEachNearby(state, unit.x, unit.y, radius, (other) => {
    if (distanceSq(unit, other) > radiusSq) return;
    if (!isAlive(other) || !allied(state, unit, other)) return;
    action(other);
  });
}

const heal = (unit, amount) => { unit.hp = Math.min(unit.maxHp, unit.hp + amount); };

// صدّة بالدرع: ضرر ودفع العدو مربعاً للخلف مع إبطائه (الشرطي، القسم 3.8)
function bash(state, unit, ult, target) {
  if (!target) return;
  applyDamage(state, unit, target, ultDamage(unit, ult.damage));
  if (!isAlive(target)) return;

  target.slowFactor = ult.slow;
  target.slowUntil = state.time + ult.slowDuration;

  // الدفع لا يمر عبر المباني: نتوقف عند آخر مربع موصول في طريق الدفع
  const dx = target.x - unit.x, dy = target.y - unit.y;
  const length = Math.hypot(dx, dy) || 1;
  const toX = target.x + (dx / length) * ult.push;
  const toY = target.y + (dy / length) * ult.push;
  if (!state.map.isConnected(Math.round(toX), Math.round(toY))) return;

  target.x = toX;
  target.y = toY;
  target.path = [];          // مساره القديم لم يعد يبدأ من مكانه
}

// ثلاثة سهام نارية: كل سهم يضر ويشعل بقعة صغيرة حيث يسقط (بطل الأفاعي)
function fireArrows(state, unit, ult, target) {
  if (!target) return;
  const targets = [target];
  const searchSq = COMBAT.multiShotSearch * COMBAT.multiShotSearch;
  forEachNearby(state, target.x, target.y, COMBAT.multiShotSearch, (other) => {
    if (targets.length >= ult.arrows || targets.includes(other)) return;
    if (distanceSq(other, target) > searchSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    targets.push(other);
  });

  for (let k = 0; k < ult.arrows; k++) {
    const offset = (k - (ult.arrows - 1) / 2) * COMBAT.multiShotSpread;
    spawnProjectile(state, unit, targets[k] || target, ultDamage(unit, ult.damage), offset, ult.fire);
  }
}
