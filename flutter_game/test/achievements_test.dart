// ذهب الفوز وقاعدة الفريق والإنجازات (2.13.0، GAME_SPEC 18.18): صعوبة واحدة تعطي ذهبها وصعوبات مختلفة SHOP.mixedReward،
// والحلفاء بلا ذهب إلا أمام فريق بعددهم وبصعوبة الحليف أو أصعب، والإنجازات تُمنح مرة بجائزتها وتبقى بعد إعادة التشغيل
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/config.dart' show ACH, SHOP;
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/modes.dart' show modeOf;
import 'package:gangcity/game/state.dart';
import 'package:gangcity/game/victory.dart' show MatchResult;
import 'package:gangcity/ui/achievements.dart';
import 'package:gangcity/ui/prefs.dart';
import 'package:gangcity/ui/wallet.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _gangs = ['crows', 'hammers', 'vipers', 'scorpions', 'crows', 'hammers', 'vipers', 'scorpions'];

// أنت في فريق you (0 بلا فريق)، والبوتات (فريق، صعوبة)
MatchState _match(int you, List<(int, String)> bots, {String mode = 'conquest', String size = 'large'}) {
  simRng = Rng(7);
  final colors = ['blue', 'red', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'];
  return createMatch((jsonDecode(jsonEncode({
    'mode': mode, 'city': 'arab', 'mapSize': size, 'maxUnits': 50, 'weather': 'night', 'fog': false,
    'players': [
      {'name': 'أنت', 'gang': 'crows', 'color': colors[0], 'isHuman': true, 'team': you, 'difficulty': 'medium'},
      for (var k = 0; k < bots.length; k++)
        {'name': 'بوت $k', 'gang': _gangs[k], 'color': colors[k + 1], 'isHuman': false, 'team': bots[k].$1, 'difficulty': bots[k].$2},
    ],
  })) as Map).cast<String, Object?>());
}

int _gold(MatchState s) => Wallet.matchGold(lineupOf(s), false);

void main() {
  test('ذهب الفوز وقاعدة الفريق', () {
    expect(_gold(_match(0, [(0, 'hard')])), SHOP.rewards['hard']);
    expect(_gold(_match(0, [(0, 'hard'), (0, 'hard')])), SHOP.rewards['hard']);
    expect(Wallet.matchGold(lineupOf(_match(0, [(0, 'insane')])), true), SHOP.rewards['insane']! + SHOP.fogBonus);
    expect(_gold(_match(0, [(0, 'insane'), (0, 'easy')])), SHOP.mixedReward, reason: 'صعوبات مختلفة');
    // حليف صعب ضد بوت صعب واحد: فريقك أكبر
    expect(_gold(_match(1, [(1, 'hard'), (2, 'hard')])), 0);
    // حليف صعب ضد فريق من بوتين صعبين: متساويان
    expect(_gold(_match(1, [(1, 'hard'), (2, 'hard'), (2, 'hard')])), SHOP.rewards['hard']);
    // حليف صعب ضد فريق من بوتين سهلين: الحليف أقوى منه
    expect(_gold(_match(1, [(1, 'hard'), (2, 'easy'), (2, 'easy')])), 0);
    // حليف سهل ضد فريق صعب: يُحسب، وبصعوبات مختلفة
    expect(_gold(_match(1, [(1, 'easy'), (2, 'hard'), (2, 'hard')])), SHOP.mixedReward);
    // ستة أعداء بلا فريق: كل واحد فريق وحده، وفريقك من اثنين أكبر منه
    expect(_gold(_match(1, [(1, 'hard'), for (var k = 0; k < 6; k++) (0, 'hard')])), 0);
    // وفي فريق: يُحسب
    expect(_gold(_match(1, [(1, 'hard'), for (var k = 0; k < 6; k++) (2, 'hard')])), SHOP.rewards['hard']);
    // أنت في فريق وحدك: لا حلفاء
    expect(_gold(_match(3, [(0, 'medium')])), SHOP.rewards['medium']);
  });

  test('الإنجازات تُمنح مرة بجائزتها وتبقى', () async {
    SharedPreferences.setMockInitialValues({});
    await Prefs.init();
    Wallet.load();
    Achievements.load();
    expect(Wallet.gold, SHOP.startGold);
    MatchResult won(MatchState s) => MatchResult(true, '', s.mode, 300, 5, 3, 1);

    // فوز وحدك ضد بوتين صعبين ليلاً: أول فوز والليل والفوز على الصعب
    final a = _match(0, [(0, 'hard'), (0, 'hard')]);
    final got = Achievements.ended(a, won(a), lineupOf(a), false).map((x) => x.id).toSet();
    expect(got, containsAll(['first_win', 'night_win', 'two_hard']));
    expect(got.contains('cities'), isFalse, reason: 'مدينة واحدة من ${ACH.cities}');
    expect(Wallet.gold, SHOP.startGold + 2 * ACH.rewards['easy']! + ACH.rewards['hard']!);
    expect(Achievements.counts['medium_wins'], 1);
    expect(Achievements.counts['hard_wins'], 1);

    // لا تتكرر، وما بقي يكمل عدّه
    final before = Wallet.gold;
    final b = _match(0, [(0, 'hard'), (0, 'hard')]);
    final again = Achievements.ended(b, won(b), lineupOf(b), false).map((x) => x.id);
    expect(again, isNot(contains('first_win')));
    expect(Wallet.gold, before);
    expect(Achievements.counts['hard_wins'], 2);

    // فريقك أكبر: الفوز لا يُحسب
    final c = _match(1, [(1, 'insane'), (2, 'insane')]);
    expect(Achievements.ended(c, won(c), lineupOf(c), false).map((x) => x.id), isNot(contains('insane_win')));
    // وحدك ضد مجنون: جوهرة
    final d = _match(0, [(0, 'insane')]);
    expect(Achievements.ended(d, won(d), lineupOf(d), false).map((x) => x.id), contains('insane_win'));
    expect(Wallet.gems, ACH.gems);

    // أنت وحليف صعب ضد ستة صعاب في فريق
    final e = _match(1, [(1, 'hard'), for (var k = 0; k < ACH.mob; k++) (2, 'hard')]);
    expect(Achievements.ended(e, won(e), lineupOf(e), false).map((x) => x.id), contains('mob'));
    expect(Wallet.gems, 2 * ACH.gems);

    // تبقى بعد إعادة التشغيل
    Achievements.load();
    expect(Achievements.done, containsAll(['first_win', 'night_win', 'two_hard', 'insane_win', 'mob']));
    expect(Achievements.counts['hard_wins'], 4, reason: 'والفوز على المجنون والستة يُحسب على الصعب');
    Wallet.load();
    expect(Wallet.gems, 2 * ACH.gems);
  });

  test('ما يحدث في المباراة: الأحياء والمباني والأوامر والترول والصمود', () async {
    SharedPreferences.setMockInitialValues({});
    await Prefs.init();
    Wallet.load();
    Achievements.load();
    final s = _match(0, [(0, 'medium')]);
    final me = s.humanId;
    expect(Achievements.poll(s), isEmpty, reason: 'البداية');
    final mine = [for (final d in s.map.districts) if (d.capture != null && d.owner == null) d].take(ACH.districts).toList();
    for (final d in mine) { d.owner = me; }
    s.stats.maxDistricts = ACH.districts;
    mine[0].building = 'tower';
    mine[1].building = 'hospital';
    s.stats.beasts = 1;
    s.stats.ults = ACH.ults;
    expect(Achievements.poll(s).map((a) => a.id), containsAll(['districts', 'tower_hospital', 'beast', 'ults']));
    expect(Achievements.poll(s), isEmpty, reason: 'مرة واحدة');
    expect(Achievements.command(s, 'fortify', mine[2].id).map((a) => a.id), ['fortify']);
    expect(Achievements.command(s, 'improve', mine[0].id).map((a) => a.id), ['upgrade']);
    for (final d in mine.take(ACH.hqs)) { d.building = 'hq'; }
    expect(Achievements.poll(s).map((a) => a.id), contains('hqs'));

    final v = _match(0, [], mode: 'survival');
    modeOf(v).level = 'hard';
    modeOf(v).wave = ACH.hardWaves;
    expect(Achievements.poll(v).map((a) => a.id), containsAll(['waves', 'hard_waves']));
    expect(Achievements.done.contains('insane_waves'), isFalse);
    expect(Wallet.survivalGold('hard', ACH.hardWaves), ACH.hardWaves ~/ SHOP.survivalEvery * SHOP.survival['hard']!);
  });
}
