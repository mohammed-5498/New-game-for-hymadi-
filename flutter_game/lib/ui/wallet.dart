// الذهب والمشتريات (2.12.0، بطلب المستخدم: "خلنا نجرب الطريقة الثالثة ونسمح لهم بشراء الأشياء بالذهب"، GAME_SPEC 18.18):
// رصيد الذهب وما يملكه اللاعب، والأسعار من SHOP. المجاني: العصابات الكلاسيكية الأربع ومدن STORE.freeCities. ومظهر نخبة الأمة
// لا يُشترى إلا بعد عصابتها، ويُعطى مجاناً بإكمال حملتها على الصعب (story_screen.dart). والبوتات تلعب بكل شيء.
// والجوهرة (2.13.0) من الإنجازات المجنونة وحدها: تشتري أي شيء واحد مجاناً. والعروض (2.14.0) تخفض السعر وقتاً (Offers)
import 'dart:math' as math;

import 'package:flutter/material.dart' hide Text;

import '../config.dart' show SHOP, OFFERS, DAILY, RETIRED_CITIES, POTIONS, POTION_TIERS;
import '../core/cfg.dart';
import '../core/fmath.dart' show Rng;
import '../data/js_config.dart';
import '../data/rig_sprites.dart';
import '../game/state.dart';
import 'daily.dart';
import '../i18n/tr.dart';
import 'prefs.dart';
import 'widgets.dart';

// المظاهر (2.15.0): كل مظهر لوح '<أمة>_<نوع>' في RIG_SHEETS، ومعرّفه هذا الاسم نفسه (في الشراء والإعداد): elite "نخبة <الأمة>"
// (2.1.0) وoutfit الأزياء الجديدة بأسمائها (2.15.0)
const skinKinds = ['elite', 'outfit'];
final allSkins = [for (final n in nations.l('order').cast<String>()) for (final k in skinKinds) if (RIG_SHEETS.containsKey('${n}_$k')) '${n}_$k'];
String? skinKind(String side) => allSkins.contains(side) ? side.substring(side.indexOf('_') + 1) : null;
String skinNation(String skin) => skin.substring(0, skin.indexOf('_'));

class Wallet {
  static const _key = 'gangcity.wallet';
  static int gold = 0, gems = 0;
  static final owned = <String>{};   // 'city:<مدينة>' و'side:<أمة>' و'skin:<أمة>_<نوع>'
  // الجرعات (2.21.0، GAME_SPEC 18.25): ما يملكه من كل جرعة (حتى max بندرتها)، والخانات الثلاث التي تظهر في المباراة
  static final potions = <String, int>{};
  static final slots = List<String?>.filled(POTIONS.slots, null);

  static void load() {
    final w = Prefs.read(_key);
    owned.clear();
    if (w == null) { gold = SHOP.startGold; save(); return; }
    gold = (w['gold'] as num?)?.toInt() ?? 0;
    gems = (w['gems'] as num?)?.toInt() ?? 0;
    final list = w['owned'];
    if (list is List) owned.addAll(list.whereType<String>());
    potions.clear();
    slots.fillRange(0, slots.length, null);
    final pot = w['potions'], sl = w['slots'];
    if (pot is Map) { for (final e in pot.entries) { if (POTIONS.list.containsKey(e.key) && e.value is num) potions['${e.key}'] = (e.value as num).toInt(); } }
    if (sl is List) { for (var k = 0; k < slots.length && k < sl.length; k++) { if (POTIONS.list.containsKey(sl[k])) slots[k] = sl[k] as String; } }
    // مظهر النخبة كان 'skin:<أمة>' قبل الأزياء الجديدة (2.15.0)
    final old = [for (final k in owned) if (k.startsWith('skin:') && !k.contains('_')) k];
    if (old.isNotEmpty) { owned..removeAll(old)..addAll([for (final k in old) '${k}_elite']); save(); }
  }
  // ذهب التجربة (SHOP.testGold) مرة واحدة، من main.dart بعد load
  static void testGift() {
    if (SHOP.testGold <= 0 || Prefs.raw(SHOP.testGoldKey) != null) return;
    Prefs.writeRaw(SHOP.testGoldKey, '1');
    earn(SHOP.testGold);
  }
  static final changed = ValueNotifier<int>(0);   // الرصيد ظاهر في شاشات كثيرة: يُعاد رسمه مع كل تغيير (GoldChip)
  static void save() {
    Prefs.write(_key, {'gold': gold, 'gems': gems, 'owned': owned.toList(), 'potions': potions, 'slots': slots});
    changed.value++;
  }

  static bool freeCity(String c) => STORE.l('freeCities').contains(c);
  static bool freeSide(String s) => GANG_IDS.contains(s);
  static bool hasCity(String c) => freeCity(c) || owned.contains('city:$c');
  static bool hasSide(String s) => freeSide(s) || owned.contains('side:$s');   // أمة أو عصابة كلاسيكية
  static bool hasSkin(String skin) => owned.contains('skin:$skin');   // '<أمة>_<نوع>'
  static int basePrice(String kind) => kind == 'city' ? SHOP.city : kind == 'side' ? SHOP.side : SHOP.skin;
  static int price(String kind, String id) => (basePrice(kind) * (100 - Offers.percent(kind, id)) / 100).round();   // وفيه العرض

  static bool has(String kind, String id) => kind == 'city' ? hasCity(id) : kind == 'side' ? hasSide(id) : hasSkin(id);
  // لماذا لا يُشترى الآن (null: يُشترى)
  static String? blocked(String kind, String id) {
    if (has(kind, id)) return 'تملكها';
    if (kind == 'skin' && !hasSide(skinNation(id))) return 'اشترِ العصابة أولاً';
    if (gold < price(kind, id)) return 'ينقصك ${price(kind, id) - gold} ذهب';
    return null;
  }
  static bool buy(String kind, String id) {
    if (blocked(kind, id) != null) return false;
    gold -= price(kind, id);
    owned.add('$kind:$id');
    save();
    return true;
  }
  // بجوهرة: أي شيء لا تملكه (والمظهر بعد عصابته كما بالذهب)
  static bool gemBuys(String kind, String id) => gems > 0 && !has(kind, id) && !(kind == 'skin' && !hasSide(skinNation(id)));
  static bool buyWithGem(String kind, String id) {
    if (!gemBuys(kind, id)) return false;
    gems--;
    owned.add('$kind:$id');
    save();
    return true;
  }
  static void grant(String kind, String id) { owned.add('$kind:$id'); save(); }

  // --- الجرعات: تُشترى واحدة واحدة حتى حد ندرتها، وتنقص واحدة بكل استعمال ---
  static int potionCount(String id) => potions[id] ?? 0;
  static int potionMax(String id) => POTION_TIERS[POTIONS.list[id]!.tier]!.max;
  static int potionPrice(String id) => POTION_TIERS[POTIONS.list[id]!.tier]!.price;
  static String? potionBlocked(String id) {
    if (potionCount(id) >= potionMax(id)) return 'معك أقصى عدد منها (${potionMax(id)})';
    if (gold < potionPrice(id)) return 'ينقصك ${potionPrice(id) - gold} ذهب';
    return null;
  }
  static bool buyPotion(String id) {
    if (potionBlocked(id) != null) return false;
    gold -= potionPrice(id);
    potions[id] = potionCount(id) + 1;
    save();
    return true;
  }
  static void spendPotion(String id) { potions[id] = math.max(0, potionCount(id) - 1); save(); }
  // الجرعة في خانة واحدة: إن كانت في غيرها انتقلت إليها، ولمسة على خانتها تفرغها
  static void setSlot(int k, String id) {
    final was = slots[k] == id;
    for (var n = 0; n < slots.length; n++) { if (slots[n] == id) slots[n] = null; }
    if (!was) slots[k] = id;
    save();
  }
  static void earn(int n) { gold += n; save(); }

  // ذهب الفوز (2.13.0، بطلب المستخدم): بصعوبة البوتات إن كانت كلها واحدة، وmixedReward إن اختلفت، وزيادة الضباب؛ ولا شيء
  // إن لم يُحسب الفوز (Lineup.fair)
  static int matchGold(Lineup l, bool fog) {
    if (l.foes.isEmpty || !l.fair) return 0;
    return (l.uniform ? SHOP.rewards[BOT_LEVELS[l.foes.first]]! : SHOP.mixedReward) + (fog ? SHOP.fogBonus : 0);
  }
  // الصمود (ينتهي بالخسارة): لكل SHOP.survivalEvery موجات وصلتها، بصعوبة الشرطة، وجزء منه بعدد الحلفاء (survivalAllies)
  static int survivalGold(String level, int wave, [int allies = 0]) {
    final mul = SHOP.survivalAllies[math.min(allies, SHOP.survivalAllies.length - 1)];
    return (wave ~/ SHOP.survivalEvery * (SHOP.survival[level] ?? 0) * mul).floor();
  }
}

// العروض (2.14.0، بطلب المستخدم: "تخفيض لبعض الخرائط لمده يوم او 12 ساعه بنسبه 20% و 40% للعروض قصيره المده"، GAME_SPEC
// 18.18ب): من التاريخ وحده فيرى كل اللاعبين العروض نفسها: كل يوم OFFERS.dayMaps خرائط وdayGangs عصابات بـ −dayPercent% حتى منتصف
// الليل (today)، وشيء واحد (خريطة أو عصابة أو مظهر) بـ −shortPercent% يتبدل كل shortHours ساعة (flash). والمجاني لا يدخلها
class Offers {
  static DateTime Function() clock = DateTime.now;   // للفحص
  static final cities = [for (final r in REGIONS.l('order').cast<String>()) for (final c in REGIONS.m(r).l('cities').cast<String>())
      if (!RETIRED_CITIES.contains(c) && !Wallet.freeCity(c)) c];
  static final nationIds = nations.l('order').cast<String>().toList();
  static final skins = allSkins;

  static int _day(DateTime t) => DateTime.utc(t.year, t.month, t.day).difference(DateTime.utc(2026)).inDays;
  static List<(String, String)> today([DateTime? now]) {
    final r = Rng(_day(now ?? clock()) * 7919 + 17), out = <(String, String)>[];
    void take(String kind, List<String> pool, int n) {
      final left = [...pool];
      for (var k = 0; k < n && left.isNotEmpty; k++) { out.add((kind, left.removeAt(r.below(left.length)))); }
    }
    take('city', cities, OFFERS.dayMaps);
    take('side', nationIds, OFFERS.dayGangs);
    return out;
  }
  static (String, String) flash([DateTime? now]) {
    final t = now ?? clock(), r = Rng((_day(t) * 24 + t.hour ~/ OFFERS.shortHours) * 104729 + 3);
    final kind = const ['city', 'side', 'skin'][r.below(3)];
    final pool = kind == 'city' ? cities : kind == 'side' ? nationIds : skins;
    return (kind, pool[r.below(pool.length)]);
  }
  static int percent(String kind, String id, [DateTime? now]) =>
      flash(now) == (kind, id) ? OFFERS.shortPercent : today(now).contains((kind, id)) ? OFFERS.dayPercent : 0;
  static Duration dayLeft([DateTime? now]) { final t = now ?? clock(); return DateTime(t.year, t.month, t.day + 1).difference(t); }
  static Duration flashLeft([DateTime? now]) {
    final t = now ?? clock();
    return DateTime(t.year, t.month, t.day, (t.hour ~/ OFFERS.shortHours + 1) * OFFERS.shortHours).difference(t);
  }
}

// الزمن الباقي بالساعات والدقائق (العروض ومضاعف الذهب)
String hoursLeft(Duration d) => '${d.inHours}:${(d.inMinutes % 60).toString().padLeft(2, '0')}';

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
const offerColor = Color(0xFFFF8A4C);   // العروض

// الرصيد بقطعة ذهبية، والجواهر إن كانت (القائمة الرئيسية والمتجر والإنجازات)
class GoldChip extends StatelessWidget {
  final double size;
  const GoldChip({super.key, this.size = 15});
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<int>(valueListenable: Wallet.changed, builder: (_, _, _) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
    decoration: BoxDecoration(color: const Color(0xE6261E17), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0x99E2B55A))),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.monetization_on_rounded, color: gold, size: size + 3),
      const SizedBox(width: 5),
      Text('${Wallet.gold}', style: TextStyle(color: gold, fontSize: size, fontWeight: FontWeight.w800)),
      if (Daily.doubled) Container(margin: const EdgeInsetsDirectional.only(start: 6), padding: const EdgeInsets.symmetric(horizontal: 5),
          decoration: BoxDecoration(color: const Color(0xFF3E6B2A), borderRadius: BorderRadius.circular(7)),   // مضاعف الذهب يعمل
          child: Text('×${DAILY.doublerMul}', style: TextStyle(color: const Color(0xFFE4F7D6), fontSize: size * 0.75, fontWeight: FontWeight.w800))),
      if (Wallet.gems > 0) ...[
        SizedBox(width: size * 0.6),
        Icon(Icons.diamond_rounded, color: gemColor, size: size + 2),
        const SizedBox(width: 4),
        Text('${Wallet.gems}', style: TextStyle(color: gemColor, fontSize: size, fontWeight: FontWeight.w800)),
      ],
    ])));
}

// نافذة الشراء بالذهب: السعر والرصيد وما يمنع الشراء، وتعيد true إن اشترى. ومعها زر الجوهرة إن كانت عنده
Future<bool> buyDialog(BuildContext context, String kind, String id, String name, {String? note}) async {
  final block = Wallet.blocked(kind, id);
  final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
    backgroundColor: card,
    title: Text(name, style: const TextStyle(color: gold, fontSize: 18, fontWeight: FontWeight.w800)),
    content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('السعر: ${Wallet.price(kind, id)} ذهب', style: const TextStyle(color: ink, fontSize: 15)),
      if (Offers.percent(kind, id) > 0) Text('عرض بخصم ${Offers.percent(kind, id)}%: بدل ${Wallet.basePrice(kind)} ذهب',
          style: const TextStyle(color: offerColor, fontSize: 13)),
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

// --- الجرعات في الواجهة (2.21.1، الحل أ): صورة القارورة (scripts/import_potions.py من صور كانفا) على قرص داكن بلون ندرتها ---
const potionIcons = <String, IconData>{   // لجرعة لم تصل صورتها بعد
  'strength': Icons.fitness_center, 'iron': Icons.shield, 'swift': Icons.directions_run, 'heal': Icons.favorite,
  'pouch': Icons.savings, 'rush': Icons.precision_manufacturing, 'income': Icons.trending_up, 'banner': Icons.flag,
  'bribe': Icons.handshake, 'warcry': Icons.campaign, 'reinforce': Icons.groups, 'rocket': Icons.rocket_launch,
  'shield': Icons.verified_user,
};
const tierColors = {'normal': Color(0xFFB8C0C8), 'special': Color(0xFF6FA8E8), 'rare': Color(0xFFE2B55A)};
Color potionColor(String id) => tierColors[POTIONS.list[id]!.tier]!;

class PotionBadge extends StatelessWidget {
  final String id;
  final double size;
  final bool dim;   // مستعملة أو لا تملكها
  const PotionBadge(this.id, {super.key, this.size = 40, this.dim = false});
  static const _ink = Color(0xFF15110D);
  @override
  Widget build(BuildContext context) {
    final c = dim ? const Color(0xFF6E665C) : potionColor(id);
    return Container(width: size, height: size, padding: EdgeInsets.all(size * 0.1),
      decoration: BoxDecoration(shape: BoxShape.circle,
        gradient: RadialGradient(center: const Alignment(0, -0.25), colors: [Color.lerp(c, _ink, 0.62)!, Color.lerp(c, _ink, 0.86)!]),
        border: Border.all(color: dim ? const Color(0x66A0968A) : c, width: size > 50 ? 2.5 : 1.5),
        boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 3, offset: Offset(0, 1))]),
      child: Image.asset('assets/potions/$id.webp', filterQuality: FilterQuality.medium,
          color: dim ? const Color(0xFF808080) : null, colorBlendMode: dim ? BlendMode.saturation : null,   // المستعملة رمادية
          opacity: dim ? const AlwaysStoppedAnimation(0.55) : null,
          errorBuilder: (_, _, _) => FittedBox(child: Icon(potionIcons[id], color: dim ? const Color(0xFF8A8278) : c))));
  }
}
