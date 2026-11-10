// حفظ المباراة ومتابعتها: الحالة بعد الفتح كما كانت عند الحفظ (المواقع والدم والأحياء والنقاط وحالة الطور)، وتكمل بلا خطأ
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/modes.dart';
import 'package:gangcity/game/save.dart';
import 'package:gangcity/game/state.dart';

String sig(MatchState s) => [
  s.time.toStringAsFixed(3), s.units.length, s.nextUnitId,
  for (final u in s.units) '${u.id}:${u.x.toStringAsFixed(4)},${u.y.toStringAsFixed(4)},${u.hp.toStringAsFixed(4)},${u.state},${u.target?.id}',
  for (final d in s.map.districts) '${d.owner}/${d.progress.toStringAsFixed(3)}/${d.building}/${d.fort}',
  ...?s.empire?.points.map((p) => p.toStringAsFixed(3)),
  modeOf(s).wave, modeOf(s).held.join(','), modeOf(s).leaderKills,
].join('|');

Map<String, Object?> bot(int k, String gang, [String? nation, int team = 0]) => {'name': 'بوت $k', 'gang': gang, 'nation': nation,
  'color': ['blue', 'red', 'green', 'yellow'][k], 'isHuman': false, 'team': team, 'difficulty': k.isEven ? 'hard' : 'medium'};

void main() {
  final cases = {
    'conquest': {'mode': 'conquest', 'players': [bot(0, 'crows'), bot(1, 'hammers'), bot(2, 'vipers'), bot(3, 'scorpions')]},
    'king': {'mode': 'king', 'modeOptions': {'holdMinutes': 2}, 'players': [bot(0, 'crows', 'japan'), bot(1, 'vipers', 'korea'), bot(2, 'hammers', 'egypt')]},
    'features': {'mode': 'conquest', 'city': 'kaifeng', 'players': [bot(0, 'crows'), bot(1, 'vipers', 'mexico'), bot(2, 'hammers')]},
    'events': {'mode': 'conquest', 'city': 'shibam', 'players': [bot(0, 'crows'), bot(1, 'scorpions', 'yemen'), bot(2, 'hammers')]},
    'survival': {'mode': 'survival', 'protagonistId': 0, 'players': [bot(0, 'vipers', 'mexico', 1), bot(1, 'crows', 'argentina', 1)]},
  };
  for (final e in cases.entries) {
    test('حفظ ومتابعة: ${e.key}', () {
      const seed = 4242;
      simRng = Rng(seed);
      final s = createMatch({'mapSize': 'small', 'maxUnits': 100, 'weather': 'day', ...e.value})..seed = seed;
      for (var t = 0; t < 20 * 150 && s.matchResult == null; t++) { updateMatch(s); }
      final back = decodeMatch(encodeMatch(s));
      expect(sig(back), sig(s));
      expect(back.map.city, s.map.city);
      // ponytail: عشوائية القتال لكل وحدة تُبذر من جديد عند الفتح (كما في matchSave.js)، فالمتابعة سليمة لا مطابقة
      for (var t = 0; t < 20 * 60 && back.matchResult == null; t++) { updateMatch(back); }
      expect(back.time, greaterThan(s.time));
    });
  }
}
