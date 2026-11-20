// المكافآت اليومية (2.14.0، بطلب المستخدم: "اضافه مكافئات يوميه لمده 30 يوم... عند دخوله يحصل على 50 ذهب الا في كل 7 يوم يحصل
// فيه على 100 ذهب ومضاعف للذهب لمده 12 ساعه وفي اليوم ال30 يحصل على مظهر وخريطه وعصابه مجانا عشوائيا وفي حاله اعطائه اي من هذه
// الجوائز وهي عنده سابقاً يتم تعويضه بنفس قيمه"، وجوابه: "اذا اللاعب فوت يوم يكمل من اليوم اللي وقف عنده ما يخسر التقدم ولما يخلص
// التقويم كامل تعاد الجوائز من جديد"، GAME_SPEC 18.18ب): مكافأة واحدة لكل تاريخ في الجوال، والأرقام في DAILY. والمضاعف لذهب
// المباريات والصمود وحده (match_screen.dart)
import 'dart:math' as math;

import 'package:flutter/material.dart' hide Text;

import '../audio/sound.dart';
import '../config.dart' show DAILY;
import '../core/cfg.dart';
import '../data/js_config.dart';
import '../i18n/tr.dart';
import 'menus.dart' show cityShort, sideName;
import 'prefs.dart';
import 'wallet.dart';
import 'widgets.dart';

class Daily {
  static const _key = 'gangcity.daily';
  static int day = 0;            // آخر يوم استُلم من التقويم (0 قبل أوله)
  static String last = '';       // تاريخ آخر استلام
  static int doublerUntil = 0;   // نهاية مضاعف الذهب (ملي ثانية منذ 1970)
  static DateTime Function() clock = DateTime.now;   // للفحص

  static void load() {
    final j = Prefs.read(_key);
    day = (j?['day'] as num?)?.toInt() ?? 0;
    last = j?['last'] as String? ?? '';
    doublerUntil = (j?['doubler'] as num?)?.toInt() ?? 0;
  }
  static void save() => Prefs.write(_key, {'day': day, 'last': last, 'doubler': doublerUntil});

  static String _date(DateTime t) => '${t.year}-${t.month}-${t.day}';
  static bool get ready => last != _date(clock());
  static int get next => day % DAILY.days + 1;
  static bool weekly(int d) => d % DAILY.every == 0 && d < DAILY.days;
  static Duration get doublerLeft => Duration(milliseconds: math.max(0, doublerUntil - clock().millisecondsSinceEpoch));
  static bool get doubled => doublerLeft > Duration.zero;

  // مكافأة اليوم التالي من التقويم إن لم تُستلم اليوم، وما أعطته سطوراً
  static List<String> claim([math.Random? rng]) {
    if (!ready) return const [];
    final d = next, now = clock(), out = <String>[];
    if (d == DAILY.days) {
      out.addAll(_grand(rng ?? math.Random()));
    } else if (weekly(d)) {
      Wallet.earn(DAILY.weekGold);
      doublerUntil = now.add(Duration(hours: DAILY.doublerHours)).millisecondsSinceEpoch;
      out..add('+${DAILY.weekGold} ذهب')..add('مضاعف الذهب ${DAILY.doublerHours} ساعة');
    } else {
      Wallet.earn(DAILY.gold);
      out.add('+${DAILY.gold} ذهب');
    }
    day = d;
    last = _date(now);
    save();
    return out;
  }

  // اليوم الأخير: عصابة، ثم مظهر من عصابة تملكها (فيُلبس)، ثم خريطة، وما تملكه منها ذهب بسعره الأصلي
  static List<String> _grand(math.Random r) {
    final out = <String>[];
    void give(String kind, String id, String name) {
      if (Wallet.has(kind, id)) {
        Wallet.earn(Wallet.basePrice(kind));
        out.add('$name عندك: +${Wallet.basePrice(kind)} ذهب بدلها');
      } else {
        Wallet.grant(kind, id);
        out.add(kind == 'city' ? 'خريطة جديدة: $name' : kind == 'side' ? 'عصابة جديدة: $name' : 'مظهر جديد: $name');
      }
    }
    final gang = Offers.nationIds[r.nextInt(Offers.nationIds.length)];
    give('side', gang, nations.m(gang).s('gangName'));
    final mine = [for (final s in Offers.skins) if (Wallet.hasSide(skinNation(s))) s], pool = mine.isEmpty ? Offers.skins : mine;
    final skin = pool[r.nextInt(pool.length)];
    give('skin', skin, sideName(skin));
    final city = Offers.cities[r.nextInt(Offers.cities.length)];
    give('city', city, cityShort(city));
    return out;
  }
}

// ألوان خانة اليوم: العادي برونزي، والسابع فضي بمضاعف، والأخير وردي بجوائزه الثلاث
typedef _Look = ({List<Color> bg, Color edge, IconData icon, Color ink});
const _Look _dayLook = (bg: [Color(0xFF4A3220), Color(0xFF21160E)], edge: Color(0xFFC98A52), icon: Icons.monetization_on_rounded, ink: gold);
const _Look _weekLook = (bg: [Color(0xFF34404D), Color(0xFF141A20)], edge: Color(0xFFCBD5DF), icon: Icons.savings_rounded, ink: Color(0xFFF2F6FA));
const _Look _lastLook = (bg: [Color(0xFF5E1040), Color(0xFF1A0818)], edge: gemColor, icon: Icons.card_giftcard_rounded, ink: Color(0xFFFFD8EC));

class DailyScreen extends StatefulWidget {
  const DailyScreen({super.key});
  @override
  State<DailyScreen> createState() => _DailyScreenState();
}

class _DailyScreenState extends State<DailyScreen> {
  void _claim() {
    final got = Daily.claim(), d = Daily.day;
    if (got.isEmpty) return;
    sound('capture_special');
    setState(() {});
    showDialog<void>(context: context, builder: (ctx) => AlertDialog(
      backgroundColor: card,
      title: Text('مكافأة اليوم $d', style: const TextStyle(color: gold, fontSize: 18, fontWeight: FontWeight.w800)),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (final line in got) Padding(padding: const EdgeInsets.only(bottom: 4),
            child: Text(line, style: const TextStyle(color: ink, fontSize: 15, fontWeight: FontWeight.w700))),
        const SizedBox(height: 4),
        Text(d == DAILY.days ? 'اكتمل التقويم: يبدأ من أوله غداً' : 'عُد غداً لمكافأة اليوم ${Daily.next}', style: const TextStyle(color: dim, fontSize: 12.5)),
      ]),
      actions: [WideButton('حسناً', () => Navigator.pop(ctx), primary: true, width: 130)],
    ));
  }

  @override
  Widget build(BuildContext context) {
    final ready = Daily.ready;
    return Scaffold(body: DecoratedBox(
      decoration: const BoxDecoration(gradient: RadialGradient(center: Alignment(0.35, -0.5), radius: 1.35,
          colors: [Color(0xFF3B2D1D), Color(0xFF120E0A)])),
      child: SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(12, 8, 12, 10), child: Column(children: [
        Row(children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(shape: BoxShape.circle, gradient: goldGrad,
              border: Border.all(color: const Color(0xFFFFE6A8))),
              child: const Icon(Icons.calendar_month_rounded, size: 20, color: Color(0xFF2A1A08))),
          const SizedBox(width: 10),
          const GoldTitle('المكافآت اليومية', size: 26),
          const SizedBox(width: 14),
          Expanded(child: Text(ready ? 'مكافأة اليوم ${Daily.next} جاهزة' : 'عُد غداً لمكافأة اليوم ${Daily.next}', maxLines: 1,
              overflow: TextOverflow.ellipsis, style: TextStyle(color: ready ? gold : dim, fontSize: 14))),
          const SizedBox(width: 10),
          const GoldChip(size: 16),
          const SizedBox(width: 10),
          Pill(Icons.arrow_back_rounded, 'رجوع', on: false, onTap: () => Navigator.pop(context)),
        ]),
        const SizedBox(height: 10),
        Expanded(child: LayoutBuilder(builder: (_, c) {
          const cols = 10, gap = 8.0;
          final rows = (DAILY.days / cols).ceil(), w = (c.maxWidth - gap * (cols - 1)) / cols, h = (c.maxHeight - gap * (rows - 1)) / rows;
          return GridView.count(crossAxisCount: cols, mainAxisSpacing: gap, crossAxisSpacing: gap, childAspectRatio: w / h,
              physics: const NeverScrollableScrollPhysics(), children: [for (var d = 1; d <= DAILY.days; d++) _DayCell(d, ready)]);
        })),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            if (Daily.doubled) Text('مضاعف الذهب يعمل: ذهب المباريات ×${DAILY.doublerMul} • باقي ${hoursLeft(Daily.doublerLeft)}',
                style: const TextStyle(color: Color(0xFF9FD07C), fontSize: 13, fontWeight: FontWeight.w700)),
            Text('كل يوم ${DAILY.gold} ذهباً، وكل سابع يوم ${DAILY.weekGold} ومضاعف الذهب ${DAILY.doublerHours} ساعة، واليوم الأخير عصابة ومظهر وخريطة (وما تملكه منها بسعره ذهباً). إن فاتك يوم تكمل من حيث توقفت، وبعد اليوم الأخير يبدأ التقويم من أوله.',
                style: const TextStyle(color: dim, fontSize: 12, height: 1.35)),
          ])),
          const SizedBox(width: 12),
          WideButton(ready ? 'استلم مكافأة اليوم' : 'استلمتها اليوم', ready ? _claim : null, primary: true, width: 210),
        ]),
      ]))),
    ));
  }
}

// خانة يوم: رقمه وجائزته، والمستلم بعلامة، والتالي يلمع إن كان جاهزاً
class _DayCell extends StatelessWidget {
  final int d;
  final bool ready;
  const _DayCell(this.d, this.ready);
  @override
  Widget build(BuildContext context) {
    final look = d == DAILY.days ? _lastLook : Daily.weekly(d) ? _weekLook : _dayLook;
    final taken = d <= Daily.day, now = d == Daily.next && ready;
    final reward = d == DAILY.days ? '3 جوائز' : Daily.weekly(d) ? '${DAILY.weekGold} ×${DAILY.doublerMul}' : '${DAILY.gold}';
    return Container(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(12),
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: look.bg),
          border: Border.all(color: now ? gold : look.edge.withValues(alpha: taken ? 0.25 : 0.6), width: now ? 2.5 : 1.2),
          boxShadow: [now ? const BoxShadow(color: Color(0x99E2B55A), blurRadius: 14) : const BoxShadow(color: Color(0x66000000), blurRadius: 5, offset: Offset(0, 2))]),
      child: Stack(alignment: Alignment.center, children: [
        Column(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
          Text(now ? 'اليوم' : 'اليوم $d', style: TextStyle(color: now ? gold : look.ink.withValues(alpha: taken ? 0.4 : 0.85),
              fontSize: 11.5, fontWeight: FontWeight.w700)),
          Icon(look.icon, size: d == DAILY.days ? 30 : 24, color: look.ink.withValues(alpha: taken ? 0.3 : 1)),
          Text(reward, style: TextStyle(color: look.ink.withValues(alpha: taken ? 0.4 : 1), fontSize: 12, fontWeight: FontWeight.w800)),
        ]),
        if (taken) const Icon(Icons.check_circle_rounded, size: 26, color: Color(0xFF8FD06A)),
      ]),
    );
  }
}
