// الهجوم التلقائي، أمر الهجوم، المقذوفات، الضرر والموت
import { TICK_SEC, COMBAT, UNITS } from '../config.js';
import { findPath } from '../map/pathfinding.js';

// لا ضرر على وحدات نفس اللاعب ولا على الحلفاء (فريق 0 يعني بدون فريق: عدو للجميع)
export function isEnemy(state, a, b) {
  if (a.playerId === b.playerId) return false;
  const teamA = state.players[a.playerId].team;
  const teamB = state.players[b.playerId].team;
  if (teamA && teamB && teamA === teamB) return false;
  return true;
}

const isAlive = (unit) => unit && unit.state !== 'dead' && unit.hp > 0;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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
}

export function updateCombat(state) {
  const budget = { left: UNITS.pathRequestsPerTick };
  const tick = Math.round(state.time / TICK_SEC);
  const scanTicks = Math.max(1, Math.round(COMBAT.scanInterval / TICK_SEC));

  for (const unit of state.units) {
    if (unit.hitFlash > 0) unit.hitFlash -= TICK_SEC;

    if (unit.state === 'dead') { unit.deathTimer -= TICK_SEC; continue; }
    if (unit.attackCooldown > 0) unit.attackCooldown -= TICK_SEC;

    // أثناء أمر الحركة تتجاهل الوحدة الأعداء حتى تصل
    if (unit.state === 'moving') continue;

    if (unit.state === 'attacking' && !isAlive(unit.target)) {
      // مات الهدف: تبحث فوراً عن عدو آخر في المدى
      unit.commandedTarget = false;
      const next = findNearestEnemy(state, unit);
      if (next) startAttack(unit, next);
      else becomeIdle(unit);
    }

    if (unit.state === 'idle') {
      // بحث موزع على التحديثات: كل وحدة تبحث كل 0.25 ثانية
      if ((tick + unit.id) % scanTicks === 0) {
        const target = findNearestEnemy(state, unit);
        if (target) startAttack(unit, target);
      }
    }

    if (unit.state === 'attacking') fightTarget(state, unit, budget);
  }

  updateProjectiles(state);
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

// أقرب عدو داخل مدى الرصد
function findNearestEnemy(state, unit) {
  const vision = unit.stats.visionRange;
  let best = null, bestDist = vision;
  for (const other of state.units) {
    if (!isAlive(other) || !isEnemy(state, unit, other)) continue;
    const d = distance(unit, other);
    if (d < bestDist) { bestDist = d; best = other; }
  }
  return best;
}

function fightTarget(state, unit, budget) {
  const target = unit.target;
  const dist = distance(unit, target);

  // حد المطاردة (لا ينطبق على أمر الهجوم من اللاعب)
  if (!unit.commandedTarget) {
    const visionLimit = unit.stats.visionRange * COMBAT.chaseVisionFactor;
    const fromOrigin = Math.hypot(unit.x - unit.chaseOrigin.x, unit.y - unit.chaseOrigin.y);
    if (dist > visionLimit || fromOrigin > COMBAT.chaseMaxTiles) {
      returnToOrigin(state, unit);
      return;
    }
  }

  // الرماة يتحولون للقتال القريب إذا اقترب العدو
  const melee = unit.stats.meleeRange !== undefined && dist <= unit.stats.meleeRange;
  const range = melee ? unit.stats.meleeRange : unit.stats.attackRange;
  const damage = melee ? unit.stats.meleeDamage : unit.stats.damage;
  const attackTime = melee ? unit.stats.meleeAttackTime : unit.stats.attackTime;

  if (dist <= range + COMBAT.rangeTolerance) {
    unit.path = [];                       // وصلت للمدى: تتوقف وتضرب
    if (unit.attackCooldown <= 0) {
      unit.attackCooldown = attackTime;
      if (!melee && unit.stats.projectile) spawnProjectile(state, unit, target, damage);
      else applyDamage(state, unit, target, damage);
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
function returnToOrigin(state, unit) {
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

export function applyDamage(state, attacker, target, amount) {
  if (!isAlive(target)) return;
  const taken = amount * (1 - target.stats.armor);
  target.hp -= taken;
  target.hitFlash = COMBAT.hitFlashTime;

  if (target.hp <= 0) {
    target.hp = 0;
    target.state = 'dead';
    target.deathTimer = COMBAT.deathTime;
    target.path = [];
    target.target = null;
    target.selected = false;
    state.stats.kills[attacker.playerId]++;
    state.stats.losses[target.playerId]++;
  }
}

// --- المقذوفات ---
function spawnProjectile(state, unit, target, damage) {
  const dist = distance(unit, target);
  const maxRange = Math.max(unit.stats.attackRange, 0.1);
  const ratio = Math.min(1, dist / maxRange);
  const duration = COMBAT.projectileMinTime + (COMBAT.projectileMaxTime - COMBAT.projectileMinTime) * ratio;

  state.projectiles.push({
    kind: unit.stats.projectile,
    attacker: unit,
    target,
    damage,
    startX: unit.x, startY: unit.y,
    x: unit.x, y: unit.y,
    prevX: unit.x, prevY: unit.y,
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

    // المقذوف يتتبع هدفه: يصيب عند الوصول
    const endX = isAlive(shot.target) ? shot.target.x : shot.x;
    const endY = isAlive(shot.target) ? shot.target.y : shot.y;
    const progress = Math.min(1, shot.t / shot.duration);
    shot.x = shot.startX + (endX - shot.startX) * progress;
    shot.y = shot.startY + (endY - shot.startY) * progress;

    if (shot.t >= shot.duration) {
      if (isAlive(shot.target)) applyDamage(state, shot.attacker, shot.target, shot.damage);
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
