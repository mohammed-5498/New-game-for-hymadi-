// ضباب الحرب على البوتات (ai/fog_ai.dart): المباراة تُلعب كاملة بلا خطأ، وتتكرر نفسها ببذرتها (اللعب المحلي)، والحفظ
// يحمل ما يعرفه كل بوت فتكمل بعد الفتح كما لو لم تُحفظ، والبوت لا يعرف أحياء لم يرها في البداية، ويستكشف حتى يعرفها
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/save.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/net/lockstep.dart' show hashState;

Map<String, Object?> _bot(int k, String gang) => {'name': 'بوت $k', 'gang': gang, 'nation': null,
  'color': ['blue', 'red', 'green', 'yellow'][k], 'isHuman': false, 'team': 0, 'difficulty': k.isEven ? 'hard' : 'medium'};

MatchState _match(int seed, {bool fog = true, String city = 'arab'}) {
  simRng = Rng(seed);
  return createMatch((jsonDecode(jsonEncode({
    'mode': 'conquest', 'city': city, 'mapSize': 'small', 'maxUnits': 50, 'weather': 'day', 'fog': fog,
    'players': [_bot(0, 'crows'), _bot(1, 'hammers'), _bot(2, 'vipers'), _bot(3, 'scorpions')],
  })) as Map).cast<String, Object?>())..seed = seed;
}

void _run(MatchState s, double seconds) {
  for (var t = 0.0; t < seconds && s.matchResult == null; t += 0.05) { updateMatch(s); }
}

void main() {
  test('بذرة واحدة: المباراة نفسها مرتين، والحفظ يحمل ما يعرفه كل بوت', () {
    final a = _match(31);
    _run(a, 120);
    final b = _match(31);
    _run(b, 120);
    expect(hashState(a), hashState(b));
    expect(a.fogBelief.length, greaterThanOrEqualTo(3));
    // الحفظ (وإعادة المزامنة في اللعب المحلي): نسختان مفتوحتان من النص نفسه تكملان المباراة نفسها
    final text = encodeMatch(a);
    final c1 = decodeMatch(text), c2 = decodeMatch(text);
    for (final e in a.fogBelief.entries) { expect(c1.fogBelief[e.key], e.value); }
    simRng = Rng(5);
    _run(c1, 120);
    simRng = Rng(5);
    _run(c2, 120);
    expect(hashState(c1), hashState(c2));
  }, timeout: const Timeout(Duration(minutes: 3)));

  test('البوت لا يعرف ما لم يره، ويستكشف المدينة', () {
    final s = _match(7);
    _run(s, 3);
    int unknownOwned(int pid) {
      final belief = s.fogBelief[pid]!;
      var n = 0;
      for (final d in s.map.districts) { if (d.owner != null && d.owner != pid && belief[d.id] != d.owner) n++; }
      return n;
    }
    final early = unknownOwned(1);
    expect(early, greaterThan(0), reason: 'قواعد الآخرين لا يعرفها في البداية');
    _run(s, 300);
    final known = s.fogBelief[1]!.where((o) => o >= 0).length;
    expect(known, greaterThan(4), reason: 'عرف أحياء غير أحيائه باستكشافها');
  }, timeout: const Timeout(Duration(minutes: 3)));

  test('بلا ضباب: لا معرفة محفوظة (المحاكاة كما كانت)', () {
    final s = _match(9, fog: false);
    _run(s, 60);
    expect(s.fogBelief, isEmpty);
  });

  test('ثماني مدن بالضباب تكمل عشر دقائق بلا خطأ', () {
    for (final city in ['hk', 'paris', 'japan', 'cairo', 'norway', 'chicago', 'yamamah', 'gondar']) {
      final s = _match(city.length * 13, city: city);
      _run(s, 600);
      expect(s.units, isNotEmpty, reason: city);
    }
  }, timeout: const Timeout(Duration(minutes: 6)));
}
