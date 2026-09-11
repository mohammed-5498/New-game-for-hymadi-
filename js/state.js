// حالة المباراة: اللاعبون، الوحدات، الخريطة، الكاميرا، التحديد
import { CAMERA, PLAYER_COLORS, GANGS, UNITS, WEATHER } from './config.js';
import { createMap } from './map/generator.js';
import { findFreeTiles } from './map/pathfinding.js';
import { createUnit } from './game/units.js';
import { tileToWorld } from './map/coords.js';

export function createMatch(settings) {
  const players = settings.players.map((p, index) => ({
    id: index,
    name: p.name,
    gang: p.gang,
    gangName: GANGS[p.gang].name,
    color: (PLAYER_COLORS.find(c => c.id === p.color) || PLAYER_COLORS[index]).hex,
    isHuman: !!p.isHuman,
    team: p.team || 0,
    homeDistrictId: -1
  }));

  const map = createMap(settings.mapSize, players);
  if (!map) throw new Error('تعذر توليد خريطة صالحة');

  const state = {
    settings,
    map,
    players,
    units: [],
    projectiles: [],
    nextUnitId: 1,
    humanId: players.findIndex(p => p.isHuman),
    weather: WEATHER[settings.weather] ? settings.weather : 'day',
    maxUnits: settings.maxUnits,
    camera: { x: 0, y: 0, z: CAMERA.startZoom },
    view: { w: 1, h: 1, dpr: 1 },
    inputMode: 'pan',          // pan | select
    selectionBox: null,        // مربع التحديد أثناء السحب
    moveMarker: null,          // حلقة مكان أمر الحركة
    time: 0,                   // زمن المباراة بالثواني
    stats: {                   // إحصائيات لكل لاعب (تُعرض في شاشة النهاية لاحقاً)
      kills: players.map(() => 0),
      losses: players.map(() => 0)
    }
  };

  spawnStartingUnits(state);
  centerCameraOnHome(state);
  return state;
}

// كل لاعب يبدأ بعدد من الأفراد عند ساحة علم حيه المنزلي
function spawnStartingUnits(state) {
  for (const player of state.players) {
    const home = state.map.districts[player.homeDistrictId];
    if (!home || !home.capture) continue;
    const spots = findFreeTiles(state.map, home.capture.i, home.capture.j, UNITS.startUnits);
    for (const [i, j] of spots) {
      state.units.push(createUnit(state, player, i, j));
    }
  }
}

// الكاميرا تبدأ على الحي المنزلي للاعب
export function centerCameraOnHome(state) {
  const player = state.players[state.humanId] || state.players[0];
  const home = state.map.districts[player.homeDistrictId];
  const point = home && home.capture ? home.capture : { i: state.map.n / 2, j: state.map.n / 2 };
  const world = tileToWorld(point.i, point.j);
  state.camera.x = world.x;
  state.camera.y = world.y;
  state.camera.z = CAMERA.startZoom;
}

export function selectedUnits(state) {
  return state.units.filter(u => u.selected);
}

export function playerUnits(state, playerId) {
  return state.units.filter(u => u.playerId === playerId);
}

export function districtsOwnedBy(state, playerId) {
  return state.map.districts.filter(d => d.owner === playerId).length;
}

export function clearSelection(state) {
  for (const unit of state.units) unit.selected = false;
}

export function selectAllUnitsOf(state, playerId) {
  for (const unit of state.units) unit.selected = unit.playerId === playerId;
}

// إعادة توليد المباراة بنفس الإعدادات داخل نفس كائن الحالة
export function resetMatch(state) {
  const fresh = createMatch(state.settings);
  state.map = fresh.map;
  state.players = fresh.players;
  state.units = fresh.units;
  state.projectiles = [];
  state.stats = fresh.stats;
  state.nextUnitId = fresh.nextUnitId;
  state.humanId = fresh.humanId;
  state.moveMarker = null;
  state.selectionBox = null;
  state.time = 0;
  centerCameraOnHome(state);
}
