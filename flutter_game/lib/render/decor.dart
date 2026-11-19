// زينة المدينة (ن2): منقولة من js/render/openCity.js وcityRender.js وchunkCache.js وfeatureArt.js وdetail.js
// وزينة طوابع المدن (roadProp وtile وwater). كلها حتمية من hsh وبذرة الخريطة، كما في اللعبة الحالية:
// - groundMarks: ما على الأرض (خطوط الشوارع والأرصفة وممرات المشاة ورصف الممرات وحلقة الدوار)، تحت كل شيء
// - tileDecor: ما يقوم فوق المربع (أعمدة وأشجار ونوافير وبسطات وحطام)، يُرسم مع صفه بترتيب العمق
import 'dart:math' as math;

import '../config.dart';
import '../core/fmath.dart' show hypot;
import '../data/cities.dart';
import '../map/generator.dart';
import 'city_art.dart';
import 'colors.dart';
import 'vec.dart';
import 'weather_art.dart' show Light;

const _tau = 6.2831853;

// نقطة على المربع بإحداثياته (a على i، b على j، من −0.5 إلى 0.5) حول مركزه
List<double> _at(double x, double y, double a, double b) => [x + (a - b) * 18, y + (a + b) * 9];

// معلم المنطقة في حديقة (2.4.0، بطلب المستخدم: "معالم المدن... يجب وضعهم في أماكن خاصة مثل الحدائق لأنها زينة ومعلم وليست
// مبنى"): مربع شجرة في وسط أقرب حديقة لوسط الخريطة، وفي هونغ كونغ وباريس وروتنبورغ جزيرة دوارها حين لا دوار (المعابد مكانه).
// رسم فقط: مكان المعلم القديم (placeMonument في المولّد) بيت من بيوت المدينة
final _monuments = Expando<int>();
int monumentTile(GameMap map) => _monuments[map] ??= () {
  final theme = CITY_THEMES[map.city];
  if (theme == null || (!theme.monument && map.type.contains(tY))) return -1;
  final parks = parksOf(map).map((id) => map.districts[id]).toList();
  final c = (map.n - 1) / 2;
  parks.sort((a, b) => (hypot(a.cx - c, a.cy - c)).compareTo(hypot(b.cx - c, b.cy - c)));
  return parks.isEmpty ? -1 : parkCenter(map, parks.first);
}();
bool isMonument(GameMap map, int k) => k >= 0 && k == monumentTile(map);

// المعلم ووسط كل حديقة (نافورة أو بئر): زينة لا تُصبغ بلون المالك
bool parkPiece(GameMap map, int k) {
  final id = map.districtAt[k];
  return isMonument(map, k) || (id >= 0 && parksOf(map).contains(id) && k == parkCenter(map, map.districts[id]));
}

// وسط الحديقة: مربع الشجرة الأقرب لمركزها (للمعلم أو النافورة أو البئر)
int parkCenter(GameMap map, District d) {
  var best = -1;
  var bestD = double.infinity;
  for (final (i, j) in d.tiles) {
    final k = map.idx(i, j), dist = hypot(i - d.cx, j - d.cy);
    if (map.type[k] == tH && dist < bestD) { bestD = dist; best = k; }
  }
  return best;
}

// الحدائق (2.3.2، بطلب المستخدم: "أشجار وأعمدة إنارة تنفع حديقة منتزه"): أحياء عادية تُرسم حدائق، شجرة مكان كل بيت وأرضها
// أخضر، وإنارتها ومقاعدها على ممراتها (decor.dart). رسم فقط: المربعات وأنواعها والاستيلاء كما هي. حي صغير أو متوسط بلا مبنى
// مميز ولا قاعدة ولا معلم، بعيد عن الحدائق الأخرى، واحدة لكل GROUND.parkEvery من ضلع الخريطة
final _parks = Expando<Set<int>>();
Set<int> parksOf(GameMap map) => _parks[map] ??= () {
  final n = map.n, out = <int>{};
  bool plain(District d) => d.capture != null && !d.temple && !d.merc && d.feature == null && d.special == null && !d.police &&
      !d.isHome && d.tiles.length >= 4 && d.tiles.length <= 16 && d.tiles.every((t) {
        final k = map.idx(t.$1, t.$2), ty = map.type[k];
        return ty == tH || ty == tR || ty == tDot || ty == tP;
      }) && d.tiles.where((t) => map.type[map.idx(t.$1, t.$2)] == tH).length >= 3;
  final cand = [for (final d in map.districts) if (plain(d)) d]
    ..sort((a, b) => hsh(a.id, 7, 650, map.seed).compareTo(hsh(b.id, 7, 650, map.seed)));
  for (final d in cand) {
    if (out.length >= math.max(1, n ~/ GROUND.parkEvery)) break;
    final c = d.capture!;
    if (out.any((o) { final e = map.districts[o].capture!; return (e.i - c.i).abs() + (e.j - c.j).abs() < n / 3; })) continue;
    out.add(d.id);
  }
  return out;
}();

// وسط الحديقة بئر في المدن العربية والأفريقية، ونافورة في غيرها
bool parkWell(GameMap map) {
  final r = REGIONS.order.firstWhere((r) => REGIONS.cities[r]!.contains(map.city), orElse: () => '');
  return r == 'arabic' || r == 'african';
}

// المدن الجافة: حديقتها نخيل على رمل أخضر قليلاً
bool aridCity(String city) {
  final r = REGIONS.order.firstWhere((r) => REGIONS.cities[r]!.contains(city), orElse: () => '');
  return r == 'arabic' || r == 'african' || city == 'tenoch' || city == 'mexico';
}

// الشارع (والدوار) والماء: أخفض من أرض الأحياء والرصيف (18.10أ)
bool lowGround(GameMap map, int k) => map.road[k] == 1 || map.type[k] == tY || map.type[k] == tWater;

class Decor {
  final GameMap map;
  final String city;
  final CityTheme theme;
  final OpenCity? open;
  final String region;
  // صور الزينة والأرضيات (GAME_SPEC 18.6): ما له صورة في أطلس المدينة يُضاف صورةً، ما على الأرض في شريحته (onMark)
  // وما يقوم فوق المربع في صفه (onItem)، وإلا رُسم بالكود كما كان
  final CityArt? art;
  void Function(Sprite s, double x, double y, int i, int j)? onMark, onItem;
  Decor(this.map, [this.art])
      : city = map.city,
        theme = CITY_THEMES[map.city]!,
        open = CITIES.open[map.city],
        region = REGIONS.order.firstWhere((r) => REGIONS.cities[r]!.contains(map.city), orElse: () => 'arabic');

  double h(int i, int j, int k) => hsh(i, j, k, map.seed);
  Sprite? _s(String group, String kind, [int variant = 1]) => art?.find(group, kind, variant);
  bool _put(void Function(Sprite, double, double, int, int)? to, String group, String kind, double x, double y, int i, int j, [int variant = 1]) {
    final s = to == null ? null : _s(group, kind, variant);
    if (s == null) return false;
    to!(s, x, y, i, j);
    return true;
  }
  bool _mark(String kind, double x, double y, int i, int j) => _put(onMark, 'mark', kind, x, y, i, j);
  bool _item(String kind, double x, double y, int i, int j, [int variant = 1]) => _put(onItem, 'decor', kind, x, y, i, j, variant);
  // نسخة بالتجزئة من نسخ صورة (القوارب وزينة الشارع)
  int _variant(String kind, int i, int j, int salt) => 1 + (h(i, j, salt) * (art?.count('decor', kind) ?? 1)).floor();
  final _probe = Vec();
  // إضاءة الليل الثابتة (collectStatics في chunkCache.js): برميل النار، وأعمدة الممرات، وأضواء الدوار
  final lights = <Light>[];
  bool _isLane(int k) => map.type[k] == tDot && (map.kind[k] == 'lane_i' || map.kind[k] == 'lane_j');
  // الأرض البارزة (18.10أ): الشارع والماء أخفض بـ drop، فما على أرضهما (خطوطه وحطامه وقواربه) يُرسم أخفض
  late final double drop = art?.relief ?? 0;
  double _dz(int k) => lowGround(map, k) ? drop : 0;
  // المربع أعلى من الشارع (أرض حي)، وما خلف حافة الخريطة الخلفية أيضاً فللشارع عندها رصيف
  bool upper(int i, int j) => !map.inBounds(i, j) || !lowGround(map, map.idx(i, j));   // خارج الخريطة أرض (هامشها)

  // --- الأرض: طبقة chunkCache.drawGround ---
  // at: الطبقة التي يُرسم فيها ما على المربع (i، j)، فتُقسم الأرض شرائح تُرسم الظاهرة منها وحدها
  void groundMarks(Vec Function(int i, int j) at) {
    for (var j = 0; j < map.n; j++) {
      for (var i = 0; i < map.n; i++) {
        final v = at(i, j);
        final k = map.idx(i, j), x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
        if (map.road[k] == 1) {
          _roadSurface(v, i, j, x, y + drop);
        } else if (_isLane(k)) {
          _lanePaving(v, i, j, x, y);
        } else if (map.kind[k] == 'fplaza' && _squareOf(k) == null) {
          if (_mark('fplaza', x, y, i, j)) continue;
          v.stroke([[x - 12, y], [x, y - 6], [x + 12, y], [x, y + 6], [x - 12, y]], 'rgba(255,226,150,0.32)', 0.6);
          v.ln(x - 6, y - 3, x + 6, y + 3, 'rgba(255,226,150,0.32)', 0.6);
          v.ln(x + 6, y - 3, x - 6, y + 3, 'rgba(255,226,150,0.32)', 0.6);
        } else if (isMonument(map, k)) {
          _monumentKerb(v, x, y);
        } else if (map.type[k] == tY && _roundaboutAnchor(i, j)) {
          if (!_mark('ring', x, y + drop, i, j)) v.ring(x, y + drop - 9, 38, 19, 'rgba(240,236,224,0.7)', 0.9, [4, 3]);
        }
      }
    }
    // المعابد والمرتزقة وما بقي من مبنى المدينة (3.14): رصفها وحافتها ومنصة مبناها
    for (var j = 0; j < map.n; j++) {
      for (var i = 0; i < map.n; i++) {
        final v = at(i, j);
        final k = map.idx(i, j), d = _squareOf(k);
        if (d != null) _squareGround(v, d, i, j, (i - j) * TILE_HALF_W, (i + j) * TILE_HALF_H);
      }
    }
    // خطوط منتصف الشوارع
    for (var j = 0; j < map.n; j++) {
      for (var i = 0; i < map.n; i++) {
        final v = at(i, j);
        final k = map.idx(i, j), d = map.dash[k], x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H + _dz(k);
        const c = '#c9bd85';
        if (d >= 1 && d <= 4 && _mark('dash$d', x, y, i, j)) continue;
        if (d == 1) v.ln(x - 4, y - 2, x + 4, y + 2, c, 1);
        if (d == 2) v.ln(x + 4, y - 2, x - 4, y + 2, c, 1);
        if (d == 3) v.ln(x - 13, y + 2.5, x - 5, y + 6.5, c, 1);
        if (d == 4) v.ln(x + 5, y + 6.5, x + 13, y + 2.5, c, 1);
      }
    }
  }

  void _roadSurface(Vec v, int i, int j, double x, double y) {
    if (open != null) {
      final dash = map.dash[map.idx(i, j)];
      if (dash == 6 || dash == 7) _zebra(v, i, j, dash == 6, x, y);
    }
    if (_s('ground', 'road') == null) _themeTile(v, i, j, x, y);   // نقش الشارع في صورته
    if (h(i, j, 201) < STREET.crack && !_mark('crack', x, y, i, j)) {
      v.stroke([[x - 8, y - 1], [x - 3, y + 1.5], [x + 1, y], [x + 6, y + 2.5]], 'rgba(20,16,12,0.35)', 0.5);
    }
  }

  // ممر المشاة (2.3.2، بطلب المستخدم: كانت خطوطه غير منتظمة): خمسة أشرطة لكل مربع على مسافات متساوية عبر الشارع كله،
  // فتتصل أشرطة مربعي الشارع العريض صفاً واحداً، ولا شريط على الرصيف
  void _zebra(Vec v, int i, int j, bool along, double x, double y) {
    final lo = along ? upper(i, j - 1) : upper(i - 1, j), hi = along ? upper(i, j + 1) : upper(i + 1, j);
    for (var k = 0; k < 5; k++) {
      if ((k == 0 && lo) || (k == 4 && hi)) continue;
      final w = -0.4 + k * 0.2;
      final s = along ? _at(x, y, -0.3, w) : _at(x, y, w, -0.3), e = along ? _at(x, y, 0.3, w) : _at(x, y, w, 0.3);
      v.ln(s[0], s[1], e[0], e[1], 'rgba(238,234,224,0.72)', 1.5);
    }
  }

  void _lanePaving(Vec v, int i, int j, double x, double y) {
    final alongI = map.kind[map.idx(i, j)] == 'lane_i';
    if (_mark(alongI ? 'lane_i' : 'lane_j', x, y, i, j)) return;
    List<double> p(double u, double w) => alongI ? _at(x, y, u, w) : _at(x, y, w, u);
    for (final u in const [-0.25, 0.25]) { final s = p(u, -0.42), e = p(u, 0.42); v.ln(s[0], s[1], e[0], e[1], 'rgba(0,0,0,0.13)', 0.5); }
    for (final w in const [-0.42, 0.42]) { final s = p(-0.5, w), e = p(0.5, w); v.ln(s[0], s[1], e[0], e[1], 'rgba(255,255,255,0.24)', 0.7); }
  }

  bool _roundaboutAnchor(int i, int j) {
    bool y(int a, int b) => map.inBounds(a, b) && map.type[map.idx(a, b)] == tY;
    return y(i, j) && y(i - 1, j) && y(i, j - 1) && !y(i + 1, j) && !y(i, j + 1);
  }

  // سطح الشارع بطابع المدينة (T.draw.tile)
  void _themeTile(Vec v, int i, int j, double x, double y) {
    switch (city) {
      case 'europe': case 'rothenburg': case 'paris':
        final a = city == 'paris' ? 0.08 : 0.09;
        for (var r = -2; r <= 2; r++) { v.ln(x - 14 + r.abs() * 3.5, y + r * 1.8, x + 14 - r.abs() * 3.5, y + r * 1.8, 'rgba(0,0,0,$a)', 0.5); }
      case 'rio':
        for (var r = -2; r <= 2; r++) {
          v.stroke([for (var k = 0; k <= 8; k++) [x - 13 + r.abs() * 3 + k * (26 - r.abs() * 6) / 8, y + r * 2 + math.sin(k * 1.2 + r) * 0.8]],
              'rgba(20,20,20,0.35)', 0.6);
        }
      case 'yamamah':
        final dir = map.dash[map.idx(i, j)];
        if (dir == 0) return;
        final s = dir == 1 ? 1 : -1;
        for (final o in const [-2.4, 2.4]) { v.ln(x - 11 * s, y - 5.5 + o, x + 11 * s, y + 5.5 + o, 'rgba(96,66,34,0.2)', 0.7); }
    }
  }

  // --- محتوى المربع: drawCityTile في cityRender.js ---
  void tileDecor(Vec v, int i, int j) {
    final k = map.idx(i, j), x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
    final plot = map.road[k] == 1 ? null : _squareOf(k);
    if (plot != null) _plotKerb(v, plot, i, j, x, y, back: true);
    _tileDecor(v, i, j, k, x, y);
    if (plot != null) _plotKerb(v, plot, i, j, x, y, back: false);
  }

  void _tileDecor(Vec v, int i, int j, int k, double x, double y) {
    final type = map.type[k];
    if (map.road[k] == 1) {
      if (map.dash[k] >= 5 || map.kind[k] != null) return;     // حلقة الدوار وممرات المشاة نظيفة، والبوابة صورة
      if (open?.roadProp != false) _roadProp(v, i, j, x, y);
      _streetDebris(v, x, y + drop, i, j);
      return;                                // أشجار الرصيف انتقلت إلى الحدائق (2.3.2)
    }
    if ((type == tDot || type == tH || type == tR) && parksOf(map).contains(map.districtAt[k])) { _parkDecor(v, i, j, x, y, k); return; }
    if (isMonument(map, k)) return;
    if (type == tDot) {
      if (map.kind[k] == 'fplaza') {
        _featurePlaza(v, i, j, x, y);
      } else if (_isLane(k)) {
        _laneDecor(v, i, j, x, y);
      } else if (h(i, j, 210) < 0.4) {
        _streetDebris(v, x, y, i, j, 99);
      } else if (map.districtAt[k] >= 0) {
        _detailGround(v, i, j, x, y);
      }
      return;
    }
    if (type == tY && _roundaboutAnchor(i, j)) {
      if (!_item('island', x, y, i, j)) _roundaboutIsland(v, x, y);
      final cy = y - 9;
      if (city == 'paris') {
        for (final an in const [-0.62, -2.52, 0.3, math.pi - 0.3]) {   // PARIS_LAMPS
          lights.add(Light(x + math.cos(an) * 22.5, cy + math.sin(an) * 11.2 - 13, 22, 0xffdc96, 0.45));
        }
        lights.add(Light(x, cy - 34, 16, 0xffd778, 0.3));
      } else if (city == 'rothenburg') {
        lights..add(Light(x - 13, cy - 19, 22, 0xffdc96, 0.45))..add(Light(x + 13, cy - 19, 22, 0xffdc96, 0.45))..add(Light(x, cy - 4, 26, 0xffcd8c, 0.25));
      } else {
        lights..add(Light(x, y - 39, 46, 0xff6ebe, 0.45))..add(Light(x, y - 12, 34, 0x78dcff, 0.3));
      }
    }
    if (type == tWater) _water(v, i, j, x, y + drop);
  }

  // حطام الشارع (streetDebris): سيارة محطمة أو برميل نار أو بقعة أو ركام أو أكياس رمل
  // salt: إزاحة بذرة المربع (أرض الحي غير الشارع)، والصورة في مكان المربع نفسه
  void _streetDebris(Vec v, double x, double y, int i, int tj, [int salt = 0]) {
    final j = tj + salt;
    final r = h(i, j, 20) / STREET.debris;
    if (r >= 0.07 && r < 0.12) lights.add(Light(x, y - 7, 34, 0xff963c, 0.65));   // برميل النار (debrisLight)
    if (r < 0.07) {
      // لا سيارات إلا في خمس مدن (STREET.cars)، وفي المدن العربية عربة خشبية من زينة اليمامة (2.4.0، بطلب المستخدم)
      if (!STREET.cars.contains(city)) { _put(onItem, 'prop', 'cart', x, y, i, tj); return; }
      if (_item('car', x, y, i, tj)) return;               // واليمامة عربة خشبية بصورتها
      if (city == 'yamamah') return;
      final car = theme.car ?? const ['#6b4f3a', '#85624a', '#57402f'];
      v.box(x, y + 2, 8, 4, 4, car[0], car[1], car[2]);
      v.box(x + 1, y - 2, 4, 2, 3, '#2f2c29', '#3d3936', '#34302c');
      v.alpha = 0.3; v.el(x + 2, y - 6, 4, 2.5, '#2a2724'); v.alpha = 1;
    } else if (r < 0.12) {
      if (_item('barrel', x, y, i, tj)) return;
      v.glow(x, y - 6, 14, 'rgba(255,150,60,0.38)');
      v.rc(x - 2.5, y - 5, 5, 6, '#4f4337');
      v.poly([[x - 3, y - 5], [x, y - 13], [x + 3, y - 5]], '#e8893a');
      v.poly([[x - 1.5, y - 5], [x, y - 9], [x + 1.5, y - 5]], '#f2c14e');
    } else if (r < 0.24) {
      if (_put(onMark, 'decor', 'oil', x, y, i, tj)) return;
      v.el(x + (h(i, j, 21) - 0.5) * 8, y + 1, 3.4, 1.5, 'rgba(28,24,20,0.45)');
    } else if (r < 0.3) {
      if (_item('rubble', x, y, i, tj)) return;
      v.poly([[x - 4, y + 2], [x, y - 1], [x + 5, y + 2], [x, y + 4]], theme.debris ?? '#8a8074');
      v.circ(x + 3, y, 0.9, '#5a524a');
    } else if (r < 0.33) {
      if (_item('sandbags', x, y, i, tj)) return;
      for (var k = 0; k < 3; k++) { v.el(x - 5 + k * 3.6, y + 1 - k * 1.8, 2.2, 1.3, '#9c8a62'); }
      for (var k = 0; k < 2; k++) { v.el(x - 3.2 + k * 3.6, y - 1.6 - k * 1.8, 2.2, 1.3, '#b09c72'); }
    }
  }

  // حصى المدن الجافة أو خصل العشب على أرض الحي (detailGround في detail.js)
  void _detailGround(Vec v, int i, int j, double x, double y) {
    var seq = 0;
    double rnd() => h(i, j, 700 + (seq++ % 97));
    final arid = region == 'arabic' || region == 'african' || city == 'tenoch' || city == 'mexico';
    // صورة الحصى أو العشب لنحو نصف المربعات (الصورة واحدة، فلا تتكرر في كل مربع)
    if (_s('mark', arid ? 'gravel' : 'grass') != null && onMark != null) {
      if (h(i, j, 711) < STREET.grass) _mark(arid ? 'gravel' : 'grass', x, y, i, j);
      return;
    }
    for (var k = 0; k < 4; k++) {
      final dx = (rnd() - 0.5) * 22, dy = (rnd() - 0.5) * 10;
      if (dx.abs() / 18 + dy.abs() / 9 > 0.8) continue;
      if (arid) {
        v.el(x + dx, y + dy, 1, 0.45, 'rgba(110,88,60,0.45)');
      } else {
        for (final a in const [-0.5, 0.0, 0.5]) { v.ln(x + dx, y + dy, x + dx + a * 1.4, y + dy - 1.6, 'rgba(70,120,50,0.55)', 0.45); }
      }
    }
  }

  // --- المدن المفتوحة: زينة الممرات والدوار (openCity.js) ---
  static void streetPalm(Vec v, double px, double py, int i, int j) {
    final o = ((i * 3 + j) % 3) - 1;
    v.el(px, py + 0.6, 3.6, 1.5, 'rgba(0,0,0,0.22)');
    v.quad(px, py, px + o * 2, py - 8, px + o * 1.3, py - 14.5, '#8a6a45', 1.3);
    final tx = px + o * 1.3, ty = py - 14.5;
    for (var k = 0; k < 7; k++) {
      final a = k * 0.9 + 0.2, dx = math.cos(a) * 6, dy = math.sin(a) * 2.3 + 1.3;
      v.poly([[tx, ty], [tx + dx, ty + dy], [tx + dx * 0.55, ty + dy - 1.1]], k % 2 == 1 ? '#5f8a3a' : '#4d7a30');
    }
  }

  static const _laneLocal = {'paris': 'terrace', 'europe': 'terrace', 'rothenburg': 'stall', 'shibam': 'souq', 'chicago': 'newsstand'};
  static const _lampGlow = {'hk': '#7fe8ff', 'chicago': '#f2d58a', 'europe': '#f2d58a'};

  void _laneDecor(Vec v, int i, int j, double x, double y) {
    final hv = h(i, j, 520) / STREET.lane;
    final kind = hv < 0.3 ? 'lamp' : hv < 0.5 ? 'planter' : hv < 0.6 ? 'bench' : hv < 0.72 ? _laneLocal[city] : null;
    if (kind == null) return;
    final side = h(i, j, 521) < 0.5 ? -0.3 : 0.3, u = (h(i, j, 522) - 0.5) * 0.5;
    final p = map.kind[map.idx(i, j)] == 'lane_i' ? _at(x, y, u, side) : _at(x, y, side, u);
    final px = p[0], py = p[1];
    if (kind == 'lamp') lights.add(Light(px, py - 15, 24, city == 'hk' ? 0x7fe8ff : 0xffdc96, 0.5));
    if (_item(const {'lamp', 'planter', 'bench'}.contains(kind) ? kind : 'local', px, py, i, j)) return;
    switch (kind) {
      case 'lamp':
        v.ln(px, py, px, py - 14, '#2b2825', 0.9);
        v.poly([[px - 1.7, py - 14], [px, py - 17.2], [px + 1.7, py - 14], [px, py - 13]], '#2b2825');
        v.rc(px - 0.9, py - 15.8, 1.8, 1.7, _lampGlow[city] ?? '#f2d58a');
      case 'planter':
        v.box(px, py, 3.2, 1.6, 2.2, '#6f6a62', '#8a837b', '#5c5750');
        v.circ(px, py - 4.4, 3, '#47753d'); v.circ(px - 1.1, py - 5.3, 1.8, '#5f9150'); v.circ(px + 1.3, py - 4.8, 1.2, '#d86a8a');
      case 'bench':
        v.box(px, py, 3.4, 1.7, 1.3, '#5e4634', '#76583f', '#8a6a4c');
        v.ln(px - 3.4, py - 3.6, px, py - 1.9, '#5e4634', 0.8);
      case 'terrace': _terraceTable(v, px, py, i, j);
      case 'souq': _souqStall(v, px, py, i, j);
      case 'newsstand': _newsstand(v, px, py, i, j);
      default: _marketStall(v, px, py, i, j);
    }
  }

  static const _souqGoods = ['#c8462e', '#e8b83a', '#6f8a3a', '#5a2e1a'];
  void _souqStall(Vec v, double px, double py, int i, int j) {
    final g = (h(i, j, 525) * _souqGoods.length).floor();
    v.el(px, py + 0.5, 4.2, 1.8, 'rgba(0,0,0,0.18)');
    v.box(px, py, 3.6, 1.8, 2, '#7a5a3a', '#8e6a46', '#a07a52');
    for (var k = 0; k < 3; k++) {
      final bx = px - 1.8 + k * 1.8, by = py - 2.1 + (k - 1) * 0.15;
      v.poly([[bx - 0.75, by], [bx, by - 1.2], [bx + 0.75, by]], _souqGoods[(g + k) % _souqGoods.length]);
    }
    v.ln(px - 3.4, py - 0.2, px - 3.4, py - 6.4, '#5a4030', 0.5);
    v.ln(px + 3.4, py - 0.2, px + 3.4, py - 6.4, '#5a4030', 0.5);
    v.poly([[px - 4.2, py - 6.6], [px + 4.2, py - 6.6], [px + 3.4, py - 8.2], [px - 3.4, py - 8.2]], '#d6c08a');
    for (final o in const [-1.8, 0.0, 1.8]) { v.ln(px + o - 0.4, py - 6.6, px + o * 0.8, py - 8.2, '#a8322a', 0.6); }
  }

  static const _mags = ['#c8322a', '#e8c23a', '#2f6aa8', '#f2ede0'];
  void _newsstand(Vec v, double px, double py, int i, int j) {
    v.el(px, py + 0.5, 3.8, 1.7, 'rgba(0,0,0,0.18)');
    v.box(px, py, 3.2, 1.6, 5.2, '#2f4a3a', '#3a5a46', '#2a3a30');
    for (var k = 0; k < 4; k++) {
      v.rc(px + 0.4 + k * 0.65, py - 3.8 + 1.6 - k * 0.33, 0.5, 1.5, _mags[(k + (h(i, j, 526) * 4).floor()) % 4]);
    }
    v.poly([[px - 3.8, py - 5.2], [px, py - 7.3], [px + 3.8, py - 5.2], [px, py - 3.1]], '#26382e');
    v.rc(px - 2.4, py - 8.6, 4.8, 1.3, '#f2ede0');
    v.ln(px - 1.6, py - 8, px + 1.6, py - 8, '#2a2a2e', 0.4);
  }

  void _terraceTable(Vec v, double px, double py, int i, int j) {
    final c = h(i, j, 523) < 0.5 ? const ['#a3302a', '#efe6d2'] : const ['#2f5a46', '#efe6d2'];
    v.el(px, py + 0.5, 3.6, 1.6, 'rgba(0,0,0,0.18)');
    for (final s in const [-1, 1]) {
      v.ln(px + s * 2.6, py + 0.4, px + s * 2.6, py - 1.4, '#6a4a2a', 0.5);
      v.el(px + s * 2.6, py - 1.5, 1, 0.5, '#a8743a');
      v.ln(px + s * 3.2, py - 1.4, px + s * 3.2, py - 3.2, '#a8743a', 0.6);
    }
    v.ln(px, py, px, py - 2.4, '#2b2825', 0.5);
    v.el(px, py - 2.6, 1.8, 0.85, '#3a3a3e');
    v.ln(px, py - 2.6, px, py - 8.4, '#5a4a3a', 0.5);
    for (var k = 0; k < 6; k++) {
      final a0 = k / 6 * _tau, a1 = (k + 1) / 6 * _tau;
      v.poly([[px, py - 10.4], [px + math.cos(a0) * 4.4, py - 8.2 + math.sin(a0) * 2.1],
        [px + math.cos(a1) * 4.4, py - 8.2 + math.sin(a1) * 2.1]], c[k % 2]);
    }
  }

  static const _stallGoods = ['#d9463b', '#e8a33a', '#6fa04a', '#c86a9a'];
  void _marketStall(Vec v, double px, double py, int i, int j) {
    final g = (h(i, j, 524) * _stallGoods.length).floor();
    v.el(px, py + 0.5, 4.2, 1.8, 'rgba(0,0,0,0.18)');
    v.box(px, py, 3.6, 1.8, 2.4, '#7a5a3a', '#8e6a46', '#a07a52');
    for (var k = 0; k < 3; k++) { v.circ(px - 1.8 + k * 1.8, py - 2.9 + (k - 1) * 0.15, 0.6, _stallGoods[(g + k) % _stallGoods.length]); }
    v.ln(px - 3.4, py - 0.2, px - 3.4, py - 6.6, '#5a4030', 0.5);
    v.ln(px + 3.4, py - 0.2, px + 3.4, py - 6.6, '#5a4030', 0.5);
    for (var k = 0; k < 4; k++) {
      final u0 = -3.9 + k * 1.95, u1 = u0 + 1.95;
      v.poly([[px + u0, py - 6.9], [px + u1, py - 6.9], [px + u1, py - 5.3], [px + u0, py - 5.3]], k % 2 == 1 ? '#f2ede0' : '#c8322a');
    }
    v.poly([[px - 3.9, py - 6.9], [px + 3.9, py - 6.9], [px + 3.1, py - 8.4], [px - 3.1, py - 8.4]], '#a82a24');
  }

  void _roundaboutIsland(Vec v, double x, double y) {
    if (city == 'paris') { _parisIsland(v, x, y - 9); return; }
    if (city == 'rothenburg') { _rothenburgIsland(v, x, y - 9); return; }
    final cx = x, cy = y - 9;
    v.el(cx, cy + 1.4, 25.5, 12.8, '#7e7a74');
    v.el(cx, cy, 25.5, 12.8, '#bdb8af');
    v.el(cx, cy - 0.2, 22.8, 11.3, '#3d6b46');
    v.el(cx, cy - 0.5, 18.5, 9.1, '#4c8052');
    const flowers = ['#ff7eb6', '#ffd23f', '#f4efe4', '#ff9f5a'];
    for (var k = 0; k < 14; k++) {
      final an = k / 14 * math.pi * 2;
      v.circ(cx + math.cos(an) * 20.5, cy + math.sin(an) * 10.1, 1.1, flowers[k % 4]);
    }
    v.el(cx, cy + 1, 9.5, 4.7, '#8e8a84');
    v.el(cx, cy, 9.5, 4.7, '#d2cdc3');
    v.el(cx, cy - 0.2, 8, 3.9, '#3f7fa8');
    v.el(cx - 2.4, cy - 1, 3, 1.1, 'rgba(255,255,255,0.35)');
    v.box(cx, cy, 3.6, 1.8, 3, '#55565c', '#6a6b71', '#7a7b81');
    v.box(cx, cy - 3, 2.2, 1.1, 24, '#34353b', '#44454c', '#56575e');
    v.ln(cx - 2.2, cy - 3, cx - 2.2, cy - 27, '#ff4fa3', 0.7);
    v.ln(cx + 2.2, cy - 3, cx + 2.2, cy - 27, '#3fe0ff', 0.7);
    v.ln(cx, cy - 1.9, cx, cy - 25.9, 'rgba(255,255,255,0.35)', 0.5);
    v.glow(cx, cy - 30, 9, 'rgba(255,120,200,0.45)');
    v.circ(cx, cy - 30, 2.4, '#ff8fd0');
    v.circ(cx - 0.7, cy - 30.7, 0.9, '#ffffff');
    v.alpha = 0.55;
    for (final dx in const [-5.0, 5.0]) { v.quad(cx + dx * 0.25, cy - 4, cx + dx * 0.8, cy - 9, cx + dx, cy - 1, '#bfe6ff', 0.7); }
    v.alpha = 1;
  }

  static void _fountain(Vec v, double cx, double cy, double r) {
    v.el(cx, cy + 1, r, r * 0.5, '#8e8a84');
    v.el(cx, cy, r, r * 0.5, '#d2cdc3');
    v.el(cx, cy - 0.2, r * 0.82, r * 0.4, '#3f7fa8');
    v.el(cx - r * 0.3, cy - 0.7, r * 0.3, r * 0.11, 'rgba(255,255,255,0.35)');
    v.box(cx, cy, 0.9, 0.45, 5, '#9a958c', '#b4afa6');
    v.el(cx, cy - 5, 2.4, 1.1, '#bdb8af');
    v.el(cx, cy - 5.2, 1.8, 0.75, '#5f9cc4');
    v.alpha = 0.55;
    for (final s in const [-1, 1]) { v.quad(cx + s * 1.6, cy - 5.4, cx + s * 3.6, cy - 7, cx + s * r * 0.62, cy - 0.6, '#bfe6ff', 0.7); }
    v.ln(cx, cy - 5.2, cx, cy - 8.4, '#bfe6ff', 0.7);
    v.alpha = 1;
  }

  static void _islandLamp(Vec v, double px, double py, String col) {
    v.ln(px, py, px, py - 12, '#2b2825', 0.9);
    v.poly([[px - 1.6, py - 12], [px, py - 15], [px + 1.6, py - 12], [px, py - 11.2]], '#2b2825');
    v.rc(px - 0.8, py - 13.6, 1.6, 1.5, col);
  }

  static const _parisLamps = [-0.62, -2.52, 0.3, math.pi - 0.3];
  void _parisIsland(Vec v, double cx, double cy) {
    v.el(cx, cy + 1.4, 25.5, 12.8, '#7e7a74');
    v.el(cx, cy, 25.5, 12.8, '#cfc6b4');
    v.ring(cx, cy, 19, 9.5, 'rgba(0,0,0,0.12)', 0.6);
    v.ring(cx, cy, 11, 5.5, 'rgba(0,0,0,0.12)', 0.6);
    List<double> lampAt(double an) => [cx + math.cos(an) * 22.5, cy + math.sin(an) * 11.2];
    for (final an in _parisLamps) { if (math.sin(an) < 0) { final p = lampAt(an); _islandLamp(v, p[0], p[1], '#f2d58a'); } }
    _fountain(v, cx - 13, cy + 0.5, 6.2);
    _fountain(v, cx + 13, cy + 0.5, 6.2);
    v.box(cx, cy, 3.4, 1.7, 2.2, '#8a8478', '#a29c90', '#b4aea2');
    v.box(cx, cy - 2.2, 2.4, 1.2, 3.6, '#9a8e80', '#b0a494', '#c2b6a6');
    final y0 = cy - 5.8;
    const hh = 26.0, w0 = 1.9, d0 = 0.95, w1 = 1.1, d1 = 0.55;
    v.poly([[cx - w0, y0], [cx, y0 + d0], [cx, y0 + d1 - hh], [cx - w1, y0 - hh]], '#b08a78');
    v.poly([[cx, y0 + d0], [cx + w0, y0], [cx + w1, y0 - hh], [cx, y0 + d1 - hh]], '#c9a690');
    for (var k = 0; k < 5; k++) {
      final t = 0.15 + k * 0.16, yy = y0 - hh * t, ww = w0 + (w1 - w0) * t;
      v.ln(cx + ww * 0.35, yy - 0.2, cx + ww * 0.7, yy - 0.5, 'rgba(70,40,30,0.45)', 0.4);
      v.ln(cx - ww * 0.65, yy - 0.5, cx - ww * 0.3, yy - 0.2, 'rgba(60,35,25,0.4)', 0.4);
    }
    final top = y0 - hh, apex = top - 3.6;
    v.poly([[cx - w1, top], [cx, top + d1], [cx, apex]], '#c9a040');
    v.poly([[cx, top + d1], [cx + w1, top], [cx, apex]], '#f0cf6a');
    for (final an in _parisLamps) { if (math.sin(an) >= 0) { final p = lampAt(an); _islandLamp(v, p[0], p[1], '#f2d58a'); } }
  }

  static const _rothBeds = [0.42, math.pi - 0.42, -0.5, -math.pi + 0.5];
  void _rothenburgIsland(Vec v, double cx, double cy) {
    v.el(cx, cy + 1.4, 25.5, 12.8, '#6f6a62');
    v.el(cx, cy, 25.5, 12.8, '#a19b8e');
    for (final r in const [21.5, 16.5, 12.5]) { v.ring(cx, cy, r, r * 0.5, 'rgba(0,0,0,0.16)', 0.6, [1.4, 1.2]); }
    void bed(double an) {
      final bx = cx + math.cos(an) * 19.5, by = cy + math.sin(an) * 9.6;
      v.el(bx, by + 0.6, 4.2, 2, '#6a5a48');
      v.el(bx, by, 4.2, 2, '#4a6e3a');
      for (var k = 0; k < 5; k++) { v.circ(bx - 2.6 + k * 1.3, by - 0.4 + (k % 2) * 0.7, 0.7, k % 2 == 1 ? '#e85a7a' : '#c8322a'); }
    }
    for (final an in _rothBeds) { if (math.sin(an) < 0) bed(an); }
    _islandLamp(v, cx - 13, cy - 6, '#f2d58a');
    _islandLamp(v, cx + 13, cy - 6, '#f2d58a');
    List<List<double>> oct(double r, double dy) => [for (var k = 0; k < 8; k++)
      [cx + math.cos((k + 0.5) / 8 * _tau) * r, cy + dy + math.sin((k + 0.5) / 8 * _tau) * r * 0.5]];
    v.poly(oct(11, 2.2), '#7a7062');
    v.poly(oct(11, 0), '#bfb39a');
    v.poly(oct(9.4, -0.1), '#3f7fa8');
    v.el(cx - 3.6, cy - 1.4, 2.6, 0.9, 'rgba(255,255,255,0.3)');
    v.box(cx, cy, 2, 1, 2.4, '#9a8a70', '#b4a486', '#c4b598');
    v.box(cx, cy - 2.4, 1.1, 0.55, 11, '#a8987c', '#c0b194');
    v.box(cx, cy - 13.4, 1.9, 0.95, 1.2, '#9a8a70', '#b4a486', '#c4b598');
    final sy = cy - 14.6;
    v.rc(cx - 0.9, sy - 5, 1.8, 5, '#5f6e76');
    v.circ(cx, sy - 5.8, 0.95, '#6f7e86');
    v.el(cx - 1.3, sy - 3, 0.8, 1.3, '#c8322a');
    v.ln(cx + 1.3, sy, cx + 1.3, sy - 8.4, '#3a3a3e', 0.45);
    v.alpha = 0.55;
    for (final s in const [-1, 1]) { v.quad(cx + s * 0.9, cy - 9, cx + s * 4, cy - 10, cx + s * 6, cy - 0.8, '#bfe6ff', 0.7); }
    v.alpha = 1;
    for (final an in _rothBeds) { if (math.sin(an) >= 0) bed(an); }
  }

  // --- زينة أركان ساحة المبنى المميز (drawFeaturePlaza في featureArt.js) ---
  // --- أحياء المعابد ومباني المرتزقة المربعة (3.14) ---
  // الحي المربع للمعبد أو المرتزقة أو ما بقي من مبنى المدينة، بمبناه الكبير، أو null
  District? _squareOf(int k) {
    final id = map.districtAt[k];
    if (id < 0 || map.road[k] != 0) return null;
    final d = map.districts[id];
    return d.featureBig && d.featureTile != null && (d.temple || d.merc || _boxes.containsKey(id)) ? d : null;
  }
  // حدود كل حي مربع (i0، j0، i1، j1): ما بقي من مبنى المدينة القديم مربع أيضاً إن كانت حدوده مستطيلاً ممتلئاً
  late final Map<int, (int, int, int, int)> _boxes = () {
    final out = <int, (int, int, int, int)>{};
    final temples = map.districts.any((d) => d.temple);
    for (final d in map.districts) {
      if (!d.featureBig || d.tiles.isEmpty || !temples) continue;
      var i0 = 1 << 30, j0 = 1 << 30, i1 = -1, j1 = -1;
      for (final (i, j) in d.tiles) { i0 = math.min(i0, i); j0 = math.min(j0, j); i1 = math.max(i1, i); j1 = math.max(j1, j); }
      if ((i1 - i0 + 1) * (j1 - j0 + 1) == d.tiles.length) out[d.id] = (i0, j0, i1, j1);
    }
    return out;
  }();

  // الرصف بطابع الحي. وحافته رصيف الأرض البارزة وظل المبنى عند قاعدته (18.10أ) بدل الحافة والمنصة الداكنة وبقع الأرض
  void _squareGround(Vec v, District d, int i, int j, double x, double y) {
    final k = map.idx(i, j);
    if (map.kind[k] != 'fplaza' && map.type[k] != tP) return;
    if (d.temple) {
      if ((i + j) % 2 == 0) v.poly([[x - 9, y], [x, y - 4.5], [x + 9, y], [x, y + 4.5]], 'rgba(255,236,170,0.22)');
      v.stroke([[x - 18, y], [x, y - 9], [x + 18, y], [x, y + 9], [x - 18, y]], 'rgba(120,88,40,0.28)', 0.6);
    } else if (!d.merc) {
      v.stroke([[x - 12, y], [x, y - 6], [x + 12, y], [x, y + 6], [x - 12, y]], 'rgba(255,226,150,0.32)', 0.6);
    }
  }

  // حافة الساحة (2.4.0، بطلب المستخدم: "حسّن حدودها وجمّلها"): سور منخفض حول حي المعبد والمرتزقة وما بقي من مبنى المدينة،
  // بمدخل في وسط كل ضلع وأعمدة في الأركان وعلى جانبي المدخل. حجر فاتح للمعبد، وخشب داكن للمرتزقة، وحجر رملي لغيرهما.
  // الضلعان الخلفيان قبل زينة المربع (back) والأماميان بعدها، فيغطي الأمامي ما خلفه
  static const _kerbT = 0.09, _kerbH = 2.2, _postH = 4.4;
  void _plotKerb(Vec v, District d, int i, int j, double x, double y, {required bool back}) {
    final b = _boxes[d.id] ?? _bbox(d);
    final (top, face, side, cap) = d.temple ? ('#e2d5b8', '#b9a888', '#9c8c6e', '#f0d68a')
        : d.merc ? ('#7d5c3c', '#5c4229', '#4a3420', '#c8963c') : ('#d6c09a', '#ad9670', '#927c58', '#e8cf8a');
    List<double> p(double a, double c, [double up = 0]) { final q = _at(x, y, a, c); return [q[0], q[1] - up]; }
    // المقطع على الضلع (من u0 إلى u1 بإحداثي المربع) بلا المدخل: وسط الضلع بعرض مربع
    List<(double, double)> runs(int pos, int len) {
      final g0 = len / 2 - 0.5 - pos - 0.5, g1 = g0 + 1;
      final out = <(double, double)>[];
      if (g0 > -0.5) out.add((-0.5, math.min(0.5, g0)));
      if (g1 < 0.5) out.add((math.max(-0.5, g1), 0.5));
      return [for (final r in out) if (r.$2 - r.$1 > 0.01) r];
    }
    void post(double a, double c) {
      final q = _at(x, y, a, c);
      v.box(q[0], q[1], 1.5, 0.75, _postH, side, face, top);
      v.box(q[0], q[1] - _postH, 1.8, 0.9, 0.8, side, face, cap);
    }
    bool out(int a, int c) => !map.inBounds(a, c) || map.districtAt[map.idx(a, c)] != d.id;
    // (المحور على i؟، جهة الضلع ±0.5، موضع المربع على الضلع وطوله، والضلع خارج الحي)
    final edges = [(true, -0.5, j - b.$2, b.$4 - b.$2 + 1, out(i - 1, j)), (false, -0.5, i - b.$1, b.$3 - b.$1 + 1, out(i, j - 1)),
                   (true, 0.5, j - b.$2, b.$4 - b.$2 + 1, out(i + 1, j)), (false, 0.5, i - b.$1, b.$3 - b.$1 + 1, out(i, j + 1))];
    for (final (alongJ, e, pos, len, isOut) in edges) {
      if (!isOut || (e < 0) != back) continue;
      final inner = e > 0 ? e - _kerbT : e + _kerbT;
      List<double> at(double n, double u, [double up = 0]) => alongJ ? p(n, u, up) : p(u, n, up);
      for (final (u0, u1) in runs(pos, len)) {
        // وجه السور الظاهر: الخارجي للضلعين الأماميين والداخلي للخلفيين، ثم سطحه
        final f = e > 0 ? e : inner;
        v.poly([at(f, u0, _kerbH), at(f, u1, _kerbH), at(f, u1), at(f, u0)], e > 0 ? face : side);
        v.poly([at(e, u0, _kerbH), at(e, u1, _kerbH), at(inner, u1, _kerbH), at(inner, u0, _kerbH)], top);
        for (final u in [u0, u1]) {
          final corner = (u == -0.5 && pos == 0) || (u == 0.5 && pos == len - 1), gate = u > -0.5 && u < 0.5;
          if (corner || gate) { final m = (e + inner) / 2; alongJ ? post(m, u) : post(u, m); }
        }
      }
    }
  }

  // زينة الأركان: فوانيس حجرية للمعبد، ومشاعل وصناديق ورايات للمرتزقة
  void _squareCorner(Vec v, District d, int i, int j, double x, double y) {
    final b = _boxes[d.id] ?? _bbox(d);
    final corner = (i == b.$1 || i == b.$3) && (j == b.$2 || j == b.$4);
    if (!corner) return;
    if (d.temple) {
      v.box(x, y, 2.4, 1.2, 3, '#8f8676', '#b3a994', '#c8bfa9');
      v.box(x, y - 3, 1.2, 0.6, 7, '#9a917f', '#bdb39e');
      v.box(x, y - 10, 2.6, 1.3, 3.2, '#7d756a', '#a39a87', '#ffe39a');
      v.poly([[x - 3.4, y - 13.2], [x, y - 16.6], [x + 3.4, y - 13.2], [x, y - 11.6]], '#6b6358');
      lights.add(Light(x, y - 11, 26, 0xffd98a, 0.5));
    } else if (d.merc) {
      if ((i + j) % 2 == 0) {
        _brazier(v, x, y);
        lights.add(Light(x, y - 9, 28, 0xff963c, 0.55));
      } else {
        v.box(x - 2, y + 1, 2.6, 1.3, 3.6, '#6e4f30', '#8a6640', '#9c7449');
        v.box(x + 2.2, y, 2, 1, 2.8, '#5f432a', '#7a5838', '#8c6844');
        v.ln(x + 0.6, y - 1, x + 0.6, y - 17, '#3a2a1c', 0.9);
        v.poly([[x + 0.6, y - 16.5], [x + 6.4, y - 15], [x + 6.4, y - 10.4], [x + 0.6, y - 11.9]], '#8e2f24');
        v.ln(x + 0.6, y - 14.2, x + 6.4, y - 12.7, '#e8c56a', 0.5);
      }
    } else {
      _brazier(v, x, y);
      lights.add(Light(x, y - 9, 24, 0xff963c, 0.45));
    }
  }

  (int, int, int, int) _bbox(District d) {
    var i0 = 1 << 30, j0 = 1 << 30, i1 = -1, j1 = -1;
    for (final (i, j) in d.tiles) { i0 = math.min(i0, i); j0 = math.min(j0, j); i1 = math.max(i1, i); j1 = math.max(j1, j); }
    return (i0, j0, i1, j1);
  }

  void _featurePlaza(Vec v, int i, int j, double x, double y) {
    final sq = _squareOf(map.idx(i, j));
    if (sq != null) { _squareCorner(v, sq, i, j, x, y); return; }
    final d = map.districtOf(i, j);
    if (d == null || !d.featureBig || d.featureTile == null) return;
    final i0 = d.featureTile! % map.n - 1, j0 = d.featureTile! ~/ map.n - 1;
    if (!((i == i0 - 1 || i == i0 + 2) && (j == j0 - 1 || j == j0 + 2))) return;
    if (_item('corner_${d.feature}', x, y, i, j)) return;
    _plazaProp(v, d.feature!, x, y, i, j);
  }

  void _brazier(Vec v, double x, double y) {
    v.box(x, y, 2.6, 1.3, 5, '#5a4632', '#6e563d', '#7a6045');
    v.poly([[x - 2.6, y - 5], [x, y - 13], [x + 2.6, y - 5]], '#ff8a2a');
    v.poly([[x - 1.3, y - 5.4], [x, y - 10], [x + 1.3, y - 5.4]], '#ffe08a');
  }

  void _plazaProp(Vec v, String f, double x, double y, int i, int j) {
    switch (f) {
      case 'pyramid':
        v.box(x, y, 2.4, 1.2, 20, '#b0905c', '#d4b47a');
        v.poly([[x - 2.4, y - 20], [x, y - 25], [x, y - 20 + 1.2]], '#c99a2c');
        v.poly([[x, y - 20 + 1.2], [x, y - 25], [x + 2.4, y - 20]], '#f6d362');
      case 'dojo': case 'observatory': case 'powder':
        v.box(x, y, 2.6, 1.3, 2, '#7d786f', '#9a948a', '#aaa49a');
        v.box(x, y - 2, 1.1, 0.55, 6, '#8a857b', '#a29c92');
        v.box(x, y - 8, 2.8, 1.4, 3, '#8a857b', '#a29c92', '#f2d58a');
        v.poly([[x - 3.6, y - 11], [x, y - 14.5], [x + 3.6, y - 11], [x, y - 9.2]], '#6f6a62');
      case 'clinic':
        v.ln(x, y, x, y - 16, '#3a2a20', 0.9);
        v.ln(x, y - 16, x + 4, y - 16, '#3a2a20', 0.7);
        v.el(x + 4, y - 12.4, 2.2, 2.8, '#d8402e');
        v.ln(x + 2.4, y - 12.4, x + 5.6, y - 12.4, '#f2c14e', 0.5);
      case 'fortress': case 'khartoum': case 'kanoGate': case 'hunters':
        _brazier(v, x, y);
      case 'policeHQ':
        v.ln(x, y, x, y - 16, '#2a2d33', 1);
        v.ln(x, y - 16, x + 3.4, y - 16, '#2a2d33', 0.8);
        v.poly([[x + 1.8, y - 14.6], [x + 5, y - 14.6], [x + 4.4, y - 10.6], [x + 2.4, y - 10.6]], '#2a2d33');
        v.poly([[x + 2.5, y - 14], [x + 4.3, y - 14], [x + 3.9, y - 11.2], [x + 2.9, y - 11.2]], '#f4dc8a');
      case 'clock': case 'bank': case 'arch':
        v.box(x, y, 1.4, 0.7, 2, '#1e2126', '#2c3036', '#24282d');
        v.ln(x, y - 2, x, y - 17, '#1e2126', 1);
        v.ln(x - 2.2, y - 15, x + 2.2, y - 15, '#1e2126', 0.6);
        v.circ(x, y - 18.6, 2.2, '#fff4d0');
        v.poly([[x - 1.8, y - 20.4], [x + 1.8, y - 20.4], [x, y - 22]], '#1e2126');
      case 'complex':
        v.ln(x, y, x, y - 14, '#3a2a1c', 0.9);
        final t = y - 14;
        v.poly([[x, t + 2], [x - 3.6, t - 3], [x - 1.4, t - 4.6]], '#2fa8a0');
        v.poly([[x, t + 2], [x - 1, t - 5.4], [x + 1, t - 5.4]], '#3f9b4a');
        v.poly([[x, t + 2], [x + 1.4, t - 4.6], [x + 3.6, t - 3]], '#c8392f');
      case 'statue': case 'salwa': case 'khan':
        streetPalm(v, x, y, i, j);
      case 'triads':
        v.ln(x, y, x, y - 15, '#2a2a2e', 0.9);
        v.box(x + 1.6, y - 12, 2.2, 1.1, 5, '#1c1220', '#24182a', '#1c1220');
        v.ln(x + 0.6, y - 13.5, x + 0.6, y - 17.5, '#ff4fb4', 0.8);
        v.ln(x + 2.6, y - 13, x + 2.6, y - 16.5, '#4fe3ff', 0.8);
      case 'stable':
        const r = 2.6;
        for (final dx in const [-r * 0.7, r * 0.7]) { v.ln(x + dx, y, x + dx, y - r * 1.6, '#f4e3e6', 0.7); }
        v.box(x, y - r * 1.6, r, r / 2, 0.8, '#e8c9cf', '#f4e3e6', '#f0d9dc');
        v.dome(x, y - r * 1.6 - 0.8, r * 0.9, '#f0d9dc', '#d8b6bb', '#d4af4f');
      case 'cathedral':
        v.ln(x - 3, y, x - 3, y - 11, '#5a3a22', 0.9);
        v.ln(x + 3, y, x + 3, y - 11, '#5a3a22', 0.9);
        v.ln(x - 4, y - 11, x + 4, y - 11, '#5a3a22', 1.1);
        v.poly([[x - 2.2, y - 5], [x - 1.4, y - 9.6], [x + 1.4, y - 9.6], [x + 2.2, y - 5]], '#d9a93a');
        v.circ(x, y - 4.8, 0.7, '#8a6a1c');
      case 'mine':
        for (final (px, py, r, c) in const [(-1.5, 0.0, 1.8, '#b8bcc2'), (1.2, 0.6, 1.4, '#d9dde2'), (0.0, -1.4, 1.3, '#eef1f4')]) {
          v.circ(x + px, y + py, r, c);
        }
        v.ln(x + 2, y - 1, x + 5, y - 8, '#6b4a2e', 0.8);
        v.ln(x + 3, y - 8.6, x + 7, y - 7, '#5c5650', 1);
      case 'souk':
        v.ln(x - 3, y, x - 3, y - 9, '#5a3a22', 0.7);
        v.ln(x + 3, y + 1.5, x + 3, y - 7.5, '#5a3a22', 0.7);
        v.box(x, y + 0.5, 3.2, 1.6, 3, '#7a5432', '#94683f', '#a87a4a');
        const goods = ['#c0392b', '#e1a12a', '#7a4a2a'];
        for (var n = 0; n < 3; n++) { v.circ(x - 1.8 + n * 1.8, y - 3.4 + (n % 2) * 0.6, 1.1, goods[n]); }
        v.poly([[x - 4, y - 9], [x + 4, y - 7], [x + 4, y - 9.6], [x - 4, y - 11.6]], '#b8382c');
        v.poly([[x - 1.3, y - 8.35], [x + 1.3, y - 7.7], [x + 1.3, y - 10.3], [x - 1.3, y - 10.95]], '#f1e6cf');
      case 'mercs':
        const cols = ['#c8392f', '#e8c23a', '#2f6db3', '#3f9b5a'];
        for (var k = 0; k < 4; k++) { v.ln(x, y - k * 4, x, y - k * 4 - 4, cols[k], 1.3); }
        v.ln(x, y - 16, x + 2.6, y - 16, '#1e1e22', 0.7);
        v.el(x + 2.6, y - 13.8, 1.4, 1.9, '#f4dc8a');
    }
  }

  // --- زينة الشوارع بطابع كل مدينة (T.draw.roadProp) ---
  static const _neon = ['#ff4fa3', '#3fe0ff', '#ffd23f', '#7cff6b', '#ff7a3f', '#b07cff'];

  void _lamp(Vec v, double x, double y, {bool hood = true}) {
    v.ln(x, y + 2, x, y - 15, '#1e1e22', 1);
    if (hood) v.poly([[x - 1.6, y - 15], [x, y - 18], [x + 1.6, y - 15], [x, y - 14]], '#1e1e22');
    v.rc(x - 1, y - 16.4, 2, 1.6, '#f2d58a');
  }

  // زينة شارع المدينة: صورتها حيث كان الكود يرسمها (يُجرَّب رسمها في مسودة لمعرفة ذلك)
  // ما يقوم على عمود (إنارة ومشاعل وأعلام) يقف على الرصيف الخلفي للمربع لا وسط الشارع (18.10أ)، والزينة المعلّقة
  // فوق الشارع وما على أرضه في مكانه أخفض مع الشارع
  static const _posts = {'europe', 'rothenburg', 'cairo', 'kaifeng', 'gyeongju', 'paris', 'birmingham', 'laboca', 'diriyah', 'meroe', 'rio', 'tenoch'};
  void _roadProp(Vec v, int i, int j, double x, double y) {
    if (STREET.noHang.contains(city)) return;
    if (onItem != null && _s('decor', 'hang_i') != null) { _hang(i, j, x, y); return; }
    if (_posts.contains(city) && onItem != null && _s('decor', 'roadprop') != null) { _post(i, j, x, y); return; }
    if (onItem != null && _s('decor', 'roadprop') != null) {
      _probe.clear();
      _roadPropCode(_probe, i, j, x, y);
      if (_probe.isEmpty) return;
      _item('roadprop', x, y + drop, i, j, _variant('roadprop', i, j, 431));
      return;
    }
    _roadPropCode(v, i, j, x, y + drop);
  }

  // عمود الإنارة (أو المشعل) على الرصيف الخلفي كل ثلاثة مربعات من الشارع في صف مستقيم، لا عند التقاطع (2.3.2: كان
  // موزعاً بالتجزئة). وفي باريس عمود الإنارة وحده: مدخل المترو في الحدائق
  void _post(int i, int j, double x, double y) {
    final a = upper(i - 1, j), b = upper(i, j - 1), w = 0.5 - 0.5 / GROUND.sub;
    final at = a && !b && j % 3 == 0 ? _at(x, y, -w, 0) : b && !a && i % 3 == 0 ? _at(x, y, 0, -w) : null;
    if (at == null) return;
    final n = city == 'paris' ? 2 : 1, s = _s('decor', 'roadprop', n);
    if (s == null) return;
    // قاعدة العمود أسفل وسط الصورة: تُنقل الصورة فتقف قاعدته على الرصيف
    final px = art!.px;
    _item('roadprop', at[0] - (s.w / 2 - s.ax) / px, at[1] - (s.h - s.ay) / px + 0.4, i, j, n);
  }

  // الزينة المعلّقة بين عمودين (2.4.0، بطلب المستخدم: كانت مواجهة للشاشة وسط الشارع فتبدو مشوهة): على الرصيف الخلفي بطول
  // الشارع، بنسختها المائلة مع اتجاهه (hang_i وhang_j في pack_atlases.py)، كل أربعة مربعات حيث يستقيم الرصيف تحت عموديها
  void _hang(int i, int j, double x, double y) {
    final a = upper(i - 1, j), b = upper(i, j - 1), w = 0.5 - 0.5 / GROUND.sub;
    bool road(int p, int q) => map.inBounds(p, q) && map.road[map.idx(p, q)] == 1 && map.dash[map.idx(p, q)] < 5;
    if (a && !b && j % 4 == 1 && road(i, j - 1) && road(i, j + 1) && upper(i - 1, j - 1) && upper(i - 1, j + 1)) {
      final p = _at(x, y, -w, 0);
      _item('hang_j', p[0], p[1], i, j);
    } else if (b && !a && i % 4 == 1 && road(i - 1, j) && road(i + 1, j) && upper(i - 1, j - 1) && upper(i + 1, j - 1)) {
      final p = _at(x, y, 0, -w);
      _item('hang_i', p[0], p[1], i, j);
    }
  }

  // الحديقة: ممراتها مرصوفة بإنارة ومقاعد بالتناوب، ومدخل المترو في ممرها الأمامي بباريس، وتحت أشجارها شجيرات
  final _entrance = <int, int>{};
  void _parkDecor(Vec v, int i, int j, double x, double y, int k) {
    final id = map.districtAt[k], type = map.type[k];
    if (k == parkCenter(map, map.districts[id])) {
      if (!isMonument(map, k) && (!parkWell(map) || _s('prop', 'well') == null)) {
        _fountain(v, x, y, 11);
        lights.add(Light(x, y - 8, 26, 0xbfe6ff, 0.3));
      }
      return;
    }
    if (type != tDot) {
      final p = _at(x, y, 0.3, -0.25);
      if (h(i, j, 660) < 0.4) _item('planter', p[0], p[1], i, j);
      return;
    }
    final front = _entrance[id] ??= () {
      var best = -1;
      for (final (a, b) in map.districts[id].tiles) {
        final q = map.idx(a, b);
        if (map.type[q] == tDot && (best < 0 || a + b > best % map.n + best ~/ map.n)) best = q;
      }
      return best;
    }();
    if (city == 'paris' && k == front && _item('roadprop', x, y, i, j, 1)) return;
    if ((i + j) % 2 == 0) {
      final p = _at(x, y, -0.32, -0.32);
      if (_item('lamp', p[0], p[1], i, j)) lights.add(Light(p[0], p[1] - 15, 24, 0xffdc96, 0.5));
    } else if (h(i, j, 661) < 0.6) {
      final p = _at(x, y, 0.2, -0.3);
      _item('bench', p[0], p[1], i, j);
    }
  }

  // حافة المعلم (2.3.2، بطلب المستخدم: "منطقة لحالها بحدود بسيطة"): إطار حجري منخفض حول مربعه بلون ساحة المدينة،
  // وأرضه مرصوفة (city_layer.dart) خارج حدود الحي ولا تُصبغ
  void _monumentKerb(Vec v, double x, double y) {
    final plaza = hex(art?.colors['plaza'] ?? '#b8ae9c');
    String css6(int c) => '#${(c & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
    final top = css6(mix(plaza, 0xffffff, 0.35)), face = css6(mix(plaza, 0x000000, 0.35)), hgt = 1.4;
    const cx = [0.0, 1.0, 0.0, -1.0], cy = [-1.0, 0.0, 1.0, 0.0];   // أعلى ويمين وأسفل ويسار
    List<double> p(double r, int c, [double up = 0]) => [x + cx[c] * TILE_HALF_W * r, y + cy[c] * TILE_HALF_H * r - up];
    const r1 = 0.84, r2 = 0.97;
    for (var c = 0; c < 4; c++) {
      final d = (c + 1) % 4;
      v.poly([p(r1, c, hgt), p(r1, d, hgt), p(r2, d, hgt), p(r2, c, hgt)], top);
    }
    for (final c in const [1, 2]) {                       // الوجهان الأماميان: من اليمين إلى الأسفل ومنه إلى اليسار
      final d = (c + 1) % 4;
      v.poly([p(r2, c, hgt), p(r2, d, hgt), p(r2, d), p(r2, c)], face);
    }
  }

  void _roadPropCode(Vec v, int i, int j, double x, double y) {
    switch (city) {
      case 'europe': case 'rothenburg':
        if ((i * 7 + j * 5) % 7 == 0) {
          v.ln(x + 10, y + 2, x + 10, y - 15, '#2b2825', 1);
          v.poly([[x + 8.4, y - 15], [x + 10, y - 18.5], [x + 11.6, y - 15], [x + 10, y - 14]], '#2b2825');
          v.rc(x + 9, y - 16.6, 2, 1.8, '#f2d58a');
        }
      case 'hk':
        if (h(i, j, 430) < STREET.neon) {
          final c = css(_neon[(h(i, j, 431) * 6).floor()]);
          v.el(x + (h(i, j, 432) - 0.5) * 10, y + 1, 6, 2.4, 'rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},0.28)');
        }
      case 'jaipur':
        if ((i * 5 + j * 3) % 7 == 0) {
          v.ln(x - 14, y - 17, x - 14, y + 1, '#5a4a3a', 0.8);
          v.ln(x + 14, y - 17, x + 14, y + 1, '#5a4a3a', 0.8);
          for (var k = 0; k < 14; k++) {
            final t = (k + 0.5) / 14;
            v.circ(x - 14 + 28 * t, y - 16 + math.sin(math.pi * t) * 5, 1.1, k % 2 == 1 ? '#f0a020' : '#e86a1a');
          }
        }
      case 'mexico':
        if ((i * 5 + j * 3) % 7 == 0) {
          const p = ['#e3708c', '#3fb5a8', '#f0b84a', '#9fcf6a', '#6a8fd8'];
          v.ln(x - 14, y - 17, x - 14, y + 1, '#5a4a3a', 0.8);
          v.ln(x + 14, y - 17, x + 14, y + 1, '#5a4a3a', 0.8);
          v.quad(x - 14, y - 16, x, y - 11, x + 14, y - 16, '#4a3a32', 0.4);
          for (var k = 0; k < 8; k++) {
            final t = (k + 0.5) / 8, px = x - 14 + 28 * t, py = y - 16 + math.sin(math.pi * t) * 5 * 0.5 * 2;
            v.poly([[px - 1.4, py], [px + 1.4, py], [px + 1.4, py + 2.6], [px, py + 3.6], [px - 1.4, py + 2.6]], p[k % 5]);
          }
        }
      case 'chicago':
        if ((i + j) % 2 == 0) v.ln(x - 4, y - 2, x + 4, y + 2, 'rgba(230,210,140,0.55)', 0.8);
      case 'shibam':
        if (h(i, j, 710) < 0.12) v.ln(x - 14, y - 26, x + 14, y - 38, 'rgba(70,50,30,0.6)', 0.4);
      case 'diriyah':
        if (h(i, j, 730) < 0.15) { v.ln(x + 9, y + 2, x + 9, y - 13, '#5a4632', 1); v.el(x + 9, y - 14, 1.6, 2, '#e8b24a'); }
      case 'cairo':
        if ((i * 5 + j * 3) % 7 == 0) {
          v.ln(x + 9, y + 2, x + 9, y - 15, '#2b2825', 1);
          v.poly([[x + 7.6, y - 15], [x + 9, y - 19], [x + 10.4, y - 15], [x + 9, y - 14]], '#3a3028');
          v.rc(x + 8.2, y - 17.2, 1.6, 2, '#f2c86a');
        }
      case 'kaifeng':
        if ((i * 5 + j * 7) % 7 == 0) { v.ln(x + 9, y + 2, x + 9, y - 12, '#4a3a32', 0.9); v.el(x + 9, y - 11, 1.9, 2.4, '#d33a2c'); }
      case 'gyeongju':
        if ((i * 7 + j * 3) % 8 == 0) {
          v.box(x + 9, y + 2, 1.4, 0.7, 7, '#9a948a', '#b0aaa0', '#c0bab0');
          v.poly([[x + 6.6, y - 5], [x + 9, y - 7], [x + 11.4, y - 5], [x + 9, y - 3.6]], '#7a756c');
          v.rc(x + 8.4, y - 4.6, 1.2, 1, '#f2d58a');
        }
      case 'paris':
        if ((i * 7 + j * 5) % 9 == 0) {                 // مدخل مترو بطراز آرت نوفو
          for (final (dx, dy) in const [(-5.0, 1.0), (5.0, -2.5)]) {
            v.quad(x + dx, y + dy, x + dx - 1, y + dy - 8, x + dx + 1.4, y + dy - 12, '#3f6a4a', 1.1);
            v.el(x + dx + 1.6, y + dy - 12.6, 1, 1.4, '#f0a040');
          }
          v.quad(x - 5, y - 9, x, y - 13, x + 5, y - 12.5, '#3f6a4a', 0.9);
        } else if ((i * 5 + j * 3) % 7 == 0) {
          v.ln(x + 10, y + 2, x + 10, y - 15, '#1e1e22', 1);
          v.poly([[x + 8.4, y - 15], [x + 10, y - 18.5], [x + 11.6, y - 15], [x + 10, y - 14]], '#1e1e22');
          v.rc(x + 9, y - 16.6, 2, 1.8, '#f2d58a');
        }
      case 'birmingham':
        if ((i * 5 + j * 3) % 7 == 0) _lamp(v, x + 10, y);
      case 'laboca':
        if ((i * 5 + j * 3) % 7 == 0) _lamp(v, x + 10, y, hood: false);
      case 'gondar':
        if (h(i, j, 1010) < 0.12) { v.el(x + 6, y + 1, 3, 1.4, '#7a6a5c'); v.el(x + 6, y - 0.4, 2.2, 1, '#8a7a6c'); }
      case 'kano':
        if ((i * 5 + j * 3) % 8 == 0) {
          const cs = ['#24325e', '#c8322a', '#e8c23a', '#3a4e8e', '#2e8b57', '#efe9dc'];
          v.ln(x - 14, y - 15, x + 14, y - 15, '#5a4a3a', 0.4);
          for (var k = 0; k < 6; k++) {
            final px = x - 12 + k * 4.6;
            v.poly([[px, y - 15], [px + 3, y - 15], [px + 3, y - 10], [px, y - 10.6]], cs[k]);
          }
        }
      case 'meroe':
        if (h(i, j, 1040) < 0.1) { v.ln(x + 8, y + 2, x + 8, y - 10, '#6a4a2a', 0.8); v.el(x + 8, y - 11, 2.4, 1, '#e8b23a'); }
      case 'rio':
        if ((i * 7 + j * 5) % 8 == 0) { v.ln(x + 10, y + 2, x + 10, y - 14, '#1e1e22', 0.9); v.rc(x + 9, y - 15.6, 2, 1.6, '#f2d58a'); }
      case 'tenoch':
        if ((i * 7 + j * 3) % 9 == 0) {
          v.ln(x + 9, y + 2, x + 9, y - 10, '#6a5a3a', 0.9);
          v.poly([[x + 9, y - 10], [x + 14, y - 12], [x + 9, y - 7]], '#b8322c');
        }
    }
  }

  // --- الماء على حافة الخريطة بطابع كل مدينة (T.draw.water) ---
  void _water(Vec v, int i, int j, double x, double y) {
    const waves = {'norway': 0.18, 'kaifeng': 0.2, 'birmingham': 0.14, 'meroe': 0.2, 'laboca': 0.12, 'tenoch': 0.2};
    final a = waves[city];
    if (a == null) return;
    // الماء صورة بموجه (فلا خطوط موج)، والقارب أو ما يطفو صورته حيث كان يُرسم
    if (_s('ground', 'water') == null || onItem == null) {
      for (var k = 0; k < 3; k++) { v.ln(x - 8 + k * 5, y - 2 + k * 1.5, x - 3 + k * 5, y - 0.5 + k * 1.5, 'rgba(255,255,255,$a)', 0.6); }
    }
    if (onItem != null && _s('decor', 'boat') != null) {
      // قوارب أقل في أماكن متفرقة لا صفوفاً (2.4.0، بطلب المستخدم): بنسبة STREET.boats ومزاحة داخل مربعها
      if (h(i, j, 333) >= STREET.boats) return;
      _probe.clear();
      _afloat(_probe, i, j, x, y);
      final p = _at(x, y, (h(i, j, 334) - 0.5) * 0.5, (h(i, j, 335) - 0.5) * 0.5);
      if (!_probe.isEmpty) _item('boat', p[0], p[1], i, j, _boatVariant(i, j));
      return;
    }
    _afloat(v, i, j, x, y);
  }

  // صورة ما يطفو بشكله في الرسم: النرويجية جليد (1) وقارب شراعي (2) وطوف (3)، وحيث صورتان فالأولى تموجات الماء
  // والقارب الثانية (كايفنغ ومروي وتينوتشتيتلان)
  int _boatVariant(int i, int j) {
    if (city == 'norway') { final r = h(i, j, 320); return r < 0.3 ? 3 : r < 0.55 ? 2 : 1; }
    return art?.count('decor', 'boat') ?? 1;
  }

  void _afloat(Vec v, int i, int j, double x, double y) {
    switch (city) {
      case 'norway':
        final r = h(i, j, 320);
        if (r < 0.3) {
          v.poly([[x - 8, y + 1], [x + 2, y - 4], [x + 6, y - 2], [x - 4, y + 3]], '#6a5040');
          for (var k = 0; k < 4; k++) { v.ln(x - 7 + k * 3.2, y + 0.6 - k * 1.5, x - 3.6 + k * 3.2, y + 2.4 - k * 1.5, '#4a3828', 0.4); }
        } else if (r < 0.55) {
          v.poly([[x - 6, y], [x + 5, y - 4], [x + 7, y - 3], [x + 6, y - 1.6], [x - 4, y + 2.2]], '#e8e2d6');
          v.poly([[x - 4, y + 2.2], [x + 6, y - 1.6], [x + 5.4, y - 0.6], [x - 3.6, y + 3]], '#8a3a2a');
          v.ln(x + 1, y - 2, x + 1, y - 12, '#4a3a2e', 0.7);
          v.poly([[x + 1.3, y - 11.5], [x + 5, y - 5], [x + 1.3, y - 4.4]], '#efe8da');
        } else if (r < 0.7) {
          v.poly([[x - 4, y + 1], [x, y - 1.4], [x + 4.5, y], [x + 1, y + 2]], '#e8eef2');
        }
      case 'kaifeng':
        if (h(i, j, 810) < 0.35) {
          v.poly([[x - 7, y + 1], [x + 5, y - 5], [x + 7, y - 4], [x - 5, y + 2.4]], '#7a5a3a');
          v.poly([[x - 3, y - 0.6], [x + 2, y - 3], [x + 2, y - 6], [x - 3, y - 3.6]], '#c9a86a');
        }
      case 'birmingham':
        if (h(i, j, 930) < 0.5) {
          const cl = [['#2f5a3a', '#c9302a'], ['#7a1f2a', '#e0b23a'], ['#2a3e6a', '#d9d4c8']];
          final c = cl[(h(i, j, 931) * 3).floor()];
          v.poly([[x - 12, y + 4], [x + 8, y - 6], [x + 11, y - 4.6], [x - 9, y + 5.4]], c[0]);
          v.poly([[x - 10, y + 2.4], [x + 5, y - 5], [x + 5, y - 7.6], [x - 10, y - 0.2]], c[1]);
          v.poly([[x - 10, y - 0.2], [x + 5, y - 7.6], [x + 6.4, y - 7], [x - 8.6, y + 0.4]], '#2a2a2e');
        }
      case 'meroe':
        if (h(i, j, 1030) < 0.4) {
          v.poly([[x - 7, y + 1], [x + 6, y - 4], [x + 7, y - 2.6], [x - 5, y + 2.6]], '#7a5a3a');
          v.ln(x, y - 1.4, x, y - 16, '#4a3a2e', 0.7);
          v.poly([[x + 0.4, y - 15.4], [x + 7, y - 3.6], [x + 0.4, y - 2.4]], '#f2efe6');
        }
      case 'laboca':
        if (h(i, j, 1210) < 0.45) {
          v.poly([[x - 12, y + 3], [x + 8, y - 7], [x + 12, y - 5], [x - 8, y + 5.2]], '#5a3a2a');
          v.poly([[x - 12, y + 3], [x + 8, y - 7], [x + 8, y - 9], [x - 12, y + 1]], '#8a4a32');
          v.rc(x - 2, y - 6, 4, 3, '#c8c2b4');
        }
      case 'tenoch':
        if (h(i, j, 1310) < 0.4) {
          v.poly([[x - 8, y + 1], [x + 6, y - 5], [x + 8, y - 4], [x - 6, y + 2.4]], '#7a5a3a');
          v.ln(x + 2, y - 3, x + 8, y - 12, '#5a4a32', 0.6);
        }
    }
  }
}
