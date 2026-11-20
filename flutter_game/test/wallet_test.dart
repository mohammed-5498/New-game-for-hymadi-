// الذهب والمشتريات (2.12.0، GAME_SPEC 18.18): رصيد أول تشغيل، والشراء بالذهب ولا يتكرر، والمظهر بعد عصابته، والجوهرة
// (2.13.0)، والعشوائي للاعب مما يملكه. وذهب الفوز وقاعدة الفريق في achievements_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/config.dart' show SHOP;
import 'package:gangcity/ui/menus.dart' show ownsSide, randomSide, resolveSide;
import 'package:gangcity/ui/prefs.dart';
import 'package:gangcity/ui/wallet.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('الذهب والشراء', () async {
    SharedPreferences.setMockInitialValues({});
    await Prefs.init();
    Wallet.load();
    expect(Wallet.gold, SHOP.startGold);
    const start = 2000;
    Wallet.earn(start - SHOP.startGold);
    expect(Wallet.hasCity('arab'), isTrue, reason: 'مدينة مجانية');
    expect(Wallet.hasCity('paris'), isFalse);
    expect(Wallet.hasSide('crows'), isTrue, reason: 'عصابة كلاسيكية');
    expect(Wallet.hasSide('yemen'), isFalse);
    expect(Wallet.blocked('skin', 'yemen'), isNotNull, reason: 'المظهر بعد عصابته');
    expect(ownsSide('yemen_elite'), isFalse);

    expect(Wallet.buy('city', 'paris'), isTrue);
    expect(Wallet.gold, start - SHOP.city);
    expect(Wallet.buy('city', 'paris'), isFalse, reason: 'لا يُشترى مرتين');
    expect(Wallet.buy('side', 'yemen'), isTrue);
    expect(Wallet.buy('skin', 'yemen'), isTrue);
    expect(ownsSide('yemen_elite'), isTrue);
    expect(Wallet.gold, start - SHOP.city - SHOP.side - SHOP.skin);

    Wallet.gold = 100;
    Wallet.save();
    expect(Wallet.buy('side', 'egypt'), isFalse, reason: 'الذهب لا يكفي');
    expect(Wallet.gold, 100);

    // يبقى بعد إعادة التشغيل
    Wallet.load();
    expect(Wallet.gold, 100);
    expect(Wallet.hasSide('yemen'), isTrue);

    // الجوهرة تشتري أي شيء واحد لا تملكه (والمظهر بعد عصابته)
    expect(Wallet.gemBuys('side', 'egypt'), isFalse, reason: 'بلا جوهرة');
    Wallet.gems = 1;
    expect(Wallet.gemBuys('skin', 'egypt'), isFalse, reason: 'المظهر بعد عصابته');
    expect(Wallet.gemBuys('city', 'paris'), isFalse, reason: 'تملكها');
    expect(Wallet.buyWithGem('side', 'egypt'), isTrue);
    expect(Wallet.gems, 0);
    expect(Wallet.gold, 100, reason: 'الجوهرة لا تمس الذهب');
    expect(Wallet.hasSide('egypt'), isTrue);
    expect(Wallet.buyWithGem('city', 'cairo'), isFalse, reason: 'نفدت الجواهر');

    expect(Wallet.survivalGold('easy', 2), 0);
    expect(Wallet.survivalGold('hard', 7), 2 * SHOP.survival['hard']!);
    expect(Wallet.survivalGold('insane', 9), 3 * SHOP.survival['insane']!);

    // العشوائي للاعب من الكلاسيكية وما اشتراه وحده
    for (var k = 0; k < 50; k++) {
      final s = randomSide(owned: true);
      expect(Wallet.hasSide(s), isTrue, reason: s);
      final r = resolveSide('random', owned: true);
      expect(r['nation'] == null || ['yemen', 'egypt'].contains(r['nation']), isTrue, reason: '$r');
    }
  });
}
