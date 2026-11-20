// الذهب والمشتريات (2.12.0، GAME_SPEC 18.18): رصيد أول تشغيل، والشراء بالذهب ولا يتكرر، والمظهر بعد عصابته، وذهب الفوز
// بصعوبة أصعب بوت مع زيادة الضباب، والعشوائي للاعب مما يملكه
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
    expect(Wallet.hasCity('arab'), isTrue, reason: 'مدينة مجانية');
    expect(Wallet.hasCity('paris'), isFalse);
    expect(Wallet.hasSide('crows'), isTrue, reason: 'عصابة كلاسيكية');
    expect(Wallet.hasSide('yemen'), isFalse);
    expect(Wallet.blocked('skin', 'yemen'), isNotNull, reason: 'المظهر بعد عصابته');
    expect(ownsSide('yemen_elite'), isFalse);

    expect(Wallet.buy('city', 'paris'), isTrue);
    expect(Wallet.gold, SHOP.startGold - SHOP.city);
    expect(Wallet.buy('city', 'paris'), isFalse, reason: 'لا يُشترى مرتين');
    expect(Wallet.buy('side', 'yemen'), isTrue);
    expect(Wallet.buy('skin', 'yemen'), isTrue);
    expect(ownsSide('yemen_elite'), isTrue);
    expect(Wallet.gold, SHOP.startGold - SHOP.city - SHOP.side - SHOP.skin);

    Wallet.gold = 100;
    Wallet.save();
    expect(Wallet.buy('side', 'egypt'), isFalse, reason: 'الذهب لا يكفي');
    expect(Wallet.gold, 100);

    // يبقى بعد إعادة التشغيل
    Wallet.load();
    expect(Wallet.gold, 100);
    expect(Wallet.hasSide('yemen'), isTrue);

    expect(Wallet.reward('easy', false), 15);
    expect(Wallet.reward('insane', true), 140 + SHOP.fogBonus);

    // العشوائي للاعب من الكلاسيكية وما اشتراه وحده
    for (var k = 0; k < 50; k++) {
      final s = randomSide(owned: true);
      expect(Wallet.hasSide(s), isTrue, reason: s);
      final r = resolveSide('random', owned: true);
      expect(r['nation'] == null || r['nation'] == 'yemen', isTrue, reason: '$r');
    }
  });
}
