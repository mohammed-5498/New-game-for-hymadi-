// طور القصة (القسم 17، منقول سطراً بسطر من js/game/story.js): مرحلة من حملة عصابة على أنظمة اللعبة نفسها. أنت ضد العدو
// الرئيسي (بوت) وقوات القصة (طرف محايد حليف له)، والمهام بالترتيب (lib/data/campaigns.dart). الأرقام في STORY
import 'dart:math' as math;

import '../audio/sound.dart';
import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/campaigns.dart';
import '../data/js_config.dart';
import '../map/generator.dart';
import '../map/pathfinding.dart';
import 'alerts.dart';
import 'capture.dart';
import 'combat.dart';
import 'empire.dart';
import 'realism.dart';
import 'state.dart';
import 'units.dart';
import 'victory.dart';

final J S = STORY;
bool _alive(Unit u) => u.state != 'dead' && u.hp > 0;
String _colorHex(String id) {
  for (final c in PLAYER_COLORS) { if ((c as J)['id'] == id) return c.s('hex'); }
  return (PLAYER_COLORS[0] as J).s('hex');
}

class StoryTag { String role; final int step; StoryTag(this.role, this.step); }

class StoryCur {
  final double t0;
  double end = 0, nextWave = 0, thinkAt = 0, since = 0;
  int waves = 0, arrived = 0, count = 0;
  bool spawned = false;
  (double, double)? dest;
  StoryCur(this.t0);
}

class StoryState {
  final String campaign, title;
  final int level, tier, count;
  int step = -1;
  StoryCur? cur;
  double nextAt;
  bool done = false, won = false;
  final Map<String, int> slots;
  (double, double)? exitAt;
  StoryState(this.campaign, this.level, this.tier, this.title, this.count, this.nextAt, this.slots);
}

// المرحلة من إعداد المباراة: (الحملة، المرحلة، رقمها) أو null
(J, J, int)? storyLevelOf(J settings) {
  final st = settings.mm('story');
  final camp = st != null ? CAMPAIGNS.mm('${st['campaign']}') : null;
  final k = st != null ? (st['level'] as num?)?.toInt() : null;
  if (camp == null || k == null || k < 0 || k >= camp.l('levels').length) return null;
  return (camp, camp.l('levels')[k] as J, k);
}

const _order = ['easy', 'medium', 'hard', 'insane'];
String storyBotLevel(int levelIndex, [String? difficulty]) {
  final k = _order.indexOf(S.l('botLevel')[levelIndex] as String) + (S.m('difficulty').dn(difficulty ?? S.s('defaultDifficulty')) ?? 0).toInt();
  return _order[math.max(0, math.min(_order.length - 1, k))];
}

List<J> storyPlayers(String campaignId, int levelIndex, String difficulty) {
  final camp = CAMPAIGNS.m(campaignId), level = camp.l('levels')[levelIndex] as J, nation = nations.m(camp.s('nation'));
  final main = storyBotLevel(levelIndex, difficulty);
  final weaker = _order[math.max(0, _order.indexOf(main) - 1)];
  J bot(J side, String difficulty) => {'name': side.s('name'), 'gangName': side.s('name'), 'gang': side.s('gang'), 'nation': side.ss('nation'),
    'color': side.s('color'), 'isHuman': false, 'team': 2, 'difficulty': difficulty};
  return [
    {'name': 'أنت', 'gang': nation.s('style'), 'nation': camp.s('nation'), 'color': S.m('colors').s('you'), 'isHuman': true, 'team': 1, 'difficulty': 'medium'},
    bot(camp.m('enemy'), main),
    for (final side in level['allies'] as List? ?? const []) bot(side as J, weaker),
  ];
}

// أطراف القصة المحايدة: قوات العدو، وطرف لكل زعيم بنمط غير نمطها، والأسرى
List<Player> createStoryPlayers(J settings, List<Player> players) {
  final L = storyLevelOf(settings);
  if (L == null) return const [];
  final (camp, level, _) = L;
  final human = players.firstWhere((p) => p.isHuman);
  final enemy = camp.m('enemy'), list = <Player>[];
  Player side(String role, String gang) => Player(id: players.length + list.length, name: enemy.s('name'), gang: gang,
      gangName: enemy.s('name'), color: _colorHex(enemy.s('color')), team: 2)
    ..neutral = true..captures = true..storyRole = role..friendOf = -1;
  list.add(side('forces', enemy.s('gang')));
  for (final step in level.l('steps').cast<J>()) {
    if (step.s('type') != 'boss' || step.m('boss').s('gang') == enemy.s('gang') || list.any((p) => p.storyRole == 'boss:${step.m('boss').s('gang')}')) continue;
    list.add(side('boss:${step.m('boss').s('gang')}', step.m('boss').s('gang')));
  }
  list.add(Player(id: players.length + list.length, name: 'الأسرى', gang: human.gang, nation: human.nation, gangName: 'الأسرى',
      color: S.m('colors').s('captives'))..neutral = true..passive = true..storyRole = 'captives'..friendOf = -1);
  return list;
}

Player? _storyPlayer(MatchState s, String role) { for (final p in s.players) { if (p.storyRole == role) return p; } return null; }
Player? _forces(MatchState s) => _storyPlayer(s, 'forces');
Player? _mainEnemy(MatchState s) { for (final p in s.players) { if (!p.isHuman && !p.neutral) return p; } return null; }
num _at(List list, MatchState s) => list[math.min(list.length - 1, s.story!.tier)] as num;
double _dist((double, double) a, (double, double) b) => hypot(a.$1 - b.$1, a.$2 - b.$2);
(double, double) _cap(District d) => (d.capture!.i.toDouble(), d.capture!.j.toDouble());

void initStory(MatchState s) {
  final L = storyLevelOf(s.settings);
  if (L == null) return;
  final (_, level, k) = L;
  final st = s.settings.m('story');
  s.story = StoryState(st.s('campaign'), k, k, level.s('title'), level.l('steps').length, S.d('startDelay'), _pickSlots(s, level.l('steps').cast<J>()));
  final me = s.players[s.humanId];
  final steps = level.l('steps').cast<J>();
  for (var n = 0; n < steps.length; n++) { _prepareStep(s, steps[n], n); }
  _applyBonus(s, st.mm('bonus') ?? const {}, me);
  snapDistrictTints(s);
  s.notice = Notice('المرحلة ${k + 1}: ${level.s('title')} — ${level.s('goal')}', true, 6, true);
}

void _applyBonus(MatchState s, J bonus, Player me) {
  final e = s.empire, home = s.map.districts[me.homeDistrictId];
  if (truthy(bonus['points']) && e != null) e.points[me.id] += bonus.d('points');
  if (truthy(bonus['district'])) {
    final used = s.story!.slots.values.toSet();
    final extra = _candidates(s).where((d) => !used.contains(d.id) && d.owner == null).toList();
    stableSort<District>(extra, (a, b) => byNum(_dist(_cap(a), _cap(home)), _dist(_cap(b), _cap(home))));
    if (extra.isNotEmpty) _own(extra[0], me.id);
  }
  if (truthy(bonus['hero'])) {
    final spot = findFreeTiles(s.map, home.capture!.i, home.capture!.j, 1);
    if (spot.isNotEmpty) s.units.add(createUnit(s, me, spot[0].$1, spot[0].$2, bonus.s('hero')));
  }
  if (truthy(bonus['upgrade']) && e != null) {
    final l = e.levels[me.id], key = bonus.s('upgrade');
    if (key == 'hp') l.hp = math.max(l.hp, 1);
    if (key == 'damage') l.damage = math.max(l.damage, 1);
    if (key == 'armor') l.armor = math.max(l.armor, 1);
    if (key == 'speed') l.speed = math.max(l.speed, 1);
    for (final u in s.units) { if (u.playerId == me.id) applyUpgrades(s, u); }
  }
}

List<District> _candidates(MatchState s) => s.map.districts.where((d) =>
    d.capture != null && !d.isHome && !d.police && !d.hill && d.feature == null && d.featureTile == null).toList();

Map<String, int> _pickSlots(MatchState s, List<J> steps) {
  final map = s.map, slots = <String, int>{}, used = <int>{};
  final me = s.players[s.humanId], enemy = _mainEnemy(s);
  final H = _cap(map.districts[me.homeDistrictId]);
  final E = enemy != null && enemy.homeDistrictId >= 0 && enemy.homeDistrictId < map.districts.length
      ? _cap(map.districts[enemy.homeDistrictId]) : (map.n - 1 - H.$1, map.n - 1 - H.$2);
  final D = math.max(1.0, _dist(H, E));
  final all = _candidates(s);
  var cx = 0.0, cy = 0.0;
  for (final d in all) { cx += d.capture!.i; }
  cx /= all.length;
  for (final d in all) { cy += d.capture!.j; }
  cy /= all.length;
  final score = <String, double Function(District)>{
    'near': (d) => _dist(_cap(d), H),
    'mid': (d) => (_dist(_cap(d), H) - 0.45 * D).abs() + 0.6 * (_dist(_cap(d), H) + _dist(_cap(d), E) - D),
    'far': (d) => (_dist(_cap(d), H) - 0.72 * D).abs() + 0.6 * (_dist(_cap(d), H) + _dist(_cap(d), E) - D),
    'far2': (d) => (_dist(_cap(d), H) - 0.62 * D).abs() + 0.3 * (_dist(_cap(d), H) + _dist(_cap(d), E) - D),
    'center': (d) => hypot(d.capture!.i - cx, d.capture!.j - cy),
  };
  for (final step in steps) {
    final name = step.s('at');
    if (slots.containsKey(name)) continue;
    if (name == 'home') { slots[name] = me.homeDistrictId; continue; }
    if (name == 'enemyHome') { slots[name] = enemy?.homeDistrictId ?? -1; continue; }
    final fn = score[name] ?? score['mid']!;
    final list = all.where((d) => !used.contains(d.id)).toList();
    stableSort<District>(list, (a, b) => byNum(fn(a), fn(b)));
    if (list.isEmpty) continue;
    slots[name] = list[0].id;
    used.add(list[0].id);
  }
  return slots;
}

District? _stepDistrict(MatchState s, J step) {
  final id = s.story!.slots[step.s('at')];
  return id != null && id >= 0 ? s.map.districts[id] : null;
}

void _own(District d, int pid) { d.owner = pid; d.progress = 100; d.progressOwner = pid; }

void _placeTower(MatchState s, District d) {
  final k = buildSpot(s.map, d);
  if (k < 0) return;
  d.storyTile = s.map.type[k];
  d.building = 'tower';
  d.buildTile = k;
  d.blv = {};
  d.cool = 0;
  s.map.type[k] = BUILDING_TILE['tower']!;
}

void _razeTower(MatchState s, District d) {
  if (d.building != 'tower' || d.storyTile == null) return;
  s.map.type[d.buildTile!] = d.storyTile!;
  d.building = null;
  d.buildTile = null;
  d.blv = {};
  addUltFx(s, 'dust', d.capture!.i.toDouble(), d.capture!.j.toDouble());
  soundAt(s, 'capture_done', d.capture!.i.toDouble(), d.capture!.j.toDouble());
  s.mapVersion++;
}

List<Unit> _spawnSquad(MatchState s, Player player, double i, double j, int n, String role, int step, [List<String?> heroes = const []]) {
  final units = <Unit>[];
  for (final (x, y) in findFreeTiles(s.map, jsRoundD(i), jsRoundD(j), n)) {
    final unit = createUnit(s, player, x, y, units.length < heroes.length ? heroes[units.length] : null);
    unit.story = StoryTag(role, step);
    s.units.add(unit);
    units.add(unit);
  }
  return units;
}

List<Unit> _guard(MatchState s, District d, int n, int step) {
  final units = _spawnSquad(s, _forces(s)!, d.capture!.i.toDouble(), d.capture!.j.toDouble(), n, 'guard', step);
  for (final u in units) { u.homePost = Point2(u.x, u.y); u.leash = S.d('guardLeash'); }
  return units;
}

void _prepareStep(MatchState s, J step, int k) {
  final d = _stepDistrict(s, step);
  if (d == null) return;
  final me = s.humanId, f = _forces(s)!, enemy = _mainEnemy(s);
  switch (step.s('type')) {
    case 'defend':
      _own(d, me);
      if (truthy(step['tower'])) _placeTower(s, d);
    case 'rescue':
      _own(d, f.id);
      _guard(s, d, _at(S.l('guards'), s).toInt(), k);
      final units = _spawnSquad(s, _storyPlayer(s, 'captives')!, d.capture!.i.toDouble(), d.capture!.j.toDouble(),
          (step['captives'] as num?)?.toInt() ?? 1, 'captive', k);
      for (final u in units) { u.homePost = Point2(u.x, u.y); u.leash = 1; }
    case 'destroy':
      _own(d, enemy != null ? enemy.id : f.id);
      _placeTower(s, d);
      _guard(s, d, math.max(1, _at(S.l('guards'), s).toInt() - 1), k);
    case 'capture':
    case 'hold':
      _own(d, f.id);
      _guard(s, d, _at(S.l('guards'), s).toInt(), k);
    case 'boss':
      if (d.owner == null) _own(d, f.id);
  }
}

// --- كل تحديث (قبل الفوز) ---
void updateStory(MatchState s) {
  final st = s.story;
  if (st == null || st.done || s.matchResult != null) return;
  final L = storyLevelOf(s.settings);
  if (L == null) return;
  final steps = L.$2.l('steps').cast<J>();
  if (st.cur == null) {
    if (s.time < st.nextAt) return;
    st.step++;
    if (st.step >= steps.length) { _completeLevel(s, L.$2); return; }
    _startStep(s, steps[st.step]);
    return;
  }
  final step = steps[st.step];
  final r = _runStep(s, step, st.cur!);
  if (r == 'ok') {
    _stepDone(s, step);
  } else if (r != null) {
    _fail(s, r);
  }
}

(double, double) _homeOf(MatchState s) => _cap(s.map.districts[s.players[s.humanId].homeDistrictId]);

void _startStep(MatchState s, J step) {
  final st = s.story!, d = _stepDistrict(s, step), t = s.time;
  final cur = st.cur = StoryCur(t);
  final k = st.step, type = step.s('type');
  if (type == 'defend') { cur.end = t + _at(S.l('defendSeconds'), s); cur.nextWave = t + S.d('firstWave'); }
  if (type == 'rescue' || type == 'destroy' || type == 'hold') cur.end = t + _at(S.l('timeLimit'), s);
  if (type == 'escort') {
    final home = _homeOf(s), me = s.players[s.humanId];
    final units = _spawnSquad(s, me, home.$1, home.$2, S.m('escort').i('merchants'), 'merchant', k);
    for (final u in units) { u.harmless = true; u.cargo = true; u.name = 'تاجر القافلة'; u.color = S.m('colors').s('escort'); }
    cur.nextWave = t + 5;
  }
  if (type == 'intercept') cur.nextWave = t + S.m('runner').d('delay');
  if (type == 'boss' && d != null) _spawnBoss(s, step, d, k);
  final p = targetPoint(s, step);
  if (p != null) raiseAlert(s, 'story', jsRoundD(p.$1), jsRoundD(p.$2));
  s.notice = Notice('المهمة ${k + 1}/${st.count}: ${step.s('text')} — ${step.s('hint')}', true, 5, true);
  sound('alert');
}

void _spawnBoss(MatchState s, J step, District d, int k) {
  final B = step.m('boss'), player = _storyPlayer(s, 'boss:${B.s('gang')}') ?? _forces(s)!;
  final spots = findFreeTiles(s.map, d.capture!.i, d.capture!.j, 1);
  if (spots.isEmpty) return;
  final (si, sj) = spots[0];
  final champion = truthy(B['champion']);
  final boss = createUnit(s, player, si, sj, champion ? null : B.ss('hero'), champion);
  final st = <String, Object?>{...boss.stats}, n = s.story!.tier;
  final SB = S.m('boss');
  st['hp'] = st.d('hp') * (SB.l('hp')[n] as num);
  st['damage'] = st.d('damage') * (SB.l('damage')[n] as num);
  if (truthy(st['meleeDamage'])) st['meleeDamage'] = st.d('meleeDamage') * (SB.l('damage')[n] as num);
  st['armor'] = math.min(0.7, (st.dn('armor') ?? 0) + (SB.l('armor')[n] as num));
  st['capturePower'] = 0;
  boss.stats = st;
  boss.maxHp = st.d('hp');
  boss.hp = st.d('hp');
  boss.name = B.s('name');
  boss.storyBoss = true;
  boss.story = StoryTag('boss', k);
  boss.homePost = Point2(si.toDouble(), sj.toDouble());
  boss.leash = SB.d('leash');
  s.units.add(boss);
  final escorts = _spawnSquad(s, _forces(s)!, d.capture!.i.toDouble(), d.capture!.j.toDouble(), (SB.l('escorts')[n] as num).toInt(), 'escort', k);
  for (final u in escorts) { u.homePost = Point2(u.x, u.y); u.leash = SB.d('leash'); }
  addUltFx(s, 'dust', si.toDouble(), sj.toDouble());
}

String? _runStep(MatchState s, J step, StoryCur cur) {
  final t = s.time, d = _stepDistrict(s, step), me = s.humanId, k = s.story!.step;
  final think = t >= cur.thinkAt;
  if (think) cur.thinkAt = t + S.d('think');
  bool mine(Unit u) => u.story != null && u.story!.step == k;
  switch (step.s('type')) {
    case 'defend':
      if (d == null || d.owner != me) return 'سقط ${step.s('text').replaceFirst(RegExp('^دافع عن '), '')}';
      if (t >= cur.nextWave && t < cur.end - 5) { _wave(s, _cap(d), k, 'wave'); cur.nextWave = t + _at(S.l('waveEvery'), s); }
      if (think) _push(s, (u) => mine(u) && u.story!.role == 'wave', _cap(d));
      return t >= cur.end ? 'ok' : null;
    case 'escort':
      final dest = d != null ? _cap(d) : null;
      final merchants = s.units.where((u) => mine(u) && u.story!.role == 'merchant' && _alive(u)).toList();
      if (dest != null) {
        for (final u in merchants) {
          if (_dist((u.x, u.y), dest) > S.m('escort').d('arrive')) continue;
          u.story!.role = 'arrived';
          u.hp = 0; u.state = 'dead'; u.deathTimer = 0; u.path = []; u.target = null; u.cargo = false;
          cur.arrived++;
        }
      }
      s.units.removeWhere((u) => u.story != null && u.story!.role == 'arrived' && u.story!.step == k);
      final walking = merchants.where((u) => u.story!.role == 'merchant').toList();
      if (walking.isEmpty) return cur.arrived > 0 ? 'ok' : 'سقط كل تجار القافلة';
      if (think && dest != null) {
        final idle = walking.where((u) => u.state == 'idle').toList();
        if (idle.isNotEmpty) commandMove(s, dest.$1, dest.$2, idle, false);
      }
      if (t >= cur.nextWave && cur.waves < S.m('escort').i('ambushes') && dest != null) {
        final home = _homeOf(s), f = 0.4 + 0.3 * cur.waves;
        _wave(s, (home.$1 + (dest.$1 - home.$1) * f, home.$2 + (dest.$2 - home.$2) * f), k, 'ambush', 0);
        cur.nextWave = t + 10;
      }
      if (think && walking.isNotEmpty) {
        var ci = 0.0, cj = 0.0;
        for (final u in walking) { ci += u.x; }
        ci /= walking.length;
        for (final u in walking) { cj += u.y; }
        cj /= walking.length;
        _push(s, (u) => mine(u) && u.story!.role == 'ambush', (ci, cj));
      }
      return null;
    case 'intercept':
      if (!cur.spawned && t >= cur.nextWave && d != null) {
        cur.spawned = true;
        cur.dest = step['to'] == 'home' ? _homeOf(s) : _exitPoint(s);
        final units = _spawnSquad(s, _forces(s)!, d.capture!.i.toDouble(), d.capture!.j.toDouble(), (step['runners'] as num?)?.toInt() ?? 1, 'runner', k);
        for (final u in units) {
          u.harmless = true;
          u.cargo = true;
          u.name = step['to'] == 'home' ? 'متفجّر' : 'رسول';
          u.stats = {...u.stats, 'speed': u.stats.d('speed') * S.m('runner').d('speed'), 'capturePower': 0};
        }
        raiseAlert(s, 'story', d.capture!.i, d.capture!.j);
      }
      if (!cur.spawned) return null;
      final runners = s.units.where((u) => mine(u) && u.story!.role == 'runner' && _alive(u)).toList();
      if (runners.isEmpty) return 'ok';
      for (final u in runners) {
        if (_dist((u.x, u.y), cur.dest!) <= S.m('runner').d('exitRadius')) return step['to'] == 'home' ? 'وصل متفجّر إلى قاعدتك' : 'هرب الرسول';
      }
      if (think) {
        final idle = runners.where((u) => u.state == 'idle').toList();
        if (idle.isNotEmpty) commandMove(s, cur.dest!.$1, cur.dest!.$2, idle, false);
      }
      return null;
    case 'rescue':
      if (d != null && d.owner == me) { _freeCaptives(s, k); return 'ok'; }
      return t >= cur.end ? 'نقلت الشبكة الأسرى بعيداً' : null;
    case 'destroy':
      if (d != null && d.owner == me) { _razeTower(s, d); return 'ok'; }
      return t >= cur.end ? 'نقطة المراقبة ما زالت قائمة' : null;
    case 'capture':
    case 'storm':
      return d != null && d.owner == me ? 'ok' : null;
    case 'hold':
      if (d == null) return 'ok';
      final p = _cap(d), R = S.m('hold').d('radius');
      var mineIn = false, foe = false;
      for (final u in s.units) {
        if (!_alive(u) || u.harmless || _dist((u.x, u.y), p) > R) continue;
        if (u.playerId == me) {
          mineIn = true;
        } else if (isEnemyId(s, me, u.playerId)) {
          foe = true;
        }
      }
      cur.since = mineIn && !foe ? cur.since + TICK_SEC : 0;
      if (cur.since + 1e-6 >= _at(S.m('hold').l('seconds'), s)) return 'ok';
      return t >= cur.end ? 'انفجرت العبوة' : null;
    case 'gather':
      final home = _homeOf(s);
      var n = 0;
      for (final u in s.units) {
        if (u.playerId == me && _alive(u) && !u.harmless && _dist((u.x, u.y), home) <= S.m('gather').d('radius')) n++;
      }
      cur.count = n;
      return n >= _at(S.m('gather').l('count'), s) ? 'ok' : null;
    case 'boss':
      return s.units.any((u) => u.storyBoss && u.story != null && u.story!.step == k && _alive(u)) ? null : 'ok';
  }
  return null;
}

void _wave(MatchState s, (double, double) target, int k, String role, [int extra = 0]) {
  final enemy = _mainEnemy(s), map = s.map;
  final E = enemy != null && enemy.homeDistrictId >= 0 && enemy.homeDistrictId < map.districts.length
      ? _cap(map.districts[enemy.homeDistrictId]) : (map.n / 2, map.n / 2);
  final len = _dist(target, E), f = len > 14 ? 14 / len : 1.0;
  final src = role == 'ambush' ? target : (target.$1 + (E.$1 - target.$1) * f, target.$2 + (E.$2 - target.$2) * f);
  final units = _spawnSquad(s, _forces(s)!, src.$1, src.$2, _at(S.l('waveSize'), s).toInt() + extra, role, k);
  if (units.isNotEmpty) commandAttackMove(s, target.$1, target.$2, units, false);
  s.story!.cur!.waves++;
}

void _push(MatchState s, bool Function(Unit) which, (double, double) p) {
  final idle = s.units.where((u) => which(u) && _alive(u) && u.state == 'idle' && _dist((u.x, u.y), p) > 2).toList();
  if (idle.isNotEmpty) commandAttackMove(s, p.$1, p.$2, idle, false);
}

void _freeCaptives(MatchState s, int k) {
  final me = s.players[s.humanId];
  var n = 0;
  for (final u in s.units) {
    if (u.story == null || u.story!.role != 'captive' || u.story!.step != k || !_alive(u)) continue;
    u.playerId = me.id;
    u.color = me.color;
    u.homePost = null;
    u.leash = 0;
    u.story = null;
    applyUpgrades(s, u);
    n++;
  }
  if (n > 0) s.notice = Notice('انضم إليك $n من الأسرى', true, 3);
}

(double, double) _exitPoint(MatchState s) {
  final st = s.story!;
  if (st.exitAt != null) return st.exitAt!;
  final map = s.map, home = _homeOf(s), last = map.n - 1;
  (double, double)? best;
  var bestD = -1.0;
  for (var a = 0; a < map.n; a++) {
    for (final (i, j) in [(a, 0), (a, last), (0, a), (last, a)]) {
      if (map.road[map.idx(i, j)] == 0 || !map.isConnected(i, j)) continue;
      final dd = _dist((i.toDouble(), j.toDouble()), home);
      if (dd > bestD) { bestD = dd; best = (i.toDouble(), j.toDouble()); }
    }
  }
  return st.exitAt = best ?? (last.toDouble(), last.toDouble());
}

void _stepDone(MatchState s, J step) {
  final st = s.story!, me = s.humanId, pts = _at(S.l('missionPoints'), s);
  final e = s.empire;
  if (e != null) { e.points[me] += pts; e.earned[me] += pts; }
  sound('capture_special');
  st.cur = null;
  st.nextAt = s.time + 2.5;
  final last = st.step + 1 >= st.count;
  s.notice = Notice('✓ ${step.s('text')} • +$pts نقطة${last ? '' : ' • المهمة التالية بعد لحظات'}', true, 3, true);
}

void _fail(MatchState s, String reason) {
  s.story!.done = true;
  finish(s, false, 'فشلت المهمة: $reason');
}

void _completeLevel(MatchState s, J level) {
  s.story!..done = true..won = true;
  finish(s, true, level.s('result'));
}

String _clock(double t) => '${(t / 60).floor()}:${(t % 60).floor().toString().padLeft(2, '0')}';

// شريط المهمة أعلى الشاشة: (النص، تنبيه) أو null
(String, bool)? storyBar(MatchState s) {
  final st = s.story;
  if (st == null || st.done) return null;
  final L = storyLevelOf(s.settings)!;
  final cur = st.cur;
  if (cur == null) return (st.step < 0 ? '📜 ${st.title}' : '📜 المهمة التالية…', false);
  final step = L.$2.l('steps')[st.step] as J, t = s.time;
  var extra = '';
  if (cur.end != 0) extra = ' • ${_clock(math.max(0, cur.end - t))}';
  if (step.s('type') == 'gather') extra = ' • ${cur.count}/${_at(S.m('gather').l('count'), s)}';
  if (step.s('type') == 'hold') extra = ' • ${cur.since.floor()}/${_at(S.m('hold').l('seconds'), s)} ث$extra';
  if (step.s('type') == 'escort') extra = ' • وصل ${cur.arrived}';
  return ('📜 ${st.step + 1}/${st.count}: ${step.s('text')}$extra', cur.end != 0 && cur.end - t <= 20);
}

// مكان المهمة الحالية على الخريطة: (i, j, r) أو null
(double, double, double)? targetPoint(MatchState s, [J? step]) {
  final st = s.story;
  if (st == null || st.done) return null;
  final L = storyLevelOf(s.settings)!;
  step ??= st.cur != null ? L.$2.l('steps')[st.step] as J : null;
  if (step == null) return null;
  if (step.s('type') == 'intercept' && st.cur?.dest != null) return (st.cur!.dest!.$1, st.cur!.dest!.$2, S.m('runner').d('exitRadius'));
  if (step.s('type') == 'gather') { final h = _homeOf(s); return (h.$1, h.$2, S.m('gather').d('radius')); }
  final d = _stepDistrict(s, step);
  return d != null ? (d.capture!.i.toDouble(), d.capture!.j.toDouble(), step.s('type') == 'hold' ? S.m('hold').d('radius') : 2.6) : null;
}

List<(String, String)> storyExtras(MatchState s) {
  final st = s.story;
  if (st == null) return [];
  return [('المهام المكتملة', '${math.min(st.count, math.max(0, st.step))}/${st.count}')];
}
