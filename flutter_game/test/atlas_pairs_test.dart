// كل صورة جندي تظهر في المباراة مجهزة قبل بدئها (atlasPairs)، فلا يُبنى أطلس الجنود من جديد أثناء القتال (2.1.1)
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/render/unit_art.dart';

const _cities = ['yamamah', 'arab', 'shibam', 'diriyah', 'cairo', 'japan', 'china', 'hk', 'jaipur', 'kaifeng', 'gyeongju', 'europe',
  'norway', 'paris', 'birmingham', 'rothenburg', 'gondar', 'kano', 'meroe', 'mexico', 'chicago', 'rio', 'laboca', 'tenoch'];
const _sides = [('yemen', null), ('saudi', 'elite'), ('egypt', null), ('japan', 'elite'), ('germany', 'elite'), ('brazil', null), (null, null), ('china', 'elite')];

void main() {
  test('لا صورة جندي تنقص الأطلس أثناء المباراة، في المدن الـ24 بالمعابد', () {
    for (var c = 0; c < _cities.length; c++) {
      simRng = Rng(100 + c);
      final s = createMatch((jsonDecode(jsonEncode({
        'mode': 'conquest', 'city': _cities[c], 'mapSize': 'medium', 'maxUnits': 50, 'weather': 'day', 'temples': true,
        'players': [for (var k = 0; k < 4; k++) {
          'name': 'p$k', 'gang': ['crows', 'hammers', 'vipers', 'scorpions'][k], 'nation': _sides[(c + k) % _sides.length].$1,
          'skin': _sides[(c + k) % _sides.length].$2, 'color': ['blue', 'red', 'green', 'yellow'][k], 'isHuman': false, 'team': 0, 'difficulty': 'hard'}],
      })) as Map).cast<String, Object?>())..seed = 100 + c;
      s.running = true;
      setUnitSkins(s);
      final have = atlasPairs(s).toSet();
      final missing = <(String, String)>{};
      for (var t = 0; t < 6 * 60 * 20; t++) {
        updateMatch(s);
        if (t % 40 != 0) continue;
        for (final Unit u in s.units) {
          final g = sheetOf(u, skinOf(u));
          if (g != null && !have.contains((g, artColor(u)))) missing.add((g, artColor(u)));
        }
      }
      expect(missing, isEmpty, reason: _cities[c]);
    }
  }, timeout: const Timeout(Duration(minutes: 20)));
}
