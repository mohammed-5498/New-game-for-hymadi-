// مراكز الشرطة (القسم 3.8): طرف محايد معادٍ للجميع
// لا تنتمي لأي لاعب، ولا تستولي على حي، ولا تبتعد عن مركزها.
import { TICK_SEC, POLICE, UNIT_ART } from '../config.js';
import { createUnit } from './units.js';
import { findFreeTiles } from '../map/pathfinding.js';
import { COMBAT } from '../config.js';

const isAlive = (unit) => unit.state !== 'dead' && unit.hp > 0;

// اللاعب المحايد الذي تتبعه كل الشرطة: بلا فريق فهو عدو للجميع (القسم 3.8)
export function createPolicePlayer(players) {
  return {
    id: players.length,
    name: 'الشرطة',
    gang: 'police',
    gangName: 'الشرطة',
    color: UNIT_ART.policeColor,
    isHuman: false,
    neutral: true,           // خارج حساب الفوز والخسارة والبوتات
    team: 0,
    difficulty: 'medium',
    homeDistrictId: -1
  };
}

export const policePlayer = (state) => state.players.find(p => p.neutral) || null;
export const policeStations = (state) => state.map.districts.filter(d => d.police);

// مؤقتات كل مركز: شرطي كل 10 ثوانٍ، وضابط واحد يعود بعد موته بـ 40 ثانية
export function initPolice(state) {
  state.policeTimers = {};
  const player = policePlayer(state);
  if (!player) return;

  for (const station of policeStations(state)) {
    state.policeTimers[station.id] = { produce: POLICE.produceSeconds, captain: 0 };
    spawnPolice(state, station, true);        // الضابط يظهر مع بداية المباراة
  }
}

export function updatePolice(state) {
  const player = policePlayer(state);
  if (!player) return;

  for (const station of policeStations(state)) {
    // أول استيلاء يوقف الإنتاج نهائياً، ولا يعود المركز ينتج أبداً
    if (station.owner !== null && !station.policeDisabled) disableStation(state, station);
    if (station.policeDisabled) continue;

    const timers = state.policeTimers[station.id];
    if (!timers) continue;

    // شرطي كل 10 ثوانٍ، ويستأنف الإنتاج كلما نقص العدد عن الحد
    if (countPolice(state, station.id, false) < POLICE.maxPerStation) {
      timers.produce -= TICK_SEC;
      if (timers.produce <= 0 && spawnPolice(state, station, false)) {
        timers.produce = POLICE.produceSeconds;
      }
    }

    // الضابط: واحد لكل مركز، ولا يتكرر إلا بعد موته بـ 40 ثانية
    if (countPolice(state, station.id, true) === 0) {
      if (timers.captain <= 0) timers.captain = POLICE.captainRespawnSeconds;
      timers.captain -= TICK_SEC;
      if (timers.captain <= 0 && spawnPolice(state, station, true)) timers.captain = 0;
    } else {
      timers.captain = 0;
    }
  }

  // الشرطة التابعة لمركز مستولى عليه تختفي خلال 5 ثوانٍ
  for (const unit of state.units) {
    if (unit.vanishAt < 0 || !isAlive(unit)) continue;
    if (state.time < unit.vanishAt) continue;
    unit.hp = 0;
    unit.state = 'dead';
    unit.deathTimer = COMBAT.deathTime;
    unit.target = null;
    unit.path = [];
  }
}

function disableStation(state, station) {
  station.policeDisabled = true;
  for (const unit of state.units) {
    if (unit.stationId !== station.id || !isAlive(unit)) continue;
    unit.vanishAt = state.time + Math.random() * POLICE.vanishSeconds;
  }
}

function spawnPolice(state, station, captain) {
  if (!station.capture) return false;
  const player = policePlayer(state);
  const spots = findFreeTiles(state.map, station.capture.i, station.capture.j, 6);
  if (!spots.length) return false;

  const [i, j] = spots[Math.floor(Math.random() * spots.length)];
  const unit = createUnit(state, player, i, j, captain ? 'captain' : null);
  unit.stationId = station.id;
  // لا تبتعد عن مركزها أكثر من 6 مربعات مهما طاردت
  unit.homePost = { x: station.capture.i, y: station.capture.j };
  state.units.push(unit);
  return true;
}

export function countPolice(state, stationId, captain) {
  let n = 0;
  for (const unit of state.units) {
    if (unit.stationId !== stationId || !isAlive(unit)) continue;
    if ((unit.hero === 'captain') === captain) n++;
  }
  return n;
}

// مكافأة الاستيلاء على مركز: +10% درع لكل وحدات المستولي، بحد أقصى +20%
export function policeArmorBonus(state, playerId) {
  let owned = 0;
  for (const station of policeStations(state)) if (station.owner === playerId) owned++;
  return Math.min(POLICE.armorBonusMax, owned * POLICE.armorBonus);
}
