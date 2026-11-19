// ظهور الأفراد عند ساحات أعلام الأحياء (js/game/spawn.js). مع الاقتصاد (كل الأطوار) الجنود من القاعدة
import 'dart:math' as math;

import '../audio/sound.dart';
import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../map/generator.dart';
import '../map/pathfinding.dart';
import 'combat.dart';
import 'state.dart';
import 'units.dart';

void initSpawnTimers(MatchState state) {
  state.spawnTimers = [for (final p in state.players) normalInterval(state, p)];
  state.heroTimers = [for (final p in state.players) heroInterval(state, p)];
  state.heroTurn = [for (final _ in state.players) 0];
  state.championTimers = [for (final _ in state.players) null];
}

bool ownsSpecial(MatchState state, int playerId, String type) =>
    state.map.districts.any((d) => d.owner == playerId && d.special == type);

double _clockFactor(MatchState state, int playerId) =>
    ownsSpecial(state, playerId, 'clock') ? SPECIAL_BONUS.m('clock').d('spawnMultiplier') : 1;

double _botSpawnFactor(Player player) {
  if (player.isHuman || player.neutral) return 1;
  final lvl = ai.m('levels').mm(player.difficulty);
  return lvl != null && truthy(lvl['spawnFactor']) ? lvl.d('spawnFactor') : 1;
}

double normalInterval(MatchState state, Player player) {
  final owned = ownedDistricts(state, player.id).length;
  final seconds = math.max(SPAWN.d('normalMin'), SPAWN.d('normalBase') - math.max(0, owned - 1) * SPAWN.d('normalPerDistrict'));
  final gang = GANGS.mm(player.gang);
  final sm = gang?.m('unit')['spawnMultiplier'];
  final multiplier = truthy(sm) ? (sm as num).toDouble() : 1.0;
  return seconds * multiplier * _clockFactor(state, player.id) * _botSpawnFactor(player);
}

double heroInterval(MatchState state, Player player) {
  final owned = ownedDistricts(state, player.id).length;
  final seconds = math.max(SPAWN.d('heroMin'), SPAWN.d('heroBase') - math.max(0, owned - 1) * SPAWN.d('heroPerDistrict'));
  return seconds * _clockFactor(state, player.id) * _botSpawnFactor(player);
}

void updateSpawn(MatchState state) {
  if (state.economy) return;
  for (final player in state.players) {
    if (player.neutral) continue;
    final districts = ownedDistricts(state, player.id);
    if (districts.isEmpty) continue;
    _updateChampion(state, player, districts);
    if (countUnits(state, player.id) >= state.maxUnits) continue;
    state.spawnTimers[player.id] -= TICK_SEC;
    state.heroTimers[player.id] -= TICK_SEC;
    if (state.spawnTimers[player.id] <= 0) {
      _spawnUnit(state, player, districts, null);
      state.spawnTimers[player.id] = normalInterval(state, player);
    }
    if (state.heroTimers[player.id] <= 0) {
      final heroes = GANGS.m(player.gang).l('heroes');
      final heroId = heroes[state.heroTurn[player.id] % heroes.length] as String;
      state.heroTurn[player.id]++;
      _spawnUnit(state, player, districts, heroId);
      state.heroTimers[player.id] = heroInterval(state, player);
    }
  }
}

void _spawnUnit(MatchState state, Player player, List<District> districts, String? heroId) {
  final safe = districts.where((d) => !_hasEnemyNearFlag(state, d, player.id)).toList();
  final pool = safe.isNotEmpty ? safe : districts;
  final district = pool[(random() * pool.length).floor()];
  final spots = findFreeTiles(state.map, district.capture!.i, district.capture!.j, SPAWN.i('spotSearchTiles'));
  if (spots.isEmpty) return;
  final (i, j) = spots[(random() * spots.length).floor()];
  state.units.add(createUnit(state, player, i, j, heroId));
  soundAt(state, 'spawn', i.toDouble(), j.toDouble());
}

bool _hasEnemyNearFlag(MatchState state, District district, int playerId) {
  final i = district.capture!.i, j = district.capture!.j;
  for (final unit in state.units) {
    if (unit.state == 'dead') continue;
    if (!isEnemyId(state, playerId, unit.playerId)) continue;
    if (hypot(unit.x - i, unit.y - j) <= MAP_GEN.d('captureRadius')) return true;
  }
  return false;
}

List<District> ownedDistricts(MatchState state, int playerId) =>
    state.map.districts.where((d) => d.owner == playerId && d.capture != null).toList();

int countUnits(MatchState state, int playerId) {
  var n = 0;
  for (final unit in state.units) { if (unit.playerId == playerId && unit.state != 'dead') n++; }
  return n;
}

Unit? championOf(MatchState state, int playerId) {
  for (final u in state.units) { if (u.playerId == playerId && u.champion && u.state != 'dead') return u; }
  return null;
}

Unit? spawnChampion(MatchState state, Player player, District? district) {
  if (district == null || district.capture == null) return null;
  if (championOf(state, player.id) != null) return null;
  final spots = findFreeTiles(state.map, district.capture!.i, district.capture!.j, SPAWN.i('spotSearchTiles'));
  if (spots.isEmpty) return null;
  final (i, j) = spots[(random() * spots.length).floor()];
  final champion = createUnit(state, player, i, j, null, true);
  state.units.add(champion);
  soundAt(state, 'spawn', i.toDouble(), j.toDouble());
  return champion;
}

void _updateChampion(MatchState state, Player player, List<District> districts) {
  if (championOf(state, player.id) != null) { state.championTimers[player.id] = null; return; }
  if (state.mode == 'regicide') return;
  if (state.championTimers[player.id] == null) {
    state.championTimers[player.id] = SPAWN.d('championRespawnSeconds');
    return;
  }
  if (districts.length < SPAWN.i('championMinDistricts')) return;
  state.championTimers[player.id] = state.championTimers[player.id]! - TICK_SEC;
  if (state.championTimers[player.id]! > 0) return;
  if (countUnits(state, player.id) >= state.maxUnits) return;
  final safe = districts.where((d) => !_hasEnemyNearFlag(state, d, player.id)).toList();
  final pool = safe.isNotEmpty ? safe : districts;
  final district = pool[(random() * pool.length).floor()];
  if (spawnChampion(state, player, district) != null) state.championTimers[player.id] = null;
}
