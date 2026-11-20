// الذهب والمشتريات (2.12.0، بطلب المستخدم: "خلنا نجرب الطريقة الثالثة ونسمح لهم بشراء الأشياء بالذهب"، GAME_SPEC 18.18):
// رصيد الذهب وما يملكه اللاعب، والأسعار من SHOP. المجاني: العصابات الكلاسيكية الأربع ومدن STORE.freeCities. ومظهر نخبة الأمة
// لا يُشترى إلا بعد عصابتها، ويُعطى مجاناً بإكمال حملتها على الصعب (story_screen.dart). والبوتات تلعب بكل شيء.
// والجوهرة (2.13.0) من الإنجازات المجنونة وحدها: تشتري أي شيء واحد مجاناً
import 'dart:math' as math;

import 'package:flutter/material.dart' hide Text;

import '../config.dart' show SHOP;
import '../core/cfg.dart';
import '../data/js_config.dart';
import '../game/state.dart';
import '../i18n/tr.dart';
import 'prefs.dart';
import 'widgets.dart';

class Wallet {
  static const _key = 'gangcity.wallet';
  static int gold = 0, gems = 0;
  static final owned = <String>{};   // 'city:<مدينة>' و'side:<أمة>' و'skin:<أمة>'

  static void load() {
    final w = Prefs.read(_key);
    owned.clear();
    if (w == null) { gold = SHOP.startGold; save(); return; }
    gold = (w['gold'] as num?)?.toInt() ?? 0;
    gems = (w['gems'] as num?)?.toInt() ?? 0;
    final list = w['owned'];
    if (list is List) owned.addAll(list.whereType<String>());
  }
  static void save() => Prefs.write(_key, {'gold': gold, 'gems': gems, 'owned': owned.toList()});

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
  // بجوهرة: أي شيء لا تملكه (والمظهر بعد عصابته كما بالذهب)
  static bool gemBuys(String kind, String id) => gems > 0 && !has(kind, id) && !(kind == 'skin' && !hasSide(id));
  static bool buyWithGem(String kind, String id) {
    if (!gemBuys(kind, id)) return false;
    gems--;
    owned.add('$kind:$id');
    save();
    return true;
  }
  static void grant(String kind, String id) { owned.add('$kind:$id'); save(); }
  static void earn(int n) { gold += n; save(); }

  // ذهب الفوز (2.13.0، بطلب المستخدم): بصعوبة البوتات إن كانت كلها واحدة، وmixedReward إن اختلفت، وزيادة الضباب؛ ولا شيء
  // إن لم يُحسب الفوز (Lineup.fair)
  static int matchGold(Lineup l, bool fog) {
    if (l.foes.isEmpty || !l.fair) return 0;
    return (l.uniform ? SHOP.rewards[BOT_LEVELS[l.foes.first]]! : SHOP.mixedReward) + (fog ? SHOP.fogBonus : 0);
  }
  // الصمود (ينتهي بالخسارة): لكل SHOP.survivalEvery موجات وصلتها، بصعوبة الشرطة
  static int survivalGold(String level, int wave) => wave ~/ SHOP.survivalEvery * (SHOP.survival[level] ?? 0);
}

// البوتات في مباراة اللاعب (2.13.0): درجات صعوبة حلفائه وأعدائه (موضعها في BOT_LEVELS)، وهل يُحسب فوزه للذهب والإنجازات:
// بلا حلفاء دائماً، ومعهم إن كان في الأعداء فريق بعدد فريقه على الأقل وكل بوتاته بصعوبة أقوى حلفائه أو أصعب (بطلب المستخدم:
// "اذا كان يلعب وحلفائه اكثر من المنافسين لا تحسب له جائزه الا اذا كانوا متساويين اقل شيء فريق منافس واحد مساوي له بالعدد
// و مستوى صعوبه حليفه"). الشرطة وأطراف المزايا والقصة المحايدة خارجها، والبوت بلا فريق فريق وحده
class Lineup {
  final List<int> allies, foes;
  final bool fair;
  const Lineup(this.allies, this.foes, this.fair);
  int get weakestFoe => foes.isEmpty ? -1 : foes.reduce(math.min);
  bool get uniform => {...allies, ...foes}.length == 1;
}

Lineup lineupOf(MatchState s) {
  final me = s.players[s.humanId];
  final allies = <int>[], foes = <int>[], sides = <Object, List<int>>{};
  for (final p in s.players) {
    if (p.id == me.id || p.neutral || p.passive || p.feature != null || p.storyRole != null) continue;
    final level = BOT_LEVELS.indexOf(p.difficulty);
    if (me.team != 0 && p.team == me.team) { allies.add(level); continue; }
    foes.add(level);
    (sides[p.team == 0 ? 'solo${p.id}' : p.team] ??= []).add(level);
  }
  final strongest = allies.isEmpty ? -1 : allies.reduce(math.max);
  return Lineup(allies, foes, allies.isEmpty || sides.values.any((side) => side.length > allies.length && side.reduce(math.min) >= strongest));
}

const gemColor = Color(0xFFFF7BB0);   // الجوهرة ودرجة الإنجازات المجنونة

// الرصيد بقطعة ذهبية، والجواهر إن كانت (القائمة الرئيسية والمتجر والإنجازات)
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
      if (Wallet.gems > 0) ...[
        SizedBox(width: size * 0.6),
        Icon(Icons.diamond_rounded, color: gemColor, size: size + 2),
        const SizedBox(width: 4),
        Text('${Wallet.gems}', style: TextStyle(color: gemColor, fontSize: size, fontWeight: FontWeight.w800)),
      ],
    ]));
}

// نافذة الشراء بالذهب: السعر والرصيد وما يمنع الشراء، وتعيد true إن اشترى. ومعها زر الجوهرة إن كانت عنده
Future<bool> buyDialog(BuildContext context, String kind, String id, String name, {String? note}) async {
  final block = Wallet.blocked(kind, id);
  final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
    backgroundColor: card,
    title: Text(name, style: const TextStyle(color: gold, fontSize: 18, fontWeight: FontWeight.w800)),
    content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('السعر: ${Wallet.price(kind)} ذهب', style: const TextStyle(color: ink, fontSize: 15)),
      Text('رصيدك: ${Wallet.gold} ذهب', style: const TextStyle(color: dim, fontSize: 13)),
      if (Wallet.gems > 0) Text('جواهرك: ${Wallet.gems} (الجوهرة تشتري أي شيء واحد مجاناً)', style: const TextStyle(color: gemColor, fontSize: 13)),
      if (note != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(note, style: const TextStyle(color: dim, fontSize: 12.5))),
      if (block != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(block, style: const TextStyle(color: danger, fontSize: 13))),
    ]),
    actions: [
      WideButton('شراء', block == null ? () => Navigator.pop(ctx, Wallet.buy(kind, id)) : null, primary: true, width: 130),
      if (Wallet.gemBuys(kind, id)) WideButton('بجوهرة', () => Navigator.pop(ctx, Wallet.buyWithGem(kind, id)), width: 120),
      WideButton('إلغاء', () => Navigator.pop(ctx, false), ghost: true, width: 110),
    ],
  ));
  return ok == true;
}
