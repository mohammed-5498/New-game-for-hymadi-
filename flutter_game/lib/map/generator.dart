// توليد الخريطة: منقول سطراً بسطر من js/map/generator.js. بالبذرة نفسها تخرج الخريطة نفسها في النسختين
// (test/map_parity_test.dart)، فكل سحب عشوائي هنا بترتيبه هناك. الفرق: العشوائية من Rng ببذرة لا Math.random
import 'dart:math' as math;
import 'dart:typed_data';

import '../config.dart';
import '../core/fmath.dart';
import '../data/cities.dart';
import 'sizes.dart';

// أنواع المربعات (map.type): رموز الحروف في js/map/generator.js
const tDot = 0x2E, tH = 0x48, tR = 0x52, tP = 0x50, tQ = 0x51, tN = 0x4E, tF = 0x46, tLowF = 0x66,
    tWater = 0x7E, tY = 0x59, tS = 0x53, tG = 0x47, tC = 0x43, tO = 0x4F;

const D4 = [(1, 0), (-1, 0), (0, 1), (0, -1)];
const D8 = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)];

const SPECIAL_BUILDINGS = {'hospital': [tS], 'armory': [tG], 'clock': [tC, tO]};
const SPECIAL_NAMES = {'hospital': 'المستشفى', 'armory': 'مخزن السلاح', 'clock': 'برج الساعة'};

// ما يحتاجه المولّد من اللاعب: عصابته وفريقه، ويكتب فيه حيه المنزلي
class MapPlayer {
  final String gang;
  final int team;
  int homeDistrictId = -1;
  MapPlayer(this.gang, [this.team = 0]);
}

class District {
  final int id;
  final List<(int, int)> tiles = [];
  double cx = 0, cy = 0;
  String region = 'neutral';
  bool capturable = false;
  ({int i, int j})? capture;
  bool isHome = false;
  String? special;
  String? feature;
  bool police = false, policeDisabled = false, policeMain = false;
  int? owner;
  double progress = 0;
  int? progressOwner;
  int? featureTile;
  bool featureBig = false;
  District(this.id);
}

class GameMap {
  final MapSize size;
  final int n;
  int land;
  String city = '';
  int seed = 0;
  final Uint8List road, type, dash;
  final List<String> region;
  final List<String?> kind;
  final Map<int, String> decor = {};
  final Int32List districtAt;
  List<District> districts = [];
  Uint8List? connected;

  GameMap(this.size)
      : n = size.n,
        land = size.n,
        road = Uint8List(size.n * size.n),
        type = Uint8List(size.n * size.n)..fillRange(0, size.n * size.n, tDot),
        dash = Uint8List(size.n * size.n),
        region = List.filled(size.n * size.n, 'neutral'),
        kind = List.filled(size.n * size.n, null),
        districtAt = Int32List(size.n * size.n)..fillRange(0, size.n * size.n, -1);

  int idx(int i, int j) => j * n + i;
  bool inBounds(int i, int j) => i >= 0 && j >= 0 && i < n && j < n;
  // الوحدات تمشي على الشوارع والأرض الفارغة وساحات العلم فقط
  bool isWalkable(int i, int j) {
    if (!inBounds(i, j)) return false;
    final k = j * n + i, t = type[k];
    return road[k] == 1 || t == tDot || t == tP;
  }
  bool isConnected(int i, int j) => isWalkable(i, j) && (connected == null || connected![idx(i, j)] == 1);
  District? districtOf(int i, int j) {
    if (!inBounds(i, j)) return null;
    final d = districtAt[idx(i, j)];
    return d < 0 ? null : districts[d];
  }
}

T _pickWeighted<T>(List<(T, double)> table, Rng rnd) {
  var total = 0.0;
  for (final (_, w) in table) { total += w; }
  var r = rnd() * total;
  for (final (key, w) in table) {
    r -= w;
    if (r <= 0) return key;
  }
  return table[0].$1;
}

String resolveCity(String city, Rng rnd) =>
    CITY_THEMES.containsKey(city) ? city : CITIES.order[rnd.below(CITIES.order.length)];

// specials: false بلا أحياء مميزة (كل مباراة على الاقتصاد)، features: مزايا المدن (القسم 3.11)
GameMap? createMap(String sizeKey, List<MapPlayer> players, String city, Rng rnd,
    {bool specials = true, bool features = false}) {
  final size = MAP_SIZES[sizeKey] ?? MAP_SIZES['medium']!;
  final cityKey = resolveCity(city, rnd);
  for (var attempt = 0; attempt < MAP_GEN.maxTries; attempt++) {
    final map = _buildMap(size, players, cityKey, rnd, specials, features);
    if (map != null) return map;
  }
  return null;
}

GameMap? _buildMap(MapSize size, List<MapPlayer> players, String cityKey, Rng rnd, bool specials, bool features) {
  final map = GameMap(size);
  map.city = cityKey;
  map.seed = rnd.below(1000000000);
  final w = CITIES.water[cityKey];
  final water = w == null ? 0 : size.key == 'small' ? w.small : size.key == 'large' ? w.large : w.medium;
  map.land = map.n - water;
  for (var j = 0; j < map.n; j++) {
    for (var i = map.land; i < map.n; i++) { map.type[map.idx(i, j)] = tWater; }
  }
  _carveStreets(map, rnd);
  if (!_roadsConnected(map)) return null;

  final districts = _findDistricts(map);
  if (!_assignHomeDistricts(map, districts, players)) return null;
  if (specials) _assignSpecialDistricts(map, districts, size, rnd);
  _assignPoliceDistricts(map, districts, size, rnd);
  if (features) _assignFeatures(map, districts, size, rnd);
  _fillDistricts(map, districts, rnd);
  map.districts = districts;
  final walls = CITIES.walls[cityKey];
  if (walls != null) _buildCityWalls(map, walls, rnd);
  if (map.land < map.n && CITIES.water[cityKey]!.huts) _placeRorbu(map, rnd);
  repairIsolatedPockets(map);
  _decorateRoads(map, rnd);
  _placeMonument(map);
  return map;
}

// معلم المنطقة: يحل محل مبنى عادي قرب الوسط، يفضّل الركن الأمامي للحي. بلا رقم عشوائي
void _placeMonument(GameMap map) {
  final city = CITY_THEMES[map.city], open = CITIES.open[map.city];
  if (city == null || !city.monument || (open != null && open.roundabout != null)) return;
  final n = map.n, ci = (map.land - 1) / 2, cj = (n - 1) / 2;
  bool road(int i, int j) => map.inBounds(i, j) && map.road[map.idx(i, j)] == 1;
  var best = -1;
  var bestScore = double.infinity;
  for (var j = 0; j < n; j++) {
    for (var i = 0; i < map.land; i++) {
      final k = map.idx(i, j), kind = map.kind[k];
      if (map.type[k] != tH || kind == null || CITY_UNTINTED.contains(kind)) continue;
      final front = (road(i + 1, j) ? 1 : 0) + (road(i, j + 1) ? 1 : 0);
      if (front == 0 && !road(i - 1, j) && !road(i, j - 1)) continue;
      final score = (2 - front) * 1e6 + (i - ci) * (i - ci) + (j - cj) * (j - cj);
      if (score < bestScore) { bestScore = score; best = k; }
    }
  }
  if (best >= 0) map.kind[best] = 'monument';
}

// --- 1) الشوارع ---
void _carveStreets(GameMap map, Rng rnd) {
  final n = map.n, land = map.land;
  final open = CITIES.open[map.city];
  if (open != null) { _carveWideStreets(map, open, rnd); return; }
  int spacing() => MAP_GEN.streetSpacingMin + rnd.below(MAP_GEN.streetSpacingMax - MAP_GEN.streetSpacingMin + 1);
  List<int> lines(int limit) {
    final arr = <int>[];
    var p = 1 + rnd.below(2);
    while (p < limit - 1) { arr.add(p); p += spacing(); }
    return arr;
  }
  final cols = lines(land), rows = lines(n);
  bool near(List<int> arr, int v) => arr.any((a) => (a - v).abs() <= 1);

  for (final c in cols) {
    var cc = c;
    for (var j = 0; j < n; j++) {
      if (!near(rows, j) && rnd() < MAP_GEN.bendChance) {
        map.road[map.idx(cc, j)] = 1;
        cc = (cc + (rnd() < 0.5 ? -1 : 1)).clamp(1, land - 2);
      }
      map.road[map.idx(cc, j)] = 1;
    }
  }
  for (final r in rows) {
    var rr = r;
    for (var i = 0; i < land; i++) {
      if (!near(cols, i) && rnd() < MAP_GEN.bendChance) {
        map.road[map.idx(i, rr)] = 1;
        rr = (rr + (rnd() < 0.5 ? -1 : 1)).clamp(1, n - 2);
      }
      map.road[map.idx(i, rr)] = 1;
    }
  }
  final alleys = jsRound(MAP_GEN.alleysPerSmallMap * (n * n) / (26 * 26));
  for (var k = 0; k < alleys; k++) {
    final i = rnd.below(n), j = rnd.below(n);
    if (map.road[map.idx(i, j)] == 0) continue;
    final d = D4[rnd.below(4)];
    for (var s = 1; s <= MAP_GEN.alleyLength; s++) {
      final a = i + d.$1 * s, b = j + d.$2 * s;
      if (map.inBounds(a, b) && a < land) map.road[map.idx(a, b)] = 1;
    }
  }
}

void _carveWideStreets(GameMap map, OpenCity open, Rng rnd) {
  final n = map.n, land = map.land, w = open.street;
  List<int> lines(int limit) {
    final arr = <int>[];
    var p = 1 + rnd.below(2);
    while (p + w <= limit - 1) { arr.add(p); p += open.spacing[rnd.below(open.spacing.length)]; }
    return arr;
  }
  final cols = lines(land), rows = lines(n);
  for (final c in cols) {
    for (var j = 0; j < n; j++) { for (var d = 0; d < w; d++) { map.road[map.idx(c + d, j)] = 1; } }
  }
  for (final r in rows) {
    for (var i = 0; i < land; i++) { for (var d = 0; d < w; d++) { map.road[map.idx(i, r + d)] = 1; } }
  }
  if (open.roundabout != null && cols.isNotEmpty && rows.isNotEmpty) _carveRoundabout(map, cols, rows, w, open.roundabout!);
}

// دوار في التقاطع الأقرب لمركز الخريطة: جزيرة 'Y' وحولها حلقة شارع
void _carveRoundabout(GameMap map, List<int> cols, List<int> rows, int w, double radius) {
  final mid = (map.n - 1) / 2, half = (w - 1) / 2;
  int nearest(List<int> arr) => arr.reduce((a, b) => (b + half - mid).abs() < (a + half - mid).abs() ? b : a);
  final c = nearest(cols), r = nearest(rows), ci = c + half, cj = r + half;
  final reach = radius.ceil();
  for (var j = (cj - reach).floor(); j <= (cj + reach).ceil(); j++) {
    for (var i = (ci - reach).floor(); i <= (ci + reach).ceil(); i++) {
      if (!map.inBounds(i, j)) continue;
      final di = i - ci, dj = j - cj, k = map.idx(i, j);
      if (di.abs() < w / 2 && dj.abs() < w / 2) { map.road[k] = 0; map.type[k] = tY; }
      else if (di * di + dj * dj <= radius * radius) { map.road[k] = 1; }
    }
  }
}

bool _roadsConnected(GameMap map) {
  final n = map.n;
  var total = 0, startIndex = -1;
  for (var k = 0; k < n * n; k++) {
    if (map.road[k] != 0) { total++; if (startIndex < 0) startIndex = k; }
  }
  if (total == 0) return false;
  final seen = Uint8List(n * n);
  final stack = [startIndex];
  seen[startIndex] = 1;
  var reached = 0;
  while (stack.isNotEmpty) {
    final k = stack.removeLast();
    reached++;
    final i = k % n, j = k ~/ n;
    for (final (dx, dy) in D4) {
      final a = i + dx, b = j + dy;
      if (!map.inBounds(a, b)) continue;
      final nk = map.idx(a, b);
      if (map.road[nk] != 0 && seen[nk] == 0) { seen[nk] = 1; stack.add(nk); }
    }
  }
  return reached == total;
}

// --- 2) الأحياء ---
List<District> _findDistricts(GameMap map) {
  final n = map.n, districts = <District>[];
  bool outside(int k) => map.road[k] != 0 || map.districtAt[k] >= 0 || map.type[k] == tWater || map.type[k] == tY;
  for (var j = 0; j < n; j++) {
    for (var i = 0; i < n; i++) {
      final k = map.idx(i, j);
      if (outside(k)) continue;
      final district = District(districts.length);
      map.districtAt[k] = district.id;
      final stack = [(i, j)];
      while (stack.isNotEmpty) {
        final (a, b) = stack.removeLast();
        district.tiles.add((a, b));
        for (final (dx, dy) in D4) {
          final x = a + dx, y = b + dy;
          if (!map.inBounds(x, y)) continue;
          final nk = map.idx(x, y);
          if (outside(nk)) continue;
          map.districtAt[nk] = district.id;
          stack.add((x, y));
        }
      }
      var sx = 0, sy = 0;
      for (final (a, b) in district.tiles) { sx += a; sy += b; }
      district.cx = sx / district.tiles.length;
      district.cy = sy / district.tiles.length;
      district.capturable = district.tiles.length >= MAP_GEN.minDistrictTiles;
      districts.add(district);
    }
  }
  return districts;
}

// --- 3) الأحياء المنزلية على دائرة حول المركز، من فئة حجم واحدة ---
bool _assignHomeDistricts(GameMap map, List<District> districts, List<MapPlayer> players) {
  final n = map.n;
  final center = (n - 1) / 2, radius = n * MAP_GEN.homeRingRadiusPct;
  final sized = districts.where((d) => d.tiles.length >= MAP_GEN.minHomeDistrictTiles && sizeOf(d) == DISTRICT_SIZES.home).toList();
  final big = sized.length >= players.length
      ? sized : districts.where((d) => d.tiles.length >= MAP_GEN.minHomeDistrictTiles).toList();
  if (big.length < players.length) return false;
  int team(int k) => players[k].team == 0 ? 99 : players[k].team;
  final order = List<int>.generate(players.length, (k) => k);
  stableSort<int>(order, (a, b) => team(a) - team(b));
  for (var slot = 0; slot < order.length; slot++) {
    final k = order[slot];
    final angle = -math.pi / 2 + (2 * math.pi * slot) / players.length;
    final px = center + fcos(angle) * radius, py = center + fsin(angle) * radius;
    District? best;
    var bestDist = double.infinity;
    for (final d in big) {
      if (d.isHome) continue;
      final dist = hypot(d.cx - px, d.cy - py);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    if (best == null) return false;
    best.isHome = true;
    best.region = players[k].gang;
    best.owner = k;
    best.progress = 100;
    best.progressOwner = k;
    players[k].homeDistrictId = best.id;
  }
  return true;
}

// --- 4) الأحياء المميزة قرب المركز (بلا اقتصاد فقط: الساحة وخلفية القوائم). الترتيب العشوائي هنا خلط Fisher-Yates
// لا مقارنة عشوائية كـ JavaScript، فلا تطابق بينهما في هذا الطريق، ولا تمسه مباريات الاقتصاد
void _assignSpecialDistricts(GameMap map, List<District> districts, MapSize size, Rng rnd) {
  final center = (map.n - 1) / 2, limit = map.n * MAP_GEN.specialCenterRadiusPct;
  final candidates = districts.where((d) => !d.isHome && d.capturable && hypot(d.cx - center, d.cy - center) < limit).toList();
  _shuffle(candidates, rnd);
  final types = ['hospital', 'armory', 'clock'];
  _shuffle(types, rnd);
  final count = size.specialDistricts < candidates.length ? size.specialDistricts : candidates.length;
  for (var k = 0; k < count; k++) {
    candidates[k].region = 'special';
    candidates[k].special = types[k % types.length];
  }
}

void _shuffle<T>(List<T> list, Rng rnd) {
  for (var k = list.length - 1; k > 0; k--) {
    final m = rnd.below(k + 1), t = list[k];
    list[k] = list[m];
    list[m] = t;
  }
}

// بعد الأول: الأبعد في كل مرة عن المختارين (مراكز الشرطة والمزايا الموزعة)
List<District> _spread(List<District> candidates, int count, Rng rnd) {
  final chosen = [candidates[rnd.below(candidates.length)]];
  while (chosen.length < count) {
    District? best;
    var bestDist = -1.0;
    for (final d in candidates) {
      if (chosen.contains(d)) continue;
      var nearest = double.infinity;
      for (final c in chosen) {
        final h = hypot(d.cx - c.cx, d.cy - c.cy);
        if (h < nearest) nearest = h;
      }
      if (nearest > bestDist) { bestDist = nearest; best = d; }
    }
    if (best == null) break;
    chosen.add(best);
  }
  return chosen;
}

// --- 4ب) مراكز الشرطة ---
void _assignPoliceDistricts(GameMap map, List<District> districts, MapSize size, Rng rnd) {
  final homes = districts.where((d) => d.isHome).toList();
  bool farFromHomes(District d) => homes.every((h) => hypot(d.cx - h.cx, d.cy - h.cy) >= POLICE.minHomeDistance);
  final candidates = districts.where((d) => !d.isHome && d.special == null && d.capturable && farFromHomes(d)).toList();
  if (candidates.isEmpty) return;
  final count = size.policeStations < candidates.length ? size.policeStations : candidates.length;
  for (final d in _spread(candidates, count, rnd)) {
    d.police = true;
    d.region = 'police';
  }
}

// --- 4ج) مزايا المدن (القسم 3.11) ---
const FEATURE_BUILDINGS = {'pyramid': 'center', 'khartoum': 'center', 'dojo': 'center', 'clinic': 'spread',
  'fortress': 'spread', 'policeHQ': 'center', 'clock': 'center', 'complex': 'center', 'statue': 'center',
  'mercs': 'spread', 'souk': 'center', 'triads': 'center', 'stable': 'center', 'cathedral': 'center', 'mine': 'center',
  'bank': 'center', 'salwa': 'center', 'observatory': 'center', 'kanoGate': 'center', 'arch': 'center',
  'khan': 'center', 'powder': 'center', 'hunters': 'center'};
const DISTRICT_FEATURE = {'pyramid': 'pyramid', 'villages': 'village', 'dojo': 'dojo', 'clinic': 'clinic',
  'fortress': 'fortress', 'khartoum': 'khartoum', 'policeHQ': 'policeHQ', 'clock': 'clock', 'cartel': 'complex',
  'statue': 'statue', 'mercs': 'mercs', 'souk': 'souk', 'triads': 'triads', 'elephants': 'stable',
  'bells': 'cathedral', 'mine': 'mine', 'bank': 'bank'};
const FEATURE_CONFIG = {'village': 'villages', 'complex': 'cartel'};

String? cityFeatureBuilding(String city) =>
    CITY_FEATURES.buildings[city] ?? DISTRICT_FEATURE[CITY_FEATURES.cities[city]];

void _assignFeatures(GameMap map, List<District> districts, MapSize size, Rng rnd) {
  final feature = cityFeatureBuilding(map.city);
  if (feature == null) return;
  final cfg = CITY_FEATURES.place[FEATURE_CONFIG[feature] ?? feature];
  final homes = districts.where((d) => d.isHome).toList();
  final minHome = cfg?.minHomeDistance;
  bool far(District d) => minHome == null || homes.every((h) => hypot(d.cx - h.cx, d.cy - h.cy) >= minHome);
  final building = FEATURE_BUILDINGS[feature];
  final candidates = districts.where((d) => d.capturable && !d.isHome && !d.police && d.special == null && far(d) &&
      (building == null || (d.tiles.length >= CITY_FEATURES.blockTiles && _hasBlock(map, d)))).toList();
  if (candidates.isEmpty) return;
  final want = cfg?.count != null ? cfg!.count!.of(size.key) : 1;
  final count = want < candidates.length ? want : candidates.length;

  if (building == 'center') {
    final ci = (map.land - 1) / 2, cj = (map.n - 1) / 2;
    final order = candidates.toList();
    stableSort<District>(order, (a, b) => byNum(hypot(a.cx - ci, a.cy - cj), hypot(b.cx - ci, b.cy - cj)));
    for (final d in order.take(count)) { _markFeature(d, feature); }
    if (feature == 'complex') _markCartel(districts, order[0], cfg!.neighbors!);
    return;
  }
  for (final d in _spread(candidates, count, rnd)) { _markFeature(d, feature); }
}

void _markFeature(District district, String feature) {
  district.feature = feature;
  district.region = 'feature';
  if (feature == 'policeHQ') { district.police = true; district.policeMain = true; }
}

void _markCartel(List<District> districts, District complex, int count) {
  final near = districts.where((d) => d != complex && d.capturable && !d.isHome && !d.police && d.special == null &&
      d.feature == null).toList();
  stableSort<District>(near, (a, b) =>
      byNum(hypot(a.cx - complex.cx, a.cy - complex.cy), hypot(b.cx - complex.cx, b.cy - complex.cy)));
  for (final d in near.take(count)) { _markFeature(d, 'cartel'); }
}

bool _hasBlock(GameMap map, District district) {
  bool inD(int i, int j) => map.inBounds(i, j) && map.districtAt[map.idx(i, j)] == district.id;
  return district.tiles.any((t) => inD(t.$1 + 1, t.$2) && inD(t.$1, t.$2 + 1) && inD(t.$1 + 1, t.$2 + 1));
}

// كتلة المبنى المميز 2×2 الأقرب لمركز حيه بلا ساحة العلم، وبقية الحي ساحته. والحي الضيق: مبنى بمربع واحد
void _placeFeatureBuilding(GameMap map, District district, (int, int) point, List<(int, int)> inner) {
  bool inD(int i, int j) => map.inBounds(i, j) && map.districtAt[map.idx(i, j)] == district.id;
  bool isPoint(int i, int j) => i == point.$1 && j == point.$2;
  (int, int)? best;
  var bestD = double.infinity;
  for (final (i, j) in district.tiles) {
    final cells = [(i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1)];
    if (!cells.every((c) => inD(c.$1, c.$2) && !isPoint(c.$1, c.$2))) continue;
    final dist = hypot(i + 0.5 - district.cx, j + 0.5 - district.cy);
    if (dist < bestD) { bestD = dist; best = (i, j); }
  }
  if (best == null) {
    if (inner.isEmpty) return;
    district.featureTile = map.idx(inner[0].$1, inner[0].$2);
    map.type[district.featureTile!] = tF;
    return;
  }
  final (i0, j0) = best;
  for (final (i, j) in district.tiles) {
    if (isPoint(i, j)) continue;
    final k = map.idx(i, j), block = i - i0 >= 0 && i - i0 <= 1 && j - j0 >= 0 && j - j0 <= 1;
    map.type[k] = block ? tLowF : tDot;
    map.kind[k] = block ? null : 'fplaza';
  }
  district.featureTile = map.idx(i0 + 1, j0 + 1);
  map.type[district.featureTile!] = tF;
  district.featureBig = true;
}

// --- 5) ملء الأحياء بالمباني ونقاط الاستيلاء ---
void _placeKind(GameMap map, int k, String? kind) {
  map.kind[k] = kind == '.' ? null : kind;
  map.type[k] = kind == '.' ? tDot : kind == 'ruin' ? tR : tH;
}

// ممرات المدن المفتوحة بين صفوف المباني: 'lane_i' أو 'lane_j' أو null للمبنى
String? Function(int, int) _laneMask(District district, String lanes) {
  var i0 = 1 << 30, i1 = -1, j0 = 1 << 30, j1 = -1;
  for (final (i, j) in district.tiles) {
    if (i < i0) i0 = i;
    if (i > i1) i1 = i;
    if (j < j0) j0 = j;
    if (j > j1) j1 = j;
  }
  bool lane(int v, int a, int b) {
    final u = v - a, w = b - a + 1;
    if (lanes != 'center') return (u < b - v ? u : b - v) % 2 == 1;
    return w % 2 == 1 ? w >= 3 && u == (w - 1) ~/ 2 : w >= 4 && (u == w ~/ 2 - 1 || u == w ~/ 2);
  }
  if (lanes == 'lots') return (i, j) => lane(j, j0, j1) ? 'lane_i' : lane(i, i0, i1) ? 'lane_j' : null;
  return i1 - i0 >= j1 - j0 ? (i, j) => lane(j, j0, j1) ? 'lane_i' : null
                            : (i, j) => lane(i, i0, i1) ? 'lane_j' : null;
}

void _fillDistricts(GameMap map, List<District> districts, Rng rnd) {
  final city = CITY_THEMES[map.city]!;
  final open = CITIES.open[map.city];
  for (final district in districts) {
    final lane = open != null && district.capturable ? _laneMask(district, open.lanes) : null;
    final pool = city.styles != null && district.capturable ? _pickWeighted(city.styles!, rnd) : city.pool;
    for (final (i, j) in district.tiles) {
      final k = map.idx(i, j);
      map.region[k] = district.region;
      final kind = _pickWeighted(pool, rnd);
      final path = lane?.call(i, j);
      _placeKind(map, k, path != null ? '.' : kind);
      if (path != null) map.kind[k] = path;
    }
    if (!district.capturable) {
      if (city.smallPool != null) {
        for (final (i, j) in district.tiles) { _placeKind(map, map.idx(i, j), _pickWeighted(city.smallPool!, rnd)); }
        continue;
      }
      for (final (i, j) in district.tiles) { _placeKind(map, map.idx(i, j), rnd() < 0.5 ? city.tree : '.'); }
      continue;
    }
    // نقطة الاستيلاء: مربع ملاصق لشارع والأقرب لمركز الحي
    (int, int)? point;
    var bestDist = double.infinity;
    for (final (i, j) in district.tiles) {
      final touchesRoad = D4.any((d) => map.inBounds(i + d.$1, j + d.$2) && map.road[map.idx(i + d.$1, j + d.$2)] != 0);
      if (!touchesRoad) continue;
      final dist = hypot(i - district.cx, j - district.cy);
      if (dist < bestDist) { bestDist = dist; point = (i, j); }
    }
    if (point == null) { district.capturable = false; continue; }
    map.type[map.idx(point.$1, point.$2)] = tP;
    district.capture = (i: point.$1, j: point.$2);
    final inner = district.tiles.where((t) => !(t.$1 == point!.$1 && t.$2 == point.$2)).toList();
    stableSort<(int, int)>(inner, (a, b) =>
        byNum(hypot(a.$1 - district.cx, a.$2 - district.cy), hypot(b.$1 - district.cx, b.$2 - district.cy)));
    if (district.isHome && inner.isNotEmpty) {
      map.type[map.idx(inner[0].$1, inner[0].$2)] = tQ;
    } else if (FEATURE_BUILDINGS[district.feature] != null) {
      _placeFeatureBuilding(map, district, point, inner);
    } else if (district.police && inner.isNotEmpty) {
      map.type[map.idx(inner[0].$1, inner[0].$2)] = tN;
    } else if (district.special != null) {
      final letters = SPECIAL_BUILDINGS[district.special]!;
      for (var index = 0; index < letters.length; index++) {
        if (index < inner.length) map.type[map.idx(inner[index].$1, inner[index].$2)] = letters[index];
      }
    }
  }
}

// صحراء اليمامة: السور على حافة الخريطة (أقواس وأبراج وبوابات بعيداً، ومنهار قريباً)
void _buildCityWalls(GameMap map, ({int towerEvery, double archChance}) cfg, Rng rnd) {
  final n = map.n, last = n - 1;
  bool road(int i, int j) => map.inBounds(i, j) && map.road[map.idx(i, j)] == 1;
  for (var j = 0; j < n; j++) {
    for (var i = 0; i < n; i++) {
      if (i != 0 && j != 0 && i != last && j != last) continue;
      final k = map.idx(i, j);
      final corner = (i == 0 || i == last) && (j == 0 || j == last);
      if (map.road[k] != 0) {
        if (corner) continue;
        if (i == 0 && road(1, j) && !road(0, j - 1) && !road(0, j + 1)) {
          map.kind[k] = 'gateJ';
        } else if (j == 0 && road(i, 1) && !road(i - 1, 0) && !road(i + 1, 0)) {
          map.kind[k] = 'gateI';
        } else if (rnd() < cfg.archChance) {
          if (i == last && road(i - 1, j) && !road(i, j - 1) && !road(i, j + 1)) {
            map.kind[k] = 'archJ';
          } else if (j == last && road(i, j - 1) && !road(i - 1, j) && !road(i + 1, j)) {
            map.kind[k] = 'archI';
          }
        }
        continue;
      }
      final type = map.type[k];
      if (type != tH && type != tDot && type != tR) continue;
      String kind;
      if (corner) {
        kind = i == last && j == last ? 'brokenTower' : 'wallTower';
      } else if (i == 0 || j == 0) {
        final along = i == 0 ? j : i;
        if (along % cfg.towerEvery == 0) {
          kind = 'wallTower';
        } else if (type == tR) {
          kind = i == 0 ? 'brokenJ' : 'brokenI';
        } else {
          kind = i == 0 ? 'wallJ' : 'wallI';
        }
      } else {
        kind = i == last ? 'brokenJ' : 'brokenI';
      }
      map.type[k] = tH;
      map.kind[k] = kind;
    }
  }
}

// النرويجية: المباني المجاورة للماء أكواخ على أعمدة
void _placeRorbu(GameMap map, Rng rnd) {
  final i = map.land - 1;
  for (var j = 0; j < map.n; j++) {
    final k = map.idx(i, j);
    if (map.type[k] == tH && rnd() < CITIES.rorbuChance) map.kind[k] = 'rorbu';
  }
}

// علامات الشارع العريض: 3 و4 خط المنتصف، 5 حلقة الدوار، 6 و7 ممر مشاة عند التقاطع
int _wideDash(GameMap map, int i, int j) {
  int r(int a, int b) => map.inBounds(a, b) && map.road[map.idx(a, b)] == 1 ? 1 : 0;
  for (var b = j - 2; b <= j + 2; b++) {
    for (var a = i - 2; a <= i + 2; a++) {
      if (map.inBounds(a, b) && map.type[map.idx(a, b)] == tY) return 5;
    }
  }
  int roads(int a, int b) => r(a - 1, b) + r(a + 1, b) + r(a, b - 1) + r(a, b + 1);
  bool cross(int a, int b) => r(a, b) == 1 && roads(a, b) == 4;
  if (roads(i, j) == 3) {
    if (r(i - 1, j) == 1 && r(i + 1, j) == 1 && (cross(i - 1, j) || cross(i + 1, j))) return 6;
    if (r(i, j - 1) == 1 && r(i, j + 1) == 1 && (cross(i, j - 1) || cross(i, j + 1))) return 7;
  }
  if (r(i, j + 1) == 1 && r(i, j - 1) == 0 && r(i, j + 2) == 0 && r(i - 1, j) == 1 && r(i + 1, j) == 1) return 3;
  if (r(i + 1, j) == 1 && r(i - 1, j) == 0 && r(i + 2, j) == 0 && r(i, j - 1) == 1 && r(i, j + 1) == 1) return 4;
  return 0;
}

// --- 6) خطوط منتصف الشوارع وزينتها ---
void _decorateRoads(GameMap map, Rng rnd) {
  final n = map.n;
  final open = CITIES.open[map.city];
  final wide = open != null && open.street == 2;
  bool road(int i, int j) => map.inBounds(i, j) && map.road[map.idx(i, j)] != 0;
  for (var j = 0; j < n; j++) {
    for (var i = 0; i < n; i++) {
      final k = map.idx(i, j);
      if (map.road[k] == 0) continue;
      if (wide) {
        map.dash[k] = _wideDash(map, i, j);
      } else {
        final horizontal = road(i - 1, j) || road(i + 1, j), vertical = road(i, j - 1) || road(i, j + 1);
        map.dash[k] = horizontal && !vertical ? 1 : vertical && !horizontal ? 2 : 0;
      }
      final q = rnd();
      if (q < 0.015) {
        map.decor[k] = 'B';
      } else if (q < 0.05 && map.dash[k] != 0) {
        map.decor[k] = 'L';
      }
    }
  }
}

// --- 7) إصلاح الفراغات المعزولة (القسم 3.4.1) ---
void repairIsolatedPockets(GameMap map) {
  for (var round = 0; round < MAP_GEN.pocketRepairRounds; round++) {
    final reached = _floodFromStreets(map);
    final pockets = _collectPockets(map, reached);
    if (pockets.isEmpty) break;
    for (final pocket in pockets) { _fixPocket(map, pocket, reached); }
  }
  var reached = _floodFromStreets(map);
  for (final district in map.districts) {
    final c = district.capture;
    if (c == null || reached[map.idx(c.i, c.j)] != 0) continue;
    _carveCorridor(map, c.i, c.j, reached);
    reached = _floodFromStreets(map);
  }
  map.connected = reached;
}

Uint8List _floodFromStreets(GameMap map) {
  final n = map.n, reached = Uint8List(n * n), queue = Int32List(n * n);
  var head = 0, tail = 0;
  for (var k = 0; k < n * n; k++) {
    if (map.road[k] != 0) { reached[k] = 1; queue[tail++] = k; }
  }
  while (head < tail) {
    final k = queue[head++], i = k % n, j = k ~/ n;
    for (final (dx, dy) in D8) {
      final a = i + dx, b = j + dy;
      if (!map.isWalkable(a, b)) continue;
      if (dx != 0 && dy != 0 && (!map.isWalkable(i + dx, j) || !map.isWalkable(i, j + dy))) continue;
      final nk = map.idx(a, b);
      if (reached[nk] != 0) continue;
      reached[nk] = 1;
      queue[tail++] = nk;
    }
  }
  return reached;
}

List<List<(int, int)>> _collectPockets(GameMap map, Uint8List reached) {
  final n = map.n, seen = Uint8List(n * n), pockets = <List<(int, int)>>[];
  for (var j = 0; j < n; j++) {
    for (var i = 0; i < n; i++) {
      final k = map.idx(i, j);
      if (reached[k] != 0 || seen[k] != 0 || !map.isWalkable(i, j)) continue;
      final pocket = <(int, int)>[], stack = [(i, j)];
      seen[k] = 1;
      while (stack.isNotEmpty) {
        final (a, b) = stack.removeLast();
        pocket.add((a, b));
        for (final (dx, dy) in D8) {
          final x = a + dx, y = b + dy;
          if (!map.isWalkable(x, y)) continue;
          if (dx != 0 && dy != 0 && (!map.isWalkable(a + dx, b) || !map.isWalkable(a, b + dy))) continue;
          final nk = map.idx(x, y);
          if (seen[nk] != 0 || reached[nk] != 0) continue;
          seen[nk] = 1;
          stack.add((x, y));
        }
      }
      pockets.add(pocket);
    }
  }
  return pockets;
}

void _fixPocket(GameMap map, List<(int, int)> pocket, Uint8List reached) {
  if (_openBarrier(map, pocket, reached)) return;
  for (final (i, j) in pocket) {
    if (map.type[map.idx(i, j)] == tP) { _carveCorridor(map, i, j, reached); return; }
  }
  final fill = MAP_GEN.pocketFillType.codeUnitAt(0);
  for (final (i, j) in pocket) {
    if (map.road[map.idx(i, j)] != 0) continue;
    map.type[map.idx(i, j)] = fill;
  }
}

bool _openBarrier(GameMap map, List<(int, int)> pocket, Uint8List reached) {
  for (final (i, j) in pocket) {
    for (final (dx, dy) in D8) {
      if (dx != 0 && dy != 0) {
        final a = i + dx, b = j + dy;
        if (!map.isWalkable(a, b) || reached[map.idx(a, b)] == 0) continue;
        if (_openable(map, i + dx, j)) { map.type[map.idx(i + dx, j)] = tDot; return true; }
        if (_openable(map, i, j + dy)) { map.type[map.idx(i, j + dy)] = tDot; return true; }
      } else {
        final a = i + dx, b = j + dy;
        if (!_openable(map, a, b)) continue;
        final x = i + dx * 2, y = j + dy * 2;
        if (!map.isWalkable(x, y) || reached[map.idx(x, y)] == 0) continue;
        map.type[map.idx(a, b)] = tDot;
        return true;
      }
    }
  }
  return false;
}

bool _openable(GameMap map, int i, int j) {
  if (!map.inBounds(i, j)) return false;
  final k = map.idx(i, j);
  if (map.road[k] != 0) return false;
  final type = map.type[k];
  return type != tDot && type != tP && !MAP_GEN.protectedBuildings.codeUnits.contains(type);
}

bool _carveCorridor(GameMap map, int si, int sj, Uint8List reached) {
  final n = map.n, from = Int32List(n * n)..fillRange(0, n * n, -2);
  final start = map.idx(si, sj), queue = [start];
  from[start] = -1;
  var head = 0;
  while (head < queue.length) {
    final k = queue[head++], i = k % n, j = k ~/ n;
    if (k != start && map.isWalkable(i, j) && reached[k] != 0) {
      var node = from[k];
      while (node >= 0) {
        if (map.road[node] == 0 && map.type[node] != tP) map.type[node] = tDot;
        node = from[node];
      }
      return true;
    }
    for (final (dx, dy) in D4) {
      final a = i + dx, b = j + dy;
      if (!map.inBounds(a, b)) continue;
      final nk = map.idx(a, b);
      if (from[nk] != -2) continue;
      if (_openable(map, a, b) || map.isWalkable(a, b)) {
        from[nk] = k;
        queue.add(nk);
      }
    }
  }
  return false;
}
