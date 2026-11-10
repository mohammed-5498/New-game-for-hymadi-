// الأمم (القسم 3.10): منقول من js/game/nations.js. الأمة نمط قتالي (عصابة كلاسيكية بقواعدها) وسمة وأسماء وضربة بطل
import 'dart:typed_data';

import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../map/generator.dart';
import 'state.dart';

J? nationOf(String? id) => id != null && nations.l('order').contains(id) ? nations.m(id) : null;

String sideName(String gang, String? nationId) {
  final nation = nationOf(nationId);
  return nation != null ? nation.s('gangName') : GANGS.m(gang).s('name');
}

// إحصائيات وحدة الأمة: نمطها كما هو، ثم معدِّلات السمة، وضربة البطل الخاصة
J nationStats(J stats, String? nationId, bool champion, [String? heroId]) {
  final nation = nationOf(nationId);
  if (nation == null) return stats;
  final mods = nation.m('trait').m('mods');
  if (mods.b('vision')) stats['visionRange'] = stats.d('visionRange') + mods.d('vision');
  if (mods.b('rangedRange') && stats.b('projectile')) stats['attackRange'] = stats.d('attackRange') + mods.d('rangedRange');
  if (mods.b('showoff')) stats['showoff'] = mods['showoff'];
  if (mods.b('weatherProof') && stats.b('projectile')) stats['weatherProof'] = true;
  if (mods.b('kicks')) stats['kicks'] = mods['kicks'];
  if (mods.b('commonArmor') && !champion && heroId == null) stats['armor'] = stats.d('armor') + mods.d('commonArmor');
  if (mods.b('heavyStagger')) stats['heavyStagger'] = 1 + mods.d('heavyStagger');
  if (mods.b('punches')) stats['punches'] = mods['punches'];
  if (mods.b('armorAll')) stats['armor'] = stats.d('armor') + mods.d('armorAll');
  if (mods.b('rangedDamage') && stats.b('projectile')) stats['damage'] = stats.d('damage') * (1 + mods.d('rangedDamage'));
  if (mods.b('dodge')) stats['dodge'] = mods['dodge'];
  if (mods.b('duel')) stats['clashBonus'] = mods.m('duel')['clash'];
  if (mods.b('slowShots') && stats.b('projectile')) stats['slowShots'] = mods['slowShots'];
  final heroMods = heroId != null ? nation.mm('heroMods')?.mm(heroId) : null;
  if (heroMods != null && heroMods.b('slowHits')) stats['slowHits'] = heroMods['slowHits'];
  if (champion && nation.b('ult')) stats['ult'] = nation['ult'];
  return stats;
}

String? nationUnitName(String? nationId, String? heroId, bool champion) {
  final nation = nationOf(nationId);
  if (nation == null) return null;
  final names = nation.m('names');
  return champion ? names.s('champion') : heroId != null ? names.s(heroId) : names.s('common');
}

// "داخل أحيائك": منطقة كل حي مربعاته وكل مربع أقرب إليه (بحث عرضي واحد)، والمتجاوران من تلامست منطقتاهما
void buildTerritory(GameMap map) {
  final n = map.n, total = n * n;
  final area = Int32List(total)..fillRange(0, total, -1), queue = Int32List(total);
  var tail = 0;
  for (var k = 0; k < total; k++) {
    final d = map.districtAt[k];
    if (d >= 0 && map.districts[d].capture != null) { area[k] = d; queue[tail++] = k; }
  }
  for (var head = 0; head < tail; head++) {
    final k = queue[head], i = k % n, a = area[k];
    if (i > 0 && area[k - 1] < 0) { area[k - 1] = a; queue[tail++] = k - 1; }
    if (i < n - 1 && area[k + 1] < 0) { area[k + 1] = a; queue[tail++] = k + 1; }
    if (k >= n && area[k - n] < 0) { area[k - n] = a; queue[tail++] = k - n; }
    if (k + n < total && area[k + n] < 0) { area[k + n] = a; queue[tail++] = k + n; }
  }
  map.areaAt = area;
  final adj = [for (final _ in map.districts) <int>{}];
  void touch(int a, int b) { if (a >= 0 && b >= 0 && a != b) { adj[a].add(b); adj[b].add(a); } }
  for (var k = 0; k < total; k++) {
    if (k % n < n - 1) touch(area[k], area[k + 1]);
    if (k + n < total) touch(area[k], area[k + n]);
  }
  for (var id = 0; id < map.districts.length; id++) { map.districts[id].adj = adj[id].toList()..sort(); }
}

bool inOwnArea(GameMap map, Unit unit) {
  final i = jsRoundD(unit.x), j = jsRoundD(unit.y);
  if (i < 0 || j < 0 || i >= map.n || j >= map.n) return false;
  final a = map.areaAt![j * map.n + i];
  return a >= 0 && map.districts[a].owner == unit.playerId;
}

J? _mods(Player p) => nationOf(p.nation)?.m('trait').m('mods');
J? homeMods(Player p) { final m = _mods(p); return m != null && (m.b('homeDamage') || m.b('homeDamageTaken')) ? m : null; }
J? brotherMods(Player p) => _mods(p)?.mm('brothers');
J? outnumberedMods(Player p) => _mods(p)?.mm('outnumbered');
J? duelMods(Player p) => _mods(p)?.mm('duel');
J? phalanxMods(Player p) => _mods(p)?.mm('phalanx');

double captureBonus(MatchState state, District district, int playerId) {
  final nation = nationOf(state.players[playerId].nation);
  if (nation == null) return 0;
  final mods = nation.m('trait').m('mods'), all = mods.dd('capture', 0), bonus = mods['adjacentCapture'];
  if (!truthy(bonus) || district.adj.isEmpty) return all;
  for (final id in district.adj) { if (state.map.districts[id].owner == playerId) return all + (bonus as num); }
  return all;
}
