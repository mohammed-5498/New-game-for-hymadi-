// صور المدن المحسّنة (2.0.7): البرج والمستشفى بآخر ترقية ثم "كل الترقيات"، والقاعدة بمستواها وساحة تدريبها،
// وقطع السور تظهر بالتحصين وتتبدل في مكانها بلا بناء الطبقة كلها، وقناع الرايات بلون المالك
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/game/empire.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/map/generator.dart';
import 'package:gangcity/render/city_art.dart';
import 'package:gangcity/render/city_layer.dart';

Map<String, Object?> _bot(int k) => {'name': 'بوت $k', 'gang': ['crows', 'hammers'][k], 'nation': null,
  'color': ['blue', 'red'][k], 'isHuman': false, 'team': 0, 'difficulty': 'medium'};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('صور الترقيات والمستويات والأسوار', () async {
    final art = await CityArt.load('shibam');
    simRng = Rng(3);
    final s = createMatch((jsonDecode(jsonEncode({
      'mode': 'conquest', 'city': 'shibam', 'mapSize': 'small', 'maxUnits': 50, 'weather': 'day', 'players': [_bot(0), _bot(1)],
    })) as Map).cast<String, Object?>());
    final layer = CityLayer(s.map, art, 'day', s);
    s.empire!.points[0] = 1e6;
    String? shown(int k) => tileSprite(s.map, art, k % s.map.n, k ~/ s.map.n, s)?.$1.up;
    bool free(District d) => d.building == null && d.featureTile == null && !d.hill && buildSpot(s.map, d) >= 0;
    final mine = s.map.districts.where((d) => d.capture != null && !d.police && free(d)).take(2).toList();
    for (final d in mine) { d.owner = 0; }
    final t = mine.firstWhere(free);
    expect(buildDistrict(s, 0, t.id, 'tower').ok, isTrue);
    expect(shown(t.buildTile!), isNull);                         // صورة الحجم
    upgradeBuilding(s, 0, t.id, 'rate');
    expect(shown(t.buildTile!), 'rate1');
    upgradeBuilding(s, 0, t.id, 'damage');
    expect(shown(t.buildTile!), 'damage1');                      // آخر ما اشتُري
    upgradeBuilding(s, 0, t.id, 'damage');
    upgradeBuilding(s, 0, t.id, 'rate');
    expect(shown(t.buildTile!), 'all');
    final q = mine.firstWhere(free);
    expect(buildDistrict(s, 0, q.id, 'hq').ok, isTrue);
    final yard = s.map.idx(q.capture!.i, q.capture!.j);
    expect(shown(q.buildTile!), isNull);
    expect(tileSprite(s.map, art, q.capture!.i, q.capture!.j, s), isNull);
    for (var k = 0; k < 3; k++) { upgradeBuilding(s, 0, q.id, 'production'); }
    expect(shown(q.buildTile!), startsWith('tier'));
    expect(tileSprite(s.map, art, q.capture!.i, q.capture!.j, s)?.$1.group, 'yard');
    // الطبقة: المبنيان وساحة التدريب تتبدل في خاناتها، والسور يظهر بالتحصين
    expect(layer.refreshTiles(s.map, art, [t.buildTile!, q.buildTile!, yard], s), isTrue);
    final before = layer.rects.where((v) => v != 0).length;
    fortifyDistrict(s, 0, q.id);
    fortifyDistrict(s, 0, q.id);
    layer.refreshWalls(s.map, art);
    expect(layer.rects.where((v) => v != 0).length, greaterThan(before));
    // قناع رايات القاعدة بلون مالكها بعد الصبغ
    expect(art.economy('hq', 'medium')?.mx, isNotNull);
    layer.retint([for (final d in s.map.districts) d.owner == 0 ? ('#3b6fd6', 1.0) : (null, 0.0)], 0.3, 0.1, 0.3, 0.1);
    expect(layer.spriteCol.any((c) => c != -1 && c >> 24 & 0xFF == 0xFF && (c & 0xFFFFFF) == 0x3b6fd6), isTrue);
  });
}
