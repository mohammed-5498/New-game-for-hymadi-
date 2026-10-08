// الطبقة الاستراتيجية للبوتات (القسم 11.1): الجيش فرق لا أفراد
// - خريطة القوى: قوة كل لاعب حول كل حي (نصف قطر 5)، والوحدة بقيمتها × نسبة دمها
// - الوحدات الحرة تتجمع عند نقطة تجمّع، ولا تنطلق فرقة إلا حين تبلغ حدها الأدنى
//   (أو أقل إن كان الهدف سهلاً: حي خالٍ من المدافعين)
// - الهدف بالنقاط: قيمة الحي ÷ المسافة، بشرط قوة ≥ 1.3 × المدافعين
// - الدفاع بلا إفراط، والانسحاب، والجبهتان، والإغارة على الأحياء الخالية (صعب فما فوق)
// حالة كل بوت بيانات بسيطة في state.botBrains (أرقام الوحدات لا مراجعها) فتُحفظ مع المباراة.
import { ai } from '../config.js';
import { commandMove, commandAttackMove } from '../game/units.js';
import { isEnemy, isEnemyId } from '../game/combat.js';
import { forEachNearby, hashCells, cellBox } from '../game/spatialHash.js';
import { hypot } from '../game/hypot.js';

const isAlive = (unit) => unit.state !== 'dead' && unit.hp > 0;
const dist = (a, b) => hypot(a.i - b.i, a.j - b.j);
// بُعد الوحدة عن نقطة {i, j}: نفس dist({i: x, j: y}, p) بلا كائن مؤقت
const distU = (unit, p) => hypot(unit.x - p.i, unit.y - p.j);

// ترتيب بمفتاح يُحسب مرة لكل عنصر: نفس نتيجة sort بمقارنة (مفتاح أ - مفتاح ب) تماماً
// (الترتيب ثابت ونفس المقارنات بنفس القيم)، لكن بلا حساب المسافة مرتين في كل مقارنة
function sortedBy(list, key) {
  const items = list.map(u => [key(u), u]);
  items.sort((a, b) => a[0] - b[0]);
  return items.map(x => x[1]);
}

export const levelOf = (player) => ai.levels[player.difficulty] || ai.levels.medium;
// رقم خاص بالمستوى إن وُجد في ai.levels، وإلا الرقم العام في ai
const param = (lvl, key) => lvl[key] ?? ai[key];

// قيمة الوحدة في خريطة القوى: الفرد 1، المميز 3، البطل 5، مضروبة في نسبة دمها
export function unitValue(unit) {
  const v = ai.unitValue;
  const base = unit.champion ? v.champion : unit.hero ? v.hero : v.unit;
  return base * Math.max(0, unit.hp) / unit.maxHp;
}

function brainOf(state, player) {
  if (!state.botBrains) state.botBrains = {};
  if (!state.botBrains[player.id]) state.botBrains[player.id] = { playerId: player.id, squads: [], nextId: 1, rallyId: -1 };
  return state.botBrains[player.id];
}

export function squadOf(state, unit) {
  const task = unit.botTask;
  if (!task || task.type !== 'squad' || !state.botBrains) return null;
  const brain = state.botBrains[unit.playerId];
  return brain ? brain.squads.find(s => s.id === task.squadId) || null : null;
}

// --- لقطة أرقام للوحدات في التحديث (البوتات وحدها تسألها، وكلها في مرحلة البوتات حيث لا تتحرك وحدة):
// المواقع واللاعب والحياة والقيمة في مصفوفات بترتيب خلايا الشبكة نفسه، فالمسح حلقة أرقام بلا استدعاءات
let snap = { state: null, time: -1 };

function aiSnapshot(state) {
  const H = hashCells(state);
  if (snap.state === state && snap.time === state.time && snap.cells === H) return snap;
  const n = H.list.length;
  const xs = new Float64Array(n), ys = new Float64Array(n), pids = new Int32Array(n), alive = new Uint8Array(n), values = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const u = H.list[k];
    xs[k] = u.x; ys[k] = u.y; pids[k] = u.playerId;
    if (isAlive(u)) { alive[k] = 1; values[k] = unitValue(u); }
  }
  snap = { state, time: state.time, cells: H, xs, ys, pids, alive, values };
  return snap;
}

// كل وحدة حية في خلايا الدائرة بترتيب forEachNearby: fn(k) برقمها في اللقطة
function scanAround(S, x, y, radius, fn) {
  const H = S.cells;
  const [minI, maxI, minJ, maxJ] = cellBox(x, y, radius);
  for (let ci = Math.max(minI, H.minI); ci <= Math.min(maxI, H.maxI); ci++) {
    const row = (ci - H.minI) * H.h;
    for (let cj = Math.max(minJ, H.minJ); cj <= Math.min(maxJ, H.maxJ); cj++) {
      const c = row + (cj - H.minJ);
      for (let k = H.start[c], end = H.start[c + 1]; k < end; k++) if (S.alive[k]) fn(k);
    }
  }
}

// --- خريطة القوى: تُحسب مرة واحدة في التحديث مهما تعددت البوتات ---
let cache = { state: null, time: -1, power: null };

function powerMap(state) {
  if (cache.state === state && cache.time === state.time) return cache.power;
  const R = ai.powerRadius, n = state.players.length;
  const S = aiSnapshot(state);
  const power = new Map();
  for (const d of state.map.districts) {
    if (!d.capture) continue;
    const row = new Float32Array(n);
    const { i, j } = d.capture;
    scanAround(S, i, j, R, (k) => {
      const dx = S.xs[k] - i, dy = S.ys[k] - j;
      if (dx * dx + dy * dy <= R * R) row[S.pids[k]] += S.values[k];
    });
    power.set(d.id, row);
  }
  cache = { state, time: state.time, power };
  return power;
}

// قوة أعداء اللاعب وقوة جانبه حول حي
function sidePowers(state, player, district) {
  const row = powerMap(state).get(district.id);
  let enemy = 0, mine = 0;
  if (!row) return { enemy, mine };
  for (let p = 0; p < row.length; p++) {
    if (!row[p]) continue;
    if (isEnemyId(state, player.id, p)) enemy += row[p];
    else mine += row[p];
  }
  return { enemy, mine };
}

// قوة الأعداء حول نقطة (للانسحاب والتوسع والهجوم)، محفوظة طوال التحديث الواحد:
// نفس السؤال يتكرر كثيراً بين الأهداف والفرق، والجواب لا يتغير داخل التحديث
let aroundCache = { state: null, time: -1, map: new Map() };

function enemyPowerAround(state, player, point, radius) {
  if (aroundCache.state !== state || aroundCache.time !== state.time) {
    aroundCache = { state, time: state.time, map: new Map() };
  }
  const key = player.id + '|' + Math.round(point.i * 2) + ',' + Math.round(point.j * 2) + '|' + radius;
  const hit = aroundCache.map.get(key);
  if (hit !== undefined) return hit;
  const value = enemyPowerAroundNow(state, player, point, radius);
  aroundCache.map.set(key, value);
  return value;
}

function enemyPowerAroundNow(state, player, point, radius) {
  // الوحدات الحية داخل الدائرة بقيمها، مشتركة بين البوتات في نفس التحديث (نفس النقطة بالضبط ونفس نصف القطر):
  // كل بوت يجمع قيم أعدائه منها بنفس ترتيب البحث، فالمجموع مطابق تماماً للحساب المباشر
  const near = unitsAround(state, point.i, point.j, radius);
  const ids = near.ids, values = near.values;
  let total = 0;
  for (let k = 0; k < ids.length; k++) if (isEnemyId(state, player.id, ids[k])) total += values[k];
  return total;
}

let nearCache = { state: null, time: -1, map: new Map() };

function unitsAround(state, i, j, radius) {
  if (nearCache.state !== state || nearCache.time !== state.time) nearCache = { state, time: state.time, map: new Map() };
  const key = i + ',' + j + ',' + radius;
  let near = nearCache.map.get(key);
  if (near) return near;
  // مقارنة مربعة سريعة، وhypot الدقيق فقط قرب الحافة: نفس قرار (hypot <= radius) بالضبط
  const inside = radius * radius * (1 - 1e-9), outside = radius * radius * (1 + 1e-9);
  const S = aiSnapshot(state);
  if (scratchIds.length < S.xs.length) { scratchIds = new Int32Array(S.xs.length); scratchValues = new Float64Array(S.xs.length); }
  let count = 0;
  scanAround(S, i, j, radius, (k) => {
    const dx = S.xs[k] - i, dy = S.ys[k] - j, d2 = dx * dx + dy * dy;
    if (d2 > outside) return;
    if (d2 >= inside && !(hypot(dx, dy) <= radius)) return;
    scratchIds[count] = S.pids[k];
    scratchValues[count++] = S.values[k];
  });
  // نسخة بطولها بالضبط (مصفوفات أرقام لا مصفوفات عادية تكبر عنصراً عنصراً)
  near = { ids: scratchIds.slice(0, count), values: scratchValues.slice(0, count) };
  nearCache.map.set(key, near);
  return near;
}
let scratchIds = new Int32Array(0), scratchValues = new Float64Array(0);

// عدّاد أحداث الذكاء لكل لاعب (للقياس والاختبارات): انسحاب، إغارة، جبهتان...
export function note(state, player, key) {
  if (!state.aiEvents) state.aiEvents = {};
  const row = state.aiEvents[player.id] || (state.aiEvents[player.id] = {});
  row[key] = (row[key] || 0) + 1;
}

const powerOf = (units) => units.reduce((sum, u) => sum + unitValue(u), 0);

function center(units) {
  let i = 0, j = 0;
  for (const u of units) { i += u.x; j += u.y; }
  return { i: i / units.length, j: j / units.length };
}

// ================= القرار الاستراتيجي =================
// pool: الوحدات الحرة بعد أولويات الطور (لا مهمة صالحة لها ولا تقاتل الآن)
export function decideSquads(state, player, config, pool, units, owned, helpers) {
  const lvl = levelOf(player);
  const brain = brainOf(state, player);
  const byId = new Map(units.map(u => [u.id, u]));

  updateSquads(state, player, lvl, brain, byId, owned, pool);
  defend(state, player, lvl, brain, pool, owned);
  if (param(lvl, 'reinforce')) reinforce(state, player, lvl, brain, byId, pool);

  const rally = rallyPoint(state, player, brain, owned);
  if (!rally) return;
  const targets = targetList(state, player, lvl, units.length, helpers);

  // الأهداف السهلة (أحياء خالية من المدافعين): فرقة صغيرة من أقرب الوحدات، بلا انتظار التجمع
  // الإغارة على أحياء العدو الخالية للصعب فما فوق، والأسرع أولاً
  // - حي آمن (لا عدو في نطاق واسع): وحدة واحدة، من أي مكان، وبلا حد (توسع متوازٍ سريع)
  // - حي فيه خطر: فرقة تكبر حتى تفوق الأعداء الجائلين قربه، من غير المتجمعين، وبعدد فرق محدود
  let small = brain.squads.filter(s => (s.type === 'expand' || s.type === 'raid') && s.units.length > 1).length;
  // الأقرب أولاً، مع تفضيل ما يبعد عن العدو: نتوسع إلى الخلف ونقاتل قرب أحيائنا
  const away = awayScore(state, player, lvl, rally);
  const easyTargets = targets.filter(t => t.enemy === 0 && t.easy &&
      !brain.squads.some(s => s.targetId === t.district.id))
    .sort((a, b) => away(a.district) - away(b.district));
  for (const t of easyTargets) {
    if (!pool.length) break;
    const raid = t.district.owner !== null;
    const capture = t.district.capture;
    const order = (list) => sortedBy(list, (u) => distU(u, capture) + (raid ? fastFirst(u) : 0));

    if (!raid && enemyPowerAround(state, player, capture, param(lvl, 'soloSafeRadius')) === 0) {
      const [unit] = order(pool);
      removeFrom(pool, [unit]);
      launch(state, brain, [unit], t.district, raid ? 'raid' : 'expand', lvl, false);
      continue;
    }
    if (small >= param(lvl, 'maxSmallSquads')) continue;
    const danger = enemyPowerAround(state, player, capture, ai.dangerRadius);
    const size = raid ? ai.raidSize : ai.expandSize;      // الإغارة فرقة سريعة لا وحدة وحيدة
    const group = [];
    let power = 0;
    for (const unit of order(pool.filter(u => distU(u, rally.capture) > ai.rallyRadius))) {
      if (group.length >= size && power >= ai.attackRatio * danger) break;
      group.push(unit);
      power += unitValue(unit);
    }
    if (group.length < size || power < ai.attackRatio * danger) continue;
    removeFrom(pool, group);
    small++;
    launch(state, brain, group, t.district, raid ? 'raid' : 'expand', lvl, true);
  }

  // الباقون يتجمعون عند نقطة التجمع
  const gathered = [];
  for (const unit of pool) {
    const d = distU(unit, rally.capture);
    if (d <= ai.rallyRadius) { gathered.push(unit); continue; }
    if (unit.gatherRally !== rally.id || unit.state === 'idle') {
      unit.gatherRally = rally.id;
      commandMove(state, rally.capture.i, rally.capture.j, [unit], false);
    }
  }

  // فرقة الهجوم: حين يبلغ المتجمعون الحد الأدنى
  const minSquad = lvl.minSquad;
  const capped = units.length >= state.maxUnits * 0.9;      // بلغ الحد الأقصى: لا فائدة من الانتظار
  if (gathered.length < Math.min(minSquad, capped ? 1 : minSquad)) {
    // لم يكتمل الحد الأدنى للهجوم: المتجمعون يتوسعون معاً كمجموعة واحدة (لا فرادى) إلى أقرب حي آمن
    if (param(lvl, 'groupExpand') && gathered.length >= ai.expandSize) groupExpand(state, player, lvl, brain, gathered, pool, targets, rally);
    return;
  }
  const power = powerOf(gathered);
  // كل الأهداف بالنقاط (القيمة ÷ المسافة) بشرط التفوق 1.3، والخالي يحققه دائماً
  const fits = targets.filter(t => power >= ai.attackRatio * t.enemy)
    .map(t => ({ ...t, score: t.value / (dist(rally.capture, t.district.capture) + 5) }))
    .sort((a, b) => b.score - a.score);
  let chosen = fits[0];
  if (!chosen && capped) {
    // الجيش كله متجمع ولا هدف بشرط التفوق: الأضعف دفاعاً
    chosen = targets.filter(t => t.enemy > 0).sort((a, b) => a.enemy - b.enemy)[0];
  }
  if (!chosen) return;

  // جبهتان (صعب فما فوق): حيان متباعدان في وقت واحد إن كانت القوة تكفي الاثنين
  if (lvl.twoFronts && Math.random() < ai.twoFrontChance) {
    const second = fits.find(t => t !== chosen &&
      dist(t.district.capture, chosen.district.capture) >= ai.twoFrontMinDistance &&
      power >= ai.attackRatio * (t.enemy + chosen.enemy));
    if (second) {
      const share = chosen.enemy / (chosen.enemy + second.enemy);
      const first = takeNearest(gathered, chosen.district.capture, Math.max(1, Math.round(gathered.length * share)));
      note(state, player, 'twoFronts');
      launch(state, brain, first, chosen.district, 'attack', lvl, true);
      launch(state, brain, gathered.splice(0), second.district, 'attack', lvl, true);
      removeFrom(pool, first);
      return;
    }
  }
  const group = gathered.splice(0);
  removeFrom(pool, group);
  launch(state, brain, group, chosen.district, 'attack', lvl, chosen.enemy > 0);
}

// ترتيب التوسع: المسافة من نقطة التجمع ناقص جزء من البعد عن أقرب حي للعدو (أو حيه المنزلي)
function awayScore(state, player, lvl, rally) {
  const hostile = [];
  for (const d of state.map.districts) {
    if (!d.capture || d.owner === null) continue;
    const owner = state.players[d.owner];
    if (!owner.neutral && isEnemyId(state, player.id, d.owner)) hostile.push(d.capture);
  }
  return (district) => {
    let near = Infinity;
    for (const h of hostile) near = Math.min(near, dist(h, district.capture));
    return dist(rally.capture, district.capture) - (hostile.length ? param(lvl, 'expandAwayWeight') * Math.min(near, 30) : 0);
  };
}

function groupExpand(state, player, lvl, brain, gathered, pool, targets, rally) {
  const power = powerOf(gathered);
  const away = awayScore(state, player, lvl, rally);
  let best = null, bestD = Infinity;
  for (const t of targets) {
    if (t.enemy > 0 || !t.easy) continue;
    if (brain.squads.some(s => s.targetId === t.district.id)) continue;
    const d = away(t.district);
    if (d >= bestD) continue;
    if (power < ai.attackRatio * enemyPowerAround(state, player, t.district.capture, ai.dangerRadius)) continue;
    bestD = d; best = t;
  }
  if (!best) return;
  const group = gathered.splice(0);
  removeFrom(pool, group);
  launch(state, brain, group, best.district, 'expand', lvl, false);
}

// --- متابعة الفرق القائمة ---
function updateSquads(state, player, lvl, brain, byId, owned, pool) {
  const keep = [];
  for (const squad of brain.squads) {
    const members = squad.units.map(id => byId.get(id))
      .filter(u => u && u.botTask && u.botTask.squadId === squad.id);
    squad.units = members.map(u => u.id);
    if (!members.length) continue;
    const district = state.map.districts[squad.targetId];
    const c = center(members);

    // الانسحاب (صعب فما فوق): قوتها أقل من 0.6 × قوة الأعداء حولها
    if (lvl.retreat && squad.type !== 'defend') {
      const enemy = enemyPowerAround(state, player, c, ai.powerRadius);
      if (enemy > 0 && powerOf(members) < ai.retreatRatio * enemy) {
        const home = nearestOwned(owned, c);
        disband(members);
        if (home) {
          for (const u of members) u.botTask = { type: 'regroup', until: state.time + 8 };
          note(state, player, 'retreat');
          commandMove(state, home.capture.i, home.capture.j, members, false);
        }
        continue;
      }
    }

    if (squad.type === 'defend') {
      // انتهى التهديد أو سقط الحي: تعود حرة
      const still = district && district.owner === player.id && sidePowers(state, player, district).enemy > 0;
      if (!still) { disband(members); pool.push(...members.filter(u => u.state !== 'attacking')); continue; }
    } else if (!district || district.owner === player.id ||
               (district.owner !== null && !isEnemyId(state, player.id, district.owner))) {
      // احتلت هدفها: تكمل لهدف قريب تقدر عليه، وإلا تتحرر وتعود للتجمع
      const next = nextTarget(state, player, lvl, members, c, squad.type);
      if (!next) {
        disband(members);
        pool.push(...members.filter(u => u.state !== 'attacking'));
        continue;
      }
      squad.targetId = next.district.id;
      orderSquad(state, members, next.district, lvl, next.enemy > 0);
      keep.push(squad);
      continue;
    }

    // فرقة توسع صغيرة لم تشتبك بعد، وصار هدفها خطراً (أعداء أقوى منها حوله): تعود ولا تموت فرادى
    if (lvl.abortExpand && (squad.type === 'expand' || squad.type === 'raid') && !members.some(u => u.state === 'attacking')) {
      const danger = enemyPowerAround(state, player, district.capture, ai.dangerRadius) +
                     enemyPowerAround(state, player, c, ai.dangerRadius / 2);
      if (danger > 0 && powerOf(members) < ai.attackRatio * danger) {
        disband(members);
        const rally = owned.find(d => d.id === brain.rallyId) || nearestOwned(owned, c);
        if (rally) {
          for (const u of members) u.botTask = { type: 'regroup', until: state.time + 4 };
          commandMove(state, rally.capture.i, rally.capture.j, members, false);
        }
        continue;
      }
    }

    // نقطة الالتئام: حين يصل أغلبها (أو يطول الانتظار) تقتحم الهدف معاً
    if (squad.phase === 'stage') {
      const near = members.filter(u => distU(u, squad.stage) <= ai.stageRadius).length;
      if (near >= members.length * ai.stageShare || state.time - squad.stagedAt >= ai.stageMaxSeconds) {
        squad.phase = 'assault';
        orderSquad(state, members, district, lvl, true);
      } else {
        const late = members.filter(u => u.state === 'idle' && distU(u, squad.stage) > ai.stageRadius);
        if (late.length) commandAttackMove(state, squad.stage.i, squad.stage.j, late, false);
      }
      keep.push(squad);
      continue;
    }

    // من توقف بعيداً عن الهدف (بعد قتال أو طريق مسدود) يُعاد إرساله
    const idle = members.filter(u => u.state === 'idle' && distU(u, district.capture) > 2.5);
    if (idle.length) commandAttackMove(state, district.capture.i, district.capture.j, idle, false);
    keep.push(squad);
  }
  brain.squads = keep;
}

// --- نجدة فرقة مشتبكة لا تتفوق على من حولها: أقرب الوحدات الحرة تنضم إليها كمجموعة ---
function reinforce(state, player, lvl, brain, byId, pool) {
  for (const squad of brain.squads) {
    if (!pool.length) return;
    const members = squad.units.map(id => byId.get(id)).filter(u => u && isAlive(u));
    if (!members.length || !members.some(u => u.state === 'attacking')) continue;
    const c = center(members);
    const enemy = enemyPowerAround(state, player, c, ai.powerRadius);
    let deficit = ai.attackRatio * enemy - powerOf(members);
    if (deficit <= 0) continue;
    const near = sortedBy(pool.filter(u => distU(u, c) <= param(lvl, 'reinforceRange')), (u) => distU(u, c));
    const group = [];
    for (const unit of near) {
      if (deficit <= 0) break;
      group.push(unit);
      deficit -= unitValue(unit);
    }
    if (!group.length) continue;
    removeFrom(pool, group);
    for (const unit of group) { unit.botTask = { type: 'squad', squadId: squad.id }; unit.gatherRally = -1; }
    squad.units.push(...group.map(u => u.id));
    commandAttackMove(state, c.i, c.j, group, false);
  }
}

// أقرب هدف تقدر عليه الفرقة من مكانها (سلسلة احتلال بلا رجوع للتجمع)
// فرق التوسع والإغارة الصغيرة لا تكمل إلا لهدف آمن لحجمها (نفس شرط إطلاقها)
function nextTarget(state, player, lvl, members, c, type) {
  const power = powerOf(members);
  const small = type === 'expand' || type === 'raid';
  let best = null, bestScore = 0;
  for (const t of targetList(state, player, lvl, 0, null)) {
    if (t.enemy > 0 && power < ai.attackRatio * t.enemy) continue;
    const d = dist(c, t.district.capture);
    if (d > ai.twoFrontMinDistance * 1.5) continue;
    if (small) {
      if (!t.easy) continue;
      const danger = enemyPowerAround(state, player, t.district.capture, ai.dangerRadius);
      if (power < ai.attackRatio * danger) continue;
      if (members.length === 1 && enemyPowerAround(state, player, t.district.capture, param(lvl, 'soloSafeRadius')) > 0) continue;
    }
    const score = t.value / (d + 5);
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return best;
}

// --- الدفاع بلا إفراط: 1.2 × قوة المهاجم، بالهجوم المتحرك ---
function defend(state, player, lvl, brain, pool, owned) {
  for (const district of owned) {
    const { enemy, mine } = sidePowers(state, player, district);
    if (enemy <= 0) continue;
    // فرق الدفاع المتجهة إليه ولم تصل بعد تُحسب أيضاً
    let coming = 0;
    for (const squad of brain.squads) {
      if (squad.type === 'defend' && squad.targetId === district.id) coming += squad.power || 0;
    }
    let deficit = ai.defenseRatio * enemy - mine - coming;
    if (deficit <= 0) continue;
    const group = [];
    const sorted = sortedBy(pool, (u) => distU(u, district.capture));
    for (const unit of sorted) {
      if (deficit <= 0) break;
      group.push(unit);
      deficit -= unitValue(unit);
    }
    // الصعب فما فوق لا يرسل دفعة أضعف من المطلوب (تموت فرادى): يترك الحي ويسترجعه لاحقاً بفرقة كاملة
    if (!group.length || (lvl.strictDefense && deficit > 0)) continue;
    removeFrom(pool, group);
    const squad = launch(state, brain, group, district, 'defend', lvl, false);
    squad.power = powerOf(group);
  }
}

// --- نقطة التجمع: الحي المملوك الأقرب لأحياء الأعداء (الجبهة)، ولا تتبدل إلا لفرق واضح ---
function rallyPoint(state, player, brain, owned) {
  if (!owned.length) return null;
  const hostile = state.map.districts.filter(d => d.capture && d.owner !== null &&
    isEnemyId(state, player.id, d.owner) && !state.players[d.owner].neutral);
  const mid = (state.map.n - 1) / 2;
  const front = (d) => hostile.length
    ? Math.min(...hostile.map(h => dist(d.capture, h.capture)))
    : hypot(d.capture.i - mid, d.capture.j - mid);
  let best = owned[0], bestValue = Infinity;
  for (const d of owned) {
    const v = front(d);
    if (v < bestValue) { bestValue = v; best = d; }
  }
  const current = owned.find(d => d.id === brain.rallyId);
  if (current && front(current) - bestValue < ai.rallySwitchGain) return current;
  brain.rallyId = best.id;
  return best;
}

// --- الأهداف المتاحة وقيمها ---
function targetList(state, player, lvl, armySize, helpers) {
  const survival = state.mode === 'survival';
  const leader = helpers ? helpers.strongestPlayer(state, player) : null;   // قاعدة ملاحقة الأقوى
  // الأحياء ضمن مدى مطاردة الشرطة حول مراكزها العاملة: من لا يهاجم الشرطة بعد يتجنبها تماماً،
  // والباقون لا يرسلون إليها توسعاً صغيراً (فرقة كاملة فقط)
  const avoidPolice = !lvl.policeEarly && armySize < (lvl.policeArmy || Infinity);
  const stations = state.map.districts.filter(d => d.police && !d.policeDisabled && d.capture);
  // الصعب فما فوق: الأضعف من الخصوم أولاً (إقصاؤه يضم أحياءه ويقلل الأعداء)
  // القوة = الأحياء + نصف عدد الجنود
  const counts = new Map();
  if (param(lvl, 'preferWeak')) {
    for (const d of state.map.districts) if (d.owner !== null) counts.set(d.owner, (counts.get(d.owner) || 0) + 1);
    if (param(lvl, 'weakByArmy')) {
      for (const u of state.units) if (u.state !== 'dead') counts.set(u.playerId, (counts.get(u.playerId) || 0) + 0.5);
    }
  }
  const most = Math.max(1, ...[...counts.entries()]
    .filter(([id]) => id !== player.id && !state.players[id].neutral).map(([, n]) => n));
  const list = [];
  for (const d of state.map.districts) {
    if (!d.capture || d.owner === player.id) continue;
    const owner = d.owner !== null ? state.players[d.owner] : null;
    if (owner && !isEnemyId(state, player.id, d.owner)) continue;   // حليف
    if (d.police) {
      if (survival) continue;                 // المراكز لا تُحتل في الصمود
      // مع الشرطة (11.3): المتوسط حين يصير جيشه 8 فأكثر، والصعب فما فوق مبكراً
      if (!d.policeDisabled && !lvl.policeEarly && armySize < (lvl.policeArmy || Infinity)) continue;
    }
    const nearPolice = !d.police && stations.some(st => dist(st.capture, d.capture) <= ai.policeAvoidRadius);
    if (nearPolice && avoidPolice) continue;
    // المدافعون: من حول الحي (خريطة القوى، 5 مربعات) ومن يستطيع النجدة من حوله (نصف قطر أوسع)
    const near = sidePowers(state, player, d).enemy;
    const reach = lvl.responseRadius ?? ai.responseRadius;
    const enemy = reach ? Math.max(near, enemyPowerAround(state, player, d.capture, reach)) : near;
    let value = 1;
    if (d.special) value *= param(lvl, 'specialValue');
    if (d.police && lvl.policeEarly) value *= ai.stationValue;
    if (leader !== null && d.owner === leader) value *= ai.snowballValue;
    if (owner && !owner.neutral) {
      value *= ai.enemyDistrictValue;                               // انتزاعه من العدو مكسب مضاعف
      if (counts.size) value *= 1 + param(lvl, 'preferWeak') * (1 - (counts.get(d.owner) || 0) / most);
    }
    // هدف سهل: محايد خالٍ (توسع)، أو حي عدو خالٍ للصعب فما فوق (إغارة معاكسة)
    // السهولة بخريطة القوى وحدها (5 مربعات)؛ للتوسع فحوص خطره الخاصة، والنصف قطر الأوسع للهجوم فقط
    const easy = near === 0 && !nearPolice && (d.owner === null || lvl.raids);
    list.push({ district: d, enemy: easy ? 0 : enemy, value, easy });
  }
  return list;
}

// --- إطلاق فرقة وأوامرها ---
function launch(state, brain, units, district, type, lvl, defended) {
  const owner = state.players[brain.playerId];
  if (owner) note(state, owner, type);
  const squad = { id: brain.nextId++, type, units: units.map(u => u.id), targetId: district.id };
  brain.squads.push(squad);
  for (const unit of units) {
    unit.botTask = { type: 'squad', squadId: squad.id };
    unit.gatherRally = -1;
  }
  // هجوم على حي مُدافَع عنه: تتقدم الفرقة أولاً إلى نقطة قبله وتلتئم، ثم تقتحم معاً
  if (param(lvl, 'stage') && type === 'attack' && defended && units.length > 1) stage(state, squad, units, district);
  else orderSquad(state, units, district, lvl, defended);
  return squad;
}

function stage(state, squad, units, district) {
  const c = center(units), t = district.capture;
  const len = hypot(t.i - c.i, t.j - c.j);
  if (len <= ai.stageDistance + 1) { squad.phase = 'assault'; orderSquad(state, units, district, { flank: false }, true); return; }
  const point = { i: t.i - (t.i - c.i) / len * ai.stageDistance, j: t.j - (t.j - c.j) / len * ai.stageDistance };
  squad.phase = 'stage';
  squad.stage = point;
  squad.stagedAt = state.time;
  commandAttackMove(state, point.i, point.j, units, false);
}

// التقدم دائماً بالهجوم المتحرك (11.2)؛ السريعة تلتف حول المدافعين، والبطل خلف المركز
function orderSquad(state, units, district, lvl, defended) {
  const t = district.capture;
  const c = center(units);
  const len = hypot(t.i - c.i, t.j - c.j) || 1;
  const ux = (t.i - c.i) / len, uy = (t.j - c.j) / len;

  const main = [], flank = [], heroes = [];
  for (const unit of units) {
    if (unit.champion && (unit.stats.armor || 0) < ai.armoredHero) heroes.push(unit);
    else if (lvl.flank && defended && units.length >= ai.flankMinSquad && unit.stats.speed >= ai.flankMinSpeed) flank.push(unit);
    else main.push(unit);
  }
  // الالتفاف لا يكون إلا ومعه جبهة أمامية تشغل المدافعين
  if (flank.length > main.length) { main.push(...flank.splice(0)); }

  if (main.length) commandAttackMove(state, t.i, t.j, main, false);
  if (flank.length) {
    const side = Math.random() < 0.5 ? 1 : -1;
    const fi = t.i - uy * side * ai.flankOffset + ux;
    const fj = t.j + ux * side * ai.flankOffset + uy;
    commandAttackMove(state, fi, fj, flank, false);
  }
  if (heroes.length) {
    commandAttackMove(state, t.i - ux * ai.heroBehind, t.j - uy * ai.heroBehind, heroes, false);
  }
}

function disband(members) {
  for (const unit of members) unit.botTask = null;
}

function nearestOwned(owned, point) {
  let best = null, bestD = Infinity;
  for (const d of owned) {
    const dd = dist(d.capture, point);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

const fastFirst = (unit) => unit.stats.speed >= ai.raidMinSpeed ? 0 : 3;

// يأخذ أقرب الوحدات من القائمة (ويزيلها منها)
function takeNearest(list, point, count) {
  const sorted = sortedBy(list, (u) => distU(u, point));
  const group = sorted.slice(0, count);
  removeFrom(list, group);
  return group;
}

function removeFrom(list, group) {
  for (const unit of group) {
    const k = list.indexOf(unit);
    if (k >= 0) list.splice(k, 1);
  }
}
