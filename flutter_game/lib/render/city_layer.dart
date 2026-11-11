// طبقة المدينة الثابتة: تُبنى مرة لكل خريطة، ثم يرسمها كرت الشاشة بأمرين في كل إطار بلا عمل على المعالج:
// الأرض شبكة مثلثات واحدة بلون كل مربع (groundColor في js/render/cityRender.js)، والمباني والأشجار والمعالم
// من أطلس المدينة مرتبة بالعمق (i + j) كما يرسمها cityRender.js وlandmarks.js
import 'dart:typed_data';
import 'dart:ui' as ui;

import '../config.dart';
import '../data/cities.dart';
import '../map/generator.dart';
import '../map/sizes.dart';
import 'city_art.dart';
import 'colors.dart';
import 'decor.dart';
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

// صورة المربع ومقياسها وإزاحتها، أو null (الأرض والشوارع وساحات العلم: زينتها في ن2)
(Sprite, double, double)? tileSprite(GameMap map, CityArt art, int i, int j) {
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
  if (type == tQ) {
    final s = art.economy('hq', district == null ? 'medium' : sizeOf(district));
    return s == null ? null : (s, 1, 0);
  }
  if (type == tN) {
    final s = art.economy('police', 'medium');
    return s == null ? null : (s, 1, 0);
  }
  if (type == 0x54 || type == 0x4D) {                              // برج الرماية والمستشفى (BUILDING_TILE في empire.js)
    final s = art.economy(type == 0x54 ? 'tower' : 'hospital', district == null ? 'medium' : sizeOf(district));
    return s == null ? null : (s, 1, 0);
  }
  if (type == tF && district?.feature != null) {
    final s = art.find('feature', district!.feature!);
    if (s == null) return null;
    // الكتلة 2×2 من مربعها الأمامي، والحي الضيق: الرسم نفسه مصغّراً بلا إزاحة الكتلة
    return district.featureBig ? (s, 1, 0) : (s, _featureSmall, TILE_HALF_H * _featureSmall);
  }
  return null;
}

// أول نوع مبنى في pool المدينة له صورة: للمربعات المردومة بلا نوع (firstBuilding في cityRender.js)
String? _firstBuilding(String city, CityArt art) {
  for (final (kind, _) in CITY_THEMES[city]!.pool) {
    if (kind != null && kind != '.' && kind != 'ruin' && art.has(kind)) return kind;
  }
  return null;
}

// الطبقة صفوف بالعمق (d = i + j): لكل صف زينته القائمة (شبكة مثلثات) ثم صوره (من الأطلس)، فيقف عمود الإنارة
// أمام المبنى الذي خلفه ووراء الذي أمامه، كما يرسم cityRender.js كل مربع بزينته بترتيبه. والصف خارج الشاشة لا يُرسل
class CityLayer {
  ui.Vertices ground;
  final ui.Vertices? marks;          // خطوط الشوارع والأرصفة وممرات المشاة ورصف الممرات وحلقة الدوار
  final List<ui.Vertices?> rows;     // زينة كل صف
  final Int32List rowStart;          // أول صورة لكل صف في xf وrects (والأخير = العدد)
  final Float32List xf, rects;       // لكل صورة: التحويل (scos, ssin, tx, ty) ومستطيلها في الأطلس
  // صبغ المالك (القسم 8): لون أرض كل مربع قبل الصبغ وحيّه، وحي كل صورة ولونها (أبيض بلا صبغ)
  final Float32List _pos;
  final Int32List _baseCol, _col, _tileDistrict, _spriteDistrict, spriteCol;
  final _applied = <int, (String?, double)>{};
  bool tinted = false;
  final List<Light> lights;          // إضاءة الليل الثابتة (weather_art.dart)
  final Map<int, int> _tileItem;     // المربع ← رقم صورته (لتبديل صورة مربع واحد بلا بناء الطبقة كلها)
  final Map<int, Sprite> _tileSprite;
  CityLayer._(this.ground, this.marks, this.rows, this.rowStart, this.xf, this.rects, this._pos, this._baseCol, this._col,
      this._tileDistrict, this._spriteDistrict, this.spriteCol, this.lights, this._tileItem, this._tileSprite);

  // ما يرتفع فوق قاعدته (CITY_CACHE.reach.up) وما ينزل تحتها
  static const _up = 120.0, _down = 20.0;

  factory CityLayer(GameMap map, CityArt art, [String weather = 'day']) {
    final n = map.n, depths = 2 * n - 1;
    final pos = Float32List(n * n * 12), col = Int32List(n * n * 6), base = Int32List(n * n), tileD = Int32List(n * n);
    final items = <(int, int, Sprite, double, double, double, int, int)>[];
    final decor = Decor(map), markVec = Vec(), rowVecs = List.generate(depths, (_) => Vec());
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
        final s = tileSprite(map, art, i, j);
        if (s != null) items.add((i + j, i, s.$1, x, y + s.$3, s.$2, map.road[k] == 1 ? -1 : map.districtAt[k], k));
        decor.tileDecor(rowVecs[i + j], i, j);
      }
    }
    items.sort((a, b) => a.$1 != b.$1 ? a.$1 - b.$1 : a.$2 - b.$2);
    final xf = Float32List(items.length * 4), rects = Float32List(items.length * 4), rowStart = Int32List(depths + 1);
    final spriteD = Int32List(items.length), spriteCol = Int32List(items.length)..fillRange(0, items.length, -1);
    final tileItem = <int, int>{}, tileImg = <int, Sprite>{};
    var d = 0;
    for (var m = 0; m < items.length; m++) {
      final (depth, _, s, x, y, scale, did, k) = items[m];
      spriteD[m] = did;
      tileItem[k] = m;
      tileImg[k] = s;
      while (d <= depth) { rowStart[d++] = m; }
      final unit = scale / art.px, o = m * 4;
      xf[o] = unit; xf[o + 1] = 0; xf[o + 2] = x - unit * s.ax; xf[o + 3] = y - unit * s.ay;
      rects[o] = s.x; rects[o + 1] = s.y; rects[o + 2] = s.x + s.w; rects[o + 3] = s.y + s.h;
    }
    while (d <= depths) { rowStart[d++] = items.length; }
    return CityLayer._(ui.Vertices.raw(ui.VertexMode.triangles, pos, colors: col), markVec.build(),
        [for (final v in rowVecs) v.build()], rowStart, xf, rects, pos, base, col, tileD, spriteD, spriteCol, mapLights(map, decor.lights),
        tileItem, tileImg);
  }

  // مبنى جديد في الحي (القاعدة والبرج والمستشفى): تتبدل صورة مربعه وحده في مكانها. يعيد false إن لم يكن له مكان
  // (مربع بلا صورة قبلها أو بعدها)، فتُبنى الطبقة كلها
  bool refreshTiles(GameMap map, CityArt art, Iterable<int> tiles) {
    for (final k in tiles) {
      final now = tileSprite(map, art, k % map.n, k ~/ map.n), m = _tileItem[k];
      if (now == null && m == null) continue;
      if (now == null || m == null) return false;
      if (identical(_tileSprite[k], now.$1)) continue;
      final s = now.$1, unit = now.$2 / art.px, o = m * 4;
      final x = (k % map.n - k ~/ map.n) * TILE_HALF_W, y = (k % map.n + k ~/ map.n) * TILE_HALF_H + now.$3;
      xf[o] = unit; xf[o + 1] = 0; xf[o + 2] = x - unit * s.ax; xf[o + 3] = y - unit * s.ay;
      rects[o] = s.x; rects[o + 1] = s.y; rects[o + 2] = s.x + s.w; rects[o + 3] = s.y + s.h;
      _tileSprite[k] = s;
    }
    return true;
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
        spriteCol[m] = owner == null || a <= 0 ? -1 : oklabTint(0xFFFFFFFF, hex(owner), a * spriteAlpha, chroma).toSigned(32);
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
