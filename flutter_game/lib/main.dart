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

const _gold = Color(0xFFE2B55A), _panel = Color(0xE6261E17), _ink = Color(0xFFF2E6CF);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
  runApp(MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'مدينة العصابات',
    theme: ThemeData(brightness: Brightness.dark, colorSchemeSeed: _gold, scaffoldBackgroundColor: const Color(0xFF15110D)),
    builder: (context, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
    home: const CityViewer(),
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
