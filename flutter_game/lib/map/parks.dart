// الحدائق ووسطها والمعلم ومربع البناء: للرسم (decor.dart وcity_layer.dart) وللمنطق (empire.dart: البناء، ولا سور في الحدائق)
// كلها من الخريطة وبذرتها وحدها، فتتطابق بين أجهزة اللعب المحلي
import 'dart:math' as math;

import '../config.dart';
import '../core/fmath.dart' show hypot;
import '../data/cities.dart';
import '../render/colors.dart' show hsh;   // fsin: حتمية بين الأجهزة
import 'generator.dart';

// أنواع ثابتة لا يُبنى مكانها (سور اليمامة وقلعتها والمعلم القديم)
const fixedKinds = {'wallI', 'wallJ', 'gateI', 'gateJ', 'archI', 'archJ', 'wallTower', 'brokenI', 'brokenJ', 'brokenTower', 'monument',
  'fortI', 'fortJ', 'fortTower'};

// مربع مبنى الاقتصاد (القاعدة والبرج والمستشفى): المبنى أو الأطلال الأقرب لمركز الحي
int buildSpot(GameMap map, District district) {
  var best = -1;
  var bestD = double.infinity;
  for (final (i, j) in district.tiles) {
    final k = map.idx(i, j), type = map.type[k];
    if ((type != tH && type != tR) || fixedKinds.contains(map.kind[k])) continue;
    final d = hypot(i - district.cx, j - district.cy);
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}

// الحدائق (2.3.2، بطلب المستخدم: "أشجار وأعمدة إنارة تنفع حديقة منتزه"): أحياء عادية تُرسم حدائق، شجرة مكان كل بيت وأرضها
// أخضر، وإنارتها ومقاعدها على ممراتها (decor.dart). حي بلا مبنى مميز ولا قاعدة، بعيد عن الحدائق الأخرى، واحدة لكل
// GROUND.parkEvery من ضلع الخريطة. وحديقة واحدة على الأقل في كل خريطة لمعلمها ونافورتها (2.4.1، بطلب المستخدم: "بعض المدن تم
// إزالة نافورتها... عن طريق صنع حديقة لها"): إن لم يكن حي صغير أو متوسط فأكبر منه
final _parks = Expando<Set<int>>();
Set<int> parksOf(GameMap map) => _parks[map] ??= () {
  final n = map.n, out = <int>{};
  bool plain(District d, int most) => d.capture != null && !d.temple && !d.merc && d.feature == null && d.special == null && !d.police &&
      !d.isHome && d.tiles.length >= 4 && d.tiles.length <= most && d.tiles.every((t) {
        final ty = map.type[map.idx(t.$1, t.$2)];
        return ty == tH || ty == tR || ty == tDot || ty == tP;
      }) && d.tiles.where((t) => map.type[map.idx(t.$1, t.$2)] == tH).length >= 3;
  List<District> cand(int most) => [for (final d in map.districts) if (plain(d, most)) d]
    ..sort((a, b) => hsh(a.id, 7, 650, map.seed).compareTo(hsh(b.id, 7, 650, map.seed)));
  final list = cand(16);
  for (final d in list.isEmpty ? cand(36) : list) {
    if (out.length >= math.max(1, n ~/ GROUND.parkEvery)) break;
    final c = d.capture!;
    if (out.any((o) { final e = map.districts[o].capture!; return (e.i - c.i).abs() + (e.j - c.j).abs() < n / 3; })) continue;
    out.add(d.id);
  }
  return out;
}();

// وسط الحديقة (للمعلم أو النافورة أو البئر): مربع الشجرة الأقرب لمركزها، إلا مربع البناء (2.4.1: كان المربع نفسه، فصار برج
// الحديقة في هونغ كونغ نافورة ترمي السهام)
int parkCenter(GameMap map, District d) {
  final build = d.buildTile ?? buildSpot(map, d);
  var best = -1;
  var bestD = double.infinity;
  for (final (i, j) in d.tiles) {
    final k = map.idx(i, j), dist = hypot(i - d.cx, j - d.cy);
    if (map.type[k] == tH && k != build && dist < bestD) { bestD = dist; best = k; }
  }
  return best;
}

// معلم المنطقة في حديقة (2.4.0، بطلب المستخدم: "معالم المدن... يجب وضعهم في أماكن خاصة مثل الحدائق لأنها زينة ومعلم وليست
// مبنى"): وسط أقرب حديقة لوسط الخريطة، وفي هونغ كونغ وباريس وروتنبورغ جزيرة دوارها حين لا دوار (المعابد مكانه).
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

// لا سور حول المعبد ومباني المرتزقة والحدائق (2.4.1، بطلب المستخدم) ولا المباني المميزة (2.4.2، بطلبه)، في خرائط المعابد
// (وبلاها كما كان: فحص التطابق مع المتصفح)
bool fortifiable(GameMap map, District d) =>
    !(d.temple || d.merc || (map.districts.any((x) => x.temple) && (d.feature != null || parksOf(map).contains(d.id))));
