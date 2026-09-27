// الهجوم التلقائي، أمر الهجوم، المقذوفات، الضرر والموت
import { TICK_SEC, COMBAT, COMBAT_REALISM as CR, UNITS, UNIT_ART, POLICE, AUDIO } from '../config.js';
import { findPath } from '../map/pathfinding.js';
import { facingFromAngle } from './units.js';
import {
  updateRealism, updateBumps, updateLod, registerSight, chooseMove, moveTiming,
  zoneOf, zoneDamage, knockback, stagger, blockedBy, corpseKnock, turnToward,
  approachPoint, busyBonus, crowdCount, attackPause, statDamageFactor, wrapAngle, releaseRagdoll
} from './realism.js';
import { createFire } from './abilities.js';
import { chargeOverTime, chargeOnHit, chargeOnDamageTaken, tryCastUlt, resolveUlt, updateFlurry } from './ults.js';
import { visionRange, rangedShotHits, moveSpeed } from './weather.js';
import { forEachNearby } from './spatialHash.js';
import { soundAt, soundAlert } from '../audio/sound.js';
import { raiseAlert } from './alerts.js';

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

  updateLod(state);         // مستويات التفصيل تُحسب كل نصف ثانية (القسم 5.4.5)

  for (const unit of state.units) {
    if (unit.hitFlash > 0) unit.hitFlash -= TICK_SEC;
    if (unit.hurtTimer > 0) unit.hurtTimer -= TICK_SEC;   // أنميشن تلقي الضرر

    // القتال الواقعي: الارتداد والتحمّل والمؤقتات والرؤية المعلّقة
    const reacting = updateRealism(state, unit);

    if (unit.state === 'dead') { unit.deathTimer -= TICK_SEC; continue; }
    if (reacting) continue;                 // تفادٍ أو صدّ أو ترنّح: لا تتصرف
    if (unit.attackCooldown > 0) unit.attackCooldown -= TICK_SEC;

    // تقدّم الحركة الجارية بمراحلها (استعداد، ضرب، تجمّد، تعافٍ)
    if (unit.cMove) {
      unit.cMoveT += TICK_SEC;
      if (unit.cMoveT >= unit.cPhases.total) {
        unit.cMove = null;
        unit.cPhases = null;
        unit.attackCooldown = attackPause(unit);   // الفاصل بعد التعافي وحده
      }
    }

    chargeOverTime(state, unit);          // شريط الشحن يمتلئ مع الوقت (القسم 6.7)
    updateFlurry(state, unit);            // ضربات الوابل المتتالية

    // الضربة تقع في منتصف حركة السلاح لا عند بدايتها
    if (unit.pendingHit && state.time >= unit.pendingHit.at) resolveHit(state, unit);
    if (unit.pendingUlt && state.time >= unit.pendingUlt.at) resolveUlt(state, unit);

    // أثناء أمر الحركة العادي تتجاهل الوحدة الأعداء حتى تصل،
    // والشرطة الراجعة إلى مركزها لا تهاجم إلا من يعترضها مباشرة (القسم 3.8)
    if (unit.state === 'moving') {
      if (unit.homePost) blockedPolice(state, unit);
      continue;
    }

    if (unit.state === 'attacking' && !isAlive(unit.target)) {
      // مات الهدف: تبحث فوراً عن عدو آخر في المدى
      unit.commandedTarget = false;
      const next = findNearestEnemy(state, unit);
      if (next) startAttack(unit, next, state);
      else finishFight(state, unit);
    }

    // الانتظار والهجوم المتحرك كلاهما يرصد الأعداء
    if (unit.state === 'idle' || unit.state === 'attackMove') {
      // بحث موزع على التحديثات: كل وحدة تبحث كل 0.25 ثانية
      if ((tick + unit.id) % scanTicks === 0) {
        const target = findNearestEnemy(state, unit);
        if (target) startAttack(unit, target, state);
      }
    }

    // الضربة المميزة تُطلق تلقائياً في أول لحظة يتحقق فيها شرطها
    if (unit.stats.ult && tryCastUlt(state, unit)) continue;

    if (unit.state === 'attacking') fightTarget(state, unit, budget);
  }

  updateProjectiles(state);
  updateBumps(state, isEnemy);    // الوحدة المرتدة تصطدم بحليفها، والجثة تتدحرج
}

// لحظة الارتطام: هنا يقع الضرر أو يُطلق المقذوف
function resolveHit(state, unit) {
  const hit = unit.pendingHit;
  unit.pendingHit = null;
  if (!isAlive(unit)) return;

  if (hit.ranged) { if (isAlive(hit.target)) spawnVolley(state, unit, hit.target, hit.damage); return; }

  // القتال الواقعي: الحركة تحدد من تصيب، والزاوية تحدد الضرر (القسم 5.4)
  if (hit.move) { resolveMove(state, unit, hit); return; }

  if (!isAlive(hit.target)) return;
  strike(state, unit, hit.target, hit.damage);
  chargeOnHit(state, unit);
}

// لحظة ضرر حركة قريبة: المدى والقوس، ثم التفادي والصدّ، ثم الزاوية والترنّح
function resolveMove(state, unit, hit) {
  const m = CR.moves[hit.move];
  const reach = hit.range + m.rangeAdd + CR.reachBonus;
  const targets = [];

  if (hit.move === 'spin') {
    // الضربة الدائرية تصيب كل من حول الضارب (بلا ضربة مساحية فوقها حتى لا يُحسب الضرر مرتين)
    forEachNearby(state, unit.x, unit.y, reach, (other) => {
      if (!isAlive(other) || other === unit) return;
      if (distance(unit, other) > reach) return;
      if (!isEnemy(state, unit, other)) return;
      targets.push(other);
    });
  } else if (isAlive(hit.target)) {
    const target = hit.target;
    const off = Math.abs(wrapAngle(Math.atan2(target.y - unit.y, target.x - unit.x) - unit.faceAngle));
    // خرج من المدى أو من قوس الضربة أثناء الاستعداد: الضربة تمر في الهواء
    if (distance(unit, target) <= reach && off <= m.arc * Math.PI / 360 + CR.arcTolerance) targets.push(target);
  }

  let landed = false;
  for (const target of targets) {
    if (target.cState === 'dodge') continue;                 // تفادى: الضربة في الهواء
    const zone = zoneOf(target, unit.x, unit.y);

    if (target.cState === 'block' && zone === 'front') {      // صدّ: المهاجم يرتد ويترنّح
      blockedBy(state, unit, target);
      return;
    }

    // القتال الإحصائي خارج الشاشة: ضرر أقل بلا أنميشن (القسم 5.4.5)
    const lodFactor = unit.lod === 'stat' ? statDamageFactor : 1;
    const amount = hit.damage * zoneDamage(zone) * lodFactor;
    if (zone === 'back') state.combatEvents.back++;
    else if (zone === 'side') state.combatEvents.side++;
    state.combatEvents.hits++;

    // الضربة المساحية للمحطِّم تبقى كما هي (القسم 6) على الأهداف المفردة
    const died = hit.move === 'spin'
      ? applyDamage(state, unit, target, amount)
      : strike(state, unit, target, amount);
    landed = true;

    if (died) corpseKnock(state, target, unit, hit.move);
    else if (m.stagger && isAlive(target) && target.invulnUntil <= state.time) {
      stagger(state, target, m.stagger);                      // الضربة القوية تُترنّح وتدفع
      knockback(target, unit.x, unit.y, m.knock);
    }
  }
  if (landed) chargeOnHit(state, unit);
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

// عدو ملاصق يعترض طريق شرطي راجع إلى مركزه: يقاتله بدل أن يمر
function blockedPolice(state, unit) {
  const reach = unit.stats.attackRange + COMBAT.rangeTolerance;
  let blocker = null;
  forEachNearby(state, unit.x, unit.y, reach, (other) => {
    if (blocker || other === unit) return;
    if (distance(unit, other) > reach) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    blocker = other;
  });
  if (blocker) startAttack(unit, blocker, state);
}

function startAttack(unit, target, state) {
  unit.target = target;
  unit.state = 'attacking';
  if (!unit.homePost) unit.chaseOrigin = { x: unit.x, y: unit.y };
  unit.repathTimer = 0;

  // صافرة الشرطة عند بدء مطاردتها، متباعدة حتى لا تتحول إلى ضجيج
  if (state && unit.homePost && state.time - unit.whistleAt > AUDIO.whistleSeconds) {
    unit.whistleAt = state.time;
    soundAt(state, 'whistle', unit.x, unit.y);
  }
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

  // الأقرب، مع تفضيل الهدف المشغول بقتال غيرنا بقدر ميل الالتفاف (القسم 5.4.4ب)
  let bestScore = vision;
  forEachNearby(state, unit.x, unit.y, vision, (other) => {
    if (other === unit) return;
    const d = distance(unit, other);
    if (d >= vision) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    const score = d - busyBonus(unit, other);
    if (score >= bestScore) return;
    bestScore = score;
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

  // وجه الوحدة يدور بسرعة محدودة (القسم 5.4.4ب): البطيء في الدوران يُلتف عليه
  const aimOff = turnToward(unit, target.x, target.y, TICK_SEC);
  facingFromAngle(unit);

  // حد المطاردة (لا ينطبق على أمر الهجوم من اللاعب)
  // الشرطة تقيسه من مركزها: لا تبتعد عنه أكثر من 6 مربعات (القسم 3.8)
  if (unit.homePost) {
    if (distance(unit, unit.homePost) > POLICE.chaseTiles) { returnToOrigin(state, unit); return; }
  } else if (!unit.commandedTarget) {
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
  // الرمي البعيد وحده يُعتبر "بعيداً": حركات الرماة للقتال القريب فقط (القسم 5.4)
  const ranged = !melee && !!unit.stats.projectile;

  // المدى الفعلي للحركة القريبة يمتد بامتداد الحركة (الطعنة أطول)
  const reachAdd = ranged ? 0 : longestReachAdd(unit);
  if (dist <= range + reachAdd + COMBAT.rangeTolerance) {
    unit.path = [];                       // وصلت للمدى: تتوقف وتضرب
    if (unit.attackCooldown <= 0 && !unit.cMove) {
      attackTime = comboAttackTime(state, unit, target, attackTime);
      // توحّش الزعيم: +20% سرعة ضرب لمدة محدودة
      if (unit.buffUntil > state.time && unit.buffAttackSpeed) {
        attackTime /= 1 + unit.buffAttackSpeed;
      }

      // الرمي البعيد يبقى ضربة واحدة كما هي؛ والقتال القريب يستعمل الحركات الأربع
      if (ranged) rangedSwing(state, unit, target, damage, attackTime);
      else meleeSwing(state, unit, target, dist, range, damage, attackTime, aimOff);
    }
    return;
  }

  // خارج المدى: تتقدم نحو نقطة الالتفاف لا نحو مركز الهدف (القسم 5.4.4ب)
  const goal = ranged ? target : approachPoint(unit, target, range);
  if (!ranged && closeSteer(state, unit, goal, dist)) return;

  unit.repathTimer -= TICK_SEC;
  if ((!unit.path.length || unit.repathTimer <= 0) && budget.left > 0) {
    budget.left--;
    unit.repathTimer = COMBAT.repathInterval;
    const path = findPath(state.map,
      Math.round(unit.x), Math.round(unit.y),
      Math.round(goal.x), Math.round(goal.y));
    if (path) unit.path = path;
  }
}

// أطول امتداد بين حركات الوحدة: حتى لا تتوقف قبل مدى طعنتها
function longestReachAdd(unit) {
  let add = 0;
  for (const key of unit.style.moves) {
    const extra = CR.moves[key].rangeAdd;
    if (extra > add) add = extra;
  }
  return add;
}

// الاشتباك القريب: خطوة مباشرة نحو نقطة الالتفاف بلا A*
// (المسافات هنا أقل من ثلاثة مربعات، وA* عليها يكسر دوران الالتفاف ويكلف كثيراً)
function closeSteer(state, unit, goal, dist) {
  if (dist > COMBAT.flankSteerTiles) return false;
  const dx = goal.x - unit.x, dy = goal.y - unit.y;
  const need = Math.sqrt(dx * dx + dy * dy);
  if (need < UNITS.arriveDistance) return true;

  const step = Math.min(need, moveSpeed(state, unit) * TICK_SEC);
  const nx = unit.x + (dx / need) * step;
  const ny = unit.y + (dy / need) * step;
  if (!state.map.isWalkable(Math.round(nx), Math.round(ny))) return false;   // مبنى: نرجع لـ A*
  unit.x = nx; unit.y = ny;
  unit.path = [];
  return true;
}

// ضربة بعيدة: كما كانت قبل المرحلة، لكن الهدف قد يتفادى المقذوف بنصف الاحتمال
function rangedSwing(state, unit, target, damage, attackTime) {
  unit.attackCooldown = attackTime;
  unit.attackStart = state.time;
  unit.attackRate = attackTime;
  unit.ultStart = null;
  soundAt(state, 'swing', unit.x, unit.y);
  unit.pendingHit = {
    target,
    damage: damage * unit.damageMultiplier,
    ranged: true,
    at: state.time + attackTime * COMBAT.hitMoment
  };
  registerSight(state, unit, target, true);
}

// ضربة قريبة بالحركات الأربع (القسم 5.4)
function meleeSwing(state, unit, target, dist, range, damage, attackTime, aimOff) {
  // لا تبدأ الضربة قبل أن يقترب وجهها من الهدف: هذا ما يجعل الالتفاف مفيداً
  if (aimOff > CR.aimTolerance) return;

  // المستوى الإحصائي خارج الشاشة: ضربة واحدة بلا أنميشن ولا رؤية معلّقة
  if (unit.lod === 'stat') {
    unit.attackCooldown = attackTime;
    unit.attackStart = null;
    unit.pendingHit = {
      target, move: 'quick', range,
      damage: damage * unit.damageMultiplier * CR.moves.quick.dmg,
      ranged: false,
      at: state.time + attackTime * COMBAT.hitMoment
    };
    return;
  }

  // المستوى المبسّط: الضربة السريعة وحدها
  const near = unit.lod === 'simple' ? 0 : crowdCount(state, unit, isEnemy);
  const key = unit.lod === 'simple' ? 'quick' : chooseMove(unit, target, dist, near, range);
  if (!key) return;

  const phases = moveTiming(key, attackTime);
  unit.cMove = key;
  unit.cMoveT = 0;
  unit.cPhases = phases;
  // لا فاصل الآن: يُضبط عند اكتمال الحركة، فمن تفادى وألغى ضربته لا يُعاقَب بزمنها كاملاً
  unit.attackCooldown = 0;
  unit.attackStart = state.time;
  unit.attackRate = phases.total;
  unit.ultStart = null;
  soundAt(state, 'swing', unit.x, unit.y);

  unit.pendingHit = {
    target, move: key, range,
    damage: damage * unit.damageMultiplier * CR.moves[key].dmg,
    ranged: false,
    at: state.time + phases.wind + phases.strike * CR.strikeMoment
  };

  // الهدف يرى الاستعداد الآن، ويقرر بعد زمن رد فعله
  registerSight(state, unit, target, false);
}

// تتوقف وتعود لمكان بدء المطاردة (وأثناء العودة تتجاهل الأعداء حتى تصل)
// أما في الهجوم المتحرك فتواصل تقدمها نحو وجهتها بدل العودة
function returnToOrigin(state, unit) {
  if (unit.attackMove) { finishFight(state, unit); return; }

  const origin = unit.homePost || unit.chaseOrigin;
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

// ثبات الهدف (القسم 5.2): الوحدة تلتزم بهدفها ولا تبدّله لمجرد أن عدواً صار أقرب.
// الاستثناء الوحيد: إن ضربها عدو آخر وهي تقاتل هدفاً أبعد منه، تتحول للأقرب.
function retaliateIfCloser(state, attacker, target) {
  if (!attacker || !attacker.stats) return;        // نار الأرض ليست وحدة
  if (target.state !== 'attacking') return;        // في moving لا ترد على من يضربها
  if (target.commandedTarget) return;              // أمر هجوم من اللاعب: لا يُلغى
  if (!target.target) return;                      // تقاتل بلا هدف محدد بعد
  if (attacker === target.target || !isAlive(attacker)) return;
  if (distanceSq(target, attacker) >= distanceSq(target, target.target)) return;

  target.target = attacker;
  target.repathTimer = 0;
  target.path = [];
}

// صوت الارتطام حسب قوة الضربة ودرع المُصاب (القسم 13.5)
function hitSound(state, target, amount) {
  const name = target.stats.armor >= AUDIO.shieldArmor ? 'hit_shield'
             : amount >= AUDIO.heavyDamage ? 'hit_heavy' : 'hit_melee';
  const heard = soundAt(state, name, target.x, target.y);

  // تنبيه: وحدة للاعب تتعرض للهجوم خارج الشاشة (سهم أحمر + صوت يُسمع دائماً)
  if (heard || target.playerId !== state.humanId) return;
  if (raiseAlert(state, 'attack', target.x, target.y)) {
    soundAlert(state, 'alert', target.x, target.y);
  }
}

// ضربة مباشرة: قد تكون دائرية (المحطِّم) فتصيب كل الأعداء حول الهدف
// تعيد true إذا مات الهدف الأساسي (ليُدفع جسده)
function strike(state, attacker, target, amount) {
  const splash = attacker.stats.splashRadius;
  if (!splash) return applyDamage(state, attacker, target, amount);

  let died = false;
  const splashSq = splash * splash;
  forEachNearby(state, target.x, target.y, splash, (other) => {
    if (other.state === 'dead' || other.hp <= 0) return;
    if (distanceSq(other, target) > splashSq) return;
    if (!isEnemy(state, attacker, other)) return;
    const killed = applyDamage(state, attacker, other, amount);
    if (other === target) died = killed;
  });
  return died;
}

// تعيد true إذا مات الهدف بهذه الضربة
export function applyDamage(state, attacker, target, amount) {
  if (!isAlive(target)) return false;
  if (target.invulnUntil > state.time) return false;     // تصلّب: لا يتلقى ضرراً ولا يترنّح ولا يُدفع
  retaliateIfCloser(state, attacker, target);
  hitSound(state, target, amount);
  // درع الوحدة + مكافأة مراكز الشرطة المملوكة (القسم 3.8)
  const armor = Math.min(COMBAT.maxArmor, target.stats.armor + target.armorBonus);
  const taken = amount * (1 - armor);
  target.hp -= taken;
  chargeOnDamageTaken(state, target, taken);       // شحن عن كل 50 ضرراً
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
    soundAt(state, 'death', target.x, target.y);
    state.stats.kills[attacker.playerId]++;
    state.stats.losses[target.playerId]++;
    return true;
  }
  return false;
}

// --- المقذوفات ---
// offset: إزاحة جانبية عند الانطلاق حتى تتفرق السهام الثلاثة بصرياً
// fire: نار تشتعل حيث يسقط المقذوف (زجاجة رامي النار أو سهم بطل الأفاعي)
// dodgeable: المقذوف العادي وطلقة القناص المميزة يمكن تفاديهما، وبقية المقذوفات لا (القسم 5.4)
export function spawnProjectile(state, unit, target, damage, offset = 0, fire = null, dodgeable = true) {
  const dist = distance(unit, target);
  const maxRange = Math.max(unit.stats.attackRange, 0.1);
  const ratio = Math.min(1, dist / maxRange);
  const duration = COMBAT.projectileMinTime + (COMBAT.projectileMaxTime - COMBAT.projectileMinTime) * ratio;

  // في المطر تخطئ بعض الرميات فتسقط قرب الهدف بلا ضرر
  const hits = rangedShotHits(state);
  const angle = Math.random() * 6.2832;
  const spread = COMBAT.missSpread * (0.6 + Math.random() * 0.4);

  soundAt(state, unit.stats.projectile === 'stone' ? 'stone' : 'arrow', unit.x, unit.y);

  state.projectiles.push({
    kind: unit.stats.projectile,
    attacker: unit,
    target,
    damage,
    dodgeable,
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
      // المتفادي في لحظة السقوط تمر الرمية بجانبه
      const dodged = shot.dodgeable && isAlive(shot.target) && shot.target.cState === 'dodge';
      if (shot.damage > 0 && shot.hits && !dodged && isAlive(shot.target)) {
        strike(state, shot.attacker, shot.target, shot.damage);
        chargeOnHit(state, shot.attacker);
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
  for (const unit of state.units) {
    if (unit.state === 'dead' && unit.deathTimer <= 0) releaseRagdoll(state, unit);
  }
  state.units = state.units.filter(u => !(u.state === 'dead' && u.deathTimer <= 0));
}
