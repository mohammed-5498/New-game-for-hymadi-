// البوتات: دفاع ثم توسع ثم هجوم، بثلاث درجات صعوبة، مع احترام التحالفات
import { TICK_SEC, BOT, SNOWBALL, MAP_GEN, gameModes as GM } from '../config.js';
import { isFinalMinute, sideTotals, sideKey, hillOf } from '../game/modes.js';
import { commandMove, commandAttackMove } from '../game/units.js';
import { isEnemy } from '../game/combat.js';
import { ownedDistricts } from '../game/spawn.js';
import { forEachNearby } from '../game/spatialHash.js';

export function initBots(state) {
  // نوزّع أوقات القرار حتى لا تفكر كل البوتات في نفس اللحظة
  state.botTimers = state.players.map(p =>
    p.isHuman || p.neutral ? 0 : Math.random() * BOT[p.difficulty || 'medium'].decisionInterval);
}

export function updateBots(state) {
  for (const player of state.players) {
    if (player.isHuman || player.neutral) continue;   // الشرطة لا تُقاد ببوت
    const config = BOT[player.difficulty || 'medium'];

    state.botTimers[player.id] -= TICK_SEC;
    if (state.botTimers[player.id] > 0) continue;
    state.botTimers[player.id] = config.decisionInterval;

    decide(state, player, modeConfig(state, config));
  }
}

// أولويات البوت حسب الطور (القسم 9.5): لا يبقى بسلوك السيطرة الكاملة في كل طور
function modeConfig(state, config) {
  if (state.mode === 'points') {
    // توسع مبكر وقوي، ودفاع عن الأحياء أكثر من مهاجمة الخصوم
    const P = GM.points;
    return {
      ...config,
      expandGroup: Math.min(config.groupSize, P.botExpandGroup),
      defenseFactor: config.defenseFactor * P.botDefenseBoost,
      attackArmy: Math.ceil(config.attackArmy * P.botAttackArmyFactor)
    };
  }
  return config;
}

const isAlive = (unit) => unit.state !== 'dead' && unit.hp > 0;
const distanceTo = (unit, district) => Math.hypot(unit.x - district.capture.i, unit.y - district.capture.j);

function decide(state, player, config) {
  const units = state.units.filter(u => u.playerId === player.id && isAlive(u));
  if (!units.length) return;

  // الوحدات المشتبكة تُترك تقاتل؛ نوزّع المهام على الباقي
  const free = [];
  for (const unit of units) {
    if (taskStillValid(state, unit)) continue;
    unit.botTask = null;                 // مهمة قديمة لم تعد صالحة
    if (unit.state !== 'attacking') free.push(unit);
  }
  if (!free.length) return;

  const pool = { units: free };
  const owned = ownedDistricts(state, player.id);

  if (config.retreatWounded) retreatWounded(state, player, config, pool, owned);
  // ملك الحي: التلة أولويتها القصوى، قبل الدفاع عن بقية الأحياء
  if (state.mode === 'king') kingPlan(state, player, config, pool, units.length);
  defend(state, player, config, pool, owned);
  // الوقت بالنقاط: في الدقيقة الأخيرة كل الباقين على أضعف حي للمتصدر
  if (isFinalMinute(state)) strikeLeader(state, player, config, pool);
  expand(state, player, config, pool);
  attack(state, player, config, pool, units.length);
}

// --- هل ما زالت مهمة الوحدة الحالية منطقية؟ ---
function taskStillValid(state, unit) {
  const task = unit.botTask;
  if (!task) return false;
  const district = state.map.districts[task.districtId];
  if (!district) return false;

  if (task.type === 'defend') {
    return district.owner === unit.playerId && districtThreat(state, district, unit.playerId) > 0;
  }
  if (task.type === 'expand') {
    return district.owner === null;
  }
  if (task.type === 'attack') {
    return district.owner !== null && district.owner !== unit.playerId &&
           isEnemy(state, unit, { playerId: district.owner });
  }
  if (task.type === 'heal') {
    return unit.hp < unit.maxHp && district.owner === unit.playerId;
  }
  // ملك الحي: من وصل التلة يبقى فيها يقاتل ويحميها، والحرس يبقى في حيه
  if (task.type === 'hill') return state.mode === 'king';
  if (task.type === 'guard') return district.owner === unit.playerId;
  return false;
}

// عدد أعداء اللاعب قرب حيّه (بحث في الخلايا المجاورة فقط)
function districtThreat(state, district, playerId) {
  const radius = MAP_GEN.captureRadius * 2;
  let count = 0;
  forEachNearby(state, district.capture.i, district.capture.j, radius, (unit) => {
    if (!isAlive(unit)) return;
    if (!isEnemy(state, { playerId }, unit)) return;
    if (distanceTo(unit, district) <= radius) count++;
  });
  return count;
}

// --- 1) الدفاع: أقرب مجموعة كافية للحي المهدد ---
function defend(state, player, config, pool, owned) {
  const threatened = owned
    .map(d => ({ district: d, threat: districtThreat(state, d, player.id) }))
    .filter(entry => entry.threat > 0)
    .sort((a, b) => b.threat - a.threat);

  for (const { district, threat } of threatened) {
    if (!pool.units.length) return;
    const needed = Math.max(config.groupSize, Math.ceil(threat * config.defenseFactor));
    const group = takeNearest(pool, district, needed, config, false);
    if (group.length) sendGroup(state, group, district, config, 'defend');
  }
}

// --- 2) التوسع: الأحياء المحايدة الأقرب، والمميزة لها أولوية ---
function expand(state, player, config, pool) {
  if (!pool.units.length) return;
  const center = groupCenter(pool.units);

  const targets = state.map.districts
    .filter(d => d.capture && d.owner === null)
    .sort((a, b) => {
      const special = (b.special ? 1 : 0) - (a.special ? 1 : 0);
      if (special) return special;
      return Math.hypot(a.capture.i - center.i, a.capture.j - center.j) -
             Math.hypot(b.capture.i - center.i, b.capture.j - center.j);
    });

  const size = config.expandGroup || config.groupSize;
  for (const district of targets) {
    if (pool.units.length < size) return;
    const group = takeNearest(pool, district, size, config, false);
    if (group.length) sendGroup(state, group, district, config, 'expand');
  }
}

// --- ملك الحي: حرس صغير للحي المنزلي، وأغلب الباقين إلى التلة بهجوم متحرك ---
function kingPlan(state, player, config, pool, armySize) {
  const hill = hillOf(state);
  if (!hill || !pool.units.length) return;
  const K = GM.king;

  // الحرس: الأقرب للحي المنزلي، قوة صغيرة لا تزيد على 20% من الجيش
  const home = state.map.districts[player.homeDistrictId];
  const wanted = Math.min(K.botHomeGuard, Math.floor(armySize * K.botHomeGuardShare));
  const guarding = state.units.filter(u => u.playerId === player.id && u.state !== 'dead' && u.botTask && u.botTask.type === 'guard').length;
  if (home && home.owner === player.id && guarding < wanted) {
    const guards = takeNearest(pool, home, wanted - guarding, config, false);
    for (const unit of guards) unit.botTask = { type: 'guard', districtId: home.id };
    if (guards.length) commandMove(state, home.capture.i, home.capture.j, guards, false);
  }

  // التلة: نسبة كبيرة من المتاح، بهجوم متحرك حتى يقاتلوا من يعترضهم
  const count = Math.ceil(pool.units.length * K.botHillShare);
  const group = takeNearest(pool, hill, count, config, true);
  if (!group.length) return;
  for (const unit of group) unit.botTask = { type: 'hill', districtId: hill.id };
  commandAttackMove(state, hill.capture.i, hill.capture.j, group, false);
}

// --- الدقيقة الأخيرة في الوقت بالنقاط: أضعف حي يملكه المتصدر (أقل مدافعين) ---
function strikeLeader(state, player, config, pool) {
  if (!pool.units.length) return;
  const mySide = sideKey(player);
  const leader = sideTotals(state)
    .filter(s => s.alive && s.key !== mySide)
    .sort((a, b) => b.points - a.points)[0];
  if (!leader) return;
  const ids = new Set(leader.players.map(p => p.id));

  let best = null, fewest = Infinity;
  for (const district of state.map.districts) {
    if (!district.capture || !ids.has(district.owner)) continue;
    let defenders = 0;
    forEachNearby(state, district.capture.i, district.capture.j, MAP_GEN.captureRadius * 2, (unit) => {
      if (ids.has(unit.playerId) && isAlive(unit)) defenders++;
    });
    if (defenders < fewest) { fewest = defenders; best = district; }
  }
  if (!best) return;
  while (pool.units.length) {
    const group = takeNearest(pool, best, config.groupSize, config, true);
    if (!group.length) break;
    sendGroup(state, group, best, config, 'attack');
  }
}

// --- 3) الهجوم: عندما يصبح الجيش كافياً ---
function attack(state, player, config, pool, armySize) {
  if (armySize < config.attackArmy || pool.units.length < config.groupSize) return;

  const targets = enemyDistricts(state, player);
  if (!targets.length) return;

  const center = groupCenter(pool.units);
  const leader = strongestPlayer(state, player);   // قاعدة منع الاكتساح

  targets.sort((a, b) => {
    if (leader !== null) {
      const priority = (a.owner === leader ? 0 : 1) - (b.owner === leader ? 0 : 1);
      if (priority) return priority;
    }
    // وإلا: الأقرب، ومن يملك أحياء أقل (الأضعف) أولاً
    const weak = ownedCount(state, a.owner) - ownedCount(state, b.owner);
    const distance = Math.hypot(a.capture.i - center.i, a.capture.j - center.j) -
                     Math.hypot(b.capture.i - center.i, b.capture.j - center.j);
    return distance + weak * 3;
  });

  // الصعب يركز كل هجماته على هدف واحد
  const chosen = config.focusTarget ? [targets[0]] : targets;
  for (const district of chosen) {
    while (pool.units.length >= config.groupSize) {
      const group = takeNearest(pool, district, config.groupSize, config, true);
      if (!group.length) break;
      sendGroup(state, group, district, config, 'attack');
      if (!config.focusTarget) break;
    }
    if (pool.units.length < config.groupSize) break;
  }
}

// --- سحب المصابين إلى المستشفى (الصعب فقط) ---
function retreatWounded(state, player, config, pool, owned) {
  const hospital = owned.find(d => d.special === 'hospital');
  if (!hospital) return;

  const wounded = pool.units.filter(u => u.hp < u.maxHp * config.retreatHpRatio);
  for (const unit of wounded) {
    pool.units.splice(pool.units.indexOf(unit), 1);
    unit.botTask = { type: 'heal', districtId: hospital.id };
    commandMove(state, hospital.capture.i, hospital.capture.j, [unit], false);   // أوامر البوت بلا حلقة
  }
}

// يأخذ أقرب الوحدات من المجموعة المتاحة
function takeNearest(pool, district, count, config, isAttack) {
  const candidates = pool.units.filter(u => {
    // الزعيم لا يخرج للهجوم إلا مع مجموعة كبيرة (الصعب)
    if (isAttack && u.stats.aura && count < config.bossMinGroup) return false;
    return true;
  });

  candidates.sort((a, b) => distanceTo(a, district) - distanceTo(b, district));
  const group = candidates.slice(0, count);
  for (const unit of group) pool.units.splice(pool.units.indexOf(unit), 1);
  return group;
}

// يرسل المجموعة، ويضع الرماة خلف المقاتلين عند الصعب
function sendGroup(state, group, district, config, taskType) {
  for (const unit of group) unit.botTask = { type: taskType, districtId: district.id };

  const front = config.rangedBehind ? group.filter(u => !u.stats.projectile) : group;
  const back = config.rangedBehind ? group.filter(u => u.stats.projectile) : [];

  if (front.length) commandMove(state, district.capture.i, district.capture.j, front, false);

  if (back.length) {
    const center = groupCenter(back);
    const dx = center.i - district.capture.i, dy = center.j - district.capture.j;
    const length = Math.hypot(dx, dy) || 1;
    const i = district.capture.i + (dx / length) * config.rangedOffset;
    const j = district.capture.j + (dy / length) * config.rangedOffset;
    commandMove(state, i, j, back, false);
  }
}

function groupCenter(units) {
  let i = 0, j = 0;
  for (const unit of units) { i += unit.x; j += unit.y; }
  return { i: i / units.length, j: j / units.length };
}

function enemyDistricts(state, player) {
  return state.map.districts.filter(d =>
    d.capture && d.owner !== null && d.owner !== player.id &&
    isEnemy(state, { playerId: player.id }, { playerId: d.owner }));
}

function ownedCount(state, playerId) {
  return state.map.districts.filter(d => d.owner === playerId).length;
}

// قاعدة منع الاكتساح: من يملك 40% من الأحياء يصير الهدف الأول
export function strongestPlayer(state, player) {
  const total = state.map.districts.filter(d => d.capture).length;
  if (!total) return null;

  for (const other of state.players) {
    if (other.id === player.id) continue;
    if (!isEnemy(state, { playerId: player.id }, { playerId: other.id })) continue;
    if (ownedCount(state, other.id) / total >= SNOWBALL.districtShare) return other.id;
  }
  return null;
}
