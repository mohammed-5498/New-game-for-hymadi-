// المعابد ومباني المرتزقة (GAME_SPEC 3.14، إعداد 'temples'): في كل مدينة معبد في الوسط وأربعة مبانٍ للمرتزقة في الزوايا
// بحراسها، وملك الحي على المعبد، والمباراة تُلعب بلا خطأ وتتكرر نفسها ببذرتها (اللعب المحلي والحفظ)
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/game/combat.dart' show isEnemyId;
import 'package:gangcity/game/features.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/modes.dart';
import 'package:gangcity/game/save.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/net/lockstep.dart' show hashState;

Map<String, Object?> _bot(int k) => {'name': 'بوت $k', 'gang': ['crows', 'hammers', 'vipers', 'scorpions'][k], 'nation': null,
  'color': ['blue', 'red', 'green', 'yellow'][k], 'isHuman': false, 'team': 0, 'difficulty': k.isEven ? 'hard' : 'medium'};

MatchState _match(String city, int seed, {String mode = 'conquest', String size = 'medium'}) {
  simRng = Rng(seed);
  return createMatch((jsonDecode(jsonEncode({
    'mode': mode, 'city': city, 'mapSize': size, 'maxUnits': 50, 'weather': 'day', 'temples': true,
    'players': [_bot(0), _bot(1), _bot(2), _bot(3)],
  })) as Map).cast<String, Object?>())..seed = seed;
}

void _run(MatchState s, double seconds) {
  for (var t = 0.0; t < seconds && s.matchResult == null; t += 0.05) { updateMatch(s); }
}

const _cities = ['yamamah', 'arab', 'shibam', 'diriyah', 'cairo', 'japan', 'china', 'hk', 'jaipur', 'kaifeng', 'gyeongju', 'europe',
  'norway', 'paris', 'birmingham', 'rothenburg', 'gondar', 'kano', 'meroe', 'mexico', 'chicago', 'rio', 'laboca', 'tenoch'];

void main() {
  test('معبد في الوسط وأربعة مرتزقة في كل مدينة، بحراسها، وتُلعب دقيقتين', () {
    for (final city in _cities) {
      final s = _match(city, 11);
      final temples = s.map.districts.where((d) => d.temple).toList(), mercs = s.map.districts.where((d) => d.merc).toList();
      expect(temples.length, 1, reason: city);
      expect(mercs.length, 4, reason: city);
      expect(temples.first.featureTile, isNotNull, reason: city);
      final guards = s.players.where((p) => p.feature == 'guards').toList();
      if (guards.isNotEmpty) expect(s.units.where((u) => u.playerId == guards.first.id).length, greaterThan(0), reason: city);
      _run(s, 120);
    }
  }, timeout: const Timeout(Duration(minutes: 6)));

  test('القواعد مربعات متساوية على أبعاد متساوية من المعبد، والمعبد والمرتزقة مربعات (في كل المدن، من 2 إلى 8 لاعبين)', () {
    for (final city in _cities) {
      for (final np in [2, 3, 4, 8]) {
        simRng = Rng(np);
        final s = createMatch((jsonDecode(jsonEncode({
          'mode': 'conquest', 'city': city, 'mapSize': np == 8 ? 'small' : 'medium', 'maxUnits': 50, 'weather': 'day', 'temples': true,
          'players': [for (var k = 0; k < np; k++) {..._bot(k % 4), 'color': ['blue', 'red', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'][k]}],
        })) as Map).cast<String, Object?>());
        final why = '$city $np';
        final temple = s.map.districts.firstWhere((d) => d.temple);
        expect(temple.tiles.length, 25, reason: why);
        expect(s.map.districts.where((d) => d.merc).every((d) => d.tiles.length == 16), isTrue, reason: why);
        final homes = s.map.districts.where((d) => d.isHome).toList();
        expect(homes.length, np, reason: why);
        expect(homes.every((d) => d.tiles.length == 16), isTrue, reason: why);
        final far = [for (final d in homes) math.sqrt(math.pow(d.cx - temple.cx, 2) + math.pow(d.cy - temple.cy, 2))];
        expect(far.reduce(math.max) - far.reduce(math.min), lessThan(1.5), reason: '$why $far');
      }
    }
  });

  test('ملك الحي على المعبد، والمباراة تتكرر نفسها ببذرتها', () {
    final k = _match('china', 21, mode: 'king');
    expect(hillOf(k)?.temple, isTrue);
    final a = _match('kaifeng', 5);
    _run(a, 150);
    final b = _match('kaifeng', 5);
    _run(b, 150);
    expect(hashState(a), hashState(b));
    // الحفظ: نسختان مفتوحتان من النص نفسه تكملان المباراة نفسها، بحراسها ومعبدها
    final text = encodeMatch(a), c1 = decodeMatch(text), c2 = decodeMatch(text);
    expect(c1.map.districts.where((d) => d.merc).length, 4);
    simRng = Rng(9);
    _run(c1, 60);
    simRng = Rng(9);
    _run(c2, 60);
    expect(hashState(c1), hashState(c2));
    // حراس المرتزقة والشرطة لا يتقاتلون (بطلب المستخدم)، ويبقون أعداء للاعبين
    final guards = a.players.firstWhere((p) => p.feature == 'guards'), police = a.players.firstWhere((p) => p.gang == 'police');
    expect(isEnemyId(a, guards.id, police.id), isFalse);
    expect(isEnemyId(a, police.id, guards.id), isFalse);
    expect(isEnemyId(a, guards.id, 0), isTrue);
    // من يحتل معبد الباغودا يأخذ ميزته
    final t = a.map.districts.firstWhere((d) => d.temple);
    t..owner = 0..progress = 100..progressOwner = 0;
    updateMatch(a);
    expect(templeOwner(a, 'pagoda'), 0);
  }, timeout: const Timeout(Duration(minutes: 3)));
}
