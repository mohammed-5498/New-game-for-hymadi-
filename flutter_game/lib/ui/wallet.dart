// الذهب والمشتريات (2.12.0، بطلب المستخدم: "خلنا نجرب الطريقة الثالثة ونسمح لهم بشراء الأشياء بالذهب"، GAME_SPEC 18.18):
// رصيد الذهب وما يملكه اللاعب، والأسعار من SHOP. المجاني: العصابات الكلاسيكية الأربع ومدن STORE.freeCities. ومظهر نخبة الأمة
// لا يُشترى إلا بعد عصابتها، ويُعطى مجاناً بإكمال حملتها على الصعب (story_screen.dart). والبوتات تلعب بكل شيء
import 'package:flutter/material.dart' hide Text;

import '../config.dart' show SHOP;
import '../core/cfg.dart';
import '../data/js_config.dart';
import '../i18n/tr.dart';
import 'prefs.dart';
import 'widgets.dart';

class Wallet {
  static const _key = 'gangcity.wallet';
  static int gold = 0;
  static final owned = <String>{};   // 'city:<مدينة>' و'side:<أمة>' و'skin:<أمة>'

  static void load() {
    final w = Prefs.read(_key);
    owned.clear();
    if (w == null) { gold = SHOP.startGold; save(); return; }
    gold = (w['gold'] as num?)?.toInt() ?? 0;
    final list = w['owned'];
    if (list is List) owned.addAll(list.whereType<String>());
  }
  static void save() => Prefs.write(_key, {'gold': gold, 'owned': owned.toList()});

  static bool freeCity(String c) => STORE.l('freeCities').contains(c);
  static bool freeSide(String s) => GANG_IDS.contains(s);
  static bool hasCity(String c) => freeCity(c) || owned.contains('city:$c');
  static bool hasSide(String s) => freeSide(s) || owned.contains('side:$s');   // أمة أو عصابة كلاسيكية
  static bool hasSkin(String nation) => owned.contains('skin:$nation');
  static int price(String kind) => kind == 'city' ? SHOP.city : kind == 'side' ? SHOP.side : SHOP.skin;

  static bool has(String kind, String id) => kind == 'city' ? hasCity(id) : kind == 'side' ? hasSide(id) : hasSkin(id);
  // لماذا لا يُشترى الآن (null: يُشترى)
  static String? blocked(String kind, String id) {
    if (has(kind, id)) return 'تملكها';
    if (kind == 'skin' && !hasSide(id)) return 'اشترِ العصابة أولاً';
    if (gold < price(kind)) return 'ينقصك ${price(kind) - gold} ذهب';
    return null;
  }
  static bool buy(String kind, String id) {
    if (blocked(kind, id) != null) return false;
    gold -= price(kind);
    owned.add('$kind:$id');
    save();
    return true;
  }
  static void grant(String kind, String id) { owned.add('$kind:$id'); save(); }
  static void earn(int n) { gold += n; save(); }

  // ذهب الفوز على البوتات: بصعوبة أصعب بوت عدو، وزيادة ضباب الحرب
  static int reward(String difficulty, bool fog) => (SHOP.rewards[difficulty] ?? 0) + (fog ? SHOP.fogBonus : 0);
}

// الرصيد بقطعة ذهبية (القائمة الرئيسية والمتجر)
class GoldChip extends StatelessWidget {
  final double size;
  const GoldChip({super.key, this.size = 15});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
    decoration: BoxDecoration(color: const Color(0xE6261E17), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0x99E2B55A))),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.monetization_on_rounded, color: gold, size: size + 3),
      const SizedBox(width: 5),
      Text('${Wallet.gold}', style: TextStyle(color: gold, fontSize: size, fontWeight: FontWeight.w800)),
    ]));
}

// نافذة الشراء بالذهب: السعر والرصيد وما يمنع الشراء، وتعيد true إن اشترى
Future<bool> buyDialog(BuildContext context, String kind, String id, String name, {String? note}) async {
  final block = Wallet.blocked(kind, id);
  final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
    backgroundColor: card,
    title: Text(name, style: const TextStyle(color: gold, fontSize: 18, fontWeight: FontWeight.w800)),
    content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('السعر: ${Wallet.price(kind)} ذهب', style: const TextStyle(color: ink, fontSize: 15)),
      Text('رصيدك: ${Wallet.gold} ذهب', style: const TextStyle(color: dim, fontSize: 13)),
      if (note != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(note, style: const TextStyle(color: dim, fontSize: 12.5))),
      if (block != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(block, style: const TextStyle(color: danger, fontSize: 13))),
    ]),
    actions: [
      WideButton('شراء', block == null ? () => Navigator.pop(ctx, Wallet.buy(kind, id)) : null, primary: true, width: 130),
      WideButton('إلغاء', () => Navigator.pop(ctx, false), ghost: true, width: 110),
    ],
  ));
  return ok == true;
}
