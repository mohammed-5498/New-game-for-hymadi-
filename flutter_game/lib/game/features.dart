// مزايا المدن (القسم 3.11، منقول سطراً بسطر من js/game/features.js): ميزة لكل مدينة في كل مباراة على الاقتصاد،
// ومبنى مدن الأحداث (12هـ)، وأحداث مدن المباني (12و-12ح)، والمخلوقات. الأرقام كلها في CITY_FEATURES
import 'dart:math' as math;

import '../audio/sound.dart';
import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../map/generator.dart';
import '../map/pathfinding.dart';
import '../map/sizes.dart';
import 'combat.dart';
import 'empire.dart';
import 'realism.dart';
import 'spatial.dart';
import 'state.dart';
import 'units.dart';

final J F = CITY_FEATURES;
bool _alive(Unit u) => u.state != 'dead' && u.hp > 0;
int _tickOf(MatchState s) => jsRound(s.time / TICK_SEC);
int _ticks(num seconds) => jsRound(seconds / TICK_SEC);
String? _cityNation(String city) {
  for (final id in nations.l('order').cast<String>()) { if (nations.m(id).s('city') == city) return id; }
  return null;
}
J? _cfg(String key) => F.mm(key);
void _gain(MatchState s, int pid, num v) { s.empire!.points[pid] += v; s.empire!.earned[pid] += v; }
Player? _policeOf(MatchState s) { for (final p in s.players) { if (p.gang == 'police') return p; } return null; }
Unit _by(int pid) => Unit.source(pid);
void _kill(Unit u) { u.hp = 0; u.state = 'dead'; u.deathTimer = 0; u.path = []; u.target = null; }

String? cityFeature(String city) => F.m('cities').ss(city);

// --- الطرف المحايد الذي تحتاجه الميزة (يُضاف بعد الشرطة)، وnull لغيرها ---
const _raiders = ['bandits', 'coups', 'cartel'];
Player? createFeaturePlayer(List<Player> players, String? feature, String city) {
  final ev = F.m('events').ss(city);
  if (feature != null && ['knight', 'carnival', 'derby'].contains(ev)) feature = ev;
  const kinds = ['villages', 'dojo', 'fortress', 'bandits', 'coups', 'cartel', 'caravan', 'fireworks', 'troll', 'knight', 'carnival', 'derby'];
  final cfg = feature != null && kinds.contains(feature) ? _cfg(feature) : null;
  if (cfg == null) return null;
  final nation = feature == 'bandits' ? _cityNation(city) : cfg.ss('nation');
  if (nation == null || nations.mm(nation) == null) return null;
  final police = players.firstWhere((p) => p.gang == 'police');
  return Player(id: players.length, name: cfg.s('name'), gang: nations.m(nation).s('style'), nation: nation, gangName: cfg.s('name'),
      color: cfg.s('color'))
    ..neutral = true
    ..passive = ['villages', 'carnival', 'derby'].contains(feature)
    ..captures = _raiders.contains(feature)
    ..friendOf = feature == 'caravan' || feature == 'troll' || feature == 'knight' ? police.id : -1
    ..ownOnly = feature == 'cartel'
    ..feature = feature;
}

Player? featurePlayer(MatchState s) { for (final p in s.players) { if (p.feature != null) return p; } return null; }

// مالك مبنى مدينة الأحداث key (12هـ): رقم لاعب من العصابات، أو −1
int buildingOwner(MatchState s, String key) {
  if (F.m('buildings').ss(s.map.city) != key) return -1;
  for (final d in s.map.districts) {
    if (d.feature == key && d.owner != null && d.featureTile != null) return s.players[d.owner!].neutral ? -1 : d.owner!;
  }
  return -1;
}

// وسط مبنى الميزة بالمربعات: وسط كتلته 2×2، أو مربعه الوحيد
(double, double) featureCenter(GameMap map, District d) {
  final at = tileOf(map, d.featureTile!);
  return d.featureBig ? (at.i - 0.5, at.j - 0.5) : (at.i.toDouble(), at.j.toDouble());
}

void _boost(Unit unit, J? extra, [double mul = 1]) {
  final s = <String, Object?>{...unit.stats, ...?extra};
  if (mul != 1) {
    s['hp'] = s.d('hp') * mul;
    s['damage'] = s.d('damage') * mul;
    if (truthy(s['meleeDamage'])) s['meleeDamage'] = s.d('meleeDamage') * mul;
  }
  unit.stats = s;
  unit.maxHp = s.d('hp');
  unit.hp = s.d('hp');
}

// --- البداية ---
void initFeatures(MatchState s) {
  if (s.feature == 'villages') _initVillages(s);
  if (s.feature == 'cartel') _initCartel(s);
  if (F.m('events').ss(s.map.city) == 'nile') _markBanks(s.map);
  for (final d in s.map.districts) {
    if (d.capture == null || d.featureTile == null) continue;
    d.cool = 0;
    if (d.feature == 'dojo') {
      for (var k = 0; k < F.m('dojo').i('start'); k++) { _spawnGuard(s, d, F.m('dojo')); }
      d.nextAt = F.m('dojo').d('every');
    } else if (d.feature == 'fortress') {
      for (var k = 0; k < F.m('fortress').i('guards'); k++) { _spawnGuard(s, d, F.m('fortress')); }
    }
  }
}

// --- كل تحديث ---
void updateFeatures(MatchState s) {
  if (s.feature == null) return;
  final building = F.m('buildings').ss(s.map.city);
  if (!s.featureHinted && s.empireHinted && s.notice == null) {
    s.featureHinted = true;
    s.notice = Notice('ميزة المدينة — ${F.m('desc').s(s.feature!)}', true, F.d('hintSeconds'));
  } else if (s.featureHinted && !s.buildingHinted && s.notice == null && building != null) {
    s.buildingHinted = true;
    s.notice = Notice('مبنى المدينة — ${F.m('desc').s(building)}', true, F.d('hintSeconds'));
  } else if (s.featureHinted && !s.eventHinted && s.notice == null && cityEvent(s) != null) {
    s.eventHinted = true;
    s.notice = Notice('حدث المدينة — ${F.m('desc').s(cityEvent(s)!)}', true, F.d('hintSeconds'));
  }
  _updateCityEvent(s);
  switch (s.feature) {
    case 'storm': _stormNotices(s);
    case 'villages': _joinVillagers(s);
    case 'dojo': _updateDojo(s); _vanishGuards(s);
    case 'fortress': _updateFortresses(s); _vanishGuards(s);
    case 'khartoum': _updateKhartoum(s);
    case 'clinic': _updateClinics(s);
    case 'bandits': _updateBandits(s);
    case 'coups': _updateCoups(s);
    case 'cartel': _updateCartel(s);
    case 'caravan': _updateCaravan(s);
    case 'fireworks': _updateFireworks(s);
    case 'triads': _expireTriads(s);
    case 'elephants': _trample(s);
    case 'troll': _updateTroll(s);
    case 'mine': _updateMine(s);
    case 'bank': _updateBank(s);
  }
}

// ================= العاصفة الرملية (الدرعية) =================
typedef Window = ({bool on, double left, double since});
Window windowAt(double time, double first, double every, double duration) {
  final n = ((time - first) / every).floor();
  final start = first + n * every;
  if (n >= 0 && time - start < duration) return (on: true, left: start + duration - time, since: time - start);
  return (on: false, left: (n < 0 ? first : start + every) - time, since: 0);
}

Window stormAt(double time) { final S = F.m('storm'); return windowAt(time, S.d('first'), S.d('every'), S.d('duration')); }
bool stormActive(MatchState s) => s.feature == 'storm' && stormAt(s.time).on;
bool _stormHits(MatchState s, int pid) => stormActive(s) && !(pid >= 0 && buildingOwner(s, 'salwa') == pid);

double rangeMul(MatchState s, int pid) => (_stormHits(s, pid) ? F.m('storm').d('rangeMul') : 1) *
    (pid >= 0 && buildingOwner(s, 'observatory') == pid ? F.m('observatory').d('rangeMul') : 1) *
    (cityEvent(s) == 'typhoon' && eventWindow('typhoon', s.time).on ? F.m('typhoon').d('rangeMul') : 1);

double stormDamageMul(MatchState s, int pid) => _stormHits(s, pid) ? 1 - F.m('storm').d('miss') : 1;
bool stormMiss(MatchState s, int pid) => _stormHits(s, pid) && random() < F.m('storm').d('miss');

void _stormNotices(MatchState s) {
  final S = F.m('storm'), now = stormAt(s.time), before = stormAt(s.time - TICK_SEC);
  if (now.on && !before.on) {
    s.notice = Notice('عاصفة رملية! مدى الرماة أقل، والضربات تخطئ', false, 4);
  } else if (!now.on && before.on) {
    s.notice = Notice('انتهت العاصفة الرملية', false, 3);
  } else if (!now.on && now.left <= S.d('warn') && before.left > S.d('warn')) {
    s.notice = Notice('عاصفة رملية بعد ${S.i('warn')} ثوانٍ!', false, 3);
    sound('alert');
  }
}

String _clock(double seconds) {
  final t = math.max(0, seconds.ceil());
  return '${t ~/ 60}:${(t % 60).toString().padLeft(2, '0')}';
}

// سطر شريط الطور لميزة المدينة: (النص، تنبيه) أو null
(String, bool)? featureBar(MatchState s) {
  final ev = cityEvent(s);
  if (ev != null) { final bar = _eventBar(s, ev); if (bar != null) return bar; }
  if (s.feature == 'storm') {
    final now = stormAt(s.time);
    if (now.on) return ('عاصفة رملية ${_clock(now.left)}', true);
    return now.left <= F.m('storm').d('duration') ? ('عاصفة بعد ${_clock(now.left)}', now.left <= F.m('storm').d('warn')) : null;
  }
  if (s.feature == 'fireworks') {
    final pending = s.fireworks.where((f) => !f.done).firstOrNull;
    if (pending != null) {
      return ('${pending.owner != null ? 'صاروخ البارود! ابتعد عن الدائرة ' : 'ألعاب نارية! ابتعد عن الدوائر '}${_clock((pending.at - _tickOf(s)) * TICK_SEC)}', true);
    }
  }
  if (s.feature == 'caravan' && s.mode != 'survival' && s.units.any((u) => u.cargo && _alive(u))) return ('قافلة في المدينة', false);
  if (s.feature == 'troll' && s.mode != 'survival' && s.units.any((u) => u.creature == 'troll' && _alive(u))) return ('ترول الجبل في المدينة!', true);
  final name = _eventNames[s.feature];
  if (name != null && (s.feature == 'fireworks' || s.mode != 'survival')) {
    final B = F.m(s.feature!);
    final left = s.time < B.d('first') ? B.d('first') - s.time : B.d('every') - ((s.time - B.d('first')) % B.d('every'));
    return left <= 30 ? ('$name بعد ${_clock(left)}', left <= 10) : null;
  }
  return null;
}
const _eventNames = {'bandits': 'قطاع الطرق', 'coups': 'انقلاب', 'caravan': 'قافلة', 'fireworks': 'ألعاب نارية', 'troll': 'ترول الجبل'};

// ================= القرى المحايدة (شبام) =================
void _initVillages(MatchState s) {
  final player = featurePlayer(s);
  if (player == null) return;
  final people = F.m('villages').l('people'), low = (people[0] as num).toInt(), high = (people[1] as num).toInt();
  for (final d in s.map.districts) {
    if (d.feature != 'village' || d.capture == null) continue;
    final count = low + (random() * (high - low + 1)).floor();
    for (final (i, j) in findFreeTiles(s.map, d.capture!.i, d.capture!.j, count)) {
      final unit = createUnit(s, player, i, j);
      unit.villageId = d.id;
      s.units.add(unit);
    }
  }
}

void _joinVillagers(MatchState s) {
  for (final d in s.map.districts) {
    if (d.feature != 'village' || d.villageJoined || d.owner == null || s.players[d.owner!].neutral) continue;
    d.villageJoined = true;
    final owner = s.players[d.owner!];
    var joined = 0;
    for (final unit in s.units) {
      if (unit.villageId != d.id || !_alive(unit)) continue;
      unit.villageId = -1;
      unit.playerId = owner.id;
      unit.color = owner.color;
      applyUpgrades(s, unit);
      joined++;
    }
    if (joined > 0 && owner.id == s.humanId) {
      s.notice = Notice('انضم إليك $joined من ${F.m('villages').s('name')}', true, 3);
      sound('spawn');
    }
  }
}

bool villageWaiting(District d) => d.feature == 'village' && !d.villageJoined;

double? featureValue(District d) {
  if (d.feature == null || (d.feature == 'village' && d.villageJoined)) return null;
  if (d.feature == 'bank') return F.m('botValue').d('bank') + d.vault / F.m('bank').d('botPer');
  final v = F.m('botValue')[d.feature];
  return truthy(v) ? (v as num).toDouble() : null;
}

// ================= الهرم (القاهرة) =================
double? featureIncome(District d) => d.feature == 'pyramid' ? F.m('pyramid').d('income') : d.feature == 'mine' ? d.mineRate
    : d.feature == 'bank' ? F.m('bank').d('fee') : d.feature == 'salwa' ? F.m('salwa').d('income') : null;

class FeatureZone {
  final int owner;
  final double x, y, r2;
  const FeatureZone(this.owner, this.x, this.y, this.r2);
}

List<FeatureZone>? _zonesOf(MatchState s, String key) {
  if (s.feature != key) return null;
  List<FeatureZone>? zones;
  final r = F.m(key).d('radius');
  for (final d in s.map.districts) {
    if (d.feature != key || d.owner == null || d.featureTile == null || s.players[d.owner!].neutral) continue;
    final (x, y) = featureCenter(s.map, d);
    (zones ??= []).add(FeatureZone(d.owner!, x, y, r * r));
  }
  return zones;
}

List<FeatureZone>? pyramidZones(MatchState s) => _zonesOf(s, 'pyramid');

double pyramidTaken(List<FeatureZone> zones, Unit unit) {
  for (final z in zones) {
    if (z.owner != unit.playerId) continue;
    final dx = unit.x - z.x, dy = unit.y - z.y;
    if (dx * dx + dy * dy <= z.r2) return 1 - F.m('pyramid').d('damageTaken');
  }
  return 1;
}

// ================= الحراس المحايدون =================
bool _spawnGuard(MatchState s, District d, J cfg) {
  final player = featurePlayer(s);
  if (player == null) return false;
  final spots = findFreeTiles(s.map, d.capture!.i, d.capture!.j, 6);
  if (spots.isEmpty) return false;
  final (i, j) = spots[(random() * spots.length).floor()];
  final unit = createUnit(s, player, i, j, cfg.ss('hero'));
  _boost(unit, cfg.mm('stats'));
  unit.lookKind = cfg.ss('look');
  final (cx, cy) = featureCenter(s.map, d);
  unit.garrisonOf = d.id;
  unit.homePost = Point2(cx, cy);
  s.units.add(unit);
  return true;
}

int _countGuards(MatchState s, int id) => s.units.where((u) => u.garrisonOf == id && _alive(u)).length;

void _releaseGuards(MatchState s, District d, double seconds) {
  d.garrisonOff = true;
  for (final unit in s.units) {
    if (unit.garrisonOf == d.id && _alive(unit)) unit.vanishAt = s.time + random() * seconds;
  }
}

void _vanishGuards(MatchState s) {
  for (final unit in s.units) {
    if (unit.garrisonOf < 0 || unit.vanishAt < 0 || s.time < unit.vanishAt || !_alive(unit)) continue;
    unit.hp = 0;
    unit.state = 'dead';
    unit.deathTimer = COMBAT.d('deathTime');
    unit.target = null;
    unit.path = [];
  }
}

// ================= دوجو الساموراي (إيدو) =================
void _updateDojo(MatchState s) {
  final D = F.m('dojo');
  for (final d in s.map.districts) {
    if (d.feature != 'dojo' || d.capture == null || d.featureTile == null) continue;
    if (d.owner != null && !d.garrisonOff) {
      _releaseGuards(s, d, D.d('vanishSeconds'));
      if (d.owner == s.humanId) s.notice = Notice('استوليت على الدوجو: جنودك +${jsRound(D.d('damageBonus') * 100)}% ضرر', true, 4);
    }
    if (d.garrisonOff || s.time < d.nextAt) continue;
    if (_countGuards(s, d.id) < D.i('max')) _spawnGuard(s, d, D);
    d.nextAt = s.time + D.d('every');
  }
}

double featureDamageBonus(MatchState s, int pid) {
  if (s.feature != 'dojo') return 0;
  for (final d in s.map.districts) { if (d.feature == 'dojo' && d.owner == pid) return F.m('dojo').d('damageBonus'); }
  return 0;
}

// ================= أبراج المزايا: الحصن وبرج الخرطوم =================
({double range, double damage, double attackTime}) featureTowerStats(District d, [MatchState? s]) {
  final size = sizeOf(d), range = DISTRICT_SIZES.m('reach').d(size) * (s != null ? rangeMul(s, d.owner ?? -1) : 1);
  final power = DISTRICT_SIZES.m('power').d(size);
  if (d.feature == 'fortress') {
    final T = F.m('fortress').m('tower');
    return (range: T.d('range') * range, damage: T.d('damage') * power, attackTime: T.d('attackTime'));
  }
  final T = EMPIRE.m('buildings').m('tower'), K = F.m('khartoum');
  return (range: K.d('range') * range, damage: T.d('damage') * K.d('damageMul') * power, attackTime: T.d('attackTime') / K.d('rateMul'));
}

void _shoot(MatchState s, District d, int shooter, double top) {
  if (d.cool > 0) { d.cool -= TICK_SEC; return; }
  final stats = featureTowerStats(d, s);
  final (ci, cj) = featureCenter(s.map, d);
  Unit? best;
  var bestD = stats.range;
  forEachNearby(s, ci, cj, stats.range, (unit) {
    if (!_alive(unit) || !isEnemyId(s, shooter, unit.playerId)) return;
    final dist = hypot(unit.x - ci, unit.y - cj);
    if (dist <= bestD) { bestD = dist; best = unit; }
  });
  if (best == null) return;
  d.cool = stats.attackTime;
  s.empire!.shots.add(TowerShot(shooter, best!, ci, cj, EMPIRE.m('arrow').d('flight'), stats.damage, top));
  soundAt(s, 'arrow', ci, cj);
}

void _updateFortresses(MatchState s) {
  final guards = featurePlayer(s);
  for (final d in s.map.districts) {
    if (d.feature != 'fortress' || d.capture == null || d.featureTile == null) continue;
    if (d.owner != null && !d.garrisonOff) {
      _releaseGuards(s, d, F.m('fortress').d('vanishSeconds'));
      if (d.owner == s.humanId) s.notice = Notice('استوليت على الحصن: جنّد أبطال عدوة من قائمته', true, 4);
    }
    final shooter = d.owner == null ? guards?.id : s.players[d.owner!].neutral ? null : d.owner;
    if (shooter != null) _shoot(s, d, shooter, F.m('fortress').d('top') - 8);
  }
}

void _updateKhartoum(MatchState s) {
  for (final d in s.map.districts) {
    if (d.feature != 'khartoum' || d.owner == null || d.featureTile == null || s.players[d.owner!].neutral) continue;
    _shoot(s, d, d.owner!, F.m('khartoum').d('top') - 10);
  }
}

double featureCaptureMul(District d) {
  final c = d.feature != null ? F.mm(d.feature!) : null;
  return c != null && truthy(c['captureMul']) ? c.d('captureMul') : 1;
}

// ================= دار العلاج (كايفنغ) =================
({double radius, double perSecond}) clinicStats(District d) =>
    (radius: F.m('clinic').d('radius') * DISTRICT_SIZES.m('reach').d(sizeOf(d)), perSecond: F.m('clinic').d('perSecond') * DISTRICT_SIZES.m('power').d(sizeOf(d)));

void _updateClinics(MatchState s) {
  for (final d in s.map.districts) {
    if (d.feature != 'clinic' || d.owner == null || d.featureTile == null || s.players[d.owner!].neutral) continue;
    final (ci, cj) = featureCenter(s.map, d);
    final C = clinicStats(d), amount = C.perSecond * TICK_SEC, r2 = C.radius * C.radius;
    forEachNearby(s, ci, cj, C.radius, (unit) {
      if (unit.playerId != d.owner || !_alive(unit) || unit.hp >= unit.maxHp) return;
      final dx = unit.x - ci, dy = unit.y - cj;
      if (dx * dx + dy * dy <= r2) unit.hp = math.min(unit.maxHp, unit.hp + amount);
    });
  }
}

// ================= التجنيد في المباني المميزة =================
List<String>? recruitsAt(District? d) {
  if (d == null || d.featureTile == null || d.feature == null) return null;
  final c = F.mm(d.feature!);
  return c != null && c['recruits'] != null ? c.l('recruits').cast<String>() : null;
}

bool spawnRecruit(MatchState s, Player player, District d, String kind) {
  final R = F.m('recruits').m(kind);
  final spots = findFreeTiles(s.map, d.capture!.i, d.capture!.j, SPAWN.i('spotSearchTiles'));
  if (spots.isEmpty) return false;
  final (i, j) = spots[(random() * spots.length).floor()];
  final creature = R.ss('creature');
  final unit = creature != null ? createUnit(s, player, i, j)
      : createUnit(s, player, i, j, R.ss('hero'), false, nations.m(R.s('nation')).s('style'), R.s('nation'));
  if (R.mm('stats') != null) _boost(unit, R.m('stats'));
  if (R.ss('name') != null) unit.name = R.s('name');
  if (R.ss('look') != null) unit.lookKind = R.s('look');
  if (creature != null) _makeCreature(unit, creature, R.d('scale'), R.d('barY'));
  unit.recruitKind = kind;
  s.units.add(unit);
  applyUpgrades(s, unit);
  soundAt(s, 'spawn', i.toDouble(), j.toDouble());
  return true;
}

// ================= قطاع الطرق (غيونغجو وكانو) =================
void _updateBandits(MatchState s) {
  if (s.mode == 'survival') return;
  final B = F.m('bandits'), tick = _tickOf(s), first = _ticks(B.d('first')), every = _ticks(B.d('every'));
  if (tick >= first && (tick - first) % every == 0) _spawnBandits(s, (tick - first) ~/ every + 1);
  if (tick % _ticks(B.d('think')) == 0) _thinkBandits(s);
}

void _spawnBandits(MatchState s, int wave) {
  final B = F.m('bandits'), player = featurePlayer(s), map = s.map;
  if (player == null) return;
  final count = math.min(B.i('maxCount'), B.i('count') + B.i('perWave') * (wave - 1));
  final mul = 1 + B.d('grow') * (wave - 1);
  final spots = findFreeTiles(map, jsRound((map.land - 1) / 2), jsRound((map.n - 1) / 2), count);
  for (var k = 0; k < spots.length; k++) {
    final hero = wave >= B.i('heroFrom') && k % B.i('heroEvery') == B.i('heroEvery') - 1 ? heroFor(player, 'strong') : null;
    final unit = createUnit(s, player, spots[k].$1, spots[k].$2, hero);
    _boost(unit, null, mul);
    s.units.add(unit);
  }
  if (spots.isNotEmpty) {
    s.notice = Notice('${B.s('name')} ظهروا في وسط المدينة! (الموجة $wave)', false, 4);
    sound('alert');
  }
}

void _thinkBandits(MatchState s) {
  final player = featurePlayer(s);
  if (player == null) return;
  final free = s.units.where((u) => u.playerId == player.id && _alive(u) && u.state == 'idle').toList();
  final caps = F.m('bandits').m('cap');
  _raid(s, player, free, caps.dn(s.settings.ss('mapSize') ?? '') ?? caps.d('medium'), null);
}

void _raid(MatchState s, Player player, List<Unit> free, double cap, (double, double, double)? near) {
  if (free.isEmpty) return;
  final map = s.map;
  final held = map.districts.where((d) => d.owner == player.id && d.capture != null).toList();
  var cx = 0.0, cy = 0.0;
  for (final u in free) { cx += u.x; }
  cx /= free.length;
  for (final u in free) { cy += u.y; }
  cy /= free.length;
  bool inside(District d) => near == null || hypot(d.capture!.i - near.$1, d.capture!.j - near.$2) <= near.$3;
  District? target;
  if (held.length < cap) {
    final next = <int>{for (final d in held) ...d.adj};
    var bestScore = double.infinity;
    for (final d in map.districts) {
      if (d.capture == null || d.owner == player.id || d.police || d.building == 'hq' || d.hill || !inside(d)) continue;
      final score = hypot(d.capture!.i - cx, d.capture!.j - cy) - (next.contains(d.id) ? 6 : 0);
      if (score < bestScore) { bestScore = score; target = d; }
    }
  }
  if (target == null) {
    final mine = held.where(inside).toList();
    target = mine.where((d) => d.progress < 100).firstOrNull;
    if (target == null) {
      for (final b in mine) {
        if (target == null || hypot(b.capture!.i - cx, b.capture!.j - cy) < hypot(target.capture!.i - cx, target.capture!.j - cy)) target = b;
      }
    }
  }
  if (target == null) return;
  final ti = target.capture!.i, tj = target.capture!.j;
  final go = free.where((u) => hypot(u.x - ti, u.y - tj) > 2.5).toList();
  if (go.isNotEmpty) commandAttackMove(s, ti.toDouble(), tj.toDouble(), go, false);
}

// ================= الانقلابات (باريس) =================
void _updateCoups(MatchState s) {
  if (s.mode == 'survival') return;
  final C = F.m('coups'), tick = _tickOf(s), first = _ticks(C.d('first')), every = _ticks(C.d('every'));
  if (tick >= first && (tick - first) % every == 0) _coup(s, (tick - first) ~/ every + 1);
  if (tick % _ticks(C.d('think')) == 0) _thinkRebels(s);
}

void _coup(MatchState s, int wave) {
  final C = F.m('coups'), rebels = featurePlayer(s), map = s.map;
  if (rebels == null) return;
  final mul = 1 + C.d('grow') * (wave - 1), arch = buildingOwner(s, 'arch');
  var mine = 0, total = 0;
  for (final player in s.players.toList()) {
    if (player.neutral || player.id == arch) continue;
    final owned = map.districts.where((d) => d.owner == player.id && d.capture != null).toList();
    final count = C.l('at').where((n) => owned.length >= (n as num)).length;
    if (count == 0) continue;
    final cands = [for (final d in owned) if (d.building != 'hq' && !d.police && !d.hill) (d, (d.building != null ? 1 : 0) + random())];
    stableSort<(District, double)>(cands, (a, b) => byNum(a.$2, b.$2));
    for (final (d, _) in cands.take(count)) {
      d.owner = rebels.id;
      d.progress = 100;
      d.progressOwner = rebels.id;
      for (final (i, j) in findFreeTiles(map, d.capture!.i, d.capture!.j, C.i('perDistrict'))) {
        final unit = createUnit(s, rebels, i, j);
        _boost(unit, null, mul);
        unit.raidFrom = d.id;
        s.units.add(unit);
      }
      total++;
      if (player.id == s.humanId) mine++;
    }
  }
  if (total == 0) return;
  s.notice = mine > 0
      ? Notice('انقلاب! تمرد ${mine > 1 ? '$mine من أحيائك' : 'حي من أحيائك'}', true, 4)
      : Notice('انقلاب في المدينة: تمردت $total${total > 1 ? ' أحياء' : ' حي'}', false, 4);
  sound('alert');
}

void _thinkRebels(MatchState s) {
  final rebels = featurePlayer(s);
  if (rebels == null) return;
  final groups = <int, List<Unit>>{};
  for (final unit in s.units) {
    if (unit.playerId != rebels.id || !_alive(unit) || unit.state != 'idle') continue;
    groups.putIfAbsent(unit.raidFrom, () => []).add(unit);
  }
  for (final e in groups.entries) {
    final origin = e.key >= 0 && e.key < s.map.districts.length ? s.map.districts[e.key] : null;
    if (origin == null || origin.capture == null) continue;
    _raid(s, rebels, e.value, double.infinity, (origin.capture!.i.toDouble(), origin.capture!.j.toDouble(), F.m('coups').d('range')));
  }
}

// ================= المجمع السكني (تينوتشتيتلان) =================
Iterable<District> _cartelDistricts(MatchState s) => s.map.districts.where((d) => d.feature == 'complex' || d.feature == 'cartel');
District? _complexOf(MatchState s) => s.map.districts.where((d) => d.feature == 'complex').firstOrNull;

void _initCartel(MatchState s) {
  final player = featurePlayer(s), complex = _complexOf(s);
  if (player == null || complex == null || complex.capture == null || complex.featureTile == null) return;
  for (final d in _cartelDistricts(s)) {
    if (d.capture == null) continue;
    d.owner = player.id;
    d.progress = 100;
    d.progressOwner = player.id;
    d.tintColor = player.color;
    d.tintMix = 1;
  }
  complex.produced = 0;
  complex.nextAt = F.m('cartel').d('every');
  for (var k = 0; k < F.m('cartel').i('start'); k++) { _spawnCartel(s, complex); }
}

void _spawnCartel(MatchState s, District complex) {
  final C = F.m('cartel');
  if (complex.produced >= C.i('total')) return;
  final heroes = C.l('heroes');
  final hero = heroes[complex.produced % heroes.length] as String?;
  if (_spawnGuard(s, complex, <String, Object?>{'hero': hero, 'stats': null})) {
    s.units.last.leash = C.d('leash');
    complex.produced++;
  }
}

void _updateCartel(MatchState s) {
  final C = F.m('cartel'), player = featurePlayer(s), complex = _complexOf(s);
  if (player == null || complex == null || complex.capture == null || complex.featureTile == null) return;
  if (complex.owner == player.id && complex.produced < C.i('total') && s.time >= complex.nextAt) {
    _spawnCartel(s, complex);
    complex.nextAt = s.time + C.d('every');
  }
  if (_tickOf(s) % _ticks(C.d('think')) != 0) return;
  final lost = _cartelDistricts(s).where((d) => d.capture != null && d.owner != player.id).toList();
  final free = s.units.where((u) => u.playerId == player.id && _alive(u) && u.state == 'idle').toList();
  if (lost.isEmpty || free.isEmpty) return;
  var cx = 0.0, cy = 0.0;
  for (final u in free) { cx += u.x; }
  cx /= free.length;
  for (final u in free) { cy += u.y; }
  cy /= free.length;
  var target = lost[0];
  for (final b in lost.skip(1)) {
    if (hypot(b.capture!.i - cx, b.capture!.j - cy) < hypot(target.capture!.i - cx, target.capture!.j - cy)) target = b;
  }
  final go = free.where((u) => hypot(u.x - target.capture!.i, u.y - target.capture!.j) > 1.5).toList();
  if (go.isNotEmpty) commandAttackMove(s, target.capture!.i.toDouble(), target.capture!.j.toDouble(), go, false);
}

double featureCostMul(MatchState s, int pid) {
  if (s.feature != 'cartel') return 1;
  var n = 0;
  for (final d in s.map.districts) { if ((d.feature == 'complex' || d.feature == 'cartel') && d.owner == pid) n++; }
  return 1 - F.m('cartel').d('discount') * n;
}

// ================= برج الساعة (برمنغهام) =================
int _clockOwner(MatchState s) {
  if (s.feature != 'clock') return -1;
  final d = s.map.districts.where((x) => x.feature == 'clock').firstOrNull;
  return d != null && d.owner != null && !s.players[d.owner!].neutral ? d.owner! : -1;
}
double featureIncomeMul(MatchState s, int pid) => _clockOwner(s) == pid ? F.m('clock').d('incomeMul') : 1;
double featureProductionMul(MatchState s, int pid) => _clockOwner(s) == pid ? 1 / F.m('clock').d('productionMul') : 1;

// ================= المعبد القديم (ريو، statue) =================
List<FeatureZone>? statueZones(MatchState s) => _zonesOf(s, 'statue');
bool inZone(List<FeatureZone> zones, Unit unit) {
  for (final z in zones) {
    if (z.owner != unit.playerId) continue;
    final dx = unit.x - z.x, dy = unit.y - z.y;
    if (dx * dx + dy * dy <= z.r2) return true;
  }
  return false;
}

// ================= مركز الشرطة الرئيسي (روتنبورغ) =================
void dressMainPolice(Unit unit, bool captain) {
  final P = F.m('policeHQ');
  unit.nation = P.s('nation');
  unit.lookKind = captain ? P.s('captainLook') : null;
  _boost(unit, null, P.d('boost'));
}

void joinPolice(MatchState s, Unit unit, Player owner) {
  unit.playerId = owner.id;
  unit.color = owner.color;
  unit.artColor = owner.color;
  unit.stationId = -1;
  unit.homePost = null;
  unit.vanishAt = -1;
  unit.target = null;
  unit.stats = {...unit.stats, 'capturePower': 1};
  applyUpgrades(s, unit);
}

// ================= قافلة التجارة (صحراء اليمامة) =================
void _updateCaravan(MatchState s) {
  if (s.mode == 'survival') return;
  final C = F.m('caravan'), tick = _tickOf(s), first = _ticks(C.d('first')), every = _ticks(C.d('every'));
  if (tick >= first && (tick - first) % every == 0) _spawnCaravan(s);
  _lootMerchants(s);
  if (tick % _ticks(C.d('think')) == 0) _moveCaravan(s);
}

(int, int, Exit)? _caravanRoute(MatchState s) {
  final map = s.map, gates = <int>[], last = map.n - 1;
  for (var k = 0; k < map.kind.length; k++) { if (map.kind[k] == 'gateI' || map.kind[k] == 'gateJ') gates.add(k); }
  if (gates.isEmpty) return null;
  final k = gates[(random() * gates.length).floor()], gi = k % map.n, gj = k ~/ map.n;
  final alongI = map.kind[k] == 'gateJ';
  Exit? exit;
  var best = 1 << 30;
  for (var a = 0; a < map.n; a++) {
    final i = alongI ? last : a, j = alongI ? a : last;
    if (!map.isConnected(i, j)) continue;
    final off = (a - (alongI ? gj : gi)).abs();
    if (off < best) { best = off; exit = Exit(i.toDouble(), j.toDouble(), s.time + F.m('caravan').d('maxSeconds')); }
  }
  return exit == null ? null : (gi, gj, exit);
}

void _spawnCaravan(MatchState s) {
  final C = F.m('caravan'), player = featurePlayer(s);
  final route = player != null ? _caravanRoute(s) : null;
  if (route == null) return;
  final guards = C.l('guards'), merchants = C.i('merchants');
  final spots = findFreeTiles(s.map, route.$1, route.$2, merchants + guards.length);
  for (var k = 0; k < spots.length; k++) {
    final merchant = k < merchants;
    final unit = createUnit(s, player!, spots[k].$1, spots[k].$2, merchant ? null : guards[k - merchants] as String?);
    _boost(unit, merchant ? C.mm('merchant') : C.mm('guard'));
    unit.caravanExit = route.$3;
    if (merchant) {
      unit.harmless = true;
      unit.cargo = true;
      unit.name = C.s('merchantName');
    }
    s.units.add(unit);
  }
  if (spots.isEmpty) return;
  s.notice = Notice('قافلة تجارية دخلت المدينة! كل تاجر تنهبه: ${C.i('loot')} نقطة', false, 4);
  sound('alert');
  _moveCaravan(s);
}

void _lootMerchants(MatchState s) {
  final C = F.m('caravan');
  for (final unit in s.units) {
    if (!unit.cargo || unit.state != 'dead') continue;
    unit.cargo = false;
    final killer = unit.lastHitBy;
    if (killer < 0 || killer >= s.players.length || s.players[killer].neutral) continue;
    _gain(s, killer, C.d('loot'));
    addPop(s, unit, '+${C.i('loot')}', 'loot');
    soundAt(s, 'capture_done', unit.x, unit.y);
    if (killer == s.humanId) s.notice = Notice('نهبت تاجراً: +${C.i('loot')} نقطة', true, 2.5);
  }
}

void _moveCaravan(MatchState s) {
  final C = F.m('caravan'), player = featurePlayer(s);
  if (player == null) return;
  final mine = s.units.where((u) => u.playerId == player.id && u.caravanExit != null && _alive(u)).toList();
  if (mine.isEmpty) return;
  final gone = <Unit>{}, khan = buildingOwner(s, 'khan');
  double paid = 0;
  for (final u in mine) {
    final exit = u.caravanExit!;
    if (s.time < exit.until && hypot(u.x - exit.i, u.y - exit.j) > C.d('exitRadius')) continue;
    if (u.harmless && u.cargo && khan >= 0 && s.empire != null) {
      _gain(s, khan, F.m('khan').d('points'));
      paid += F.m('khan').d('points');
    }
    u.cargo = false;
    _kill(u);
    gone.add(u);
  }
  if (gone.isNotEmpty) s.units.removeWhere(gone.contains);
  if (paid > 0 && khan == s.humanId) s.notice = Notice('تجار خرجوا سالمين إلى خانك: +${paid.round()} نقطة', true, 2.5);
  final merchants = mine.where((u) => u.harmless && !gone.contains(u)).toList(), guards = mine.where((u) => !u.harmless && !gone.contains(u)).toList();
  final idle = merchants.where((u) => u.state == 'idle').toList();
  if (idle.isNotEmpty) commandMove(s, idle[0].caravanExit!.i, idle[0].caravanExit!.j, idle, false);
  final free = guards.where((u) => u.state != 'attacking').toList();
  if (free.isEmpty) return;
  if (merchants.isEmpty) {
    final moving = free.where((u) => u.state != 'moving').toList();
    if (moving.isNotEmpty) commandMove(s, moving[0].caravanExit!.i, moving[0].caravanExit!.j, moving, false);
    return;
  }
  var ci = 0.0, cj = 0.0;
  for (final u in merchants) { ci += u.x; }
  ci /= merchants.length;
  for (final u in merchants) { cj += u.y; }
  cj /= merchants.length;
  final far = free.where((u) => hypot(u.x - ci, u.y - cj) > C.d('escort')).toList();
  if (far.isNotEmpty) commandAttackMove(s, ci, cj, far, false);
}

// ================= السوق الكبير (المدينة العربية) =================
void payTax(MatchState s, int payer, num amount) {
  if (s.feature != 'souk') return;
  final d = s.map.districts.where((x) => x.feature == 'souk').firstOrNull;
  if (d == null || d.owner == null || d.owner == payer || s.players[d.owner!].neutral) return;
  final gain = amount * F.m('souk').d('tax');
  _gain(s, d.owner!, gain);
  d.taxed += gain;
}

// ================= مهرجان الألعاب النارية (المدينة الصينية) =================
void _updateFireworks(MatchState s) {
  final W = F.m('fireworks'), tick = _tickOf(s), first = _ticks(W.d('first')), every = _ticks(W.d('every'));
  if (tick >= first && (tick - first) % every == 0) _markFireworks(s, tick + _ticks(W.d('warn')));
  if (s.fireworks.isEmpty) return;
  for (final f in s.fireworks) { if (!f.done && tick >= f.at) _burstFireworks(s, f); }
  final fade = _ticks(W.d('fade'));
  if (s.fireworks.any((f) => f.done && tick - f.at >= fade)) s.fireworks = s.fireworks.where((f) => !f.done || tick - f.at < fade).toList();
}

bool _soldier(MatchState s, Unit u) => _alive(u) && !s.players[u.playerId].neutral;

void _markFireworks(MatchState s, int at) {
  final W = F.m('fireworks'), radius = W.d('radius'), r2 = radius * radius, used = <Unit>{};
  var marks = 0;
  for (var n = 0; n < W.i('count'); n++) {
    Unit? best;
    var bestCount = W.i('minUnits') - 1;
    for (final u in s.units) {
      if (used.contains(u) || !_soldier(s, u)) continue;
      var count = 0;
      forEachNearby(s, u.x, u.y, radius, (o) {
        final dx = o.x - u.x, dy = o.y - u.y;
        if (dx * dx + dy * dy <= r2 && !used.contains(o) && _soldier(s, o)) count++;
      });
      if (count > bestCount) { bestCount = count; best = u; }
    }
    if (best == null) break;
    final x = best.x, y = best.y;
    forEachNearby(s, x, y, 2 * radius, (o) {
      final dx = o.x - x, dy = o.y - y;
      if (dx * dx + dy * dy <= 4 * r2) used.add(o);
    });
    s.fireworks.add(Firework(x, y, at));
    _dodgeFireworks(s, x, y);
    marks++;
  }
  if (marks == 0) return;
  s.notice = Notice('ألعاب نارية! ابتعد عن الدوائر الحمراء', false, 3);
  sound('alert');
}

void _dodgeFireworks(MatchState s, double x, double y, [double? radius]) {
  final W = F.m('fireworks'), rad = radius ?? W.d('radius'), r = rad + 0.3, out = rad + W.d('dodge');
  final movers = <Unit>[], decided = <int, bool>{};
  forEachNearby(s, x, y, r, (u) {
    final p = s.players[u.playerId];
    if (!_alive(u) || p.neutral || p.isHuman || hypot(u.x - x, u.y - y) > r) return;
    if (!decided.containsKey(p.id)) decided[p.id] = random() < (W.m('dodgeChance').dn(p.difficulty) ?? 0);
    if (decided[p.id]!) movers.add(u);
  });
  for (final u in movers) {
    final d = hypot(u.x - x, u.y - y), ux = d > 0.01 ? (u.x - x) / d : 1.0, uy = d > 0.01 ? (u.y - y) / d : 0.0;
    commandMove(s, x + ux * out, y + uy * out, [u], false);
  }
}

void _burstFireworks(MatchState s, Firework f) {
  final W = F.m('fireworks'), r2 = W.d('radius') * W.d('radius'), player = featurePlayer(s), hit = <Unit>[], rocket = f.owner != null;
  f.done = true;
  if (player == null && !rocket) return;
  final by = _by(rocket ? f.owner! : player!.id);
  forEachNearby(s, f.x, f.y, W.d('radius'), (u) {
    final dx = u.x - f.x, dy = u.y - f.y;
    if (dx * dx + dy * dy <= r2 && _alive(u) && (!rocket || isEnemyId(s, f.owner!, u.playerId))) hit.add(u);
  });
  for (final u in hit) { applyDamage(s, by, u, rocket ? F.m('powder').d('damage') : W.d('damage')); }
  soundAt(s, 'fire', f.x, f.y);
}

// ================= أحداث مدن المباني =================
String? cityEvent(MatchState s) => s.feature != null && s.mode != 'survival' ? F.m('events').ss(s.map.city) : null;

Window eventWindow(String ev, double time) {
  final C = F.m(ev);
  return windowAt(time, C.d('first'), C.d('every'), ev == 'nile' ? F.m('nile').d('flood') + F.m('nile').d('silt') : C.d('duration'));
}

String? nilePhase(double time) {
  final w = eventWindow('nile', time);
  return !w.on ? null : w.since < F.m('nile').d('flood') ? 'flood' : 'silt';
}

District? _areaDistrict(GameMap map, Unit unit) {
  final i = jsRoundD(unit.x), j = jsRoundD(unit.y);
  if (map.areaAt == null || !map.inBounds(i, j)) return null;
  final a = map.areaAt![map.idx(i, j)];
  return a >= 0 && a < map.districts.length ? map.districts[a] : null;
}

double eventIncomeMul(MatchState s, District d) {
  final ev = cityEvent(s);
  if (ev == 'season') return eventWindow('season', s.time).on ? F.m('season').d('incomeMul') : 1;
  if (ev == 'nile' && d.bank) return nilePhase(s.time) == 'silt' ? F.m('nile').d('incomeMul') : 1;
  return 1;
}

double _sq(double v) => v * v;

double eventSpeedMul(MatchState s, Unit unit) {
  final ev = cityEvent(s);
  if (ev == 'flood') { final b = s.cityEvent?.band; return b != null && b.on && inBand(b, unit) ? 1 - F.m('flood').d('slow') : 1; }
  if (ev == 'nile' && nilePhase(s.time) == 'flood') { final d = _areaDistrict(s.map, unit); return d != null && d.bank ? 1 - F.m('nile').d('slow') : 1; }
  final ce = s.cityEvent;
  if (ce == null || s.players[unit.playerId].passive) return 1;
  if (ev == 'ash' && ce.ash != null && ce.ash!.on) return _inCloud(ce.ash!.list, unit) ? 1 - F.m('ash').d('slow') : 1;
  if (ev == 'derby' && ce.derby != null && ce.derby!.on) {
    return _sq(unit.x - ce.derby!.x) + _sq(unit.y - ce.derby!.y) <= _sq(F.m('derby').d('radius')) ? 1 - F.m('derby').d('jam') : 1;
  }
  if (ev == 'carnival' && ce.dancers != null) {
    final r2 = _sq(F.m('carnival').d('radius'));
    return ce.dancers!.any((p) => _sq(unit.x - p.$1) + _sq(unit.y - p.$2) <= r2) ? 1 + F.m('carnival').d('boost') : 1;
  }
  return 1;
}

void _markBanks(GameMap map) {
  final land = map.land;
  for (final d in map.districts) {
    if (d.capture != null && d.tiles.any((t) => t.$1 >= land - F.m('nile').d('bankTiles'))) d.bank = true;
  }
}

const _eventText = {
  'flood': {'name': 'سيل الوادي', 'warn': 'سيل الوادي بعد ثوانٍ! ابتعد عن الشريط الأزرق', 'start': 'سيل الوادي! من في مجراه أبطأ ويجرفه الماء', 'end': 'انحسر السيل'},
  'season': {'name': 'موسم التجارة', 'warn': 'موسم التجارة بعد ثوانٍ', 'start': 'موسم التجارة! دخل كل الأحياء مضاعف', 'end': 'انتهى موسم التجارة'},
  'lightning': {'name': 'عاصفة البرق', 'warn': 'عاصفة برق قادمة!', 'start': 'عاصفة البرق! ابتعد عن الدوائر الزرقاء', 'end': 'انتهت عاصفة البرق'},
  'nile': {'name': 'فيضان النيل', 'warn': 'النيل يفيض بعد ثوانٍ!', 'start': 'فيضان النيل! أحياء الضفة أبطأ', 'end': 'انتهى موسم الطمي',
    'silt': 'انحسر النيل: دخل أحياء الضفة مضاعف دقيقة'},
  'quake': {'name': 'الزلزال', 'warn': 'زلزال قادم! اخرج من الدائرة الحمراء', 'start': 'زلزال! سقط الجنود أرضاً', 'end': 'هدأت الأرض'},
  'market': {'name': 'سوق الليل', 'warn': 'سوق الليل يفتح بعد ثوانٍ', 'start': 'سوق الليل! كل شيء أرخص 25%', 'end': 'أغلق سوق الليل'},
  'typhoon': {'name': 'الإعصار', 'warn': 'إعصار قادم!', 'start': 'الإعصار! الريح تدفع الجنود ومدى الرماة أقصر', 'end': 'هدأ الإعصار'},
  'holi': {'name': 'مهرجان الألوان', 'warn': 'مهرجان الألوان بعد ثوانٍ', 'start': 'مهرجان الألوان! لا قتال داخل السحب الملونة', 'end': 'انتهى مهرجان الألوان'},
  'whistle': {'name': 'صافرة المصانع', 'warn': 'صافرة المصانع بعد ثوانٍ', 'start': 'صافرة المصانع! إنتاج الجنود أسرع 50%', 'end': 'انتهت الوردية'},
  'ash': {'name': 'رماد البركان', 'warn': 'البركان يقذف رماده! ابتعد عن الدوائر', 'start': 'رماد البركان! من تحته أبطأ ويحترق', 'end': 'توقف الرماد'},
  'derby': {'name': 'جمهور الديربي', 'warn': 'الديربي بعد ثوانٍ! الجمهور سيملأ الوسط', 'start': 'جمهور الديربي يسدّ شوارع الوسط!', 'end': 'انصرف الجمهور'},
  'fire': {'name': 'الحريق الكبير', 'warn': 'رائحة دخان... حريق قريب!', 'start': 'الحريق الكبير! ابتعد عن الحي المحترق', 'end': 'أُخمد الحريق'},
};

double eventCostMul(MatchState s) => cityEvent(s) == 'market' && eventWindow('market', s.time).on ? F.m('market').d('costMul') : 1;
double eventProductionMul(MatchState s) => cityEvent(s) == 'whistle' && eventWindow('whistle', s.time).on ? 1 / F.m('whistle').d('speed') : 1;
bool _inCloud(List<Cloud> clouds, Unit u) => clouds.any((c) => _sq(u.x - c.x) + _sq(u.y - c.y) <= c.r * c.r);
bool holiTruce(MatchState s, Unit a, Unit b) {
  final cl = s.cityEvent?.clouds;
  return cl != null && cl.on && (_inCloud(cl.list, a) || _inCloud(cl.list, b));
}

void _updateCityEvent(MatchState s) {
  final ev = cityEvent(s);
  if (ev == null) return;
  s.cityEvent ??= CityEventState();
  if (ev == 'treasure') { _updateTreasure(s); return; }
  if (ev == 'watch') { _updateWatch(s); return; }
  if (ev == 'knight') { _updateKnight(s); return; }
  if (ev == 'silver') { _updateSilver(s); return; }
  if (ev == 'carnival') { _updateCarnival(s); return; }
  final C = F.m(ev), X = _eventText[ev]!, now = eventWindow(ev, s.time), before = eventWindow(ev, s.time - TICK_SEC);
  final ce = s.cityEvent!;
  if (!now.on && now.left <= C.d('warn') && before.left > C.d('warn')) {
    if (ev == 'flood') _pickBand(s);
    if (ev == 'quake') ce.quake = _pickQuake(s);
    if (ev == 'typhoon') ce.wind = _pickWind();
    if (ev == 'holi') ce.clouds = _pickClouds(s, F.m('holi'));
    if (ev == 'ash') ce.ash = _pickClouds(s, F.m('ash'));
    s.notice = Notice(X['warn']!, false, 3);
    sound('alert');
  } else if (now.on && !before.on) {
    if (ev == 'flood') { if (ce.band == null) _pickBand(s); ce.band!.on = true; }
    if (ev == 'quake') { ce.quake ??= _pickQuake(s); if (ce.quake != null) { ce.quake!.on = true; _quakeHit(s, ce.quake!); } }
    if (ev == 'typhoon') { ce.wind ??= _pickWind(); ce.wind!.on = true; }
    if (ev == 'holi') { ce.clouds ??= _pickClouds(s, F.m('holi')); ce.clouds!.on = true; }
    if (ev == 'ash') { ce.ash ??= _pickClouds(s, F.m('ash')); ce.ash!.on = true; }
    if (ev == 'derby') _startDerby(s);
    if (ev == 'fire') _startFire(s);
    s.notice = Notice(X['start']!, false, 4);
  } else if (!now.on && before.on) {
    if (ev == 'flood') ce.band = null;
    if (ev == 'quake') ce.quake = null;
    if (ev == 'typhoon') ce.wind = null;
    if (ev == 'holi') ce.clouds = null;
    if (ev == 'ash') ce.ash = null;
    if (ev == 'derby') _endDerby(s);
    if (ev == 'fire') ce.fire = null;
    s.notice = Notice(X['end']!, false, 3);
  } else if (ev == 'nile' && nilePhase(s.time) == 'silt' && nilePhase(s.time - TICK_SEC) == 'flood') {
    s.notice = Notice(X['silt']!, false, 4);
  }
  if (ev == 'flood' && now.on) _pushFlood(s);
  if (ev == 'typhoon' && now.on && ce.wind != null) _pushWind(s, ce.wind!);
  if (ev == 'ash' && now.on && ce.ash != null) _burnIn(s, (u) => _inCloud(ce.ash!.list, u), F.m('ash').d('dps'));
  if (ev == 'fire' && now.on && ce.fire != null) _updateFire(s, ce.fire!, now);
  if (ev == 'quake' && now.on && jsRound(now.since / TICK_SEC) % _ticks(0.4) == 0) s.shakeAt = s.time;
  if (ev == 'lightning') _updateLightning(s, now);
}

double _leftUntil(MatchState s, J C) => s.time < C.d('first') ? C.d('first') - s.time : C.d('every') - ((s.time - C.d('first')) % C.d('every'));

(String, bool)? _eventBar(MatchState s, String ev) {
  final ce = s.cityEvent;
  if (ev == 'treasure') {
    final c = ce?.chest;
    if (c != null) return ('كنز الفرعون في المدينة ${_clock(c.until - s.time)}', false);
    final left = _leftUntil(s, F.m('treasure'));
    return left <= 30 ? ('كنز الفرعون بعد ${_clock(left)}', false) : null;
  }
  if (ev == 'silver') {
    final ps = ce?.silver;
    if (ps != null && ps.pieces.isNotEmpty) return ('حمى الفضة: ${ps.pieces.length} قطع في الشوارع ${_clock(ps.until - s.time)}', false);
    final left = _leftUntil(s, F.m('silver'));
    return left <= 30 ? ('حمى الفضة بعد ${_clock(left)}', false) : null;
  }
  if (ev == 'carnival') {
    if (ce?.dancers != null && ce!.dancers!.isNotEmpty) return ('الكرنفال يعبر المدينة: امشِ معه أسرع', false);
    final left = _leftUntil(s, F.m('carnival'));
    return left <= 30 ? ('الكرنفال بعد ${_clock(left)}', false) : null;
  }
  if (ev == 'watch' || ev == 'knight') {
    final alive = s.units.any((u) => _alive(u) && (ev == 'watch' ? u.patrol : u.blackKnight));
    if (alive) return (ev == 'watch' ? 'دورية الحارس الليلي في المدينة' : 'الفارس الأسود في وسط المدينة', ev == 'watch');
    final left = _leftUntil(s, F.m(ev));
    return left <= 30 ? ('${ev == 'watch' ? 'جولة الحارس الليلي' : 'الفارس الأسود'} بعد ${_clock(left)}', false) : null;
  }
  final w = eventWindow(ev, s.time), name = _eventText[ev]!['name']!;
  if (w.on && ev == 'nile') {
    return nilePhase(s.time) == 'flood' ? ('فيضان النيل ${_clock(F.m('nile').d('flood') - w.since)}', true) : ('طمي النيل: دخل الضفة مضاعف ${_clock(w.left)}', false);
  }
  if (w.on) return ('$name ${_clock(w.left)}', ev != 'season');
  return w.left <= 30 ? ('$name بعد ${_clock(w.left)}', w.left <= F.m(ev).d('warn')) : null;
}

// --- سيل الوادي (شبام) ---
void _pickBand(MatchState s) {
  final map = s.map, axis = random() < 0.5 ? 'i' : 'j', span = axis == 'i' ? map.land : map.n;
  final c = 3 + random() * math.max(1, span - 6);
  s.cityEvent!.band = Band(axis, c, random() < 0.5 ? -1 : 1);
}
bool inBand(Band b, Unit u) => ((b.axis == 'i' ? u.x : u.y) - b.c).abs() <= F.m('flood').d('width') / 2;

void _pushFlood(MatchState s) {
  final b = s.cityEvent!.band, map = s.map;
  if (b == null) return;
  final step = F.m('flood').d('push') * TICK_SEC * b.dir;
  for (final u in s.units) {
    if (!_alive(u) || u.creature != null || !inBand(b, u)) continue;
    final nx = b.axis == 'i' ? u.x : u.x + step, ny = b.axis == 'i' ? u.y + step : u.y;
    if (map.isConnected(jsRound(nx), jsRound(ny))) { u.x = nx; u.y = ny; }
  }
}

// --- كنز الفرعون (القاهرة) ---
void _updateTreasure(MatchState s) {
  final T = F.m('treasure'), ev = s.cityEvent!, tick = _tickOf(s), first = _ticks(T.d('first')), every = _ticks(T.d('every'));
  if (tick >= first && (tick - first) % every == 0) _spawnChest(s);
  final c = ev.chest;
  if (c == null) return;
  if (s.time >= c.until) {
    ev.chest = null;
    s.notice = Notice('اختفى كنز الفرعون', false, 2.5);
    return;
  }
  final r2 = _sq(T.d('radius'));
  var who = -1;
  var contested = false;
  forEachNearby(s, c.i.toDouble(), c.j.toDouble(), T.d('radius'), (u) {
    if (!_soldier(s, u) || _sq(u.x - c.i) + _sq(u.y - c.j) > r2) return;
    if (who < 0) { who = u.playerId; } else if (u.playerId != who && isEnemyId(s, who, u.playerId)) { contested = true; }
  });
  if (who < 0 || contested) { c.holder = -1; c.since = 0; return; }
  if (c.holder != who) { c.holder = who; c.since = 0; }
  c.since += TICK_SEC;
  if (c.since + 1e-6 < T.d('hold')) return;
  _gain(s, who, T.d('points'));
  soundAt(s, 'capture_done', c.i.toDouble(), c.j.toDouble());
  s.notice = who == s.humanId
      ? Notice('أخذت كنز الفرعون: +${T.i('points')} نقطة', true, 3)
      : Notice('${s.players[who].gangName} أخذوا كنز الفرعون', false, 3);
  ev.chest = null;
}

List<(int, int)> _roads(GameMap map) => [
  for (var j = 0; j < map.n; j++) for (var i = 0; i < map.n; i++) if (map.road[map.idx(i, j)] != 0 && map.isConnected(i, j)) (i, j),
];

void _spawnChest(MatchState s) {
  final roads = _roads(s.map), T = F.m('treasure');
  if (roads.isEmpty) return;
  final (i, j) = roads[(random() * roads.length).floor()];
  s.cityEvent!.chest = Chest(i, j, s.time + T.d('life'));
  s.notice = Notice('ظهر كنز الفرعون! ابقَ عنده ${T.i('hold')} ثوانٍ بلا عدو: ${T.i('points')} نقطة', false, 4);
  sound('alert');
  for (final p in s.players) {
    if (p.isHuman || p.neutral) continue;
    final near = s.units.where((u) => u.playerId == p.id && _alive(u) && u.creature == null && u.state != 'attacking').toList();
    stableSort<Unit>(near, (a, b) => byNum(hypot(a.x - i, a.y - j), hypot(b.x - i, b.y - j)));
    final take = near.take(T.i('botUnits')).toList();
    if (take.isNotEmpty) commandAttackMove(s, i.toDouble(), j.toDouble(), take, false);
  }
}

// --- عاصفة البرق (غوندر) ---
void _updateLightning(MatchState s, Window now) {
  final L = F.m('lightning'), ev = s.cityEvent!, tick = _tickOf(s);
  if (now.on && jsRound(now.since / TICK_SEC) % _ticks(L.d('boltEvery')) == 0) _markBolt(s, tick);
  if (ev.bolts.isEmpty) return;
  for (final b in ev.bolts) { if (!b.done && tick >= b.at) _burstBolt(s, b); }
  final fade = _ticks(L.d('fade'));
  if (ev.bolts.any((b) => b.done && tick - b.at >= fade)) ev.bolts = ev.bolts.where((b) => !b.done || tick - b.at < fade).toList();
}

List<Unit> _activeSoldiers(MatchState s) => s.units.where((u) => _soldier(s, u) && !s.players[u.playerId].passive).toList();

void _markBolt(MatchState s, int tick) {
  final L = F.m('lightning'), n = s.map.n;
  final soldiers = _activeSoldiers(s);
  if (soldiers.isEmpty) return;
  final u = soldiers[(random() * soldiers.length).floor()];
  final x = math.max(0.0, math.min(n - 1.0, u.x + (random() * 2 - 1) * L.d('jitter')));
  final y = math.max(0.0, math.min(n - 1.0, u.y + (random() * 2 - 1) * L.d('jitter')));
  s.cityEvent!.bolts.add(Bolt(x, y, tick + _ticks(L.d('delay'))));
  _dodgeFireworks(s, x, y, L.d('radius'));
}

void _burstBolt(MatchState s, Bolt b) {
  final L = F.m('lightning'), r2 = _sq(L.d('radius')), hit = <Unit>[];
  b.done = true;
  final by = featurePlayer(s) ?? _policeOf(s);
  if (by == null) return;
  forEachNearby(s, b.x, b.y, L.d('radius'), (u) { if (_alive(u) && _sq(u.x - b.x) + _sq(u.y - b.y) <= r2) hit.add(u); });
  for (final u in hit) { applyDamage(s, _by(by.id), u, L.d('damage')); }
  soundAt(s, 'fire', b.x, b.y);
}

// --- الزلزال (إيدو) ---
Spot? _pickQuake(MatchState s) {
  final soldiers = _activeSoldiers(s);
  if (soldiers.isEmpty) return null;
  final u = soldiers[(random() * soldiers.length).floor()];
  return Spot(u.x, u.y);
}

void _quakeHit(MatchState s, Spot q) {
  final Q = F.m('quake'), r2 = _sq(Q.d('radius')), hit = <Unit>[];
  final by = featurePlayer(s) ?? _policeOf(s);
  forEachNearby(s, q.x, q.y, Q.d('radius'), (u) { if (_alive(u) && _sq(u.x - q.x) + _sq(u.y - q.y) <= r2) hit.add(u); });
  for (final u in hit) {
    knockDown(s, u, q.x, q.y, Q.d('knock'));
    if (by != null) applyDamage(s, _by(by.id), u, Q.d('damage'));
  }
  s.shakeAt = s.time;
  soundAt(s, 'hit_heavy', q.x, q.y);
}

// --- الإعصار (هونغ كونغ) ---
const _winds = [(1, 0), (-1, 0), (0, 1), (0, -1)];
Wind _pickWind() { final (dx, dy) = _winds[(random() * 4).floor()]; return Wind(dx, dy); }
void _pushWind(MatchState s, Wind w) {
  final map = s.map, step = F.m('typhoon').d('push') * TICK_SEC;
  for (final u in s.units) {
    if (!_alive(u) || u.creature != null) continue;
    final nx = u.x + w.dx * step, ny = u.y + w.dy * step;
    if (map.isConnected(jsRound(nx), jsRound(ny))) { u.x = nx; u.y = ny; }
  }
}

// --- مهرجان الألوان (جايبور) ورماد البركان ---
Clouds _pickClouds(MatchState s, J H) {
  final list = <Cloud>[];
  final soldiers = _activeSoldiers(s);
  for (var tries = 0; tries < 12 && list.length < H.i('count') && soldiers.isNotEmpty; tries++) {
    final u = soldiers[(random() * soldiers.length).floor()];
    if (list.every((c) => hypot(c.x - u.x, c.y - u.y) >= H.d('apart'))) list.add(Cloud(u.x, u.y, H.d('radius'), list.length));
  }
  return Clouds(list);
}

// --- جولة الحارس الليلي (روتنبورغ) ---
void _updateWatch(MatchState s) {
  final W = F.m('watch'), tick = _tickOf(s), first = _ticks(W.d('first')), every = _ticks(W.d('every'));
  if (tick >= first && (tick - first) % every == 0) _spawnWatch(s);
  _expireTriads(s);
  if (tick % _ticks(W.d('think')) != 0) return;
  final patrol = s.units.where((u) => u.patrol && _alive(u) && u.state == 'idle').toList();
  if (patrol.isEmpty) return;
  final stops = s.map.districts.where((d) => d.capture != null).toList();
  final d = stops.isEmpty ? null : stops[(random() * stops.length).floor()];
  if (d != null) commandAttackMove(s, d.capture!.i.toDouble(), d.capture!.j.toDouble(), patrol, false);
}

List<int> _edgeRows(GameMap map) => [for (var j = 0; j < map.n; j++) if (map.isConnected(0, j)) j];

void _spawnWatch(MatchState s) {
  final W = F.m('watch'), police = _policeOf(s), map = s.map;
  if (police == null || s.units.any((u) => u.patrol && _alive(u))) return;
  final edge = _edgeRows(map);
  if (edge.isEmpty) return;
  final j0 = edge[(random() * edge.length).floor()];
  final spots = findFreeTiles(map, 0, j0, W.i('count'));
  for (var k = 0; k < spots.length; k++) {
    final unit = createUnit(s, police, spots[k].$1, spots[k].$2, k == 0 ? 'captain' : null);
    dressMainPolice(unit, k == 0);
    _boost(unit, null, W.d('boost'));
    unit.patrol = true;
    unit.expireAt = s.time + W.d('life');
    s.units.add(unit);
  }
  s.notice = Notice('دورية الحارس الليلي تجول في المدينة! تهاجم كل عصابة إلا صاحب المركز الرئيسي', false, 4);
  sound('alert');
}

// --- الفارس الأسود (الأوروبية) ---
void _updateKnight(MatchState s) {
  final K = F.m('knight'), tick = _tickOf(s), first = _ticks(K.d('first')), every = _ticks(K.d('every'));
  if (tick >= first && (tick - first) % every == 0) _spawnKnight(s);
  for (final u in s.units) {
    if (!u.blackKnight || u.state != 'dead') continue;
    u.blackKnight = false;
    final killer = u.lastHitBy;
    if (killer < 0 || killer >= s.players.length || s.players[killer].neutral) continue;
    _gain(s, killer, K.d('reward'));
    addPop(s, u, '+${K.i('reward')}', 'loot');
    soundAt(s, 'capture_done', u.x, u.y);
    s.notice = killer == s.humanId
        ? Notice('أسقطت الفارس الأسود: +${K.i('reward')} نقطة', true, 3)
        : Notice('${s.players[killer].gangName} أسقطوا الفارس الأسود', false, 3);
  }
}

void _spawnKnight(MatchState s) {
  final K = F.m('knight'), player = featurePlayer(s), map = s.map;
  if (player == null || s.units.any((u) => u.blackKnight && _alive(u))) return;
  final spots = findFreeTiles(map, jsRound((map.land - 1) / 2), jsRound((map.n - 1) / 2), 1);
  if (spots.isEmpty) return;
  final (i, j) = spots[0];
  final unit = createUnit(s, player, i, j, K.ss('hero'));
  _boost(unit, K.mm('stats'));
  unit.name = K.s('name');
  unit.blackKnight = true;
  unit.homePost = Point2(i.toDouble(), j.toDouble());
  unit.leash = K.d('chase');
  s.units.add(unit);
  addUltFx(s, 'dust', i.toDouble(), j.toDouble());
  s.notice = Notice('ظهر الفارس الأسود في وسط المدينة! من يسقطه يأخذ ${K.i('reward')} نقطة', false, 4);
  sound('alert');
}

void _burnIn(MatchState s, bool Function(Unit) where, double dps) {
  final by = featurePlayer(s) ?? _policeOf(s);
  if (by == null) return;
  final hit = s.units.where((u) => _alive(u) && !s.players[u.playerId].passive && where(u)).toList();
  for (final u in hit) { applyDamage(s, _by(by.id), u, dps * TICK_SEC); }
}

// --- حمى الفضة (المكسيكية) ---
void _updateSilver(MatchState s) {
  final S = F.m('silver'), ce = s.cityEvent!, tick = _tickOf(s), first = _ticks(S.d('first')), every = _ticks(S.d('every'));
  if (tick >= first && (tick - first) % every == 0) _spawnSilver(s);
  final ps = ce.silver;
  if (ps == null || ps.pieces.isEmpty) return;
  if (s.time >= ps.until) { ce.silver = null; return; }
  final pick = S.d('pick');
  ps.pieces = ps.pieces.where((p) {
    Unit? who;
    forEachNearby(s, p.$1.toDouble(), p.$2.toDouble(), pick, (u) {
      if (who == null && _soldier(s, u) && !s.players[u.playerId].passive && _sq(u.x - p.$1) + _sq(u.y - p.$2) <= pick * pick) who = u;
    });
    if (who == null) return true;
    _gain(s, who!.playerId, S.d('points'));
    addPop(s, who!, '+${S.i('points')}', 'loot');
    soundAt(s, 'capture_done', p.$1.toDouble(), p.$2.toDouble());
    if (who!.playerId == s.humanId) s.notice = Notice('التقطت قطعة فضة: +${S.i('points')} نقطة', true, 2);
    return false;
  }).toList();
}

void _spawnSilver(MatchState s) {
  final S = F.m('silver'), roads = _roads(s.map), pieces = <(int, int)>[];
  for (var k = 0; k < S.i('count') && roads.isNotEmpty; k++) { pieces.add(roads.removeAt((random() * roads.length).floor())); }
  if (pieces.isEmpty) return;
  s.cityEvent!.silver = Silver(pieces, s.time + S.d('life'));
  s.notice = Notice('حمى الفضة! ${pieces.length} قطع في الشوارع، كل قطعة ${S.i('points')} نقطة لأول من يصلها', false, 4);
  sound('alert');
  for (final p in s.players) {
    if (p.isHuman || p.neutral) continue;
    final free = s.units.where((u) => u.playerId == p.id && _alive(u) && u.creature == null && u.state != 'attacking').toList();
    for (final piece in pieces) {
      if (free.isEmpty) break;
      var best = 0;
      for (var k = 1; k < free.length; k++) {
        if (hypot(free[k].x - piece.$1, free[k].y - piece.$2) < hypot(free[best].x - piece.$1, free[best].y - piece.$2)) best = k;
      }
      commandMove(s, piece.$1.toDouble(), piece.$2.toDouble(), [free.removeAt(best)], false);
    }
  }
}

// --- الكرنفال (ريو) ---
void _updateCarnival(MatchState s) {
  final C = F.m('carnival'), ce = s.cityEvent!, tick = _tickOf(s), first = _ticks(C.d('first')), every = _ticks(C.d('every'));
  if (tick >= first && (tick - first) % every == 0) _spawnCarnival(s);
  final dancers = s.units.where((u) => u.dancer != null && _alive(u)).toList();
  ce.dancers = [for (final u in dancers) (u.x, u.y)];
  if (dancers.isEmpty || tick % _ticks(C.d('think')) != 0) return;
  final gone = <Unit>{};
  for (final u in dancers) {
    final x = u.dancer!;
    if (s.time < x.until && hypot(u.x - x.i, u.y - x.j) > C.d('exitRadius')) continue;
    _kill(u);
    gone.add(u);
  }
  if (gone.isNotEmpty) s.units.removeWhere(gone.contains);
  final idle = dancers.where((u) => !gone.contains(u) && u.state == 'idle').toList();
  if (idle.isNotEmpty) commandMove(s, idle[0].dancer!.i, idle[0].dancer!.j, idle, false);
}

void _spawnCarnival(MatchState s) {
  final C = F.m('carnival'), player = featurePlayer(s), map = s.map, land = map.land;
  if (player == null || s.units.any((u) => u.dancer != null && _alive(u))) return;
  final edge = _edgeRows(map);
  if (edge.isEmpty) return;
  final j0 = edge[(random() * edge.length).floor()];
  Exit? exit;
  var best = 1 << 30;
  for (var j = 0; j < map.n; j++) {
    for (var i = land - 1; i >= land - 3; i--) {
      if (!map.isConnected(i, j)) continue;
      final off = (j - j0).abs();
      if (off < best) { best = off; exit = Exit(i.toDouble(), j.toDouble(), s.time + C.d('life')); }
    }
  }
  if (exit == null) return;
  for (final (i, j) in findFreeTiles(map, 0, j0, C.i('count'))) {
    final unit = createUnit(s, player, i, j);
    _boost(unit, C.mm('stats'));
    unit.name = C.s('name');
    unit.dancer = exit;
    s.units.add(unit);
  }
  s.notice = Notice('الكرنفال يعبر المدينة! جنودك قرب الراقصين أسرع 30%', false, 4);
  sound('alert');
}

// --- جمهور الديربي (لا بوكا) ---
void _startDerby(MatchState s) {
  final D = F.m('derby'), player = featurePlayer(s), map = s.map;
  final x = (map.land - 1) / 2, y = (map.n - 1) / 2;
  s.cityEvent!.derby = Derby(x, y);
  if (player == null) return;
  final spots = <(int, int)>[];
  for (var j = 0; j < map.n; j++) {
    for (var i = 0; i < map.n; i++) {
      if (map.road[map.idx(i, j)] != 0 && map.isConnected(i, j) && _sq(i - x) + _sq(j - y) <= _sq(D.d('radius'))) spots.add((i, j));
    }
  }
  for (var k = 0; k < D.i('count') && spots.isNotEmpty; k++) {
    final (i, j) = spots.removeAt((random() * spots.length).floor());
    final unit = createUnit(s, player, i, j);
    unit.name = D.s('name');
    unit.fan = true;
    s.units.add(unit);
  }
}

void _endDerby(MatchState s) {
  s.cityEvent!.derby = null;
  final gone = s.units.where((u) => u.fan).toList();
  for (final u in gone) { u.hp = 0; u.state = 'dead'; u.deathTimer = 0; }
  if (gone.isNotEmpty) s.units.removeWhere((u) => u.fan);
}

// --- الحريق الكبير (شيكاغو) ---
void _startFire(MatchState s) {
  final ds = s.map.districts.where((d) => d.capture != null).toList();
  if (ds.isEmpty) return;
  s.cityEvent!.fire = CityFire([ds[(random() * ds.length).floor()].id]);
}

void _updateFire(MatchState s, CityFire fire, Window now) {
  final step = jsRound(now.since / TICK_SEC);
  if (step > 0 && step % _ticks(F.m('fire').d('spread')) == 0) {
    for (final id in fire.burning.toList()) {
      final next = s.map.districts[id].adj.where((a) => !fire.burning.contains(a) && s.map.districts[a].capture != null).toList();
      if (next.isNotEmpty) fire.burning.add(next[(random() * next.length).floor()]);
    }
  }
  _burnIn(s, (u) { final d = _areaDistrict(s.map, u); return d != null && fire.burning.contains(d.id); }, F.m('fire').d('dps'));
}

// ================= المخلوقات =================
const _forever = 1e9;
void _makeCreature(Unit unit, String kind, double scale, double barY) {
  unit.creature = kind;
  unit.artScale = scale;
  unit.barY = barY;
  unit.steadyUntil = _forever;
  unit.holdUntil = _forever;
}

// ================= مقر الترياد (هونغ كونغ) =================
Result _ok() => const Result(true, '');
Result _no(String r) => Result(false, r);

// target: null = هل الخانة متاحة؟ (undefined في JavaScript)، وhasTarget مع null = لمسة على غير حي
Result canCallTriads(MatchState s, int pid, District? d, [District? target, bool hasTarget = false]) {
  final T = F.m('triads');
  if (d == null || d.feature != 'triads' || d.featureTile == null || d.owner != pid) return _no('ليس مبناك');
  if (s.time < d.readyAt) return _no('يعودون بعد ${(d.readyAt - s.time).ceil()} ث');
  if (s.empire!.points[pid] < T.d('cost')) return _no('النقاط لا تكفي');
  if (!hasTarget) return _ok();
  return triadTarget(s, pid, target) ? _ok() : _no('اختر حياً لعدوك');
}

bool triadTarget(MatchState s, int pid, District? d) {
  if (d == null || d.capture == null || d.owner == null || d.owner == pid || !isEnemyId(s, pid, d.owner!)) return false;
  final owner = s.players[d.owner!];
  return !owner.neutral || (s.mode == 'survival' && owner.gang == 'police');
}

Result callTriads(MatchState s, int pid, int districtId, int? targetId) {
  final T = F.m('triads'), d = s.map.districts[districtId];
  final target = targetId != null && targetId >= 0 && targetId < s.map.districts.length ? s.map.districts[targetId] : null;
  final check = canCallTriads(s, pid, d, target, true);
  if (!check.ok) return check;
  final player = s.players[pid], heroes = T.l('heroes');
  final spots = findFreeTiles(s.map, target!.capture!.i, target.capture!.j, heroes.length);
  if (spots.isEmpty) return _no('لا مكان هناك');
  spend(s, pid, T.d('cost'));
  d.readyAt = s.time + T.d('cooldown');
  final nation = T.s('nation'), style = nations.m(nation).s('style');
  final fighters = <Unit>[];
  for (var k = 0; k < spots.length; k++) {
    final unit = createUnit(s, player, spots[k].$1, spots[k].$2, heroes[k] as String?, false, style, nation);
    _boost(unit, T.mm('stats'));
    unit.name = T.s('name');
    unit.expireAt = s.time + T.d('seconds');
    s.units.add(unit);
    applyUpgrades(s, unit);
    fighters.add(unit);
  }
  final ti = target.capture!.i.toDouble(), tj = target.capture!.j.toDouble();
  addUltFx(s, 'dust', ti, tj);
  commandAttackMove(s, ti, tj, fighters, false);
  soundAt(s, 'spawn', ti, tj);
  if (target.owner == s.humanId) {
    s.notice = Notice('الترياد يهاجمون حياً من أحيائك!', true, 3);
    sound('alert');
  }
  return _ok();
}

void _expireTriads(MatchState s) {
  Set<Unit>? gone;
  for (final u in s.units) {
    if (u.expireAt < 0 || s.time < u.expireAt || !_alive(u)) continue;
    addUltFx(s, 'dust', u.x, u.y);
    _kill(u);
    (gone ??= {}).add(u);
  }
  if (gone != null) s.units.removeWhere(gone.contains);
}

// ================= إسطبل الفيلة (جايبور) =================
void _trample(MatchState s) {
  final T = F.m('stable').m('trample'), r = T.d('radius'), r2 = r * r;
  for (final u in s.units.toList()) {
    if (u.creature != 'elephant' || !_alive(u) || s.time < u.trampleAt) continue;
    final hit = <Unit>[];
    forEachNearby(s, u.x, u.y, r, (o) {
      final dx = o.x - u.x, dy = o.y - u.y;
      if (dx * dx + dy * dy <= r2 && _alive(o) && isEnemyId(s, u.playerId, o.playerId)) hit.add(o);
    });
    if (hit.isEmpty) continue;
    u.trampleAt = s.time + T.d('every');
    for (final o in hit) { applyDamage(s, u, o, T.d('damage')); }
    addUltFx(s, 'dust', u.x, u.y);
  }
}

// ================= ترول الجبل (القرية النرويجية) =================
void _updateTroll(MatchState s) {
  if (s.mode == 'survival') return;
  final T = F.m('troll'), tick = _tickOf(s), first = _ticks(T.d('first')), every = _ticks(T.d('every'));
  if (tick >= first && (tick - first) % every == 0) _spawnTroll(s);
  _rewardTroll(s);
  if (tick % _ticks(T.d('think')) == 0) _moveTroll(s);
}

void _spawnTroll(MatchState s) {
  final T = F.m('troll'), player = featurePlayer(s), map = s.map;
  if (player == null || s.units.any((u) => u.creature == 'troll' && _alive(u))) return;
  final edge = _edgeRows(map);
  if (edge.isEmpty) return;
  final j = edge[(random() * edge.length).floor()];
  final unit = createUnit(s, player, 0, j, T.ss('hero'));
  _boost(unit, T.mm('stats'));
  unit.name = T.s('name');
  _makeCreature(unit, 'troll', T.d('scale'), T.d('barY'));
  unit.lair = Exit(0, j.toDouble(), s.time + T.d('stay'));
  s.units.add(unit);
  addUltFx(s, 'dust', 0, j.toDouble());
  s.notice = Notice('ترول الجبل نزل إلى المدينة! من يقتله يأخذ ${T.i('reward')} نقطة', false, 4);
  sound('alert');
  _moveTroll(s);
}

void _rewardTroll(MatchState s) {
  final T = F.m('troll');
  for (final u in s.units) {
    if (u.creature != 'troll' || u.state != 'dead' || u.lair == null) continue;
    u.lair = null;
    final killer = u.lastHitBy;
    if (killer < 0 || killer >= s.players.length || s.players[killer].neutral) continue;
    _gain(s, killer, T.d('reward'));
    addPop(s, u, '+${T.i('reward')}', 'loot');
    soundAt(s, 'capture_done', u.x, u.y);
    s.notice = killer == s.humanId
        ? Notice('أسقطت ترول الجبل: +${T.i('reward')} نقطة', true, 3)
        : Notice('${s.players[killer].gangName} أسقطوا ترول الجبل', false, 3);
  }
}

void _moveTroll(MatchState s) {
  final T = F.m('troll');
  for (final u in s.units.toList()) {
    if (u.creature != 'troll' || !_alive(u) || u.lair == null) continue;
    final lair = u.lair!;
    if (s.time >= lair.until) {
      if (hypot(u.x - lair.i, u.y - lair.j) <= 1.6) {
        u.lair = null;
        addUltFx(s, 'dust', u.x, u.y);
        u.hp = 0;
        u.state = 'dead';
        u.deathTimer = 0;
        s.units.remove(u);
        s.notice = Notice('عاد ترول الجبل إلى الجبل', false, 3);
        return;
      }
      if (u.state != 'moving') commandMove(s, lair.i, lair.j, [u], false);
      continue;
    }
    if (u.state == 'attacking') continue;
    final c = T.d('cluster'), r2 = c * c;
    Unit? best;
    var bestCount = 0;
    for (final o in s.units) {
      if (!_soldier(s, o)) continue;
      var count = 0;
      forEachNearby(s, o.x, o.y, c, (p) {
        final dx = p.x - o.x, dy = p.y - o.y;
        if (dx * dx + dy * dy <= r2 && _soldier(s, p)) count++;
      });
      if (count > bestCount) { bestCount = count; best = o; }
    }
    if (best != null) commandAttackMove(s, best.x, best.y, [u], false);
  }
}

// ================= ما يُختار بلمسة على الخريطة =================
Result canPick(MatchState s, int pid, String action, int did, District? target, [bool hasTarget = true]) {
  final d = s.map.districts[did];
  return action == 'rocket' ? canRocket(s, pid, d, target, hasTarget) : canCallTriads(s, pid, d, target, hasTarget);
}

// ================= ورشة البارود (المدينة الصينية) =================
Result canRocket(MatchState s, int pid, District? d, [District? target, bool hasTarget = false]) {
  final P = F.m('powder');
  if (d == null || d.feature != 'powder' || d.featureTile == null || d.owner != pid) return _no('ليست ورشتك');
  if (s.time < d.readyAt) return _no('جاهز بعد ${(d.readyAt - s.time).ceil()} ث');
  if (s.empire!.points[pid] < P.d('cost')) return _no('النقاط لا تكفي');
  if (!hasTarget) return _ok();
  return target != null && target.capture != null && target.owner != pid ? _ok() : _no('اختر حياً ليس لك');
}

Result launchRocket(MatchState s, int pid, int did, int? targetId) {
  final P = F.m('powder'), d = s.map.districts[did];
  final target = targetId != null && targetId >= 0 && targetId < s.map.districts.length ? s.map.districts[targetId] : null;
  final check = canRocket(s, pid, d, target, true);
  if (!check.ok) return check;
  spend(s, pid, P.d('cost'));
  d.readyAt = s.time + P.d('cooldown');
  final x = target!.capture!.i.toDouble(), y = target.capture!.j.toDouble();
  s.fireworks.add(Firework(x, y, _tickOf(s) + _ticks(P.d('delay')), pid));
  _dodgeFireworks(s, x, y);
  soundAt(s, 'ult_cast', d.capture!.i.toDouble(), d.capture!.j.toDouble());
  s.notice = pid == s.humanId
      ? Notice('انطلق صاروخ البارود: ينفجر بعد ${P.i('delay')} ث', true, 2.5)
      : Notice('${s.players[pid].gangName} أطلقوا صاروخ البارود!', false, 3);
  return _ok();
}

// ================= الكاتدرائية (المدينة الأوروبية) =================
Result canRingBells(MatchState s, int pid, District? d) {
  if (d == null || d.feature != 'cathedral' || d.featureTile == null || d.owner != pid) return _no('ليست كاتدرائيتك');
  if (s.time < d.readyAt) return _no('تُقرع بعد ${(d.readyAt - s.time).ceil()} ث');
  return _ok();
}

Result ringBells(MatchState s, int pid, int did) {
  final C = F.m('cathedral'), d = s.map.districts[did];
  final check = canRingBells(s, pid, d);
  if (!check.ok) return check;
  d.readyAt = s.time + C.d('cooldown');
  d.rangAt = s.time;
  final until = s.time + C.d('seconds');
  for (final u in s.units) { if (u.playerId == pid && _alive(u)) u.rallyUntil = until; }
  soundAt(s, 'ult_ready', d.capture!.i.toDouble(), d.capture!.j.toDouble());
  s.notice = pid == s.humanId
      ? Notice('دقت أجراس الكاتدرائية: جنودك أسرع وأقوى ${C.i('seconds')} ث', true, 3)
      : Notice('${s.players[pid].gangName} قرعوا أجراس الكاتدرائية!', false, 3);
  return _ok();
}

// ================= منجم الفضة (المكسيكية) =================
void _updateMine(MatchState s) {
  final M = F.m('mine');
  for (final d in s.map.districts) {
    if (d.feature != 'mine') continue;
    if (d.owner != d.mineOwner) { d.mineOwner = d.owner; d.mineSince = s.time; }
    final rate = d.owner == null ? 0.0 : math.min(M.d('max'), M.d('base') + M.d('step') * ((s.time - d.mineSince) / M.d('every')).floor());
    if (d.mineRate != rate) d.mineRate = rate;
  }
}

// ================= البنك (شيكاغو) =================
void _updateBank(MatchState s) {
  final B = F.m('bank');
  for (final d in s.map.districts) {
    if (d.feature != 'bank') continue;
    if (d.vault < B.d('cap')) d.vault = math.min(B.d('cap'), d.vault + B.d('fill') * TICK_SEC);
    if (d.owner == d.bankOwner) continue;
    d.bankOwner = d.owner;
    if (d.owner == null || s.players[d.owner!].neutral) continue;
    final loot = d.vault.floor();
    d.vault = 0;
    if (loot == 0) continue;
    _gain(s, d.owner!, loot);
    soundAt(s, 'capture_done', d.capture!.i.toDouble(), d.capture!.j.toDouble());
    s.notice = d.owner == s.humanId
        ? Notice('سرقت البنك: +$loot نقطة', true, 3)
        : Notice('${s.players[d.owner!].gangName} سرقوا البنك: $loot نقطة', false, 3);
  }
}
