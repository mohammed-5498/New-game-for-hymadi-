// القوائم (js/ui/menus.js وpicker.js وstoreScreen.js، القسم 12): الرئيسية بخلفية مدينة حية، والإعداد بخاناته ولوحاته،
// والإعدادات، والإحصائيات، والمتجر. الصور المصغرة من اللعبة الحالية نفسها (assets/thumbs، scripts/export_thumbs.cjs)
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart' hide Text;
import 'package:flutter/scheduler.dart';

import '../i18n/tr.dart';
import '../core/cfg.dart';
import '../config.dart' show PACE, RETIRED_CITIES;
import '../core/fmath.dart';
import '../data/cities.dart';
import '../data/js_config.dart';
import '../data/rig_sprites.dart';
import '../map/generator.dart';
import '../render/city_art.dart';
import '../render/city_layer.dart';
import '../audio/sound.dart';
import '../game/match.dart';
import '../game/state.dart';
import '../net/session.dart';
import 'lan_screen.dart';
import 'migrate.dart' show migrated;
import 'match_screen.dart';
import 'crash_report.dart';
import 'prefs.dart';
import 'showcase.dart';
import 'story_screen.dart';
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
        {'name': k == 0 ? host ?? 'أنت' : a[k].type == 'net' ? a[k].name : 'بوت $k', ...resolveSide(a[k].side), 'color': a[k].color,
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

// الأمة ← نمطها القتالي، والعشوائي من كل الخيارات (resolveSide في nations.js)
Map<String, Object?> resolveSide(String choice) {
  if (choice == 'random') { final pool = [..._nationIds, ..._gangIds]; choice = pool[math.Random().nextInt(pool.length)]; }
  final base = _baseSide(choice), nation = nations.mm(base);
  if (nation != null && nations.l('order').contains(base)) return {'gang': nation.s('style'), 'nation': base, if (_isElite(choice)) 'skin': 'elite'};
  return {'gang': _gangIds.contains(choice) ? choice : _gangIds[0], 'nation': null};
}

String hostCity(String? side) {
  final n = side != null && nations.l('order').contains(_baseSide(side)) ? nations.m(_baseSide(side)) : null;
  return n != null && playableCities.contains(n['city']) ? n.s('city') : 'random';
}

// مدن اللعب (بلا ما خرج من اللعبة، RETIRED_CITIES)، والعشوائي يُحسم هنا منها (كان يحسمه المولّد من كل المدن). واللعب المحلي
// يرسل المدينة المحسومة إلى الأصدقاء
List<String> get playableCities => [for (final c in CITIES.l('order').cast<String>()) if (!RETIRED_CITIES.contains(c)) c];
String _concrete(String city) => city == 'random' ? playableCities[math.Random().nextInt(playableCities.length)] : city;

// الأمم الـ15 ثم العصابات الكلاسيكية الأربع ثم العشوائي (SIDE_CHOICES)
List<String> get _nationIds => nations.l('order').cast<String>();
List<String> get _sides => [..._nationIds, ..._eliteIds, ..._gangIds, 'random'];
bool _isNation(String side) => _nationIds.contains(_baseSide(side));
// مظهر النخبة الأسود والذهبي لكل أمة (حزمة المستخدم، 2026-11-15): "<أمة>_elite"، باسم "نخبة <الأمة>" بجوار عصابته
List<String> get _eliteIds => [for (final n in _nationIds) if (RIG_SHEETS.containsKey('${n}_elite')) '${n}_elite'];
bool _isElite(String side) => side.endsWith('_elite') && _nationIds.contains(side.substring(0, side.length - 6));
String _baseSide(String side) => _isElite(side) ? side.substring(0, side.length - 6) : side;
String sideName(String side) => side == 'random' ? 'عشوائي' : _isElite(side) ? 'نخبة ${nations.m(_baseSide(side)).s('name')}'
    : _isNation(side) ? nations.m(side).s('name') : GANGS.m(side).s('name');
String sideNote(String side) => side == 'random' ? '' : _isNation(side) ? nations.m(_baseSide(side)).s('gangName') : nations.s('classicNote');

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
Future<String?> pickSide(BuildContext context, String current) => showModalBottomSheet<String>(context: context, backgroundColor: panel,
    isScrollControlled: true, builder: (_) => _SidePicker(current));

class _SidePicker extends StatefulWidget {
  final String current;
  const _SidePicker(this.current);
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
      if (_isElite(g)) ..._line('المظهر', 'زي أسود وذهبي، والوجه واليدان بلونك. القدرات كما هي لأمته'),
      if (_isNation(g)) ..._line('القدرة: ${nations.m(n).m('trait').s('name')}', nations.m(n).m('trait').s('desc')),
      if (_isNation(g)) ..._line('ضربة البطل: ${nations.m(n).m('ult').s('name')}', nations.m(n).m('ult').s('desc')),
      ..._line('الفئة: ${style.s('name')}', style.s('desc')),
    ]);
  }

  @override
  Widget build(BuildContext context) => PickerSheet(title: 'الأمة أو العصابة', groups: [
    for (final (name, list) in sideGroups)
      (name, [
        for (final g in [for (final x in list) ...[x, if (_eliteIds.contains('${x}_elite')) '${x}_elite']])   // النخبة بجوار عصابتها
          PickCard(title: sideName(g), note: _isNation(g) ? '${sideNote(g)} • ${nations.m('styles').m(nations.m(_baseSide(g)).s('style')).s('name')}'
              : nations.m('styles').m(g).s('name'), image: 'assets/thumbs/side_$g.webp', aspect: 2.5,
              selected: chosen == g, onTap: () => setState(() => chosen = g)),
      ]),
  ], side: Container(width: 250, margin: const EdgeInsets.fromLTRB(10, 10, 0, 10), padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(10)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Expanded(child: SingleChildScrollView(child: _details())),
        const SizedBox(height: 8),
        WideButton('اختيار', chosen == 'random' ? null : () => Navigator.pop(context, chosen), primary: true),
      ])),
    footer: [WideButton('عشوائي', () => Navigator.pop(context, 'random'), width: 160)]);
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
    pendingCrashReport().then((text) { if (text != null && mounted) showCrashReport(context, text); });
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
      PositionedDirectional(start: 24, top: 0, bottom: 0, width: 300, child: SafeArea(child: Center(child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
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
      ]))))),
      PositionedDirectional(end: 14, top: 12, child: SafeArea(child: Row(children: [
        RoundButton(Icons.settings_rounded, 'الإعدادات', () => _go(const SettingsScreen())),
        RoundButton(Icons.bar_chart_rounded, 'الإحصائيات', () => _go(const StatsScreen())),
        RoundButton(Icons.language_rounded, 'اللغة', () => pickLanguage(context)),
      ]))),
      PositionedDirectional(end: 18, bottom: 14, child: SafeArea(child: _OfferCard(onTap: (side) => _go(StoreScreen(section: 'skins', side: side))))),
    ]));
  }
}

// بطاقة المتجر في القائمة (مكان قائمة العروض حين تُبنى): مظهر نخبة يتبدل كل يوم، ولمسها يفتحه في المتجر
class _OfferCard extends StatelessWidget {
  final ValueChanged<String> onTap;
  const _OfferCard({required this.onTap});
  @override
  Widget build(BuildContext context) {
    final elites = _eliteIds;
    if (elites.isEmpty) return const SizedBox();
    final side = elites[DateTime.now().difference(DateTime(2026)).inDays % elites.length];
    return GestureDetector(onTap: () { sound('ui_tap'); onTap(side); }, child: Container(
      width: 250, height: 92, clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: gold, width: 1.5),
          gradient: const LinearGradient(begin: AlignmentDirectional.centerStart, end: AlignmentDirectional.centerEnd,
              colors: [Color(0xF2281E14), Color(0xF2543C1C)]),
          boxShadow: const [BoxShadow(color: Color(0x99000000), blurRadius: 12, offset: Offset(0, 4))]),
      child: Stack(children: [
        PositionedDirectional(end: 6, bottom: -24, child: ClipRect(child: Align(alignment: Alignment.centerLeft, widthFactor: 0.25,
            child: Image.asset('assets/thumbs/side_$side.webp', height: 124, filterQuality: FilterQuality.medium)))),
        PositionedDirectional(start: 12, top: 8, end: 84, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Row(children: [Icon(Icons.card_giftcard_rounded, size: 15, color: gold), SizedBox(width: 5),
            Text('العروض', style: TextStyle(color: gold, fontSize: 13, fontWeight: FontWeight.w700))]),
          Text('مظهر ${sideName(side)}', maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: ink, fontSize: 15.5, fontWeight: FontWeight.w700, height: 1.25)),
          const SizedBox(height: 5),
          Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
              decoration: BoxDecoration(gradient: goldGrad, borderRadius: BorderRadius.circular(9), border: Border.all(color: const Color(0xFFFFE6A8))),
              child: const Text('المتجر', style: TextStyle(color: Color(0xFF1B140C), fontSize: 13, fontWeight: FontWeight.w700))),
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
    _rest = restTicker(_ticker, PACE.menuFps, context);   // 20 إطاراً فعلاً (كانت الشاشة تُركَّب 60)
  }

  @override
  void dispose() {
    _rest?.cancel();
    _ticker.dispose();
    layer?.dispose();
    art?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => CustomPaint(painter: _BackdropPainter(this), isComplex: true);
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
    final half = size.height / 2 / z;
    l.paint(canvas, a.image, v.y - half, v.y + half);
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
                onTap: () => Navigator.pop(context, c)),
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
    final pick = await pickSide(context, m.slots[k].side);
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

  Widget _cell(double w, Widget child, [VoidCallback? onTap]) => SizedBox(width: w, height: 40, child: Material(
      color: card, borderRadius: BorderRadius.circular(7),
      child: InkWell(borderRadius: BorderRadius.circular(7), onTap: onTap, child: Center(child: child))));

  Widget _row(int k) {
    final s = m.slots[k], surv = m.survival;
    // الصمود: خانتك ثم الحلفاء بعددهم، والجميع فريق واحد ضد الشرطة
    final closed = surv ? k > m.allies : s.type == 'closed';
    bool openIfClosed() { if (!closed || surv) return closed; setState(() => s.type = 'bot'); return true; }
    const st = TextStyle(color: ink, fontSize: 13);
    final level = k > 0 && !closed && s.type != 'net' ? BOT.m(s.difficulty) : null;
    return Opacity(opacity: closed ? 0.45 : 1, child: Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Row(children: [
      SizedBox(width: 18, child: Text('${k + 1}', style: const TextStyle(color: dim, fontSize: 12))),
      _cell(64, Text(surv ? (k == 0 ? 'أنت' : closed ? 'مغلقة' : 'حليف') : s.type == 'net' ? s.name : _slotTypes[s.type]!, style: st,
          overflow: TextOverflow.ellipsis),
          () { if (k > 0 && !surv && s.type != 'net') setState(() => s.type = s.type == 'bot' ? 'closed' : 'bot'); }),
      const SizedBox(width: 4),
      _cell(120, Column(mainAxisSize: MainAxisSize.min, children: [
        Text(sideName(s.side), style: st),
        if (sideNote(s.side).isNotEmpty) Text(sideNote(s.side), style: const TextStyle(color: dim, fontSize: 10)),
      ]), () { if (!openIfClosed() && s.type != 'net') _pickSide(k); }),   // الصديق يختار أمته بنفسه
      const SizedBox(width: 4),
      _cell(40, Container(width: 22, height: 22, decoration: BoxDecoration(color: colorOf(colorHex(s.color)), shape: BoxShape.circle)),
          () { if (!openIfClosed()) setState(() => s.color = _nextColor(k)); }),
      const SizedBox(width: 4),
      _cell(64, Text(surv ? 'فريق 1' : s.team == 0 ? 'بدون' : 'فريق ${s.team}', style: st),
          () { if (!openIfClosed() && !surv) setState(() => s.team = (s.team + 1) % 5); }),
      const SizedBox(width: 4),
      _cell(82, Column(mainAxisSize: MainAxisSize.min, children: [
        Text(level?.s('name') ?? '—', style: st),
        if (level?.ss('note') != null) Text(level!.s('note'), style: const TextStyle(color: dim, fontSize: 9)),
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
    return Scaffold(body: SafeArea(child: Column(children: [
      Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(10), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Column(children: [
          PickTile(title: 'طور اللعب', value: _GM.m(m.mode).s('name'), icon: Icons.flag, width: 300, note: _modeNote(), onTap: _pickMode),
          const SizedBox(height: 6),
          PickTile(title: 'المدينة', value: cityShort(m.city), note: m.city == 'random' ? 'تُختار عند البدء' : cityName(m.city),
              image: m.city == 'random' || m.city == 'host' ? null : 'assets/thumbs/city_${m.city}.webp', icon: Icons.location_city, width: 300, onTap: _pickCity),
          const SizedBox(height: 6),
          Row(children: [
            PickTile(title: 'الخريطة', value: size.s('name'), note: 'حتى ${size.i('maxPlayers')} لاعبين', icon: Icons.map, width: 96,
                onTap: () => _choose<String>('حجم الخريطة', ['small', 'medium', 'large'], (k) => MAP_SIZES.m(k).s('name'), m.mapSize, (v) => m.mapSize = v)),
            const SizedBox(width: 6),
            PickTile(title: 'الطقس', value: m.weather == 'random' ? 'عشوائي' : WEATHER.m(m.weather).s('name'),
                note: m.weather == 'night' ? 'رؤية أقل' : m.weather == 'snow' ? 'مشي أبطأ' : m.weather == 'rain' ? 'رمي أضعف' : null,
                icon: m.weather == 'night' ? Icons.nightlight : m.weather == 'snow' ? Icons.ac_unit : m.weather == 'rain' ? Icons.water_drop : Icons.wb_sunny,
                width: 96, onTap: () => _choose<String>('الطقس', [for (final w in WEATHER_KEYS) w as String, 'random'],
                    (k) => k == 'random' ? 'عشوائي' : WEATHER.m(k).s('name'), m.weather, (v) => m.weather = v)),
            const SizedBox(width: 6),
            PickTile(title: 'الحد', value: '${m.maxUnits} وحدة', note: 'لكل لاعب', icon: Icons.groups, width: 96,
                onTap: () => _choose<int>('الحد الأقصى للوحدات', [for (final v in UNITS.l('maxUnitsChoices')) v as int], (v) => '$v', m.maxUnits, (v) => m.maxUnits = v)),
          ]),
          const SizedBox(height: 6),
          PickTile(title: 'ضباب الحرب', value: m.fog ? 'مفعّل' : 'بدون', note: m.fog ? 'الخريطة تنكشف بالاستكشاف' : 'الخريطة كلها ظاهرة',
              icon: m.fog ? Icons.cloud : Icons.visibility, width: 300, onTap: () => setState(() { m.fog = !m.fog; m.save(); })),
        ]),
        const SizedBox(width: 12),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (widget.lan) SizedBox(width: 404, child: Text('مباراة محلية باسم «${Lan.name}»'
              '${Lan.ips.isNotEmpty ? ' • عنوانك: ${Lan.ips.join(' أو ')}' : ''}'
              '${m.slots.any((s) => s.type == 'net') ? ' • انضم ${m.slots.where((s) => s.type == 'net').length}' : ' • بانتظار الأصدقاء…'}',
              style: const TextStyle(color: gold, fontSize: 12.5))),
          SizedBox(width: 404, child: Text(m.survival ? 'أنت و${m.allies} حلفاء ضد موجات الشرطة • الحد ${m.limit} لاعبين'
              : widget.lan ? 'الخانة الأولى أنت • كل صديق ينضم يأخذ خانة بوت • الحد ${m.limit} لاعبين'
              : 'الخانة الأولى أنت • الحد على هذه الخريطة ${m.limit} لاعبين', style: const TextStyle(color: dim, fontSize: 12))),
          const SizedBox(height: 4),
          for (var k = 0; k < _maxSlots; k++) _row(k),
        ]),
      ]))),
      Container(color: const Color(0xFF1C1611), padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), child: Row(children: [
        Expanded(child: Text(error ?? (!widget.lan && Prefs.raw(UI.s('matchKey')) != null ? 'بدء مباراة جديدة يحذف المباراة المحفوظة.' : ''),
            style: TextStyle(color: error != null ? danger : dim, fontSize: 12.5))),
        WideButton('رجوع', () => Navigator.pop(context), ghost: true, width: 120),
        const SizedBox(width: 8),
        WideButton('ابدأ', _start, primary: true, width: 160),
      ])),
    ])));
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
        Toggle('توفير البطارية (30 إطاراً)', Settings.battery, (v) => _set(() => Settings.battery = v)),
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

  bool _freeCity(String c) => STORE.l('freeCities').contains(c);
  bool _freeSide(String s) => _gangIds.contains(s);
  static const _cardFrame = Color(0x40E2B55A), _freeInk = Color(0xFF9FD07C);

  @override
  Widget build(BuildContext context) {
    final groups = section == 'maps'
        ? [for (final r in REGIONS.l('order').cast<String>()) (REGIONS.m(r).s('name'), [for (final c in REGIONS.m(r).l('cities').cast<String>()) if (!RETIRED_CITIES.contains(c)) c])]
        : section == 'skins'
            ? [for (final r in REGIONS.l('order').cast<String>()) (REGIONS.m(r).s('name'),
                [for (final n in REGIONS.m(r).l('nations').cast<String>()) if (_eliteIds.contains('${n}_elite')) '${n}_elite'])]
            : sideGroups;
    if (region >= groups.length) region = 0;
    final items = groups[region].$2;
    final maps = [for (final r in REGIONS.l('order').cast<String>()) ...REGIONS.m(r).l('cities')].where((c) => !RETIRED_CITIES.contains(c)).length;
    return Scaffold(body: DecoratedBox(
      decoration: const BoxDecoration(gradient: RadialGradient(center: Alignment(0.35, -0.5), radius: 1.35,
          colors: [Color(0xFF3B2D1D), Color(0xFF120E0A)])),
      child: SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(12, 8, 12, 10), child: Column(children: [
        Row(children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(shape: BoxShape.circle, gradient: goldGrad,
              border: Border.all(color: const Color(0xFFFFE6A8))),
              child: const Icon(Icons.storefront_rounded, size: 20, color: Color(0xFF2A1A08))),
          const SizedBox(width: 10),
          const GoldTitle('المتجر', size: 26),
          const SizedBox(width: 16),
          for (final (k, label, icon, n) in [('maps', 'الخرائط', Icons.map_rounded, maps),
              ('sides', 'العصابات', Icons.groups_rounded, _nationIds.length + _gangIds.length),
              ('skins', 'المظاهر', Icons.checkroom_rounded, _eliteIds.length)])
            Padding(padding: const EdgeInsetsDirectional.only(end: 8), child: _Pill(icon, '$label ($n)', on: section == k, onTap: () => setState(() {
              section = k; region = 0; normalLook = false;
              if (k == 'skins' && !_isElite(chosenSide)) chosenSide = _eliteIds.first;
              if (k == 'sides' && _isElite(chosenSide)) chosenSide = 'crows';
            }))),
          const Spacer(),
          _Pill(Icons.arrow_back_rounded, 'رجوع', on: false, onTap: () => Navigator.pop(context)),
        ]),
        const SizedBox(height: 8),
        Expanded(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Expanded(child: Column(children: [
            if (groups.length > 1) SizedBox(height: 32, child: ListView(scrollDirection: Axis.horizontal, children: [
              for (var k = 0; k < groups.length; k++) Padding(padding: const EdgeInsetsDirectional.only(end: 6),
                  child: _Pill(null, '${groups[k].$1} ${groups[k].$2.length}', on: region == k, small: true, onTap: () => setState(() => region = k))),
            ])),
            const SizedBox(height: 8),
            Expanded(child: GridView.extent(maxCrossAxisExtent: 200, childAspectRatio: 1.55, mainAxisSpacing: 10, crossAxisSpacing: 10,
                children: [for (final it in items) section == 'maps' ? _mapCard(it) : _sideCard(it)])),
          ])),
          const SizedBox(width: 12),
          SizedBox(width: 330, child: Container(clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0x80E2B55A)),
                gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xF2302519), Color(0xF2171210)]),
                boxShadow: const [BoxShadow(color: Color(0x99000000), blurRadius: 14, offset: Offset(0, 4))]),
            child: section == 'maps' ? _mapShow() : _sideShow())),
        ])),
      ]))),
    ));
  }

  // --- الخانات ---
  Widget _card({required bool selected, required bool free, required VoidCallback onTap, required List<Widget> children}) =>
      GestureDetector(onTap: () { sound('ui_tap'); onTap(); }, child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: selected ? gold : _cardFrame, width: selected ? 2 : 1),
            boxShadow: [selected ? const BoxShadow(color: Color(0x80E2B55A), blurRadius: 12) : const BoxShadow(color: Color(0x80000000), blurRadius: 6, offset: Offset(0, 2))]),
        child: ClipRRect(borderRadius: BorderRadius.circular(11), child: Stack(fit: StackFit.expand, children: [
          ...children,
          PositionedDirectional(top: 6, start: 6, child: Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
              decoration: BoxDecoration(color: free ? const Color(0xE6304F23) : const Color(0xE64A3618), borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: free ? const Color(0x809FD07C) : const Color(0x80E2B55A))),
              child: Text(free ? 'مجانية' : 'السعر لاحقاً', style: TextStyle(fontSize: 10, color: free ? _freeInk : gold)))),
        ])),
      ));

  static const _fade = DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
      colors: [Color(0x00000000), Color(0x59000000), Color(0xEB000000)], stops: [0.25, 0.55, 1])));
  Widget _caption(String title, String note, double end) => PositionedDirectional(start: 10, end: end, bottom: 7, child: Column(
    crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
      Text(title, maxLines: 1, overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: ink, fontSize: 13.5, fontWeight: FontWeight.w700, shadows: [Shadow(blurRadius: 3)])),
      Text(note, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xFFCBBD9F), fontSize: 10.5)),
    ]));

  Widget _mapCard(String c) => _card(selected: c == chosenMap, free: _freeCity(c), onTap: () => setState(() => chosenMap = c), children: [
    Image.asset('assets/thumbs/city_$c.webp', fit: BoxFit.cover),
    _fade,
    _caption(cityShort(c), cityName(c), 10),
  ]);

  // البطل كبيراً (أول ربع من صورة العصابة، البطل يسارها) على مسرح صغير
  Widget _hero(String side) => ClipRect(child: Align(alignment: Alignment.centerLeft, widthFactor: 0.25,
      child: Image.asset('assets/thumbs/side_$side.webp', fit: BoxFit.fitHeight, filterQuality: FilterQuality.medium)));
  Widget _sideCard(String s) => _card(selected: s == chosenSide, free: _freeSide(s), onTap: () => setState(() { chosenSide = s; normalLook = false; }), children: [
    const DecoratedBox(decoration: BoxDecoration(gradient: RadialGradient(center: Alignment(-0.55, 0.25), radius: 0.95,
        colors: [Color(0xFF5A4326), Color(0xFF17120D)]))),
    PositionedDirectional(end: 2, top: 4, bottom: -2, child: _hero(s)),
    _caption(sideName(s), sideNote(s), 66),
  ]);

  // --- لوحة العرض ---
  Widget _status(bool free) => Container(
    margin: const EdgeInsets.only(top: 4, bottom: 6), padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
    decoration: BoxDecoration(borderRadius: BorderRadius.circular(9), color: free ? const Color(0x33304F23) : const Color(0x334A3618),
        border: Border.all(color: free ? const Color(0x669FD07C) : const Color(0x66E2B55A))),
    child: Row(children: [
      Icon(free ? Icons.check_circle_rounded : Icons.schedule_rounded, size: 15, color: free ? _freeInk : gold),
      const SizedBox(width: 6),
      Expanded(child: Text(free ? 'مجانية • تأتي مع اللاعب' : 'السعر: يُحدد لاحقاً • متاحة لك الآن في فترة الاختبار',
          style: TextStyle(color: free ? _freeInk : gold, fontSize: 11.5))),
    ]));
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
      SizedBox(height: 160, child: Stack(fit: StackFit.expand, children: [
        Image.asset('assets/thumbs/city_$c.webp', fit: BoxFit.cover),
        const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
            colors: [Color(0x00171210), Color(0x8C1B150F), Color(0xFA2B2117)], stops: [0.3, 0.62, 1]))),
        PositionedDirectional(start: 14, end: 14, bottom: 6, child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          GoldTitle(cityShort(c), size: 22),
          Text(cityName(c), style: const TextStyle(color: ink, fontSize: 12, shadows: [Shadow(blurRadius: 3)])),
        ])),
      ])),
      Expanded(child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(14, 6, 14, 4), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _status(_freeCity(c)),
        _line(Icons.public_rounded, 'منطقتها: ${REGIONS.m(regionOfCity(c) ?? 'arabic').s('name')}'),
        if (host.isNotEmpty) _line(Icons.flag_rounded, 'مدينة أمة ${nations.m(host.first).s('name')}: مدينة المضيف حين تلعب بها.'),
        if (f != null) _line(Icons.auto_awesome_rounded, 'ميزتها: $f'),
        if (b != null) _line(Icons.account_balance_rounded, 'مبناها: $b'),
      ]))),
      Padding(padding: const EdgeInsets.fromLTRB(14, 0, 14, 8), child: WideButton('عرض المدينة',
          () => Navigator.push(context, MaterialPageRoute(builder: (_) => CityPreview(city: c))), primary: true, width: double.infinity)),
    ]);
  }

  Widget _sideShow() {
    final s = chosenSide, elite = _isElite(s), base = _baseSide(s), nation = _isNation(s) ? nations.m(base) : null;
    final style = nation?.s('style') ?? s, st = nations.m('styles').m(style);
    final names = nation != null
        ? [nation.m('names').s('common'), for (final h in GANGS.m(style).l('heroes').cast<String>()) nation.m('names').s(h), nation.m('names').s('champion')]
        : ['الفرد العادي', for (final h in GANGS.m(s).l('heroes').cast<String>()) HEROES.m(h).s('name'), CHAMPIONS.m(s).s('name')];
    final title = elite ? sideName(s) : nation != null ? nation.s('gangName') : GANGS.m(s).s('name');
    final note = elite ? nation!.s('gangName') : nation != null ? nation.s('name') : sideNote(s);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SizedBox(height: 182, child: Stack(fit: StackFit.expand, children: [
        const DecoratedBox(decoration: BoxDecoration(gradient: RadialGradient(center: Alignment(0, -0.1), radius: 0.95,
            colors: [Color(0xFF5E4628), Color(0xFF1A140E)]))),
        Align(alignment: const Alignment(0, 0.72), child: FractionallySizedBox(widthFactor: 0.92, child: Container(height: 30,
            decoration: const BoxDecoration(borderRadius: BorderRadius.all(Radius.elliptical(160, 15)),
                gradient: RadialGradient(colors: [Color(0x80FFD27A), Color(0x00FFD27A)]))))),
        CharacterShowcase(gang: style, nation: nation != null ? base : null, elite: elite && !normalLook),
        if (elite) PositionedDirectional(top: 8, start: 8, child: Row(children: [
          for (final (normal, label) in const [(false, 'نخبة'), (true, 'عادي')])
            Padding(padding: const EdgeInsetsDirectional.only(end: 6),
                child: _Pill(null, label, on: normalLook == normal, small: true, onTap: () => setState(() => normalLook = normal))),
        ])),
      ])),
      Expanded(child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(14, 8, 14, 8), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(title, style: const TextStyle(color: gold, fontSize: 19, fontWeight: FontWeight.w700, height: 1.2)),
        Text(note, style: const TextStyle(color: Color(0xFFCBBD9F), fontSize: 12)),
        _status(_freeSide(s)),
        if (elite) _line(Icons.auto_awesome_rounded,
            'مظهر أسود وذهبي لـ${nation!.s('gangName')}: الوجه واليدان بلونك، والقدرات كما هي. يُختار بجوار عصابته في الإعداد'),
        _line(Icons.groups_rounded, names.join(' • ')),
        if (nation != null) _line(Icons.bolt_rounded, '«${nation.m('trait').s('name')}»: ${nation.m('trait').s('desc')}'),
        _line(Icons.shield_rounded, 'نمط ${st.s('name')}: ${st.s('desc')}'),
      ]))),
    ]);
  }
}

// زر قرص: أقسام المتجر ومناطقه والرجوع، والمختار بتدرج ذهبي
class _Pill extends StatelessWidget {
  final IconData? icon;
  final String label;
  final bool on, small;
  final VoidCallback onTap;
  const _Pill(this.icon, this.label, {required this.on, this.small = false, required this.onTap});
  @override
  Widget build(BuildContext context) => GestureDetector(onTap: () { sound('ui_tap'); onTap(); }, child: Container(
    height: small ? 30 : 36, padding: EdgeInsets.symmetric(horizontal: small ? 11 : 13),
    decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), gradient: on ? goldGrad : plateGrad,
        border: Border.all(color: on ? const Color(0xFFFFE6A8) : const Color(0x80E2B55A))),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      if (icon != null) ...[Icon(icon, size: 17, color: on ? const Color(0xFF2A1A08) : gold), const SizedBox(width: 6)],
      Text(label, style: TextStyle(fontSize: small ? 12.5 : 14, fontWeight: FontWeight.w700, color: on ? const Color(0xFF1B140C) : ink)),
    ]),
  ));
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
