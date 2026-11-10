// أطوار اللعب (القسم 9.5، منقول من js/game/modes.js): كلها على اقتصاد الإمبراطورية، والطور يضيف شرط فوزه.
// السيطرة الكاملة: آخر من يبقى (victory.dart). والوقت بالنقاط وملك الحي وحماية الزعيم والصمود ضد الشرطة هنا
import 'dart:math' as math;

import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../map/generator.dart';
import '../map/pathfinding.dart';
import '../ui/prefs.dart' show Prefs;
import '../audio/sound.dart';
import 'alerts.dart';
import 'combat.dart';
import 'empire.dart';
import 'features.dart';
import 'police.dart';
import 'spawn.dart';
import 'state.dart';
import 'ults.dart';
import 'units.dart';
import 'victory.dart';

final J _GM = gameModes;

class SurvivalRecord {
  final int waves, seconds;
  const SurvivalRecord(this.waves, this.seconds);
}

// ما يخص الطور (modeState في JavaScript، والنقاط والطوابير في state.empire)
class ModeState {
  double duration = 0;            // الوقت بالنقاط
  bool finalAnnounced = false;
  int hillId = -1;                // ملك الحي
  double target = 0;
  List<double> held = [];
  Set<String> warned = {};
  bool blocked = false;
  int leaderKills = 0;            // حماية الزعيم
  double? lastHp;
  double alertAt = -99;
  String level = 'medium';        // الصمود
  int wave = 0;
  double nextWaveAt = 0, retargetAt = 0;
  (SurvivalRecord, bool)? record; // (الأفضل، رقم جديد؟) عند النهاية
}

ModeState modeOf(MatchState state) => state.modeState as ModeState;

String sideKey(Player p) => p.team != 0 ? 'team${p.team}' : 'player${p.id}';
Iterable<Player> _gangPlayers(MatchState state) => state.players.where((p) => !p.neutral);
bool economyOf(J settings) => _GM.has(settings.ss('mode') ?? '') && !settings.b('arena');

// --- البداية ---
void initMode(MatchState state) {
  installSummonHook();
  final m = state.settings.ss('mode');
  state.mode = m != null && _GM.has(m) && m != 'order' && m != 'defaultMode' ? m : 'conquest';
  state.economy = economyOf(state.settings);
  final options = state.settings.mm('modeOptions') ?? const <String, Object?>{};
  final ms = ModeState();
  if (state.mode == 'points') {
    final P = _GM.m('points');
    final minutes = P.l('minutes').contains(options['minutes']) ? (options['minutes'] as num).toDouble() : P.d('defaultMinutes');
    ms.duration = minutes * 60;
  }
  if (state.mode == 'king') {
    final K = _GM.m('king');
    final minutes = K.l('holdMinutes').contains(options['holdMinutes']) ? (options['holdMinutes'] as num).toDouble() : K.d('defaultHoldMinutes');
    final hill = pickHill(state.map);
    if (hill != null) hill.hill = true;
    ms.hillId = hill?.id ?? -1;
    ms.target = minutes * 60;
    ms.held = [for (final _ in state.players) 0.0];
  }
  if (state.mode == 'survival') {
    final S = _GM.m('survival');
    ms.level = S.l('levels').contains(options['level']) ? options['level'] as String : S.s('defaultLevel');
    ms.nextWaveAt = S.d('firstWaveSeconds');
  }
  state.modeState = ms;
  if (state.economy) {
    initEmpire(state);
    if (state.mode == 'survival') state.empire!.incomeMul = _GM.m('survival').m('incomeMul').d(ms.level);
  }
}

// بعد ظهور الوحدات الأولى: الزعيم أقوى لأنه لا يعود، دم +50% (القسم 9.5.3)
void prepareModeUnits(MatchState state) {
  if (state.mode != 'regicide') return;
  for (final unit in state.units) {
    if (!unit.champion) continue;
    final factor = 1 + _GM.m('regicide').d('hpBonus');
    unit.stats = {...unit.stats, 'hp': unit.stats.d('hp') * factor};
    unit.maxHp = unit.stats.d('hp');
    unit.hp = unit.maxHp;
  }
}

// --- كل تحديث ---
void updateMode(MatchState state) {
  if (state.matchResult != null) return;
  switch (state.mode) {
    case 'points': _updatePoints(state);
    case 'king': _updateKing(state);
    case 'regicide': _updateRegicide(state);
    case 'survival': _updateSurvival(state);
  }
  if (state.economy && state.matchResult == null) updateEmpire(state);
}

// ================= 9.5.2 الوقت بالنقاط =================
double pointsRemaining(MatchState state) => math.max(0, modeOf(state).duration - state.time);
bool isFinalMinute(MatchState state) => state.mode == 'points' && pointsRemaining(state) <= _GM.m('points').d('finalSeconds');

void _updatePoints(MatchState state) {
  final ms = modeOf(state);
  final fin = isFinalMinute(state);
  if (state.economy) state.empire!.incomeMul = fin ? _GM.m('points').d('finalMultiplier') : 1;
  if (fin && !ms.finalAnnounced) {
    ms.finalAnnounced = true;
    state.notice = Notice('الدقيقة الأخيرة! النقاط مضاعفة', false, 4);
    sound('alert');
  }
  if (pointsRemaining(state) <= 0) _endPoints(state);
}

double _armyWeight(MatchState state, int playerId) {
  final w = _GM.m('points').m('armyWeights');
  double total = 0;
  for (final unit in state.units) {
    if (unit.playerId != playerId || unit.state == 'dead') continue;
    total += unit.champion ? w.d('champion') : unit.hero != null ? w.d('hero') : w.d('unit');
  }
  return total;
}

class SideTotal {
  final String key;
  final players = <Player>[];
  double points = 0, army = 0;
  int districts = 0;
  bool alive = false;
  SideTotal(this.key);
}

// نتيجة كل جانب: متوسط نقاط أعضائه، ومجموع جيوشهم وأحيائهم لحسم التعادل
List<SideTotal> sideTotals(MatchState state) {
  final sides = <String, SideTotal>{};
  final earned = state.empire?.earned;
  for (final player in _gangPlayers(state)) {
    final side = sides.putIfAbsent(sideKey(player), () => SideTotal(sideKey(player)));
    side.players.add(player);
    side.points += earned != null ? earned[player.id] : 0;
    side.army += _armyWeight(state, player.id);
    side.districts += state.map.districts.where((d) => d.owner == player.id).length;
    if (isPlayerAlive(state, player.id)) side.alive = true;
  }
  for (final side in sides.values) { side.points /= side.players.length; }
  return sides.values.toList();
}

void _endPoints(MatchState state) {
  final ranked = sideTotals(state).where((s) => s.alive).toList();
  stableSort<SideTotal>(ranked, (a, b) {
    final p = b.points.floor() - a.points.floor();
    if (p != 0) return p;
    if (b.army != a.army) return byNum(b.army, a.army);
    return b.districts - a.districts;
  });
  if (ranked.isEmpty) return;
  final first = ranked[0], second = ranked.length > 1 ? ranked[1] : null;
  final human = state.humanId >= 0 ? state.players[state.humanId] : null;
  final won = human != null && sideKey(human) == first.key;
  final tied = second != null && second.points.floor() == first.points.floor();
  final by = !tied ? 'نقاط' : (second.army != first.army ? 'جيش' : 'أحياء');
  final winnerName = first.players.map((p) => p.gangName).join(' و');
  final String reason;
  if (won) {
    reason = by == 'نقاط' ? 'انتهى الوقت ونقاطك الأعلى'
        : by == 'جيش' ? 'انتهى الوقت بتعادل النقاط، وجيشك الأكبر'
        : 'انتهى الوقت بتعادل النقاط والجيش، وأحياؤك أكثر';
  } else {
    reason = by == 'نقاط' ? 'انتهى الوقت و$winnerName أعلى نقاطاً' : 'انتهى الوقت بتعادل النقاط، و$winnerName حسمه';
  }
  finish(state, won, reason);
}

// ================= 9.5.4 ملك الحي =================
// التلة: الأقرب لمركز الخريطة من الأحياء بـ 6 مربعات فأكثر، لا منزلية ولا مركز شرطة ولا حي ميزة
District? pickHill(GameMap map) {
  final center = (map.n - 1) / 2;
  District? best;
  var bestDist = double.infinity;
  for (final d in map.districts) {
    if (d.capture == null || d.isHome || d.police || d.feature != null || d.tiles.length < _GM.m('king').i('hillMinTiles')) continue;
    final dist = hypot(d.cx - center, d.cy - center);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best;
}

District? hillOf(MatchState state) {
  final id = (state.modeState as ModeState?)?.hillId ?? -1;
  return id >= 0 && id < state.map.districts.length ? state.map.districts[id] : null;
}

void _updateKing(MatchState state) {
  final ms = modeOf(state);
  final hill = hillOf(state);
  if (hill == null) return;
  final owner = hill.owner;
  ms.blocked = false;
  if (owner != null && !state.players[owner].neutral) {
    final zone = hill.zone.toSet();
    for (final unit in state.units) {
      if (unit.state == 'dead') continue;
      if (!zone.contains(state.map.idx(jsRoundD(unit.x), jsRoundD(unit.y)))) continue;
      if (isEnemyId(state, owner, unit.playerId)) { ms.blocked = true; break; }
    }
    if (!ms.blocked) ms.held[owner] += TICK_SEC;
  }
  final K = _GM.m('king');
  for (final side in kingSides(state)) {
    final left = ms.target - side.held;
    if (left <= K.d('warnSeconds') && !ms.warned.contains(side.key) && side.alive) {
      ms.warned.add(side.key);
      final mine = _isHumanSide(state, side.players);
      state.notice = Notice(mine ? 'أنت على وشك الفوز بالتلة!' : '${side.name} يقترب من الفوز بالتلة!', mine, 4);
      sound('alert');
    }
    if (left <= 0 && side.alive) {
      final won = _isHumanSide(state, side.players);
      final need = jsRound(ms.target / 60);
      final span = need == 2 ? 'دقيقتين' : '$need دقائق';
      finish(state, won, won ? 'سيطرت على التلة $span' : '${side.name} سيطر على التلة $span');
      return;
    }
  }
}

class KingSide {
  final String key, color, name;
  final players = <Player>[];
  double held = 0;
  bool alive = false;
  KingSide(this.key, this.color, this.name);
}

List<KingSide> kingSides(MatchState state) {
  final sides = <String, KingSide>{};
  final ms = modeOf(state);
  for (final player in _gangPlayers(state)) {
    final side = sides.putIfAbsent(sideKey(player), () => KingSide(sideKey(player), player.color, player.gangName));
    side.players.add(player);
    side.held += ms.held[player.id];
    if (isPlayerAlive(state, player.id)) side.alive = true;
  }
  return sides.values.toList();
}

bool _isHumanSide(MatchState state, List<Player> players) => players.any((p) => p.id == state.humanId);

// ================= 9.5.3 حماية الزعيم =================
void _updateRegicide(MatchState state) {
  final R = _GM.m('regicide');
  final ms = modeOf(state);
  for (final player in _gangPlayers(state)) {
    if (player.fallen) continue;
    final leader = championOf(state, player.id);
    if (leader == null) { _fallLeader(state, player); continue; }
    // يتعالج داخل حيه المنزلي (مربعاته، أو الشوارع حول علمه)
    final home = player.homeDistrictId >= 0 && player.homeDistrictId < state.map.districts.length ? state.map.districts[player.homeDistrictId] : null;
    final district = state.map.districtOf(jsRoundD(leader.x), jsRoundD(leader.y));
    final atHome = home != null && (district == home ||
        (home.capture != null && hypot(leader.x - home.capture!.i, leader.y - home.capture!.j) <= R.d('homeHealRadius')));
    if (atHome && leader.hp < leader.maxHp) leader.hp = math.min(leader.maxHp, leader.hp + R.d('homeHealPerSecond') * TICK_SEC);
  }
  // زعيمك يُضرب: سهم أحمر على الحافة وصوت تنبيه
  final mine = state.humanId >= 0 ? championOf(state, state.humanId) : null;
  if (mine != null) {
    if (ms.lastHp != null && mine.hp < ms.lastHp! - 1e-6) _leaderHit(state, mine);
    ms.lastHp = mine.hp;
  }
  final arrow = state.alerts.where((a) => a.kind == 'leader').firstOrNull;
  if (arrow != null && mine != null) { arrow.i = jsRoundD(mine.x); arrow.j = jsRoundD(mine.y); }
}

void _leaderHit(MatchState state, Unit leader) {
  final R = _GM.m('regicide');
  final ms = modeOf(state);
  if (state.time - ms.alertAt >= R.d('hitAlertSeconds')) { ms.alertAt = state.time; sound('alert'); }
  if (onScreen(state, leader.x, leader.y)) return;
  final arrow = state.alerts.where((a) => a.kind == 'leader').firstOrNull;
  if (arrow != null) { arrow.life = R.d('hitAlertSeconds'); return; }
  if (state.alerts.length >= ALERTS.i('maxArrows')) {
    state.alerts.sort((a, b) => a.life.compareTo(b.life));
    state.alerts.removeAt(0);
  }
  state.alerts.add(Alert('leader', jsRoundD(leader.x), jsRoundD(leader.y), R.d('hitAlertSeconds')));
}

// سقط الزعيم: يخرج صاحبه فوراً، وتتلاشى وحداته خلال ثانية، وتصبح أحياؤه محايدة
void _fallLeader(MatchState state, Player player) {
  final R = _GM.m('regicide');
  final ms = modeOf(state);
  player.fallen = true;
  final human = state.humanId >= 0 ? state.players[state.humanId] : null;
  final body = state.units.where((u) => u.playerId == player.id && u.champion).firstOrNull;
  final killer = body != null && body.lastHitBy >= 0 ? state.players[body.lastHitBy] : null;
  if (human != null && killer != null && player.id != state.humanId && sideKey(killer) == sideKey(human)) ms.leaderKills++;
  for (final unit in state.units) {
    if (unit.playerId != player.id || unit.state == 'dead') continue;
    unit.fadeAt = state.time + random() * R.d('fadeSeconds');
  }
  for (final district in state.map.districts) {
    if (district.owner != player.id) continue;
    district.owner = null;
    district.progress = 0;
    district.progressOwner = null;
  }
  if (player.id != state.humanId) state.notice = Notice('سقط زعيم ${player.gangName}', false, 3);
}

// التلاشي: تموت الوحدات في لحظاتها المحددة بلا قاتل
void updateFades(MatchState state) {
  for (final unit in state.units) {
    if (!(unit.fadeAt >= 0) || unit.state == 'dead' || state.time < unit.fadeAt) continue;
    unit.hp = 0;
    unit.state = 'dead';
    unit.deathTimer = COMBAT.d('deathTime');
    unit.target = null;
    unit.path = [];
    unit.selected = false;
  }
}

// زعماء الأعداء الأحياء: تشير إليهم أسهم ذهبية على الحافة
List<(Unit, String)> enemyLeaders(MatchState state) {
  if (state.mode != 'regicide') return const [];
  final human = state.humanId >= 0 ? state.players[state.humanId] : null;
  return [
    for (final player in _gangPlayers(state))
      if (!player.fallen && player.id != state.humanId && !(human != null && sideKey(player) == sideKey(human)))
        if (championOf(state, player.id) case final leader?) (leader, player.color),
  ];
}

// ================= 9.5.5 الصمود ضد الشرطة (v2) =================
double nextWaveIn(MatchState state) => math.max(0, modeOf(state).nextWaveAt - state.time);
bool _isWaveUnit(Unit unit) => unit.wave > 0 && unit.state != 'dead';
int survivorId(MatchState state) => state.humanId >= 0 ? state.humanId : (state.settings['protagonistId'] as int? ?? -1);

J wavePhase(int n) {
  final phases = _GM.m('survival').l('phases');
  var phase = phases[0] as J;
  for (final p in phases) { if (n >= (p as J).d('from')) phase = p; }
  return phase;
}

bool isBossWave(int n) => n % _GM.m('survival').m('boss').i('every') == 0;

(double, double) waveSize(String level, int n) {
  final sz = _GM.m('survival').m('size');
  final z = sz.mm(level) ?? sz.m('medium');
  return (z.d('base') + z.d('per') * n, math.pow(z.d('growth'), n).toDouble());
}

double waveGap(String level, int n) {
  final S = _GM.m('survival');
  return math.max(S.m('minWaveSeconds').dn(level) ?? S.m('minWaveSeconds').d('medium'), S.d('waveSeconds') - S.d('waveSpeedup') * n);
}

void _updateSurvival(MatchState state) {
  final S = _GM.m('survival');
  final ms = modeOf(state);
  if (state.time >= ms.nextWaveAt) {
    ms.wave++;
    ms.nextWaveAt = state.time + waveGap(ms.level, ms.wave);
    _spawnWave(state, ms.wave);
  }
  if (state.time >= ms.retargetAt) {
    ms.retargetAt = state.time + S.d('retargetSeconds');
    _retargetWave(state);
  }
  final me = survivorId(state);
  if (me >= 0 && !isPlayerAlive(state, me)) _endSurvival(state);
}

List<String> _waveKinds(int n, double count) {
  final phase = wavePhase(n);
  final captains = truthy(phase['captainsPer']) ? math.max(1, (count / phase.d('captainsPer')).floor()) : 0;
  final riot = jsRound((count - captains) * phase.d('riotShare'));
  final kinds = [for (var k = 0; k < count; k++) k < captains ? 'captain' : k < captains + riot ? 'riot' : 'common'];
  if (isBossWave(n)) kinds.insert(0, 'boss');
  return kinds;
}

// وحدة شرطة للموجة بكل تعديلاتها (ونداء التعزيز عند قائد الشرطة)
Unit makeWaveUnit(MatchState state, String kind, int i, int j, int n, double factor) {
  final S = _GM.m('survival');
  final police = policePlayer(state)!;
  final unit = createUnit(state, police, i, j, kind == 'captain' || kind == 'boss' ? 'captain' : null);
  final level = modeOf(state).level;
  final stats = <String, Object?>{...unit.stats, 'capturePower': S.m('capturePower')[level] ?? S.m('capturePower')['medium']};
  var hp = stats.d('hp') * factor;
  if (kind == 'riot') {
    hp *= S.m('riot').d('hpFactor');
    stats['armor'] = S.m('riot')['armor'];
    unit.name = S.m('riot').s('name');
    unit.artColor = S.m('riot').s('color');
    unit.riot = true;
    final st = unit.style;
    unit.style = FightStyleInfo(st.turn, st.flank, st.moves, true, st.primary);
    unit.alwaysBlock = true;
  }
  if (kind == 'boss') {
    final B = S.m('boss');
    hp *= B.d('hpFactor');
    stats['aura'] = B['aura'];
    stats['ult'] = <String, Object?>{'kind': 'summon', 'needs': 'enemy', 'radius': B['summonRadius'], 'count': B['summon']};
    unit.name = B.s('name');
    unit.artScale = B.d('scale');
    unit.boss = true;
  }
  stats['hp'] = hp;
  stats['damage'] = stats.d('damage') * factor;
  unit.stats = stats;
  unit.maxHp = hp;
  unit.hp = hp;
  unit.wave = n;
  unit.waveFactor = factor;
  if (wavePhase(n).b('focusHeroes')) unit.focusHeroes = true;
  state.units.add(unit);
  return unit;
}

// نداء تعزيز قائد الشرطة: 4 شرطة فوراً حوله بنفس قوة موجته
void installSummonHook() => setSummonHook((state, boss, ult) {
  final spots = findFreeTiles(state.map, jsRoundD(boss.x), jsRoundD(boss.y), ult.i('count') * 2, ult.i('radius') + 2);
  for (var k = 0; k < ult.i('count') && k < spots.length; k++) {
    makeWaveUnit(state, 'common', spots[k].$1, spots[k].$2, boss.wave != 0 ? boss.wave : 1, boss.waveFactor != 0 ? boss.waveFactor : 1);
  }
});

void _spawnWave(MatchState state, int n) {
  final S = _GM.m('survival');
  if (policePlayer(state) == null) return;
  final (count, factor) = waveSize(modeOf(state).level, n);
  final phase = wavePhase(n);
  final sources = _waveSources(state, phase.i('fronts'));
  if (sources.isEmpty) return;
  final groups = [for (final _ in sources) <String>[]];
  final kinds = _waveKinds(n, count);
  for (var k = 0; k < kinds.length; k++) { groups[k % sources.length].add(kinds[k]); }
  for (var s = 0; s < sources.length; s++) {
    final source = sources[s];
    final spots = findFreeTiles(state.map, source.$1, source.$2, math.max(S.i('spawnSpread'), groups[s].length));
    if (spots.isEmpty) continue;
    final units = [
      for (var k = 0; k < groups[s].length; k++)
        makeWaveUnit(state, groups[s][k], spots[k % spots.length].$1, spots[k % spots.length].$2, n, factor),
    ];
    final weakest = phase.b('weakest') && s == sources.length - 1;
    final target = weakest ? _weakestTarget(state) : _waveTarget(state, source.$1.toDouble(), source.$2.toDouble());
    if (target == null || units.isEmpty) continue;
    final behind = phase.b('focusHeroes') ? units.where((u) => u.hero == 'captain' && !u.boss).toList() : <Unit>[];
    final front = units.where((u) => !behind.contains(u)).toList();
    if (front.isNotEmpty) commandAttackMove(state, target.$1.toDouble(), target.$2.toDouble(), front, false);
    if (behind.isNotEmpty) {
      final dx = target.$1 - source.$1, dy = target.$2 - source.$2;
      var len = hypot(dx.toDouble(), dy.toDouble());
      if (len == 0) len = 1;
      commandAttackMove(state, target.$1 - dx / len * S.d('captainsBehind'), target.$2 - dy / len * S.d('captainsBehind'), behind, false);
    }
  }
  state.notice = Notice(isBossWave(n) ? 'الموجة $n: ${S.m('boss').s('name')}!' : 'الموجة $n: ${phase.s('name')}', false, S.d('noticeSeconds'));
  sound('alert');
  sound('whistle');
}

// المصادر: مراكز الشرطة وحواف الخريطة؛ الجبهات من اتجاهات متباعدة قدر الإمكان
List<(int, int)> _waveSources(MatchState state, int fronts) {
  final S = _GM.m('survival');
  final map = state.map;
  final all = <(int, int)>[for (final d in policeStations(state)) if (d.capture != null) (d.capture!.i, d.capture!.j)];
  final last = map.n - 1, mid = map.n ~/ 2;
  for (final (ei, ej) in [(mid, 0), (mid, last), (0, mid), (last, mid), (0, 0), (last, last), (0, last), (last, 0)]) {
    final spot = findFreeTiles(map, ei, ej, 1, S.i('edgeSearchTiles'));
    if (spot.isNotEmpty) all.add(spot[0]);
  }
  if (all.isEmpty) return const [];
  final chosenIdx = <int>[(random() * all.length).floor()];
  while (chosenIdx.length < fronts && chosenIdx.length < all.length) {
    int? best;
    var bestD = -1.0;
    for (var c = 0; c < all.length; c++) {
      if (chosenIdx.contains(c)) continue;
      var d = double.infinity;
      for (final x in chosenIdx) { d = math.min(d, hypot((all[x].$1 - all[c].$1).toDouble(), (all[x].$2 - all[c].$2).toDouble())); }
      if (d > bestD) { bestD = d; best = c; }
    }
    chosenIdx.add(best!);
  }
  return [for (final k in chosenIdx) all[k]];
}

(int, int)? _waveTarget(MatchState state, double i, double j) {
  (int, int)? best;
  var bestDist = double.infinity;
  for (final d in state.map.districts) {
    if (d.capture == null || d.police || d.owner == null || state.players[d.owner!].neutral) continue;
    final dist = hypot(d.capture!.i - i, d.capture!.j - j);
    if (dist < bestDist) { bestDist = dist; best = (d.capture!.i, d.capture!.j); }
  }
  if (best != null) return best;
  for (final unit in state.units) {
    if (unit.state == 'dead' || state.players[unit.playerId].neutral) continue;
    final dist = hypot(unit.x - i, unit.y - j);
    if (dist < bestDist) { bestDist = dist; best = (jsRoundD(unit.x), jsRoundD(unit.y)); }
  }
  return best;
}

(int, int)? _weakestTarget(MatchState state) {
  (int, int)? best;
  var fewest = double.infinity;
  for (final d in state.map.districts) {
    if (d.capture == null || d.police || d.owner == null || state.players[d.owner!].neutral) continue;
    var defenders = 0;
    for (final u in state.units) {
      if (u.state == 'dead' || state.players[u.playerId].neutral) continue;
      if (hypot(u.x - d.capture!.i, u.y - d.capture!.j) <= 5) defenders++;
    }
    if (defenders < fewest) { fewest = defenders.toDouble(); best = (d.capture!.i, d.capture!.j); }
  }
  return best ?? _waveTarget(state, state.map.n / 2, state.map.n / 2);
}

// شرطة الموجة الواقفة: تبقى إن كانت تستولي على حي، وإلا تزحف نحو هدف جديد
void _retargetWave(MatchState state) {
  final police = policePlayer(state);
  if (police == null) return;
  final map = state.map;
  final orders = <String, ((int, int), List<Unit>)>{};
  for (final unit in state.units) {
    if (!_isWaveUnit(unit) || unit.state != 'idle') continue;
    final ids = map.zoneAt[map.idx(jsRoundD(unit.x), jsRoundD(unit.y))] ?? const <int>[];
    final capturing = ids.any((id) { final d = map.districts[id]; return !d.police && d.owner != police.id; });
    if (capturing) continue;
    final target = _waveTarget(state, unit.x, unit.y);
    if (target == null) continue;
    orders.putIfAbsent('${target.$1},${target.$2}', () => (target, <Unit>[])).$2.add(unit);
  }
  for (final (target, units) in orders.values) {
    commandAttackMove(state, target.$1.toDouble(), target.$2.toDouble(), units, false);
  }
}

void _endSurvival(MatchState state) {
  final ms = modeOf(state);
  final best = loadSurvivalBest(ms.level);
  final mine = SurvivalRecord(ms.wave, state.time.floor());
  final newRecord = best == null || mine.waves > best.waves || (mine.waves == best.waves && mine.seconds > best.seconds);
  if (newRecord) _saveSurvivalBest(ms.level, mine);
  ms.record = (newRecord ? mine : best, newRecord);
  final record = newRecord ? 'رقم قياسي جديد: الموجة ${mine.waves}!' : 'رقمك القياسي: الموجة ${best.waves}';
  finish(state, false, 'خسرت كل جنودك وأحيائك أمام الشرطة • $record');
}

String _recordKey(String level) => '${_GM.m('survival').s('recordKey')}.$level';

SurvivalRecord? loadSurvivalBest(String level) {
  final d = Prefs.read(_recordKey(level));
  final w = d?['waves'], s = d?['seconds'];
  return w is num && w.isFinite ? SurvivalRecord(w.toInt(), (s as num? ?? 0).toInt()) : null;
}

void _saveSurvivalBest(String level, SurvivalRecord r) => Prefs.write(_recordKey(level), {'waves': r.waves, 'seconds': r.seconds});

int _policeAlive(MatchState state) => state.units.where((u) => u.state != 'dead' && state.players[u.playerId].gang == 'police').length;

// ================= الواجهة =================
String modeClock(double seconds) {
  final s = math.max(0, seconds.ceil());
  return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
}

class ModeBar {
  final String text;
  final bool alarm;
  final List<(String, double, bool)> bars;   // اللون والنسبة وهل هو جانبك
  const ModeBar(this.text, this.alarm, [this.bars = const []]);
}

// شريط أعلى وسط الشاشة: ما يخص الطور، ثم ميزة المدينة حين تعني شيئاً الآن (والقصة في ن9)
ModeBar? modeBar(MatchState state) {
  final bar = _modeOnlyBar(state);
  final feature = state.economy ? featureBar(state) : null;
  if (feature == null) return bar;
  return bar != null ? ModeBar('${bar.text} • ${feature.$1}', bar.alarm || feature.$2, bar.bars) : ModeBar(feature.$1, feature.$2);
}

ModeBar? _modeOnlyBar(MatchState state) {
  if (state.mode == 'points') return ModeBar(modeClock(pointsRemaining(state)), isFinalMinute(state));
  if (state.mode == 'king') {
    final ms = modeOf(state);
    final sides = kingSides(state);
    final mine = sides.where((s) => _isHumanSide(state, s.players)).firstOrNull;
    final top = sides.fold<double>(0, (m, s) => math.max(m, s.held));
    return ModeBar('👑 ${modeClock(mine?.held ?? 0)} / ${modeClock(ms.target)}', ms.target - top <= _GM.m('king').d('warnSeconds'),
        [for (final s in sides) (s.color, s.held / ms.target, _isHumanSide(state, s.players))]);
  }
  if (state.mode == 'survival') {
    final ms = modeOf(state);
    final left = nextWaveIn(state);
    return ModeBar(ms.wave > 0 ? 'الموجة ${ms.wave} (${wavePhase(ms.wave).s('name')}) • التالية بعد ${modeClock(left)}'
        : 'الموجة الأولى بعد ${modeClock(left)}', left <= _GM.m('survival').d('alarmSeconds'));
  }
  return null;
}

// قيمة كل لاعب في شريط القوة حسب الطور (powerColumn): نص يُعرض، ورقم للترتيب، وشريط اختياري
class PowerColumn {
  final double Function(int) value;
  final String Function(double) show;
  final double Function(int)? bar;
  final bool teamAverage;
  final List<(String, String)> summary;
  const PowerColumn(this.value, this.show, {this.bar, this.teamAverage = false, this.summary = const []});
}

PowerColumn? powerColumn(MatchState state) {
  if (state.economy && (state.mode == 'points' || state.mode == 'conquest')) {
    final points = state.mode == 'points' ? state.empire!.earned : state.empire!.points;
    return PowerColumn((id) => points[id], (v) => '${v.floor()}', teamAverage: true);
  }
  if (state.mode == 'regicide') {
    final counts = [for (final _ in state.players) 0];
    for (final d in state.map.districts) { if (d.owner != null) counts[d.owner!]++; }
    return PowerColumn((id) => counts[id].toDouble(), (v) => '${v.toInt()}', bar: (id) {
      final leader = championOf(state, id);
      return leader != null ? leader.hp / leader.maxHp : 0;
    });
  }
  if (state.mode == 'king') {
    final held = modeOf(state).held;
    return PowerColumn((id) => held[id], modeClock);
  }
  if (state.mode == 'survival') {
    return PowerColumn((_) => 0, (_) => '', summary: [('الموجة', '${modeOf(state).wave}'), ('الشرطة الأحياء', '${_policeAlive(state)}')]);
  }
  return null;
}

// بطاقات إضافية في شاشة النهاية: ما يخص الطور، ثم ما جمعته من نقاط والزعماء الذين أسقطتهم
List<(String, String)> modeExtras(MatchState state) {
  final extras = _modeOnlyExtras(state);
  final e = state.empire;
  if (!state.economy || e == null || state.humanId < 0) return extras;
  final me = state.humanId;
  if (state.mode != 'points') extras.add(('نقاط جمعتها', '${e.earned[me].floor()}'));
  if (state.mode != 'regicide') extras.add(('زعماء أسقطتهم', '${e.bounties[me]}'));
  return extras;
}

List<(String, String)> _modeOnlyExtras(MatchState state) {
  if (state.mode == 'points') {
    final human = state.humanId >= 0 ? state.players[state.humanId] : null;
    final mine = human == null ? null : sideTotals(state).where((s) => s.key == sideKey(human)).firstOrNull;
    return [('نقاطك', '${mine?.points.floor() ?? 0}')];
  }
  if (state.mode == 'king') {
    final mine = kingSides(state).where((s) => _isHumanSide(state, s.players)).firstOrNull;
    return [('زمنك على التلة', modeClock(mine?.held ?? 0))];
  }
  if (state.mode == 'regicide') return [('زعماء أسقطتهم', '${modeOf(state).leaderKills}')];
  if (state.mode == 'survival') {
    final ms = modeOf(state);
    final best = ms.record?.$1 ?? loadSurvivalBest(ms.level);
    return [('وصلت إلى الموجة', '${ms.wave}'), ('رقمك القياسي (${BOT.m(ms.level).s('name')})', '${best?.waves ?? ms.wave}')];
  }
  return [];
}
