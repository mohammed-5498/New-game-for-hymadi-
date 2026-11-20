// المكافآت اليومية والعروض (2.14.0، GAME_SPEC 18.18ب): مكافأة لكل تاريخ، ومن فاته يوم يكمل من يومه، والسابع 100 ومضاعف 12 ساعة،
// والأخير عصابة ومظهر منها وخريطة (وما تملكه منها بسعره)، ثم من أول التقويم. والعروض من التاريخ وحده بخصمها ووقتها
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/config.dart' show DAILY, OFFERS;
import 'package:gangcity/ui/daily.dart';
import 'package:gangcity/ui/prefs.dart';
import 'package:gangcity/ui/wallet.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> _fresh() async {
  SharedPreferences.setMockInitialValues({});
  await Prefs.init();
  Wallet.load();
  Daily.load();
}

void main() {
  test('تقويم المكافآت', () async {
    await _fresh();
    var now = DateTime(2026, 11, 20, 10);
    Daily.clock = () => now;
    expect((Daily.ready, Daily.next), (true, 1));
    expect(Daily.claim(), ['+${DAILY.gold} ذهب']);
    expect(Wallet.gold, DAILY.gold);
    expect(Daily.claim(), isEmpty, reason: 'مرة في اليوم');
    now = DateTime(2026, 11, 20, 23, 59);
    expect(Daily.ready, isFalse);
    now = DateTime(2026, 11, 28, 9);   // غاب أسبوعاً: يكمل من اليوم الثاني
    expect((Daily.ready, Daily.next), (true, 2));
    while (Daily.next < DAILY.every) { Daily.claim(); now = now.add(const Duration(days: 1)); }
    final gold = Wallet.gold;
    expect(Daily.claim(), ['+${DAILY.weekGold} ذهب', 'مضاعف الذهب ${DAILY.doublerHours} ساعة']);
    expect(Wallet.gold, gold + DAILY.weekGold);
    expect(Daily.doubled, isTrue);
    now = now.add(Duration(hours: DAILY.doublerHours, minutes: 1));
    expect(Daily.doubled, isFalse);
    while (Daily.next < DAILY.days) { now = now.add(const Duration(days: 1)); Daily.claim(); }

    // الأخير: عصابة ومظهر من عصابة يملكها وخريطة، لا يملك منها شيئاً
    now = now.add(const Duration(days: 1));
    final before = {...Wallet.owned}, goldBefore = Wallet.gold;
    expect(Daily.claim(math.Random(3)).length, 3);
    final added = Wallet.owned.difference(before);
    expect(added.map((k) => k.split(':').first).toSet(), {'side', 'skin', 'city'});
    expect(Wallet.hasSide(skinNation(added.firstWhere((k) => k.startsWith('skin:')).substring(5))), isTrue, reason: 'المظهر من عصابة يملكها');
    expect(Wallet.gold, goldBefore);
    // ثم من أول التقويم
    now = now.add(const Duration(days: 1));
    expect(Daily.next, 1);
    Daily.claim();
    Daily.load();
    expect((Daily.day, Daily.ready), (1, false), reason: 'يبقى بعد إعادة التشغيل');
  });

  test('اليوم الأخير يعوّض ما تملكه بسعره', () async {
    await _fresh();
    for (final n in Offers.nationIds) { Wallet.grant('side', n); }
    for (final s in Offers.skins) { Wallet.grant('skin', s); }
    for (final c in Offers.cities) { Wallet.grant('city', c); }
    Daily.day = DAILY.days - 1;
    Daily.clock = () => DateTime(2026, 12, 1, 8);
    Daily.claim(math.Random(1));
    expect(Wallet.gold, Wallet.basePrice('side') + Wallet.basePrice('skin') + Wallet.basePrice('city'));
  });

  test('العروض من التاريخ', () {
    final t = DateTime(2026, 11, 20, 10);
    expect(Offers.today(t), Offers.today(DateTime(2026, 11, 20, 23)));
    expect(Offers.today(t).length, OFFERS.dayMaps + OFFERS.dayGangs);
    expect(Offers.flash(t), Offers.flash(DateTime(2026, 11, 20, 11, 59)));
    expect({for (var h = 0; h < 14; h++) Offers.flash(t.add(Duration(hours: 12 * h)))}.length, greaterThan(3), reason: 'يتبدل');
    final (kind, id) = Offers.flash(t);
    expect(Offers.percent(kind, id, t), OFFERS.shortPercent);
    for (final o in Offers.today(t)) { if (o != (kind, id)) expect(Offers.percent(o.$1, o.$2, t), OFFERS.dayPercent); }
    expect(Offers.flashLeft(t), const Duration(hours: 2));
    expect(Offers.dayLeft(t), const Duration(hours: 14));
    expect(hoursLeft(const Duration(hours: 3, minutes: 7)), '3:07');
    Offers.clock = () => t;
    expect(Wallet.price(kind, id), (Wallet.basePrice(kind) * (100 - OFFERS.shortPercent) / 100).round());
    for (var d = 0; d < 90; d++) {   // المجاني لا يدخل العروض
      final day = t.add(Duration(days: d));
      for (final (k, i) in [...Offers.today(day), Offers.flash(day)]) { if (k == 'city') expect(Wallet.freeCity(i), isFalse, reason: i); }
    }
    Offers.clock = DateTime.now;
  });
}
