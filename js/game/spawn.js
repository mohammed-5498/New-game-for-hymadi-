// ظهور الأفراد عند ساحات أعلام الأحياء المملوكة
import { TICK_SEC, SPAWN, GANGS, MAP_GEN, SPECIAL_BONUS } from '../config.js';
import { createUnit } from './units.js';
import { findFreeTiles } from '../map/pathfinding.js';
import { isEnemy } from './combat.js';
import { soundAt } from '../audio/sound.js';

export function initSpawnTimers(state) {
  state.spawnTimers = state.players.map(player => normalInterval(state, player));
  state.heroTimers = state.players.map(player => heroInterval(state, player));
  state.heroTurn = state.players.map(() => 0);   // التناوب بين شخصيتي العصابة
  // مؤقت عودة البطل: null يعني لا مؤقت (بطله حي أو لم يمت بعد)
  state.championTimers = state.players.map(() => null);
}

// هل يملك اللاعب حياً مميزاً من نوع معين؟ (نفس النوع لا يتكرر تأثيره)
export function ownsSpecial(state, playerId, type) {
  return state.map.districts.some(d => d.owner === playerId && d.special === type);
}

// برج الساعة: أزمنة الظهور لكل وحداته × 0.85
const clockFactor = (state, playerId) =>
  ownsSpecial(state, playerId, 'clock') ? SPECIAL_BONUS.clock.spawnMultiplier : 1;

// زمن ظهور الفرد العادي: max(4, 14 - (D-1)) ثانية، مضروباً بمعدل العصابة وبرج الساعة
export function normalInterval(state, player) {
  const owned = ownedDistricts(state, player.id).length;
  const seconds = Math.max(
    SPAWN.normalMin,
    SPAWN.normalBase - Math.max(0, owned - 1) * SPAWN.normalPerDistrict
  );
  const gang = GANGS[player.gang];
  const multiplier = (gang && gang.unit.spawnMultiplier) || 1;   // العقارب × 0.8
  return seconds * multiplier * clockFactor(state, player.id);
}

// زمن ظهور الشخصية المميزة: max(30, 75 - (D-1)×3) ثانية
export function heroInterval(state, player) {
  const owned = ownedDistricts(state, player.id).length;
  const seconds = Math.max(
    SPAWN.heroMin,
    SPAWN.heroBase - Math.max(0, owned - 1) * SPAWN.heroPerDistrict
  );
  return seconds * clockFactor(state, player.id);
}

export function updateSpawn(state) {
  for (const player of state.players) {
    if (player.neutral) continue;       // الشرطة لها إنتاجها الخاص (القسم 3.8)
    const districts = ownedDistricts(state, player.id);
    if (!districts.length) continue;    // بلا أحياء: لا ظهور

    updateChampion(state, player, districts);

    // عند الوصول للحد الأقصى تتوقف المؤقتات، وتستأنف عندما يقل العدد
    // (البطل يُحسب ضمن الحد الأقصى، القسم 6.6)
    if (countUnits(state, player.id) >= state.maxUnits) continue;

    state.spawnTimers[player.id] -= TICK_SEC;
    state.heroTimers[player.id] -= TICK_SEC;

    if (state.spawnTimers[player.id] <= 0) {
      spawnUnit(state, player, districts, null);
      state.spawnTimers[player.id] = normalInterval(state, player);
    }

    // الشخصيات المميزة بالتناوب بين شخصيتي العصابة
    if (state.heroTimers[player.id] <= 0) {
      const heroes = GANGS[player.gang].heroes;
      const heroId = heroes[state.heroTurn[player.id] % heroes.length];
      state.heroTurn[player.id]++;
      spawnUnit(state, player, districts, heroId);
      state.heroTimers[player.id] = heroInterval(state, player);
    }
  }
}

function spawnUnit(state, player, districts, heroId) {
  // تفضيل الأحياء التي ليس فيها أعداء
  const safe = districts.filter(d => !hasEnemyNearFlag(state, d, player.id));
  const pool = safe.length ? safe : districts;
  const district = pool[Math.floor(Math.random() * pool.length)];

  // findFreeTiles لا يعيد إلا مربعات موصولة بشبكة الشوارع (القسم 3.4.1)،
  // فلا تظهر وحدة داخل فراغ محاصر بالمباني
  const spots = findFreeTiles(state.map, district.capture.i, district.capture.j, SPAWN.spotSearchTiles);
  if (!spots.length) return;

  const [i, j] = spots[Math.floor(Math.random() * spots.length)];
  state.units.push(createUnit(state, player, i, j, heroId));
  soundAt(state, 'spawn', i, j);
}

function hasEnemyNearFlag(state, district, playerId) {
  const { i, j } = district.capture;
  for (const unit of state.units) {
    if (unit.state === 'dead') continue;
    if (!isEnemy(state, { playerId }, unit)) continue;
    if (Math.hypot(unit.x - i, unit.y - j) <= MAP_GEN.captureRadius) return true;
  }
  return false;
}

export function ownedDistricts(state, playerId) {
  return state.map.districts.filter(d => d.owner === playerId && d.capture);
}

export function countUnits(state, playerId) {
  let n = 0;
  for (const unit of state.units) if (unit.playerId === playerId && unit.state !== 'dead') n++;
  return n;
}


// --- البطل (القسم 6.6): وحدة واحدة لكل لاعب، خارج دورة الظهور تماماً ---

export function championOf(state, playerId) {
  return state.units.find(u => u.playerId === playerId && u.champion && u.state !== 'dead') || null;
}

// بطل اللاعب عند ساحة علم حيه المنزلي مع أفراده الثلاثة
export function spawnChampion(state, player, district) {
  if (!district || !district.capture) return null;
  if (championOf(state, player.id)) return null;      // لا أكثر من بطل حي واحد

  const spots = findFreeTiles(state.map, district.capture.i, district.capture.j, SPAWN.spotSearchTiles);
  if (!spots.length) return null;

  const [i, j] = spots[Math.floor(Math.random() * spots.length)];
  const champion = createUnit(state, player, i, j, null, true);
  state.units.push(champion);
  soundAt(state, 'spawn', i, j);
  return champion;
}

// مات البطل: يعود بعد 60 ثانية، والمؤقت لا يجري إلا وصاحبه يملك 5 أحياء فأكثر
function updateChampion(state, player, districts) {
  if (championOf(state, player.id)) { state.championTimers[player.id] = null; return; }

  // أول تحديث بعد موته: نبدأ المؤقت
  if (state.championTimers[player.id] === null) {
    state.championTimers[player.id] = SPAWN.championRespawnSeconds;
    return;
  }

  // أقل من الحد: المؤقت متوقف حتى ترجع أحياؤه إلى 5
  if (districts.length < SPAWN.championMinDistricts) return;

  state.championTimers[player.id] -= TICK_SEC;
  if (state.championTimers[player.id] > 0) return;
  if (countUnits(state, player.id) >= state.maxUnits) return;   // يُحسب ضمن الحد الأقصى

  // يظهر في ساحة علم حي مملوك، مع تفضيل الأحياء التي ليس فيها أعداء
  const safe = districts.filter(d => !hasEnemyNearFlag(state, d, player.id));
  const pool = safe.length ? safe : districts;
  const district = pool[Math.floor(Math.random() * pool.length)];
  if (spawnChampion(state, player, district)) state.championTimers[player.id] = null;
}
