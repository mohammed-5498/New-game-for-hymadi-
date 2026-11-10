// مراكز الشرطة (js/game/police.js): طرف محايد معادٍ للجميع، لا يستولي ولا يبتعد عن مركزه
import 'dart:math' as math;

import '../core/cfg.dart';
import '../data/js_config.dart';
import '../map/generator.dart';
import '../map/pathfinding.dart';
import 'state.dart';
import 'units.dart';

bool _alive(Unit u) => u.state != 'dead' && u.hp > 0;

class PoliceTimer {
  double produce, captain;
  PoliceTimer(this.produce, this.captain);
}

Player createPolicePlayer(List<Player> players) => Player(id: players.length, name: 'الشرطة', gang: 'police',
    gangName: 'الشرطة', color: UNIT_ART.s('policeColor'))..neutral = true;

Player? policePlayer(MatchState state) {
  for (final p in state.players) { if (p.gang == 'police') return p; }
  return null;
}

Iterable<District> policeStations(MatchState state) => state.map.districts.where((d) => d.police);

void initPolice(MatchState state) {
  state.policeTimers.clear();
  if (policePlayer(state) == null) return;
  if (state.mode == 'survival') return;
  for (final station in policeStations(state).toList()) {
    state.policeTimers[station.id] = PoliceTimer(POLICE.d('produceSeconds'), 0);
    _spawnPolice(state, station, true);
  }
}

void updatePolice(MatchState state) {
  final player = policePlayer(state);
  if (player == null || state.mode == 'survival') return;
  District? main;
  for (final d in state.map.districts) { if (d.policeMain) { main = d; break; } }
  final friend = main != null && main.owner != null && !state.players[main.owner!].neutral ? main.owner! : -1;
  if (player.friendOf != friend) player.friendOf = friend;
  for (final station in policeStations(state).toList()) {
    if (station.owner != null && !station.policeDisabled) _disableStation(state, station);
    if (station.policeDisabled) continue;
    final timers = state.policeTimers[station.id];
    if (timers == null) continue;
    if (countPolice(state, station.id, false) < POLICE.i('maxPerStation')) {
      timers.produce -= TICK_SEC;
      if (timers.produce <= 0 && _spawnPolice(state, station, false)) timers.produce = POLICE.d('produceSeconds');
    }
    if (countPolice(state, station.id, true) == 0) {
      if (timers.captain <= 0) timers.captain = POLICE.d('captainRespawnSeconds');
      timers.captain -= TICK_SEC;
      if (timers.captain <= 0 && _spawnPolice(state, station, true)) timers.captain = 0;
    } else {
      timers.captain = 0;
    }
  }
  for (final unit in state.units) {
    if (unit.vanishAt < 0 || !_alive(unit)) continue;
    if (state.time < unit.vanishAt) continue;
    unit.hp = 0;
    unit.state = 'dead';
    unit.deathTimer = COMBAT.d('deathTime');
    unit.target = null;
    unit.path = [];
  }
}

// ponytail: انضمام الشرطة لصاحب المركز الرئيسي (روتنبورغ) مع مزايا المدن في ن8؛ الآن تختفي كغيرها
void _disableStation(MatchState state, District station) {
  station.policeDisabled = true;
  for (final unit in state.units) {
    if (unit.stationId != station.id || !_alive(unit)) continue;
    unit.vanishAt = state.time + random() * POLICE.d('vanishSeconds');
  }
}

bool _spawnPolice(MatchState state, District station, bool captain) {
  final cap = station.capture;
  if (cap == null) return false;
  final player = policePlayer(state)!;
  final spots = findFreeTiles(state.map, cap.i, cap.j, 6);
  if (spots.isEmpty) return false;
  final (i, j) = spots[(random() * spots.length).floor()];
  final unit = createUnit(state, player, i, j, captain ? 'captain' : null);
  unit.stationId = station.id;
  unit.homePost = Point2(cap.i.toDouble(), cap.j.toDouble());
  state.units.add(unit);
  return true;
}

int countPolice(MatchState state, int stationId, bool captain) {
  var n = 0;
  for (final unit in state.units) {
    if (unit.stationId != stationId || !_alive(unit)) continue;
    if ((unit.hero == 'captain') == captain) n++;
  }
  return n;
}

double policeArmorBonus(MatchState state, int playerId) {
  var owned = 0;
  for (final s in policeStations(state)) { if (s.owner == playerId) owned++; }
  return math.min(POLICE.d('armorBonusMax'), owned * POLICE.d('armorBonus'));
}
