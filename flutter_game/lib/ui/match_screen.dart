// شاشة المباراة: الحلقة (20 تحديثاً في الثانية بالمنطق المنقول، والرسم بإيقاع الشاشة بتنعيم بين تحديثين)،
// والكاميرا، ورسم المدينة صفاً صفاً بالعمق والجنود في صفوفهم، واللمس (js/ui/input.js): تحديد وتحريك وهجوم
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../game/capture.dart';
import '../game/combat.dart';
import '../game/match.dart';
import '../game/state.dart';
import '../game/units.dart';
import '../map/generator.dart';
import '../render/batch.dart';
import '../render/city_art.dart';
import '../render/city_layer.dart';
import '../render/fx_art.dart';
import '../render/unit_art.dart';
import '../render/unit_atlas.dart';
import 'hud.dart';

class MatchScreen extends StatefulWidget {
  final J settings;
  const MatchScreen({super.key, required this.settings});
  @override
  State<MatchScreen> createState() => MatchScreenState();
}

class MatchScreenState extends State<MatchScreen> with SingleTickerProviderStateMixin {
  MatchState? state;
  CityArt? art;
  CityLayer? layer;
  UnitAtlas? units;
  late final Ticker _ticker;
  final frame = ValueNotifier<int>(0), hud = ValueNotifier<int>(0);
  Duration _last = Duration.zero;
  double _acc = 0, alpha = 0, _lastScale = 1;
  int _mapVersion = 0, _ticks = 0;
  bool selectMode = false, paused = false;
  Offset? boxStart, boxEnd;
  int? menuDistrict;
  Unit? _lastTapUnit;
  int _lastTapAt = 0, _lastDistrictTapAt = 0, _lastDistrictTap = -1;
  final batch = TriBatch();

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick);
    _start();
  }

  @override
  void dispose() {
    _ticker.dispose();
    layer?.dispose();
    art?.dispose();
    units?.image.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    simRng = Rng(DateTime.now().microsecondsSinceEpoch & 0x7FFFFFFF);
    final s = createMatch(widget.settings);
    s.running = true;
    // للفحص في المتصفح (?ff=ثوانٍ): تقديم المباراة قبل عرضها
    final ff = (widget.settings['ff'] as num?)?.toDouble() ?? 0;
    for (var t = 0.0; t < ff && s.matchResult == null; t += TICK_SEC) { updateMatch(s); }
    final a = await CityArt.load(s.map.city);
    final pairs = [for (final p in s.players) if (!p.passive) (p.gang, p.gang == 'police' ? UNIT_ART.s('policeColor') : p.color)];
    final u = await buildUnitAtlas(pairs);
    batch.whiteU = 1.5; batch.whiteV = 1.5;
    if (!mounted) return;
    final z = (widget.settings['zoom'] as num?)?.toDouble();
    if (z != null) s.camera.z = z;
    setState(() {
      state = s;
      art = a;
      units = u;
      layer = CityLayer(s.map, a);
      _mapVersion = s.mapVersion;
    });
    _ticker.start();
  }

  void restart() {
    _ticker.stop();
    layer?.dispose();
    art?.dispose();
    units?.image.dispose();
    setState(() { state = null; layer = null; art = null; units = null; menuDistrict = null; paused = false; });
    _last = Duration.zero; _acc = 0;
    _start();
  }

  void _onTick(Duration now) {
    final s = state;
    if (s == null) return;
    var dt = _last == Duration.zero ? 0.0 : (now - _last).inMicroseconds / 1e6;
    _last = now;
    if (paused || s.matchResult != null) dt = 0;
    _acc = math.min(_acc + dt, 0.25);
    while (_acc >= TICK_SEC) {
      updateMatch(s);
      _acc -= TICK_SEC;
      if (++_ticks % 5 == 0) hud.value++;
      if (s.matchResult != null) { hud.value++; break; }
    }
    alpha = _acc / TICK_SEC;
    if (widget.settings['watch'] == true && _ticks % 20 == 0) _watch(s);
    if (s.mapVersion != _mapVersion) {
      _mapVersion = s.mapVersion;
      layer?.dispose();
      layer = CityLayer(s.map, art!);
    }
    _retint(s);
    frame.value++;
  }

  // للفحص (?watch=1): الكاميرا على أكبر اشتباك
  void _watch(MatchState s) {
    Unit? best;
    var most = 0;
    for (final u in s.units) {
      if (u.state != 'attacking') continue;
      var n = 0;
      for (final o in s.units) { if (o.state == 'attacking' && (o.x - u.x).abs() < 4 && (o.y - u.y).abs() < 4) n++; }
      if (n > most) { most = n; best = u; }
    }
    if (best != null) centerOn(best.x, best.y);
  }

  final J _cap = CAPTURE;
  void _retint(MatchState s) {
    final steps = _cap.d('tintSteps');
    layer?.retint([for (final d in s.map.districts) (d.tintColor, d.tintColor == null ? 0.0 : jsRound(d.tintMix * steps) / steps)],
        _cap.d('groundTintAlpha'), _cap.d('groundTintChroma'), _cap.d('wallTintAlpha'), _cap.d('tintChroma'));
  }

  // --- الكاميرا ---
  void _clamp(MatchState s) {
    final half = s.map.n * TILE_HALF_W;
    s.camera.x = s.camera.x.clamp(-half, half);
    s.camera.y = s.camera.y.clamp(0.0, s.map.n * 2 * TILE_HALF_H);
  }

  Offset toWorld(MatchState s, Offset p, Size size) =>
      Offset(s.camera.x + (p.dx - size.width / 2) / s.camera.z, s.camera.y + (p.dy - size.height / 2) / s.camera.z);
  Offset toScreen(MatchState s, double wx, double wy, Size size) =>
      Offset((wx - s.camera.x) * s.camera.z + size.width / 2, (wy - s.camera.y) * s.camera.z + size.height / 2);
  (double, double) worldToTile(double x, double y) => ((x / TILE_HALF_W + y / TILE_HALF_H) / 2, (y / TILE_HALF_H - x / TILE_HALF_W) / 2);

  void centerOn(double i, double j) {
    final s = state;
    if (s == null) return;
    s.camera.x = (i - j) * TILE_HALF_W;
    s.camera.y = (i + j) * TILE_HALF_H;
    _clamp(s);
  }

  void _onScaleStart(ScaleStartDetails d) {
    _lastScale = 1;
    if (selectMode && d.pointerCount == 1) { boxStart = d.localFocalPoint; boxEnd = d.localFocalPoint; }
  }

  void _onScale(ScaleUpdateDetails d, Size size) {
    final s = state;
    if (s == null) return;
    if (boxStart != null && d.pointerCount == 1) { boxEnd = d.localFocalPoint; return; }
    final c = s.camera;
    final fx = d.localFocalPoint.dx - size.width / 2, fy = d.localFocalPoint.dy - size.height / 2;
    final wx = c.x + fx / c.z, wy = c.y + fy / c.z;
    c.z = (c.z * d.scale / _lastScale).clamp(CAMERA.d('minZoom'), CAMERA.d('maxZoom'));
    _lastScale = d.scale;
    c.x = wx - fx / c.z - d.focalPointDelta.dx / c.z;
    c.y = wy - fy / c.z - d.focalPointDelta.dy / c.z;
    _clamp(s);
  }

  void _onScaleEnd(Size size) {
    final s = state, a = boxStart, b = boxEnd;
    boxStart = null; boxEnd = null;
    if (s == null || a == null || b == null) return;
    final r = Rect.fromPoints(a, b);
    if (r.width < 8 && r.height < 8) return;
    var n = 0;
    for (final u in s.units) {
      if (u.playerId != s.humanId || u.state == 'dead') { u.selected = false; continue; }
      final p = toScreen(s, (u.x - u.y) * TILE_HALF_W, (u.x + u.y) * TILE_HALF_H - 8, size);
      u.selected = r.contains(p);
      if (u.selected) n++;
    }
    if (n > 0) setState(() => selectMode = false);
    hud.value++;
  }

  Unit? _unitAt(MatchState s, Offset p, Size size) {
    Unit? best;
    var bestD = INPUT.d('unitTapRadiusPx');
    for (final u in s.units) {
      if (u.state == 'dead') continue;
      final q = toScreen(s, (u.x - u.y) * TILE_HALF_W, (u.x + u.y) * TILE_HALF_H - 8 * s.camera.z / 2.2, size);
      final d = (q - p).distance;
      if (d < bestD) { bestD = d; best = u; }
    }
    return best;
  }

  District? _areaAt(MatchState s, Offset p, Size size) {
    final w = toWorld(s, p, size);
    final (ti, tj) = worldToTile(w.dx, w.dy);
    final i = jsRound(ti), j = jsRound(tj), m = s.map;
    if (i < 0 || j < 0 || i >= m.n || j >= m.n || m.areaAt == null) return null;
    final id = m.areaAt![j * m.n + i];
    return id >= 0 && id < m.districts.length ? m.districts[id] : null;
  }

  void _onTap(TapUpDetails d, Size size) {
    final s = state;
    if (s == null || s.matchResult != null) return;
    final p = d.localPosition, now = DateTime.now().millisecondsSinceEpoch;
    final hit = _unitAt(s, p, size);
    // لمستان سريعتان على حي تملكه تفتحان قائمته (empireMenu)
    final area = hit != null && hit.playerId == s.humanId ? null : _areaAt(s, p, size);
    final mine = area != null && area.owner == s.humanId ? area : null;
    if (mine != null && _lastDistrictTap == mine.id && now - _lastDistrictTapAt <= INPUT.i('doubleTapMs')) {
      _lastDistrictTap = -1;
      for (final u in s.units) { u.selected = false; }
      setState(() => menuDistrict = mine.id);
      return;
    }
    _lastDistrictTap = mine?.id ?? -1;
    _lastDistrictTapAt = now;
    if (menuDistrict != null) { setState(() => menuDistrict = null); return; }
    final group = s.units.where((u) => u.selected && u.state != 'dead').toList();
    // لمسة ثانية قرب الجندي نفسه: تحديد من حوله
    final last = _lastTapUnit;
    if (last != null && now - _lastTapAt <= INPUT.i('doubleTapMs')) {
      final q = toScreen(s, (last.x - last.y) * TILE_HALF_W, (last.x + last.y) * TILE_HALF_H, size);
      if ((q - p).distance <= INPUT.d('doubleTapSlackPx')) {
        final r = INPUT.d('groupSelectRadiusTiles');
        for (final u in s.units) {
          u.selected = u.playerId == last.playerId && u.state != 'dead' &&
              (u.x - last.x) * (u.x - last.x) + (u.y - last.y) * (u.y - last.y) <= r * r;
        }
        _lastTapUnit = null;
        hud.value++;
        return;
      }
    }
    if (hit != null && hit.playerId == s.humanId) {
      for (final u in s.units) { u.selected = false; }
      hit.selected = true;
      _lastTapUnit = hit;
      _lastTapAt = now;
      hud.value++;
      return;
    }
    _lastTapUnit = null;
    if (group.isEmpty) return;
    if (hit != null && isEnemy(s, group[0], hit)) { commandAttack(s, group, hit); return; }
    final w = toWorld(s, p, size);
    final (ti, tj) = worldToTile(w.dx, w.dy);
    commandMove(s, ti, tj, group);
  }

  void _onLongPress(LongPressStartDetails d, Size size) {
    final s = state;
    if (s == null) return;
    final area = _areaAt(s, d.localPosition, size);
    if (area != null && area.owner == s.humanId) {
      for (final u in s.units) { u.selected = false; }
      setState(() => menuDistrict = area.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = state;
    if (s == null || art == null || units == null) {
      return const Scaffold(body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        CircularProgressIndicator(color: gold), SizedBox(height: 12), Text('تجهيز المدينة...', style: TextStyle(color: ink)),
      ])));
    }
    final size = MediaQuery.sizeOf(context);
    s.viewW = size.width; s.viewH = size.height;
    return Scaffold(
      body: Stack(children: [
        Positioned.fill(child: GestureDetector(
          onScaleStart: _onScaleStart,
          onScaleUpdate: (d) => _onScale(d, size),
          onScaleEnd: (_) => _onScaleEnd(size),
          onTapUp: (d) => _onTap(d, size),
          onLongPressStart: (d) => _onLongPress(d, size),
          child: CustomPaint(painter: _MatchPainter(this), isComplex: true),
        )),
        Positioned.fill(child: MatchHud(screen: this)),
      ]),
    );
  }
}

class _MatchPainter extends CustomPainter {
  final MatchScreenState v;
  _MatchPainter(this.v) : super(repaint: v.frame);

  final _rows = <List<Unit>>[];
  static final _pops = <String, ui.Paragraph>{};

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawColor(const Color(0xFF1B1611), BlendMode.src);
    final s = v.state, layer = v.layer, art = v.art, atlas = v.units;
    if (s == null || layer == null || art == null || atlas == null) return;
    final c = s.camera, b = v.batch, alpha = v.alpha, img = atlas.image;
    final time = s.time + alpha * TICK_SEC;
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(c.z);
    canvas.translate(-c.x, -c.y);
    final halfW = size.width / 2 / c.z, halfH = size.height / 2 / c.z;
    final left = c.x - halfW - 40, right = c.x + halfW + 40, top = c.y - halfH - 20, bottom = c.y + halfH + 60;
    final depths = 2 * s.map.n - 1;
    while (_rows.length < depths) { _rows.add([]); }
    for (final r in _rows) { r.clear(); }
    var visible = 0;
    for (final u in s.units) {
      final i = u.prevX + (u.x - u.prevX) * alpha, j = u.prevY + (u.y - u.prevY) * alpha;
      final x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
      if (x < left || x > right || y < top || y > bottom) continue;
      final d = (i + j).floor().clamp(0, depths - 1);
      _rows[d].add(u);
      visible++;
    }
    final crowded = visible > COMBAT_REALISM.m('lod').i('fullUnits');
    b.reset();
    layer.paint(canvas, art.image, c.y - halfH, c.y + halfH, onGround: () {
      _borders(b, s);
      for (final f in s.fires) { drawFire(b, f, time); }
      for (final u in s.units) { if (u.state != 'dead' && truthy(u.stats['aura']) && u.playerId == s.humanId) drawAura(b, u, alpha); }
      b.flush(canvas, img);
    }, afterRow: (d) {
      for (final fl in _flagsAt(s, d)) { _flag(b, s, fl, time); }
      final row = _rows[d];
      if (row.isNotEmpty) {
        row.sort((p, q) => (p.x + p.y).compareTo(q.x + q.y));
        for (final u in row) { drawUnit(b, atlas, u, alpha, c.z, time, crowded); }
      }
      b.flush(canvas, img);
    });
    for (final shot in s.projectiles) { drawProjectile(b, shot, alpha); }
    for (final fx in s.fx) {
      final gx = (fx.x - fx.y) * TILE_HALF_W, gy = (fx.x + fx.y) * TILE_HALF_H;
      drawImpact(b, fx, gx, gy, UNIT_ART.d('scale'), fx.t + alpha * TICK_SEC);
    }
    for (final cl in s.clashes) { drawClash(b, (cl.x - cl.y) * TILE_HALF_W, (cl.x + cl.y) * TILE_HALF_H - 8, cl.t); }
    for (final fx in s.ultFx) { drawUltFx(b, fx); }
    for (final u in s.units) { if (u.selected && u.state != 'dead') drawSelectionRing(b, u, alpha); }
    if (s.moveMarker != null) drawMoveMarker(b, s.moveMarker!);
    b.flush(canvas, img);
    _drawPops(canvas, s);
    canvas.restore();
    final bs = v.boxStart, be = v.boxEnd;
    if (bs != null && be != null) {
      final r = Rect.fromPoints(bs, be);
      canvas.drawRect(r, Paint()..color = const Color(0x33F3EAD6));
      canvas.drawRect(r, Paint()..color = const Color(0xCCF3EAD6)..style = PaintingStyle.stroke..strokeWidth = 1);
    }
  }

  // حدود الأحياء المملوكة بلون مالكها (CAPTURE.border)
  static final _edges = Expando<List<List<double>>>();
  void _borders(TriBatch b, MatchState s) {
    final m = s.map;
    final edges = _edges[m] ??= _buildEdges(m);
    final B = CAPTURE.m('border');
    for (final d in m.districts) {
      if (d.tintColor == null || d.tintMix <= 0) continue;
      final col = hexRgb(d.tintColor!), al = B.d('alpha') * d.tintMix;
      final e = edges[d.id];
      for (var k = 0; k < e.length; k += 4) { b.line(e[k], e[k + 1], e[k + 2], e[k + 3], B.d('underWidth'), 0x18120c, 0.45 * d.tintMix); }
      for (var k = 0; k < e.length; k += 4) { b.line(e[k], e[k + 1], e[k + 2], e[k + 3], B.d('width'), col, al); }
    }
    // أسوار الأحياء المحصّنة (القسم 3.12): حجر بارتفاع المستوى، وأعلاه بلون المالك
    // ponytail: سور بسيط بلا طراز كل منطقة ولا أبراج (chunkCache.js)، والطراز مع التلميع في ن12
    for (final d in m.districts) {
      if (d.fort <= 0) continue;
      final h = 2.0 + 2.0 * d.fort, e = edges[d.id];
      final top = d.owner != null ? hexRgb(s.players[d.owner!].color) : 0xb8ab94;
      for (var k = 0; k < e.length; k += 4) {
        final x1 = e[k], y1 = e[k + 1], x2 = e[k + 2], y2 = e[k + 3];
        b.quad(x1, y1, x2, y2, x2, y2 - h, x1, y1 - h, x2 > x1 == y2 > y1 ? 0x8c7f6b : 0x76695a);
        b.line(x1, y1 - h, x2, y2 - h, 1.2, top);
      }
    }
  }

  List<List<double>> _buildEdges(GameMap m) {
    final inset = CAPTURE.m('border').d('inset'), W = TILE_HALF_W, H = TILE_HALF_H;
    final out = [for (final _ in m.districts) <double>[]];
    for (final d in m.districts) {
      for (final (i, j) in d.tiles) {
        final x = (i - j) * W, y = (i + j) * H;
        void edge(int ni, int nj, double x1, double y1, double x2, double y2) {
          if (m.inBounds(ni, nj) && m.districtAt[m.idx(ni, nj)] == d.id) return;
          // نحو مركز المربع بقدر الإزاحة
          final cx = x - (x1 + x2) / 2, cy = y - (y1 + y2) / 2, l = math.sqrt(cx * cx + cy * cy);
          final ox = cx / l * inset, oy = cy / l * inset;
          out[d.id].addAll([x1 + ox, y1 + oy, x2 + ox, y2 + oy]);
        }
        edge(i + 1, j, x + W, y, x, y + H);
        edge(i - 1, j, x - W, y, x, y - H);
        edge(i, j + 1, x, y + H, x - W, y);
        edge(i, j - 1, x, y - H, x + W, y);
      }
    }
    return out;
  }

  Iterable<District> _flagsAt(MatchState s, int d) sync* {
    for (final x in s.map.districts) {
      final c = x.capture;
      if (c != null && c.i + c.j == d) yield x;
    }
  }

  // علم الحي: سارية وراية بلون المالك (أو محايدة)، وحلقة تقدم الاستيلاء
  void _flag(TriBatch b, MatchState s, District d, double time) {
    final c = d.capture!;
    final x = (c.i - c.j) * TILE_HALF_W, y = (c.i + c.j) * TILE_HALF_H;
    final owner = d.owner != null ? s.players[d.owner!] : null;
    final col = owner != null ? hexRgb(owner.gang == 'police' ? UNIT_ART.s('policeColor') : owner.color) : (d.police ? 0x8fa6c4 : 0xe8e2d6);
    b.ellipse(x, y, 3.2, 1.5, 0x000000, 0.3);
    b.ring(x, y, 4.2, 2.1, 0.8, 0xffd34d, 0.85);
    b.line(x, y, x, y - 22, 1, 0x4a3a2a);
    final wv = math.sin(time * 3 + c.i) * 0.8;
    b.quad(x, y - 22, x + 10, y - 20 + wv, x + 10, y - 15 + wv, x, y - 16, col);
    if (d.progress > 0 && d.progress < 100 && d.progressOwner != null) {
      final po = s.players[d.progressOwner!];
      final pc = hexRgb(po.gang == 'police' ? UNIT_ART.s('policeColor') : po.color);
      b.ring(x, y, 9, 4.5, 1.6, 0x141210, 0.6, 32);
      b.ring(x, y, 9, 4.5, 1.6, pc, 1, 32, -math.pi / 2, -math.pi / 2 + 2 * math.pi * d.progress / 100);
    }
  }

  // الكلمات الطائرة: تفادى! صدّ! من الخلف!
  void _drawPops(Canvas canvas, MatchState s) {
    final secs = COMBAT_REALISM.m('pops').d('seconds');
    for (final p in s.pops) {
      final g = p.t / secs;
      final para = _pops['${p.text}|${p.color}'] ??= () {
        final pb = ui.ParagraphBuilder(ui.ParagraphStyle(textAlign: TextAlign.center, textDirection: TextDirection.rtl, fontSize: 5.5,
            fontWeight: FontWeight.w800))
          ..pushStyle(ui.TextStyle(color: Color(0xFF000000 | hexRgb(p.color)), shadows: const [Shadow(color: Color(0xCC000000), blurRadius: 1.2)]))
          ..addText(p.text);
        return pb.build()..layout(const ui.ParagraphConstraints(width: 60));
      }();
      final x = (p.x - p.y) * TILE_HALF_W - 30, y = (p.x + p.y) * TILE_HALF_H - 26 - g * 10;
      canvas.saveLayer(null, Paint()..color = Color.fromRGBO(255, 255, 255, (1 - g).clamp(0, 1)));
      canvas.drawParagraph(para, Offset(x, y));
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_MatchPainter old) => true;
}

double tintOf(District d) => tintAmount(d, 1);
