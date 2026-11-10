// القوائم (js/ui/menus.js وpicker.js وstoreScreen.js، القسم 12): الرئيسية بخلفية مدينة حية، والإعداد بخاناته ولوحاته،
// والإعدادات، والإحصائيات، والمتجر. الصور المصغرة من اللعبة الحالية نفسها (assets/thumbs، scripts/export_thumbs.cjs)
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
import 'match_screen.dart';
import 'prefs.dart';
import 'widgets.dart';

// ===================== إعداد المباراة =====================
const _slotTypes = {'human': 'أنت', 'bot': 'بوت', 'closed': 'مغلقة'};
const _maxSlots = 8;
List<String> get _gangIds => [for (final g in GANG_IDS) g as String];
List<String> get _colorIds => [for (final c in PLAYER_COLORS) (c as J).s('id')];
String colorHex(String id) => (PLAYER_COLORS.firstWhere((c) => (c as J)['id'] == id) as J).s('hex');

class Slot {
  String type, side, color, difficulty;
  int team;
  Slot(this.type, this.side, this.color, this.team, this.difficulty);
  Map<String, Object?> toJson() => {'type': type, 'side': side, 'color': color, 'team': team, 'difficulty': difficulty};
}

class SetupModel {
  String mode = 'conquest', city = CITIES.s('defaultCity'), mapSize = MATCH_DEFAULTS.s('mapSize'), weather = 'day';
  int maxUnits = UNITS.i('maxUnitsDefault');
  List<Slot> slots = [
    for (var k = 0; k < _maxSlots; k++)
      Slot(k == 0 ? 'human' : k < 4 ? 'bot' : 'closed', _gangIds[k % 4], _colorIds[k], 0, 'medium'),
  ];

  static SetupModel load() {
    final m = SetupModel(), j = Prefs.read(UI.s('setupKey'));
    if (j == null) return m;
    if (CITIES.l('order').contains(j['city']) || j['city'] == 'random') m.city = j['city'] as String;
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

  void save() => Prefs.write(UI.s('setupKey'), {'city': city, 'mapSize': mapSize, 'maxUnits': maxUnits, 'slots': [for (final s in slots) s.toJson()]});

  int get limit => MAP_SIZES.m(mapSize).i('maxPlayers');
  List<Slot> get active => slots.where((s) => s.type != 'closed').toList();

  String? validate() {
    final a = active, size = MAP_SIZES.m(mapSize).s('name');
    if (a.length < 2) return 'تحتاج لاعبَين على الأقل: افتح خانة بوت واحدة على الأقل.';
    if (a.length > limit) return 'عدد اللاعبين ${a.length} أكبر من حد الخريطة $size ($limit). أغلق خانة أو كبّر الخريطة.';
    final sides = {for (var k = 0; k < a.length; k++) a[k].team == 0 ? 'solo$k' : 'team${a[k].team}'};
    if (sides.length < 2) return 'كل اللاعبين في فريق واحد: غيّر فريق أحدهم ليكون هناك عدو.';
    if ({for (final s in a) s.color}.length != a.length) return 'لا يمكن أن يتكرر اللون بين لاعبين.';
    return null;
  }

  J build() {
    final rnd = math.Random();
    final a = active;
    return {
      'mode': mode, 'mapSize': mapSize, 'city': city, 'maxUnits': maxUnits, 'weather': weather,
      'players': [
        for (var k = 0; k < a.length; k++)
          {'name': k == 0 ? 'أنت' : 'بوت $k', 'gang': a[k].side == 'random' ? _gangIds[rnd.nextInt(4)] : a[k].side,
            'color': a[k].color, 'isHuman': k == 0, 'team': a[k].team, 'difficulty': a[k].difficulty},
      ],
    };
  }
}

// ponytail: العصابات الكلاسيكية الأربع وحدها حتى الأمم (ن7)
List<String> get _sides => [..._gangIds, 'random'];
String sideName(String side) => side == 'random' ? 'عشوائي' : GANGS.m(side).s('name');
String sideNote(String side) => side == 'random' ? '' : nations.s('classicNote');
String sideDesc(String side) {
  if (side == 'random') return 'عشوائي: عصابة تُختار عند بدء المباراة';
  final st = nations.m('styles').m(side);
  return '${GANGS.m(side).s('name')} (${nations.s('classicNote')}) — نمط ${st.s('name')}: ${st.s('desc')}';
}

String cityName(String city) => city == 'random' ? 'عشوائي' : CITY_THEMES[city]?.name ?? city;
String cityShort(String city) => city == 'random' ? 'عشوائي' : CITIES.m('short').ss(city) ?? city;
String? regionOfCity(String city) {
  for (final r in REGIONS.l('order').cast<String>()) { if (REGIONS.m(r).l('cities').contains(city)) return r; }
  return null;
}

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
    ModalRoute.of(context);       // يُعاد البناء حين تعود القائمة إلى الواجهة: خانة المتابعة بعد الخروج من مباراة
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
      const WideButton('القصة', null, note: 'قريباً في هذه النسخة'),
      const WideButton('لعب محلي', null, note: 'في مرحلة لاحقة من النقل'),
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
  const SetupScreen({super.key});
  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  final m = SetupModel.load();
  String? error;

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
    ], footer: [WideButton('عشوائي', () => Navigator.pop(context, 'random'), width: 160)]));
    if (pick != null) setState(() => m.city = pick);
  }

  Future<void> _pickSide(int k) async {
    final pick = await _sheet<String>(PickerSheet(title: 'العصابة', groups: [
      ('الكلاسيكية', [
        for (final g in _gangIds)
          PickCard(title: sideName(g), note: nations.m('styles').m(g).s('name'), image: 'assets/thumbs/side_$g.webp', aspect: 2.5,
              selected: m.slots[k].side == g, onTap: () => Navigator.pop(context, g)),
      ]),
    ], footer: [WideButton('عشوائي', () => Navigator.pop(context, 'random'), width: 160)]));
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
    final e = m.validate();
    if (e != null) { setState(() => error = e); return; }
    m.save();
    Prefs.remove(UI.s('matchKey'));
    Prefs.remove(UI.s('matchInfoKey'));
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => MatchScreen(settings: m.build())));
  }

  Widget _cell(double w, Widget child, [VoidCallback? onTap]) => SizedBox(width: w, height: 40, child: Material(
      color: card, borderRadius: BorderRadius.circular(7),
      child: InkWell(borderRadius: BorderRadius.circular(7), onTap: onTap, child: Center(child: child))));

  Widget _row(int k) {
    final s = m.slots[k], closed = s.type == 'closed';
    bool openIfClosed() { if (!closed) return false; setState(() => s.type = 'bot'); return true; }
    const st = TextStyle(color: ink, fontSize: 13);
    final level = s.type == 'bot' ? BOT.m(s.difficulty) : null;
    return Opacity(opacity: closed ? 0.45 : 1, child: Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Row(children: [
      SizedBox(width: 18, child: Text('${k + 1}', style: const TextStyle(color: dim, fontSize: 12))),
      _cell(64, Text(_slotTypes[s.type]!, style: st), () { if (k > 0) setState(() => s.type = s.type == 'bot' ? 'closed' : 'bot'); }),
      const SizedBox(width: 4),
      _cell(120, Column(mainAxisSize: MainAxisSize.min, children: [
        Text(sideName(s.side), style: st),
        if (sideNote(s.side).isNotEmpty) Text(sideNote(s.side), style: const TextStyle(color: dim, fontSize: 10)),
      ]), () { if (!openIfClosed()) _pickSide(k); }),
      const SizedBox(width: 4),
      _cell(40, Container(width: 22, height: 22, decoration: BoxDecoration(color: colorOf(colorHex(s.color)), shape: BoxShape.circle)),
          () { if (!openIfClosed()) setState(() => s.color = _nextColor(k)); }),
      const SizedBox(width: 4),
      _cell(64, Text(s.team == 0 ? 'بدون' : 'فريق ${s.team}', style: st), () { if (!openIfClosed()) setState(() => s.team = (s.team + 1) % 5); }),
      const SizedBox(width: 4),
      _cell(82, Column(mainAxisSize: MainAxisSize.min, children: [
        Text(level?.s('name') ?? '—', style: st),
        if (level?.ss('note') != null) Text(level!.s('note'), style: const TextStyle(color: dim, fontSize: 9)),
      ]), () {
        if (openIfClosed() || s.type != 'bot') return;
        setState(() => s.difficulty = BOT_LEVELS[(BOT_LEVELS.indexOf(s.difficulty) + 1) % BOT_LEVELS.length] as String);
      }),
    ])));
  }

  @override
  Widget build(BuildContext context) {
    final size = MAP_SIZES.m(m.mapSize);
    return Scaffold(body: SafeArea(child: Column(children: [
      Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(10), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Column(children: [
          PickTile(title: 'طور اللعب', value: gameModes.m('conquest').s('name'), icon: Icons.flag, width: 300,
              note: 'الأطوار الأخرى في المرحلة التالية'),
          const SizedBox(height: 6),
          PickTile(title: 'المدينة', value: cityShort(m.city), note: m.city == 'random' ? 'تُختار عند البدء' : cityName(m.city),
              image: m.city == 'random' ? null : 'assets/thumbs/city_${m.city}.webp', icon: Icons.location_city, width: 300, onTap: _pickCity),
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
          Text('الخانة الأولى أنت • الحد على هذه الخريطة ${m.limit} لاعبين', style: const TextStyle(color: dim, fontSize: 12)),
          const SizedBox(height: 4),
          for (var k = 0; k < _maxSlots; k++) _row(k),
          const SizedBox(height: 4),
          SizedBox(width: 400, child: Text(sideDesc(m.slots[0].side), style: const TextStyle(color: dim, fontSize: 11.5))),
        ]),
      ]))),
      Container(color: const Color(0xFF1C1611), padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), child: Row(children: [
        Expanded(child: Text(error ?? (Prefs.raw(UI.s('matchKey')) != null ? 'بدء مباراة جديدة يحذف المباراة المحفوظة.' : ''),
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
  void _set(VoidCallback f) { setState(f); Settings.save(); }
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
        const Text('الصوت في مرحلة لاحقة من النقل: تُحفظ القيم الآن', style: TextStyle(color: dim, fontSize: 11)),
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
    final s = chosenSide, st = nations.m('styles').m(s);
    final names = [ 'الفرد العادي', for (final h in GANGS.m(s).l('heroes').cast<String>()) HEROES.m(h).s('name'), CHAMPIONS.m(s).s('name')];
    return _asideBox(Image.asset('assets/thumbs/side_$s.webp', fit: BoxFit.contain), GANGS.m(s).s('name'), true,
        [names.join(' • '), 'نمط ${st.s('name')}: ${st.s('desc')}'], null);
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
        : [('الكلاسيكية', _gangIds)];
    if (region >= groups.length) region = 0;
    final items = groups[region].$2;
    return Scaffold(body: SafeArea(child: Padding(padding: const EdgeInsets.all(10), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Column(children: [
        const Text('المتجر', style: TextStyle(color: gold, fontSize: 20, fontWeight: FontWeight.w800)),
        for (final (k, label, n) in [('maps', 'الخرائط', 24), ('sides', 'العصابات', 4), ('skins', 'المظاهر', 0)])
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
                : PickCard(title: sideName(it), note: CHAMPIONS.m(it).s('name'), image: 'assets/thumbs/side_$it.webp', aspect: 2.5,
                    selected: it == chosenSide, badge: 'مجانية', onTap: () => setState(() => chosenSide = it)),
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
