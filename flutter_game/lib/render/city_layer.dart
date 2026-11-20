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
import 'occlusion.dart';
import 'city_art.dart';
import 'colors.dart';
import 'decor.dart';
import '../map/parks.dart';
import 'empire_art.dart' show hqTier;
import 'vec.dart';
import 'weather_art.dart';

// أرض الحي المميز وحي الشرطة وحي الميزة تميل لألوانها قبل الاستيلاء (REGION_HINT في cityRender.js)
final _regionHint = <String, (int, double)>{
  'police': (hex('#6f7b8a'), 0.35),
  'special': (hex('#bba565'), 0.22),
  'feature': (hex(CITY_FEATURES.ground.$1), CITY_FEATURES.ground.$2),
};

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
  final fd = map.districtOf(i, j), square = type == tP && fd != null && fd.featureTile != null && (fd.featureBig || fd.temple || fd.merc);
  if (type == tP && !square) return hex(c['plaza']!);
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
  if (parksOf(map).contains(map.districtAt[k])) color = mix(color, hex('#5f8f45'), aridCity(map.city) ? GROUND.parkArid : GROUND.park);
  final hint = _regionHint[map.region[k]];
  if (hint != null) color = mix(color, hint.$1, hint.$2);
  return color;
}

// صورة المربع ومقياسها وإزاحتها، أو null (الأرض والشوارع وساحات العلم: زينتها في ن2). وstate للمباراة: صور ترقيات
// البرج والمستشفى ومستوى القاعدة وساحة تدريبها (بلا state صور الأحجام وحدها)
// والمقياس النهائي (2.3.2): المعلم أصغر داخل حافته، وبيوت الحدائق أشجار، والمباني أصغر قليلاً من مربعها (فلا تخرج زينتها
// إلى الرصيف) وأصغر على حافة الخريطة
// (الصورة، مقياسها، إزاحتها x، إزاحتها y). وفناء بين الرصيف والمبنى (2.4.0، بطلب المستخدم: "مسافة بين حدود الرصيف وحدود
// الحي... لكي لا يكون هناك تداخل من المباني على الرصيف"): المبنى يبتعد عن كل ضلع يطل على شارع أو ماء أو حي آخر أو حافة
// الخريطة حتى يبقى بينهما GROUND.yard من المربع، فلا تخرج صورته إلى الرصيف ولا عن الخريطة، وحد الحي الملون في الفناء
(Sprite, double, double, double)? tileSprite(GameMap map, CityArt art, int i, int j, [MatchState? state]) {
  final k = map.idx(i, j), type = map.type[k];
  if (map.road[k] == 1) { final s = _tileSprite(map, art, i, j, state); return s == null ? null : (s.$1, s.$2, 0, s.$3); }
  if (isMonument(map, k)) {
    // المعلم في الحديقة، وجزيرة الدوار مكانه في مدن الدوار (أعرض: تُصغَّر إلى مربعها)
    final m = art.find('monument', 'monument'), island = m == null ? art.find('decor', 'island') : null;
    if (m != null) return (m, art.scale * GROUND.monument, 0, 0);
    return island == null ? null : (island, GROUND.island, 0, 0);
  }
  final park = (type == tH || type == tR) && parksOf(map).contains(map.districtAt[k]);
  if (park && k == parkCenter(map, map.districts[map.districtAt[k]])) {
    // وسط الحديقة: بئر في المدن العربية والأفريقية (من زينة اليمامة)، ونافورة من صور المستخدم في غيرها (2.4.1: كانت بالكود)،
    // نافورتا شيكاغو وروتنبورغ بالتناوب، بمقياس يسعه مربعه
    final w = parkWell(map) ? art.find('prop', 'well') : null;
    if (w != null) return (w, art.scale, 0, 0);
    final f = art.find('decor', 'fountain', 1 + map.districtAt[k] % math.max(1, art.count('decor', 'fountain')));
    return f == null ? null : (f, math.min(1.0, GROUND.fountain * 2 * TILE_HALF_W * art.px / f.w), 0, 0);
  }
  final s = park ? _parkTree(map, art, i, j) : _tileSprite(map, art, i, j, state);
  if (s == null) return null;
  if (park || !_built.contains(type)) return (s.$1, s.$2, 0, s.$3);
  final id = map.districtAt[k], sc = s.$2 * GROUND.inset;
  bool out(int a, int b) => !map.inBounds(a, b) || lowGround(map, map.idx(a, b)) || map.districtAt[map.idx(a, b)] != id;
  // يبتعد عن الضلع الأمامي المطل على الخارج بقدر ما يبرز منه (العتبات والمظلات، 2.4.1: كانت تخرج إلى الرصيف وأمام السور) حتى
  // GROUND.yardMax، ويتقدم عن الخلفي حتى يبقى الفناء، وبينهما إن كان الضلعان خارجيين
  double away(bool lo, bool hi, double reach) {
    final front = hi ? math.max(-GROUND.yardMax, math.min(0.0, 0.5 - GROUND.yard - sc * (0.5 + reach))) : 0.0;
    final back = lo ? math.max(0.0, sc * 0.5 - (0.5 - GROUND.yard)) : 0.0;
    return hi && lo ? (front + back) / 2 : front + back;
  }
  final da = away(out(i - 1, j), out(i + 1, j), s.$1.pi), db = away(out(i, j - 1), out(i, j + 1), s.$1.pj);
  return (s.$1, sc, (da - db) * TILE_HALF_W, s.$3 + (da + db) * TILE_HALF_H);
}

// شجرة الحديقة: شجرة المدينة (نخيلها أو كرزها...) أو شجرة الرصيف، بنسخة بالتجزئة
(Sprite, double, double)? _parkTree(GameMap map, CityArt art, int i, int j) {
  final t = CITY_THEMES[map.city]!.tree, v = (i * 3 + j) % 3 + 1;
  final s = (t == null ? null : art.find('prop', t, v) ?? art.find('building', t, v)) ??
      [for (final k in const ['tree', 'pine', 'palm', 'cherry', 'willow', 'banyan', 'neem']) art.find('prop', k, v)].firstWhere((s) => s != null, orElse: () => null) ??
      art.find('decor', 'stree');
  return s == null ? null : (s, art.scale, 0);
}

(Sprite, double, double)? _tileSprite(GameMap map, CityArt art, int i, int j, [MatchState? state]) {
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
    if (kind == 'monument') {                                      // مكان المعلم القديم: بيت (المعلم في حديقة، 2.4.0)
      final s = _houseFor(map, art, i, j);
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
    // الكتلة 2×2 من مربعها الأمامي حول وسطها، وخانة 3×3 والحي الضيق بمربع واحد (featureArt في decor.dart)
    final (k, dy) = featureArt(district);
    return (s, k, dy);
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
  if (type == tP || kind == 'fplaza' || (type == tDot && (kind == 'lane_i' || kind == 'lane_j'))) return 'plaza';
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
  final _Strips _ground, _marks;       // الأرض المسطحة وخطوطها: أمر رسم واحد للشرائح الظاهرة كلها (2.8.0)
  final Int32List _slot, _bandStart;   // مكان رؤوس كل مربع في مصفوفة الأرض (مرتبة بالشرائح)، وأول مربع في كل شريحة
  final List<ui.Vertices?> rows;     // زينة كل صف
  final Int32List rowStart;          // أول صورة لكل صف في xf وrects (والأخير = العدد)
  final Float32List xf, rects;       // لكل صورة: التحويل (scos, ssin, tx, ty) ومستطيلها في الأطلس
  // صبغ المالك (القسم 8): لون أرض كل مربع قبل الصبغ وحيّه، وحي كل صورة ولونها (أبيض بلا صبغ، والقناع بلون المالك)
  final Int32List _baseCol, _col, _tileDistrict, _spriteDistrict, spriteCol;
  final Uint8List _isMask;
  final _applied = <int, (String?, double)>{};
  bool tinted = false;
  int version = 0;                   // تزيد كلما تغير شيء فيها (لون حي، أو مبنى، أو سور): صورة المدينة الجاهزة ترسم نفسها من جديد
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
  final _Sprites _markSprites;
  // الأرض البارزة (18.10أ): قطع الرصيف ووجوه الحافة لكل شريحة، وظل قواعد المباني وحافة الخريطة، ومستوى كل خُمس مربع
  // (0 أرض الحي والرصيف، 1 الشارع والماء) لقدمي الجندي
  final _Sprites _reliefSprites;
  final _Strips _reliefVec;
  final Uint8List? _level;
  final double reliefDrop;
  final ui.Paint _reliefPaint;
  final _Edge? _margin;
  CityLayer._(this._ground, this._marks, this._slot, this._bandStart, this.rows, this.rowStart, this.xf, this.rects, this._baseCol, this._col,
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
        tileD[k] = map.road[k] == 1 || map.type[k] == tWater || map.type[k] == tY ? -1 : map.districtAt[k];
        final s = tileSprite(map, art, i, j, state), did = map.road[k] == 1 || parkPiece(map, k) ? -1 : map.districtAt[k];
        final sx = x + (s?.$3 ?? 0), sy = y + dz[k] + (s?.$4 ?? 0);
        // مربعات الأحياء خانات بقناع (قد يُبنى فيها مبنى اقتصاد)، وساحة العلم خانة ولو فارغة (ساحة التدريب)
        if (s != null || capture.contains(k)) {
          items.add(_It(i + j, i, 0, s?.$1, sx, sy, s?.$2 ?? 1, did, k));
          if (did >= 0) items.add(_It(i + j, i, 0, s?.$1, sx, sy, s?.$2 ?? 1, did, k, mask: true));
        }
        if (s != null && dz[k] == 0 && _built.contains(map.type[k]) && !parksOf(map).contains(map.districtAt[k])) bases.add((sx, sy, s.$2));   // ظل قاعدة المبنى (18.10أ)
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
    final markSprites = _Sprites.join(<(Float32List, Float32List)?>[
      for (final list in markList)
        if (list.isEmpty) null else () {
          final mx = Float32List(list.length * 4), mr = Float32List(list.length * 4);
          for (var q = 0; q < list.length; q++) { _place(mx, mr, lift, wide, q, list[q].$1, list[q].$2, list[q].$3, 1, art.px, false, -1, n); }
          return (mx, mr);
        }(),
    ]);
    final (rs, rv, level) = drop > 0 ? _relief(map, art, decor, dz, bands, bases, n)
        : (List<(Float32List, Float32List)?>.filled(bands, null), List.generate(bands, (_) => Vec()), null);
    final (mp, mc, ms) = Vec.join(markVecs);
    final (rp, rc, rst) = Vec.join(rv);
    final layer = CityLayer._(_Strips(gpos, gcol, Int32List.fromList([for (final t in bandStart) t * 6])), _Strips(mp, mc, ms),
        slot, bandStart,
        [for (final v in rowVecs) v.build()], rowStart, xf, rects, base, gcol, tileD, spriteD, spriteCol, isMask,
        mapLights(map, decor.lights), tileItem, tileMask, tileImg, slots, Float32List.fromList(slotPos), slotItem, slotMask,
        Int32List(slots.length), lift, wide, gXf, gRect, gBase, gBase == null ? null : Int32List.fromList(gBase), gKindBase, markSprites,
        _Sprites.join(rs), _Strips(rp, rc, rst), level, drop, _weatherPaint(weather), drop > 0 ? _Edge(map, art, weather, dz, base) : null);
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
      final x = (k % n - k ~/ n) * TILE_HALF_W + (now?.$3 ?? 0), y = (k % n + k ~/ n) * TILE_HALF_H + (now?.$4 ?? 0), sc = now?.$2 ?? 1;
      _put(m, now?.$1, x, y, sc, art.px, k, n);
      if (mm != null) _put(mm, now?.$1, x, y, sc, art.px, k, n);
      _tileSprite[k] = now?.$1;
      version++;
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
      // عمود الركن في كل مستوى (2.4.1: كان من المستوى 2، فيظهر في الأول التقاء القطعتين على الركن): برج المستوى 2 أصغر قليلاً
      var s = lv > 0 ? art.piece('wall', kind, lv) : null, sc = 1.0;
      if (s == null && lv == 1 && kind == 'tower') { s = art.piece('wall', 'tower', 2); sc = 0.8; }
      final x = _slotPos[id * 3], y = _slotPos[id * 3 + 1], k = _slotPos[id * 3 + 2].toInt();
      _put(_slotItem[id], s, x, y, sc, art.px, k, map.n);
      _put(_slotMask[id], s, x, y, sc, art.px, k, map.n);
      version++;
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
    var dirty = false;
    for (var k = 0; k < _baseCol.length; k++) {
      final id = _tileDistrict[k];
      if (id < 0 || !changed.contains(id)) continue;
      final (owner, a) = amount[id];
      final c = owner == null || a <= 0 ? _baseCol[k] : oklabTint(_baseCol[k], hex(owner), a * groundAlpha, groundChroma).toSigned(32);
      _col.fillRange(_slot[k] * 6, _slot[k] * 6 + 6, c);
      final g = _gCol, m = _slot[k];
      // صورة الأرض بلون المربع المصبوغ، والخافتة (الثلج) كما هي: لونها المسطح تحتها مصبوغ
      if (g != null && (_gBase![m] >> 24 & 255) == 255) g[m] = owner == null || a <= 0 ? _gBase[m] : _modulate(c, _gKindBase![m], faint: false);
      dirty = true;
    }
    if (dirty) _ground.stale();
    version++;
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
      {void Function()? onGround, void Function(int d)? afterRow, bool skip = false}) {
    // skip: المدينة مخفية (مفتاح عدّاد الأداء)، وما فوقها يُرسم كما هو
    if (!skip) paintGround(canvas, atlas, top, bottom);
    _rows(canvas, atlas, top, bottom, onGround, afterRow, skip);
  }

  // الأرض بطبقاتها للشرائح بين top وbottom (حلقة الدوار وحافة الساحات تتجاوز مربعها قليلاً: هامش 48). الشرائح الظاهرة
  // متجاورة (b0..b1): كل طبقة بأمر رسم واحد لها كلها (2.8.0، كانت أمراً لكل شريحة)، والترتيب بين الطبقات كما كان
  void paintGround(ui.Canvas canvas, ui.Image atlas, double top, double bottom) {
    bool seen(int b) => (b * band - 1) * TILE_HALF_H - 48 <= bottom && ((b + 1) * band + 1) * TILE_HALF_H + 48 >= top;
    final bands = _bandStart.length - 1;
    var b0 = 0, b1 = bands - 1;
    while (b0 < bands && !seen(b0)) { b0++; }
    while (b1 >= b0 && !seen(b1)) { b1--; }
    final any = b0 <= b1;
    if (any) {
      _ground.paint(canvas, b0, b1, _paint);
      // صور الأرض فوق لونها المسطح (يسد ما بين حوافها)
      final gx = _gXf, a = _bandStart[b0], b = _bandStart[b1 + 1];
      if (gx != null && b > a) {
        canvas.drawRawAtlas(atlas, Float32List.sublistView(gx, a * 4, b * 4), Float32List.sublistView(_gRect!, a * 4, b * 4),
            Int32List.sublistView(_gCol!, a, b), ui.BlendMode.modulate, null, _atlasPaint);
      }
    }
    _margin?.paint(canvas);
    if (any) {
      // العلامات بالكود وصورها، ثم الرصيف ووجوه حافته، ثم ظل قواعد المباني وحافة الخريطة الأمامية
      _marks.paint(canvas, b0, b1, _paint);
      _markSprites.paint(canvas, atlas, b0, b1, _atlasPaint);
      _reliefSprites.paint(canvas, atlas, b0, b1, _reliefPaint);
      _reliefVec.paint(canvas, b0, b1, _paint);
    }
  }

  void _rows(ui.Canvas canvas, ui.Image atlas, double top, double bottom, void Function()? onGround, void Function(int d)? afterRow, bool skip) {
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

  // ما يُعاد فوق الجنود (2.10.0، OcclusionGrid): كل صورة في الصف e تغطي من الشبكة ما عمقه أصغر من e (خلفها)، ومعها قناع رايات
  // مالكها، بترتيبهما في الصف، للصفوف الظاهرة بين top وbottom. والمعادة نفسها تدخل الشبكة بعمقها، فما أمامها يُعاد بعدها (وإلا
  // غطّته). وزينة الصفوف المرسومة بالكود لا تُعاد: كلها على الأرض أو صغيرة
  void occluders(OcclusionGrid g, double top, double bottom, void Function(int e, int m) pick) {
    if (!g.any) return;
    for (var e = 0; e < rows.length; e++) {
      final y = e * TILE_HALF_H;
      if (y < top - _down || y - _up > bottom) continue;
      var first = -1;
      for (var m = rowStart[e]; m < rowStart[e + 1]; m++) {
        final o = m * 4, w = rects[o + 2] - rects[o], h = rects[o + 3] - rects[o + 1];
        if (_isMask[m] == 1 || w <= 0 || h <= 0) continue;
        final u = xf[o], x = xf[o + 2], t = xf[o + 3];
        if (!g.covers(x, t, x + u * w, t + u * h, e)) continue;
        g.markBox(x, t, x + u * w, t + u * h, e);
        _picked[m] = 1;
        final mm = _maskOf[m];
        if (mm >= 0 && spriteCol[mm] != 0) _picked[mm] = 1;   // قناع بلا مالك شفاف
        if (first < 0) first = m;
      }
      if (first < 0) continue;
      for (var m = first; m < rowStart[e + 1]; m++) { if (_picked[m] == 1) { _picked[m] = 0; pick(e, m); } }
    }
  }
  late final _picked = Uint8List(spriteCol.length);
  // قناع كل صورة أو -1 (الأقنعة بعد صورها في صفها، وقد تفصل بينهما صورة زينة في المربع نفسه)
  late final Int32List _maskOf = () {
    final r = Int32List(spriteCol.length)..fillRange(0, spriteCol.length, -1);
    _tileItem.forEach((k, m) { final mm = _tileMask[k]; if (mm != null) r[m] = mm; });
    for (var s = 0; s < _slotItem.length; s++) { r[_slotItem[s]] = _slotMask[s]; }
    return r;
  }();

  // ترسم الصور المختارة ثانية بلونها كما في صفها (فوق ما خلفها من جنود وأعلام)
  static int redrawn = 0;           // كم صورة أُعيدت (للفحص)
  void redraw(ui.Canvas canvas, ui.Image atlas, Int32List picks, int n) {
    if (n == 0) return;
    redrawn += n;
    final x = Float32List(n * 4), r = Float32List(n * 4), c = Int32List(n);
    for (var k = 0; k < n; k++) {
      final m = picks[k], o = m * 4;
      x.setRange(k * 4, k * 4 + 4, xf, o);
      r.setRange(k * 4, k * 4 + 4, rects, o);
      c[k] = spriteCol[m];
    }
    canvas.drawRawAtlas(atlas, x, r, tinted ? c : null, tinted ? ui.BlendMode.modulate : null, null, _atlasPaint);
  }

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
    _ground.dispose();
    _marks.dispose();
    _reliefVec.dispose();
    for (final r in rows) { r?.dispose(); }
    _margin?.dispose();
  }
}

// حافة الخريطة (2.4.0، بطلب المستخدم: "حدود الخريطة يتم تعبئته بالكامل من دون فراغات"، والماء "يغطي الحدود كاملة لكي يعطي
// شكل النهر الجاري"): بلا هامش حولها (كان شريط أرض بعرض GROUND.margin، والفناء بين الرصيف والمبنى يمنع خروج المباني عنها
// الآن)، ووجه تراب تحت الضلعين الأماميين بمستوى كل مربع (الشارع أخفض)، والماء يمتد خارج الخريطة ويخفت فيبدو نهراً يجري تحتها
class _Edge {
  final ui.Vertices? mesh;
  _Edge._(this.mesh);

  factory _Edge(GameMap map, CityArt art, String weather, Float32List dz, Int32List base) {
    final n = map.n, d = GROUND.edge, deep = art.relief + d, c = art.colors;
    var col = mix(hex(c['ground']!), 0x000000, 0.12);
    if (weather == 'snow') col = mix(col, hex('#eef2f5'), 0.72);
    if (weather == 'rain') col = mix(col, hex('#2a2f36'), 0.2);
    final top = mix(col, hex('#3b2e22'), 0.6), right = (0xFF000000 | mix(top, 0x000000, 0.2)).toSigned(32);
    final left = (0xFF000000 | top).toSigned(32), bottom = (0xFF000000 | 0x140f0b).toSigned(32);
    (double, double) p(double a, double b) => ((a - b) * TILE_HALF_W, (a + b) * TILE_HALF_H);
    final v = Vec();
    void face((double, double) a, (double, double) b, double z, int t) {
      v..tri(a.$1, a.$2 + z, b.$1, b.$2 + z, b.$1, b.$2 + deep, t, t, bottom)..tri(a.$1, a.$2 + z, b.$1, b.$2 + deep, a.$1, a.$2 + deep, t, bottom, bottom);
    }
    final water = <int>[];
    for (var t = 0; t < n; t++) {
      final kr = map.idx(n - 1, t), kl = map.idx(t, n - 1);
      if (map.type[kr] != tWater) face(p(n - 0.5, t - 0.5), p(n - 0.5, t + 0.5), dz[kr], right);
      if (map.type[kl] != tWater) face(p(t - 0.5, n - 0.5), p(t + 0.5, n - 0.5), dz[kl], left);
      for (final k in [kr, kl, map.idx(t, 0), map.idx(0, t)]) { if (map.type[k] == tWater && !water.contains(k)) water.add(k); }
    }
    // الماء على الحافة يمتد خارجها بلونه ويخفت حتى GROUND.river من المربع، وزواياه كذلك
    final reach = GROUND.river;
    for (final k in water) {
      // يخفت إلى لون أغمق (لا وهج بلون الماء على الخلفية الداكنة)
      final i = k % n, j = k ~/ n, z = dz[k], c0 = (0xFF000000 | base[k]).toSigned(32), c1 = mix(base[k] & 0xFFFFFF, 0x141210, 0.55);
      // رباعي على الماء من (a، b) بألوان رؤوسه
      void quad((double, double) a, (double, double) b, (double, double) e, (double, double) f, int ca, int cb, int ce, int cf) {
        v..tri(a.$1, a.$2 + z, b.$1, b.$2 + z, e.$1, e.$2 + z, ca, cb, ce)..tri(a.$1, a.$2 + z, e.$1, e.$2 + z, f.$1, f.$2 + z, ca, ce, cf);
      }
      void out(double a0, double b0, double a1, double b1, double da, double db) =>
          quad(p(a0, b0), p(a1, b1), p(a1 + da, b1 + db), p(a0 + da, b0 + db), c0, c0, c1, c1);
      final si = i == n - 1 ? 1 : i == 0 ? -1 : 0, sj = j == n - 1 ? 1 : j == 0 ? -1 : 0;
      if (si != 0) out(i + si * 0.5, j - 0.5, i + si * 0.5, j + 0.5, si * reach, 0);
      if (sj != 0) out(i - 0.5, j + sj * 0.5, i + 0.5, j + sj * 0.5, 0, sj * reach);
      if (si != 0 && sj != 0) {                       // الزاوية: من ركن المربع إلى ركنها البعيد
        quad(p(i + si * 0.5, j + sj * 0.5), p(i + si * (0.5 + reach), j + sj * 0.5), p(i + si * (0.5 + reach), j + sj * (0.5 + reach)),
            p(i + si * 0.5, j + sj * (0.5 + reach)), c0, c1, c1, c1);
      }
    }
    return _Edge._(v.build());
  }

  static final _paint = ui.Paint();
  void paint(ui.Canvas canvas) { if (mesh != null) canvas.drawVertices(mesh!, ui.BlendMode.dst, _paint); }
  void dispose() => mesh?.dispose();
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
(List<(Float32List, Float32List)?>, List<Vec>, Uint8List) _relief(
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
  return (sprites, vecs, level);
}

// طبقة أرض بشرائحها متتالية (2.8.0): رؤوس الشرائح كلها في مصفوفة واحدة، وstart أول رأس لكل شريحة. تُرسم الظاهرة منها
// (b0..b1) بأمر واحد يُحفظ حتى تتغير الشرائح الظاهرة أو ألوانها (stale). كانت أمراً لكل شريحة في كل إطار
class _Strips {
  final Float32List pos;
  final Int32List col, start;
  ui.Vertices? _v;
  int _key = -1;
  _Strips(this.pos, this.col, this.start);
  void paint(ui.Canvas canvas, int b0, int b1, ui.Paint paint) {
    final key = b0 << 16 | b1;
    if (key != _key) {
      _v?.dispose();
      _key = key;
      final a = start[b0], b = start[b1 + 1];
      _v = b == a ? null
          : ui.Vertices.raw(ui.VertexMode.triangles, Float32List.sublistView(pos, a * 2, b * 2), colors: Int32List.sublistView(col, a, b));
    }
    final v = _v;
    if (v != null) canvas.drawVertices(v, ui.BlendMode.dst, paint);
  }
  void stale() => _key = -1;
  void dispose() => _v?.dispose();
}

// صور بشرائحها متتالية: لكل صورة تحويلها ومستطيلها في الأطلس، وstart أول صورة لكل شريحة
class _Sprites {
  final Float32List xf, rects;
  final Int32List start;
  _Sprites(this.xf, this.rects, this.start);
  factory _Sprites.join(List<(Float32List, Float32List)?> bands) {
    final start = Int32List(bands.length + 1);
    for (var b = 0; b < bands.length; b++) { start[b + 1] = start[b] + (bands[b]?.$1.length ?? 0) ~/ 4; }
    final xf = Float32List(start.last * 4), rects = Float32List(start.last * 4);
    for (var b = 0; b < bands.length; b++) {
      final w = bands[b];
      if (w == null) continue;
      xf.setAll(start[b] * 4, w.$1);
      rects.setAll(start[b] * 4, w.$2);
    }
    return _Sprites(xf, rects, start);
  }
  void paint(ui.Canvas canvas, ui.Image atlas, int b0, int b1, ui.Paint paint) {
    final a = start[b0], b = start[b1 + 1];
    if (b > a) canvas.drawRawAtlas(atlas, Float32List.sublistView(xf, a * 4, b * 4), Float32List.sublistView(rects, a * 4, b * 4), null, null, null, paint);
  }
}

// أرض المدينة صورة جاهزة (2.9.0، الخطوة الثانية بطلب المستخدم: "اجعل اللعبة تعمل على 30 إطاراً ثابتة"): طبقات الأرض (وحدود
// الأحياء في المباراة) أثقل ما في رسم المدينة (78% منه في أداة القياس) ولا تتغير إلا قليلاً. تُرسم مرة في صورة تغطي الشاشة وربعها
// حولها بتقريب الكاميرا ونقاط الجهاز، ويعرضها كل إطار بأمر واحد على نقاط الشاشة نفسها. تُرسم من جديد حين تخرج الشاشة عنها (ولا
// أكثر من مرة كل GROUND_CACHE.gap إطارات: والكاميرا تجري تُرسم الأرض مباشرة كما كانت)، أو يستقر تقريب جديد (وأثناء التقريب
// مباشرة)، أو يتغير ما فيها (key). ومنذ 2.10.0 فيها المدينة كلها بمبانيها في المباراة أيضاً، والجنود فوقها ويُعاد فوقهم ما أمامهم
// من مبانٍ (_layered في match_screen.dart). والقائمة الرئيسية تضع المدينة كلها فيها (بلا جنود)
class GroundCache {
  ui.Image? _img;
  ui.Rect _area = ui.Rect.zero;   // ما تغطيه الصورة بوحدات العالم
  double _z = 0, _px = 0, _lastZ = -1;   // تقريب الكاميرا حين رُسمت، ونقاط الصورة لكل وحدة
  Object? _key;
  int _still = 0, _frame = 0, _drawnAt = -1000;
  static int renders = 0;         // كم صورة أرض رُسمت (عدّاد الأداء)
  static bool enabled = true;     // للفحص: الرسم المباشر وحده (test/city_image_test.dart يقارن بينهما)
  static final _imgPaint = ui.Paint()..filterQuality = ui.FilterQuality.low;

  // يعرض الصورة ويعيد true، أو false فيرسم المستدعي الأرض مباشرة. view: الشاشة بوحدات العالم، z: تقريب الكاميرا، dpr: نقاط
  // الجهاز لكل نقطة شاشة، key: ما يغيّر محتواها، draw: ترسم ما فيها لمساحة بوحدات العالم (على لوحة بوحدات العالم)
  bool paint(ui.Canvas canvas, ui.Rect view, double z, double dpr, Object key, void Function(ui.Canvas c, ui.Rect area) draw) {
    if (!enabled) return false;
    _frame++;
    if (z != _lastZ) { _lastZ = z; _still = 0; } else { _still++; }
    var img = _img;
    if (img == null || key != _key || z != _z || !_area.contains(view.topLeft) || !_area.contains(view.bottomRight)) {
      if (_still < GROUND_CACHE.settle || _frame - _drawnAt < GROUND_CACHE.gap) return false;
      img = _render(view, z, dpr, key, draw);
    }
    // ركن الصورة على نقطة جهاز كاملة (إزاحة أقل من نقطة)، فتقع كل نقطة منها على نقطة من الشاشة فلا تغبش
    final m = canvas.getTransform(), sx = m[0] * dpr, sy = m[5] * dpr, tx = m[12] * dpr, ty = m[13] * dpr;
    final left = ((_area.left * sx + tx).roundToDouble() - tx) / sx, top = ((_area.top * sy + ty).roundToDouble() - ty) / sy;
    canvas.drawImageRect(img, ui.Rect.fromLTWH(0, 0, img.width.toDouble(), img.height.toDouble()),
        ui.Rect.fromLTWH(left, top, img.width / _px, img.height / _px), _imgPaint);
    return true;
  }

  ui.Image _render(ui.Rect view, double z, double dpr, Object key, void Function(ui.Canvas c, ui.Rect area) draw) {
    final g = GROUND_CACHE.margin;
    final area = ui.Rect.fromLTRB(view.left - view.width * g, view.top - view.height * g, view.right + view.width * g, view.bottom + view.height * g);
    var px = z * dpr;
    final w = area.width * px, h = area.height * px;
    px *= math.min(1.0, math.min(GROUND_CACHE.maxSide / math.max(w, h), math.sqrt(GROUND_CACHE.maxPixels / (w * h))));   // الجوالات القديمة: حد كرت الشاشة والذاكرة
    final rec = ui.PictureRecorder(), c = ui.Canvas(rec);
    c.scale(px);
    c.translate(-area.left, -area.top);
    draw(c, area);
    final pic = rec.endRecording(), img = pic.toImageSync((area.width * px).ceil(), (area.height * px).ceil());
    pic.dispose();
    _img?.dispose();
    _img = img;
    _area = area;
    _z = z;
    _px = px;
    _key = key;
    _drawnAt = _frame;
    renders++;
    return img;
  }

  void dispose() {
    _img?.dispose();
    _img = null;
  }
}
