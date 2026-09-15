// الهجوم التلقائي، أمر الهجوم، المقذوفات، الضرر والموت
import { TICK_SEC, COMBAT, UNITS, UNIT_ART } from '../config.js';
import { findPath } from '../map/pathfinding.js';
import { faceTowards } from './units.js';
import { createFire } from './abilities.js';
import { chargeOverTime, chargeOnHit, chargeOnDamageTaken, tryCastUlt, resolveUlt, updateFlurry } from './ults.js';
import { visionRange, rangedShotHits } from './weather.js';
import { forEachNearby } from './spatialHash.js';

// لا ضرر على وحدات نفس اللاعب ولا على الحلفاء (فريق 0 يعني بدون فريق: عدو للجميع)
export function isEnemy(state, a, b) {
  if (a.playerId === b.playerId) return false;
  const teamA = state.players[a.playerId].team;
  const teamB = state.players[b.playerId].team;
  if (teamA && teamB && teamA === teamB) return false;
  return true;
}

const isAlive = (unit) => unit && unit.state !== 'dead' && unit.hp > 0;
// نتجنب Math.hypot في الحلقات الساخنة: أبطأ بأربعة أضعاف من sqrt
const distance = (a, b) => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};
const distanceSq = (a, b) => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
};

// أمر هجوم من اللاعب: مطاردة بدون حد حتى يموت الهدف أو يصدر أمر آخر
export function commandAttack(state, units, target) {
  for (const unit of units) {
    if (!isAlive(unit)) continue;
    unit.target = target;
    unit.commandedTarget = true;
    unit.state = 'attacking';
    unit.chaseOrigin = { x: unit.x, y: unit.y };
    unit.repathTimer = 0;
    unit.path = [];
  }
}

export function clearCombatOrders(unit) {
  unit.target = null;
  unit.commandedTarget = false;
  unit.pendingHit = null;      // ضربة كانت في منتصفها
  unit.attackMove = null;      // وجهة الهجوم المتحرك
}

export function updateCombat(state) {
  const budget = { left: UNITS.pathRequestsPerTick };
  const tick = Math.round(state.time / TICK_SEC);
  const scanTicks = Math.max(1, Math.round(COMBAT.scanInterval / TICK_SEC));

  for (const unit of state.units) {
    if (unit.hitFlash > 0) unit.hitFlash -= TICK_SEC;
    if (unit.hurtTimer > 0) unit.hurtTimer -= TICK_SEC;   // أنميشن تلقي الضرر

    if (unit.state === 'dead') { unit.deathTimer -= TICK_SEC; continue; }
    if (unit.attackCooldown > 0) unit.attackCooldown -= TICK_SEC;

    chargeOverTime(unit);                 // شريط الشحن يمتلئ مع الوقت (القسم 6.7)
    updateFlurry(state, unit);            // ضربات الوابل المتتالية

    // الضربة تقع في منتصف حركة السلاح لا عند بدايتها
    if (unit.pendingHit && state.time >= unit.pendingHit.at) resolveHit(state, unit);
    if (unit.pendingUlt && state.time >= unit.pendingUlt.at) resolveUlt(state, unit);

    // أثناء أمر الحركة العادي تتجاهل الوحدة الأعداء حتى تصل
    if (unit.state === 'moving') continue;

    if (unit.state === 'attacking' && !isAlive(unit.target)) {
      // مات الهدف: تبحث فوراً عن عدو آخر في المدى
      unit.commandedTarget = false;
      const next = findNearestEnemy(state, unit);
      if (next) startAttack(unit, next);
      else finishFight(state, unit);
    }

    // الانتظار والهجوم المتحرك كلاهما يرصد الأعداء
    if (unit.state === 'idle' || unit.state === 'attackMove') {
      // بحث موزع على التحديثات: كل وحدة تبحث كل 0.25 ثانية
      if ((tick + unit.id) % scanTicks === 0) {
        const target = findNearestEnemy(state, unit);
        if (target) startAttack(unit, target);
      }
    }

    // الضربة المميزة تُطلق تلقائياً في أول لحظة يتحقق فيها شرطها
    if (unit.stats.ult && tryCastUlt(state, unit)) continue;

    if (unit.state === 'attacking') fightTarget(state, unit, budget);
  }

  updateProjectiles(state);
}

// لحظة الارتطام: هنا يقع الضرر أو يُطلق المقذوف
function resolveHit(state, unit) {
  const hit = unit.pendingHit;
  unit.pendingHit = null;
  if (!isAlive(hit.target) || !isAlive(unit)) return;

  if (hit.ranged) spawnVolley(state, unit, hit.target, hit.damage);
  else { strike(state, unit, hit.target, hit.damage); chargeOnHit(unit); }
}

// طلقة واحدة، أو ثلاثة سهام متفرقة لبطل الأفاعي (القسم 6.6)
// السهام الإضافية تبحث عن أعداء آخرين حول الهدف، فقد تصيب ثلاثة أعداء مختلفين
function spawnVolley(state, unit, target, damage) {
  const arrows = unit.stats.arrows || 1;
  if (arrows <= 1) { spawnProjectile(state, unit, target, damage, 0); return; }

  const targets = [target];
  const searchSq = COMBAT.multiShotSearch * COMBAT.multiShotSearch;
  forEachNearby(state, target.x, target.y, COMBAT.multiShotSearch, (other) => {
    if (targets.length >= arrows || targets.includes(other)) return;
    if (distanceSq(other, target) > searchSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    targets.push(other);
  });

  // ما زاد عن الأعداء الموجودين يذهب إلى الهدف نفسه، متفرقاً عنه قليلاً
  for (let k = 0; k < arrows; k++) {
    const offset = (k - (arrows - 1) / 2) * COMBAT.multiShotSpread;
    spawnProjectile(state, unit, targets[k] || target, damage, offset);
  }
}

// انتهى القتال: إما نعود للانتظار أو نواصل الهجوم المتحرك نحو وجهته
function finishFight(state, unit) {
  unit.target = null;
  unit.commandedTarget = false;
  unit.path = [];

  if (unit.attackMove) {
    unit.state = 'attackMove';
    unit.orderSeq++;
    unit.awaitingPath = true;
    state.pathQueue.push({ unit, i: unit.attackMove.i, j: unit.attackMove.j, seq: unit.orderSeq });
    return;
  }
  unit.state = 'idle';
}

function startAttack(unit, target) {
  unit.target = target;
  unit.state = 'attacking';
  unit.chaseOrigin = { x: unit.x, y: unit.y };
  unit.repathTimer = 0;
}

function becomeIdle(unit) {
  unit.target = null;
  unit.commandedTarget = false;
  unit.state = 'idle';
  unit.path = [];
}

// أقرب عدو داخل مدى الرصد (يتأثر بالطقس: ليلاً أقصر)
// نبحث في الخلايا المجاورة فقط عبر الشبكة المكانية
function findNearestEnemy(state, unit) {
  const vision = visionRange(state, unit);
  let best = null;

  // مقارنة بمربع المسافة: بلا جذر ولا Math.hypot
  let bestSq = vision * vision;
  forEachNearby(state, unit.x, unit.y, vision, (other) => {
    if (other === unit) return;
    const d2 = distanceSq(unit, other);
    if (d2 >= bestSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    bestSq = d2;
    best = other;
  });
  return best;
}

// تسارع الاشتباك (القسمان 6.2 و6.6): كل ضربة متتالية تقصّر زمن الضربة
// المزدوج 12% حتى 4 ضربات وبحد أدنى 0.5 ث، وبطل الغربان 8% حتى نصف الزمن
function comboAttackTime(state, unit, target, baseTime) {
  const combo = unit.stats.combo;
  if (!combo) return baseTime;

  // تنقطع السلسلة إذا توقف عن الضرب، أو غيّر هدفه لمن يشترط نفس الهدف
  const stopped = state.time - unit.comboTime > combo.resetSeconds;
  const switched = combo.sameTarget && unit.comboTarget !== target;
  if (stopped || switched) unit.comboStacks = 0;

  const floor = combo.minAttackTime !== undefined
    ? combo.minAttackTime
    : baseTime * combo.minFactor;
  const time = Math.max(floor, baseTime * Math.pow(1 - combo.step, unit.comboStacks));

  if (combo.maxStacks === undefined || unit.comboStacks < combo.maxStacks) unit.comboStacks++;
  unit.comboTime = state.time;
  unit.comboTarget = target;
  return time;
}

function fightTarget(state, unit, budget) {
  const target = unit.target;
  const dist = distance(unit, target);
  faceTowards(unit, target.x, target.y);   // تنظر نحو خصمها

  // حد المطاردة (لا ينطبق على أمر الهجوم من اللاعب)
  if (!unit.commandedTarget) {
    const visionLimit = visionRange(state, unit) * COMBAT.chaseVisionFactor;
    const fromOrigin = distance(unit, unit.chaseOrigin);
    if (dist > visionLimit || fromOrigin > COMBAT.chaseMaxTiles) {
      returnToOrigin(state, unit);
      return;
    }
  }

  // الرماة يتحولون للقتال القريب إذا اقترب العدو
  const melee = unit.stats.meleeRange !== undefined && dist <= unit.stats.meleeRange;
  const range = melee ? unit.stats.meleeRange : unit.stats.attackRange;
  const damage = melee ? unit.stats.meleeDamage : unit.stats.damage;
  let attackTime = melee ? unit.stats.meleeAttackTime : unit.stats.attackTime;

  if (dist <= range + COMBAT.rangeTolerance) {
    unit.path = [];                       // وصلت للمدى: تتوقف وتضرب
    if (unit.attackCooldown <= 0) {
      attackTime = comboAttackTime(state, unit, target, attackTime);
      // توحّش الزعيم: +20% سرعة ضرب لمدة محدودة
      if (unit.buffUntil > state.time && unit.buffAttackSpeed) {
        attackTime /= 1 + unit.buffAttackSpeed;
      }
      unit.attackCooldown = attackTime;
      // بداية حركة السلاح: الرسم يقرأ هذين الرقمين، والضرر يقع عند الارتطام
      unit.attackStart = state.time;
      unit.attackRate = attackTime;
      unit.ultStart = null;              // ضربة عادية لا مميزة
      unit.pendingHit = {
        target,
        damage: damage * unit.damageMultiplier,       // مخزن السلاح + هالة الزعيم
        ranged: !melee && !!unit.stats.projectile,
        at: state.time + attackTime * COMBAT.hitMoment
      };
    }
    return;
  }

  // خارج المدى: تتحرك نحو الهدف مع إعادة حساب المسار بين حين وآخر
  unit.repathTimer -= TICK_SEC;
  if ((!unit.path.length || unit.repathTimer <= 0) && budget.left > 0) {
    budget.left--;
    unit.repathTimer = COMBAT.repathInterval;
    const path = findPath(state.map,
      Math.round(unit.x), Math.round(unit.y),
      Math.round(target.x), Math.round(target.y));
    if (path) unit.path = path;
  }
}

// تتوقف وتعود لمكان بدء المطاردة (وأثناء العودة تتجاهل الأعداء حتى تصل)
// أما في الهجوم المتحرك فتواصل تقدمها نحو وجهتها بدل العودة
function returnToOrigin(state, unit) {
  if (unit.attackMove) { finishFight(state, unit); return; }

  const origin = unit.chaseOrigin;
  unit.target = null;
  unit.commandedTarget = false;
  const path = findPath(state.map,
    Math.round(unit.x), Math.round(unit.y),
    Math.round(origin.x), Math.round(origin.y));
  if (path && path.length) {
    unit.path = path;
    unit.state = 'moving';
  } else {
    becomeIdle(unit);
  }
}

// ضربة مباشرة: قد تكون دائرية (المحطِّم) فتصيب كل الأعداء حول الهدف
function strike(state, attacker, target, amount) {
  const splash = attacker.stats.splashRadius;
  if (!splash) { applyDamage(state, attacker, target, amount); return; }

  const splashSq = splash * splash;
  forEachNearby(state, target.x, target.y, splash, (other) => {
    if (other.state === 'dead' || other.hp <= 0) return;
    if (distanceSq(other, target) > splashSq) return;
    if (!isEnemy(state, attacker, other)) return;
    applyDamage(state, attacker, other, amount);
  });
}

export function applyDamage(state, attacker, target, amount) {
  if (!isAlive(target)) return;
  if (target.invulnUntil > state.time) return;     // تصلّب: لا يتلقى أي ضرر
  const taken = amount * (1 - target.stats.armor);
  target.hp -= taken;
  chargeOnDamageTaken(target, taken);              // شحن عن كل 50 ضرراً
  target.hitFlash = COMBAT.hitFlashTime;
  target.hurtTimer = UNIT_ART.hurtSeconds;   // أنميشن تلقي الضرر (القسم 13)

  if (target.hp <= 0) {
    target.hp = 0;
    target.state = 'dead';
    target.hurtTimer = 0;                    // أنميشن الموت يحلّ محل أنميشن الضرر
    target.attackStart = null;
    target.ultStart = null;
    target.pendingHit = null;
    target.pendingUlt = null;
    target.flurry = null;
    target.deathTimer = COMBAT.deathTime;
    target.path = [];
    target.target = null;
    target.selected = false;
    state.stats.kills[attacker.playerId]++;
    state.stats.losses[target.playerId]++;
  }
}

// --- المقذوفات ---
// offset: إزاحة جانبية عند الانطلاق حتى تتفرق السهام الثلاثة بصرياً
// fire: نار تشتعل حيث يسقط المقذوف (زجاجة رامي النار أو سهم بطل الأفاعي)
export function spawnProjectile(state, unit, target, damage, offset = 0, fire = null) {
  const dist = distance(unit, target);
  const maxRange = Math.max(unit.stats.attackRange, 0.1);
  const ratio = Math.min(1, dist / maxRange);
  const duration = COMBAT.projectileMinTime + (COMBAT.projectileMaxTime - COMBAT.projectileMinTime) * ratio;

  // في المطر تخطئ بعض الرميات فتسقط قرب الهدف بلا ضرر
  const hits = rangedShotHits(state);
  const angle = Math.random() * 6.2832;
  const spread = COMBAT.missSpread * (0.6 + Math.random() * 0.4);

  state.projectiles.push({
    kind: unit.stats.projectile,
    attacker: unit,
    target,
    damage,
    fire: fire || unit.stats.fire || null,
    hits,
    missX: target.x + Math.cos(angle) * spread,
    missY: target.y + Math.sin(angle) * spread,
    startX: unit.x + offset, startY: unit.y - offset,
    x: unit.x + offset, y: unit.y - offset,
    prevX: unit.x + offset, prevY: unit.y - offset,
    t: 0, prevT: 0,
    duration
  });
}

function updateProjectiles(state) {
  const remaining = [];
  for (const shot of state.projectiles) {
    shot.prevX = shot.x;
    shot.prevY = shot.y;
    shot.prevT = shot.t;
    shot.t += TICK_SEC;

    // المقذوف المصيب يتتبع هدفه، والخاطئ يسقط في نقطة قريبة منه
    const following = shot.hits && isAlive(shot.target);
    const endX = following ? shot.target.x : (shot.hits ? shot.x : shot.missX);
    const endY = following ? shot.target.y : (shot.hits ? shot.y : shot.missY);
    const progress = Math.min(1, shot.t / shot.duration);
    shot.x = shot.startX + (endX - shot.startX) * progress;
    shot.y = shot.startY + (endY - shot.startY) * progress;

    if (shot.t >= shot.duration) {
      // الزجاجة والسهم المشتعل يشعلان الأرض حيث سقطا (حتى لو أخطآ الهدف)
      if (shot.fire) createFire(state, shot.attacker.playerId, shot.x, shot.y, shot.fire);
      if (shot.damage > 0 && shot.hits && isAlive(shot.target)) {
        strike(state, shot.attacker, shot.target, shot.damage);
        chargeOnHit(shot.attacker);
      }
      continue;
    }
    remaining.push(shot);
  }
  state.projectiles = remaining;
}

// إزالة الوحدات التي انتهى زمن سقوطها
export function removeDeadUnits(state) {
  if (!state.units.some(u => u.state === 'dead' && u.deathTimer <= 0)) return;
  state.units = state.units.filter(u => !(u.state === 'dead' && u.deathTimer <= 0));
}
