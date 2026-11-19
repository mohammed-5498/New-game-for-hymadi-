// تسخين الحركات قبل المباراة في المدن الـ24 (بالمعابد وبلاها، وبأمم مختلفة): لا يرمي خطأً ولا يغيّر المباراة (2.1.5)
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/render/batch.dart';
import 'package:gangcity/render/unit_art.dart';
import 'package:gangcity/render/unit_atlas.dart';

const _cities = ['yamamah', 'arab', 'shibam', 'diriyah', 'cairo', 'japan', 'china', 'hk', 'jaipur', 'kaifeng', 'gyeongju', 'europe',
  'norway', 'paris', 'birmingham', 'rothenburg', 'gondar', 'kano', 'meroe', 'mexico', 'chicago', 'rio', 'laboca', 'tenoch'];
const _sides = [('yemen', null), ('saudi', 'elite'), ('egypt', null), ('japan', 'elite'), ('germany', 'elite'), ('brazil', null), (null, null),
  ('china', 'elite'), ('argentina', null), ('mexico', 'elite'), ('korea', null), ('france', 'elite'), ('britain', null), ('ethiopia', 'elite')];

MatchState _m(String city, int c, bool temples, String size) {
  simRng = Rng(500 + c);
  return createMatch((jsonDecode(jsonEncode({
    'mode': 'conquest', 'city': city, 'mapSize': size, 'maxUnits': 100, 'weather': 'day', 'temples': temples,
    'players': [for (var k = 0; k < 4; k++) {'name': 'p$k', 'gang': ['crows', 'hammers', 'vipers', 'scorpions'][k],
      'nation': _sides[(c + k) % _sides.length].$1, 'skin': _sides[(c + k) % _sides.length].$2,
      'color': ['blue', 'red', 'green', 'yellow'][k], 'isHuman': k == 0, 'team': 0, 'difficulty': 'hard'}],
  })) as Map).cast<String, Object?>())..seed = 500 + c..running = true;
}

void main() {
  testWidgets('التسخين في المدن الـ24', (tester) async {
    final bad = <String>[];
    for (var c = 0; c < _cities.length; c++) {
      for (final temples in [true, false]) {
        final s = _m(_cities[c], c, temples, c.isEven ? 'large' : 'medium');
        setUnitSkins(s);
        final atlas = (await tester.runAsync(() => buildUnitAtlas(atlasPairs(s))))!;
        try {
          warmUnitArt(s, atlas, TriBatch());
        } catch (e, st) {
          fail('${_cities[c]} temples=$temples: $e\n$st');
        }
        // ignore: avoid_print
        print('${_cities[c]} temples=$temples atlas ${atlas.image.width}x${atlas.image.height} pairs ${atlasPairs(s).toSet().length}');
        if (atlas.missing.isNotEmpty) bad.add('${_cities[c]} temples=$temples: ${atlas.missing}');
        atlas.image.dispose();
      }
    }
    // ignore: avoid_print
    for (final b in bad) { print(b); }
    expect(bad, isEmpty);
  }, timeout: const Timeout(Duration(minutes: 20)));
}
