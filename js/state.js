// حالة المباراة: اللاعبون، الوحدات، الخريطة، الكاميرا، التحديد
import { CAMERA, PLAYER_COLORS, GANGS, UNITS, WEATHER } from './config.js';
import { createMap } from './map/generator.js';
import { findFreeTiles } from './map/pathfinding.js';
import { createUnit } from './game/units.js';
import { buildCaptureZones } from './game/capture.js';
import { initSpawnTimers } from './game/spawn.js';
import { initBots } from './ai/bot.js';
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
    difficulty: p.difficulty || 'medium',
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
    pathQueue: [],             // طلبات المسار المنتظرة
    nextUnitId: 1,
    humanId: players.findIndex(p => p.isHuman),
    weather: WEATHER[settings.weather] ? settings.weather : 'day',
    maxUnits: settings.maxUnits,
    camera: { x: 0, y: 0, z: CAMERA.startZoom },
    view: { w: 1, h: 1, dpr: 1 },
    inputMode: 'pan',          // pan | select
    running: false,            // هل المباراة جارية (لا تعمل داخل القوائم)
    paused: false,             // قائمة الإيقاف مفتوحة
    selectionBox: null,        // مربع التحديد أثناء السحب
    moveMarker: null,          // حلقة مكان أمر الحركة
    notice: null,              // إشعار قصير (استيلاء على حي)
    matchResult: null,         // نتيجة المباراة عند انتهائها
    spawnTimers: [],
    botTimers: [],
    heroTimers: [],
    heroTurn: [],
    fires: [],                 // مناطق نار رامي النار
    time: 0,                   // زمن المباراة بالثواني
    stats: {
      kills: players.map(() => 0),
      losses: players.map(() => 0),
      maxDistricts: 1          // أكبر عدد أحياء امتلكها اللاعب
    }
  };

  buildCaptureZones(state);
  spawnStartingUnits(state);
  initSpawnTimers(state);
  initBots(state);
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

// كل وحدات اللاعب داخل دائرة حول وحدة معينة، مهما كان نوعها
// (تحديد المجموعة بالنقر المزدوج على جندي)
export function selectUnitsAround(state, center, radius) {
  const radiusSq = radius * radius;
  let count = 0;

  for (const unit of state.units) {
    if (unit.playerId !== center.playerId || unit.state === 'dead') { unit.selected = false; continue; }
    const dx = unit.x - center.x, dy = unit.y - center.y;
    unit.selected = dx * dx + dy * dy <= radiusSq;
    if (unit.selected) count++;
  }

  if (!center.selected && center.state !== 'dead') { center.selected = true; count++; }
  return count;
}

// بدء مباراة جديدة داخل نفس كائن الحالة (حتى تبقى مراجع اللمس والواجهة صالحة)
export function resetMatch(state, settings = state.settings) {
  const fresh = createMatch(settings);
  state.settings = settings;
  state.weather = fresh.weather;
  state.maxUnits = fresh.maxUnits;
  state.paused = false;
  state.map = fresh.map;
  state.players = fresh.players;
  state.units = fresh.units;
  state.projectiles = [];
  state.pathQueue = [];
  state.stats = fresh.stats;
  state.spawnTimers = fresh.spawnTimers;
  state.botTimers = fresh.botTimers;
  state.heroTimers = fresh.heroTimers;
  state.heroTurn = fresh.heroTurn;
  state.fires = [];
  state.nextUnitId = fresh.nextUnitId;
  state.humanId = fresh.humanId;
  state.moveMarker = null;
  state.selectionBox = null;
  state.notice = null;
  state.matchResult = null;
  state.time = 0;
  centerCameraOnHome(state);
}
