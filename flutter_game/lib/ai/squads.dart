// الطبقة الاستراتيجية للبوتات (js/ai/squads.js): الجيش فرق، وخريطة القوى، ونقطة التجمع، والأهداف بالنقاط
import 'dart:math' as math;
import 'dart:typed_data';

import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../game/combat.dart';
import '../game/features.dart';
import '../game/spatial.dart';
import '../game/state.dart';
import '../game/units.dart';
import '../map/generator.dart';
import '../map/sizes.dart';

class Squad {
  final int id;
  final String type;
  List<int> units;
  int targetId;
  double power = 0;
  String? phase;
  Point2? stage;
  double stagedAt = 0;
  Squad(this.id, this.type, this.units, this.targetId);
}

class Brain {
  final int playerId;
  List<Squad> squads = [];
  int nextId = 1, rallyId = -1;
  Brain(this.playerId);
}

class Target {
  final District district;
  final double enemy, value;
  final bool easy;
  double score = 0;
  Target(this.district, this.enemy, this.value, this.easy);
}

bool _alive(Unit u) => u.state != 'dead' && u.hp > 0;
double _distP(double ai, double aj, double bi, double bj) => hypot(ai - bi, aj - bj);
double _distU(Unit u, double pi, double pj) => hypot(u.x - pi, u.y - pj);

// ترتيب بمفتاح يُحسب مرة لكل عنصر (sortedBy)
List<Unit> sortedBy(List<Unit> list, double Function(Unit) key) {
  final items = [for (final u in list) (key(u), u)];
  stableSort<(double, Unit)>(items, (a, b) => byNum(a.$1, b.$1));
  return [for (final x in items) x.$2];
}

J levelOf(Player player) => ai.m('levels').mm(player.difficulty) ?? ai.m('levels').m('medium');
Object? param(J lvl, String key) => lvl[key] ?? ai[key];
double paramD(J lvl, String key) => (param(lvl, key) as num).toDouble();

final _uv = ai.m('unitValue');
double unitValue(Unit unit) {
  final base = unit.champion ? _uv.d('champion') : unit.hero != null ? _uv.d('hero') : _uv.d('unit');
  return base * math.max(0, unit.hp) / unit.maxHp;
}

Brain _brainOf(MatchState state, Player player) => state.botBrains[player.id] ??= Brain(player.id);

Squad? squadOf(MatchState state, Unit unit) {
  final task = unit.botTask;
  if (task == null || task.type != 'squad') return null;
  final brain = state.botBrains[unit.playerId];
  if (brain == null) return null;
  for (final s in brain.squads) { if (s.id == task.squadId) return s; }
  return null;
}

// --- لقطة الوحدات للتحديث (aiSnapshot): الحياة والقيمة لحظة أول سؤال في التحديث، بترتيب خلايا الشبكة ---
MatchState? _snapState;
double _snapTime = -1;
final _snapValue = Expando<double>(), _snapX = Expando<double>(), _snapY = Expando<double>();
final _snapAlive = Expando<bool>();

void _snapshot(MatchState state) {
  ensureUnitHash(state);
  if (identical(_snapState, state) && _snapTime == state.time) return;
  _snapState = state; _snapTime = state.time;
  for (final bucket in state.unitHash.values) {
    for (final u in bucket) {
      final alive = _alive(u) && !state.players[u.playerId].passive;
      _snapAlive[u] = alive;
      _snapValue[u] = alive ? unitValue(u) : 0.0;
      _snapX[u] = u.x; _snapY[u] = u.y;
    }
  }
}

void _scanAround(MatchState state, double x, double y, double radius, void Function(Unit u, double ux, double uy, double value) fn) {
  final (minI, maxI, minJ, maxJ) = cellBox(x, y, radius);
  for (var ci = minI; ci <= maxI; ci++) {
    for (var cj = minJ; cj <= maxJ; cj++) {
      final bucket = cellUnits(state, ci, cj);
      if (bucket == null) continue;
      for (final u in bucket) {
        if (_snapAlive[u] == true) fn(u, _snapX[u]!, _snapY[u]!, _snapValue[u]!);
      }
    }
  }
}

// --- خريطة القوى: Float32 كـ JavaScript (Float32Array) ---
MatchState? _powerState;
double _powerTime = -1;
Map<int, Float32List> _power = {};

Map<int, Float32List> _powerMap(MatchState state) {
  if (identical(_powerState, state) && _powerTime == state.time) return _power;
  final R = ai.d('powerRadius'), n = state.players.length;
  _snapshot(state);
  final power = <int, Float32List>{};
  for (final d in state.map.districts) {
    final cap = d.capture;
    if (cap == null) continue;
    final row = Float32List(n);
    final i = cap.i.toDouble(), j = cap.j.toDouble();
    _scanAround(state, i, j, R, (u, ux, uy, v) {
      final dx = ux - i, dy = uy - j;
      if (dx * dx + dy * dy <= R * R) row[u.playerId] += v;
    });
    power[d.id] = row;
  }
  _powerState = state; _powerTime = state.time; _power = power;
  return power;
}

(double, double) _sidePowers(MatchState state, Player player, District district) {
  final row = _powerMap(state)[district.id];
  double enemy = 0, mine = 0;
  if (row == null) return (enemy, mine);
  for (var p = 0; p < row.length; p++) {
    if (row[p] == 0) continue;
    if (isEnemyId(state, player.id, p)) { enemy += row[p]; } else { mine += row[p]; }
  }
  return (enemy, mine);
}

(double, double) _districtPowers(MatchState state, Player player, J lvl, District district) {
  final radius = paramD(lvl, 'threatRadius');
  if (radius == ai.d('powerRadius')) return _sidePowers(state, player, district);
  final near = _unitsAround(state, district.capture!.i.toDouble(), district.capture!.j.toDouble(), radius);
  double enemy = 0, mine = 0;
  for (var k = 0; k < near.$1.length; k++) {
    if (isEnemyId(state, player.id, near.$1[k])) { enemy += near.$2[k]; } else { mine += near.$2[k]; }
  }
  return (enemy, mine);
}

MatchState? _aroundState;
double _aroundTime = -1;
final _aroundCache = <(int, int, int, double), double>{};

double enemyPowerAround(MatchState state, Player player, double pi, double pj, double radius) {
  if (!identical(_aroundState, state) || _aroundTime != state.time) { _aroundState = state; _aroundTime = state.time; _aroundCache.clear(); }
  final key = (player.id, jsRound(pi * 2), jsRound(pj * 2), radius);
  final hit = _aroundCache[key];
  if (hit != null) return hit;
  final near = _unitsAround(state, pi, pj, radius);
  double total = 0;
  for (var k = 0; k < near.$1.length; k++) { if (isEnemyId(state, player.id, near.$1[k])) total += near.$2[k]; }
  _aroundCache[key] = total;
  return total;
}

MatchState? _nearState;
double _nearTime = -1;
final _nearCache = <(double, double, double), (List<int>, List<double>)>{};

(List<int>, List<double>) _unitsAround(MatchState state, double i, double j, double radius) {
  if (!identical(_nearState, state) || _nearTime != state.time) { _nearState = state; _nearTime = state.time; _nearCache.clear(); }
  final key = (i, j, radius);
  final cached = _nearCache[key];
  if (cached != null) return cached;
  final inside = radius * radius * (1 - 1e-9), outside = radius * radius * (1 + 1e-9);
  _snapshot(state);
  final ids = <int>[], values = <double>[];
  _scanAround(state, i, j, radius, (u, ux, uy, v) {
    final dx = ux - i, dy = uy - j, d2 = dx * dx + dy * dy;
    if (d2 > outside) return;
    if (d2 >= inside && !(hypot(dx, dy) <= radius)) return;
    ids.add(u.playerId);
    values.add(v);
  });
  return _nearCache[key] = (ids, values);
}

double _powerOf(Iterable<Unit> units) => units.fold(0.0, (sum, u) => sum + unitValue(u));

Point2 _center(List<Unit> units) {
  double i = 0, j = 0;
  for (final u in units) { i += u.x; j += u.y; }
  return Point2(i / units.length, j / units.length);
}

// ================= القرار الاستراتيجي =================
void decideSquads(MatchState state, Player player, J config, List<Unit> pool, List<Unit> units, List<District> owned,
    int? Function(MatchState, Player) strongestPlayer) {
  final lvl = levelOf(player);
  final brain = _brainOf(state, player);
  final byId = {for (final u in units) u.id: u};
  _updateSquads(state, player, lvl, brain, byId, owned, pool);
  _defend(state, player, lvl, brain, pool, owned);
  if (truthy(param(lvl, 'reinforce'))) _reinforce(state, player, lvl, brain, byId, pool);
  final rally = _rallyPoint(state, player, brain, owned);
  if (rally == null || pool.isEmpty) return;
  final targets = _targetList(state, player, lvl, units.length, strongestPlayer);
  final rc = rally.capture!;
  final ri = rc.i.toDouble(), rj = rc.j.toDouble();

  var small = brain.squads.where((s) => (s.type == 'expand' || s.type == 'raid') && s.units.length > 1).length;
  final away = _awayScore(state, player, lvl, rally);
  final easyTargets = targets.where((t) => t.enemy == 0 && t.easy && !brain.squads.any((s) => s.targetId == t.district.id)).toList();
  stableSort<Target>(easyTargets, (a, b) => byNum(away(a.district), away(b.district)));
  for (final t in easyTargets) {
    if (pool.isEmpty) break;
    final raid = t.district.owner != null;
    final ci = t.district.capture!.i.toDouble(), cj = t.district.capture!.j.toDouble();
    List<Unit> order(List<Unit> list) => sortedBy(list, (u) => _distU(u, ci, cj) + (raid ? _fastFirst(u) : 0));
    if (!raid && enemyPowerAround(state, player, ci, cj, paramD(lvl, 'soloSafeRadius')) == 0) {
      final unit = order(pool)[0];
      _removeFrom(pool, [unit]);
      _launch(state, brain, [unit], t.district, raid ? 'raid' : 'expand', lvl, false);
      continue;
    }
    if (small >= paramD(lvl, 'maxSmallSquads')) continue;
    final danger = enemyPowerAround(state, player, ci, cj, ai.d('dangerRadius'));
    final size = raid ? ai.i('raidSize') : ai.i('expandSize');
    final group = <Unit>[];
    double power = 0;
    for (final unit in order(pool.where((u) => _distU(u, ri, rj) > ai.d('rallyRadius')).toList())) {
      if (group.length >= size && power >= ai.d('attackRatio') * danger) break;
      group.add(unit);
      power += unitValue(unit);
    }
    if (group.length < size || power < ai.d('attackRatio') * danger) continue;
    _removeFrom(pool, group);
    small++;
    _launch(state, brain, group, t.district, raid ? 'raid' : 'expand', lvl, true);
  }

  final gathered = <Unit>[];
  for (final unit in pool) {
    final d = _distU(unit, ri, rj);
    if (d <= ai.d('rallyRadius')) { gathered.add(unit); continue; }
    if (unit.gatherRally != rally.id || unit.state == 'idle') {
      unit.gatherRally = rally.id;
      commandMove(state, ri, rj, [unit], false);
    }
  }

  final minSquad = lvl.i('minSquad');
  final capped = units.length >= state.maxUnits * 0.9;
  if (gathered.length < math.min(minSquad, capped ? 1 : minSquad)) {
    if (truthy(param(lvl, 'groupExpand')) && gathered.length >= ai.i('expandSize')) _groupExpand(state, player, lvl, brain, gathered, pool, targets, rally);
    return;
  }
  final power = _powerOf(gathered);
  final fits = targets.where((t) => power >= ai.d('attackRatio') * t.enemy).toList();
  for (final t in fits) { t.score = t.value / (_distP(ri, rj, t.district.capture!.i.toDouble(), t.district.capture!.j.toDouble()) + 5); }
  stableSort<Target>(fits, (a, b) => byNum(b.score, a.score));
  Target? chosen = fits.isNotEmpty ? fits[0] : null;
  if (chosen == null && capped) {
    final weak = targets.where((t) => t.enemy > 0).toList();
    stableSort<Target>(weak, (a, b) => byNum(a.enemy, b.enemy));
    chosen = weak.isNotEmpty ? weak[0] : null;
  }
  if (chosen == null) return;
  final ch = chosen;
  if (lvl.b('twoFronts') && random() < ai.d('twoFrontChance')) {
    Target? second;
    for (final t in fits) {
      if (t != ch && _distP(t.district.capture!.i.toDouble(), t.district.capture!.j.toDouble(), ch.district.capture!.i.toDouble(),
              ch.district.capture!.j.toDouble()) >= ai.d('twoFrontMinDistance') &&
          power >= ai.d('attackRatio') * (t.enemy + ch.enemy)) { second = t; break; }
    }
    if (second != null) {
      final share = ch.enemy / (ch.enemy + second.enemy);
      // حيان بلا مدافعين: النسبة 0/0 فلا يأخذ الأول أحداً (Math.max(1, NaN) ثم slice(0, NaN) في JavaScript)
      final first = _takeNearest(gathered, ch.district.capture!.i.toDouble(), ch.district.capture!.j.toDouble(),
          share.isNaN ? 0 : math.max(1, jsRound(gathered.length * share)));
      _launch(state, brain, first, ch.district, 'attack', lvl, true);
      final rest = [...gathered]; gathered.clear();
      _launch(state, brain, rest, second.district, 'attack', lvl, true);
      _removeFrom(pool, first);
      return;
    }
  }
  final group = [...gathered]; gathered.clear();
  _removeFrom(pool, group);
  _launch(state, brain, group, ch.district, 'attack', lvl, ch.enemy > 0);
}

double Function(District) _awayScore(MatchState state, Player player, J lvl, District rally) {
  final hostile = <({int i, int j})>[];
  for (final d in state.map.districts) {
    if (d.capture == null || d.owner == null) continue;
    final owner = state.players[d.owner!];
    if (!owner.neutral && isEnemyId(state, player.id, d.owner!)) hostile.add(d.capture!);
  }
  final ri = rally.capture!.i.toDouble(), rj = rally.capture!.j.toDouble();
  final w = paramD(lvl, 'expandAwayWeight');
  return (district) {
    var near = double.infinity;
    final di = district.capture!.i.toDouble(), dj = district.capture!.j.toDouble();
    for (final h in hostile) { near = math.min(near, _distP(h.i.toDouble(), h.j.toDouble(), di, dj)); }
    return _distP(ri, rj, di, dj) - (hostile.isNotEmpty ? w * math.min(near, 30) : 0);
  };
}

void _groupExpand(MatchState state, Player player, J lvl, Brain brain, List<Unit> gathered, List<Unit> pool, List<Target> targets, District rally) {
  final power = _powerOf(gathered);
  final away = _awayScore(state, player, lvl, rally);
  Target? best;
  var bestD = double.infinity;
  for (final t in targets) {
    if (t.enemy > 0 || !t.easy) continue;
    if (brain.squads.any((s) => s.targetId == t.district.id)) continue;
    final d = away(t.district);
    if (d >= bestD) continue;
    if (power < ai.d('attackRatio') * enemyPowerAround(state, player, t.district.capture!.i.toDouble(), t.district.capture!.j.toDouble(), ai.d('dangerRadius'))) continue;
    bestD = d; best = t;
  }
  if (best == null) return;
  final group = [...gathered]; gathered.clear();
  _removeFrom(pool, group);
  _launch(state, brain, group, best.district, 'expand', lvl, false);
}

void _updateSquads(MatchState state, Player player, J lvl, Brain brain, Map<int, Unit> byId, List<District> owned, List<Unit> pool) {
  final keep = <Squad>[];
  for (final squad in brain.squads) {
    final members = <Unit>[];
    for (final id in squad.units) {
      final u = byId[id];
      if (u != null && u.botTask != null && u.botTask!.squadId == squad.id) members.add(u);
    }
    squad.units = [for (final u in members) u.id];
    if (members.isEmpty) continue;
    final district = squad.targetId >= 0 && squad.targetId < state.map.districts.length ? state.map.districts[squad.targetId] : null;
    final c = _center(members);
    if (lvl.b('retreat') && squad.type != 'defend') {
      final enemy = enemyPowerAround(state, player, c.x, c.y, ai.d('powerRadius'));
      if (enemy > 0 && _powerOf(members) < ai.d('retreatRatio') * enemy) {
        final home = _nearestOwned(owned, c);
        _disband(members);
        if (home != null) {
          for (final u in members) { u.botTask = BotTask('regroup', until: state.time + 8); }
          commandMove(state, home.capture!.i.toDouble(), home.capture!.j.toDouble(), members, false);
        }
        continue;
      }
    }
    if (squad.type == 'defend') {
      final still = district != null && district.owner == player.id && _districtPowers(state, player, lvl, district).$1 > 0;
      if (!still) { _disband(members); pool.addAll(members.where((u) => u.state != 'attacking')); continue; }
    } else if (district == null || district.owner == player.id || (district.owner != null && !isEnemyId(state, player.id, district.owner!))) {
      final next = _nextTarget(state, player, lvl, members, c, squad.type);
      if (next == null) {
        _disband(members);
        pool.addAll(members.where((u) => u.state != 'attacking'));
        continue;
      }
      squad.targetId = next.district.id;
      _orderSquad(state, members, next.district, lvl, next.enemy > 0);
      keep.add(squad);
      continue;
    }
    final dc = district.capture!;
    if (lvl.b('abortExpand') && (squad.type == 'expand' || squad.type == 'raid') && !members.any((u) => u.state == 'attacking')) {
      final danger = enemyPowerAround(state, player, dc.i.toDouble(), dc.j.toDouble(), ai.d('dangerRadius')) +
          enemyPowerAround(state, player, c.x, c.y, ai.d('dangerRadius') / 2);
      if (danger > 0 && _powerOf(members) < ai.d('attackRatio') * danger) {
        _disband(members);
        District? rally;
        for (final d in owned) { if (d.id == brain.rallyId) { rally = d; break; } }
        rally ??= _nearestOwned(owned, c);
        if (rally != null) {
          for (final u in members) { u.botTask = BotTask('regroup', until: state.time + 4); }
          commandMove(state, rally.capture!.i.toDouble(), rally.capture!.j.toDouble(), members, false);
        }
        continue;
      }
    }
    if (squad.phase == 'stage') {
      final st = squad.stage!;
      final near = members.where((u) => _distU(u, st.x, st.y) <= ai.d('stageRadius')).length;
      if (near >= members.length * ai.d('stageShare') || state.time - squad.stagedAt >= ai.d('stageMaxSeconds')) {
        squad.phase = 'assault';
        _orderSquad(state, members, district, lvl, true);
      } else {
        final late = members.where((u) => u.state == 'idle' && _distU(u, st.x, st.y) > ai.d('stageRadius')).toList();
        if (late.isNotEmpty) commandAttackMove(state, st.x, st.y, late, false);
      }
      keep.add(squad);
      continue;
    }
    final idle = members.where((u) => u.state == 'idle' && _distU(u, dc.i.toDouble(), dc.j.toDouble()) > 2.5).toList();
    if (idle.isNotEmpty) commandAttackMove(state, dc.i.toDouble(), dc.j.toDouble(), idle, false);
    keep.add(squad);
  }
  brain.squads = keep;
}

void _reinforce(MatchState state, Player player, J lvl, Brain brain, Map<int, Unit> byId, List<Unit> pool) {
  for (final squad in brain.squads) {
    if (pool.isEmpty) return;
    final members = [for (final id in squad.units) if (byId[id] != null && _alive(byId[id]!)) byId[id]!];
    if (members.isEmpty || !members.any((u) => u.state == 'attacking')) continue;
    final c = _center(members);
    final enemy = enemyPowerAround(state, player, c.x, c.y, ai.d('powerRadius'));
    var deficit = ai.d('attackRatio') * enemy - _powerOf(members);
    if (deficit <= 0) continue;
    final range = paramD(lvl, 'reinforceRange');
    final near = sortedBy(pool.where((u) => _distU(u, c.x, c.y) <= range).toList(), (u) => _distU(u, c.x, c.y));
    final group = <Unit>[];
    for (final unit in near) {
      if (deficit <= 0) break;
      group.add(unit);
      deficit -= unitValue(unit);
    }
    if (group.isEmpty) continue;
    _removeFrom(pool, group);
    for (final unit in group) { unit.botTask = BotTask('squad', squadId: squad.id); unit.gatherRally = -1; }
    squad.units.addAll(group.map((u) => u.id));
    commandAttackMove(state, c.x, c.y, group, false);
  }
}

Target? _nextTarget(MatchState state, Player player, J lvl, List<Unit> members, Point2 c, String type) {
  final power = _powerOf(members);
  final small = type == 'expand' || type == 'raid';
  Target? best;
  double bestScore = 0;
  for (final t in _targetList(state, player, lvl, 0, null)) {
    if (t.enemy > 0 && power < ai.d('attackRatio') * t.enemy) continue;
    final ti = t.district.capture!.i.toDouble(), tj = t.district.capture!.j.toDouble();
    final d = _distP(c.x, c.y, ti, tj);
    if (d > ai.d('twoFrontMinDistance') * 1.5) continue;
    if (small) {
      if (!t.easy) continue;
      final danger = enemyPowerAround(state, player, ti, tj, ai.d('dangerRadius'));
      if (power < ai.d('attackRatio') * danger) continue;
      if (members.length == 1 && enemyPowerAround(state, player, ti, tj, paramD(lvl, 'soloSafeRadius')) > 0) continue;
    }
    final score = t.value / (d + 5);
    if (score > bestScore) { bestScore = score; best = t; }
  }
  return best;
}

void _defend(MatchState state, Player player, J lvl, Brain brain, List<Unit> pool, List<District> owned) {
  for (final district in owned) {
    final (enemy, mine) = _districtPowers(state, player, lvl, district);
    if (enemy <= 0) continue;
    double coming = 0;
    for (final squad in brain.squads) {
      if (squad.type == 'defend' && squad.targetId == district.id) coming += squad.power;
    }
    var deficit = ai.d('defenseRatio') * enemy - mine - coming;
    if (deficit <= 0) continue;
    final group = <Unit>[];
    final ci = district.capture!.i.toDouble(), cj = district.capture!.j.toDouble();
    for (final unit in sortedBy(pool, (u) => _distU(u, ci, cj))) {
      if (deficit <= 0) break;
      group.add(unit);
      deficit -= unitValue(unit);
    }
    if (group.isEmpty || (lvl.b('strictDefense') && deficit > 0)) continue;
    _removeFrom(pool, group);
    final squad = _launch(state, brain, group, district, 'defend', lvl, false);
    squad.power = _powerOf(group);
  }
}

District? _rallyPoint(MatchState state, Player player, Brain brain, List<District> owned) {
  if (owned.isEmpty) return null;
  final hostile = state.map.districts.where((d) => d.capture != null && d.owner != null &&
      isEnemyId(state, player.id, d.owner!) && !state.players[d.owner!].neutral).toList();
  final mid = (state.map.n - 1) / 2;
  double front(District d) {
    final di = d.capture!.i.toDouble(), dj = d.capture!.j.toDouble();
    if (hostile.isEmpty) return hypot(di - mid, dj - mid);
    var m = double.infinity;
    for (final h in hostile) { m = math.min(m, _distP(di, dj, h.capture!.i.toDouble(), h.capture!.j.toDouble())); }
    return m;
  }
  var best = owned[0];
  var bestValue = double.infinity;
  for (final d in owned) {
    final v = front(d);
    if (v < bestValue) { bestValue = v; best = d; }
  }
  District? current;
  for (final d in owned) { if (d.id == brain.rallyId) { current = d; break; } }
  if (current != null && front(current) - bestValue < ai.d('rallySwitchGain')) return current;
  brain.rallyId = best.id;
  return best;
}

List<Target> _targetList(MatchState state, Player player, J lvl, int armySize, int? Function(MatchState, Player)? strongest) {
  final survival = state.mode == 'survival';
  final leader = strongest != null ? strongest(state, player) : null;
  final policeArmy = truthy(lvl['policeArmy']) ? lvl.d('policeArmy') : double.infinity;
  final avoidPolice = !lvl.b('policeEarly') && armySize < policeArmy;
  final stations = state.map.districts.where((d) => d.police && !d.policeDisabled && d.capture != null).toList();
  final counts = <int, double>{};
  final preferWeak = paramD(lvl, 'preferWeak');
  if (preferWeak != 0) {
    for (final d in state.map.districts) { if (d.owner != null) counts[d.owner!] = (counts[d.owner!] ?? 0) + 1; }
    if (truthy(param(lvl, 'weakByArmy'))) {
      for (final u in state.units) { if (u.state != 'dead') counts[u.playerId] = (counts[u.playerId] ?? 0) + 0.5; }
    }
  }
  double most = 1;
  for (final e in counts.entries) {
    if (e.key != player.id && !state.players[e.key].neutral) most = math.max(most, e.value);
  }
  final list = <Target>[];
  final policeAvoid = ai.d('policeAvoidRadius');
  final responseRadius = lvl.has('responseRadius') ? lvl.d('responseRadius') : ai.d('responseRadius');
  for (final d in state.map.districts) {
    if (d.capture == null || d.owner == player.id) continue;
    final owner = d.owner != null ? state.players[d.owner!] : null;
    if (owner != null && !isEnemyId(state, player.id, d.owner!)) continue;
    if (d.police) {
      if (survival) continue;
      if (!d.policeDisabled && !lvl.b('policeEarly') && armySize < policeArmy) continue;
    }
    final di = d.capture!.i.toDouble(), dj = d.capture!.j.toDouble();
    final nearPolice = !d.police && stations.any((st) => _distP(st.capture!.i.toDouble(), st.capture!.j.toDouble(), di, dj) <= policeAvoid);
    if (nearPolice && avoidPolice) continue;
    final near = _sidePowers(state, player, d).$1;
    final enemy = responseRadius != 0 ? math.max(near, enemyPowerAround(state, player, di, dj, responseRadius)) : near;
    var value = DISTRICT_SIZES.m('botValue').d(sizeOf(d));
    if (d.special != null) value *= paramD(lvl, 'specialValue');
    final feature = featureValue(d);
    if (feature != null && feature != 0) value *= feature;
    if (d.police && lvl.b('policeEarly')) value *= ai.d('stationValue');
    if (leader != null && d.owner == leader) value *= ai.d('snowballValue');
    if (owner != null && !owner.neutral) {
      value *= ai.d('enemyDistrictValue');
      if (counts.isNotEmpty) value *= 1 + preferWeak * (1 - (counts[d.owner!] ?? 0) / most);
    }
    final easy = near == 0 && !nearPolice && (d.owner == null || lvl.b('raids'));
    list.add(Target(d, easy ? 0 : enemy, value, easy));
  }
  return list;
}

Squad _launch(MatchState state, Brain brain, List<Unit> units, District district, String type, J lvl, bool defended) {
  final squad = Squad(brain.nextId++, type, [for (final u in units) u.id], district.id);
  brain.squads.add(squad);
  for (final unit in units) {
    unit.botTask = BotTask('squad', squadId: squad.id);
    unit.gatherRally = -1;
  }
  if (truthy(param(lvl, 'stage')) && type == 'attack' && defended && units.length > 1) {
    _stage(state, squad, units, district);
  } else {
    _orderSquad(state, units, district, lvl, defended);
  }
  return squad;
}

void _stage(MatchState state, Squad squad, List<Unit> units, District district) {
  final c = _center(units), ti = district.capture!.i.toDouble(), tj = district.capture!.j.toDouble();
  final len = hypot(ti - c.x, tj - c.y);
  if (len <= ai.d('stageDistance') + 1) { squad.phase = 'assault'; _orderSquad(state, units, district, const {'flank': false}, true); return; }
  final point = Point2(ti - (ti - c.x) / len * ai.d('stageDistance'), tj - (tj - c.y) / len * ai.d('stageDistance'));
  squad.phase = 'stage';
  squad.stage = point;
  squad.stagedAt = state.time;
  commandAttackMove(state, point.x, point.y, units, false);
}

void _orderSquad(MatchState state, List<Unit> units, District district, J lvl, bool defended) {
  final ti = district.capture!.i.toDouble(), tj = district.capture!.j.toDouble();
  final c = _center(units);
  var len = hypot(ti - c.x, tj - c.y);
  if (len == 0 || len.isNaN) len = 1;
  final ux = (ti - c.x) / len, uy = (tj - c.y) / len;
  final main = <Unit>[], flank = <Unit>[], heroes = <Unit>[];
  for (final unit in units) {
    if (unit.champion && unit.stats.dz('armor') < ai.d('armoredHero')) { heroes.add(unit); }
    else if (lvl.b('flank') && defended && units.length >= ai.i('flankMinSquad') && unit.stats.d('speed') >= ai.d('flankMinSpeed')) { flank.add(unit); }
    else { main.add(unit); }
  }
  if (flank.length > main.length) { main.addAll(flank); flank.clear(); }
  if (main.isNotEmpty) commandAttackMove(state, ti, tj, main, false);
  if (flank.isNotEmpty) {
    final side = random() < 0.5 ? 1 : -1;
    final fi = ti - uy * side * ai.d('flankOffset') + ux;
    final fj = tj + ux * side * ai.d('flankOffset') + uy;
    commandAttackMove(state, fi, fj, flank, false);
  }
  if (heroes.isNotEmpty) commandAttackMove(state, ti - ux * ai.d('heroBehind'), tj - uy * ai.d('heroBehind'), heroes, false);
}

void _disband(List<Unit> members) { for (final unit in members) { unit.botTask = null; } }

District? _nearestOwned(List<District> owned, Point2 point) {
  District? best;
  var bestD = double.infinity;
  for (final d in owned) {
    final dd = _distP(d.capture!.i.toDouble(), d.capture!.j.toDouble(), point.x, point.y);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

double _fastFirst(Unit unit) => unit.stats.d('speed') >= ai.d('raidMinSpeed') ? 0 : 3;

List<Unit> _takeNearest(List<Unit> list, double pi, double pj, int count) {
  final group = sortedBy(list, (u) => _distU(u, pi, pj)).take(count).toList();
  _removeFrom(list, group);
  return group;
}

void _removeFrom(List<Unit> list, List<Unit> group) {
  for (final unit in group) {
    final k = list.indexOf(unit);
    if (k >= 0) list.removeAt(k);
  }
}
