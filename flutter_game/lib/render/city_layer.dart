// طبقة المدينة الثابتة: تُبنى مرة لكل خريطة، ثم يرسمها كرت الشاشة بأمرين في كل إطار بلا عمل على المعالج:
// الأرض شبكة مثلثات واحدة بلون كل مربع (groundColor في js/render/cityRender.js)، والمباني والأشجار والمعالم
// من أطلس المدينة مرتبة بالعمق (i + j) كما يرسمها cityRender.js وlandmarks.js
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import '../config.dart';
import '../core/cfg.dart';
import '../data/cities.dart';
import '../data/js_config.dart' show EMPIRE;
import '../game/state.dart';
import '../map/generator.dart';
import '../map/sizes.dart';
import 'city_art.dart';
import 'colors.dart';
import 'decor.dart';
import 'empire_art.dart' show hqTier;
import 'vec.dart';
import 'weather_art.dart';

// أرض الحي المميز وحي الشرطة وحي الميزة تميل لألوانها قبل الاستيلاء (REGION_HINT في cityRender.js)
final _regionHint = <String, (int, double)>{
  'police': (hex('#6f7b8a'), 0.35),
  'special': (hex('#bba565'), 0.22),
  'feature': (hex(CITY_FEATURES.ground.$1), CITY_FEATURES.ground.$2),
};
const _featureSmall = 0.55;   // المبنى المميز في حي ضيق (مربع واحد): الرسم نفسه مصغّراً (SMALL في featureArt.js)

// الطقس قبل صبغ المالك (الثلج لا يخفي لونه)
int groundColor(GameMap map, CityArt art, int i, int j, [String weather = 'day']) {
  final k = map.idx(i, j), type = map.type[k], c = art.colors;
  if (type == tWater) return weather == 'snow' ? mix(hex(c['water'] ?? '#34566e'), hex('#dfe8ee'), 0.3) : hex(c['water'] ?? '#34566e');
  final w = _groundOf(map, art, i, j, k, type, c);
  if (weather == 'snow') return mix(w, hex('#eef2f5'), map.road[k] == 1 ? 0.45 : 0.72);
  if (weather == 'rain') return mix(w, hex('#2a2f36'), 0.2);
  return w;
}

int _groundOf(GameMap map, CityArt art, int i, int j, int k, int type, Map<String, String?> c) {
  if (map.road[k] == 1 || type == tY) return hex((i + j) % 2 == 1 ? c['road']! : c['road2']!);
  if (type == tP) return hex(c['plaza']!);
  var color = hex(c['ground']!);
  final kind = map.kind[k];
  if (type == tDot && (kind == 'lane_i' || kind == 'lane_j')) {
    color = mix(color, hex(c['plaza']!), 0.8);                    // ممر مرصوف بين صفوف المباني
  } else if (kind == 'fplaza') {
    color = mix(hex(c['plaza']!), hex('#d9c79c'), 0.35);          // ساحة المبنى المميز
  } else if (map.city == 'norway') {
    if (hsh(i, j, 300, map.seed) < 0.5) color = hex('#dfe6eb');   // ثلج النرويجية (groundAt)
  } else if (hsh(i, j, 200, map.seed) < 0.3) {
    color = mixc(color, hex('#5a5040'), 0.12);
  }
  final hint = _regionHint[map.region[k]];
  if (hint != null) color = mix(color, hint.$1, hint.$2);
  return color;
}

// صورة المربع ومقياسها وإزاحتها، أو null (الأرض والشوارع وساحات العلم: زينتها في ن2). وstate للمباراة: صور ترقيات
// البرج والمستشفى ومستوى القاعدة وساحة تدريبها (بلا state صور الأحجام وحدها)
(Sprite, double, double)? tileSprite(GameMap map, CityArt art, int i, int j, [MatchState? state]) {
  final k = map.idx(i, j), type = map.type[k], v = (i + j) % 3 + 1;
  if (map.road[k] == 1) {
    final gate = map.kind[k];                                       // بوابة سور اليمامة وأقواسه فوق الشارع
    final s = gate == null ? null : art.find('prop', gate, v);
    return s == null ? null : (s, 1, 0);
  }
  if (type == tR) {
    final s = art.find('ruin', 'ruin', v);
    return s == null ? null : (s, 1, 0);
  }
  if (type == tH) {
    var kind = map.kind[k];
    if (kind == 'monument') {
      final s = art.find('monument', 'monument');
      return s == null ? null : (s, art.scale, 0);
    }
    if (kind == null || !art.has(kind)) kind = _firstBuilding(map.city, art);
    if (kind == null) return null;
    final s = art.find('building', kind, v) ?? art.find('prop', kind, v);
    return s == null ? null : (s, art.scale, 0);   // المدن المفتوحة: المربع كله أصغر حول قاعدته
  }
  final district = map.districtOf(i, j);
  final size = district == null ? 'medium' : sizeOf(district);
  if (type == tQ) {
    final tier = state == null || district == null ? 0 : hqTier(state, district);
    final u = tier > 0 ? art.upgrade('hq', 'tier$tier', size) : null;
    if (u != null) return (u.$1, u.$2, 0);
    final s = art.economy('hq', size);
    return s == null ? null : (s, 1, 0);
  }
  if (type == tN) {
    final s = art.economy('police', 'medium');
    return s == null ? null : (s, 1, 0);
  }
  if (type == 0x54 || type == 0x4D) {                              // برج الرماية والمستشفى (BUILDING_TILE في empire.js)
    final kind = type == 0x54 ? 'tower' : 'hospital';
    final up = district == null ? null : _upOf(district, kind);
    final u = up == null ? null : art.upgrade(kind, up, size);
    if (u != null) return (u.$1, u.$2, 0);
    final s = art.economy(kind, size);
    return s == null ? null : (s, 1, 0);
  }
  if (type == tF && district?.feature != null) {
    final s = art.find('feature', district!.feature!);
    if (s == null) return null;
    // الكتلة 2×2 من مربعها الأمامي، والحي الضيق: الرسم نفسه مصغّراً بلا إزاحة الكتلة
    return district.featureBig ? (s, 1, 0) : (s, _featureSmall, TILE_HALF_H * _featureSmall);
  }
  // ساحة علم حي القاعدة: ساحة تدريب بمستواها (hqYard في empireBuildings.js)
  if (type == tP && state != null && district != null && district.building == 'hq' &&
      district.capture?.i == i && district.capture?.j == j) {
    final tier = hqTier(state, district);
    final s = tier > 0 ? art.piece('yard', 'yard', tier) : null;
    return s == null ? null : (s, 1, 0);
  }
  return null;
}

// صورة ترقية البرج (damage وrate) والمستشفى (radius وrate): "كل الترقيات" حين تكتمل، وإلا آخر ما اشتُري بمستواه
// (وبلا تاريخ، كمباراة محفوظة: الأعلى مستوى)
String? _upOf(District d, String kind) {
  final b = d.blv;
  if (b.isEmpty) return null;
  final U = EMPIRE.m('buildings').m(kind).m('upgrades'), keys = U.l('order').cast<String>();
  if (keys.every((k) => (b[k] ?? 0) >= U.m(k).l('costs').length)) return 'all';
  var key = d.lastUp;
  if (key == null || (b[key] ?? 0) == 0) key = keys.reduce((a, c) => (b[c] ?? 0) > (b[a] ?? 0) ? c : a);
  final lv = b[key] ?? 0;
  return lv == 0 ? null : '$key$lv';
}

// أول نوع مبنى في pool المدينة له صورة: للمربعات المردومة بلا نوع (firstBuilding في cityRender.js)
String? _firstBuilding(String city, CityArt art) {
  for (final (kind, _) in CITY_THEMES[city]!.pool) {
    if (kind != null && kind != '.' && kind != 'ruin' && art.has(kind)) return kind;
  }
  return null;
}

// صورة في الطبقة قبل ترتيبها بالعمق: لمربع (k) أو لخانة سور (slot)، وmask قناع رايات المالك فوق صورتها
class _It {
  final int depth, i, order, did, k, slot;
  final bool mask;
  final Sprite? s;
  final double x, y, scale;
  _It(this.depth, this.i, this.order, this.s, this.x, this.y, this.scale, this.did, this.k, {this.mask = false, this.slot = -1});
}

// الطبقة صفوف بالعمق (d = i + j): لكل صف زينته القائمة (شبكة مثلثات) ثم صوره (من الأطلس)، فيقف عمود الإنارة
// أمام المبنى الذي خلفه ووراء الذي أمامه، كما يرسم cityRender.js كل مربع بزينته بترتيبه. والصف خارج الشاشة لا يُرسل.
// ما يتبدل في المباراة (مباني الاقتصاد وترقياتها، وساحة التدريب، وقطع السور) خانات ثابتة تتبدل صورتها في مكانها
// (والفارغة مستطيل صفري لا يُرسم)، فلا تُبنى الطبقة كلها مع كل بناء أو ترقية أو تحصين
class CityLayer {
  ui.Vertices ground;
  final ui.Vertices? marks;          // خطوط الشوارع والأرصفة وممرات المشاة ورصف الممرات وحلقة الدوار
  final List<ui.Vertices?> rows;     // زينة كل صف
  final Int32List rowStart;          // أول صورة لكل صف في xf وrects (والأخير = العدد)
  final Float32List xf, rects;       // لكل صورة: التحويل (scos, ssin, tx, ty) ومستطيلها في الأطلس
  // صبغ المالك (القسم 8): لون أرض كل مربع قبل الصبغ وحيّه، وحي كل صورة ولونها (أبيض بلا صبغ، والقناع بلون المالك)
  final Float32List _pos;
  final Int32List _baseCol, _col, _tileDistrict, _spriteDistrict, spriteCol;
  final Uint8List _isMask;
  final _applied = <int, (String?, double)>{};
  bool tinted = false;
  final List<Light> lights;          // إضاءة الليل الثابتة (weather_art.dart)
  final Map<int, int> _tileItem, _tileMask;   // المربع ← رقم صورته وقناعها (لتبديل صورة مربع واحد)
  final Map<int, Sprite?> _tileSprite;
  final List<(int, String)> _slots;  // خانات السور: (الحي، القطعة: right وleft وgate_right وgate_left وtower)
  final Float32List _slotPos;        // مربع ارتكاز كل خانة (x، y، k)
  final Int32List _slotItem, _slotMask, _slotLevel;
  final Float32List lift;            // لكل مربع: ارتفاع ما عليه فوق ركنه الخلفي (ضباب الحرب)
  final Float32List wide;            // ونصف عرض صورته من وسطه (المبنى المميز 2×2 أعرض من مربعه)
  CityLayer._(this.ground, this.marks, this.rows, this.rowStart, this.xf, this.rects, this._pos, this._baseCol, this._col,
      this._tileDistrict, this._spriteDistrict, this.spriteCol, this._isMask, this.lights, this._tileItem, this._tileMask,
      this._tileSprite, this._slots, this._slotPos, this._slotItem, this._slotMask, this._slotLevel, this.lift, this.wide) {
    tinted = _isMask.contains(1);
  }

  static void _widen(Float32List wide, int k, int n, double left, double width) {
    final x = (k % n - k ~/ n) * TILE_HALF_W;
    wide[k] = math.max(wide[k], math.max(x - left, left + width - x));
  }

  // ما يرتفع فوق قاعدته (CITY_CACHE.reach.up) وما ينزل تحتها
  static const _up = 120.0, _down = 20.0;

  // يضع الصورة s (أو قناعها) في الخانة m عند (x, y)، أو يفرغها. ويرفع ضباب مربعها k حتى قمتها
  void _put(int m, Sprite? s, double x, double y, double scale, double px, int k, int n) =>
      _place(xf, rects, lift, wide, m, s, x, y, scale, px, _isMask[m] == 1, k, n);

  static void _place(Float32List xf, Float32List rects, Float32List lift, Float32List wide, int m, Sprite? s, double x, double y,
      double scale, double px, bool mask, int k, int n) {
    final o = m * 4, unit = scale / px;
    xf[o] = unit; xf[o + 1] = 0; xf[o + 2] = x - unit * (s?.ax ?? 0); xf[o + 3] = y - unit * (s?.ay ?? 0);
    if (s == null || (mask && s.mx == null)) { rects.fillRange(o, o + 4, 0); return; }
    final sx = mask ? s.mx! : s.x, sy = mask ? s.my! : s.y;
    rects[o] = sx; rects[o + 1] = sy; rects[o + 2] = sx + s.w; rects[o + 3] = sy + s.h;
    if (mask || k < 0) return;
    lift[k] = math.max(lift[k], (k ~/ n + k % n) * TILE_HALF_H - TILE_HALF_H - xf[o + 3]);
    _widen(wide, k, n, xf[o + 2], unit * s.w);
  }

  factory CityLayer(GameMap map, CityArt art, [String weather = 'day', MatchState? state]) {
    final n = map.n, depths = 2 * n - 1;
    final pos = Float32List(n * n * 12), col = Int32List(n * n * 6), base = Int32List(n * n), tileD = Int32List(n * n), lift = Float32List(n * n),
        wide = Float32List(n * n)..fillRange(0, n * n, TILE_HALF_W);
    final items = <_It>[];
    final decor = Decor(map), markVec = Vec(), rowVecs = List.generate(depths, (_) => Vec());
    final capture = {for (final d in map.districts) if (d.capture != null) map.idx(d.capture!.i, d.capture!.j)};
    decor.groundMarks(markVec);
    for (var j = 0; j < n; j++) {
      for (var i = 0; i < n; i++) {
        final k = map.idx(i, j);
        final x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
        pos.setAll(k * 12, [x, y - TILE_HALF_H, x + TILE_HALF_W, y, x, y + TILE_HALF_H,
                            x, y - TILE_HALF_H, x, y + TILE_HALF_H, x - TILE_HALF_W, y]);
        base[k] = groundColor(map, art, i, j, weather).toSigned(32);
        col.fillRange(k * 6, k * 6 + 6, base[k]);
        tileD[k] = map.road[k] == 1 || map.type[k] == tWater || map.type[k] == tY ? -1 : map.districtAt[k];
        final s = tileSprite(map, art, i, j, state), did = map.road[k] == 1 ? -1 : map.districtAt[k];
        // مربعات الأحياء خانات بقناع (قد يُبنى فيها مبنى اقتصاد)، وساحة العلم خانة ولو فارغة (ساحة التدريب)
        if (s != null || capture.contains(k)) {
          items.add(_It(i + j, i, 0, s?.$1, x, y + (s?.$3 ?? 0), s?.$2 ?? 1, did, k));
          if (did >= 0) items.add(_It(i + j, i, 0, s?.$1, x, y + (s?.$3 ?? 0), s?.$2 ?? 1, did, k, mask: true));
        }
        final from = rowVecs[i + j].length;
        decor.tileDecor(rowVecs[i + j], i, j);
        // ارتفاع ما على المربع فوق ركنه الخلفي (ضباب الحرب يغطيه كله): الزينة هنا، والصورة بعد ترتيبها
        lift[k] = math.max(0.0, y - TILE_HALF_H - rowVecs[i + j].minY(from));
      }
    }
    // خانات السور (11د، chunkCache.js): على كل ضلع من مربعات الحي يطل على غيره، بوابة في المربع الذي يُمشى عليه.
    // الضلعان الأماميان (+i و+j) قطعتا right وleft حول مركز المربع، والخلفيان القطعتان نفسهما حول المربع المجاور
    // (ضلع -i هو ضلع +i لجاره)، وبرج الركن (من المستوى 2) حيث يلتقي ضلعا سور على ركن بارز
    final slots = <(int, String)>[], slotPos = <double>[];
    for (final dist in map.districts) {
      if (dist.capture == null) continue;
      for (final (i, j) in dist.tiles) {
        final k = map.idx(i, j);
        if (map.road[k] == 1) continue;
        bool out(int a, int b) => !map.inBounds(a, b) || map.districtAt[map.idx(a, b)] != dist.id;
        final gate = map.isWalkable(i, j), e = [out(i + 1, j), out(i, j + 1), out(i - 1, j), out(i, j - 1)];
        void slot(String kind, int ai, int aj, int order) {
          final ak = map.inBounds(ai, aj) ? map.idx(ai, aj) : -1, x = (ai - aj) * TILE_HALF_W, y = (ai + aj) * TILE_HALF_H;
          final id = slots.length, depth = math.max(0, ai + aj);
          slots.add((dist.id, kind));
          slotPos.addAll([x, y, ak.toDouble()]);
          items.add(_It(depth, ai, order, null, x, y, 1, -1, ak, slot: id));
          items.add(_It(depth, ai, order, null, x, y, 1, dist.id, ak, slot: id, mask: true));
        }
        if (e[0]) slot(gate ? 'gate_right' : 'right', i, j, 1);
        if (e[1]) slot(gate ? 'gate_left' : 'left', i, j, 1);
        if (e[2]) slot(gate ? 'gate_right' : 'right', i - 1, j, 1);
        if (e[3]) slot(gate ? 'gate_left' : 'left', i, j - 1, 1);
        if (gate) continue;
        if (e[0] && e[1]) slot('tower', i, j, 2);          // الركن الأسفل
        if (e[3] && e[0]) slot('tower', i, j - 1, 2);      // الأيمن
        if (e[1] && e[2]) slot('tower', i - 1, j, 2);      // الأيسر
        if (e[2] && e[3]) slot('tower', i - 1, j - 1, 2);  // الأعلى
      }
    }
    items.sort((a, b) => a.depth != b.depth ? a.depth - b.depth : a.i != b.i ? a.i - b.i : a.order != b.order ? a.order - b.order
        : a.slot != b.slot ? a.slot - b.slot : (a.mask ? 1 : 0) - (b.mask ? 1 : 0));
    final xf = Float32List(items.length * 4), rects = Float32List(items.length * 4), rowStart = Int32List(depths + 1);
    final spriteD = Int32List(items.length), spriteCol = Int32List(items.length)..fillRange(0, items.length, -1);
    final isMask = Uint8List(items.length);
    final tileItem = <int, int>{}, tileMask = <int, int>{}, tileImg = <int, Sprite?>{};
    final slotItem = Int32List(slots.length), slotMask = Int32List(slots.length);
    var d = 0;
    for (var m = 0; m < items.length; m++) {
      final it = items[m];
      spriteD[m] = it.did;
      if (it.mask) { isMask[m] = 1; spriteCol[m] = 0; }
      if (it.slot >= 0) {
        (it.mask ? slotMask : slotItem)[it.slot] = m;
      } else {
        (it.mask ? tileMask : tileItem)[it.k] = m;
        tileImg[it.k] = it.s;
      }
      while (d <= it.depth) { rowStart[d++] = m; }
      _place(xf, rects, lift, wide, m, it.s, it.x, it.y, it.scale, art.px, it.mask, it.k, n);
    }
    while (d <= depths) { rowStart[d++] = items.length; }
    // وعلم الحي فوق مربعه (_flag في match_screen: سارية 22)
    for (final dist in map.districts) {
      final c = dist.capture;
      if (c != null) lift[c.j * n + c.i] = math.max(lift[c.j * n + c.i], 24 - TILE_HALF_H);
    }
    final layer = CityLayer._(ui.Vertices.raw(ui.VertexMode.triangles, pos, colors: col), markVec.build(),
        [for (final v in rowVecs) v.build()], rowStart, xf, rects, pos, base, col, tileD, spriteD, spriteCol, isMask,
        mapLights(map, decor.lights), tileItem, tileMask, tileImg, slots, Float32List.fromList(slotPos), slotItem, slotMask,
        Int32List(slots.length), lift, wide);
    layer.refreshWalls(map, art);
    return layer;
  }

  // مبنى جديد أو ترقية أو مستوى قاعدة: تتبدل صورة المربع وقناعها في مكانهما. يعيد false إن لم يكن للمربع خانة
  // (مربع بلا صورة قبلها)، فتُبنى الطبقة كلها
  bool refreshTiles(GameMap map, CityArt art, Iterable<int> tiles, [MatchState? state]) {
    final n = map.n;
    for (final k in tiles) {
      final now = tileSprite(map, art, k % n, k ~/ n, state), m = _tileItem[k];
      if (m == null) { if (now == null) continue; return false; }
      if (identical(_tileSprite[k], now?.$1)) continue;
      final mm = _tileMask[k];
      if (mm == null && now?.$1.mx != null) return false;
      final x = (k % n - k ~/ n) * TILE_HALF_W, y = (k % n + k ~/ n) * TILE_HALF_H + (now?.$3 ?? 0), sc = now?.$2 ?? 1;
      _put(m, now?.$1, x, y, sc, art.px, k, n);
      if (mm != null) _put(mm, now?.$1, x, y, sc, art.px, k, n);
      _tileSprite[k] = now?.$1;
    }
    return true;
  }

  // أسوار الأحياء بمستوى تحصينها (d.fort): قطع كل خانة بمستواها، أو فارغة
  void refreshWalls(GameMap map, CityArt art) {
    for (var id = 0; id < _slots.length; id++) {
      final (did, kind) = _slots[id];
      final lv = map.districts[did].fort;
      if (_slotLevel[id] == lv) continue;
      _slotLevel[id] = lv;
      final s = lv > 0 ? art.piece('wall', kind, lv) : null, x = _slotPos[id * 3], y = _slotPos[id * 3 + 1], k = _slotPos[id * 3 + 2].toInt();
      _put(_slotItem[id], s, x, y, 1, art.px, k, map.n);
      _put(_slotMask[id], s, x, y, 1, art.px, k, map.n);
    }
  }

  // صبغ الأحياء بلون مالكها (tintAmount في capture.js و tint في colors.js): الأرض والصور، ولا يُعاد إلا ما تغيّر
  // amount: (لون المالك أو null، ونسبة الصبغ المدرّجة) لكل حي
  void retint(List<(String?, double)> amount, double groundAlpha, double groundChroma, double spriteAlpha, double chroma) {
    final changed = <int>{};
    for (var id = 0; id < amount.length; id++) {
      if (_applied[id] != amount[id]) { _applied[id] = amount[id]; changed.add(id); }
    }
    if (changed.isEmpty) return;
    for (var k = 0; k < _baseCol.length; k++) {
      final id = _tileDistrict[k];
      if (id < 0 || !changed.contains(id)) continue;
      final (owner, a) = amount[id];
      final c = owner == null || a <= 0 ? _baseCol[k] : oklabTint(_baseCol[k], hex(owner), a * groundAlpha, groundChroma).toSigned(32);
      _col.fillRange(k * 6, k * 6 + 6, c);
    }
    ground.dispose();
    ground = ui.Vertices.raw(ui.VertexMode.triangles, _pos, colors: _col);
    tinted = false;
    for (var m = 0; m < spriteCol.length; m++) {
      final id = _spriteDistrict[m];
      if (id < 0) continue;
      final (owner, a) = amount[id];
      if (changed.contains(id)) {
        spriteCol[m] = _isMask[m] == 1
            ? (owner == null || a <= 0 ? 0 : ((math.min(1.0, a) * 255).round() << 24 | hex(owner) & 0xFFFFFF).toSigned(32))
            : owner == null || a <= 0 ? -1 : oklabTint(0xFFFFFFFF, hex(owner), a * spriteAlpha, chroma).toSigned(32);
      }
      if (spriteCol[m] != -1) tinted = true;
    }
  }

  static final _paint = ui.Paint();
  static final _atlasPaint = ui.Paint()..filterQuality = ui.FilterQuality.medium;   // بمستويات التصغير

  // top وbottom: حدا الشاشة بوحدات العالم. onGround بعد الأرض (الظلال والحدود والنار)، وafterRow(d) بعد كل صف
  // (الجنود الواقفون فيه: يغطيهم ما أمامهم من مبانٍ ولا يغطيهم ما خلفهم)
  void paint(ui.Canvas canvas, ui.Image atlas, double top, double bottom,
      {void Function()? onGround, void Function(int d)? afterRow}) {
    canvas.drawVertices(ground, ui.BlendMode.dst, _paint);
    if (marks != null) canvas.drawVertices(marks!, ui.BlendMode.dst, _paint);
    onGround?.call();
    for (var d = 0; d < rows.length; d++) {
      final y = d * TILE_HALF_H;
      if (y < top - _down || y - _up > bottom) { if (afterRow != null && y >= top - 60 && y - 60 <= bottom) afterRow(d); continue; }
      final row = rows[d];
      if (row != null) canvas.drawVertices(row, ui.BlendMode.dst, _paint);
      final a = rowStart[d], b = rowStart[d + 1];
      if (b > a) {
        canvas.drawRawAtlas(atlas, Float32List.sublistView(xf, a * 4, b * 4), Float32List.sublistView(rects, a * 4, b * 4),
            tinted ? Int32List.sublistView(spriteCol, a, b) : null, tinted ? ui.BlendMode.modulate : null, null, _atlasPaint);
      }
      afterRow?.call(d);
    }
  }

  void dispose() {
    ground.dispose();
    marks?.dispose();
    for (final r in rows) { r?.dispose(); }
  }
}
