// إنشاء الوحدات وحركتها على المسار (js/game/units.js): الأوامر وطابور المسارات وحقول التدفق والتباعد
import 'dart:math' as math;
import 'dart:typed_data';

import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../map/pathfinding.dart';
import 'combat.dart';
import 'nations.dart';
import 'realism.dart';
import 'state.dart';
import 'weather.dart';

J unitStats(String gangId, String? heroId, [bool champion = false, String? nationId]) {
  if (gangId == 'police') return {...UNIT_BASE, ...POLICE.m(heroId == 'captain' ? 'captain' : 'common')};
  if (champion) return _classStats(nationStats({...UNIT_BASE, ...CHAMPIONS.m(gangId).m('stats')}, nationId, true), gangId);
  if (heroId != null) return _classStats(nationStats({...UNIT_BASE, ...HEROES.m(heroId).m('stats')}, nationId, false, heroId), gangId);
  final gang = GANGS.mm(gangId);
  return _classStats(nationStats({...UNIT_BASE, ...(gang != null && truthy(gang['unit']) ? gang.m('unit') : const {})}, nationId, false), gangId);
}

J _classStats(J stats, String gangId) {
  final c = STYLE_PERKS.m('classes').mm(gangId);
  if (c == null) return stats;
  if (c.b('hp')) stats['hp'] = stats.d('hp') * c.d('hp');
  if (c.b('damage')) {
    stats['damage'] = stats.d('damage') * c.d('damage');
    if (stats.b('meleeDamage')) stats['meleeDamage'] = stats.d('meleeDamage') * c.d('damage');
  }
  if (c.b('speed')) stats['speed'] = stats.d('speed') * c.d('speed');
  if (c.b('range') && stats.b('projectile')) {
    stats['attackRange'] = stats.d('attackRange') + c.d('range');
    stats['visionRange'] = stats.d('visionRange') + c.d('range');
  }
  return stats;
}

String _unitName(String gangId, String? heroId, bool champion, String? nationId) {
  if (gangId == 'police') return POLICE.m(heroId == 'captain' ? 'captain' : 'common').s('name');
  final own = nationUnitName(nationId, heroId, champion);
  if (own != null) return own;
  if (champion) return CHAMPIONS.m(gangId).s('name');
  return heroId != null ? HEROES.m(heroId).s('name') : 'فرد';
}

// gangAs/nationAs: وحدة لاعب بشكل أمة أخرى ({ ...player, gang, nation } في JavaScript: المجنَّدون والترياد)
Unit createUnit(MatchState state, Player player, int i, int j, [String? heroId, bool champion = false, String? gangAs, String? nationAs]) {
  final nation = gangAs != null ? nationAs : player.nation, gang = gangAs ?? player.gang;
  final stats = unitStats(gang, heroId, champion, nation);
  final unit = Unit(id: state.nextUnitId++, playerId: player.id, gang: gang, nation: nation, color: player.color,
      hero: champion ? null : heroId, champion: champion, name: _unitName(gang, heroId, champion, nation),
      x: i.toDouble(), y: j.toDouble(), stats: stats);
  initRealism(state, unit);
  return unit;
}

final _flowMin = PERFORMANCE.i('flowFieldMinGroup'), _spotsFactor = UNITS.i('groupSpotsFactor');

int commandMove(MatchState state, double targetI, double targetJ, Iterable<Unit> units, [bool showMarker = true]) {
  final map = state.map;
  final group = units.where((u) => u.state != 'dead').toList();
  if (group.isEmpty) return 0;
  final clampedI = math.max(0, math.min(map.n - 1, jsRound(targetI)));
  final clampedJ = math.max(0, math.min(map.n - 1, jsRound(targetJ)));
  final start = nearestWalkable(map, clampedI, clampedJ);
  if (start == null) return 0;
  if (showMarker) state.moveMarker = MoveMarker(clampedI, clampedJ, false);
  if (group.length > _flowMin) {
    final field = buildFlowField(map, start.$1, start.$2);
    if (field != null) {
      for (final unit in group) {
        _beginOrder(unit);
        unit.flow = field;
        unit.state = 'moving';
      }
      return group.length;
    }
  }
  final spots = findFreeTiles(map, start.$1, start.$2, group.length * _spotsFactor);
  if (spots.isEmpty) return 0;
  final sorted = [...group];
  stableSort<Unit>(sorted, (a, b) => byNum(hypot(a.x - start.$1, a.y - start.$2), hypot(b.x - start.$1, b.y - start.$2)));
  var spotIndex = 0, ordered = 0;
  for (final unit in sorted) {
    if (spotIndex >= spots.length) break;
    final (i, j) = spots[spotIndex++];
    _beginOrder(unit);
    unit.state = 'moving';
    unit.awaitingPath = true;
    state.pathQueue.add(PathRequest(unit, i, j, unit.orderSeq));
    ordered++;
  }
  return ordered;
}

void _beginOrder(Unit unit) {
  clearCombatOrders(unit);
  unit.path = [];
  unit.flow = null;
  unit.awaitingPath = false;
  unit.orderSeq++;
}

int commandAttackMove(MatchState state, double targetI, double targetJ, Iterable<Unit> units, [bool showMarker = true]) {
  final map = state.map;
  final list = units.toList();
  final ordered = commandMove(state, targetI, targetJ, list, false);
  if (ordered == 0) return 0;
  final clampedI = math.max(0, math.min(map.n - 1, jsRound(targetI)));
  final clampedJ = math.max(0, math.min(map.n - 1, jsRound(targetJ)));
  final destination = nearestWalkable(map, clampedI, clampedJ);
  if (destination == null) return 0;
  for (final unit in list) {
    if (unit.state == 'dead') continue;
    unit.attackMove = (i: destination.$1, j: destination.$2);
    if (unit.state == 'moving') unit.state = 'attackMove';
  }
  if (showMarker) state.moveMarker = MoveMarker(clampedI, clampedJ, true);
  return ordered;
}

void processPathQueue(MatchState state) {
  var budget = UNITS.i('pathRequestsPerTick');
  while (budget > 0 && state.pathQueue.isNotEmpty) {
    final request = state.pathQueue.removeAt(0);
    final unit = request.unit;
    if (unit.state == 'dead' || unit.orderSeq != request.seq) continue;
    budget--;
    final path = findPath(state.map, jsRound(unit.x), jsRound(unit.y), request.i, request.j);
    unit.awaitingPath = false;
    if (path != null && path.isNotEmpty) {
      unit.path = path;
      unit.state = unit.attackMove != null ? 'attackMove' : 'moving';
    } else {
      unit.state = 'idle';
      unit.attackMove = null;
    }
  }
}

void stopUnit(Unit unit) {
  unit.path = [];
  if (unit.state == 'moving') unit.state = 'idle';
}

void updateUnits(MatchState state) {
  final units = state.units;
  for (var k = 0; k < units.length; k++) {
    final unit = units[k];
    unit.prevX = unit.x;
    unit.prevY = unit.y;
    if (unit.state == 'dead') continue;
    if (unit.cState != null) continue;
    _moveAlongPath(state, unit);
  }
  _applySeparation(state);
}

final _arriveDistance = UNITS.d('arriveDistance');
void _moveAlongPath(MatchState state, Unit unit) {
  if (unit.path.isEmpty && unit.flow != null && unit.state != 'attacking') {
    final step = flowStep(state.map, unit.flow!, jsRound(unit.x), jsRound(unit.y));
    if (step != null) { unit.path = [step]; } else { unit.flow = null; unit.state = 'idle'; return; }
  }
  if (unit.path.isEmpty) {
    if ((unit.state == 'moving' || unit.state == 'attackMove') && !unit.awaitingPath) {
      unit.state = 'idle';
      unit.attackMove = null;
    }
    return;
  }
  final step = moveSpeed(state, unit) * TICK_SEC;
  var remaining = step;
  while (remaining > 0 && unit.path.isNotEmpty) {
    final point = unit.path[0];
    final tx = point.$1.toDouble(), ty = point.$2.toDouble();
    final dx = tx - unit.x, dy = ty - unit.y;
    final dist = math.sqrt(dx * dx + dy * dy);
    if (dist <= remaining + _arriveDistance) {
      unit.x = tx; unit.y = ty;
      unit.path.removeAt(0);
      remaining -= dist;
    } else {
      unit.x += (dx / dist) * remaining;
      unit.y += (dy / dist) * remaining;
      remaining = 0;
    }
    faceTowards(unit, tx, ty);
    if (unit.state != 'attacking') faceAngleTo(unit, tx, ty);
  }
  if (unit.path.isEmpty && unit.flow == null && !unit.awaitingPath && (unit.state == 'moving' || unit.state == 'attackMove')) {
    unit.state = 'idle';
    unit.attackMove = null;
  }
}

void faceTowards(Unit unit, double targetI, double targetJ) {
  final screenDx = (targetI - unit.x) - (targetJ - unit.y);
  if (screenDx.abs() > 0.01) unit.facing = screenDx >= 0 ? 1 : -1;
}

void facingFromAngle(Unit unit) {
  final screenDx = fcos(unit.faceAngle) - fsin(unit.faceAngle);
  if (screenDx.abs() > 0.01) unit.facing = screenDx >= 0 ? 1 : -1;
}

// التباعد: شبكة بخلايا بحجم المسافة، وكل خلية بوحداتها بترتيب state.units، والدفع متتابع كما في JavaScript
var _cx = Int32List(0), _cy = Int32List(0), _list = Int32List(0), _count = Int32List(0), _start = Int32List(0);
final _sepRadius = UNITS.d('separationRadius'), _sepStrength = UNITS.d('separationStrength');

void _applySeparation(MatchState state) {
  final map = state.map, units = state.units, total = units.length;
  final radius = _sepRadius, radiusSq = radius * radius;
  final push = _sepStrength * TICK_SEC;
  if (_cx.length < total) {
    final size = math.max(64, total * 2);
    _cx = Int32List(size); _cy = Int32List(size); _list = Int32List(size);
  }
  var minX = 1 << 30, minY = 1 << 30, maxX = -(1 << 30), maxY = -(1 << 30);
  var any = false;
  for (var k = 0; k < total; k++) {
    final unit = units[k];
    if (unit.state == 'dead') continue;
    final x = (unit.x / radius).floor(), y = (unit.y / radius).floor();
    _cx[k] = x; _cy[k] = y;
    any = true;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!any) return;
  final w = maxX - minX + 3, h = maxY - minY + 3, cells = w * h;
  if (_count.length < cells) { _count = Int32List(cells * 2); _start = Int32List(cells * 2); }
  final count = _count, start = _start, list = _list;
  count.fillRange(0, cells, 0);
  int cellIndex(int x, int y) => (x - minX + 1) + (y - minY + 1) * w;
  for (var k = 0; k < total; k++) { if (units[k].state != 'dead') count[cellIndex(_cx[k], _cy[k])]++; }
  var sum = 0;
  for (var c = 0; c < cells; c++) { start[c] = sum; sum += count[c]; count[c] = 0; }
  for (var k = 0; k < total; k++) {
    if (units[k].state == 'dead') continue;
    final c = cellIndex(_cx[k], _cy[k]);
    list[start[c] + count[c]++] = k;
  }
  for (var k = 0; k < total; k++) {
    final unit = units[k];
    if (unit.state == 'dead') continue;
    double ox = 0, oy = 0;
    final cx = _cx[k], cy = _cy[k];
    for (var a = -1; a <= 1; a++) {
      for (var b = -1; b <= 1; b++) {
        final c = cellIndex(cx + a, cy + b);
        final end = start[c] + count[c];
        for (var q = start[c]; q < end; q++) {
          final other = units[list[q]];
          if (other == unit) continue;
          final dx = unit.x - other.x, dy = unit.y - other.y;
          final distSq = dx * dx + dy * dy;
          if (distSq >= radiusSq) continue;
          final dist = math.sqrt(distSq);
          if (dist < 0.0001) {
            ox += (random() - 0.5) * push;
            oy += (random() - 0.5) * push;
            continue;
          }
          final force = ((radius - dist) / radius) * push;
          ox += (dx / dist) * force;
          oy += (dy / dist) * force;
        }
      }
    }
    if (ox == 0 && oy == 0) continue;
    final nx = unit.x + ox, ny = unit.y + oy;
    if (map.isWalkable(jsRound(nx), jsRound(ny))) {
      unit.x = nx;
      unit.y = ny;
    }
  }
}
