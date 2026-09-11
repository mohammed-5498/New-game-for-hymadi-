// ظهور الأفراد عند ساحات أعلام الأحياء المملوكة
import { TICK_SEC, SPAWN, GANGS, MAP_GEN, SPECIAL_BONUS } from '../config.js';
import { createUnit } from './units.js';
import { findFreeTiles } from '../map/pathfinding.js';
import { isEnemy } from './combat.js';

export function initSpawnTimers(state) {
  state.spawnTimers = state.players.map(player => normalInterval(state, player));
  state.heroTimers = state.players.map(player => heroInterval(state, player));
  state.heroTurn = state.players.map(() => 0);   // التناوب بين شخصيتي العصابة
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
    const districts = ownedDistricts(state, player.id);
    if (!districts.length) continue;    // بلا أحياء: لا ظهور

    // عند الوصول للحد الأقصى تتوقف المؤقتات، وتستأنف عندما يقل العدد
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

  const spots = findFreeTiles(state.map, district.capture.i, district.capture.j, SPAWN.spotSearchTiles);
  if (!spots.length) return;

  const [i, j] = spots[Math.floor(Math.random() * spots.length)];
  state.units.push(createUnit(state, player, i, j, heroId));
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
