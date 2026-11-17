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

// معلم المنطقة (placeMonument): مبنى عادي قرب الوسط حل محله المعلم. وقد يقع مربعه في ساحة معبد فلا يبقى مبنى
bool isMonument(GameMap map, int k) => map.type[k] == tH && map.kind[k] == 'monument';

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
  final kind = map.kind[k];
  // ساحة العلم في حي المبنى المميز بلون ساحته (2.3.1: كانت رمادية وسط أرض المعبد)، والمعلم على منصة مرصوفة
  final square = type == tP && (map.districtOf(i, j)?.featureBig ?? false);
  if ((type == tP && !square) || isMonument(map, k)) return hex(c['plaza']!);
  var color = hex(c['ground']!);
  if (type == tDot && (kind == 'lane_i' || kind == 'lane_j')) {
    color = mix(color, hex(c['plaza']!), 0.8);                    // ممر مرصوف بين صفوف المباني
  } else if (kind == 'fplaza' || square) {
    // ساحة المبنى المميز، والمعبد بحجر ذهبي والمرتزقة بأرض مدكوكة (3.14)
    final d = map.districtOf(i, j);
    color = mix(hex(c['plaza']!), hex(d != null && d.temple ? '#e9cf88' : d != null && d.merc ? '#8f7252' : '#d9c79c'),
        d != null && (d.temple || d.merc) ? 0.42 : 0.35);
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
    // أطلال أقل (بطلب المستخدم، 2.3.1): يبقى أطلالاً GROUND.ruins منها، والباقي بيت من بيوت المدينة (رسم فقط: كلاهما لا يُمشى عليه)
    if (hsh(i, j, 640, map.seed) >= GROUND.ruins) {
      final s = _houseFor(map, art, i, j);
      if (s != null) return (s, art.scale, 0);
    }
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

// بيت مكان الأطلال: نوع من pool المدينة بوزنه (له صورة)، ونسخته بالتجزئة
Sprite? _houseFor(GameMap map, CityArt art, int i, int j) {
  final kinds = [for (final (k, w) in CITY_THEMES[map.city]!.pool) if (k != null && k != '.' && k != 'ruin' && art.find('building', k) != null) (k, w)];
  if (kinds.isEmpty) return null;
  var r = hsh(i, j, 641, map.seed) * kinds.fold(0.0, (a, e) => a + e.$2);
  for (final (k, w) in kinds) {
    if ((r -= w) < 0) return art.find('building', k, (i + j) % 3 + 1);
  }
  return art.find('building', kinds.last.$1, (i + j) % 3 + 1);
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
  final bool mask, decor;
  final Sprite? s;
  final double x, y, scale;
  _It(this.depth, this.i, this.order, this.s, this.x, this.y, this.scale, this.did, this.k, {this.mask = false, this.slot = -1, this.decor = false});
}

// صورة أرض المربع (18.6): الشارع بنقشيه المتعاقبين، والماء، والساحة والممرات وساحة المبنى المميز، وأرض الحي لما سواها
String _groundKind(GameMap map, int i, int j, int k) {
  final type = map.type[k], kind = map.kind[k];
  if (map.road[k] == 1 || type == tY) return (i + j) % 2 == 1 ? 'road' : 'road2';
  if (type == tWater) return 'water';
  if (type == tP || kind == 'fplaza' || isMonument(map, k) || (type == tDot && (kind == 'lane_i' || kind == 'lane_j'))) return 'plaza';
  return 'ground';
}

// لون يُضرب في صورة الأرض (ولونها base) فيصير متوسطها لون المربع c: أغمق بنسبته. والأفتح منها (الثلج، وبقع ثلج
// النرويجية) تبقى الصورة خافتة فوق لونه المسطح، إلا في الصبغ (faint: false) فيُقص الأفتح
int _modulate(int c, int base, {bool faint = true}) {
  double ch(int s) => ((c >> s) & 255) / math.max(1, (base >> s) & 255);
  final r = ch(16), g = ch(8), b = ch(0);
  if (faint && math.max(r, math.max(g, b)) > 1.04) return 0x59FFFFFF.toSigned(32);
  int q(double v) => (math.min(1.0, v) * 255).round();
  return (0xFF000000 | q(r) << 16 | q(g) << 8 | q(b)).toSigned(32);
}

// الطبقة صفوف بالعمق (d = i + j): لكل صف زينته القائمة (شبكة مثلثات) ثم صوره (من الأطلس)، فيقف عمود الإنارة
// أمام المبنى الذي خلفه ووراء الذي أمامه، كما يرسم cityRender.js كل مربع بزينته بترتيبه. والصف خارج الشاشة لا يُرسل.
// ما يتبدل في المباراة (مباني الاقتصاد وترقياتها، وساحة التدريب، وقطع السور) خانات ثابتة تتبدل صورتها في مكانها
// (والفارغة مستطيل صفري لا يُرسم)، فلا تُبنى الطبقة كلها مع كل بناء أو ترقية أو تحصين
class CityLayer {
  // الأرض وخطوطها (الشوارع والأرصفة وممرات المشاة ورصف الممرات وحلقة الدوار) شرائح من band صفوف عمق، تُرسم الظاهرة منها وحدها
  static const band = 6;
  final List<ui.Vertices?> ground, marks;
  final Int32List _slot, _bandStart;   // مكان رؤوس كل مربع في مصفوفة الأرض (مرتبة بالشرائح)، وأول مربع في كل شريحة
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
  // صور الأرض (18.6): صورة لكل مربع بترتيب رؤوس الأرض نفسه (_slot)، تُضرب في لونها: نسبة لون المربع إلى لون صورته
  // (_gBase) مصبوغاً بلون المالك (_gCol). وصور العلامات (الأرصفة والخطوط...) لكل شريحة فوقها
  final Float32List? _gXf, _gRect;
  final Int32List? _gBase, _gCol;
  final Int32List? _gKindBase;       // لون صورة أرض كل مربع (موضعه في الشرائح)
  final List<(Float32List, Float32List)?> _markSprites;
  // الأرض البارزة (18.10أ): قطع الرصيف ووجوه الحافة لكل شريحة، وظل قواعد المباني وحافة الخريطة، ومستوى كل خُمس مربع
  // (0 أرض الحي والرصيف، 1 الشارع والماء) لقدمي الجندي
  final List<(Float32List, Float32List)?> _reliefSprites;
  final List<ui.Vertices?> _reliefVec;
  final Uint8List? _level;
  final double reliefDrop;
  final ui.Paint _reliefPaint;
  final _Margin? _margin;
  CityLayer._(this.ground, this.marks, this._slot, this._bandStart, this.rows, this.rowStart, this.xf, this.rects, this._pos, this._baseCol, this._col,
      this._tileDistrict, this._spriteDistrict, this.spriteCol, this._isMask, this.lights, this._tileItem, this._tileMask,
      this._tileSprite, this._slots, this._slotPos, this._slotItem, this._slotMask, this._slotLevel, this.lift, this.wide,
      this._gXf, this._gRect, this._gBase, this._gCol, this._gKindBase, this._markSprites,
      this._reliefSprites, this._reliefVec, this._level, this.reliefDrop, this._reliefPaint, this._margin) {
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
    final n = map.n, depths = 2 * n - 1, drop = art.relief;
    final dz = Float32List(n * n);   // الشارع والماء أخفض (18.10أ)
    if (drop > 0) {
      for (var k = 0; k < n * n; k++) {
        if (lowGround(map, k)) dz[k] = drop;
        if (isMonument(map, k)) dz[k] = -2 * drop;   // المعلم على منصة بدرجتين أعلى من حيه (2.3.1)
      }
    }
    final pos = Float32List(n * n * 12), col = Int32List(n * n * 6), base = Int32List(n * n), tileD = Int32List(n * n), lift = Float32List(n * n),
        wide = Float32List(n * n)..fillRange(0, n * n, TILE_HALF_W);
    final items = <_It>[];
    final bands = (depths + band - 1) ~/ band;
    final decor = Decor(map, art), markVecs = List.generate(bands, (_) => Vec()), rowVecs = List.generate(depths, (_) => Vec());
    final capture = {for (final d in map.districts) if (d.capture != null) map.idx(d.capture!.i, d.capture!.j)};
    final bases = <(double, double, double)>[];
    // صور العلامات في شريحتها، وصور الزينة القائمة مع صفها (بعد صورة المربع نفسه)
    final markList = List.generate(bands, (_) => <(Sprite, double, double)>[]);
    decor.onMark = (s, x, y, i, j) => markList[(i + j) ~/ band].add((s, x, y));
    decor.onItem = (s, x, y, i, j) => items.add(_It(i + j, i, 3, s, x, y, 1, -1, map.idx(i, j), decor: true));
    decor.groundMarks((i, j) => markVecs[(i + j) ~/ band]);
    final gSprite = List<Sprite?>.filled(n * n, null), gMod = Int32List(n * n), gKind = Int32List(n * n);
    final c = art.colors;
    for (var j = 0; j < n; j++) {
      for (var i = 0; i < n; i++) {
        final k = map.idx(i, j);
        final x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H, gy = y + dz[k];
        pos.setAll(k * 12, [x, gy - TILE_HALF_H, x + TILE_HALF_W, gy, x, gy + TILE_HALF_H,
                            x, gy - TILE_HALF_H, x, gy + TILE_HALF_H, x - TILE_HALF_W, gy]);
        base[k] = groundColor(map, art, i, j, weather).toSigned(32);
        col.fillRange(k * 6, k * 6 + 6, base[k]);
        final gk = _groundKind(map, i, j, k), gs = art.find('ground', gk);
        if (gs != null && c[gk] != null) {
          gSprite[k] = gs;
          gKind[k] = hex(c[gk]!).toSigned(32);
          gMod[k] = _modulate(base[k], gKind[k]);
        }
        tileD[k] = map.road[k] == 1 || map.type[k] == tWater || map.type[k] == tY || isMonument(map, k) ? -1 : map.districtAt[k];
        final s = tileSprite(map, art, i, j, state), did = map.road[k] == 1 ? -1 : map.districtAt[k];
        // مربعات الأحياء خانات بقناع (قد يُبنى فيها مبنى اقتصاد)، وساحة العلم خانة ولو فارغة (ساحة التدريب)
        if (s != null || capture.contains(k)) {
          items.add(_It(i + j, i, 0, s?.$1, x, y + dz[k] + (s?.$3 ?? 0), s?.$2 ?? 1, did, k));
          if (did >= 0) items.add(_It(i + j, i, 0, s?.$1, x, y + dz[k] + (s?.$3 ?? 0), s?.$2 ?? 1, did, k, mask: true));
        }
        if (s != null && dz[k] == 0 && _built.contains(map.type[k])) bases.add((x, y, s.$2));   // ظل قاعدة المبنى (18.10أ)
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
      } else if (!it.decor) {
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
    // رؤوس الأرض مرتبة بالشرائح (عدّ ثم توزيع)، ومكان كل مربع فيها
    final slot = Int32List(n * n), bandStart = Int32List(bands + 1);
    for (var k = 0; k < n * n; k++) { bandStart[(k % n + k ~/ n) ~/ band + 1]++; }
    for (var b = 0; b < bands; b++) { bandStart[b + 1] += bandStart[b]; }
    final next = Int32List.fromList(bandStart), gpos = Float32List(n * n * 12), gcol = Int32List(n * n * 6);
    final hasGround = gSprite.any((g) => g != null);
    final gXf = hasGround ? Float32List(n * n * 4) : null, gRect = hasGround ? Float32List(n * n * 4) : null;
    final gBase = hasGround ? Int32List(n * n) : null, gKindBase = hasGround ? Int32List(n * n) : null;
    for (var k = 0; k < n * n; k++) {
      final m = next[(k % n + k ~/ n) ~/ band]++;
      slot[k] = m;
      gpos.setRange(m * 12, m * 12 + 12, pos, k * 12);
      gcol.setRange(m * 6, m * 6 + 6, col, k * 6);
      if (hasGround) {
        _place(gXf!, gRect!, lift, wide, m, gSprite[k], (k % n - k ~/ n) * TILE_HALF_W, (k % n + k ~/ n) * TILE_HALF_H + dz[k], 1, art.px, false, -1, n);
        gBase![m] = gMod[k];
        gKindBase![m] = gKind[k];
      }
    }
    final markSprites = <(Float32List, Float32List)?>[
      for (final list in markList)
        if (list.isEmpty) null else () {
          final mx = Float32List(list.length * 4), mr = Float32List(list.length * 4);
          for (var q = 0; q < list.length; q++) { _place(mx, mr, lift, wide, q, list[q].$1, list[q].$2, list[q].$3, 1, art.px, false, -1, n); }
          return (mx, mr);
        }(),
    ];
    final (rs, rv, level) = drop > 0 ? _relief(map, art, decor, dz, bands, bases, n) : (const <(Float32List, Float32List)?>[], const <ui.Vertices?>[], null);
    final layer = CityLayer._([for (var b = 0; b < bands; b++) _band(gpos, gcol, bandStart, b)], [for (final v in markVecs) v.build()],
        slot, bandStart,
        [for (final v in rowVecs) v.build()], rowStart, xf, rects, gpos, base, gcol, tileD, spriteD, spriteCol, isMask,
        mapLights(map, decor.lights), tileItem, tileMask, tileImg, slots, Float32List.fromList(slotPos), slotItem, slotMask,
        Int32List(slots.length), lift, wide, gXf, gRect, gBase, gBase == null ? null : Int32List.fromList(gBase), gKindBase, markSprites,
        rs, rv, level, drop, _weatherPaint(weather), drop > 0 ? _Margin(map, art, weather) : null);
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
    final n = math.sqrt(_baseCol.length).round(), dirty = <int>{};
    for (var k = 0; k < _baseCol.length; k++) {
      final id = _tileDistrict[k];
      if (id < 0 || !changed.contains(id)) continue;
      final (owner, a) = amount[id];
      final c = owner == null || a <= 0 ? _baseCol[k] : oklabTint(_baseCol[k], hex(owner), a * groundAlpha, groundChroma).toSigned(32);
      _col.fillRange(_slot[k] * 6, _slot[k] * 6 + 6, c);
      final g = _gCol, m = _slot[k];
      // صورة الأرض بلون المربع المصبوغ، والخافتة (الثلج) كما هي: لونها المسطح تحتها مصبوغ
      if (g != null && (_gBase![m] >> 24 & 255) == 255) g[m] = owner == null || a <= 0 ? _gBase[m] : _modulate(c, _gKindBase![m], faint: false);
      dirty.add((k % n + k ~/ n) ~/ band);
    }
    for (final b in dirty) {          // الشرائح التي تغيّر فيها لون وحدها
      ground[b]?.dispose();
      ground[b] = _band(_pos, _col, _bandStart, b);
    }
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
  static ui.Vertices? _band(Float32List pos, Int32List col, Int32List start, int b) => start[b + 1] == start[b] ? null
      : ui.Vertices.raw(ui.VertexMode.triangles, Float32List.sublistView(pos, start[b] * 12, start[b + 1] * 12),
          colors: Int32List.sublistView(col, start[b] * 6, start[b + 1] * 6));

  void paint(ui.Canvas canvas, ui.Image atlas, double top, double bottom,
      {void Function()? onGround, void Function(int d)? afterRow, bool skip = false}) {
    // الأرض ثم خطوطها، للشرائح الظاهرة وحدها (حلقة الدوار وحافة الساحات تتجاوز مربعها قليلاً: هامش 48)
    bool seen(int b) => (b * band - 1) * TILE_HALF_H - 48 <= bottom && ((b + 1) * band + 1) * TILE_HALF_H + 48 >= top;
    // skip: المدينة مخفية (مفتاح عدّاد الأداء)، وما فوقها يُرسم كما هو
    if (!skip) _margin?.paint(canvas, atlas, false);
    for (var b = 0; b < ground.length && !skip; b++) { if (ground[b] != null && seen(b)) canvas.drawVertices(ground[b]!, ui.BlendMode.dst, _paint); }
    // صور الأرض فوق لونها المسطح (يسد ما بين حوافها)، ثم العلامات بالكود وصورها
    final gx = _gXf;
    for (var b = 0; b < ground.length && !skip && gx != null; b++) {
      if (!seen(b) || _bandStart[b + 1] == _bandStart[b]) continue;
      final w = _gViews[b] ??= (Float32List.sublistView(gx, _bandStart[b] * 4, _bandStart[b + 1] * 4),
          Float32List.sublistView(_gRect!, _bandStart[b] * 4, _bandStart[b + 1] * 4), Int32List.sublistView(_gCol!, _bandStart[b], _bandStart[b + 1]));
      canvas.drawRawAtlas(atlas, w.$1, w.$2, w.$3, ui.BlendMode.modulate, null, _atlasPaint);
    }
    if (!skip) _margin?.paint(canvas, atlas, true);
    for (var b = 0; b < marks.length && !skip; b++) { if (marks[b] != null && seen(b)) canvas.drawVertices(marks[b]!, ui.BlendMode.dst, _paint); }
    for (var b = 0; b < _markSprites.length && !skip; b++) {
      final w = _markSprites[b];
      if (w != null && seen(b)) canvas.drawRawAtlas(atlas, w.$1, w.$2, null, null, null, _atlasPaint);
    }
    // الرصيف ووجوه حافته، ثم ظل قواعد المباني وحافة الخريطة الأمامية
    for (var b = 0; b < _reliefSprites.length && !skip; b++) {
      final w = _reliefSprites[b];
      if (w != null && seen(b)) canvas.drawRawAtlas(atlas, w.$1, w.$2, null, null, null, _reliefPaint);
    }
    for (var b = 0; b < _reliefVec.length && !skip; b++) { if (_reliefVec[b] != null && seen(b)) canvas.drawVertices(_reliefVec[b]!, ui.BlendMode.dst, _paint); }
    onGround?.call();
    for (var d = 0; d < rows.length; d++) {
      final y = d * TILE_HALF_H;
      if (skip || y < top - _down || y - _up > bottom) { if (afterRow != null && y >= top - 60 && y - 60 <= bottom) afterRow(d); continue; }
      final row = rows[d];
      if (row != null) canvas.drawVertices(row, ui.BlendMode.dst, _paint);
      final a = rowStart[d], b = rowStart[d + 1];
      if (b > a) {
        // نوافذ الصف على مصفوفات الصور تُصنع مرة (كانت ثلاثاً لكل صف في كل إطار)، والمصفوفات نفسها تتبدل في مكانها
        final w = _views[d] ??= (Float32List.sublistView(xf, a * 4, b * 4), Float32List.sublistView(rects, a * 4, b * 4),
            Int32List.sublistView(spriteCol, a, b));
        canvas.drawRawAtlas(atlas, w.$1, w.$2, tinted ? w.$3 : null, tinted ? ui.BlendMode.modulate : null, null, _atlasPaint);
      }
      afterRow?.call(d);
    }
  }

  late final _views = List<(Float32List, Float32List, Int32List)?>.filled(rows.length, null);
  late final _gViews = List<(Float32List, Float32List, Int32List)?>.filled(ground.length, null);

  // كم تنزل قدما الجندي عند (i، j): صفر على أرض الحي والرصيف وdrop في الشارع، بتدرج خُمس مربع عند الحافة
  double drop(double i, double j) {
    final level = _level;
    if (level == null) return 0;
    final sub = GROUND.sub, side = math.sqrt(level.length).round();
    final gi = (i + 0.5) * sub - 0.5, gj = (j + 0.5) * sub - 0.5, i0 = gi.floor(), j0 = gj.floor(), fi = gi - i0, fj = gj - j0;
    double at(int a, int b) => level[b.clamp(0, side - 1) * side + a.clamp(0, side - 1)].toDouble();
    return reliefDrop * ((at(i0, j0) * (1 - fi) + at(i0 + 1, j0) * fi) * (1 - fj) + (at(i0, j0 + 1) * (1 - fi) + at(i0 + 1, j0 + 1) * fi) * fj);
  }

  void dispose() {
    for (final g in ground) { g?.dispose(); }
    for (final m in marks) { m?.dispose(); }
    for (final r in rows) { r?.dispose(); }
    for (final v in _reliefVec) { v?.dispose(); }
    _margin?.dispose();
  }
}

// هامش الخريطة (2.3.1، بطلب المستخدم: الحواف كانت مقصوصة والمباني تخرج عنها): أرض المدينة أغمق قليلاً بعرض
// GROUND.margin مربعات حول الخريطة، بلا مبانٍ ولا يمشي فيها أحد، وجانبها الأمامي تراب يغمق إلى أسفل. يُرسم خلفيها قبل الأرض
// وأماميها بعد صور الأرض (يغطي ما نزل من الشارع والماء عند الحافة)
class _Margin {
  final List<ui.Vertices?> mesh;                       // [الخلفي، الأمامي]
  final List<(Float32List, Float32List, Int32List)?> images;
  final ui.Vertices? edge;
  _Margin._(this.mesh, this.images, this.edge);

  factory _Margin(GameMap map, CityArt art, String weather) {
    final n = map.n, m = GROUND.margin, c = art.colors;
    var col = mix(hex(c['ground']!), 0x000000, 0.1);
    if (weather == 'snow') col = mix(col, hex('#eef2f5'), 0.72);
    if (weather == 'rain') col = mix(col, hex('#2a2f36'), 0.2);
    final g = art.find('ground', 'ground'), mod = g == null ? 0 : _modulate(col, hex(c['ground']!));
    final vecs = [Vec(), Vec()], spr = [<double>[], <double>[]];
    final c32 = (0xFF000000 | col).toSigned(32);
    for (var j = -m; j < n + m; j++) {
      for (var i = -m; i < n + m; i++) {
        if (map.inBounds(i, j)) continue;
        final front = i >= n || j >= n ? 1 : 0, x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
        vecs[front]
          ..tri(x, y - TILE_HALF_H - 0.4, x + TILE_HALF_W + 0.8, y, x, y + TILE_HALF_H + 0.4, c32)
          ..tri(x, y - TILE_HALF_H - 0.4, x, y + TILE_HALF_H + 0.4, x - TILE_HALF_W - 0.8, y, c32);
        if (g != null) spr[front].addAll([x, y]);
      }
    }
    (Float32List, Float32List, Int32List)? pack(List<double> p) {
      if (g == null || p.isEmpty) return null;
      final count = p.length ~/ 2, xf = Float32List(count * 4), rects = Float32List(count * 4), none = Float32List(0);
      for (var q = 0; q < count; q++) { CityLayer._place(xf, rects, none, none, q, g, p[q * 2], p[q * 2 + 1], 1, art.px, false, -1, n); }
      return (xf, rects, Int32List(count)..fillRange(0, count, mod));
    }
    // الجانب الأمامي: تراب بلون الأرض أغمق، والأيمن أغمق كوجوه الحافة
    final e = Vec(), d = GROUND.edge, top = mix(col, hex('#3b2e22'), 0.6), bottom = 0x140f0b;
    int a(int c) => (0xFF000000 | c).toSigned(32);
    for (var t = -m; t < n + m; t++) {
      for (final right in const [true, false]) {
        final a0 = right ? n + m - 0.5 : t - 0.5, b0 = right ? t - 0.5 : n + m - 0.5, a1 = right ? a0 : a0 + 1, b1 = right ? b0 + 1 : b0;
        final x0 = (a0 - b0) * TILE_HALF_W, y0 = (a0 + b0) * TILE_HALF_H, x1 = (a1 - b1) * TILE_HALF_W, y1 = (a1 + b1) * TILE_HALF_H;
        final t0 = a(right ? mix(top, 0x000000, 0.2) : top), b = a(bottom);
        e..tri(x0, y0, x1, y1, x1, y1 + d, t0, t0, b)..tri(x0, y0, x1, y1 + d, x0, y0 + d, t0, b, b);
      }
    }
    return _Margin._([vecs[0].build(), vecs[1].build()], [pack(spr[0]), pack(spr[1])], e.build());
  }

  static final _paint = ui.Paint(), _atlasPaint = ui.Paint()..filterQuality = ui.FilterQuality.medium;
  void paint(ui.Canvas canvas, ui.Image atlas, bool front) {
    final k = front ? 1 : 0, w = images[k];
    if (mesh[k] != null) canvas.drawVertices(mesh[k]!, ui.BlendMode.dst, _paint);
    if (w != null) canvas.drawRawAtlas(atlas, w.$1, w.$2, w.$3, ui.BlendMode.modulate, null, _atlasPaint);
    if (front && edge != null) canvas.drawVertices(edge!, ui.BlendMode.dst, _paint);
  }

  void dispose() { for (final v in mesh) { v?.dispose(); } edge?.dispose(); }
}

// مربعات المباني (لها ظل قاعدة): البيوت والأطلال والقاعدة والشرطة والبرج والمستشفى. والمبنى المميز بلا ظل: منصته مقصوصة
// على الأرض (pack_atlases.py)، والمعلم على منصته
const _built = {tH, tR, tQ, tN, 0x54, 0x4D};

// الرصيف والحافة يبيضّان في الثلج ويغمقان في المطر (أرض المدينة كذلك في groundColor)
ui.Paint _weatherPaint(String weather) {
  final p = ui.Paint()..filterQuality = ui.FilterQuality.medium;
  if (weather == 'snow') {
    final a = GROUND.snow, k = 1 - a, w = 255 * a;
    p.colorFilter = ui.ColorFilter.matrix([k, 0, 0, 0, w, 0, k, 0, 0, w, 0, 0, k, 0, w, 0, 0, 0, 1, 0]);
  } else if (weather == 'rain') {
    final k = GROUND.rain;
    p.colorFilter = ui.ColorFilter.matrix([k, 0, 0, 0, 0, 0, k, 0, 0, 0, 0, 0, k, 0, 0, 0, 0, 0, 1, 0]);
  }
  return p;
}

// الأرض البارزة (18.10أ). مستوى كل خُمس مربع: الشارع والماء 1 (أخفض بـ drop)، وأرض الأحياء 0، وعلى مربع الشارع رصيف
// (0) بعرض خُمس على كل ضلع يجاور أرضاً أعلى، وركن خُمس×خُمس حيث تجاوره من الركن وحده، فيلتف الرصيف حول الحي.
// ثم: قطعة الرصيف لكل ضلع وركن (من صورة البلاط نفسها، فتتصل)، ووجه حافة لكل خُمس أعلى يطل على أخفض أمامه
// (+i الأيمن أو +j الأيسر)، وحافة الخريطة الأمامية، وظل قاعدة كل مبنى: حلقات معيّن حوله تخفت إلى الخارج
(List<(Float32List, Float32List)?>, List<ui.Vertices?>, Uint8List) _relief(
    GameMap map, CityArt art, Decor decor, Float32List dz, int bands, List<(double, double, double)> bases, int n) {
  final sub = GROUND.sub, side = n * sub, level = Uint8List(side * side);
  final tops = List.generate(bands, (_) => <(Sprite, double, double)>[]), faces = List.generate(bands, (_) => <(Sprite, double, double)>[]);
  final vecs = List.generate(bands, (_) => Vec());
  int bandOf(int i, int j) => math.min(bands - 1, math.max(0, (i + j) ~/ CityLayer.band));
  for (var j = 0; j < n; j++) {
    for (var i = 0; i < n; i++) {
      final k = map.idx(i, j);
      if (dz[k] <= 0) continue;                              // أرض الحي، ومنصة المعلم (أعلى منها)
      for (var b = 0; b < sub; b++) { level.fillRange((j * sub + b) * side + i * sub, (j * sub + b) * side + i * sub + sub, 1); }
      if (map.type[k] == tWater) continue;                  // الماء بلا رصيف (ضفته في 18.10ج)
      final x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H, list = tops[bandOf(i, j)];
      void up(String kind, int a0, int a1, int b0, int b1) {
        for (var b = b0; b < b1; b++) { level.fillRange((j * sub + b) * side + i * sub + a0, (j * sub + b) * side + i * sub + a1, 0); }
        final s = art.find('relief', kind);
        if (s != null) list.add((s, x, y));
      }
      final ui_ = decor.upper(i - 1, j), ue = decor.upper(i + 1, j), uj = decor.upper(i, j - 1), uf = decor.upper(i, j + 1);
      if (ui_) up('top_a0', 0, 1, 0, sub);
      if (ue) up('top_a4', sub - 1, sub, 0, sub);
      if (uj) up('top_b0', 0, sub, 0, 1);
      if (uf) up('top_b4', 0, sub, sub - 1, sub);
      if (!ui_ && !uj && decor.upper(i - 1, j - 1)) up('top_c00', 0, 1, 0, 1);
      if (!ue && !uj && decor.upper(i + 1, j - 1)) up('top_c40', sub - 1, sub, 0, 1);
      if (!ui_ && !uf && decor.upper(i - 1, j + 1)) up('top_c04', 0, 1, sub - 1, sub);
      if (!ue && !uf && decor.upper(i + 1, j + 1)) up('top_c44', sub - 1, sub, sub - 1, sub);
    }
  }
  // وجوه الحافة: أول ضلع الخُمس الأعلى حيث يطل على أخفض أمامه، بقطعة الحافة التالية في صورتها (تتصل من خُمس لآخر)
  final fi = [for (var s = 0; s < sub; s++) art.find('relief', 'face_i$s')], fj = [for (var s = 0; s < sub; s++) art.find('relief', 'face_j$s')];
  for (var sj = 0; sj < side; sj++) {
    for (var si = 0; si < side; si++) {
      if (level[sj * side + si] != 0) continue;
      final list = faces[bandOf(si ~/ sub, sj ~/ sub)];
      if (si + 1 < side && level[sj * side + si + 1] == 1 && fi[sj % sub] != null) {
        final a = (si + 1) / sub - 0.5, b = sj / sub - 0.5;
        list.add((fi[sj % sub]!, (a - b) * TILE_HALF_W, (a + b) * TILE_HALF_H));
      }
      if (sj + 1 < side && level[(sj + 1) * side + si] == 1 && fj[si % sub] != null) {
        final a = si / sub - 0.5, b = (sj + 1) / sub - 0.5;
        list.add((fj[si % sub]!, (a - b) * TILE_HALF_W, (a + b) * TILE_HALF_H));
      }
    }
  }
  // هامش الخريطة الخلفي أرض أعلى من الماء عند الحافة الخلفية: وجه ضفته عليه
  for (var t = 0; t < side; t++) {
    if (level[t * side] == 1 && fi[t % sub] != null) {
      final a = -0.5, b = t / sub - 0.5;
      faces[bandOf(0, t ~/ sub)].add((fi[t % sub]!, (a - b) * TILE_HALF_W, (a + b) * TILE_HALF_H));
    }
    if (level[t] == 1 && fj[t % sub] != null) {
      final a = t / sub - 0.5, b = -0.5;
      faces[bandOf(t ~/ sub, 0)].add((fj[t % sub]!, (a - b) * TILE_HALF_W, (a + b) * TILE_HALF_H));
    }
  }
  // منصة المعلم (2.3.1): وجهاها الأماميان من أعلاها إلى أرض الحي والرصيف حولها
  final up = art.relief;
  for (var k = 0; k < n * n; k++) {
    if (dz[k] >= 0) continue;
    final i = k % n, j = k ~/ n, list = faces[bandOf(i, j)];
    final ri = !(map.inBounds(i + 1, j) && dz[map.idx(i + 1, j)] < 0), rj = !(map.inBounds(i, j + 1) && dz[map.idx(i, j + 1)] < 0);
    for (var row = 2; row >= 1; row--) {                    // درجتان: العليا ثم السفلى أمامها
      for (var s = 0; s < sub; s++) {
        if (ri && fi[s] != null) { final a = i + 0.5, b = j - 0.5 + s / sub; list.add((fi[s]!, (a - b) * TILE_HALF_W, (a + b) * TILE_HALF_H - up * row)); }
        if (rj && fj[s] != null) { final a = i - 0.5 + s / sub, b = j + 0.5; list.add((fj[s]!, (a - b) * TILE_HALF_W, (a + b) * TILE_HALF_H - up * row)); }
      }
    }
  }
  // ظل قاعدة كل مبنى على ما حوله
  final shade = ((GROUND.shadow * 255).round() << 24).toSigned(32);
  final rings = [GROUND.shadowIn, GROUND.shadowMid, GROUND.shadowOut], alphas = [shade, shade, 0];
  const cx = [0.0, 1.0, 0.0, -1.0], cy = [-1.0, 0.0, 1.0, 0.0];   // رؤوس المعيّن: أعلى ويمين وأسفل ويسار
  for (final (x, y, sc) in bases) {
    final v = vecs[bandOf(((x / TILE_HALF_W + y / TILE_HALF_H) / 2).round(), ((y / TILE_HALF_H - x / TILE_HALF_W) / 2).round())];
    for (var r = 0; r < 2; r++) {
      final w0 = TILE_HALF_W * sc * rings[r], h0 = TILE_HALF_H * sc * rings[r], w1 = TILE_HALF_W * sc * rings[r + 1], h1 = TILE_HALF_H * sc * rings[r + 1];
      for (var c = 0; c < 4; c++) {
        final d = (c + 1) % 4;
        final ax = x + cx[c] * w0, ay = y + cy[c] * h0, bx = x + cx[d] * w0, by = y + cy[d] * h0;
        final a2x = x + cx[c] * w1, a2y = y + cy[c] * h1, b2x = x + cx[d] * w1, b2y = y + cy[d] * h1;
        v.tri(ax, ay, bx, by, b2x, b2y, alphas[r], alphas[r], alphas[r + 1]);
        v.tri(ax, ay, b2x, b2y, a2x, a2y, alphas[r], alphas[r + 1], alphas[r + 1]);
      }
    }
  }
  final sprites = <(Float32List, Float32List)?>[
    for (var b = 0; b < bands; b++)
      if (tops[b].isEmpty && faces[b].isEmpty) null else () {
        final list = [...tops[b], ...faces[b]], xf = Float32List(list.length * 4), rects = Float32List(list.length * 4), none = Float32List(0);
        for (var q = 0; q < list.length; q++) { CityLayer._place(xf, rects, none, none, q, list[q].$1, list[q].$2, list[q].$3, 1, art.px, false, -1, n); }
        return (xf, rects);
      }(),
  ];
  return (sprites, [for (final v in vecs) v.build()], level);
}
