// مدينة العصابات بـ Flutter (القسم 18 في GAME_SPEC). المرحلة ن1: عارض المدن — أي مدينة من الـ24 بخريطتها
// من المولّد المنقول، تُرسم على كرت الشاشة بأمرين، وتتحرك بإصبع وتتقرب بإصبعين. لا يُرسم شيء والكاميرا ساكنة
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';

import 'config.dart';
import 'core/fmath.dart';
import 'data/cities.dart';
import 'map/generator.dart';
import 'render/city_art.dart';
import 'render/city_layer.dart';
import 'ui/match_screen.dart';

const _gold = Color(0xFFE2B55A), _panel = Color(0xE6261E17), _ink = Color(0xFFF2E6CF);
const _gangs = {'crows': 'الغربان', 'hammers': 'المطارق', 'vipers': 'الأفاعي', 'scorpions': 'العقارب'};
const _levels = {'easy': 'سهل', 'medium': 'متوسط', 'hard': 'صعب', 'insane': 'مجنون'};
const _colors = ['blue', 'red', 'green', 'yellow', 'cyan', 'purple', 'gray', 'orange'];

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
  runApp(MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'مدينة العصابات',
    theme: ThemeData(brightness: Brightness.dark, colorSchemeSeed: _gold, scaffoldBackgroundColor: const Color(0xFF15110D)),
    builder: (context, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
    home: const StartScreen(),
  ));
}

class Camera extends ChangeNotifier {
  double x = 0, y = 0, zoom = CAMERA.startZoom;
  void changed() => notifyListeners();
}

class CityViewer extends StatefulWidget {
  const CityViewer({super.key});
  @override
  State<CityViewer> createState() => CityViewerState();
}

class CityViewerState extends State<CityViewer> {
  final camera = Camera();
  final _random = math.Random();
  String city = 'arab', sizeKey = 'medium';
  GameMap? map;
  CityArt? art;
  CityLayer? layer;
  bool loading = true;
  String timing = '';
  double _lastScale = 1;
  int _frames = 0;
  double _buildUs = 0, _rasterUs = 0;

  @override
  void initState() {
    super.initState();
    SchedulerBinding.instance.addTimingsCallback(_onTimings);
    // نسخة المتصفح للفحص: ?city=hk&size=large&zoom=0.8
    final q = Uri.base.queryParameters;
    if (CITY_THEMES.containsKey(q['city'])) city = q['city']!;
    if (MAP_SIZES.containsKey(q['size'])) sizeKey = q['size']!;
    camera.zoom = double.tryParse(q['zoom'] ?? '') ?? camera.zoom;
    _load();
  }

  @override
  void dispose() {
    SchedulerBinding.instance.removeTimingsCallback(_onTimings);
    layer?.dispose();
    art?.dispose();
    super.dispose();
  }

  // أزمنة الإطارات أثناء التحريك (لا إطارات والكاميرا ساكنة)
  void _onTimings(List<ui.FrameTiming> list) {
    for (final t in list) { _buildUs += t.buildDuration.inMicroseconds; _rasterUs += t.rasterDuration.inMicroseconds; }
    _frames += list.length;
    if (_frames < 30) return;
    final text = 'الإطار: واجهة ${(_buildUs / _frames / 1000).toStringAsFixed(1)} • رسم ${(_rasterUs / _frames / 1000).toStringAsFixed(1)} ملي ث';
    _frames = 0; _buildUs = _rasterUs = 0;
    if (mounted) setState(() => timing = text);
  }

  // خريطة جديدة من المولّد المنقول، وأطلس المدينة إن تغيّرت
  Future<void> _load({bool newArt = true}) async {
    setState(() => loading = true);
    final players = [for (final g in ['crows', 'hammers', 'vipers', 'scorpions']) MapPlayer(g)];
    final m = createMap(sizeKey, players, city, Rng(_random.nextInt(1 << 30)), specials: false, features: true)!;
    var a = art;
    if (newArt || a == null || a.city != city) {
      a = await CityArt.load(city);
      art?.dispose();
    }
    layer?.dispose();
    setState(() {
      map = m;
      art = a;
      layer = CityLayer(m, a!);
      loading = false;
    });
    camera.x = 0;
    camera.y = (m.n - 1) * TILE_HALF_H;
    camera.changed();
  }

  void _onScale(ScaleUpdateDetails d, Size size) {
    final m = map;
    if (m == null) return;
    final fx = d.focalPoint.dx - size.width / 2, fy = d.focalPoint.dy - size.height / 2;
    final wx = camera.x + fx / camera.zoom, wy = camera.y + fy / camera.zoom;   // النقطة تحت الإصبعين تبقى تحتهما
    camera.zoom = (camera.zoom * d.scale / _lastScale).clamp(CAMERA.minZoom, CAMERA.maxZoom);
    _lastScale = d.scale;
    final half = m.n * TILE_HALF_W;
    camera.x = (wx - fx / camera.zoom - d.focalPointDelta.dx / camera.zoom).clamp(-half, half);
    camera.y = (wy - fy / camera.zoom - d.focalPointDelta.dy / camera.zoom).clamp(0.0, m.n * 2 * TILE_HALF_H);
    camera.changed();
  }

  Future<void> _pickCity() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: _panel,
      isScrollControlled: true,
      builder: (context) => _CityPicker(current: city),
    );
    if (picked != null && picked != city) {
      city = picked;
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    return Scaffold(
      body: Stack(children: [
        Positioned.fill(child: GestureDetector(
          onScaleStart: (_) => _lastScale = 1,
          onScaleUpdate: (d) => _onScale(d, size),
          child: CustomPaint(painter: _CityPainter(this), isComplex: true),
        )),
        Positioned(top: 8, right: 8, left: 8, child: Row(children: [
          _Chip(label: CITY_THEMES[city]?.name ?? city, icon: Icons.location_city, onTap: _pickCity),
          const SizedBox(width: 6),
          for (final k in ['small', 'medium', 'large']) Padding(
            padding: const EdgeInsets.only(left: 4),
            child: _Chip(label: MAP_SIZES[k]!.name, selected: k == sizeKey, onTap: () {
              sizeKey = k;
              _load(newArt: false);
            }),
          ),
          const SizedBox(width: 6),
          _Chip(label: 'خريطة جديدة', icon: Icons.refresh, onTap: () => _load(newArt: false)),
          const Spacer(),
          if (timing.isNotEmpty) Text(timing, style: const TextStyle(color: _ink, fontSize: 12,
              shadows: [Shadow(blurRadius: 3, color: Colors.black)])),
        ])),
        if (loading) const Center(child: CircularProgressIndicator(color: _gold)),
      ]),
    );
  }
}

class _CityPainter extends CustomPainter {
  final CityViewerState v;
  _CityPainter(this.v) : super(repaint: v.camera);

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawColor(const Color(0xFF1B1611), BlendMode.src);
    final layer = v.layer, art = v.art;
    if (layer == null || art == null) return;
    final c = v.camera;
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(c.zoom);
    canvas.translate(-c.x, -c.y);
    final halfH = size.height / 2 / c.zoom;
    layer.paint(canvas, art.image, c.y - halfH, c.y + halfH);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_CityPainter old) => true;
}

class _Chip extends StatelessWidget {
  final String label;
  final IconData? icon;
  final bool selected;
  final VoidCallback onTap;
  const _Chip({required this.label, this.icon, this.selected = false, required this.onTap});

  @override
  Widget build(BuildContext context) => Material(
    color: selected ? _gold : _panel,
    borderRadius: BorderRadius.circular(10),
    child: InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[Icon(icon, size: 17, color: selected ? Colors.black : _gold), const SizedBox(width: 6)],
          Text(label, style: TextStyle(fontSize: 14, color: selected ? Colors.black : _ink, fontWeight: FontWeight.w600)),
        ]),
      ),
    ),
  );
}

// المدن حسب المنطقة (REGIONS): تبويب لكل منطقة
class _CityPicker extends StatelessWidget {
  final String current;
  const _CityPicker({required this.current});

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: REGIONS.order.length,
    initialIndex: math.max(0, REGIONS.order.indexWhere((r) => REGIONS.cities[r]!.contains(current))),
    child: SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.7,
      child: Column(children: [
        TabBar(isScrollable: true, labelColor: _gold, indicatorColor: _gold,
            tabs: [for (final r in REGIONS.order) Tab(text: REGIONS.names[r])]),
        Expanded(child: TabBarView(children: [
          for (final r in REGIONS.order) Padding(
            padding: const EdgeInsets.all(12),
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              for (final c in REGIONS.cities[r]!) _Chip(
                label: CITY_THEMES[c]?.name ?? c,
                selected: c == current,
                onTap: () => Navigator.pop(context, c),
              ),
            ]),
          ),
        ])),
      ]),
    ),
  );
}

// إعداد مباراة سريعة (قائمة اللعب الكاملة في ن6): المدينة والحجم وعصابتك وعدد البوتات وصعوبتها
class StartScreen extends StatefulWidget {
  const StartScreen({super.key});
  @override
  State<StartScreen> createState() => _StartScreenState();
}

class _StartScreenState extends State<StartScreen> {
  String city = 'random', sizeKey = 'medium', gang = 'crows', level = 'medium';
  int bots = 3;

  @override
  void initState() {
    super.initState();
    // للفحص في المتصفح: ?match=1&city=hk&size=small&bots=3&ff=60&watch=1&spectate=1&zoom=3
    final q = Uri.base.queryParameters;
    if (CITY_THEMES.containsKey(q['city'])) city = q['city']!;
    if (MAP_SIZES.containsKey(q['size'])) sizeKey = q['size']!;
    bots = int.tryParse(q['bots'] ?? '') ?? bots;
    if (q['match'] == '1') WidgetsBinding.instance.addPostFrameCallback((_) => _play(test: q));
  }

  Future<void> _pickCity() async {
    final picked = await showModalBottomSheet<String>(context: context, backgroundColor: _panel, isScrollControlled: true,
        builder: (context) => _CityPicker(current: city));
    if (picked != null) setState(() => city = picked);
  }

  void _play({Map<String, String>? test}) {
    final ids = ['crows', 'hammers', 'vipers', 'scorpions'];
    final players = <Map<String, Object?>>[
      {'name': 'أنت', 'gang': gang, 'color': _colors[0], 'isHuman': test?['spectate'] != '1', 'team': 0, 'difficulty': level},
      for (var k = 0; k < bots; k++)
        {'name': 'بوت ${k + 1}', 'gang': ids[(ids.indexOf(gang) + 1 + k) % 4], 'color': _colors[k + 1], 'isHuman': false, 'team': 0, 'difficulty': level},
    ];
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => MatchScreen(settings: {
      'mapSize': sizeKey, 'city': city, 'weather': 'day', 'mode': 'conquest', 'maxUnits': 100, 'players': players,
      if (test != null) 'ff': double.tryParse(test['ff'] ?? '') ?? 0,
      if (test != null) 'watch': test['watch'] == '1',
      if (test != null) 'zoom': double.tryParse(test['zoom'] ?? ''),
    })));
  }

  @override
  Widget build(BuildContext context) {
    final maxBots = MAP_SIZES[sizeKey]!.maxPlayers - 1;
    if (bots > maxBots) bots = maxBots;
    Widget row(String label, List<Widget> chips) => Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Row(children: [
      SizedBox(width: 90, child: Text(label, style: const TextStyle(color: _ink, fontSize: 15))),
      Expanded(child: Wrap(spacing: 6, runSpacing: 6, children: chips)),
    ]));
    return Scaffold(body: SafeArea(child: Center(child: SingleChildScrollView(child: Container(
      constraints: const BoxConstraints(maxWidth: 640),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('مدينة العصابات', textAlign: TextAlign.center, style: TextStyle(color: _gold, fontSize: 28, fontWeight: FontWeight.w800)),
        const Text('النسخة الجديدة • السيطرة الكاملة', textAlign: TextAlign.center, style: TextStyle(color: _ink, fontSize: 13)),
        const SizedBox(height: 12),
        row('المدينة', [_Chip(label: city == 'random' ? 'عشوائية' : CITY_THEMES[city]?.name ?? city, icon: Icons.location_city, onTap: _pickCity),
          if (city != 'random') _Chip(label: 'عشوائية', onTap: () => setState(() => city = 'random'))]),
        row('الحجم', [for (final k in ['small', 'medium', 'large'])
          _Chip(label: MAP_SIZES[k]!.name, selected: k == sizeKey, onTap: () => setState(() => sizeKey = k))]),
        row('عصابتك', [for (final e in _gangs.entries) _Chip(label: e.value, selected: e.key == gang, onTap: () => setState(() => gang = e.key))]),
        row('البوتات', [for (var n = 1; n <= maxBots; n++) _Chip(label: '$n', selected: n == bots, onTap: () => setState(() => bots = n))]),
        row('الصعوبة', [for (final e in _levels.entries) _Chip(label: e.value, selected: e.key == level, onTap: () => setState(() => level = e.key))]),
        const SizedBox(height: 14),
        SizedBox(height: 54, child: FilledButton(style: FilledButton.styleFrom(backgroundColor: _gold, foregroundColor: Colors.black),
            onPressed: _play, child: const Text('ابدأ المباراة', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)))),
        const SizedBox(height: 8),
        TextButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CityViewer())),
            child: const Text('عرض المدن', style: TextStyle(color: _gold))),
      ]),
    )))));
  }
}
