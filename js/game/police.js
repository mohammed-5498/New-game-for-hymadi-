// مراكز الشرطة (القسم 3.8): طرف محايد معادٍ للجميع
// لا تنتمي لأي لاعب، ولا تستولي على حي، ولا تبتعد عن مركزها.
import { TICK_SEC, POLICE, UNIT_ART } from '../config.js';
import { createUnit } from './units.js';
import { findFreeTiles } from '../map/pathfinding.js';
import { COMBAT } from '../config.js';
import { random } from './random.js';   // عشوائية المنطق: مشتركة بين الأجهزة في اللعب المحلي
import { dressMainPolice, joinPolice } from './features.js';

const isAlive = (unit) => unit.state !== 'dead' && unit.hp > 0;

// اللاعب المحايد الذي تتبعه كل الشرطة: بلا فريق فهو عدو للجميع (القسم 3.8)
export function createPolicePlayer(players) {
  return {
    id: players.length,
    name: 'الشرطة',
    gang: 'police',
    nation: null,
    gangName: 'الشرطة',
    color: UNIT_ART.policeColor,
    isHuman: false,
    neutral: true,           // خارج حساب الفوز والخسارة والبوتات
    team: 0,
    difficulty: 'medium',
    homeDistrictId: -1
  };
}

export const policePlayer = (state) => state.players.find(p => p.gang === 'police') || null;
export const policeStations = (state) => state.map.districts.filter(d => d.police);

// مؤقتات كل مركز: شرطي كل 10 ثوانٍ، وضابط واحد يعود بعد موته بـ 40 ثانية
export function initPolice(state) {
  state.policeTimers = {};
  const player = policePlayer(state);
  if (!player) return;

  // الصمود ضد الشرطة: لا إنتاج عادي، المراكز مصدر للموجات فقط (القسم 9.5.5)
  if (state.mode === 'survival') return;

  for (const station of policeStations(state)) {
    state.policeTimers[station.id] = { produce: POLICE.produceSeconds, captain: 0 };
    spawnPolice(state, station, true);        // الضابط يظهر مع بداية المباراة
  }
}

export function updatePolice(state) {
  const player = policePlayer(state);
  if (!player || state.mode === 'survival') return;

  // مركز الشرطة الرئيسي (روتنبورغ، القسم 3.11): الشرطة صديقة لمن يملكه (isEnemyId في combat.js)
  const main = state.map.districts.find(d => d.policeMain);
  const friend = main && main.owner !== null && !state.players[main.owner].neutral ? main.owner : -1;
  if (player.friendOf !== friend) {
    player.friendOf = friend;
    if (friend >= 0 && friend === state.humanId) {
      state.notice = { text: 'استوليت على مركز الشرطة الرئيسي: الشرطة صديقة لك، وتنضم إليك شرطة كل مركز تحتله', mine: true, t: 5 };
    }
  }

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

// والمركز الذي يحتله صاحب المركز الرئيسي (القسم 3.11): شرطته تنضم إليه بدل أن تختفي
function disableStation(state, station) {
  station.policeDisabled = true;
  const police = policePlayer(state);
  const owner = police && station.owner === police.friendOf ? state.players[station.owner] : null;
  let joined = 0;
  for (const unit of state.units) {
    if (unit.stationId !== station.id || !isAlive(unit)) continue;
    if (owner) { joinPolice(state, unit, owner); joined++; }
    else unit.vanishAt = state.time + random() * POLICE.vanishSeconds;
  }
  if (joined && owner.id === state.humanId) state.notice = { text: 'انضم إليك ' + joined + ' من الشرطة', mine: true, t: 3 };
}

function spawnPolice(state, station, captain) {
  if (!station.capture) return false;
  const player = policePlayer(state);
  const spots = findFreeTiles(state.map, station.capture.i, station.capture.j, 6);
  if (!spots.length) return false;

  const [i, j] = spots[Math.floor(random() * spots.length)];
  const unit = createUnit(state, player, i, j, captain ? 'captain' : null);
  if (station.policeMain) dressMainPolice(unit, captain);     // شرطة المركز الرئيسي بشكل ألمانيا (القسم 3.11)
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
