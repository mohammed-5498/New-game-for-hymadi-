// البوتات (js/ai/bot.js وjs/ai/tactics.js): السهل أفراد بلا فرق، والمتوسط فما فوق فرق (squads.dart) وتكتيك لكل اشتباك،
// وأولويات كل طور (حماية الزعيم وملك الحي والوقت بالنقاط والصمود)
import 'dart:math' as math;

import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../game/combat.dart';
import '../game/empire.dart';
import '../game/modes.dart';
import '../game/spatial.dart';
import '../game/spawn.dart';
import '../game/state.dart';
import '../game/ults.dart';
import '../game/units.dart';
import '../map/generator.dart';
import 'empire_bot.dart';
import 'squads.dart';

bool _alive(Unit? u) => u != null && u.state != 'dead' && u.hp > 0;
double _distTo(Unit unit, District d) => hypot(unit.x - d.capture!.i, unit.y - d.capture!.j);
// isEnemy(state, unit, { playerId }) في JavaScript: الوحدة ضد لاعب (رشوة الشرطي فيها)
bool _enemyOfPlayer(MatchState state, Unit unit, int pid) {
  if (unit.bribedUntil > state.time && unit.bribedBy == pid) return false;
  return isEnemyId(state, unit.playerId, pid);
}

void initBots(MatchState state) {
  setTargetPicker(pickTarget);
  setUltGate(ultAllowed);
  state.botTimers = [for (final p in state.players) p.isHuman || p.neutral ? 0.0 : random() * BOT.m(p.difficulty).d('decisionInterval')];
}

void updateBots(MatchState state) {
  for (final player in state.players) {
    if (player.isHuman || player.neutral) continue;
    final config = BOT.m(player.difficulty);
    state.botTimers[player.id] -= TICK_SEC;
    if (state.botTimers[player.id] > 0) continue;
    state.botTimers[player.id] = config.d('decisionInterval');
    if (state.economy) empireEconomy(state, player);
    _decide(state, player, _modeConfig(state, config));
  }
  _updateTactics(state);
}

// أولويات البوت حسب الطور (القسم 9.5)
J _modeConfig(MatchState state, J config) {
  if (state.mode == 'points') {
    final P = gameModes.m('points');
    return {...config, 'expandGroup': math.min(config.d('groupSize'), P.d('botExpandGroup')),
      'defenseFactor': config.d('defenseFactor') * P.d('botDefenseBoost'),
      'attackArmy': (config.d('attackArmy') * P.d('botAttackArmyFactor')).ceil()};
  }
  if (state.mode == 'survival') {
    return {...config, 'attackArmy': (config.d('attackArmy') * gameModes.m('survival').d('botAttackArmyFactor')).ceil()};
  }
  return config;
}

void _decide(MatchState state, Player player, J config) {
  final units = state.units.where((u) => u.playerId == player.id && _alive(u)).toList();
  if (units.isEmpty) return;
  final free = <Unit>[];
  for (final unit in units) {
    if (_taskStillValid(state, unit)) continue;
    unit.botTask = null;
    if (unit.state != 'attacking') free.add(unit);
  }
  final owned = ownedDistricts(state, player.id);
  if (free.isEmpty) {
    if (levelOf(player).b('squads')) decideSquads(state, player, config, [], units, owned, strongestPlayer);
    return;
  }
  final pool = free;
  if (state.mode == 'regicide') _regicidePlan(state, player, config, pool, units);
  if (config.b('retreatWounded')) _retreatWounded(state, player, config, pool, owned);
  if (state.mode == 'king') _kingPlan(state, player, config, pool, units.length);
  if (levelOf(player).b('squads')) {
    if (state.mode == 'survival') _helpAllies(state, player, config, pool);
    if (isFinalMinute(state)) _strikeLeader(state, player, config, pool);
    decideSquads(state, player, config, pool, units, owned, strongestPlayer);
    return;
  }
  _defend(state, player, config, pool, owned);
  if (state.mode == 'survival') _helpAllies(state, player, config, pool);
  if (isFinalMinute(state)) _strikeLeader(state, player, config, pool);
  _expand(state, player, config, pool);
  _attack(state, player, config, pool, units.length);
}

bool _taskStillValid(MatchState state, Unit unit) {
  final task = unit.botTask;
  if (task == null) return false;
  if (task.type == 'squad') return squadOf(state, unit) != null;
  if (task.type == 'regroup') return state.time < task.until;
  if (task.type == 'hunt') return state.mode == 'regicide' && _alive(task.leader);
  if (task.type == 'leader') return state.mode == 'regicide';
  if (task.districtId < 0 || task.districtId >= state.map.districts.length) return false;
  final district = state.map.districts[task.districtId];
  switch (task.type) {
    case 'defend': return district.owner == unit.playerId && _districtThreat(state, district, unit.playerId) > 0;
    case 'expand': return district.owner == null;
    case 'attack': return district.owner != null && district.owner != unit.playerId && _enemyOfPlayer(state, unit, district.owner!);
    case 'heal': return unit.hp < unit.maxHp && district.owner == unit.playerId;
    case 'hill': return state.mode == 'king';
    case 'guard': return district.owner == unit.playerId;
    case 'help':
      return district.owner != null && district.owner != unit.playerId &&
          !_enemyOfPlayer(state, unit, district.owner!) && _districtThreat(state, district, district.owner!) > 0;
  }
  return false;
}

// --- الصمود: أقرب مجموعة صغيرة إلى حي حليف تهاجمه الشرطة ---
void _helpAllies(MatchState state, Player player, J config, List<Unit> pool) {
  final threatened = [
    for (final d in state.map.districts)
      if (d.capture != null && d.owner != null && d.owner != player.id && !state.players[d.owner!].neutral && !isEnemyId(state, player.id, d.owner!))
        (d, _districtThreat(state, d, d.owner!)),
  ].where((e) => e.$2 > 0).toList();
  stableSort<(District, int)>(threatened, (a, b) => b.$2 - a.$2);
  final size = gameModes.m('survival').i('botHelpGroup');
  for (final (district, _) in threatened) {
    if (pool.length < size) return;
    final group = _takeNearest(pool, district, size, config, false);
    if (group.isNotEmpty) _sendGroup(state, group, district, config, 'help');
  }
}

// --- حماية الزعيم: الزعيم خلف جيشه نحو حيه، والصيد حين يظهر زعيم عدو ضعيف أو معزول ---
void _regicidePlan(MatchState state, Player player, J config, List<Unit> pool, List<Unit> units) {
  final R = gameModes.m('regicide');
  final leader = units.where((u) => u.champion).firstOrNull;
  if (leader != null) {
    final at = pool.indexOf(leader);
    if (at >= 0) pool.removeAt(at);
    if (leader.state != 'attacking') _guardLeader(state, player, leader, units, R);
  }
  _huntLeaders(state, player, config, pool, units, R);
}

void _guardLeader(MatchState state, Player player, Unit leader, List<Unit> units, J R) {
  final ds = state.map.districts;
  final home = player.homeDistrictId >= 0 && player.homeDistrictId < ds.length ? ds[player.homeDistrictId] : null;
  final homeOwned = home != null && home.capture != null && home.owner == player.id;
  final army = units.where((u) => u != leader).toList();
  double ti, tj;
  if (homeOwned && (leader.hp < leader.maxHp * 0.5 || army.isEmpty)) {
    ti = home.capture!.i.toDouble(); tj = home.capture!.j.toDouble();
  } else if (army.isNotEmpty) {
    final c = _groupCenter(army);
    final bi = homeOwned ? home.capture!.i.toDouble() : leader.x, bj = homeOwned ? home.capture!.j.toDouble() : leader.y;
    final dx = bi - c.x, dy = bj - c.y, len = hypot(dx, dy);
    final g = R.d('botGuardDistance');
    ti = len > 0.01 ? c.x + dx / len * math.min(g, len) : c.x;
    tj = len > 0.01 ? c.y + dy / len * math.min(g, len) : c.y;
  } else {
    return;
  }
  final last = leader.botTask?.point;
  if (last != null && hypot(last.x - ti, last.y - tj) < 1.5) return;
  leader.botTask = BotTask('leader', point: Point2(ti, tj));
  commandMove(state, ti, tj, [leader], false);
}

void _huntLeaders(MatchState state, Player player, J config, List<Unit> pool, List<Unit> units, J R) {
  if (pool.isEmpty || units.isEmpty) return;
  for (final other in state.players) {
    if (other.neutral || other.fallen || other.id == player.id) continue;
    if (!isEnemyId(state, player.id, other.id)) continue;
    final target = championOf(state, other.id);
    if (target == null) continue;
    if (!units.any((u) => hypot(u.x - target.x, u.y - target.y) <= R.d('botHuntRange'))) continue;
    var guards = 0;
    forEachNearby(state, target.x, target.y, 3, (u) { if (u != target && u.playerId == other.id && _alive(u)) guards++; });
    final weak = target.hp < target.maxHp * R.d('botHuntHpRatio');
    if (!weak && guards >= R.d('botHuntIsolation')) continue;
    final group = _takeNearestAt(pool, target.x, target.y, math.max(config.i('groupSize'), 4), config, true);
    if (group.isEmpty) return;
    for (final unit in group) { unit.botTask = BotTask('hunt', leader: target); }
    commandAttack(state, group, target);
  }
}

// --- ملك الحي: حرس صغير للحي المنزلي، وأغلب الباقين إلى التلة بهجوم متحرك ---
void _kingPlan(MatchState state, Player player, J config, List<Unit> pool, int armySize) {
  final hill = hillOf(state);
  if (hill == null || pool.isEmpty) return;
  final K = gameModes.m('king');
  final ds = state.map.districts;
  final home = player.homeDistrictId >= 0 && player.homeDistrictId < ds.length ? ds[player.homeDistrictId] : null;
  final wanted = math.min(K.d('botHomeGuard'), (armySize * K.d('botHomeGuardShare')).floorToDouble()).toInt();
  final guarding = state.units.where((u) => u.playerId == player.id && u.state != 'dead' && u.botTask?.type == 'guard').length;
  if (home != null && home.owner == player.id && guarding < wanted) {
    final guards = _takeNearest(pool, home, wanted - guarding, config, false);
    for (final unit in guards) { unit.botTask = BotTask('guard', districtId: home.id); }
    if (guards.isNotEmpty) commandMove(state, home.capture!.i.toDouble(), home.capture!.j.toDouble(), guards, false);
  }
  final count = (pool.length * K.d('botHillShare')).ceil();
  final group = _takeNearest(pool, hill, count, config, true);
  if (group.isEmpty) return;
  for (final unit in group) { unit.botTask = BotTask('hill', districtId: hill.id); }
  commandAttackMove(state, hill.capture!.i.toDouble(), hill.capture!.j.toDouble(), group, false);
}

// --- الدقيقة الأخيرة في الوقت بالنقاط: أضعف حي يملكه المتصدر (أقل مدافعين) ---
void _strikeLeader(MatchState state, Player player, J config, List<Unit> pool) {
  if (pool.isEmpty) return;
  final mySide = sideKey(player);
  final sides = sideTotals(state).where((s) => s.alive && s.key != mySide).toList();
  stableSort<SideTotal>(sides, (a, b) => byNum(b.points, a.points));
  if (sides.isEmpty) return;
  final ids = {for (final p in sides[0].players) p.id};
  District? best;
  var fewest = double.infinity;
  for (final district in state.map.districts) {
    if (district.capture == null || !ids.contains(district.owner)) continue;
    var defenders = 0;
    forEachNearby(state, district.capture!.i.toDouble(), district.capture!.j.toDouble(), MAP_GEN.d('captureRadius') * 2, (unit) {
      if (ids.contains(unit.playerId) && _alive(unit)) defenders++;
    });
    if (defenders < fewest) { fewest = defenders.toDouble(); best = district; }
  }
  if (best == null) return;
  while (pool.isNotEmpty) {
    final group = _takeNearest(pool, best, config.i('groupSize'), config, true);
    if (group.isEmpty) break;
    _sendGroup(state, group, best, config, 'attack');
  }
}

int _districtThreat(MatchState state, District district, int playerId) {
  final radius = MAP_GEN.d('captureRadius') * 2;
  var count = 0;
  forEachNearby(state, district.capture!.i.toDouble(), district.capture!.j.toDouble(), radius, (unit) {
    if (!_alive(unit)) return;
    if (!isEnemyId(state, playerId, unit.playerId)) return;
    if (_distTo(unit, district) <= radius) count++;
  });
  return count;
}

void _defend(MatchState state, Player player, J config, List<Unit> pool, List<District> owned) {
  final threatened = [for (final d in owned) (d, _districtThreat(state, d, player.id))].where((e) => e.$2 > 0).toList();
  stableSort<(District, int)>(threatened, (a, b) => b.$2 - a.$2);
  for (final (district, threat) in threatened) {
    if (pool.isEmpty) return;
    final needed = math.max(config.i('groupSize'), (threat * config.d('defenseFactor')).ceil());
    final group = _takeNearest(pool, district, needed, config, false);
    if (group.isNotEmpty) _sendGroup(state, group, district, config, 'defend');
  }
}

Point2 _groupCenter(List<Unit> units) {
  double i = 0, j = 0;
  for (final u in units) { i += u.x; j += u.y; }
  return Point2(i / units.length, j / units.length);
}

void _expand(MatchState state, Player player, J config, List<Unit> pool) {
  if (pool.isEmpty) return;
  final center = _groupCenter(pool);
  final survival = state.mode == 'survival';
  final avoidStations = survival || player.difficulty == 'easy';
  final targets = state.map.districts.where((d) => d.capture != null && d.owner == null &&
      !(d.police && avoidStations && (survival || !d.policeDisabled))).toList();
  stableSort<District>(targets, (a, b) {
    final special = (b.special != null ? 1 : 0) - (a.special != null ? 1 : 0);
    if (special != 0) return special;
    return byNum(hypot(a.capture!.i - center.x, a.capture!.j - center.y), hypot(b.capture!.i - center.x, b.capture!.j - center.y));
  });
  final size = truthy(config['expandGroup']) ? config.i('expandGroup') : config.i('groupSize');
  for (final district in targets) {
    if (pool.length < size) return;
    final group = _takeNearest(pool, district, size, config, false);
    if (group.isNotEmpty) _sendGroup(state, group, district, config, 'expand');
  }
}

void _attack(MatchState state, Player player, J config, List<Unit> pool, int armySize) {
  final groupSize = config.i('groupSize');
  if (armySize < config.d('attackArmy') || pool.length < groupSize) return;
  final targets = _enemyDistricts(state, player);
  if (targets.isEmpty) return;
  final center = _groupCenter(pool);
  final leader = strongestPlayer(state, player);
  stableSort<District>(targets, (a, b) {
    if (leader != null) {
      final priority = (a.owner == leader ? 0 : 1) - (b.owner == leader ? 0 : 1);
      if (priority != 0) return priority;
    }
    final weak = _ownedCount(state, a.owner!) - _ownedCount(state, b.owner!);
    final distance = hypot(a.capture!.i - center.x, a.capture!.j - center.y) - hypot(b.capture!.i - center.x, b.capture!.j - center.y);
    return byNum(distance + weak * 3, 0);
  });
  final chosen = config.b('focusTarget') ? [targets[0]] : targets;
  for (final district in chosen) {
    while (pool.length >= groupSize) {
      final group = _takeNearest(pool, district, groupSize, config, true);
      if (group.isEmpty) break;
      _sendGroup(state, group, district, config, 'attack');
      if (!config.b('focusTarget')) break;
    }
    if (pool.length < groupSize) break;
  }
}

void _retreatWounded(MatchState state, Player player, J config, List<Unit> pool, List<District> owned) {
  District? hospital;
  for (final d in owned) { if (isHospital(d)) { hospital = d; break; } }
  if (hospital == null) return;
  final at = healPoint(state.map, hospital);
  final wounded = pool.where((u) => u.hp < u.maxHp * config.d('retreatHpRatio')).toList();
  for (final unit in wounded) {
    pool.removeAt(pool.indexOf(unit));
    unit.botTask = BotTask('heal', districtId: hospital.id);
    commandMove(state, at.i.toDouble(), at.j.toDouble(), [unit], false);
  }
}

List<Unit> _takeNearest(List<Unit> pool, District district, int count, J config, bool isAttack) =>
    _takeNearestAt(pool, district.capture!.i.toDouble(), district.capture!.j.toDouble(), count, config, isAttack);

List<Unit> _takeNearestAt(List<Unit> pool, double ci, double cj, int count, J config, bool isAttack) {
  final candidates = pool.where((u) => !(isAttack && truthy(u.stats['aura']) && count < config.d('bossMinGroup'))).toList();
  stableSort<Unit>(candidates, (a, b) => byNum(hypot(a.x - ci, a.y - cj), hypot(b.x - ci, b.y - cj)));
  final group = candidates.take(count).toList();
  for (final unit in group) { pool.removeAt(pool.indexOf(unit)); }
  return group;
}

void _sendGroup(MatchState state, List<Unit> group, District district, J config, String taskType) {
  for (final unit in group) { unit.botTask = BotTask(taskType, districtId: district.id); }
  final behind = config.b('rangedBehind');
  final front = behind ? group.where((u) => !truthy(u.stats['projectile'])).toList() : group;
  final back = behind ? group.where((u) => truthy(u.stats['projectile'])).toList() : <Unit>[];
  final ci = district.capture!.i.toDouble(), cj = district.capture!.j.toDouble();
  if (front.isNotEmpty) commandMove(state, ci, cj, front, false);
  if (back.isNotEmpty) {
    final center = _groupCenter(back);
    final dx = center.x - ci, dy = center.y - cj;
    var length = hypot(dx, dy);
    if (length == 0 || length.isNaN) length = 1;
    commandMove(state, ci + (dx / length) * config.d('rangedOffset'), cj + (dy / length) * config.d('rangedOffset'), back, false);
  }
}

List<District> _enemyDistricts(MatchState state, Player player) => state.map.districts.where((d) =>
    d.capture != null && d.owner != null && d.owner != player.id && isEnemyId(state, player.id, d.owner!)).toList();

int _ownedCount(MatchState state, int playerId) => state.map.districts.where((d) => d.owner == playerId).length;

int? strongestPlayer(MatchState state, Player player) {
  final total = state.map.districts.where((d) => d.capture != null).length;
  if (total == 0) return null;
  for (final other in state.players) {
    if (other.id == player.id) continue;
    if (!isEnemyId(state, player.id, other.id)) continue;
    if (_ownedCount(state, other.id) / total >= SNOWBALL.d('districtShare')) return other.id;
  }
  return null;
}

// ================= الطبقة التكتيكية (tactics.js) =================
J? _tacticsFor(MatchState state, Unit unit) {
  if (unit.playerId < 0 || unit.playerId >= state.players.length) return null;
  final player = state.players[unit.playerId];
  if (player.isHuman || player.neutral) return null;
  final lvl = levelOf(player);
  return lvl.b('squads') ? lvl : null;
}

bool _priority(Unit t) => t.hero == 'medic' || t.hero == 'sniper' || (t.champion && t.hp < t.maxHp * ai.d('woundedHero'));

Unit? pickTarget(MatchState state, Unit unit, double vision) {
  if (unit.focusHeroes) return _heroFirst(state, unit, vision);
  final lvl = _tacticsFor(state, unit);
  if (lvl == null || !lvl.b('focus')) return useDefaultTarget;
  final ar = unit.stats.dz('attackRange');
  final reach = math.min(vision, (ar != 0 ? ar : 1) + ai.d('focusReach'));
  Unit? best, crowded;
  var bestScore = double.infinity, crowdedScore = double.infinity;
  forEachNearby(state, unit.x, unit.y, reach, (other) {
    if (other == unit || !_alive(other) || !isEnemy(state, unit, other)) return;
    final d = hypot(other.x - unit.x, other.y - unit.y);
    if (d >= reach) return;
    final ehp = other.hp / math.max(0.05, 1 - other.stats.dz('armor'));
    final score = d + ehp / ai.d('ehpScale') - (_priority(other) ? ai.d('priorityBonus') : 0);
    if (score >= bestScore && score >= crowdedScore) return;
    if (_attackersOn(state, unit.playerId, other) >= ai.i('maxAttackersPerTarget')) {
      if (score < crowdedScore) { crowdedScore = score; crowded = other; }
      return;
    }
    if (score < bestScore) { bestScore = score; best = other; }
  });
  return best ?? crowded ?? useDefaultTarget;
}

Unit? _heroFirst(MatchState state, Unit unit, double vision) {
  Unit? best;
  var bestScore = double.infinity;
  forEachNearby(state, unit.x, unit.y, vision, (other) {
    if (other == unit || !_alive(other) || !isEnemy(state, unit, other)) return;
    final d = hypot(other.x - unit.x, other.y - unit.y);
    if (d >= vision) return;
    final score = d - (other.champion ? 6 : other.hero != null ? 4 : 0);
    if (score < bestScore) { bestScore = score; best = other; }
  });
  return best ?? useDefaultTarget;
}

int _attackersOn(MatchState state, int playerId, Unit target) {
  var count = 0;
  forEachNearby(state, target.x, target.y, 3, (unit) {
    if (unit.playerId == playerId && unit.target == target && unit.state == 'attacking') count++;
  });
  return count;
}

bool ultAllowed(MatchState state, Unit unit, J ult, Unit target) {
  final lvl = _tacticsFor(state, unit);
  if (lvl == null || !truthy(lvl['smartUlts'])) return true;
  final full = lvl['smartUlts'] == 'full';
  if (unit.ultHeldSince < 0) unit.ultHeldSince = state.time;
  if (state.time - unit.ultHeldSince >= ai.d('ultHoldSeconds')) { unit.ultHeldSince = -1; return true; }
  final ok = _goodMoment(state, unit, ult, target, full);
  if (ok) unit.ultHeldSince = -1;
  return ok;
}

bool _goodMoment(MatchState state, Unit unit, J ult, Unit? target, bool full) {
  final kind = ult['kind'];
  final aoe = ai.d('aoeMinEnemies');
  if (kind == 'slam' || kind == 'arc' || kind == 'whirl' || kind == 'roda' || kind == 'banner') {
    return _countAround(state, unit, unit.x, unit.y, ult.d('radius'), true) >= aoe;
  }
  if (kind == 'fire') {
    final spot = target ?? unit;
    return _countAround(state, unit, spot.x, spot.y, ult.m('fire').d('radius'), true) >= aoe;
  }
  if (kind == 'rain') {
    final spot = target ?? unit;
    return _countAround(state, unit, spot.x, spot.y, ult.d('area'), true) >= aoe;
  }
  if (!full) return true;
  if (kind == 'heal') {
    var wounded = 0;
    final r = ult.d('radius');
    forEachNearby(state, unit.x, unit.y, r, (other) {
      if (!_alive(other) || isEnemy(state, unit, other)) return;
      if (hypot(other.x - unit.x, other.y - unit.y) > r) return;
      if (other.hp < other.maxHp * 0.75) wounded++;
    });
    return wounded >= ai.d('healMinWounded');
  }
  if (kind == 'harden') {
    var attackers = 0;
    forEachNearby(state, unit.x, unit.y, 3, (other) { if (other.target == unit && _alive(other)) attackers++; });
    return attackers >= ai.d('hardenMinAttackers');
  }
  return true;
}

int _countAround(MatchState state, Unit unit, double sx, double sy, double radius, bool enemies) {
  var n = 0;
  forEachNearby(state, sx, sy, radius, (other) {
    if (!_alive(other) || isEnemy(state, unit, other) != enemies) return;
    if (hypot(other.x - sx, other.y - sy) <= radius) n++;
  });
  return n;
}

void _updateTactics(MatchState state) {
  if (state.botBrains.isEmpty) return;
  final tickN = jsRound(state.time / 0.05);
  final every = math.max(1, jsRound(ai.d('tacticSeconds') / 0.05));
  if (tickN % every != 0) return;
  Map<int, Unit>? byId;
  for (final key in state.botBrains.keys) {
    if (key >= state.players.length) continue;
    final player = state.players[key];
    final lvl = levelOf(player);
    if (!lvl.b('squads')) continue;
    for (final squad in state.botBrains[key]!.squads) {
      byId ??= {for (final u in state.units) u.id: u};
      final members = <Unit>[];
      for (final id in squad.units) {
        final unit = byId[id];
        if (unit != null && _alive(unit) && unit.botTask != null && unit.botTask!.squadId == squad.id) members.add(unit);
      }
      if (!members.any((u) => u.state == 'attacking')) continue;
      _engage(state, player, lvl, members);
    }
  }
}

void _engage(MatchState state, Player player, J lvl, List<Unit> members) {
  double ci = 0, cj = 0;
  for (final u in members) { ci += u.x; cj += u.y; }
  ci /= members.length; cj /= members.length;
  for (final unit in members) {
    if (lvl.b('pullWounded') && unit.hp < unit.maxHp * ai.d('woundedRatio') && !unit.champion) {
      final spot = _healSpot(state, player, unit);
      if (spot != null) {
        unit.botTask = BotTask('regroup', until: state.time + 8);
        commandMove(state, spot.x, spot.y, [unit], false);
        continue;
      }
    }
    if (lvl.b('protectRanged') && truthy(unit.stats['projectile']) && unit.pendingHit == null &&
        state.time - unit.kiteAt >= ai.d('kiteCooldown')) {
      final threat = _nearestEnemy(state, unit, ai.d('kiteDistance'));
      if (threat != null) {
        final dx = unit.x - threat.x, dy = unit.y - threat.y;
        var len = hypot(dx, dy);
        if (len == 0 || len.isNaN) len = 1;
        unit.kiteAt = state.time;
        commandMove(state, unit.x + dx / len * ai.d('kiteStep'), unit.y + dy / len * ai.d('kiteStep'), [unit], false);
        continue;
      }
    }
    if (unit.champion && unit.stats.dz('armor') < ai.d('armoredHero') && unit.state != 'attacking' &&
        hypot(unit.x - ci, unit.y - cj) > ai.d('heroBehind') * 2) {
      commandMove(state, ci, cj, [unit], false);
    }
  }
}

Unit? _nearestEnemy(MatchState state, Unit unit, double radius) {
  Unit? best;
  var bestD = radius;
  forEachNearby(state, unit.x, unit.y, radius, (other) {
    if (!_alive(other) || !isEnemy(state, unit, other) || truthy(other.stats['projectile'])) return;
    final d = hypot(other.x - unit.x, other.y - unit.y);
    if (d < bestD) { bestD = d; best = other; }
  });
  return best;
}

Point2? _healSpot(MatchState state, Player player, Unit unit) {
  Point2? best;
  var bestD = double.infinity;
  for (final other in state.units) {
    if (other.playerId != player.id || other.hero != 'medic' || !_alive(other) || other == unit) continue;
    final d = hypot(other.x - unit.x, other.y - unit.y);
    if (d < bestD) { bestD = d; best = Point2(other.x, other.y); }
  }
  for (final d in state.map.districts) {
    if (!isHospital(d) || d.owner != player.id || d.capture == null) continue;
    final at = healPoint(state.map, d);
    final dd = hypot(at.i - unit.x, at.j - unit.y);
    if (dd < bestD) { bestD = dd; best = Point2(at.i.toDouble(), at.j.toDouble()); }
  }
  return best != null && bestD > MAP_GEN.d('captureRadius') ? best : null;
}
