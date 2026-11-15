// تسخين الحركات قبل المباراة لا يمس المباراة (2.1.1): البصمة نفسها بعده، ويرسم كل الأنواع بلا أخطاء
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/net/lockstep.dart' show hashState;
import 'package:gangcity/render/batch.dart';
import 'package:gangcity/render/unit_art.dart';
import 'package:gangcity/render/unit_atlas.dart';

MatchState _m() {
  simRng = Rng(42);
  return createMatch((jsonDecode(jsonEncode({
    'mode': 'conquest', 'city': 'japan', 'mapSize': 'large', 'maxUnits': 50, 'weather': 'day', 'temples': true,
    'players': [for (var k = 0; k < 4; k++) {'name': 'p$k', 'gang': ['crows', 'hammers', 'vipers', 'scorpions'][k],
      'nation': ['yemen', 'saudi', null, 'brazil'][k], 'skin': k == 1 ? 'elite' : null, 'color': ['blue', 'red', 'green', 'yellow'][k],
      'isHuman': k == 0, 'team': 0, 'difficulty': 'hard'}],
  })) as Map).cast<String, Object?>())..seed = 42..running = true;
}

void main() {
  testWidgets('التسخين لا يغيّر المباراة', (tester) async {
    final a = _m();
    for (var t = 0; t < 600; t++) { updateMatch(a); }
    final b = _m();   // المولّد ببذرته من جديد (مشترك بين المباراتين)
    setUnitSkins(b);
    final atlas = (await tester.runAsync(() => buildUnitAtlas(atlasPairs(b))))!;
    final sw = Stopwatch()..start();
    warmUnitArt(b, atlas, TriBatch());
    // ignore: avoid_print
    print('warm ${sw.elapsedMilliseconds} ms, missing ${atlas.missing}');
    for (var t = 0; t < 600; t++) { updateMatch(b); }
    expect(hashState(b), hashState(a));
    expect(atlas.missing, isEmpty);
  });
}
