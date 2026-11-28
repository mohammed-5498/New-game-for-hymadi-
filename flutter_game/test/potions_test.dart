// الجرعات (2.21.0، GAME_SPEC 18.25): الشراء بسعر الندرة وحدها، والخانات، وأثر كل جرعة في المباراة ومرة واحدة لكل لاعب، والحفظ
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/config.dart' show POTIONS, POTION_TIERS;
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/game/combat.dart' show isEnemyId;
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/potions.dart';
import 'package:gangcity/game/save.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/ui/prefs.dart';
import 'package:gangcity/ui/wallet.dart';
import 'package:shared_preferences/shared_preferences.dart';

Map<String, Object?> _bot(int k) => {'name': 'بوت $k', 'gang': ['crows', 'hammers', 'vipers', 'scorpions'][k], 'nation': null,
  'color': ['blue', 'red', 'green', 'yellow'][k], 'isHuman': false, 'team': 0, 'difficulty': 'medium'};

MatchState _match() {
  simRng = Rng(5);
  return createMatch((jsonDecode(jsonEncode({'mode': 'conquest', 'city': 'arab', 'mapSize': 'small', 'maxUnits': 50, 'weather': 'day',
    'players': [_bot(0), _bot(1), _bot(2), _bot(3)]})) as Map).cast<String, Object?>())..running = true..seed = 5;   // الحفظ يعيد الخريطة من بذرتها
}

void _run(MatchState s, double seconds) { for (var t = 0.0; t < seconds; t += 0.05) { updateMatch(s); } }
List<Unit> _mine(MatchState s, int pid) => [for (final u in s.units) if (u.playerId == pid && u.state != 'dead' && u.hp > 0) u];

void main() {
  test('الشراء بسعر الندرة حتى حدها، والخانات', () async {
    SharedPreferences.setMockInitialValues({});
    await Prefs.init();
    Wallet.load();
    Wallet.gold = 1000;
    for (final e in POTIONS.list.entries) {
      final tier = POTION_TIERS[e.value.tier]!;
      expect(Wallet.potionPrice(e.key), {'normal': 10, 'special': 25, 'rare': 50}[e.value.tier]);
      for (var k = 0; k < tier.max; k++) { expect(Wallet.buyPotion(e.key), isTrue); }
      expect(Wallet.buyPotion(e.key), isFalse, reason: '${e.key}: لا أكثر من ${tier.max}');
      expect(Wallet.potionCount(e.key), {'normal': 5, 'special': 3, 'rare': 1}[e.value.tier]);
    }
    expect(Wallet.gold, 1000 - 5 * 5 * 10 - 4 * 3 * 25 - 4 * 50);
    Wallet.spendPotion('strength');
    expect(Wallet.potionCount('strength'), 4);
    Wallet.setSlot(0, 'strength');
    Wallet.setSlot(1, 'rocket');
    Wallet.setSlot(2, 'strength');   // تنتقل من الأولى إلى الثالثة
    expect(Wallet.slots, [null, 'rocket', 'strength']);
    Wallet.setSlot(1, 'rocket');     // ولمسة على خانتها تفرغها
    expect(Wallet.slots, [null, null, 'strength']);
    Wallet.load();                   // محفوظة
    expect(Wallet.potionCount('strength'), 4);
    expect(Wallet.slots, [null, null, 'strength']);
  });

  test('أثر كل جرعة، ومرة واحدة في المباراة، وتبقى مع الحفظ', () {
    final s = _match();
    _run(s, 20);
    const me = 0, t0 = 20.0;
    final pts = s.empire!.points[me];
    for (final id in ['strength', 'iron', 'swift', 'rush', 'income', 'banner', 'bribe', 'pouch', 'warcry']) {
      expect(usePotion(s, me, id, -1).ok, isTrue, reason: id);
      expect(usePotion(s, me, id, -1).ok, isFalse, reason: '$id: مرة واحدة');
    }
    expect(s.empire!.points[me], pts + 60);
    expect(potionDamage(s, me), closeTo(0.2 + 0.3, 1e-9));
    expect(potionDamage(s, 1), 0);
    expect(potionTaken(s, me), closeTo(0.8, 1e-9));
    expect(potionSpeed(s, me), closeTo(1.3, 1e-9));
    expect([potionRush(s, me), potionIncome(s, me), potionCapture(s, me)], [2, 2, 2]);
    final police = s.players.indexWhere((p) => p.gang == 'police');
    expect(isEnemyId(s, police, me), isFalse);
    expect(isEnemyId(s, police, 1), isTrue);
    // العلاج والدرع على الجنود الحاليين، والتعزيزات خمسة يرحلون بعد 60 ث، والصاروخ ينفجر بعد 3 ث
    final hurt = _mine(s, me).first..hp = 10;
    expect(usePotion(s, me, 'heal', -1).ok, isTrue);
    expect(hurt.hp, closeTo(10 + hurt.maxHp * 0.4, 1e-6));
    expect(usePotion(s, me, 'shield', -1).ok, isTrue);
    expect(_mine(s, me).every((u) => u.invulnUntil >= s.time + 5 - 1e-9), isTrue);
    final before = _mine(s, me).length;
    expect(usePotion(s, me, 'reinforce', -1).ok, isTrue);
    expect(_mine(s, me).length, before + 5);
    final foe = s.map.districts.firstWhere((d) => d.capture != null && d.owner != me);
    expect(usePotion(s, me, 'rocket', -1).ok, isFalse, reason: 'الصاروخ يحتاج حياً');
    expect(usePotion(s, me, 'rocket', foe.id).ok, isTrue);
    expect(s.fireworks.last.owner, me);
    expect(s.fireworks.last.damage, 80);
    // الحفظ والعودة: ما استُعمل وما بقي من أثره
    final back = decodeMatch(encodeMatch(s));
    expect(back.potions!.used[me], s.potions!.used[me]);
    expect(back.potions!.until[me], s.potions!.until[me]);
    expect(usePotion(back, me, 'strength', -1).ok, isFalse);
    _run(s, 4);
    expect(s.fireworks.where((f) => f.owner == me).every((f) => f.done), isTrue);
    _run(s, 58);
    expect(s.time, greaterThan(t0 + 61));
    expect(potionDamage(s, me), 0);
    expect(isEnemyId(s, police, me), isTrue);
    expect(s.units.where((u) => u.playerId == me && u.expireAt > 0 && u.state != 'dead'), isEmpty, reason: 'رحلت التعزيزات');
  });
}
