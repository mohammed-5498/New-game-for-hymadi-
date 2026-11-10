// صرف البوتات لنقاطها (js/ai/empireBot.js): الجنود بالدور والزعيم والترقيات والمباني والتحصين، ويدّخر للشراء التالي
import 'dart:math' as math;

import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../game/combat.dart';
import '../game/empire.dart';
import '../game/state.dart';
import '../map/generator.dart';
import '../map/sizes.dart';

final J _B = EMPIRE.m('bot');
const _kinds = ['common', 'strong', 'elite'];
final _sequences = <String, List<String>>{};

List<String> _sequence(String level) {
  final cached = _sequences[level];
  if (cached != null) return cached;
  final mix = _B.m('mix');
  final w = (mix[level] != null ? mix.l(level) : mix.l('medium')).map((x) => (x as num).toDouble()).toList();
  var total = w.fold(0.0, (a, b) => a + b);
  if (total == 0) total = 1;
  final current = List<double>.filled(w.length, 0);
  final seq = <String>[];
  for (var n = 0; n < total; n++) {
    for (var k = 0; k < w.length; k++) { current[k] += w[k]; }
    final best = current.indexOf(current.reduce(math.max));
    current[best] -= total;
    seq.add(_kinds[best]);
  }
  return _sequences[level] = seq;
}

class BotMemo { int turn = 0; double units = 0, tech = 0; }
final _memos = Expando<Map<int, BotMemo>>();
Map<int, BotMemo> botMemos(EmpireState e) => _memos[e] ??= {};   // للحفظ (save.dart)

class _Buy {
  final double cost;
  final bool tech, turn;
  final double rank;
  final Result Function() buy;
  _Buy(this.cost, this.buy, {this.tech = false, this.turn = false, this.rank = 0});
}

void empireEconomy(MatchState state, Player player) {
  final ms = state.empire!, pid = player.id;
  final memos = _memos[ms] ??= {};
  final memo = memos[pid] ??= BotMemo();
  for (var n = 0; n < _B.i('buysPerDecision'); n++) {
    final next = _pickNext(state, player, memo);
    if (next == null || ms.points[pid] < next.cost) return;
    if (!next.buy().ok) return;
    if (next.tech) { memo.tech += next.cost; } else { memo.units += next.cost; }
    if (next.turn) memo.turn++;
  }
}

int _qlen(MatchState state, District d) => state.empire!.queues[d.id]?.length ?? 0;

_Buy? _pickNext(MatchState state, Player player, BotMemo memo) {
  final pid = player.id, map = state.map, level = player.difficulty;
  final owned = map.districts.where((d) => d.owner == pid && d.capture != null).toList();
  if (owned.isEmpty) return null;
  final hqs = owned.where((d) => d.building == 'hq').toList();
  final plain = owned.where((d) => d.building == null && !d.police && d.featureTile == null && buildSpot(map, d) >= 0).toList();
  double enemyDist(District d) => _distanceToEnemy(state, pid, d);
  if (hqs.isEmpty) {
    final spot = _farthest(plain, (d) => enemyDist(d) * _worth(d));
    return spot != null ? _Buy(EMPIRE.m('buildings').m('hq').d('cost'), () => buildDistrict(state, pid, spot.id, 'hq'), tech: true) : null;
  }
  var army = 0;
  for (final u in state.units) { if (u.playerId == pid && u.state != 'dead' && u.hp > 0) army++; }
  final queued = hqs.fold(0, (n, d) => n + _qlen(state, d));
  final hq = hqs.reduce((a, b) => _qlen(state, a) <= _qlen(state, b) ? a : b);
  final roomy = _qlen(state, hq) < _B.i('queue') && army + queued < state.maxUnits;
  if (roomy && army >= _B.i('leaderArmy')) {
    final check = canQueue(state, pid, hq, 'leader');
    if (check.ok || check.reason == 'النقاط لا تكفي') {
      return _Buy(unitPrice(state, pid, 'leader').toDouble(), () => queueUnit(state, pid, hq.id, 'leader'));
    }
  }
  // ponytail: مجنَّدو المباني المميزة (pickRecruit) مع مزايا المدن في ن8
  final seq = _sequence(level);
  final kind = seq[memo.turn % seq.length];
  final unit = roomy ? _Buy(unitPrice(state, pid, kind).toDouble(), () => queueUnit(state, pid, hq.id, kind), turn: true) : null;
  final ts = _B.m('techShare');
  final share = ts.has(level) ? ts.d(level) : 0.0;
  if (share == 0 || (unit != null && army < _B.i('minArmy'))) return unit;
  final techTurn = memo.tech < share * (memo.units + memo.tech + 1);
  if (unit != null && !techTurn) return unit;
  return _bestTech(state, pid, owned, hqs, plain, enemyDist) ?? unit;
}

_Buy? _bestTech(MatchState state, int pid, List<District> owned, List<District> hqs, List<District> plain, double Function(District) enemyDist) {
  final items = <_Buy>[];
  void add(double rank, num cost, Result Function() buy) => items.add(_Buy(cost.toDouble(), buy, tech: true, rank: rank));
  final towers = owned.where((d) => d.building == 'tower').toList();
  final hospitals = owned.where((d) => d.building == 'hospital').toList();
  final B = EMPIRE.m('buildings');
  final front = _nearest(plain, (d) => enemyDist(d) / _worth(d));
  if (front != null && towers.length < (owned.length / _B.d('towerEvery')).floor()) {
    add(0, B.m('tower').d('cost'), () => buildDistrict(state, pid, front.id, 'tower'));
  }
  if (hqs.length < _B.i('maxHq') && owned.length >= _B.i('hqAt')) {
    final safe = _farthest(plain, (d) => enemyDist(d) * _worth(d));
    if (safe != null && safe != front) add(1, B.m('hq').d('cost'), () => buildDistrict(state, pid, safe.id, 'hq'));
  }
  final ups = [for (final key in _B.l('upgradeOrder').cast<String>()) (key, nextUpgrade(state, pid, key))].where((u) => u.$2 != null).toList();
  if (ups.isNotEmpty) {
    final low = ups.map((u) => u.$2!.level).reduce(math.min);
    final up = ups.firstWhere((u) => u.$2!.level == low);
    add(2.0 * low, up.$2!.cost, () => buyUpgrade(state, pid, up.$1));
  }
  if (hospitals.isEmpty && owned.length >= _B.i('hospitalAt')) {
    final home = hqs[0];
    final spot = _nearest(plain.where((d) => d != front).toList(), (d) => hypot(d.cx - home.cx, d.cy - home.cy) / _worth(d));
    if (spot != null) add(3, B.m('hospital').d('cost'), () => buildDistrict(state, pid, spot.id, 'hospital'));
  }
  const rankOf = {'hq': -0.5, 'tower': 3.0, 'hospital': 6.0};
  final hqOrder = B.m('hq').m('upgrades').l('order').cast<String>();
  int byLevel(District d) => hqOrder.map((key) => d.blv[key] ?? 0).reduce(math.min);
  final hqSorted = [...hqs];
  stableSort<District>(hqSorted, (a, b) => byLevel(a) - byLevel(b));
  final towerSorted = [...towers];
  stableSort<District>(towerSorted, (a, b) => byNum(enemyDist(a), enemyDist(b)));
  for (final list in [hqSorted, towerSorted, hospitals]) {
    for (final d in list) {
      final keys = [for (final key in B.m(d.building!).m('upgrades').l('order').cast<String>()) (key, nextBuildingUpgrade(d, key, state))]
          .where((u) => u.$2 != null).toList();
      if (keys.isEmpty) continue;
      final low = keys.map((u) => u.$2!.level).reduce(math.min);
      final up = keys.firstWhere((u) => u.$2!.level == low);
      add(rankOf[d.building]! + 2 * low, up.$2!.cost, () => upgradeBuilding(state, pid, d.id, up.$1));
      break;
    }
  }
  final F = _B.m('fort');
  void wall(List<District> list, int max, double rank) {
    final sorted = [...list];
    stableSort<District>(sorted, (a, b) => byNum(enemyDist(a), enemyDist(b)));
    District? d;
    for (final x in sorted) { if (x.fort < max) { d = x; break; } }
    final next = d != null ? nextFort(d, state, pid) : null;
    if (next != null) add(rank + 2 * next.level, next.cost, () => fortifyDistrict(state, pid, d!.id));
  }
  wall(hqs, F.i('hq'), F.d('rank'));
  wall(towers, F.i('tower'), F.d('rank') + 1);
  if (items.isEmpty) return null;
  return items.reduce((a, b) => b.rank < a.rank ? b : a);
}

double _distanceToEnemy(MatchState state, int pid, District district) {
  var best = double.infinity;
  for (final d in state.map.districts) {
    if (d.owner == null || d.capture == null || !isEnemyId(state, pid, d.owner!)) continue;
    final dist = hypot(d.cx - district.cx, d.cy - district.cy);
    if (dist < best) best = dist;
  }
  return best;
}

double _worth(District d) => DISTRICT_SIZES.m('botValue').d(sizeOf(d));
District? _nearest(List<District> list, double Function(District) score) {
  District? a;
  for (final b in list) { if (a == null || score(b) < score(a)) a = b; }
  return a;
}
District? _farthest(List<District> list, double Function(District) score) {
  District? a;
  for (final b in list) { if (a == null || score(b) > score(a)) a = b; }
  return a;
}
