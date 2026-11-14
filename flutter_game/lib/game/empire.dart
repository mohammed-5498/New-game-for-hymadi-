// اقتصاد الإمبراطورية (js/game/empire.js): النقاط والطوابير والترقيات والمباني والأبراج والمستشفيات والتحصين
import 'dart:collection';
import 'dart:math' as math;

import '../audio/sound.dart';
import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../map/generator.dart';
import '../map/pathfinding.dart';
import '../map/sizes.dart';
import 'abilities.dart' show sourceOf;
import 'combat.dart';
import 'features.dart';
import 'spatial.dart';
import 'spawn.dart';
import 'state.dart';
import 'units.dart';

final J E = EMPIRE;
final J _DS = DISTRICT_SIZES;

class Levels { int hp = 0, damage = 0, armor = 0, speed = 0;
  int operator [](String k) => k == 'hp' ? hp : k == 'damage' ? damage : k == 'armor' ? armor : speed;
  void operator []=(String k, int v) { if (k == 'hp') { hp = v; } else if (k == 'damage') { damage = v; } else if (k == 'armor') { armor = v; } else { speed = v; } }
}

class QueueItem { final String kind; final int payer; double t = 0; QueueItem(this.kind, this.payer); }

class TowerShot {
  final int owner;
  final Unit target;
  final double i, j, top;          // top: ارتفاع منبع السهم (أبراج المزايا، رسم)
  double t = 0, prevT = 0;
  final double duration, damage;
  TowerShot(this.owner, this.target, this.i, this.j, this.duration, this.damage, [this.top = 0]);
}

class EmpireState {
  final List<double> points, earned;
  final List<int> bounties;
  final List<Levels> levels;
  final queues = SplayTreeMap<int, List<QueueItem>>();   // مفاتيح أرقام: بترتيبها كـ Object.keys في JavaScript
  List<TowerShot> shots = [];
  double incomeMul = 0;                                   // 0 = غير محدد (|| 1)
  EmpireState(int n)
      : points = List.filled(n, E.d('startPoints'), growable: true),
        earned = List.filled(n, 0, growable: true),
        bounties = List.filled(n, 0, growable: true),
        levels = List.generate(n, (_) => Levels(), growable: true);
}

class Result { final bool ok; final String reason; const Result(this.ok, this.reason); }
Result _fail(String reason) => Result(false, reason);
const _ok = Result(true, '');

const BUILDING_TILE = {'hq': tQ, 'tower': 0x54, 'hospital': 0x4D};
const _fixedKinds = {'wallI', 'wallJ', 'gateI', 'gateJ', 'archI', 'archJ', 'wallTower', 'brokenI', 'brokenJ', 'brokenTower', 'monument',
  'fortI', 'fortJ', 'fortTower'};

void _fortify(GameMap map, District district) {
  final art = E.m('art').mm(map.city);
  if (art == null || !art.b('fort')) return;
  final at = tileOf(map, district.buildTile!);
  for (var dj = -1; dj <= 1; dj++) {
    for (var di = -1; di <= 1; di++) {
      final i = at.i + di, j = at.j + dj;
      if ((di == 0 && dj == 0) || !map.inBounds(i, j)) continue;
      final k = map.idx(i, j);
      if (map.road[k] != 0 || map.districtAt[k] != district.id || (map.type[k] != tH && map.type[k] != tR)) continue;
      if (_fixedKinds.contains(map.kind[k])) continue;
      map.type[k] = tH;
      map.kind[k] = di != 0 && dj != 0 ? 'fortTower' : di != 0 ? 'fortJ' : 'fortI';
    }
  }
}

void initEmpire(MatchState state) {
  final players = state.players;
  state.empire = EmpireState(players.length);
  for (final player in players) {
    if (player.homeDistrictId < 0 || player.homeDistrictId >= state.map.districts.length) continue;
    final home = state.map.districts[player.homeDistrictId];
    int? k;
    for (final (i, j) in home.tiles) { final x = state.map.idx(i, j); if (state.map.type[x] == tQ) { k = x; break; } }
    if (k == null) continue;
    home.building = 'hq';
    home.buildTile = k;
    home.blv = {};
    _fortify(state.map, home);
  }
}

void updateEmpire(MatchState state) {
  final ms = state.empire!;
  if (!state.empireHinted && state.notice == null) {
    state.empireHinted = true;
    state.notice = Notice('المس مبنى قاعدتك مرتين بسرعة لقائمته، وأي حي لك بلا مبنى لتبني فيه', true, E.d('hintSeconds'), true);
  }
  _collectIncome(state, ms);
  _rewardLeaderKills(state, ms);
  _updateQueues(state, ms);
  _updateTowers(state, ms);
  _updateShots(state, ms);
  _updateHospitals(state);
}

void _collectIncome(MatchState state, EmpireState ms) {
  final mul = (ms.incomeMul != 0 ? ms.incomeMul : 1) * TICK_SEC;
  for (final d in state.map.districts) {
    if (d.owner == null || d.capture == null || state.players[d.owner!].neutral) continue;
    final gain = districtIncome(d) * mul * _botIncome(state.players[d.owner!]) * featureIncomeMul(state, d.owner!) * eventIncomeMul(state, d);
    ms.points[d.owner!] += gain;
    ms.earned[d.owner!] += gain;
  }
}

void _rewardLeaderKills(MatchState state, EmpireState ms) {
  for (final unit in state.units) {
    if (!unit.champion || unit.state != 'dead' || unit.leaderPaid) continue;
    unit.leaderPaid = true;
    final killer = unit.lastHitBy;
    if (killer < 0 || killer == unit.playerId || killer >= state.players.length || state.players[killer].neutral) continue;
    ms.points[killer] += E.d('leaderKill');
    ms.earned[killer] += E.d('leaderKill');
    ms.bounties[killer]++;
    if (killer == state.humanId) {
      state.notice = Notice('أسقطت زعيم ${state.players[unit.playerId].gangName}: +${E.i('leaderKill')} نقطة', true, 3);
    }
  }
}

final _incomeMul = E.m('income').d('mul');   // نصف الدخل (2026-11-12)
double districtIncome(District d) => _incomeMul *
    (d.building == 'hq' ? E.m('income').d('hq') * _DS.m('income').d(sizeOf(d)) : featureIncome(d) ?? E.m('income').d('district') * _DS.m('income').d(sizeOf(d)));

double _lvl(Player player, String key) {
  if (player.isHuman || player.neutral) return 1;
  final lvl = ai.m('levels').mm(player.difficulty);
  return lvl != null && truthy(lvl[key]) ? lvl.d(key) : 1;
}
double _botFactor(Player p) => _lvl(p, 'spawnFactor');
double _botIncome(Player p) => _lvl(p, 'incomeFactor');

double productionTime(MatchState state, District district, String kind) {
  final level = district.blv['production'] ?? 0;
  final owner = district.owner != null ? state.players[district.owner!] : null;
  final horde = owner != null && owner.gang == 'scorpions' && E.m('units').has(kind) ? 1 + STYLE_PERKS.m('horde').d('production') : 1;
  return _unitCost(kind).d('seconds') * (E.m('buildings').m('hq').m('upgrades').m('production').l('times')[level] as num) *
      _DS.m('production').d(sizeOf(district)) *
      (owner != null ? _botFactor(owner) * featureProductionMul(state, owner.id) : 1) * eventProductionMul(state) / horde *
      (state.story != null && owner != null && owner.team == 2 ? (STORY.l('enemyProduction')[state.story!.level] as num) : 1);
}

J _unitCost(String kind) => E.m('units').mm(kind) ?? CITY_FEATURES.m('recruits').m(kind);
int unitPrice(MatchState state, int playerId, String kind) =>
    jsRound(_unitCost(kind).d('cost') * _classPrice(state.players[playerId], kind) * featureCostMul(state, playerId) * eventCostMul(state));
double _classPrice(Player player, String kind) {
  final c = E.m('units').has(kind) ? STYLE_PERKS.m('classes').mm(player.gang) : null;
  return c != null && truthy(c['price']) ? c.d('price') : 1;
}
int _priced(MatchState? state, num cost) => state != null ? jsRound(cost * eventCostMul(state)) : cost.toInt();
int buildCost(MatchState? state, String type) => _priced(state, E.m('buildings').m(type).d('cost'));

bool _producesAt(District district, String kind) => E.m('units').has(kind) ? district.building == 'hq' : (recruitsAt(district) ?? const []).contains(kind);

void _updateQueues(MatchState state, EmpireState ms) {
  for (final id in ms.queues.keys.toList()) {
    final queue = ms.queues[id]!;
    if (queue.isEmpty) continue;
    final district = state.map.districts[id];
    for (var k = queue.length - 1; k >= 0; k--) {
      if (!_producesAt(district, queue[k].kind) || district.owner != queue[k].payer) queue.removeAt(k);
    }
    if (queue.isEmpty) continue;
    final item = queue[0], owner = district.owner!;
    if (countUnits(state, owner) >= state.maxUnits) continue;
    item.t += TICK_SEC;
    if (item.t < productionTime(state, district, item.kind)) continue;
    if (_produce(state, state.players[owner], district, item.kind)) queue.removeAt(0);
  }
}

String? heroFor(Player player, String kind) {
  if (kind == 'common' || kind == 'leader') return null;
  final gang = GANGS.mm(player.gang);
  final heroes = gang != null ? gang.l('heroes').cast<String>() : const <String>[];
  final elite = E.m('elite').ss(player.gang);
  if (kind == 'elite') return elite;
  for (final h in heroes) { if (h != elite) return h; }
  return null;
}

bool _produce(MatchState state, Player player, District district, String kind) {
  if (!E.m('units').has(kind)) return spawnRecruit(state, player, district, kind);   // مجنَّد مبنى مميز (features.dart)
  if (kind == 'leader') {
    final leader = spawnChampion(state, player, district);
    if (leader != null) { applyUpgrades(state, leader); _toRally(state, district, leader); }
    return leader != null;
  }
  final spots = findFreeTiles(state.map, district.capture!.i, district.capture!.j, SPAWN.i('spotSearchTiles'));
  if (spots.isEmpty) return false;
  final (i, j) = spots[(random() * spots.length).floor()];
  final unit = createUnit(state, player, i, j, heroFor(player, kind));
  state.units.add(unit);
  applyUpgrades(state, unit);
  _toRally(state, district, unit);
  soundAt(state, 'spawn', i.toDouble(), j.toDouble());
  return true;
}

void _toRally(MatchState state, District district, Unit unit) {
  final r = district.rally;
  if (r == null || r.owner != district.owner) return;
  final t = tileOf(state.map, r.k);
  commandAttackMove(state, t.i.toDouble(), t.j.toDouble(), [unit], false);
}

Result canRally(MatchState state, int playerId, District? district) {
  if (district == null || district.building != 'hq' || district.owner != playerId) return _fail('ليست قاعدتك');
  return _ok;
}

Result setRally(MatchState state, int playerId, int d, num x) {
  final district = state.map.districts[d], check = canRally(state, playerId, district);
  if (!check.ok) return check;
  final k = jsRound(x.toDouble()), n = state.map.n;
  district.rally = k >= 0 && k < n * n ? (k: k, owner: playerId) : null;
  return _ok;
}

final _hpPer = E.m('upgrades').m('hp').d('per');
void applyUpgrades(MatchState state, Unit unit) {
  final factor = 1 + state.empire!.levels[unit.playerId].hp * _hpPer;
  unit.maxHp = unit.stats.d('hp') * factor;
  unit.hp = unit.maxHp;
  _rangedUpgrade(state, unit);
}

// ترقية الخانة الرابعة بفئة اللاعب (بطلب المستخدم، 2026-11-12): إعدادها ومستواها، أو null للخاطف (سرعة المشي والتجنب)
final _classes = E.m('upgrades').m('speed').m('classes');
({J c, int level})? classUpgrade(MatchState state, int playerId) {
  if (!state.economy) return null;
  final c = _classes.mm(state.players[playerId].gang), level = state.empire!.levels[playerId].speed;
  return c != null && level != 0 ? (c: c, level: level) : null;
}

// الرامي: مداه ورصده يزيدان بمستواه، والمضاف محفوظ في stats.rangeUp فلا يتكرر
void _rangedUpgrade(MatchState state, Unit unit) {
  if (!truthy(unit.stats['projectile']) || state.players[unit.playerId].gang != 'vipers') return;
  final up = classUpgrade(state, unit.playerId), want = up != null ? up.level * up.c.d('range') : 0.0;
  final delta = want - unit.stats.dz('rangeUp');
  if (delta == 0) return;
  unit.stats['attackRange'] = unit.stats.d('attackRange') + delta;
  unit.stats['visionRange'] = unit.stats.d('visionRange') + delta;
  unit.stats['rangeUp'] = want;
}

// خرق الدرع للرامي، والحشد يحتل أسرع
double classPierce(MatchState state, int playerId) {
  final up = classUpgrade(state, playerId);
  return up != null && up.c['pierce'] != null ? up.level * up.c.d('pierce') : 0;
}
double classCaptureMul(MatchState state, int playerId) {
  final up = classUpgrade(state, playerId);
  return up != null && up.c['capture'] != null ? 1 + up.level * up.c.d('capture') : 1;
}

final _damagePer = E.m('upgrades').m('damage').d('per'), _armorPer = E.m('upgrades').m('armor').d('per');
final _speedPer = E.m('upgrades').m('speed').d('per'), _evadePer = E.m('upgrades').m('speed').d('evade');
double empireDamageBonus(MatchState state, int playerId) => state.empire!.levels[playerId].damage * _damagePer;
double empireArmorBonus(MatchState state, int playerId) => state.empire!.levels[playerId].armor * _armorPer;
double empireSpeedMul(MatchState state, int playerId) =>
    _classes.has(state.players[playerId].gang) ? 1 : 1 + state.empire!.levels[playerId].speed * _speedPer;   // لغير الخاطف أثر آخر
double empireEvade(MatchState state, int playerId) =>
    _classes.has(state.players[playerId].gang) ? 0 : state.empire!.levels[playerId].speed * _evadePer;

({int i, int j}) tileOf(GameMap map, int k) => (i: k % map.n, j: k ~/ map.n);

({double range, double damage, double attackTime}) towerStats(District district, [MatchState? state]) {
  final T = E.m('buildings').m('tower'), lv = district.blv, size = sizeOf(district);
  return (
    range: T.d('range') * _DS.m('reach').d(size) * (state != null ? rangeMul(state, district.owner ?? -1) : 1),
    damage: T.d('damage') * _DS.m('power').d(size) * (1 + (lv['damage'] ?? 0) * T.m('upgrades').m('damage').d('per')),
    attackTime: T.d('attackTime') * (1 - (lv['rate'] ?? 0) * T.m('upgrades').m('rate').d('per')),
  );
}

void _updateTowers(MatchState state, EmpireState ms) {
  for (final d in state.map.districts) {
    if (d.building != 'tower' || d.owner == null || state.players[d.owner!].neutral) continue;
    if (d.cool > 0) { d.cool -= TICK_SEC; continue; }
    final at = tileOf(state.map, d.buildTile!), stats = towerStats(d, state);
    final target = _nearestEnemy(state, d.owner!, at, stats.range);
    if (target == null) continue;
    d.cool = stats.attackTime;
    ms.shots.add(TowerShot(d.owner!, target, at.i.toDouble(), at.j.toDouble(), E.m('arrow').d('flight'), stats.damage));
    soundAt(state, 'arrow', at.i.toDouble(), at.j.toDouble());
  }
}

Unit? _nearestEnemy(MatchState state, int owner, ({int i, int j}) at, double range) {
  Unit? best;
  var bestD = range;
  forEachNearby(state, at.i.toDouble(), at.j.toDouble(), range, (unit) {
    if (!isAlive(unit) || !isEnemyId(state, owner, unit.playerId)) return;
    final d = hypot(unit.x - at.i, unit.y - at.j);
    if (d <= bestD) { bestD = d; best = unit; }
  });
  return best;
}

void _updateShots(MatchState state, EmpireState ms) {
  if (ms.shots.isEmpty) return;
  final left = <TowerShot>[];
  for (final shot in ms.shots) {
    shot.prevT = shot.t;
    shot.t += TICK_SEC;
    if (shot.t < shot.duration) { left.add(shot); continue; }
    if (isAlive(shot.target) && !stormMiss(state, shot.owner)) applyDamage(state, sourceOf(shot.owner), shot.target, shot.damage, true);
  }
  ms.shots = left;
}

bool isHospital(District d) => d.special == 'hospital' || d.building == 'hospital';
({int i, int j}) healPoint(GameMap map, District d) => d.building == 'hospital' ? tileOf(map, d.buildTile!) : (i: d.capture!.i, j: d.capture!.j);

({double radius, double perSecond}) hospitalStats(District district) {
  final H = E.m('buildings').m('hospital'), lv = district.blv, size = sizeOf(district);
  return (
    radius: (H.d('radius') + (lv['radius'] ?? 0) * H.m('upgrades').m('radius').d('per')) * _DS.m('reach').d(size),
    perSecond: H.d('perSecond') * _DS.m('power').d(size) * (1 + (lv['rate'] ?? 0) * H.m('upgrades').m('rate').d('per')),
  );
}

void _updateHospitals(MatchState state) {
  for (final d in state.map.districts) {
    if (d.building != 'hospital' || d.owner == null || state.players[d.owner!].neutral) continue;
    final at = tileOf(state.map, d.buildTile!), stats = hospitalStats(d);
    final amount = stats.perSecond * TICK_SEC, r2 = stats.radius * stats.radius;
    forEachNearby(state, at.i.toDouble(), at.j.toDouble(), stats.radius, (unit) {
      if (unit.playerId != d.owner || !isAlive(unit) || unit.hp >= unit.maxHp) return;
      final dx = unit.x - at.i, dy = unit.y - at.j;
      if (dx * dx + dy * dy <= r2) unit.hp = math.min(unit.maxHp, unit.hp + amount);
    });
  }
}

// ================= الأوامر (القائمة والبوتات): كل أمر يعيد Result =================
double pointsOf(MatchState state, int playerId) => state.empire!.points[playerId];
bool _owns(MatchState state, int playerId, District? d) => d != null && d.owner == playerId;

bool _leaderTaken(MatchState state, int playerId) {
  if (championOf(state, playerId) != null) return true;
  return state.empire!.queues.values.any((q) => q.any((item) => item.payer == playerId && item.kind == 'leader'));
}

void spend(MatchState state, int playerId, num amount) {
  state.empire!.points[playerId] -= amount;
  payTax(state, playerId, amount.toDouble());
}

Result canQueue(MatchState state, int playerId, District? district, String kind) {
  if (!_owns(state, playerId, district) || !_producesAt(district!, kind)) return _fail(E.m('units').has(kind) ? 'ليست قاعدتك' : 'ليس مبناك');
  final queue = state.empire!.queues[district.id] ?? const [];
  if (kind == 'leader' && _leaderTaken(state, playerId)) return _fail('لعصابتك زعيم');
  if (queue.length >= E.i('queueMax')) return _fail('الطابور ممتلئ');
  final R = CITY_FEATURES.m('recruits').mm(kind);
  if (R != null && truthy(R['limit']) && _recruitCount(state, playerId, kind) >= R.d('limit')) return _fail(R.s('limitText'));
  if (pointsOf(state, playerId) < unitPrice(state, playerId, kind)) return _fail('النقاط لا تكفي');
  return _ok;
}

int _recruitCount(MatchState state, int playerId, String kind) {
  var n = 0;
  for (final u in state.units) { if (u.playerId == playerId && u.recruitKind == kind && u.state != 'dead') n++; }
  for (final q in state.empire!.queues.values) { for (final it in q) { if (it.payer == playerId && it.kind == kind) n++; } }
  return n;
}

Result queueUnit(MatchState state, int playerId, int districtId, String kind) {
  final district = state.map.districts[districtId];
  final check = canQueue(state, playerId, district, kind);
  if (!check.ok) return check;
  spend(state, playerId, unitPrice(state, playerId, kind));
  (state.empire!.queues[districtId] ??= []).add(QueueItem(kind, playerId));
  return _ok;
}

({int level, int cost})? nextUpgrade(MatchState state, int playerId, String key) {
  final level = state.empire!.levels[playerId][key];
  final costs = E.m('upgrades').m(key).l('costs');
  return level < costs.length ? (level: level + 1, cost: _priced(state, costs[level] as num)) : null;
}

Result canUpgrade(MatchState state, int playerId, String key) {
  final next = nextUpgrade(state, playerId, key);
  if (next == null) return _fail('أعلى مستوى');
  if (pointsOf(state, playerId) < next.cost) return _fail('النقاط لا تكفي');
  return _ok;
}

Result buyUpgrade(MatchState state, int playerId, String key) {
  final check = canUpgrade(state, playerId, key);
  if (!check.ok) return check;
  final next = nextUpgrade(state, playerId, key)!;
  spend(state, playerId, next.cost);
  state.empire!.levels[playerId][key] = next.level;
  if (key == 'hp') {
    final factor = 1 + next.level * _hpPer;
    for (final unit in state.units) {
      if (unit.playerId != playerId || !isAlive(unit)) continue;
      final max = unit.stats.d('hp') * factor;
      unit.hp *= max / unit.maxHp;
      unit.maxHp = max;
    }
  }
  // مدى الرامي: جنوده الحاليون أيضاً
  if (key == 'speed') { for (final unit in state.units) { if (unit.playerId == playerId && isAlive(unit)) _rangedUpgrade(state, unit); } }
  return _ok;
}

int buildSpot(GameMap map, District district) {
  var best = -1;
  var bestD = double.infinity;
  for (final (i, j) in district.tiles) {
    final k = map.idx(i, j), type = map.type[k];
    if ((type != tH && type != tR) || _fixedKinds.contains(map.kind[k])) continue;
    final d = hypot(i - district.cx, j - district.cy);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

Result canBuild(MatchState state, int playerId, District? district, String type) {
  if (!_owns(state, playerId, district)) return _fail('ليس حيك');
  final d = district!;
  if (d.building != null) return _fail('في الحي مبنى');
  if (d.police) return _fail('مركز شرطة');
  if (d.hill) return _fail('التلة لا يُبنى فيها');
  if (d.featureTile != null) return _fail('معلم المدينة');
  if (buildSpot(state.map, d) < 0) return _fail('لا مكان للبناء');
  if (pointsOf(state, playerId) < buildCost(state, type)) return _fail('النقاط لا تكفي');
  return _ok;
}

Result buildDistrict(MatchState state, int playerId, int districtId, String type) {
  final district = state.map.districts[districtId];
  final check = canBuild(state, playerId, district, type);
  if (!check.ok) return check;
  final k = buildSpot(state.map, district);
  spend(state, playerId, buildCost(state, type));
  district.building = type;
  district.buildTile = k;
  district.blv = {};
  district.lastUp = null;
  district.cool = 0;
  state.map.type[k] = BUILDING_TILE[type]!;
  if (type == 'hq') _fortify(state.map, district);
  state.mapVersion++;
  soundAt(state, 'capture_done', district.capture!.i.toDouble(), district.capture!.j.toDouble());
  return _ok;
}

({int level, int cost})? nextBuildingUpgrade(District district, String key, [MatchState? state]) {
  final b = district.building == null ? null : E.m('buildings').mm(district.building!);
  final U = b?.mm('upgrades');
  if (U == null || !U.has(key)) return null;
  final level = district.blv[key] ?? 0;
  final costs = U.m(key).l('costs');
  return level < costs.length ? (level: level + 1, cost: _priced(state, costs[level] as num)) : null;
}

Result canUpgradeBuilding(MatchState state, int playerId, District? district, String key) {
  if (!_owns(state, playerId, district)) return _fail('ليس حيك');
  final next = nextBuildingUpgrade(district!, key, state);
  if (next == null) return _fail('أعلى مستوى');
  if (pointsOf(state, playerId) < next.cost) return _fail('النقاط لا تكفي');
  return _ok;
}

Result upgradeBuilding(MatchState state, int playerId, int districtId, String key) {
  final district = state.map.districts[districtId];
  final check = canUpgradeBuilding(state, playerId, district, key);
  if (!check.ok) return check;
  final next = nextBuildingUpgrade(district, key, state)!;
  spend(state, playerId, next.cost);
  district.blv = {...district.blv, key: next.level};
  district.lastUp = key;
  state.mapVersion++;
  return _ok;
}

({int level, int cost})? nextFort(District? district, [MatchState? state, int pid = -1]) {
  final level = district?.fort ?? 0;
  final C = E.m('fortify').l('costs');
  if (level >= C.length) return null;
  // بنصف السعر لمالك بوابة كانو القديمة (12هـ)
  final half = state != null && pid >= 0 && buildingOwner(state, 'kanoGate') == pid;
  final c = C[level] as num;
  return (level: level + 1, cost: _priced(state, half ? jsRound(c * CITY_FEATURES.m('kanoGate').d('fortifyMul')) : c));
}

Result canFortify(MatchState state, int playerId, District? district) {
  if (!_owns(state, playerId, district)) return _fail('ليس حيك');
  final next = nextFort(district, state, playerId);
  if (next == null) return _fail('أعلى مستوى');
  if (pointsOf(state, playerId) < next.cost) return _fail('النقاط لا تكفي');
  return _ok;
}

Result fortifyDistrict(MatchState state, int playerId, int districtId) {
  final district = state.map.districts[districtId];
  final check = canFortify(state, playerId, district);
  if (!check.ok) return check;
  final next = nextFort(district, state, playerId)!;
  spend(state, playerId, next.cost);
  district.fort = next.level;
  state.mapVersion++;
  soundAt(state, 'capture_done', district.capture!.i.toDouble(), district.capture!.j.toDouble());
  return _ok;
}

Result empireCommand(MatchState state, int playerId, String a, int d, Object? x) {
  final district = d >= 0 && d < state.map.districts.length ? state.map.districts[d] : null;
  if (a == 'queue' && (E.m('units').l('order').contains(x) || CITY_FEATURES.m('recruits').has('$x'))) return queueUnit(state, playerId, d, x as String);
  if (a == 'triads') return callTriads(state, playerId, d, x as int?);
  if (a == 'bells') return ringBells(state, playerId, d);
  if (a == 'rocket') return launchRocket(state, playerId, d, x as int?);
  if (a == 'upgrade' && E.m('upgrades').l('order').contains(x)) return buyUpgrade(state, playerId, x as String);
  if (a == 'fortify') return fortifyDistrict(state, playerId, d);
  if (a == 'rally') return setRally(state, playerId, d, x as num);
  if (a == 'build' && E.m('buildings').l('order').contains(x)) return buildDistrict(state, playerId, d, x as String);
  if (a == 'improve' && district != null && district.building != null &&
      E.m('buildings').m(district.building!).m('upgrades').l('order').contains(x)) {
    return upgradeBuilding(state, playerId, d, x as String);
  }
  return _fail('');
}

double incomeOf(MatchState state, int playerId) {
  double total = 0;
  for (final d in state.map.districts) {
    if (d.owner != playerId || d.capture == null) continue;
    total += districtIncome(d) * eventIncomeMul(state, d);
  }
  return total * (state.empire!.incomeMul != 0 ? state.empire!.incomeMul : 1) * featureIncomeMul(state, playerId);
}
