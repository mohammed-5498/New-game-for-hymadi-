// الحدائق (2.4.1، بطلب المستخدم): حديقة واحدة على الأقل في كل خريطة لمعلمها ونافورتها، ووسط الحديقة غير مربع البناء (كان برج
// حديقة هونغ كونغ يُبنى مكان نافورتها فترمي السهام)، ولا سور في الحدائق والمعبد ومباني المرتزقة
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/config.dart' show RETIRED_CITIES, CITIES;
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/game/empire.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/map/parks.dart';

Map<String, Object?> _bot(int k) => {'name': 'b$k', 'gang': ['crows', 'hammers', 'vipers', 'scorpions'][k], 'nation': null,
  'color': ['blue', 'red', 'green', 'yellow'][k], 'isHuman': false, 'team': 0, 'difficulty': 'medium'};

void main() {
  test('حديقة في كل خريطة، ووسطها غير مربع البناء، ولا سور فيها ولا في المعبد والمرتزقة', () {
    for (final city in CITIES.order.where((c) => !RETIRED_CITIES.contains(c))) {
      for (final size in ['small', 'medium', 'large']) {
        simRng = Rng(3);
        final s = createMatch((jsonDecode(jsonEncode({'mode': 'conquest', 'city': city, 'mapSize': size, 'maxUnits': 50, 'weather': 'day',
          'temples': true, 'players': [for (var k = 0; k < 4; k++) _bot(k)]})) as Map).cast<String, Object?>());
        final m = s.map, why = '$city $size', parks = parksOf(m);
        expect(parks, isNotEmpty, reason: why);
        for (final id in parks) {
          final d = m.districts[id], c = parkCenter(m, d);
          expect(c, greaterThanOrEqualTo(0), reason: why);
          expect(c, isNot(buildSpot(m, d)), reason: '$why: وسط الحديقة مربع البناء');
          d..owner = 0..progress = 100;
          expect(canFortify(s, 0, d).ok, isFalse, reason: '$why: سور في حديقة');
        }
        for (final d in m.districts.where((d) => d.temple || d.merc)) {
          d..owner = 0..progress = 100;
          expect(canFortify(s, 0, d).ok, isFalse, reason: '$why: سور حول معبد أو مرتزقة');
        }
      }
    }
  });
}
