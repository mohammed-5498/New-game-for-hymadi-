// القوائم (js/ui/menus.js وpicker.js وstoreScreen.js، القسم 12): الرئيسية بخلفية مدينة حية، والإعداد بخاناته ولوحاته،
// والإعدادات، والإحصائيات، والمتجر. الصور المصغرة من اللعبة الحالية نفسها (assets/thumbs، scripts/export_thumbs.cjs)
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/cities.dart';
import '../data/js_config.dart';
import '../map/generator.dart';
import '../render/city_art.dart';
import '../render/city_layer.dart';
import '../audio/sound.dart';
import '../game/match.dart';
import '../game/state.dart';
import '../net/session.dart';
import 'lan_screen.dart';
import 'match_screen.dart';
import 'prefs.dart';
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
    if (CITIES.l('order').contains(j['city']) || j['city'] == 'random' || j['city'] == 'host') m.city = j['city'] as String;
    if (MAP_SIZES.has('${j['mapSize']}')) m.mapSize = j['mapSize'] as String;
    if (UNITS.l('maxUnitsChoices').contains(j['maxUnits'])) m.maxUnits = j['maxUnits'] as int;
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
    'survivalLevel': survivalLevel, 'city': city, 'mapSize': mapSize, 'maxUnits': maxUnits, 'slots': [for (final s in slots) s.toJson()]});

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
      'city': city == 'host' ? hostCity(players[0]['nation'] as String?) : city,
      'maxUnits': maxUnits, 'weather': weather, 'players': players,
    };
  }
}

// الأمة ← نمطها القتالي، والعشوائي من كل الخيارات (resolveSide في nations.js)
Map<String, Object?> resolveSide(String choice) {
  if (choice == 'random') choice = _sides[math.Random().nextInt(_sides.length - 1)];
  final nation = nations.mm(choice);
  if (nation != null && nations.l('order').contains(choice)) return {'gang': nation.s('style'), 'nation': choice};
  return {'gang': _gangIds.contains(choice) ? choice : _gangIds[0], 'nation': null};
}

String hostCity(String? side) {
  final n = side != null && nations.l('order').contains(side) ? nations.m(side) : null;
  return n != null && CITIES.l('order').contains(n['city']) ? n.s('city') : 'random';
}

// الأمم الـ15 ثم العصابات الكلاسيكية الأربع ثم العشوائي (SIDE_CHOICES)
List<String> get _nationIds => nations.l('order').cast<String>();
List<String> get _sides => [..._nationIds, ..._gangIds, 'random'];
bool _isNation(String side) => _nationIds.contains(side);
String sideName(String side) => side == 'random' ? 'عشوائي' : _isNation(side) ? nations.m(side).s('name') : GANGS.m(side).s('name');
String sideNote(String side) => side == 'random' ? '' : _isNation(side) ? nations.m(side).s('gangName') : nations.s('classicNote');
String sideDesc(String side) {
  if (side == 'random') return 'عشوائي: أمة أو عصابة كلاسيكية تُختار عند بدء المباراة';
  if (_isNation(side)) {
    final n = nations.m(side);
    return '${n.s('name')} «${n.s('gangName')}» — «${n.m('trait').s('name')}»: ${n.m('trait').s('desc')}';
  }
  final st = nations.m('styles').m(side);
  return '${GANGS.m(side).s('name')} (${nations.s('classicNote')}) — نمط ${st.s('name')}: ${st.s('desc')}';
}

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

// لوحة الأمم والعصابات (الإعداد وأمة الصديق في اللعب المحلي)
Future<String?> pickSide(BuildContext context, String current) => showModalBottomSheet<String>(context: context, backgroundColor: panel,
    isScrollControlled: true, builder: (_) => PickerSheet(title: 'الأمة أو العصابة', groups: [
      for (final (name, list) in sideGroups)
        (name, [
          for (final g in list)
            PickCard(title: sideName(g), note: _isNation(g) ? '${sideNote(g)} • ${nations.m('styles').m(nations.m(g).s('style')).s('name')}'
                : nations.m('styles').m(g).s('name'), image: 'assets/thumbs/side_$g.webp', aspect: 2.5,
                selected: current == g, onTap: () => Navigator.pop(context, g)),
        ]),
    ], footer: [WideButton('عشوائي', () => Navigator.pop(context, 'random'), width: 160)]));

// ===================== القائمة الرئيسية =====================
class MainMenu extends StatefulWidget {
  const MainMenu({super.key});
  @override
  State<MainMenu> createState() => _MainMenuState();
}

class _MainMenuState extends State<MainMenu> {
  Future<void> _go(Widget screen) => Navigator.of(context).push(PageRouteBuilder(pageBuilder: (_, _, _) => screen,
      transitionDuration: Duration(milliseconds: UI.i('fadeMs')),
      transitionsBuilder: (_, a, _, child) => FadeTransition(opacity: a, child: child)));

  @override
  Widget build(BuildContext context) {
    final route = ModalRoute.of(context);   // يُعاد البناء حين تعود القائمة إلى الواجهة: خانة المتابعة بعد الخروج من مباراة
    if (route?.isCurrent ?? true) GameSound.menuMusic(true);
    final saved = Prefs.read(UI.s('matchInfoKey'));
    return Scaffold(body: Stack(children: [
    const Positioned.fill(child: MenuBackdrop()),
    Positioned.fill(child: Container(color: const Color(0x66000000))),
    Center(child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Text('مدينة العصابات', style: TextStyle(color: gold, fontSize: 30, fontWeight: FontWeight.w900,
          shadows: [Shadow(blurRadius: 8, color: Colors.black)])),
      const SizedBox(height: 6),
      if (saved != null) WideButton('متابعة المباراة', () => _go(const MatchScreen(resume: true)), primary: true,
          note: '${cityShort('${saved['city']}')} • ${clock((saved['time'] as num).toDouble())}'),
      WideButton('لعب', () => _go(const SetupScreen()), primary: saved == null),
      WideButton('القصة', () => _go(const StoryScreen()), note: 'حملة أبناء سبأ'),
      WideButton('لعب محلي', () => _go(const LanScreen()), note: 'مع الأصدقاء على نفس الواي فاي'),
      Row(mainAxisSize: MainAxisSize.min, children: [
        WideButton('المتجر', () => _go(const StoreScreen()), width: 124),
        const SizedBox(width: 6),
        WideButton('الإعدادات', () => _go(const SettingsScreen()), width: 124),
        const SizedBox(width: 6),
        WideButton('الإحصائيات', () => _go(const StatsScreen()), width: 124),
      ]),
    ]))),
  ]));
  }
}

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
  final _frame = ValueNotifier(0);
  double x = 0, y = 0, vx = 0, vy = 0;
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
    final cities = CITIES.l('order').cast<String>();
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
    if (dt < 1 / _M.d('fps') && _last != Duration.zero) return;
    _last = now;
    final half = m.n * TILE_HALF_W * (1 - _M.d('edgeMargin')), lo = m.n * TILE_HALF_H * _M.d('edgeMargin'), hi = m.n * 2 * TILE_HALF_H - lo;
    x += vx * dt; y += vy * dt;
    if (x.abs() > half) { vx = -vx; x = x.clamp(-half, half); }
    if (y < lo || y > hi) { vy = -vy; y = y.clamp(lo, hi); }
    _frame.value++;
  }

  @override
  void dispose() {
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
    final z = v._M.d('zoom');
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
          for (final c in REGIONS.m(r).l('cities').cast<String>())
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
            PickTile(title: 'الطقس', value: WEATHER.m('day').s('name'), note: 'البقية لاحقاً', icon: Icons.wb_sunny, width: 96),
            const SizedBox(width: 6),
            PickTile(title: 'الحد', value: '${m.maxUnits} وحدة', note: 'لكل لاعب', icon: Icons.groups, width: 96,
                onTap: () => _choose<int>('الحد الأقصى للوحدات', [for (final v in UNITS.l('maxUnitsChoices')) v as int], (v) => '$v', m.maxUnits, (v) => m.maxUnits = v)),
          ]),
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
          const SizedBox(height: 4),
          SizedBox(width: 400, child: Text(sideDesc(m.slots[0].side), style: const TextStyle(color: dim, fontSize: 11.5))),
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
    final names = {'auto': 'تلقائي', for (final k in ['high', 'medium', 'low']) k: GRAPHICS.m('levels').m(k).s('name')};
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
        ListTile(dense: true, title: const Text('جودة الرسم', style: TextStyle(color: ink, fontSize: 15)),
            trailing: Text(names[Settings.quality]!, style: const TextStyle(color: gold, fontSize: 15)),
            onTap: () => _set(() { final o = GRAPHICS.l('order'); Settings.quality = o[(o.indexOf(Settings.quality) + 1) % o.length] as String; })),
        Toggle('توفير البطارية (30 إطاراً)', Settings.battery, (v) => _set(() => Settings.battery = v)),
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

// ===================== المتجر (storeScreen.js) =====================
class StoreScreen extends StatefulWidget {
  const StoreScreen({super.key});
  @override
  State<StoreScreen> createState() => _StoreScreenState();
}

class _StoreScreenState extends State<StoreScreen> {
  String section = 'maps', chosenMap = 'arab', chosenSide = 'crows';
  int region = 0;

  bool _freeCity(String c) => STORE.l('freeCities').contains(c);

  Widget _aside() {
    if (section == 'maps') {
      final c = chosenMap, free = _freeCity(c);
      final lines = <String>['منطقتها: ${REGIONS.m(regionOfCity(c) ?? 'arabic').s('name')}'];
      final host = nations.l('order').cast<String>().where((n) => nations.m(n).s('city') == c);
      if (host.isNotEmpty) lines.add('مدينة أمة ${nations.m(host.first).s('name')}: مدينة المضيف حين تلعب بها.');
      final f = CITY_FEATURES.m('desc')[CITY_FEATURES.m('cities')[c]], b = CITY_FEATURES.m('desc')[CITY_FEATURES.m('buildings')[c]];
      if (f != null) lines.add('ميزتها: $f');
      if (b != null) lines.add('مبناها: $b');
      return _asideBox(Image.asset('assets/thumbs/city_$c.webp', fit: BoxFit.cover), cityName(c), free, lines,
          WideButton('عرض المدينة', () => Navigator.push(context, MaterialPageRoute(builder: (_) => CityPreview(city: c))), width: 200));
    }
    final s = chosenSide, nation = _isNation(s) ? nations.m(s) : null, style = nation?.s('style') ?? s, st = nations.m('styles').m(style);
    final names = nation != null
        ? [nation.m('names').s('common'), for (final h in GANGS.m(style).l('heroes').cast<String>()) nation.m('names').s(h), nation.m('names').s('champion')]
        : ['الفرد العادي', for (final h in GANGS.m(s).l('heroes').cast<String>()) HEROES.m(h).s('name'), CHAMPIONS.m(s).s('name')];
    final free = _gangIds.contains(s);
    return _asideBox(Image.asset('assets/thumbs/side_$s.webp', fit: BoxFit.contain), nation != null ? '${nation.s('gangName')} — ${nation.s('name')}' : GANGS.m(s).s('name'), free,
        [names.join(' • '), if (nation != null) '«${nation.m('trait').s('name')}»: ${nation.m('trait').s('desc')}', 'نمط ${st.s('name')}: ${st.s('desc')}'], null);
  }

  Widget _asideBox(Widget image, String title, bool free, List<String> lines, Widget? action) => SizedBox(width: 280, child: Column(
    crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      ClipRRect(borderRadius: BorderRadius.circular(10), child: AspectRatio(aspectRatio: 2, child: Container(color: card, child: image))),
      const SizedBox(height: 6),
      Text(title, style: const TextStyle(color: gold, fontSize: 16, fontWeight: FontWeight.w800)),
      Text(free ? 'مجانية • تأتي مع اللاعب' : 'السعر: يُحدد لاحقاً • متاحة لك الآن في فترة الاختبار',
          style: TextStyle(color: free ? const Color(0xFF9FD07C) : gold, fontSize: 12)),
      const SizedBox(height: 4),
      for (final l in lines) Padding(padding: const EdgeInsets.only(bottom: 3), child: Text(l, style: const TextStyle(color: ink, fontSize: 12))),
      if (action != null) action,
    ]));

  @override
  Widget build(BuildContext context) {
    final groups = section == 'maps'
        ? [for (final r in REGIONS.l('order').cast<String>()) (REGIONS.m(r).s('name'), REGIONS.m(r).l('cities').cast<String>())]
        : sideGroups;
    if (region >= groups.length) region = 0;
    final items = groups[region].$2;
    return Scaffold(body: SafeArea(child: Padding(padding: const EdgeInsets.all(10), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Column(children: [
        const Text('المتجر', style: TextStyle(color: gold, fontSize: 20, fontWeight: FontWeight.w800)),
        for (final (k, label, n) in [('maps', 'الخرائط', 24), ('sides', 'العصابات', _sides.length - 1), ('skins', 'المظاهر', 0)])
          Padding(padding: const EdgeInsets.only(top: 6), child: SizedBox(width: 150, child: ChoiceChip(
              label: Text('$label ($n)'), selected: section == k, onSelected: k == 'skins' ? null : (_) => setState(() { section = k; region = 0; })))),
        const Spacer(),
        WideButton('رجوع', () => Navigator.pop(context), ghost: true, width: 120),
      ]),
      const SizedBox(width: 10),
      Expanded(child: Column(children: [
        if (groups.length > 1) SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
          for (var k = 0; k < groups.length; k++) Padding(padding: const EdgeInsets.only(left: 6),
              child: ChoiceChip(label: Text('${groups[k].$1} ${groups[k].$2.length}'), selected: region == k, onSelected: (_) => setState(() => region = k))),
        ])),
        Expanded(child: GridView.extent(maxCrossAxisExtent: 190, childAspectRatio: 1.45, padding: const EdgeInsets.only(top: 8),
            mainAxisSpacing: 8, crossAxisSpacing: 8, children: [
          for (final it in items)
            section == 'maps'
                ? PickCard(title: cityShort(it), note: cityName(it), image: 'assets/thumbs/city_$it.webp', selected: it == chosenMap,
                    badge: _freeCity(it) ? 'مجانية' : 'السعر لاحقاً', onTap: () => setState(() => chosenMap = it))
                : PickCard(title: sideName(it), note: sideNote(it), image: 'assets/thumbs/side_$it.webp', aspect: 2.5,
                    selected: it == chosenSide, badge: _gangIds.contains(it) ? 'مجانية' : 'السعر لاحقاً', onTap: () => setState(() => chosenSide = it)),
        ])),
      ])),
      const SizedBox(width: 10),
      SingleChildScrollView(child: _aside()),
    ]))));
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
