// القوائم (js/ui/menus.js وpicker.js وstoreScreen.js، القسم 12): الرئيسية بخلفية مدينة حية، والإعداد بخاناته ولوحاته،
// والإعدادات، والإحصائيات، والمتجر. الصور المصغرة من اللعبة الحالية نفسها (assets/thumbs، scripts/export_thumbs.cjs)
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart' hide Text;
import 'package:flutter/scheduler.dart';

import '../i18n/tr.dart';
import '../core/cfg.dart';
import '../config.dart' show PACE, RETIRED_CITIES, OFFERS;
import '../core/fmath.dart';
import '../data/campaigns.dart';
import '../data/cities.dart';
import '../data/js_config.dart';
import '../map/generator.dart';
import '../render/city_art.dart';
import '../render/city_layer.dart';
import '../audio/sound.dart';
import '../game/match.dart';
import '../game/state.dart';
import '../net/session.dart';
import 'achievements.dart';
import 'lan_screen.dart';
import 'migrate.dart' show migrated;
import 'match_screen.dart';
import 'crash_report.dart';
import 'daily.dart';
import 'prefs.dart';
import 'showcase.dart';
import 'story_screen.dart';
import 'wallet.dart';
import 'widgets.dart';

// ===================== إعداد المباراة =====================
const _slotTypes = {'human': 'أنت', 'bot': 'بوت', 'closed': 'مغلقة', 'net': 'صديق'};
const _maxSlots = 8;
List<String> get _gangIds => [for (final g in GANG_IDS) g as String];
List<String> get _colorIds => [for (final c in PLAYER_COLORS) (c as J).s('id')];
String colorHex(String id) => (PLAYER_COLORS.firstWhere((c) => (c as J)['id'] == id) as J).s('hex');

class Slot {
  String type, side, color, difficulty;
  int team;
  int? peer;                     // اللعب المحلي: رقم اتصال الصديق صاحب الخانة
  String name = '', was = 'closed';
  Slot(this.type, this.side, this.color, this.team, this.difficulty);
  Map<String, Object?> toJson() => {'type': type, 'side': side, 'color': color, 'team': team, 'difficulty': difficulty};
}

final J _GM = gameModes;

class SetupModel {
  String mode = _GM.s('defaultMode'), city = CITIES.s('defaultCity'), mapSize = MATCH_DEFAULTS.s('mapSize'), weather = 'day';
  int maxUnits = UNITS.i('maxUnitsDefault');
  bool fog = true;                     // ضباب الحرب (2.0.5)
  int pointsMinutes = _GM.m('points').i('defaultMinutes'), kingMinutes = _GM.m('king').i('defaultHoldMinutes');
  int allies = _GM.m('survival').i('defaultAllies');
  String survivalLevel = _GM.m('survival').s('defaultLevel');
  List<Slot> slots = [
    for (var k = 0; k < _maxSlots; k++)
      Slot(k == 0 ? 'human' : k < 4 ? 'bot' : 'closed', _gangIds[k % 4], _colorIds[k], 0, 'medium'),
  ];

  static SetupModel load() {
    final m = SetupModel(), j = Prefs.read(UI.s('setupKey'));
    if (j == null) return m;
    if (_GM.l('order').contains(j['mode'])) m.mode = j['mode'] as String;
    if (_GM.m('points').l('minutes').contains(j['pointsMinutes'])) m.pointsMinutes = j['pointsMinutes'] as int;
    if (_GM.m('king').l('holdMinutes').contains(j['kingMinutes'])) m.kingMinutes = j['kingMinutes'] as int;
    if (_GM.m('survival').l('allies').contains(j['allies'])) m.allies = j['allies'] as int;
    if (_GM.m('survival').l('levels').contains(j['survivalLevel'])) m.survivalLevel = j['survivalLevel'] as String;
    if (playableCities.contains(j['city']) || j['city'] == 'random' || j['city'] == 'host') m.city = j['city'] as String;
    if (MAP_SIZES.has('${j['mapSize']}')) m.mapSize = j['mapSize'] as String;
    if (UNITS.l('maxUnitsChoices').contains(j['maxUnits'])) m.maxUnits = j['maxUnits'] as int;
    if (WEATHER_KEYS.contains(j['weather']) || j['weather'] == 'random') m.weather = j['weather'] as String;
    if (j['fog'] is bool) m.fog = j['fog'] as bool;
    final sl = j['slots'];
    if (sl is List && sl.length == _maxSlots) {
      for (var k = 0; k < _maxSlots; k++) {
        final x = sl[k];
        if (x is! Map) continue;
        final s = m.slots[k];
        if (k > 0 && (x['type'] == 'bot' || x['type'] == 'closed')) s.type = x['type'] as String;
        if (_sides.contains(x['side'])) s.side = x['side'] as String;
        if (_colorIds.contains(x['color'])) s.color = x['color'] as String;
        if (x['team'] is int && (x['team'] as int) >= 0 && (x['team'] as int) <= 4) s.team = x['team'] as int;
        if (BOT_LEVELS.contains(x['difficulty'])) s.difficulty = x['difficulty'] as String;
      }
    }
    // ما لم يعد يملكه (كان كل شيء مفتوحاً قبل 2.12.0): عشوائي مما يملكه
    if (!ownsSide(m.slots[0].side)) m.slots[0].side = 'random';
    if (m.city != 'random' && m.city != 'host' && !Wallet.hasCity(m.city)) m.city = 'random';
    return m;
  }

  void save() => Prefs.write(UI.s('setupKey'), {'mode': mode, 'pointsMinutes': pointsMinutes, 'kingMinutes': kingMinutes, 'allies': allies,
    'survivalLevel': survivalLevel, 'city': city, 'mapSize': mapSize, 'maxUnits': maxUnits, 'weather': weather, 'fog': fog, 'slots': [for (final s in slots) s.toJson()]});

  int get limit => MAP_SIZES.m(mapSize).i('maxPlayers');
  bool get survival => mode == 'survival';
  // الصمود: خانتك ثم الحلفاء من الخانات التالية بعددهم
  List<Slot> get active => survival ? slots.sublist(0, 1 + allies) : slots.where((s) => s.type != 'closed').toList();

  String? validate() {
    final a = active, size = MAP_SIZES.m(mapSize).s('name');
    if (survival) {
      if (1 + allies > limit) return 'أنت و$allies حلفاء أكثر من حد الخريطة $size ($limit). قلّل الحلفاء أو كبّر الخريطة.';
      if ({for (final s in a) s.color}.length != a.length) return 'لا يمكن أن يتكرر اللون بين لاعبين.';
      return null;
    }
    if (a.length < 2) return 'تحتاج لاعبَين على الأقل: افتح خانة بوت واحدة على الأقل.';
    if (a.length > limit) return 'عدد اللاعبين ${a.length} أكبر من حد الخريطة $size ($limit). أغلق خانة أو كبّر الخريطة.';
    final sides = {for (var k = 0; k < a.length; k++) a[k].team == 0 ? 'solo$k' : 'team${a[k].team}'};
    if (sides.length < 2) return 'كل اللاعبين في فريق واحد: غيّر فريق أحدهم ليكون هناك عدو.';
    if ({for (final s in a) s.color}.length != a.length) return 'لا يمكن أن يتكرر اللون بين لاعبين.';
    return null;
  }

  J build({String? host}) {
    final a = active;
    // اللعب المحلي: كل صديق لاعب حقيقي على جهازه، وإن غادر يقوده بوت متوسط
    final players = [
      for (var k = 0; k < a.length; k++)
        {'name': k == 0 ? host ?? 'أنت' : a[k].type == 'net' ? a[k].name : 'بوت $k', ...resolveSide(a[k].side, owned: k == 0), 'color': a[k].color,
          'isHuman': k == 0 || a[k].type == 'net', 'team': survival ? 1 : a[k].team, 'difficulty': a[k].type == 'net' ? 'medium' : a[k].difficulty},
    ];
    return {
      'mode': mode,
      'modeOptions': {'minutes': pointsMinutes, 'holdMinutes': kingMinutes, 'allies': allies, 'level': survivalLevel},
      'mapSize': mapSize,
      // مدينة المضيف: مدينة أمة اللاعب الأول بعد حسم العشوائي، أو عشوائي للعصابة الكلاسيكية
      'city': _concrete(city == 'host' ? hostCity(players[0]['nation'] as String?) : city),
      'maxUnits': maxUnits, 'players': players, 'fog': fog, 'temples': true,   // المعابد ومباني المرتزقة (3.14)
      'weather': weather == 'random' ? WEATHER_KEYS[math.Random().nextInt(WEATHER_KEYS.length)] : weather,
    };
  }
}

// الأمة ← نمطها القتالي، والعشوائي من كل الخيارات (resolveSide في nations.js)، وللاعب (owned) مما يملكه (2.12.0)
Map<String, Object?> resolveSide(String choice, {bool owned = false}) {
  if (choice == 'random') choice = randomSide(owned: owned);
  final base = _baseSide(choice), nation = nations.mm(base);
  if (nation != null && nations.l('order').contains(base)) return {'gang': nation.s('style'), 'nation': base, if (_isSkin(choice)) 'skin': skinKind(choice)};
  return {'gang': _gangIds.contains(choice) ? choice : _gangIds[0], 'nation': null};
}

String hostCity(String? side) {
  final n = side != null && nations.l('order').contains(_baseSide(side)) ? nations.m(_baseSide(side)) : null;
  return n != null && playableCities.contains(n['city']) && Wallet.hasCity(n.s('city')) ? n.s('city') : 'random';
}

// ما يملكه اللاعب (2.12.0، GAME_SPEC 18.18): الكلاسيكية مجانية، والأمة بشرائها، والنخبة بشراء مظهرها بعد عصابتها. والعشوائي مما يملكه
bool ownsSide(String side) => side == 'random' || (_isSkin(side) ? Wallet.hasSide(_baseSide(side)) && Wallet.hasSkin(side) : Wallet.hasSide(side));
String randomSide({bool owned = false}) {
  final pool = [for (final s in [..._nationIds, ..._gangIds]) if (!owned || Wallet.hasSide(s)) s];
  return pool[math.Random().nextInt(pool.length)];
}

// مدن اللعب (بلا ما خرج من اللعبة، RETIRED_CITIES)، والعشوائي يُحسم هنا منها (كان يحسمه المولّد من كل المدن). واللعب المحلي
// يرسل المدينة المحسومة إلى الأصدقاء
List<String> get playableCities => [for (final c in CITIES.l('order').cast<String>()) if (!RETIRED_CITIES.contains(c)) c];
String _concrete(String city) {
  if (city != 'random') return city;
  final mine = [for (final c in playableCities) if (Wallet.hasCity(c)) c];   // العشوائي من مدنك (2.12.0)
  return mine[math.Random().nextInt(mine.length)];
}

// الأمم الـ15 ثم العصابات الكلاسيكية الأربع ثم العشوائي (SIDE_CHOICES)
List<String> get _nationIds => nations.l('order').cast<String>();
List<String> get _sides => [..._nationIds, ...allSkins, ..._gangIds, 'random'];
bool _isNation(String side) => _nationIds.contains(_baseSide(side));
// مظاهر كل أمة بجوار عصابتها (allSkins في wallet.dart): "<أمة>_elite" باسم "نخبة <الأمة>" (حزمة المستخدم، 2026-11-15)،
// و"<أمة>_outfit" الأزياء الجديدة (حزمته، 2026-11-20) بأسماء اخترناها لها بطلبه: "اسمائهم غير مختاره لذلك قم بأختيار اسماء لهم"
const _outfitNames = {'yemen': 'طريق البخور', 'saudi': 'صقور نجد', 'egypt': 'أسياد النيل', 'sudan': 'ملوك كوش', 'ethiopia': 'شمس أكسوم',
  'nigeria': 'حرس بنين', 'japan': 'رونين الشفق', 'china': 'حرس اليشم', 'korea': 'زهر الهانبوك', 'britain': 'دخان المصانع',
  'france': 'مبارزو باريس', 'germany': 'رايات الراين', 'argentina': 'ليالي التانغو', 'brazil': 'ألوان باهيا', 'mexico': 'ريش الكتزال'};
bool _isSkin(String side) => skinKind(side) != null;
String _baseSide(String side) => _isSkin(side) ? skinNation(side) : side;
String sideName(String side) => side == 'random' ? 'عشوائي'
    : skinKind(side) == 'elite' ? 'نخبة ${nations.m(_baseSide(side)).s('name')}' : _isSkin(side) ? _outfitNames[_baseSide(side)] ?? side
    : _isNation(side) ? nations.m(side).s('name') : GANGS.m(side).s('name');
String sideNote(String side) => side == 'random' ? '' : _isNation(side) ? nations.m(_baseSide(side)).s('gangName') : nations.s('classicNote');

// بطل العصابة (أول ربع من صورتها، البطل يسارها): خانات المتجر والإعداد
Widget heroThumb(String side) => ClipRect(child: Align(alignment: Alignment.centerLeft, widthFactor: 0.25,
    child: Image.asset('assets/thumbs/side_$side.webp', fit: BoxFit.fitHeight, filterQuality: FilterQuality.medium)));

// لوحة العصابات: تبويب لكل منطقة بأممها، ثم الكلاسيكية (SIDE_GROUPS)
List<(String, List<String>)> get sideGroups => [
  for (final r in REGIONS.l('order').cast<String>()) (REGIONS.m(r).s('name'), REGIONS.m(r).l('nations').cast<String>()),
  (REGIONS.m('classic').s('name'), _gangIds),
];

String cityName(String city) => city == 'random' ? 'عشوائي' : city == 'host' ? 'مدينة أمة اللاعب الأول' : CITY_THEMES[city]?.name ?? city;
String cityShort(String city) => city == 'random' ? 'عشوائي' : city == 'host' ? 'مدينة المضيف' : CITIES.m('short').ss(city) ?? city;
String? regionOfCity(String city) {
  for (final r in REGIONS.l('order').cast<String>()) { if (REGIONS.m(r).l('cities').contains(city)) return r; }
  return null;
}

// لوحة الأمم والعصابات (الإعداد وأمة الصديق في اللعب المحلي): لمسة على الخانة تحددها وتكتب قدرتها في اللوحة
// الجانبية، وزر "اختيار" يعتمدها (بطلب المستخدم، 2.0.5)
// human: خانة اللاعب نفسه (أو الصديق في اللعب المحلي): ما لا يملكه بقفل وسعر، و"اختيار" يصير "شراء" (2.12.0). والبوتات بكل شيء
Future<String?> pickSide(BuildContext context, String current, {bool human = false}) => showModalBottomSheet<String>(context: context,
    backgroundColor: panel, isScrollControlled: true, builder: (_) => _SidePicker(current, human));

class _SidePicker extends StatefulWidget {
  final String current;
  final bool human;
  const _SidePicker(this.current, this.human);
  @override
  State<_SidePicker> createState() => _SidePickerState();
}

class _SidePickerState extends State<_SidePicker> {
  late String chosen = widget.current;

  // سطر عنوان ذهبي ثم وصفه
  List<Widget> _line(String head, String text) => [
    const SizedBox(height: 6),
    Text(head, style: const TextStyle(color: gold, fontSize: 12.5, fontWeight: FontWeight.w700)),
    Text(text, style: const TextStyle(color: ink, fontSize: 12)),
  ];

  Widget _details() {
    final g = chosen;
    if (g == 'random') return const Text('المس عصابة لترى قدرتها', style: TextStyle(color: dim, fontSize: 12.5));
    final n = _baseSide(g), style = nations.m('styles').m(_isNation(g) ? nations.m(n).s('style') : g);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(sideName(g), style: const TextStyle(color: ink, fontSize: 16, fontWeight: FontWeight.w800)),
      Text(sideNote(g), style: const TextStyle(color: dim, fontSize: 11.5)),
      if (skinKind(g) == 'elite') ..._line('المظهر', 'زي أسود وذهبي، والوجه واليدان بلونك. القدرات كما هي لأمته'),
      if (skinKind(g) == 'outfit') ..._line('المظهر', 'زي جديد بأسلحة جديدة، والوجه والأطراف بلونك. القدرات كما هي لأمته'),
      if (_isNation(g)) ..._line('القدرة: ${nations.m(n).m('trait').s('name')}', nations.m(n).m('trait').s('desc')),
      if (_isNation(g)) ..._line('ضربة البطل: ${nations.m(n).m('ult').s('name')}', nations.m(n).m('ult').s('desc')),
      ..._line('الفئة: ${style.s('name')}', style.s('desc')),
    ]);
  }

  @override
  Widget build(BuildContext context) => PickerSheet(title: 'الأمة أو العصابة', groups: [
    for (final (name, list) in sideGroups)
      (name, [
        for (final g in [for (final x in list) ...[x, for (final k in skinKinds) if (allSkins.contains('${x}_$k')) '${x}_$k']])   // مظاهرها بجوارها
          PickCard(title: sideName(g), note: _isNation(g) ? '${sideNote(g)} • ${nations.m('styles').m(nations.m(_baseSide(g)).s('style')).s('name')}'
              : nations.m('styles').m(g).s('name'), image: 'assets/thumbs/side_$g.webp', aspect: 2.5,
              badge: widget.human ? _lock(g) : null, selected: chosen == g, onTap: () => setState(() => chosen = g)),
      ]),
  ], side: Container(width: 260, margin: const EdgeInsets.fromLTRB(10, 10, 0, 10), clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0x80E2B55A)),
          gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xF2302519), Color(0xF2171210)])),
      // الشخصيات حية برسم اللعبة (2.7.0)، كعرض المتجر، ثم وصفها يُمرَّران معاً، وزر الاختيار أسفل اللوحة بجوار "عشوائي"
      child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (chosen != 'random') SizedBox(height: 112, child: ShowcaseStage(gang: _isNation(chosen) ? nations.m(_baseSide(chosen)).s('style') : chosen,
            nation: _isNation(chosen) ? _baseSide(chosen) : null, skin: skinKind(chosen))),
        Padding(padding: const EdgeInsets.fromLTRB(10, 8, 10, 8), child: _details()),
      ]))),
    footer: [
      if (widget.human && !ownsSide(chosen))
        WideButton('شراء', _buy, primary: true, width: 160)
      else WideButton('اختيار', chosen == 'random' ? null : () => Navigator.pop(context, chosen), primary: true, width: 160),
      WideButton('عشوائي', () => Navigator.pop(context, 'random'), width: 160),
    ]);

  // قفل ما لا يملكه وسعره: النخبة تحتاج عصابتها أولاً
  String? _lock(String g) => ownsSide(g) ? null
      : _isSkin(g) ? (Wallet.hasSide(_baseSide(g)) ? '🔒 ${Wallet.price('skin', g)}' : '🔒') : '🔒 ${Wallet.price('side', g)}';
  Future<void> _buy() async {
    final skin = skinKind(chosen);
    final ok = await buyDialog(context, skin != null ? 'skin' : 'side', chosen, sideName(chosen),
        note: skin == 'elite' ? 'يُشترى بعد عصابته، أو يُكسب مجاناً بإكمال حملتها كلها على صعوبة صعبة' : skin != null ? 'يُشترى بعد عصابته' : 'تفتح معها حملتها في القصة');
    if (ok && mounted) Navigator.pop(context, chosen);
  }
}

// ===================== القائمة الرئيسية =====================
class MainMenu extends StatefulWidget {
  const MainMenu({super.key});
  @override
  State<MainMenu> createState() => _MainMenuState();
}

class _MainMenuState extends State<MainMenu> {
  // سبب آخر إغلاق للعبة إن كان غير عادي: يُعرض مرة عند أول ظهور للقائمة (ui/crash_report.dart، 2.1.5)
  static bool _reported = false;
  @override
  void initState() {
    super.initState();
    if (_reported) return;
    _reported = true;
    // ثم المكافأة اليومية إن لم تُستلم اليوم (2.14.0): تُفتح وحدها مرة عند التشغيل
    pendingCrashReport().then((text) {
      if (!mounted) return;
      if (text != null) { showCrashReport(context, text); } else if (Daily.ready) { _go(const DailyScreen()); }
    });
  }

  Future<void> _go(Widget screen) => Navigator.of(context).push(PageRouteBuilder(pageBuilder: (_, _, _) => screen,
      transitionDuration: Duration(milliseconds: UI.i('fadeMs')),
      transitionsBuilder: (_, a, _, child) => FadeTransition(opacity: a, child: child)));

  @override
  Widget build(BuildContext context) {
    final route = ModalRoute.of(context);   // يُعاد البناء حين تعود القائمة إلى الواجهة: خانة المتابعة بعد الخروج من مباراة
    if (route?.isCurrent ?? true) GameSound.menuMusic(true);
    final saved = Prefs.read(UI.s('matchInfoKey'));
    final cont = saved == null ? null : '${cityShort('${saved['city']}')} • ${clock((saved['time'] as num).toDouble())}';
    // الشكل "أ" (2.5.0، اختيار المستخدم): لوحة في جهة البداية (يمين العربية ويسار الإنجليزية) بالشعار والأزرار والمدينة ظاهرة،
    // وفي الجهة الأخرى الإعدادات والإحصائيات واللغة، وبطاقة مظهر في المتجر (مكان العروض حين تُبنى)
    return Scaffold(body: Stack(children: [
      const Positioned.fill(child: MenuBackdrop()),
      const Positioned.fill(child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(
          begin: AlignmentDirectional.centerStart, end: AlignmentDirectional.centerEnd,
          colors: [Color(0xED0C0906), Color(0xCC0C0906), Color(0x8C0C0906), Color(0x660C0906)], stops: [0, 0.34, 0.55, 1])))),   // والباقي أدكن قليلاً (2.6.0، بطلبه)
      // اللوحة والأزرار والبطاقة صور جاهزة (Snap، 2.8.0): الخلفية تتحرك تحتها فكان كرت الشاشة يرسمها كلها مع كل إطار
      PositionedDirectional(start: 24, top: 0, bottom: 0, width: 300, child: SafeArea(child: Center(child: SingleChildScrollView(
          child: Snap(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          const Emblem(size: 44),
          const SizedBox(width: 10),
          const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            GoldTitle('مدينة العصابات', size: 32),
            Text('استولِ على المدينة حياً بعد حي', style: TextStyle(color: Color(0xFFCBBD9F), fontSize: 13, shadows: [Shadow(blurRadius: 3)])),
          ])),
        ]),
        if (migrated > 0) const Text('نُقلت إحصائياتك وتقدمك وإعداداتك من النسخة السابقة', style: TextStyle(color: dim, fontSize: 12)),
        const SizedBox(height: 10),
        if (cont != null) MenuButton(const Icon(Icons.play_arrow_rounded), 'متابعة المباراة', note: cont, gilt: true,
            onTap: () => _go(const MatchScreen(resume: true))),
        MenuButton(const SwordsIcon(), 'لعب', note: 'مباراة ضد البوتات بإعدادك', gilt: cont == null, onTap: () => _go(const SetupScreen())),
        MenuButton(const Icon(Icons.menu_book_rounded), 'القصة', note: 'حملة أبناء سبأ', onTap: () => _go(const StoryScreen())),
        MenuButton(const Icon(Icons.wifi_rounded), 'لعب محلي', note: 'مع الأصدقاء على نفس الواي فاي', onTap: () => _go(const LanScreen())),
        MenuButton(const Icon(Icons.emoji_events_rounded), 'الإنجازات',
            note: 'أنجزت ${achievements.where((a) => Achievements.done.contains(a.id)).length} من ${achievements.length} • جوائز ذهب وجواهر',
            onTap: () => _go(const AchievementsScreen())),
      ])))))),
      // صف الذهب والأزرار يصغر في الشاشة الضيقة فلا يغطي عنوان اللوحة (2.16.0)
      PositionedDirectional(end: 14, top: 12, child: SafeArea(child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: math.max(200.0, MediaQuery.sizeOf(context).width - 350)),
          child: FittedBox(fit: BoxFit.scaleDown, alignment: AlignmentDirectional.topEnd, child: Snap(child: Row(children: [
        const GoldChip(size: 16),
        const SizedBox(width: 10),
        RoundButton(Icons.calendar_month_rounded, 'المكافآت', () => _go(const DailyScreen()), dot: Daily.ready),
        RoundButton(Icons.settings_rounded, 'الإعدادات', () => _go(const SettingsScreen())),
        RoundButton(Icons.bar_chart_rounded, 'الإحصائيات', () => _go(const StatsScreen())),
        RoundButton(Icons.language_rounded, 'اللغة', () => pickLanguage(context)),
      ])))))),
      PositionedDirectional(end: 18, bottom: 14, child: SafeArea(child: Snap(child: _OfferCard(onTap: () => _go(const StoreScreen(section: 'offers')))))),
    ]));
  }
}

// بطاقة العروض في القائمة (2.14.0، GAME_SPEC 18.18ب): العرض السريع بصورته وسعره والزمن الباقي (تتحدث كل نصف دقيقة)، ولمسها
// يفتح قسم العروض في المتجر
class _OfferCard extends StatefulWidget {
  final VoidCallback onTap;
  const _OfferCard({required this.onTap});
  @override
  State<_OfferCard> createState() => _OfferCardState();
}

class _OfferCardState extends State<_OfferCard> {
  Timer? _tick;
  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 30), (_) { if (mounted) setState(() {}); });
  }
  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final (kind, id) = Offers.flash();
    final name = kind == 'city' ? 'خريطة ${cityShort(id)}' : kind == 'skin' ? 'مظهر ${sideName(id)}' : sideName(id);
    final left = hoursLeft(Offers.flashLeft());
    return GestureDetector(onTap: () { sound('ui_tap'); widget.onTap(); }, child: Container(
      width: 250, height: 92, clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: offerColor, width: 1.5),
          gradient: const LinearGradient(begin: AlignmentDirectional.centerStart, end: AlignmentDirectional.centerEnd,
              colors: [Color(0xF2281E14), Color(0xF25A2E14)]),
          boxShadow: const [BoxShadow(color: Color(0x99000000), blurRadius: 12, offset: Offset(0, 4))]),
      child: Stack(children: [
        if (kind == 'city') ...[
          PositionedDirectional(end: 0, top: 0, bottom: 0, width: 104, child: Image.asset('assets/thumbs/city_$id.webp', fit: BoxFit.cover)),
          const PositionedDirectional(end: 54, top: 0, bottom: 0, width: 50, child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(
              begin: AlignmentDirectional.centerStart, end: AlignmentDirectional.centerEnd, colors: [Color(0xF2402614), Color(0x00402614)])))),
        ] else PositionedDirectional(end: 6, bottom: -24, child: ClipRect(child: Align(alignment: Alignment.centerLeft, widthFactor: 0.25,
            child: Image.asset('assets/thumbs/side_$id.webp', height: 124, filterQuality: FilterQuality.medium)))),
        PositionedDirectional(start: 12, top: 8, end: 84, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [const Icon(Icons.local_offer_rounded, size: 15, color: offerColor), const SizedBox(width: 5),
            Text('عرض سريع: خصم ${OFFERS.shortPercent}%', style: const TextStyle(color: offerColor, fontSize: 13, fontWeight: FontWeight.w700))]),
          Text(name, maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: ink, fontSize: 15, fontWeight: FontWeight.w700, height: 1.25)),
          Text(Wallet.has(kind, id) ? 'تملكه • باقي $left' : '${Wallet.price(kind, id)} ذهب بدل ${Wallet.basePrice(kind)} • باقي $left',
              maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFFE8C9A8), fontSize: 11.5)),
          const SizedBox(height: 3),
          Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 1),
              decoration: BoxDecoration(gradient: goldGrad, borderRadius: BorderRadius.circular(9), border: Border.all(color: const Color(0xFFFFE6A8))),
              child: const Text('العروض', style: TextStyle(color: Color(0xFF1B140C), fontSize: 12.5, fontWeight: FontWeight.w700))),
        ])),
      ]),
    ));
  }
}

// اختيار اللغة (2.5.0): العربية أو الإنجليزية، كل اسم بلغته
Future<void> pickLanguage(BuildContext context) => showDialog<void>(context: context, builder: (ctx) => SimpleDialog(
  backgroundColor: card, title: const Text('اللغة', style: TextStyle(color: gold, fontWeight: FontWeight.w700)),
  children: [
    for (final (code, name) in const [('ar', 'العربية'), ('en', 'English')])
      SimpleDialogOption(onPressed: () { Lang.set(code); Navigator.pop(ctx); }, child: Row(children: [
        Icon(Lang.code == code ? Icons.radio_button_checked : Icons.radio_button_unchecked, color: gold, size: 20),
        const SizedBox(width: 10),
        RawText(name, style: const TextStyle(color: ink, fontSize: 17, fontWeight: FontWeight.w600)),
      ])),
  ],
));

// خلفية القوائم (menuScene.js): مدينة كبيرة والكاميرا تنجرف داخلها، بنصف إيقاع الشاشة
class MenuBackdrop extends StatefulWidget {
  const MenuBackdrop({super.key});
  @override
  State<MenuBackdrop> createState() => _MenuBackdropState();
}

class _MenuBackdropState extends State<MenuBackdrop> with SingleTickerProviderStateMixin {
  CityArt? art;
  CityLayer? layer;
  GameMap? map;
  late final Ticker _ticker;
  Timer? _rest;
  final _frame = ValueNotifier(0);
  double x = 0, y = 0, vx = 0, vy = 0, zoom = 1;
  Size view = Size.zero;               // مقاس الشاشة (من الرسم)
  double dpr = 1;
  final cache = GroundCache();         // المدينة كلها صورة جاهزة (2.9.0): لا جنود هنا، والكاميرا تنجرف ببطء
  Duration _last = Duration.zero;
  final J _M = UI.m('menuScene');

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_tick);
    _load();
  }

  Future<void> _load() async {
    final r = math.Random();
    final cities = playableCities;
    final city = cities[r.nextInt(cities.length)];
    final players = [for (final g in _gangIds) MapPlayer(g)];
    final m = createMap(_M.s('mapSize'), players, city, Rng(r.nextInt(1 << 30)), specials: false, features: false);
    if (m == null) return;
    final a = await CityArt.load(m.city);
    if (!mounted) { a.dispose(); return; }
    final l = CityLayer(m, a);
    // نصف الأحياء ملوّنة بألوان اللاعبين
    final colors = [for (final c in PLAYER_COLORS) (c as J).s('hex')];
    l.retint([for (final _ in m.districts) r.nextDouble() < _M.d('ownedShare') ? (colors[r.nextInt(colors.length)], 1.0) : (null, 0.0)],
        CAPTURE.d('groundTintAlpha'), CAPTURE.d('groundTintChroma'), CAPTURE.d('wallTintAlpha'), CAPTURE.d('tintChroma'));
    final an = r.nextDouble() * 2 * math.pi;
    setState(() {
      map = m; art = a; layer = l;
      x = 0; y = m.n * TILE_HALF_H;
      vx = math.cos(an) * _M.d('cameraSpeed'); vy = math.sin(an) * _M.d('cameraSpeed');
    });
    _ticker.start();
  }

  void _tick(Duration now) {
    final m = map;
    if (m == null) return;
    final dt = _last == Duration.zero ? 0.0 : (now - _last).inMicroseconds / 1e6;
    _last = now;
    // الشاشة كلها داخل معيّن المدينة: التقريب يكفي لذلك، والكاميرا ترتد قبل أن يخرج ركن منها
    final w = m.n * TILE_HALF_W, h = m.n * TILE_HALF_H, limit = 1 - _M.d('edgeMargin');
    zoom = math.max(_M.d('zoom'), (view.width / 2 / w + view.height / 2 / h) / (limit * 0.75));
    final hw = view.width / 2 / zoom, hh = view.height / 2 / zoom;
    double reach(double px, double py) => (px.abs() + hw) / w + ((py - h).abs() + hh) / h;
    final nx = x + vx * dt, ny = y + vy * dt;
    if (reach(nx, ny) <= limit) {
      x = nx; y = ny;
    } else {
      if (reach(nx, y) > limit) vx = -vx;      // الركن الذي يخرج يعكس اتجاهه
      if (reach(x, ny) > limit) vy = -vy;
      if (reach(x, y) > limit) { x *= 0.98; y = h + (y - h) * 0.98; }   // بعد تغيّر مقاس الشاشة: نحو الوسط
    }
    _frame.value++;
    _rest?.cancel();
    _rest = restTicker(_ticker, PACE.menuFps, context);   // 30 إطاراً (2.11.0 بطلب المستخدم، وكانت 12 في 2.8.0)
  }

  @override
  void dispose() {
    _rest?.cancel();
    _ticker.dispose();
    cache.dispose();
    layer?.dispose();
    art?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    dpr = MediaQuery.devicePixelRatioOf(context);
    return CustomPaint(painter: _BackdropPainter(this), isComplex: true);
  }
}

class _BackdropPainter extends CustomPainter {
  final _MenuBackdropState v;
  _BackdropPainter(this.v) : super(repaint: v._frame);
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawColor(deep, BlendMode.src);
    final l = v.layer, a = v.art;
    if (l == null || a == null) return;
    v.view = size;
    final z = v.zoom;
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(z);
    canvas.translate(-v.x, -v.y);
    final half = size.height / 2 / z, hw = size.width / 2 / z;
    if (!v.cache.paint(canvas, Rect.fromLTRB(v.x - hw, v.y - half, v.x + hw, v.y + half), z, v.dpr, l,
        (c, area) => l.paint(c, a.image, area.top, area.bottom))) {
      l.paint(canvas, a.image, v.y - half, v.y + half);
    }
    canvas.restore();
  }
  @override
  bool shouldRepaint(_BackdropPainter old) => true;
}

// ===================== قائمة الإعداد =====================
class SetupScreen extends StatefulWidget {
  final bool lan;                // اللعب المحلي: المضيف يعدّ المباراة هنا، وكل صديق ينضم يأخذ خانة بوت
  const SetupScreen({super.key, this.lan = false});
  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  final m = SetupModel.load();
  String? error;
  StreamSubscription<String>? _sub;
  String _sentLobby = '';

  @override
  void initState() {
    super.initState();
    if (!widget.lan) return;
    final modes = NET.l('modes').cast<String>();
    if (!modes.contains(m.mode)) m.mode = modes.first;
    Lan.canSeat = () => m.slots.skip(1).any((s) => s.type != 'net');
    _sub = Lan.events.listen((e) { if (e == 'lobby' && mounted) setState(_syncSlots); });
    _syncSlots();
  }

  @override
  void dispose() {
    _sub?.cancel();
    Lan.canSeat = () => true;
    super.dispose();
  }

  // المنضمون ← الخانات: الجديد يأخذ أول خانة بوت ثم أول مغلقة، ومن غادر تعود خانته، والأمة اختيار صاحبها
  void _syncSlots() {
    final peers = Lan.helloPeers, ids = {for (final p in peers) p.id};
    for (final slot in m.slots) {
      if (slot.type == 'net' && !ids.contains(slot.peer)) { slot.type = slot.was; slot.peer = null; }
    }
    for (final peer in peers) {
      var slot = m.slots.where((s) => s.type == 'net' && s.peer == peer.id).firstOrNull;
      if (slot == null) {
        slot = m.slots.skip(1).where((s) => s.type == 'bot').firstOrNull ?? m.slots.skip(1).where((s) => s.type == 'closed').firstOrNull;
        if (slot == null) continue;
        slot..was = slot.type..type = 'net'..peer = peer.id;
      }
      slot.name = peer.name;
      if (_sides.contains(peer.side)) slot.side = peer.side;
    }
  }

  // وصف الغرفة الذي يراه المنضمون في غرفة الانتظار، حين يتغير
  void _sendLobby() {
    final view = {
      'mode': m.mode, 'city': m.city, 'mapSize': m.mapSize, 'weather': m.weather, 'maxUnits': m.maxUnits,
      'players': [
        for (final (k, s) in m.slots.where((s) => s.type != 'closed').indexed)
          {'kind': k == 0 ? 'host' : s.type, 'name': k == 0 ? Lan.name : s.type == 'net' ? s.name : 'بوت ${BOT.m(s.difficulty).s('name')}',
            'side': s.side, 'color': s.color, 'team': s.team, 'peer': s.type == 'net' ? s.peer : null},
      ],
    };
    final text = view.toString();
    if (text == _sentLobby) return;
    _sentLobby = text;
    Lan.broadcastLobby(view);
  }

  Future<T?> _sheet<T>(Widget child) => showModalBottomSheet<T>(context: context, backgroundColor: panel, isScrollControlled: true,
      builder: (_) => child);

  Future<void> _pickCity() async {
    final pick = await _sheet<String>(PickerSheet(title: 'المدينة', groups: [
      for (final r in REGIONS.l('order').cast<String>())
        (REGIONS.m(r).s('name'), [
          for (final c in REGIONS.m(r).l('cities').cast<String>()) if (!RETIRED_CITIES.contains(c))
            PickCard(title: cityShort(c), note: cityName(c), image: 'assets/thumbs/city_$c.webp', selected: m.city == c,
                badge: Wallet.hasCity(c) ? null : '🔒 ${Wallet.price('city', c)}',
                onTap: () async {   // مدينة لا تملكها: تُشترى من هنا (2.12.0)
                  if (!Wallet.hasCity(c) && !await buyDialog(context, 'city', c, cityShort(c))) return;
                  if (mounted) Navigator.pop(context, c);
                }),
        ]),
    ], footer: [WideButton('عشوائي', () => Navigator.pop(context, 'random'), width: 160),
      WideButton('مدينة المضيف', () => Navigator.pop(context, 'host'), width: 160, note: 'مدينة أمة اللاعب الأول')]));
    if (pick != null) setState(() => m.city = pick);
  }

  // طور اللعب: الأطوار الخمسة، وتحتها خيارات المختار (MODE_OPTIONS في menus.js)
  Future<void> _pickMode() async {
    await _sheet<void>(StatefulBuilder(builder: (context, set) {
      Widget opts<T>(String label, List<T> values, String Function(T) text, T current, void Function(T) pick) => Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Row(children: [
          SizedBox(width: 190, child: Text(label, style: const TextStyle(color: ink, fontSize: 13))),
          Expanded(child: Wrap(spacing: 6, children: [
            for (final v in values) ChoiceChip(label: Text(text(v)), selected: v == current, onSelected: (_) { pick(v); set(() {}); setState(() {}); }),
          ])),
        ]));
      final S = _GM.m('survival');
      return SafeArea(child: SingleChildScrollView(padding: const EdgeInsets.all(12), child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('اختر طور اللعب', style: TextStyle(color: gold, fontSize: 17, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center, children: [
          for (final k in _GM.l('order').cast<String>()) if (!widget.lan || NET.l('modes').contains(k))
            SizedBox(width: 190, child: PickCard(title: _GM.m(k).s('name'), note: _GM.m(k).s('short'), selected: m.mode == k,
                onTap: () { m.mode = k; set(() {}); setState(() {}); })),
        ]),
        const SizedBox(height: 6),
        Text(_GM.m(m.mode).s('desc'), style: const TextStyle(color: dim, fontSize: 12.5), textAlign: TextAlign.center),
        if (m.mode == 'points') opts<int>('مدة المباراة (دقيقة)', _GM.m('points').l('minutes').cast<int>(), (v) => '$v', m.pointsMinutes, (v) => m.pointsMinutes = v),
        if (m.mode == 'king') opts<int>('زمن السيطرة على التلة للفوز (دقيقة)', _GM.m('king').l('holdMinutes').cast<int>(), (v) => '$v', m.kingMinutes, (v) => m.kingMinutes = v),
        if (m.mode == 'survival') ...[
          opts<int>('عدد الحلفاء من البوتات', S.l('allies').cast<int>(), (v) => '$v', m.allies, (v) => m.allies = v),
          opts<String>('صعوبة الشرطة', S.l('levels').cast<String>(), (v) => BOT.m(v).s('name'), m.survivalLevel, (v) => m.survivalLevel = v),
        ],
        const SizedBox(height: 8),
        WideButton('تم', () => Navigator.pop(context), primary: true, width: 160),
      ])));
    }));
    setState(() {});
  }

  String _modeNote() {
    String minutes(int n) => n == 1 ? 'دقيقة' : n == 2 ? 'دقيقتان' : n <= 10 ? '$n دقائق' : '$n دقيقة';
    if (m.mode == 'points') return 'مدة المباراة: ${minutes(m.pointsMinutes)}';
    if (m.mode == 'king') return 'السيطرة على التلة: ${minutes(m.kingMinutes)}';
    if (m.mode == 'survival') return 'الحلفاء: ${m.allies} • صعوبة الشرطة: ${BOT.m(m.survivalLevel).s('name')}';
    return _GM.m(m.mode).s('desc');
  }

  Future<void> _pickSide(int k) async {
    final pick = await pickSide(context, m.slots[k].side, human: k == 0);
    if (pick != null) setState(() => m.slots[k].side = pick);
  }

  void _choose<T>(String title, List<T> values, String Function(T) label, T current, void Function(T) set) async {
    final pick = await _sheet<T>(SafeArea(child: Padding(padding: const EdgeInsets.all(14), child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(title, style: const TextStyle(color: gold, fontSize: 17, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        for (final v in values) ChoiceChip(label: Text(label(v)), selected: v == current, onSelected: (_) => Navigator.pop(context, v)),
      ]),
    ]))));
    if (pick != null) setState(() => set(pick));
  }

  String _nextColor(int k) {
    final used = {for (var i = 0; i < _maxSlots; i++) if (i != k && m.slots[i].type != 'closed') m.slots[i].color};
    final ids = _colorIds, start = ids.indexOf(m.slots[k].color);
    for (var step = 1; step <= ids.length; step++) {
      final c = ids[(start + step) % ids.length];
      if (!used.contains(c)) return c;
    }
    return m.slots[k].color;
  }

  void _start() {
    final e = widget.lan && !m.active.any((s) => s.type == 'net') ? 'انتظر حتى ينضم صديق واحد على الأقل.' : m.validate();
    if (e != null) { setState(() => error = e); return; }
    if (widget.lan) {
      // أصحاب الخانات بترتيب لاعبي المباراة (رقم اتصال كل صديق، أو null للمضيف والبوتات)
      final seed = DateTime.now().microsecondsSinceEpoch & 0x7FFFFFFF;
      simRng = Rng(seed);
      final s = createMatch(m.build(host: Lan.name))..seed = seed;
      final mine = Lan.startHost(s, [for (final x in m.active) x.type == 'net' ? x.peer : null]);
      setState(() => error = null);
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => MatchScreen(lanState: mine)));
      return;
    }
    m.save();
    Prefs.remove(UI.s('matchKey'));
    Prefs.remove(UI.s('matchInfoKey'));
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => MatchScreen(settings: m.build())));
  }

  // --- قائمة اللعب (2.7.0، بطلب المستخدم: "باقي تحسين قائمة اللعب"): بشكل المتجر والقائمة الرئيسية ---
  static const _frame = Color(0x66E2B55A);
  static BoxDecoration _plate([double r = 12]) => BoxDecoration(gradient: plateGrad, borderRadius: BorderRadius.circular(r),
      border: Border.all(color: _frame), boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 6, offset: Offset(0, 2))]);
  static Widget _tap(VoidCallback? onTap, Widget child) =>
      GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap == null ? null : () { sound('ui_tap'); onTap(); }, child: child);
  static Widget _badge(IconData icon) => Container(width: 32, height: 32, decoration: BoxDecoration(shape: BoxShape.circle,
      color: const Color(0x24E2B55A), border: Border.all(color: const Color(0x80E2B55A))), child: Icon(icon, size: 18, color: gold));

  // خانة إعداد: أيقونة وعنوان وقيمة وسطر، ولمستها تفتح خياراتها
  Widget _setting({required IconData icon, required String title, required String value, String? note, required VoidCallback onTap,
      Widget? trailing}) => _tap(onTap, Container(padding: const EdgeInsets.fromLTRB(10, 5, 8, 5), decoration: _plate(), child: Row(children: [
    _badge(icon),
    const SizedBox(width: 10),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: const TextStyle(color: dim, fontSize: 11)),
      Text(value, maxLines: 1, overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: ink, fontSize: 15.5, fontWeight: FontWeight.w700, height: 1.2)),
      if (note != null) Text(note, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFFB9AB91), fontSize: 11)),
    ])),
    trailing ?? const Icon(Icons.chevron_right_rounded, color: gold, size: 22),
  ])));

  // خانة صغيرة: الخريطة والطقس والحد
  Widget _mini(IconData icon, String title, String value, String? note, VoidCallback onTap) => Expanded(child: _tap(onTap, Container(
    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6), decoration: _plate(),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(icon, size: 15, color: gold), const SizedBox(width: 4),
        Flexible(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: dim, fontSize: 11)))]),
      Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: ink, fontSize: 14.5, fontWeight: FontWeight.w700, height: 1.25)),
      Text(note ?? ' ', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFFB9AB91), fontSize: 10.5)),
    ]))));

  // المدينة بصورتها من رسم اللعبة، أو رمز للعشوائية ومدينة المضيف
  Widget _cityCard() {
    final c = m.city, img = c == 'random' || c == 'host' ? null : 'assets/thumbs/city_$c.webp';
    return _tap(_pickCity, Container(height: 82, clipBehavior: Clip.antiAlias, decoration: _plate(), child: Stack(fit: StackFit.expand, children: [
      if (img != null) Image.asset(img, fit: BoxFit.cover)
      else Align(alignment: AlignmentDirectional.centerEnd, child: Padding(padding: const EdgeInsetsDirectional.only(end: 18),
          child: Icon(c == 'random' ? Icons.casino_rounded : Icons.flag_rounded, size: 54, color: const Color(0x66E2B55A)))),
      const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
          colors: [Color(0x00000000), Color(0x40000000), Color(0xE6000000)], stops: [0, 0.4, 1]))),
      PositionedDirectional(start: 10, end: 12, bottom: 6, child: Row(children: [
        _badge(Icons.location_city_rounded),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(cityShort(c), maxLines: 1, style: const TextStyle(color: ink, fontSize: 17, fontWeight: FontWeight.w700, shadows: [Shadow(blurRadius: 3)])),
          Text(c == 'random' ? 'تُختار عند البدء' : cityName(c), maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Color(0xFFCBBD9F), fontSize: 11)),
        ])),
      ])),
    ])));
  }

  ({double settings, double type, double color, double team, double level}) _w = (settings: 300, type: 64, color: 44, team: 70, level: 86);

  // خلية في سطر لاعب: لوح صغير، ولمستها تغيّر قيمتها
  Widget _cell(double? w, Widget child, [VoidCallback? onTap]) => _tap(onTap, Container(width: w, height: 37,
      padding: const EdgeInsets.symmetric(horizontal: 5), alignment: Alignment.center,
      decoration: BoxDecoration(gradient: plateGrad, borderRadius: BorderRadius.circular(9), border: Border.all(color: const Color(0x40E2B55A))),
      child: child));

  Widget _row(int k) {
    final s = m.slots[k], surv = m.survival;
    // الصمود: خانتك ثم الحلفاء بعددهم، والجميع فريق واحد ضد الشرطة
    final closed = surv ? k > m.allies : s.type == 'closed';
    bool openIfClosed() { if (!closed || surv) return closed; setState(() => s.type = 'bot'); return true; }
    const st = TextStyle(color: ink, fontSize: 13);
    final level = k > 0 && !closed && s.type != 'net' ? BOT.m(s.difficulty) : null;
    return Opacity(opacity: closed ? 0.45 : 1, child: Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Row(children: [
      Container(width: 22, height: 22, alignment: Alignment.center, decoration: BoxDecoration(shape: BoxShape.circle,
          border: Border.all(color: const Color(0x80E2B55A))), child: Text('${k + 1}', style: const TextStyle(color: gold, fontSize: 11))),
      const SizedBox(width: 5),
      _cell(_w.type, Text(surv ? (k == 0 ? 'أنت' : closed ? 'مغلقة' : 'حليف') : s.type == 'net' ? s.name : _slotTypes[s.type]!,
          style: k == 0 ? st.copyWith(color: gold, fontWeight: FontWeight.w700) : st, overflow: TextOverflow.ellipsis),
          () { if (k > 0 && !surv && s.type != 'net') setState(() => s.type = s.type == 'bot' ? 'closed' : 'bot'); }),
      const SizedBox(width: 5),
      Expanded(child: _cell(null, Row(children: [
        if (s.side == 'random') const SizedBox(width: 24, child: Icon(Icons.casino_rounded, size: 20, color: gold))
        else SizedBox(height: 34, child: heroThumb(s.side)),
        const SizedBox(width: 6),
        Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(sideName(s.side), maxLines: 1, overflow: TextOverflow.ellipsis, style: st.copyWith(height: 1.15)),
          if (sideNote(s.side).isNotEmpty) Text(sideNote(s.side), maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: dim, fontSize: 10, height: 1.15)),
        ])),
      ]), () { if (!openIfClosed() && s.type != 'net') _pickSide(k); })),   // الصديق يختار أمته بنفسه
      const SizedBox(width: 5),
      _cell(_w.color, Container(width: 22, height: 22, decoration: BoxDecoration(color: colorOf(colorHex(s.color)), shape: BoxShape.circle,
          border: Border.all(color: const Color(0xCCF2E6CF), width: 1.5), boxShadow: const [BoxShadow(color: Color(0x80000000), blurRadius: 3)])),
          () { if (!openIfClosed()) setState(() => s.color = _nextColor(k)); }),
      const SizedBox(width: 5),
      _cell(_w.team, Text(surv ? 'فريق 1' : s.team == 0 ? 'بدون' : 'فريق ${s.team}', maxLines: 1, style: st),
          () { if (!openIfClosed() && !surv) setState(() => s.team = (s.team + 1) % 5); }),
      const SizedBox(width: 5),
      _cell(_w.level, Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Text(level?.s('name') ?? '—', maxLines: 1, style: st.copyWith(height: 1.15)),
        if (level?.ss('note') != null) Text(level!.s('note'), maxLines: 1, style: const TextStyle(color: dim, fontSize: 9, height: 1.1)),
      ]), () {
        if (openIfClosed() || level == null) return;
        setState(() => s.difficulty = BOT_LEVELS[(BOT_LEVELS.indexOf(s.difficulty) + 1) % BOT_LEVELS.length] as String);
      }),
    ])));
  }

  @override
  Widget build(BuildContext context) {
    final size = MAP_SIZES.m(m.mapSize);
    if (widget.lan) _sendLobby();
    Widget label(String t, [double? w]) => SizedBox(width: w, child: Text(t, textAlign: TextAlign.center, maxLines: 1, style: const TextStyle(color: dim, fontSize: 10.5)));
    // أعمدة أضيق في الشاشة الضيقة فيبقى لعمود العصابة مكان لاسمها (2.16.0: كان يضيق حتى يختفي الاسم في جوال بعرض 690)
    final narrow = MediaQuery.sizeOf(context).width < 820;
    _w = narrow ? (settings: 250.0, type: 52.0, color: 34.0, team: 56.0, level: 66.0) : (settings: 300.0, type: 64.0, color: 44.0, team: 70.0, level: 86.0);
    return Scaffold(body: DecoratedBox(
      decoration: const BoxDecoration(gradient: RadialGradient(center: Alignment(0.35, -0.5), radius: 1.35,
          colors: [Color(0xFF3B2D1D), Color(0xFF120E0A)])),
      child: SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(12, 8, 12, 8), child: Column(children: [
        Row(children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(shape: BoxShape.circle, gradient: goldGrad, border: Border.all(color: const Color(0xFFFFE6A8))),
              child: const IconTheme(data: IconThemeData(color: Color(0xFF2A1A08), size: 20), child: Center(child: SwordsIcon()))),
          const SizedBox(width: 10),
          GoldTitle(widget.lan ? 'لعب محلي' : 'إعداد المباراة', size: 24),
          const Spacer(),
          Pill(Icons.arrow_back_rounded, 'رجوع', on: false, onTap: () => Navigator.pop(context)),
        ]),
        const SizedBox(height: 8),
        Expanded(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          SizedBox(width: _w.settings, child: SingleChildScrollView(child: Column(children: [
            _setting(icon: Icons.flag_rounded, title: 'طور اللعب', value: _GM.m(m.mode).s('name'), note: _modeNote(), onTap: _pickMode),
            const SizedBox(height: 6),
            _cityCard(),
            const SizedBox(height: 6),
            Row(children: [
              _mini(Icons.map_rounded, 'الخريطة', size.s('name'), 'حتى ${size.i('maxPlayers')} لاعبين',
                  () => _choose<String>('حجم الخريطة', ['small', 'medium', 'large'], (k) => MAP_SIZES.m(k).s('name'), m.mapSize, (v) => m.mapSize = v)),
              const SizedBox(width: 6),
              _mini(m.weather == 'night' ? Icons.nightlight_round : m.weather == 'snow' ? Icons.ac_unit_rounded : m.weather == 'rain' ? Icons.water_drop_rounded
                  : m.weather == 'random' ? Icons.casino_rounded : Icons.wb_sunny_rounded, 'الطقس',
                  m.weather == 'random' ? 'عشوائي' : WEATHER.m(m.weather).s('name'),
                  m.weather == 'night' ? 'رؤية أقل' : m.weather == 'snow' ? 'مشي أبطأ' : m.weather == 'rain' ? 'رمي أضعف' : null,
                  () => _choose<String>('الطقس', [for (final w in WEATHER_KEYS) w as String, 'random'],
                      (k) => k == 'random' ? 'عشوائي' : WEATHER.m(k).s('name'), m.weather, (v) => m.weather = v)),
              const SizedBox(width: 6),
              _mini(Icons.groups_rounded, 'الحد', '${m.maxUnits} وحدة', 'لكل لاعب',
                  () => _choose<int>('الحد الأقصى للوحدات', [for (final v in UNITS.l('maxUnitsChoices')) v as int], (v) => '$v', m.maxUnits, (v) => m.maxUnits = v)),
            ]),
            const SizedBox(height: 6),
            _setting(icon: m.fog ? Icons.cloud_rounded : Icons.visibility_rounded, title: 'ضباب الحرب', value: m.fog ? 'مفعّل' : 'بدون',
                note: m.fog ? 'الخريطة تنكشف بالاستكشاف' : 'الخريطة كلها ظاهرة', onTap: () => setState(() { m.fog = !m.fog; m.save(); }),
                trailing: Switch(value: m.fog, activeThumbColor: gold, onChanged: (v) => setState(() { m.fog = v; m.save(); }))),
          ]))),
          const SizedBox(width: 12),
          Expanded(child: Container(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 6),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0x80E2B55A)),
                gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xF2302519), Color(0xF2171210)]),
                boxShadow: const [BoxShadow(color: Color(0x99000000), blurRadius: 14, offset: Offset(0, 4))]),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                const Icon(Icons.groups_rounded, color: gold, size: 20),
                const SizedBox(width: 6),
                const Text('اللاعبون', style: TextStyle(color: gold, fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(width: 10),
                Expanded(child: Text(m.survival ? 'أنت و${m.allies} حلفاء ضد موجات الشرطة • الحد ${m.limit} لاعبين'
                    : widget.lan ? 'الخانة الأولى أنت • كل صديق ينضم يأخذ خانة بوت • الحد ${m.limit} لاعبين'
                    : 'الخانة الأولى أنت • الحد على هذه الخريطة ${m.limit} لاعبين', maxLines: 2, style: const TextStyle(color: dim, fontSize: 11.5))),
              ]),
              if (widget.lan) Text('مباراة محلية باسم «${Lan.name}»'
                  '${Lan.ips.isNotEmpty ? ' • عنوانك: ${Lan.ips.join(' أو ')}' : ''}'
                  '${m.slots.any((s) => s.type == 'net') ? ' • انضم ${m.slots.where((s) => s.type == 'net').length}' : ' • بانتظار الأصدقاء…'}',
                  style: const TextStyle(color: gold, fontSize: 12)),
              const SizedBox(height: 4),
              Row(children: [const SizedBox(width: 27), label('النوع', _w.type), const SizedBox(width: 5), Expanded(child: label('العصابة')),
                const SizedBox(width: 5), label('اللون', _w.color), const SizedBox(width: 5), label('الفريق', _w.team), const SizedBox(width: 5),
                label('الصعوبة', _w.level)]),
              Expanded(child: ListView(padding: EdgeInsets.zero, children: [for (var k = 0; k < _maxSlots; k++) _row(k)])),
            ]),
          )),
        ])),
        const SizedBox(height: 6),
        Row(children: [
          Expanded(child: Text(error ?? (!widget.lan && Prefs.raw(UI.s('matchKey')) != null ? 'بدء مباراة جديدة يحذف المباراة المحفوظة.' : ''),
              style: TextStyle(color: error != null ? danger : dim, fontSize: 12.5))),
          SizedBox(width: 230, child: MenuButton(const SwordsIcon(), 'ابدأ', gilt: true, onTap: _start)),
        ]),
      ]))),
    ));
  }
}

// ===================== الإعدادات =====================
class SettingsScreen extends StatefulWidget {
  final bool overlay;
  const SettingsScreen({super.key, this.overlay = false});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  void _set(VoidCallback f) { setState(f); Settings.save(); GameSound.applyVolumes(); }
  @override
  Widget build(BuildContext context) {
    final body = Center(child: SingleChildScrollView(child: Panel(padding: const EdgeInsets.all(16), child: SizedBox(width: 520, child: Column(
      mainAxisSize: MainAxisSize.min, children: [
        const Text('الإعدادات', style: TextStyle(color: gold, fontSize: 20, fontWeight: FontWeight.w800)),
        Row(children: [const SizedBox(width: 110, child: Text('مؤثرات الصوت', style: TextStyle(color: ink))),
          Expanded(child: Slider(value: Settings.sfx, onChanged: (v) => _set(() => Settings.sfx = v), activeColor: gold)),
          Text('${(Settings.sfx * 100).round()}%', style: const TextStyle(color: dim))]),
        Row(children: [const SizedBox(width: 110, child: Text('الموسيقى', style: TextStyle(color: ink))),
          Expanded(child: Slider(value: Settings.music, onChanged: (v) => _set(() => Settings.music = v), activeColor: gold)),
          Text('${(Settings.music * 100).round()}%', style: const TextStyle(color: dim))]),
        Toggle('كتم كل الأصوات', Settings.mute, (v) => _set(() => Settings.mute = v)),
        Toggle('الكلمات الطائرة في القتال', Settings.pops, (v) => _set(() => Settings.pops = v)),
        Toggle('توفير البطارية (30 إطاراً)', Settings.battery, (v) => _set(() => Settings.battery = v)),   // 60 بلاه (2.11.0)
        Row(children: [const SizedBox(width: 110, child: Text('اللغة', style: TextStyle(color: ink))),
          for (final (code, name) in const [('ar', 'العربية'), ('en', 'English')])
            Padding(padding: const EdgeInsetsDirectional.only(end: 8), child: ChoiceChip(label: RawText(name), selected: Lang.code == code,
                onSelected: (_) => setState(() => Lang.set(code)))),
        ]),
        const SizedBox(height: 8),
        WideButton('رجوع', () => Navigator.pop(context), ghost: true),
      ])))));
    return widget.overlay ? Material(color: const Color(0xCC000000), child: body) : Scaffold(body: body);
  }
}

// ===================== الإحصائيات =====================
class StatsScreen extends StatelessWidget {
  const StatsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = Stats.load(), v = s.v, fav = s.favorite;
    String time(double sec) { final m = (sec / 60).floor(); return m < 60 ? '$m د' : '${m ~/ 60} س ${m % 60} د'; }
    final items = [
      ('المباريات', '${v['played']!.round()}'), ('فوز', '${v['wins']!.round()}'), ('خسارة', '${v['losses']!.round()}'),
      ('نسبة الفوز', v['played']! > 0 ? '${(100 * v['wins']! / v['played']!).round()}%' : '—'),
      ('أعداء قتلتهم', '${v['kills']!.round()}'), ('وحدات خسرتها', '${v['unitsLost']!.round()}'),
      ('أكبر عدد أحياء', '${v['bestDistricts']!.round()}'), ('أسرع فوز', v['fastestWin']! > 0 ? clock(v['fastestWin']!) : '—'),
      ('وقت اللعب', time(v['totalSeconds']!)), ('عصابتك المفضلة', fav != null && GANGS.has(fav) ? GANGS.m(fav).s('name') : '—'),
    ];
    return Scaffold(body: Center(child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Text('الإحصائيات', style: TextStyle(color: gold, fontSize: 20, fontWeight: FontWeight.w800)),
      const SizedBox(height: 8),
      if (v['played'] == 0) const Text('لم تنتهِ أي مباراة بعد: العب حتى الفوز أو الخسارة.', style: TextStyle(color: dim)),
      SizedBox(width: 700, child: Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center,
          children: [for (final (l, x) in items) StatCard(l, x)])),
      const SizedBox(height: 10),
      WideButton('رجوع', () => Navigator.pop(context), ghost: true),
    ]))));
  }
}

// ===================== المتجر (2.6.0، بطلب المستخدم: "تجميل المتجر وطريقة عرض المظاهر") =====================
// شريط أعلاه بالأقسام الثلاثة، وخانات بصور المدن من رسم اللعبة (tool/export_city_thumbs_test.dart) وأبطال العصابات، ولوحة عرض:
// الشخصيات حية برسم اللعبة (showcase.dart) وتبديل العادي والنخبة في المظاهر، أو صورة المدينة بميزتها ومبناها
class StoreScreen extends StatefulWidget {
  final String section;
  final String? side;
  const StoreScreen({super.key, this.section = 'maps', this.side});
  @override
  State<StoreScreen> createState() => _StoreScreenState();
}

class _StoreScreenState extends State<StoreScreen> {
  late String section = widget.section, chosenSide = widget.side ?? 'crows';
  String chosenMap = 'arab';
  int region = 0;
  bool normalLook = false;   // في المظاهر: الشكل العادي للمقارنة
  String offerKind = 'city';   // نوع المختار في قسم العروض (2.14.0): خريطة أو عصابة أو مظهر

  @override
  void initState() {
    super.initState();
    if (section == 'offers') _pickOffer(Offers.flash());
  }
  // العرض السريع أولاً ثم عروض اليوم
  List<(String, String)> get _offers { final f = Offers.flash(); return [f, for (final o in Offers.today()) if (o != f) o]; }
  void _pickOffer((String, String) o) {
    offerKind = o.$1;
    normalLook = false;
    if (o.$1 == 'city') { chosenMap = o.$2; } else { chosenSide = o.$2; }
  }

  static const _cardFrame = Color(0x40E2B55A), _freeInk = Color(0xFF9FD07C);
  // ما على الخانة (2.12.0): مجانية أو تملكها (أخضر)، أو السعر بالذهب (وبرتقالي بالعرض، 2.14.0)، والمظهر مقفل حتى تُشترى عصابته
  (String, int) _priceTag(String kind, String id) {
    final off = Offers.percent(kind, id);
    return off > 0 ? ('خصم $off% • ${Wallet.price(kind, id)} ذهب', 2) : ('${Wallet.price(kind, id)} ذهب', 0);
  }
  (String, int) _cityTag(String c) => Wallet.freeCity(c) ? ('مجانية', 1) : Wallet.hasCity(c) ? ('تملكها', 1) : _priceTag('city', c);
  (String, int) _sideTag(String s) {
    if (_isSkin(s)) {
      final n = _baseSide(s);
      return Wallet.hasSkin(s) ? ('تملكها', 1) : !Wallet.hasSide(n) ? ('🔒 العصابة أولاً', 0) : _priceTag('skin', s);
    }
    return Wallet.freeSide(s) ? ('مجانية', 1) : Wallet.hasSide(s) ? ('تملكها', 1) : _priceTag('side', s);
  }

  @override
  Widget build(BuildContext context) {
    final offers = section == 'offers';
    final groups = offers ? [('العروض', [for (final o in _offers) '${o.$1}:${o.$2}'])] : section == 'maps'
        ? [for (final r in REGIONS.l('order').cast<String>()) (REGIONS.m(r).s('name'), [for (final c in REGIONS.m(r).l('cities').cast<String>()) if (!RETIRED_CITIES.contains(c)) c])]
        : section == 'skins'
            ? [for (final r in REGIONS.l('order').cast<String>()) (REGIONS.m(r).s('name'),
                [for (final n in REGIONS.m(r).l('nations').cast<String>()) for (final k in skinKinds) if (allSkins.contains('${n}_$k')) '${n}_$k'])]
            : sideGroups;
    if (region >= groups.length) region = 0;
    final items = groups[region].$2;
    return Scaffold(body: DecoratedBox(
      decoration: const BoxDecoration(gradient: RadialGradient(center: Alignment(0.35, -0.5), radius: 1.35,
          colors: [Color(0xFF3B2D1D), Color(0xFF120E0A)])),
      child: SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(12, 8, 12, 10), child: Column(children: [
        // ما لا يتحرك صور جاهزة (Snap، 2.8.0): الشخصيات تتحرك في لوحة العرض فكان كرت الشاشة يرسم المتجر كله مع كل إطار
        Snap(child: Row(children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(shape: BoxShape.circle, gradient: goldGrad,
              border: Border.all(color: const Color(0xFFFFE6A8))),
              child: const Icon(Icons.storefront_rounded, size: 20, color: Color(0xFF2A1A08))),
          // في الشاشة الضيقة بلا العنوان، والأقسام تصغر لتظهر كلها (2.16.0: كان قسم المظاهر خارج الشاشة)
          if (MediaQuery.sizeOf(context).width >= 760) ...[const SizedBox(width: 10), const GoldTitle('المتجر', size: 26)],
          const SizedBox(width: 14),
          Expanded(child: FittedBox(fit: BoxFit.scaleDown, alignment: AlignmentDirectional.centerStart, child: Row(children: [
            for (final (k, label, icon) in const [('offers', 'العروض', Icons.local_offer_rounded), ('maps', 'الخرائط', Icons.map_rounded),
                ('sides', 'العصابات', Icons.groups_rounded), ('skins', 'المظاهر', Icons.checkroom_rounded)])
              Padding(padding: const EdgeInsetsDirectional.only(end: 8), child: Pill(icon, label, on: section == k, onTap: () => setState(() {
                section = k; region = 0; normalLook = false;
                if (k == 'offers') _pickOffer(Offers.flash());
                if (k == 'skins' && !_isSkin(chosenSide)) chosenSide = allSkins.first;
                if (k == 'sides' && _isSkin(chosenSide)) chosenSide = 'crows';
              }))),
          ]))),
          const SizedBox(width: 8),
          const GoldChip(size: 16),
          const SizedBox(width: 10),
          Pill(Icons.arrow_back_rounded, 'رجوع', on: false, onTap: () => Navigator.pop(context)),
        ])),
        const SizedBox(height: 8),
        Expanded(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Expanded(child: Column(children: [
            if (offers) Align(alignment: AlignmentDirectional.centerStart, child: Text(
                'عرض سريع بخصم ${OFFERS.shortPercent}% ينتهي بعد ${hoursLeft(Offers.flashLeft())} • عروض اليوم بخصم ${OFFERS.dayPercent}% تنتهي بعد ${hoursLeft(Offers.dayLeft())}',
                style: const TextStyle(color: offerColor, fontSize: 13, fontWeight: FontWeight.w700))),
            if (groups.length > 1) SizedBox(height: 32, child: ListView(scrollDirection: Axis.horizontal, children: [
              for (var k = 0; k < groups.length; k++) Padding(padding: const EdgeInsetsDirectional.only(end: 6),
                  child: Pill(null, '${groups[k].$1} ${groups[k].$2.length}', on: region == k, small: true, onTap: () => setState(() => region = k))),
            ])),
            const SizedBox(height: 8),
            Expanded(child: GridView.extent(maxCrossAxisExtent: 200, childAspectRatio: 1.55, mainAxisSpacing: 10, crossAxisSpacing: 10,
                children: [for (final it in items) offers ? _offerCard(it) : section == 'maps' ? _mapCard(it) : _sideCard(it)])),
          ])),
          const SizedBox(width: 12),
          SizedBox(width: 330, child: Container(clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0x80E2B55A)),
                gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xF2302519), Color(0xF2171210)]),
                boxShadow: const [BoxShadow(color: Color(0x99000000), blurRadius: 14, offset: Offset(0, 4))]),
            child: section == 'maps' || (offers && offerKind == 'city') ? _mapShow() : _sideShow())),
        ])),
      ]))),
    ));
  }

  // --- الخانات ---
  Widget _card({required bool selected, required (String, int) tag, required VoidCallback onTap, required List<Widget> children}) =>
      GestureDetector(onTap: () { sound('ui_tap'); onTap(); }, child: Snap(margin: 20, child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: selected ? gold : _cardFrame, width: selected ? 2 : 1),
            boxShadow: [selected ? const BoxShadow(color: Color(0x80E2B55A), blurRadius: 12) : const BoxShadow(color: Color(0x80000000), blurRadius: 6, offset: Offset(0, 2))]),
        child: ClipRRect(borderRadius: BorderRadius.circular(11), child: Stack(fit: StackFit.expand, children: [
          ...children,
          PositionedDirectional(top: 6, start: 6, child: Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
              decoration: BoxDecoration(color: const [Color(0xE64A3618), Color(0xE6304F23), Color(0xF05A2410)][tag.$2], borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const [Color(0x80E2B55A), Color(0x809FD07C), offerColor][tag.$2])),
              child: Text(tag.$1, style: TextStyle(fontSize: 10, color: const [gold, _freeInk, Color(0xFFFFC09A)][tag.$2], fontWeight: tag.$2 == 2 ? FontWeight.w700 : null)))),
        ])),
      )));

  static const _fade = DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
      colors: [Color(0x00000000), Color(0x59000000), Color(0xEB000000)], stops: [0.25, 0.55, 1])));
  Widget _caption(String title, String note, double end) => PositionedDirectional(start: 10, end: end, bottom: 7, child: Column(
    crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      Text(title, maxLines: 1, overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: ink, fontSize: 13.5, fontWeight: FontWeight.w700, shadows: [Shadow(blurRadius: 3)])),
      Text(note, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFFCBBD9F), fontSize: 10.5)),
    ]));

  // خانة عرض: 'نوع:معرّف' بخانة الخريطة أو العصابة أو المظهر
  Widget _offerCard(String key) {
    final i = key.indexOf(':'), kind = key.substring(0, i), id = key.substring(i + 1);
    return kind == 'city' ? _mapCard(id) : _sideCard(id);
  }

  Widget _mapCard(String c) => _card(selected: c == chosenMap && (section != 'offers' || offerKind == 'city'), tag: _cityTag(c),
      onTap: () => setState(() { chosenMap = c; offerKind = 'city'; }), children: [
    Image.asset('assets/thumbs/city_$c.webp', fit: BoxFit.cover),
    _fade,
    _caption(cityShort(c), cityName(c), 10),
  ]);

  Widget _sideCard(String s) => _card(selected: s == chosenSide && (section != 'offers' || offerKind != 'city'), tag: _sideTag(s),
      onTap: () => setState(() { chosenSide = s; normalLook = false; offerKind = _isSkin(s) ? 'skin' : 'side'; }), children: [
    const DecoratedBox(decoration: BoxDecoration(gradient: RadialGradient(center: Alignment(-0.55, 0.25), radius: 0.95,
        colors: [Color(0xFF5A4326), Color(0xFF17120D)]))),
    PositionedDirectional(end: 2, top: 4, bottom: -2, child: heroThumb(s)),
    _caption(sideName(s), sideNote(s), 66),
  ]);

  // --- لوحة العرض ---
  Widget _status(String text) => Container(
    margin: const EdgeInsets.only(top: 4, bottom: 6), padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
    decoration: BoxDecoration(borderRadius: BorderRadius.circular(9), color: const Color(0x33304F23), border: Border.all(color: const Color(0x669FD07C))),
    child: Row(children: [
      const Icon(Icons.check_circle_rounded, size: 15, color: _freeInk),
      const SizedBox(width: 6),
      Expanded(child: Text(text, style: const TextStyle(color: _freeInk, fontSize: 11.5))),
    ]));
  // مجانية أو تملكها، أو زر الشراء بالذهب وما يمنعه (2.12.0، GAME_SPEC 18.18)
  Widget _buyBox(String kind, String id, String name, {bool free = false, String? note}) {
    if (free) return _status('مجانية • تأتي مع اللاعب');
    if (Wallet.has(kind, id)) return _status('تملكها • تختارها في قائمة اللعب');
    final block = Wallet.blocked(kind, id);
    return Padding(padding: const EdgeInsets.only(top: 4, bottom: 6), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      WideButton('شراء بـ ${Wallet.price(kind, id)} ذهب', block != null && !Wallet.gemBuys(kind, id) ? null : () async {   // والجوهرة تشتري بلا ذهب
        if (await buyDialog(context, kind, id, name, note: note) && mounted) setState(() {});
      }, primary: true, width: double.infinity),
      if (Offers.percent(kind, id) > 0) Text(
          'خصم ${Offers.percent(kind, id)}% بدل ${Wallet.basePrice(kind)} ذهب • ينتهي بعد ${hoursLeft(Offers.flash() == (kind, id) ? Offers.flashLeft() : Offers.dayLeft())}',
          textAlign: TextAlign.center, style: const TextStyle(color: offerColor, fontSize: 11.5, fontWeight: FontWeight.w700)),
      if (block != null) Text(block, textAlign: TextAlign.center, style: const TextStyle(color: danger, fontSize: 11.5)),
      if (note != null) Text(note, textAlign: TextAlign.center, style: const TextStyle(color: dim, fontSize: 11)),
    ]));
  }
  Widget _line(IconData icon, String text) => Padding(padding: const EdgeInsets.only(bottom: 7), child: Row(
    crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(padding: const EdgeInsets.only(top: 2), child: Icon(icon, size: 15, color: gold)),
      const SizedBox(width: 7),
      Expanded(child: Text(text, style: const TextStyle(color: ink, fontSize: 12.5, height: 1.35))),
    ]));

  Widget _mapShow() {
    final c = chosenMap;
    final host = nations.l('order').cast<String>().where((n) => nations.m(n).s('city') == c);
    final f = CITY_FEATURES.m('desc')[CITY_FEATURES.m('cities')[c]], b = CITY_FEATURES.m('desc')[CITY_FEATURES.m('buildings')[c]];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SizedBox(height: 160, child: Snap(child: Stack(fit: StackFit.expand, children: [
        Image.asset('assets/thumbs/city_$c.webp', fit: BoxFit.cover),
        const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
            colors: [Color(0x00171210), Color(0x8C1B150F), Color(0xFA2B2117)], stops: [0.3, 0.62, 1]))),
        PositionedDirectional(start: 14, end: 14, bottom: 6, child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          GoldTitle(cityShort(c), size: 22),
          Text(cityName(c), style: const TextStyle(color: ink, fontSize: 12, shadows: [Shadow(blurRadius: 3)])),
        ])),
      ]))),
      Expanded(child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(14, 6, 14, 4), child: Snap(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _buyBox('city', c, cityShort(c), free: Wallet.freeCity(c)),
        _line(Icons.public_rounded, 'منطقتها: ${REGIONS.m(regionOfCity(c) ?? 'arabic').s('name')}'),
        if (host.isNotEmpty) _line(Icons.flag_rounded, 'مدينة أمة ${nations.m(host.first).s('name')}: مدينة المضيف حين تلعب بها.'),
        if (f != null) _line(Icons.auto_awesome_rounded, 'ميزتها: $f'),
        if (b != null) _line(Icons.account_balance_rounded, 'مبناها: $b'),
      ])))),
      Padding(padding: const EdgeInsets.fromLTRB(14, 0, 14, 8), child: WideButton('عرض المدينة',
          () => Navigator.push(context, MaterialPageRoute(builder: (_) => CityPreview(city: c))), primary: true, width: double.infinity)),
    ]);
  }

  Widget _sideShow() {
    final s = chosenSide, skin = skinKind(s), elite = skin == 'elite', base = _baseSide(s), nation = _isNation(s) ? nations.m(base) : null;
    final style = nation?.s('style') ?? s, st = nations.m('styles').m(style);
    final names = nation != null
        ? [nation.m('names').s('common'), for (final h in GANGS.m(style).l('heroes').cast<String>()) nation.m('names').s(h), nation.m('names').s('champion')]
        : ['الفرد العادي', for (final h in GANGS.m(s).l('heroes').cast<String>()) HEROES.m(h).s('name'), CHAMPIONS.m(s).s('name')];
    final title = skin != null ? sideName(s) : nation != null ? nation.s('gangName') : GANGS.m(s).s('name');
    final note = skin != null ? nation!.s('gangName') : nation != null ? nation.s('name') : sideNote(s);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SizedBox(height: 182, child: Stack(fit: StackFit.expand, children: [
        ShowcaseStage(gang: style, nation: nation != null ? base : null, skin: normalLook ? null : skin),
        if (skin != null) PositionedDirectional(top: 8, start: 8, child: Row(children: [
          for (final (normal, label) in [(false, elite ? 'نخبة' : 'المظهر'), (true, 'عادي')])
            Padding(padding: const EdgeInsetsDirectional.only(end: 6),
                child: Pill(null, label, on: normalLook == normal, small: true, onTap: () => setState(() => normalLook = normal))),
        ])),
      ])),
      Expanded(child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(14, 8, 14, 8), child: Snap(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(title, style: const TextStyle(color: gold, fontSize: 19, fontWeight: FontWeight.w700, height: 1.2)),
        Text(note, style: const TextStyle(color: Color(0xFFCBBD9F), fontSize: 12)),
        skin != null ? _buyBox('skin', s, sideName(s), note: elite ? 'أو أكمل حملة عصابته كلها على صعوبة صعبة فتأخذه مجاناً' : null)
            : _buyBox('side', s, title, free: Wallet.freeSide(s), note: CAMPAIGNS.has(s) ? 'تفتح معها حملتها في القصة' : null),
        if (skin == 'outfit') _line(Icons.auto_awesome_rounded,
            'زي جديد بأسلحة جديدة لعصابة ${nation!.s('gangName')}: الوجه والأطراف بلونك، والقدرات كما هي. يُختار بجوار عصابته في الإعداد'),
        if (elite) _line(Icons.auto_awesome_rounded,
            'مظهر أسود وذهبي لـ${nation!.s('gangName')}: الوجه واليدان بلونك، والقدرات كما هي. يُختار بجوار عصابته في الإعداد'),
        _line(Icons.groups_rounded, names.join(' • ')),
        if (nation != null) _line(Icons.bolt_rounded, '«${nation.m('trait').s('name')}»: ${nation.m('trait').s('desc')}'),
        _line(Icons.shield_rounded, 'نمط ${st.s('name')}: ${st.s('desc')}'),
      ])))),
    ]);
  }
}

// معاينة المدينة من المتجر: خريطتها كاملة بالتحريك والتقريب
class CityPreview extends StatefulWidget {
  final String city;
  const CityPreview({super.key, required this.city});
  @override
  State<CityPreview> createState() => _CityPreviewState();
}

class _CityPreviewState extends State<CityPreview> {
  CityArt? art;
  CityLayer? layer;
  GameMap? map;
  double x = 0, y = 0, z = 1.2, _scale = 1;
  final _frame = ValueNotifier(0);

  @override
  void initState() {
    super.initState();
    () async {
      final m = createMap('medium', [for (final g in _gangIds) MapPlayer(g)], widget.city, Rng(math.Random().nextInt(1 << 30)), specials: false, features: true)!;
      final a = await CityArt.load(m.city);
      if (!mounted) { a.dispose(); return; }
      setState(() { map = m; art = a; layer = CityLayer(m, a); y = m.n * TILE_HALF_H; });
    }();
  }

  @override
  void dispose() { layer?.dispose(); art?.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(body: Stack(children: [
    Positioned.fill(child: GestureDetector(
      onScaleStart: (_) => _scale = 1,
      onScaleUpdate: (d) {
        z = (z * d.scale / _scale).clamp(0.5, 4.5);
        _scale = d.scale;
        x -= d.focalPointDelta.dx / z; y -= d.focalPointDelta.dy / z;
        _frame.value++;
      },
      child: CustomPaint(painter: _PreviewPainter(this), isComplex: true))),
    Positioned(top: 8, right: 8, child: Panel(child: Text(cityName(widget.city), style: const TextStyle(color: gold, fontSize: 15)))),
    Positioned(top: 8, left: 8, child: WideButton('رجوع', () => Navigator.pop(context), width: 100)),
    if (layer == null) const Center(child: CircularProgressIndicator(color: gold)),
  ]));
}

class _PreviewPainter extends CustomPainter {
  final _CityPreviewState v;
  _PreviewPainter(this.v) : super(repaint: v._frame);
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawColor(deep, BlendMode.src);
    final l = v.layer, a = v.art;
    if (l == null || a == null) return;
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(v.z);
    canvas.translate(-v.x, -v.y);
    final half = size.height / 2 / v.z;
    l.paint(canvas, a.image, v.y - half, v.y + half);
    canvas.restore();
  }
  @override
  bool shouldRepaint(_PreviewPainter old) => true;
}
