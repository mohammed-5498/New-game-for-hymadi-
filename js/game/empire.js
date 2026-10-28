// طور الإمبراطورية (بطلب المستخدم): الطور الأساسي للعبة، في كل المدن:
// - النقاط: كل حي مملوك 0.5 في الثانية، والقاعدة الرئيسية 2 بدل ذلك، ومن يُسقط زعيم عصابة يأخذ 50
// - الجنود من القاعدة الرئيسية بالنقاط وبطابور (لا ظهور تلقائي)، والزعيم (البطل) واحد فقط لكل عصابة
// - ترقيات العصابة بثلاثة مستويات: الدم والضرر والدفاع وسرعة المشي (تبقى للعصابة مهما سقطت قواعدها)
// - بناء الأحياء: قاعدة رئيسية أو برج رماية أو مستشفى، وفئة المبنى لا تتغير بعد بنائه
// - ترقيات المباني ملكها: سرعة إنتاج القاعدة، وضرر البرج وسرعته، ومدى المستشفى وسرعته. من يحتل الحي يأخذ
//   مبناه بترقياته كما هي، ولا تعود نقاط لأحد (وطلبات الجنود في طابور القاعدة الساقطة تضيع)
// الحالة كلها بيانات بسيطة في state.modeState وحقول الأحياء (building وbuildTile وblv)، فتُحفظ مع المباراة.
// الأرقام كلها في EMPIRE داخل config.js
import { TICK_SEC, EMPIRE as E, SPAWN, GANGS, ai } from '../config.js';
import { createUnit } from './units.js';
import { spawnChampion, championOf, countUnits } from './spawn.js';
import { applyDamage, isEnemyId } from './combat.js';
import { forEachNearby } from './spatialHash.js';
import { findFreeTiles } from '../map/pathfinding.js';
import { soundAt } from '../audio/sound.js';
import { hypot } from './hypot.js';
import { random } from './random.js';   // عشوائية المنطق: مشتركة بين الأجهزة في اللعب المحلي

const isAlive = (unit) => unit && unit.state !== 'dead' && unit.hp > 0;

// حرف مربع المبنى في map.type: يرسمه landmarks.js بصورة من صور المدينة
export const BUILDING_TILE = { hq: 'Q', tower: 'T', hospital: 'M' };

// مربعات لا يُبنى عليها: السور وبواباته ومعلم المدينة (ملك المدينة لا الحي)
const FIXED_KINDS = ['wallI', 'wallJ', 'gateI', 'gateJ', 'archI', 'archJ', 'wallTower', 'brokenI', 'brokenJ', 'brokenTower', 'monument',
                     'fortI', 'fortJ', 'fortTower'];

// القلعة (بطلب المستخدم): برج القاعدة في وسطها، وما حوله من مباني الحي نفسه سور على الجوانب وأبراج على
// الزوايا (صور اليمامة، yamamah.js). على مربعات المباني وحدها: لا يتغير ما يُمشى عليه، والساحة والشوارع مداخلها.
// في المدن التي لها صور قلعة فقط (EMPIRE.art[city].fort)، وفي غيرها القاعدة مبنى مقر المدينة بهالته
function fortify(map, district) {
  if (!(E.art[map.city] && E.art[map.city].fort)) return;
  const at = tileOf(map, district.buildTile);
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const i = at.i + di, j = at.j + dj;
      if ((!di && !dj) || !map.inBounds(i, j)) continue;
      const k = map.idx(i, j);
      if (map.road[k] || map.districtAt[k] !== district.id || (map.type[k] !== 'H' && map.type[k] !== 'R')) continue;
      if (FIXED_KINDS.includes(map.kind[k])) continue;            // سور المدينة ومعلمها لا يُمسّان
      map.type[k] = 'H';
      map.kind[k] = di && dj ? 'fortTower' : di ? 'fortJ' : 'fortI';
    }
  }
}

// --- البداية: النقاط والمستويات، وكل حي منزلي قاعدة رئيسية بمبنى المقر نفسه ---
export function initEmpire(state, modeState) {
  const players = state.players;
  modeState.points = players.map(() => E.startPoints);
  modeState.earned = players.map(() => 0);          // كل ما جمعه (لشاشة النهاية)
  modeState.leaderKills = players.map(() => 0);
  modeState.levels = players.map(() => ({ hp: 0, damage: 0, armor: 0, speed: 0 }));
  modeState.queues = {};                             // رقم حي القاعدة -> [{ kind, t, payer }]
  modeState.shots = [];                              // سهام الأبراج في الهواء
  for (const player of players) {
    const home = state.map.districts[player.homeDistrictId];
    if (!home) continue;
    const k = home.tiles.map(([i, j]) => state.map.idx(i, j)).find(k => state.map.type[k] === 'Q');
    if (k === undefined) continue;
    home.building = 'hq';
    home.buildTile = k;
    home.blv = {};
    fortify(state.map, home);
  }
}

// --- كل تحديث ---
export function updateEmpire(state) {
  const ms = state.modeState;
  // تلميح مرة واحدة في البداية (بعد إشعار سمة الأمة إن وُجد): كيف تُفتح قائمة الحي.
  // يخص هذا الجهاز كالإشعار نفسه (اللعب المحلي: لا يدخل حالة المباراة المشتركة)
  if (!state.empireHinted && !state.notice) {
    state.empireHinted = true;
    state.notice = { text: 'المس مبنى قاعدتك مرتين بسرعة لقائمته، وأي حي لك بلا مبنى لتبني فيه', mine: true, t: E.hintSeconds, keep: true };
  }
  collectIncome(state, ms);
  rewardLeaderKills(state, ms);
  updateQueues(state, ms);
  updateTowers(state, ms);
  updateShots(state, ms);
  updateHospitals(state);
}

function collectIncome(state, ms) {
  for (const d of state.map.districts) {
    if (d.owner === null || !d.capture || state.players[d.owner].neutral) continue;
    const gain = (d.building === 'hq' ? E.income.hq : E.income.district) * TICK_SEC;
    ms.points[d.owner] += gain;
    ms.earned[d.owner] += gain;
  }
}

// زعيم سقط: آخر من ضربه يأخذ مكافأته (مرة واحدة لكل زعيم)
function rewardLeaderKills(state, ms) {
  for (const unit of state.units) {
    if (!unit.champion || unit.state !== 'dead' || unit.leaderPaid) continue;
    unit.leaderPaid = true;
    const killer = unit.lastHitBy;
    if (killer < 0 || killer === unit.playerId || !state.players[killer] || state.players[killer].neutral) continue;
    ms.points[killer] += E.leaderKill;
    ms.earned[killer] += E.leaderKill;
    ms.leaderKills[killer]++;
    if (killer === state.humanId) {
      state.notice = { text: 'أسقطت زعيم ' + state.players[unit.playerId].gangName + ': +' + E.leaderKill + ' نقطة', mine: true, t: 3 };
    }
  }
}

// --- الإنتاج: طابور لكل قاعدة رئيسية، وأول طلب فيه يتقدم ---
// البوت المجنون ينتج أسرع 25% (مزيته المعلنة في الظهور، ai.levels.insane.spawnFactor)
function botFactor(player) {
  const lvl = !player.isHuman && !player.neutral && ai.levels[player.difficulty];
  return (lvl && lvl.spawnFactor) || 1;
}

// سرعة الإنتاج ترقية القاعدة نفسها (district.blv.production)
export function productionTime(state, district, kind) {
  const level = (district.blv && district.blv.production) || 0;
  const owner = state.players[district.owner];
  return E.units[kind].seconds * E.buildings.hq.upgrades.production.times[level] * (owner ? botFactor(owner) : 1);
}

function updateQueues(state, ms) {
  for (const id of Object.keys(ms.queues)) {
    const queue = ms.queues[id];
    if (!queue.length) continue;
    const district = state.map.districts[id];
    // القاعدة سقطت (صارت محايدة أو بيد غيره): طلبات من دفع تضيع بلا إرجاع نقاط (بقرار المستخدم)
    for (let k = queue.length - 1; k >= 0; k--) {
      if (district.building !== 'hq' || district.owner !== queue[k].payer) queue.splice(k, 1);
    }
    if (!queue.length) continue;
    const item = queue[0], owner = district.owner;
    if (countUnits(state, owner) >= state.maxUnits) continue;      // بلغ الحد الأقصى: الإنتاج ينتظر
    item.t += TICK_SEC;
    if (item.t < productionTime(state, district, item.kind)) continue;
    // لا مكان حول العلم الآن: يبقى الطلب أول الطابور ويُعاد في التحديث التالي
    if (produce(state, state.players[owner], district, item.kind)) queue.shift();
  }
}

// الشخصية المميزة لكل درجة: النخبة من EMPIRE.elite، و"الأقوى" هي الأخرى من شخصيتي النمط
export function heroFor(player, kind) {
  if (kind === 'common' || kind === 'leader') return null;
  const heroes = GANGS[player.gang] ? GANGS[player.gang].heroes : [];
  const elite = E.elite[player.gang];
  return kind === 'elite' ? elite : heroes.find(h => h !== elite) || null;
}

function produce(state, player, district, kind) {
  if (kind === 'leader') {
    const leader = spawnChampion(state, player, district);
    if (leader) applyUpgrades(state, leader);
    return !!leader;
  }
  const spots = findFreeTiles(state.map, district.capture.i, district.capture.j, SPAWN.spotSearchTiles);
  if (!spots.length) return false;
  const [i, j] = spots[Math.floor(random() * spots.length)];
  const unit = createUnit(state, player, i, j, heroFor(player, kind));
  state.units.push(unit);
  applyUpgrades(state, unit);
  soundAt(state, 'spawn', i, j);
  return true;
}

// --- ترقيات العصابة على الوحدة: الدم هنا، والضرر والدفاع في abilities.js، وسرعة المشي في weather.js ---
function applyUpgrades(state, unit) {
  const factor = 1 + state.modeState.levels[unit.playerId].hp * E.upgrades.hp.per;
  unit.maxHp = unit.stats.hp * factor;
  unit.hp = unit.maxHp;
}

// مضاعفات اللاعب للقتال والحركة (0 أو 1 خارج هذا الطور)
export function empireDamageBonus(state, playerId) {
  return state.modeState.levels[playerId].damage * E.upgrades.damage.per;
}
export function empireArmorBonus(state, playerId) {
  return state.modeState.levels[playerId].armor * E.upgrades.armor.per;
}
export function empireSpeedMul(state, playerId) {
  return 1 + state.modeState.levels[playerId].speed * E.upgrades.speed.per;
}

// --- أبراج الرماية: سهم على أقرب عدو في المدى كل attackTime ثانية ---
export const tileOf = (map, k) => ({ i: k % map.n, j: Math.floor(k / map.n) });

const towerStats = (district) => {
  const T = E.buildings.tower, lv = district.blv || {};
  return {
    range: T.range,
    damage: T.damage * (1 + (lv.damage || 0) * T.upgrades.damage.per),
    attackTime: T.attackTime * (1 - (lv.rate || 0) * T.upgrades.rate.per)
  };
};

function updateTowers(state, ms) {
  for (const d of state.map.districts) {
    if (d.building !== 'tower' || d.owner === null || state.players[d.owner].neutral) continue;
    if (d.cool > 0) { d.cool -= TICK_SEC; continue; }
    const at = tileOf(state.map, d.buildTile), stats = towerStats(d);
    const target = nearestEnemy(state, d.owner, at, stats.range);
    if (!target) continue;                              // جاهز ينتظر عدواً
    d.cool = stats.attackTime;
    ms.shots.push({ owner: d.owner, target, i: at.i, j: at.j, t: 0, prevT: 0, duration: E.arrow.flight, damage: stats.damage });
    soundAt(state, 'arrow', at.i, at.j);
  }
}

function nearestEnemy(state, owner, at, range) {
  let best = null, bestD = range;
  forEachNearby(state, at.i, at.j, range, (unit) => {
    if (!isAlive(unit) || !isEnemyId(state, owner, unit.playerId)) return;
    const d = hypot(unit.x - at.i, unit.y - at.j);
    if (d <= bestD) { bestD = d; best = unit; }
  });
  return best;
}

// السهم يتتبع هدفه ويصيبه عند انتهاء طيرانه (البرج ليس وحدة: لا يُرد عليه ولا يُشحن)
function updateShots(state, ms) {
  if (!ms.shots.length) return;
  const left = [];
  for (const shot of ms.shots) {
    shot.prevT = shot.t;
    shot.t += TICK_SEC;
    if (shot.t < shot.duration) { left.push(shot); continue; }
    if (isAlive(shot.target)) applyDamage(state, { playerId: shot.owner }, shot.target, shot.damage);
  }
  ms.shots = left;
}

// مستشفى يعالج جنود صاحبه: المستشفى المميز في الأطوار الأخرى (عند علمه)، ومستشفى هذا الطور (عند مبناه).
// تستعمله البوتات لسحب مصابيها (bot.js وtactics.js)
export const isHospital = (district) => district.special === 'hospital' || district.building === 'hospital';
export const healPoint = (map, district) =>
  district.building === 'hospital' ? tileOf(map, district.buildTile) : district.capture;

// --- المستشفيات: علاج جنود صاحبها حولها ---
const hospitalStats = (district) => {
  const H = E.buildings.hospital, lv = district.blv || {};
  return {
    radius: H.radius + (lv.radius || 0) * H.upgrades.radius.per,
    perSecond: H.perSecond * (1 + (lv.rate || 0) * H.upgrades.rate.per)
  };
};

function updateHospitals(state) {
  for (const d of state.map.districts) {
    if (d.building !== 'hospital' || d.owner === null || state.players[d.owner].neutral) continue;
    const at = tileOf(state.map, d.buildTile), stats = hospitalStats(d);
    const amount = stats.perSecond * TICK_SEC, r2 = stats.radius * stats.radius;
    forEachNearby(state, at.i, at.j, stats.radius, (unit) => {
      if (unit.playerId !== d.owner || !isAlive(unit) || unit.hp >= unit.maxHp) return;
      const dx = unit.x - at.i, dy = unit.y - at.j;
      if (dx * dx + dy * dy <= r2) unit.hp = Math.min(unit.maxHp, unit.hp + amount);
    });
  }
}

// ================= الأوامر (من القائمة ومن البوتات) =================
// كل أمر يعيد { ok, reason }: reason جملة تظهر في الخانة المعطلة
const fail = (reason) => ({ ok: false, reason });
const OK = { ok: true, reason: '' };

const pointsOf = (state, playerId) => state.modeState.points[playerId];
const owns = (state, playerId, district) => district && district.owner === playerId;

// الزعيم: حي، أو في طابور إحدى قواعد لاعبه
function leaderTaken(state, playerId) {
  if (championOf(state, playerId)) return true;
  return Object.values(state.modeState.queues).some(q => q.some(item => item.payer === playerId && item.kind === 'leader'));
}

export function canQueue(state, playerId, district, kind) {
  if (!owns(state, playerId, district) || district.building !== 'hq') return fail('ليست قاعدتك');
  const queue = state.modeState.queues[district.id] || [];
  if (kind === 'leader' && leaderTaken(state, playerId)) return fail('لعصابتك زعيم');
  if (queue.length >= E.queueMax) return fail('الطابور ممتلئ');
  if (pointsOf(state, playerId) < E.units[kind].cost) return fail('النقاط لا تكفي');
  return OK;
}

export function queueUnit(state, playerId, districtId, kind) {
  const district = state.map.districts[districtId];
  const check = canQueue(state, playerId, district, kind);
  if (!check.ok) return check;
  const queues = state.modeState.queues;
  state.modeState.points[playerId] -= E.units[kind].cost;
  if (!queues[districtId]) queues[districtId] = [];
  queues[districtId].push({ kind, t: 0, payer: playerId });
  return OK;
}

// ترقية العصابة: المستوى التالي وكلفته، أو null إن بلغ الأعلى
export function nextUpgrade(state, playerId, key) {
  const level = state.modeState.levels[playerId][key];
  const costs = E.upgrades[key].costs;
  return level < costs.length ? { level: level + 1, cost: costs[level] } : null;
}

export function canUpgrade(state, playerId, key) {
  const next = nextUpgrade(state, playerId, key);
  if (!next) return fail('أعلى مستوى');
  if (pointsOf(state, playerId) < next.cost) return fail('النقاط لا تكفي');
  return OK;
}

export function buyUpgrade(state, playerId, key) {
  const check = canUpgrade(state, playerId, key);
  if (!check.ok) return check;
  const next = nextUpgrade(state, playerId, key);
  state.modeState.points[playerId] -= next.cost;
  state.modeState.levels[playerId][key] = next.level;
  // الدم: جنود اللاعب الحاليون أيضاً، بنفس نسبة دمهم
  if (key === 'hp') {
    const factor = 1 + next.level * E.upgrades.hp.per;
    for (const unit of state.units) {
      if (unit.playerId !== playerId || !isAlive(unit)) continue;
      const max = unit.stats.hp * factor;
      unit.hp *= max / unit.maxHp;
      unit.maxHp = max;
    }
  }
  return OK;
}

// مربع المبنى في الحي: أقرب مبنى لمركزه (لا شارع ولا ساحة)، فلا يتغير ما يُمشى عليه
export function buildSpot(map, district) {
  let best = -1, bestD = Infinity;
  for (const [i, j] of district.tiles) {
    const k = map.idx(i, j), type = map.type[k];
    if ((type !== 'H' && type !== 'R') || FIXED_KINDS.includes(map.kind[k])) continue;
    const d = hypot(i - district.cx, j - district.cy);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

export function canBuild(state, playerId, district, type) {
  if (!owns(state, playerId, district)) return fail('ليس حيك');
  if (district.building) return fail('في الحي مبنى');
  if (district.police) return fail('مركز شرطة');
  if (buildSpot(state.map, district) < 0) return fail('لا مكان للبناء');
  if (pointsOf(state, playerId) < E.buildings[type].cost) return fail('النقاط لا تكفي');
  return OK;
}

export function buildDistrict(state, playerId, districtId, type) {
  const district = state.map.districts[districtId];
  const check = canBuild(state, playerId, district, type);
  if (!check.ok) return check;
  const k = buildSpot(state.map, district);
  state.modeState.points[playerId] -= E.buildings[type].cost;
  district.building = type;
  district.buildTile = k;
  district.blv = {};
  district.cool = 0;
  state.map.type[k] = BUILDING_TILE[type];        // المبنى في الطبقة الثابتة (الحي يُعاد رسمه)
  if (type === 'hq') fortify(state.map, district);
  soundAt(state, 'capture_done', district.capture.i, district.capture.j);
  return OK;
}

// ترقية البرج أو المستشفى: مستويان لكل خانة
export function nextBuildingUpgrade(district, key) {
  const U = E.buildings[district.building] && E.buildings[district.building].upgrades;
  if (!U || !U[key]) return null;
  const level = (district.blv && district.blv[key]) || 0;
  return level < U[key].costs.length ? { level: level + 1, cost: U[key].costs[level] } : null;
}

export function canUpgradeBuilding(state, playerId, district, key) {
  if (!owns(state, playerId, district)) return fail('ليس حيك');
  const next = nextBuildingUpgrade(district, key);
  if (!next) return fail('أعلى مستوى');
  if (pointsOf(state, playerId) < next.cost) return fail('النقاط لا تكفي');
  return OK;
}

export function upgradeBuilding(state, playerId, districtId, key) {
  const district = state.map.districts[districtId];
  const check = canUpgradeBuilding(state, playerId, district, key);
  if (!check.ok) return check;
  const next = nextBuildingUpgrade(district, key);
  state.modeState.points[playerId] -= next.cost;
  district.blv = { ...district.blv, [key]: next.level };
  return OK;
}

// أمر واحد باسمه (القائمة، واللعب المحلي حيث يصل من جهاز آخر فتُفحص قيمه قبل تنفيذه):
// a: queue (x نوع الجندي) | upgrade (x ترقية العصابة) | build (x نوع المبنى) | improve (x ترقية المبنى)، d رقم الحي
export function empireCommand(state, playerId, a, d, x) {
  const district = state.map.districts[d];
  if (a === 'queue' && E.units.order.includes(x)) return queueUnit(state, playerId, d, x);
  if (a === 'upgrade' && E.upgrades.order.includes(x)) return buyUpgrade(state, playerId, x);
  if (a === 'build' && E.buildings.order.includes(x)) return buildDistrict(state, playerId, d, x);
  if (a === 'improve' && district && district.building && E.buildings[district.building].upgrades.order.includes(x)) {
    return upgradeBuilding(state, playerId, d, x);
  }
  return fail('');
}

// --- للواجهة: دخل اللاعب في الثانية الآن ---
export function incomeOf(state, playerId) {
  let total = 0;
  for (const d of state.map.districts) {
    if (d.owner !== playerId || !d.capture) continue;
    total += d.building === 'hq' ? E.income.hq : E.income.district;
  }
  return total;
}

export { towerStats, hospitalStats };
