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

// أرض الحي المميز وحي الشرطة وحي الميزة تميل لألوانها قبل الاستيلاء (REGION_HINT في cityRender.js)
final _regionHint = <String, (int, double)>{
  'police': (hex('#6f7b8a'), 0.35),
  'special': (hex('#bba565'), 0.22),
  'feature': (hex(CITY_FEATURES.ground.$1), CITY_FEATURES.ground.$2),
};
const _featureSmall = 0.55;   // المبنى المميز في حي ضيق (مربع واحد): الرسم نفسه مصغّراً (SMALL في featureArt.js)

int groundColor(GameMap map, CityArt art, int i, int j) {
  final k = map.idx(i, j), type = map.type[k], c = art.colors;
  if (type == tWater) return hex(c['water'] ?? '#34566e');
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

class CityLayer {
  final ui.Vertices ground;
  final Float32List xf, rects;   // لكل صورة: التحويل (scos, ssin, tx, ty) ومستطيلها في الأطلس
  final int count;
  CityLayer._(this.ground, this.xf, this.rects, this.count);

  factory CityLayer(GameMap map, CityArt art) {
    final n = map.n;
    final pos = Float32List(n * n * 12), col = Int32List(n * n * 6);
    final items = <(int, int, Sprite, double, double, double)>[];
    for (var j = 0; j < n; j++) {
      for (var i = 0; i < n; i++) {
        final k = map.idx(i, j);
        final x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
        pos.setAll(k * 12, [x, y - TILE_HALF_H, x + TILE_HALF_W, y, x, y + TILE_HALF_H,
                            x, y - TILE_HALF_H, x, y + TILE_HALF_H, x - TILE_HALF_W, y]);
        col.fillRange(k * 6, k * 6 + 6, groundColor(map, art, i, j).toSigned(32));
        final s = tileSprite(map, art, i, j);
        if (s != null) items.add((i + j, i, s.$1, x, y + s.$3, s.$2));
      }
    }
    items.sort((a, b) => a.$1 != b.$1 ? a.$1 - b.$1 : a.$2 - b.$2);
    final xf = Float32List(items.length * 4), rects = Float32List(items.length * 4);
    for (var m = 0; m < items.length; m++) {
      final (_, _, s, x, y, scale) = items[m];
      final unit = scale / art.px, o = m * 4;
      xf[o] = unit; xf[o + 1] = 0; xf[o + 2] = x - unit * s.ax; xf[o + 3] = y - unit * s.ay;
      rects[o] = s.x; rects[o + 1] = s.y; rects[o + 2] = s.x + s.w; rects[o + 3] = s.y + s.h;
    }
    return CityLayer._(ui.Vertices.raw(ui.VertexMode.triangles, pos, colors: col), xf, rects, items.length);
  }

  static final _groundPaint = ui.Paint();
  static final _atlasPaint = ui.Paint()..filterQuality = ui.FilterQuality.medium;   // بمستويات التصغير

  void paint(ui.Canvas canvas, ui.Image atlas) {
    canvas.drawVertices(ground, ui.BlendMode.dst, _groundPaint);
    canvas.drawRawAtlas(atlas, xf, rects, null, null, null, _atlasPaint);
  }

  void dispose() => ground.dispose();
}
