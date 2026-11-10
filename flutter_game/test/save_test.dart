// حفظ المباراة ومتابعتها: الحالة بعد الفتح كما كانت عند الحفظ (المواقع والدم والأحياء والنقاط)، وتكمل بلا خطأ
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/save.dart';
import 'package:gangcity/game/state.dart';

String sig(MatchState s) => [
  s.time.toStringAsFixed(3), s.units.length, s.nextUnitId,
  for (final u in s.units) '${u.id}:${u.x.toStringAsFixed(4)},${u.y.toStringAsFixed(4)},${u.hp.toStringAsFixed(4)},${u.state},${u.target?.id}',
  for (final d in s.map.districts) '${d.owner}/${d.progress.toStringAsFixed(3)}/${d.building}/${d.fort}',
  ...?s.empire?.points.map((p) => p.toStringAsFixed(3)),
].join('|');

void main() {
  test('حفظ ومتابعة', () {
    const seed = 4242;
    simRng = Rng(seed);
    final s = createMatch({'mapSize': 'small', 'maxUnits': 100, 'weather': 'day', 'mode': 'conquest', 'players': [
      for (var k = 0; k < 4; k++) {'name': 'بوت $k', 'gang': ['crows', 'hammers', 'vipers', 'scorpions'][k],
        'color': ['blue', 'red', 'green', 'yellow'][k], 'isHuman': false, 'team': 0, 'difficulty': k.isEven ? 'hard' : 'medium'}
    ]})..seed = seed;
    for (var t = 0; t < 20 * 90; t++) { updateMatch(s); }
    final text = encodeMatch(s);
    final back = decodeMatch(text);
    expect(sig(back), sig(s));
    expect(back.map.city, s.map.city);
    for (var t = 0; t < 20 * 60 && back.matchResult == null; t++) { updateMatch(back); }
    expect(back.time, greaterThan(s.time));
    // ignore: avoid_print
    print('حجم الحفظ ${(text.length / 1024).toStringAsFixed(0)} ك.ب، ${s.units.length} وحدة');
  });
}
