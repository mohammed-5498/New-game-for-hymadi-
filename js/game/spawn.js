// ظهور الأفراد عند ساحات أعلام الأحياء المملوكة
import { TICK_SEC, SPAWN, GANGS, MAP_GEN } from '../config.js';
import { createUnit } from './units.js';
import { findFreeTiles } from '../map/pathfinding.js';
import { isEnemy } from './combat.js';

export function initSpawnTimers(state) {
  state.spawnTimers = state.players.map(player => normalInterval(state, player));
}

// زمن ظهور الفرد العادي: max(4, 14 - (D-1)) ثانية، مضروباً بمعدل العصابة
export function normalInterval(state, player) {
  const owned = ownedDistricts(state, player.id).length;
  const seconds = Math.max(
    SPAWN.normalMin,
    SPAWN.normalBase - Math.max(0, owned - 1) * SPAWN.normalPerDistrict
  );
  const gang = GANGS[player.gang];
  const multiplier = (gang && gang.unit.spawnMultiplier) || 1;   // العقارب × 0.8
  return seconds * multiplier;
}

export function updateSpawn(state) {
  for (const player of state.players) {
    const districts = ownedDistricts(state, player.id);
    if (!districts.length) continue;    // بلا أحياء: لا ظهور

    // عند الوصول للحد الأقصى تتوقف المؤقتات، وتستأنف عندما يقل العدد
    if (countUnits(state, player.id) >= state.maxUnits) continue;

    state.spawnTimers[player.id] -= TICK_SEC;
    if (state.spawnTimers[player.id] > 0) continue;

    spawnNormalUnit(state, player, districts);
    state.spawnTimers[player.id] = normalInterval(state, player);
  }
}

function spawnNormalUnit(state, player, districts) {
  // تفضيل الأحياء التي ليس فيها أعداء
  const safe = districts.filter(d => !hasEnemyNearFlag(state, d, player.id));
  const pool = safe.length ? safe : districts;
  const district = pool[Math.floor(Math.random() * pool.length)];

  const spots = findFreeTiles(state.map, district.capture.i, district.capture.j, SPAWN.spotSearchTiles);
  if (!spots.length) return;

  const [i, j] = spots[Math.floor(Math.random() * spots.length)];
  state.units.push(createUnit(state, player, i, j));
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
