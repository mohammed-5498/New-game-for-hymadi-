// الطبقة التكتيكية للبوتات (القسم 11.2): تدير كل اشتباك
// - اختيار الهدف (تركيز الضرب): يحدث فقط حين تحتاج الوحدة هدفاً جديداً، فيبقى ثبات الهدف كما هو
// - الضربات المميزة الذكية: تُمسك الضربة حتى يستحق الموقف
// - كل 0.25 ث لكل فرقة مشتبكة فقط: حماية الرماة، سحب المصابين، موضع البطل
import { ai, MAP_GEN } from '../config.js';
import { commandMove } from '../game/units.js';
import { isEnemy } from '../game/combat.js';
import { forEachNearby } from '../game/spatialHash.js';
import { levelOf, note } from './squads.js';

const isAlive = (unit) => unit && unit.state !== 'dead' && unit.hp > 0;

// المستوى التكتيكي لصاحب الوحدة: null للاعب البشري والشرطة والسهل
function tacticsFor(state, unit) {
  const player = state.players[unit.playerId];
  if (!player || player.isHuman || player.neutral) return null;
  const lvl = levelOf(player);
  return lvl.squads ? lvl : null;
}

const priority = (target) =>
  target.hero === 'medic' || target.hero === 'sniper' ||
  (target.champion && target.hp < target.maxHp * ai.woundedHero);

// --- تركيز الضرب: الأسهل قتلاً (أقل دم فعلي بعد الدرع)، والأولوية للطبيب والقناص والبطل المصاب،
// وبحد أقصى 3 مهاجمين من نفس اللاعب على الهدف الواحد ---
// يعيد undefined حين لا ينطبق (فيبقى الاختيار العادي: الأقرب)
export function pickTarget(state, unit, vision) {
  if (unit.focusHeroes) return heroFirst(state, unit, vision);
  const lvl = tacticsFor(state, unit);
  if (!lvl || !lvl.focus) return undefined;

  // المرشحون داخل مدى الضرب فقط (لا تطارد هدفاً بعيداً لأنه أضعف)، وإلا فالاختيار العادي
  const reach = Math.min(vision, (unit.stats.attackRange || 1) + ai.focusReach);
  let best = null, bestScore = Infinity;
  let crowded = null, crowdedScore = Infinity;    // احتياط: كل الأهداف عليها 3 مهاجمين
  forEachNearby(state, unit.x, unit.y, reach, (other) => {
    if (other === unit || !isAlive(other) || !isEnemy(state, unit, other)) return;
    const d = Math.hypot(other.x - unit.x, other.y - unit.y);
    if (d >= reach) return;
    const ehp = other.hp / Math.max(0.05, 1 - (other.stats.armor || 0));
    const score = d + ehp / ai.ehpScale - (priority(other) ? ai.priorityBonus : 0);
    if (score >= bestScore && score >= crowdedScore) return;
    if (attackersOn(state, unit.playerId, other) >= ai.maxAttackersPerTarget) {
      if (score < crowdedScore) { crowdedScore = score; crowded = other; }
      return;
    }
    if (score < bestScore) { bestScore = score; best = other; }
  });
  return best || crowded || undefined;
}

// شرطة الصمود من الموجة 10: الأبطال والمميزون أولاً داخل الرؤية، ثم الأقرب
function heroFirst(state, unit, vision) {
  let best = null, bestScore = Infinity;
  forEachNearby(state, unit.x, unit.y, vision, (other) => {
    if (other === unit || !isAlive(other) || !isEnemy(state, unit, other)) return;
    const d = Math.hypot(other.x - unit.x, other.y - unit.y);
    if (d >= vision) return;
    const score = d - (other.champion ? 6 : other.hero ? 4 : 0);
    if (score < bestScore) { bestScore = score; best = other; }
  });
  return best || undefined;
}

// كم وحدة من نفس اللاعب تضرب هذا الهدف الآن (بحث محلي حوله فقط)
function attackersOn(state, playerId, target) {
  let count = 0;
  forEachNearby(state, target.x, target.y, 3, (unit) => {
    if (unit.playerId === playerId && unit.target === target && unit.state === 'attacking') count++;
  });
  return count;
}

// --- الضربات المميزة الذكية: الدائرية والأرضية والحريق عند 3 أعداء فأكثر،
// والعلاج الجماعي عند حليفين مصابين فأكثر، والتصلّب عند الضرب من أكثر من عدو ---
// (المتوسط "جزئياً": الدائرية والحريق فقط؛ والسهل يطلقها حين تمتلئ)
export function ultAllowed(state, unit, ult, target) {
  const lvl = tacticsFor(state, unit);
  if (!lvl || !lvl.smartUlts) return true;
  const full = lvl.smartUlts === 'full';
  // ينتظر اللحظة الأفضل بضع ثوان، ثم يطلقها على أي حال حتى لا تضيع في قتال صغير
  if (unit.ultHeldSince === undefined || unit.ultHeldSince < 0) unit.ultHeldSince = state.time;
  if (state.time - unit.ultHeldSince >= ai.ultHoldSeconds) { unit.ultHeldSince = -1; return true; }
  const ok = goodMoment(state, unit, ult, target, full);
  if (ok) unit.ultHeldSince = -1;
  return ok;
}

function goodMoment(state, unit, ult, target, full) {
  if (ult.kind === 'slam' || ult.kind === 'arc') {
    return countAround(state, unit, unit, ult.radius, true) >= ai.aoeMinEnemies;
  }
  if (ult.kind === 'fire') {
    const spot = target || unit;
    return countAround(state, unit, spot, ult.fire.radius, true) >= ai.aoeMinEnemies;
  }
  if (!full) return true;
  if (ult.kind === 'heal') {
    let wounded = 0;
    forEachNearby(state, unit.x, unit.y, ult.radius, (other) => {
      if (!isAlive(other) || isEnemy(state, unit, other)) return;
      if (Math.hypot(other.x - unit.x, other.y - unit.y) > ult.radius) return;
      if (other.hp < other.maxHp * 0.75) wounded++;
    });
    return wounded >= ai.healMinWounded;
  }
  if (ult.kind === 'harden') {
    let attackers = 0;
    forEachNearby(state, unit.x, unit.y, 3, (other) => {
      if (other.target === unit && isAlive(other)) attackers++;
    });
    return attackers >= ai.hardenMinAttackers;
  }
  return true;
}

function countAround(state, unit, spot, radius, enemies) {
  let n = 0;
  forEachNearby(state, spot.x, spot.y, radius, (other) => {
    if (!isAlive(other) || isEnemy(state, unit, other) !== enemies) return;
    if (Math.hypot(other.x - spot.x, other.y - spot.y) <= radius) n++;
  });
  return n;
}

// --- كل 0.25 ث لكل فرقة مشتبكة: الرماة والمصابون والبطل (صعب فما فوق للأولين) ---
export function updateTactics(state) {
  if (!state.botBrains) return;
  // كل 0.25 ث مرة واحدة لكل الفرق المشتبكة (لا لكل وحدة في كل تحديث)
  const tickN = Math.round(state.time / 0.05);
  const every = Math.max(1, Math.round(ai.tacticSeconds / 0.05));
  if (tickN % every !== 0) return;
  let byId = null;
  for (const key of Object.keys(state.botBrains)) {
    const player = state.players[key];
    if (!player) continue;
    const lvl = levelOf(player);
    if (!lvl.squads) continue;
    for (const squad of state.botBrains[key].squads) {
      if (!byId) byId = new Map(state.units.map(u => [u.id, u]));
      const members = [];
      for (const id of squad.units) {
        const unit = byId.get(id);
        if (unit && isAlive(unit) && unit.botTask && unit.botTask.squadId === squad.id) members.push(unit);
      }
      if (!members.some(u => u.state === 'attacking')) continue;   // غير مشتبكة: لا شيء
      engage(state, player, lvl, members);
    }
  }
}

function engage(state, player, lvl, members) {
  let ci = 0, cj = 0;
  for (const u of members) { ci += u.x; cj += u.y; }
  ci /= members.length; cj /= members.length;

  for (const unit of members) {
    // سحب المصابين: تحت 30% دم نحو الطبيب أو المستشفى
    if (lvl.pullWounded && unit.hp < unit.maxHp * ai.woundedRatio && !unit.champion) {
      const spot = healSpot(state, player, unit);
      if (spot) {
        unit.botTask = { type: 'regroup', until: state.time + 8 };
        note(state, player, 'wounded');
        commandMove(state, spot.i, spot.j, [unit], false);
        continue;
      }
    }
    // حماية الرماة: خطوة للخلف إن اقترب عدو قريب
    if (lvl.protectRanged && unit.stats.projectile && !unit.pendingHit && state.time - (unit.kiteAt || -99) >= ai.kiteCooldown) {
      const threat = nearestEnemy(state, unit, ai.kiteDistance);
      if (threat) {
        const dx = unit.x - threat.x, dy = unit.y - threat.y;
        const len = Math.hypot(dx, dy) || 1;
        unit.kiteAt = state.time;
        note(state, player, 'kite');
        commandMove(state, unit.x + dx / len * ai.kiteStep, unit.y + dy / len * ai.kiteStep, [unit], false);
        continue;
      }
    }
    // البطل قرب مركز فرقته لا في مقدمتها (إلا ذو الدرع)
    if (unit.champion && (unit.stats.armor || 0) < ai.armoredHero && unit.state !== 'attacking' &&
        Math.hypot(unit.x - ci, unit.y - cj) > ai.heroBehind * 2) {
      commandMove(state, ci, cj, [unit], false);
    }
  }
}

function nearestEnemy(state, unit, radius) {
  let best = null, bestD = radius;
  forEachNearby(state, unit.x, unit.y, radius, (other) => {
    if (!isAlive(other) || !isEnemy(state, unit, other) || other.stats.projectile) return;
    const d = Math.hypot(other.x - unit.x, other.y - unit.y);
    if (d < bestD) { bestD = d; best = other; }
  });
  return best;
}

// أقرب طبيب حليف، وإلا أقرب مستشفى يملكه اللاعب
function healSpot(state, player, unit) {
  let best = null, bestD = Infinity;
  for (const other of state.units) {
    if (other.playerId !== player.id || other.hero !== 'medic' || !isAlive(other) || other === unit) continue;
    const d = Math.hypot(other.x - unit.x, other.y - unit.y);
    if (d < bestD) { bestD = d; best = { i: other.x, j: other.y }; }
  }
  for (const d of state.map.districts) {
    if (d.special !== 'hospital' || d.owner !== player.id || !d.capture) continue;
    const dd = Math.hypot(d.capture.i - unit.x, d.capture.j - unit.y);
    if (dd < bestD) { bestD = dd; best = { i: d.capture.i, j: d.capture.j }; }
  }
  return best && bestD > MAP_GEN.captureRadius ? best : null;
}
