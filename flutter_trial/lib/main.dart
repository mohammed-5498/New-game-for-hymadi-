// تجربة Flutter (docs/PROGRESS.md القسم 6): مدينة حقيقية من اللعبة و200-800 جندي يتقاتلون.
// الرسم كله على كرت الشاشة بأمرين في الإطار: الأرض شبكة مثلثات واحدة (drawVertices)، والمباني والجنود
// معاً من أطلس واحد مرتبة بالعمق (drawRawAtlas) فيختفي الجندي خلف المبنى بلا حساب. والمعالج للمحاكاة فقط:
// 20 مرة/ث بشبكة مربعات، والرسم 60 إطاراً حتى في الشاشات الأسرع، بلا مصفوفات جديدة في كل إطار.
import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';

import 'battle.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
  runApp(const MaterialApp(debugShowCheckedModeBanner: false, home: TrialPage()));
}

// كل ما يحتاجه الرسم، يُحمَّل مرة واحدة
class Scene {
  final ui.Image atlas;
  final double px;                       // بكسل الأطلس لكل وحدة عالم
  final int n;
  final double hw, hh;                   // نصف عرض المربع ونصف ارتفاعه
  final ui.Vertices ground;
  final List<List<double>> sprites;      // [x, y, w, h, ax, ay]
  final Float32List buildings;           // لكل مبنى: العمق، ورقم صورته، وx، وy مرتبة بالعمق
  final List<Map<String, List<List<double>>>> frames;
  final List<double> walkPeriod;
  final Battle battle;

  Scene(this.atlas, this.px, this.n, this.hw, this.hh, this.ground, this.sprites, this.buildings, this.frames, this.walkPeriod, this.battle);

  static Future<Scene> load() async {
    final bytes = await rootBundle.load('assets/atlas.png');
    final codec = await ui.instantiateImageCodec(bytes.buffer.asUint8List());
    final atlas = (await codec.getNextFrame()).image;
    final a = jsonDecode(await rootBundle.loadString('assets/atlas.json'));
    final m = jsonDecode(await rootBundle.loadString('assets/map.json'));
    final n = m['n'] as int;
    final hw = (m['tile']['halfW'] as num).toDouble(), hh = (m['tile']['halfH'] as num).toDouble();
    List<double> nums(dynamic l) => [for (final v in l) (v as num).toDouble()];
    final sprites = [for (final r in a['buildings']) nums(r)];
    // الأرض: معين لكل مربع بمثلثين بلونه
    final pos = Float32List(n * n * 12), col = Int32List(n * n * 6);
    final ground = m['ground'] as List, spriteOf = m['sprite'] as List;
    final b = <List<double>>[];
    for (var j = 0; j < n; j++) {
      for (var i = 0; i < n; i++) {
        final k = j * n + i, x = (i - j) * hw, y = (i + j) * hh;
        pos.setAll(k * 12, [x, y - hh, x + hw, y, x, y + hh, x, y - hh, x, y + hh, x - hw, y]);
        col.fillRange(k * 6, k * 6 + 6, (ground[k] as int).toSigned(32));
        final s = spriteOf[k] as int;
        if (s >= 0) b.add([(i + j).toDouble(), s.toDouble(), x, y]);
      }
    }
    b.sort((p, q) => p[0].compareTo(q[0]));
    final frames = <Map<String, List<List<double>>>>[], walk = <double>[];
    for (final u in a['units']) {
      frames.add({for (final e in (u['seq'] as Map).entries) e.key as String: [for (final r in e.value) nums(r)]});
      walk.add((u['walkPeriod'] as num).toDouble());
    }
    final homes = [for (final h in m['homes']) [for (final v in h) v as int]];
    return Scene(atlas, (a['pxPerUnit'] as num).toDouble(), n, hw, hh,
        ui.Vertices.raw(ui.VertexMode.triangles, pos, colors: col),
        sprites, Float32List.fromList([for (final r in b) ...r]), frames, walk,
        Battle(n, Uint8List.fromList([for (final w in m['walk']) w as int]), homes));
  }
}

class Repaint extends ChangeNotifier { void tick() => notifyListeners(); }

class TrialPage extends StatefulWidget {
  const TrialPage({super.key});
  @override
  State<TrialPage> createState() => TrialPageState();
}

class TrialPageState extends State<TrialPage> with SingleTickerProviderStateMixin {
  Scene? scene;
  final repaint = Repaint();
  final stats = ValueNotifier('');
  late final Ticker ticker = createTicker(onTick);
  double last = 0, acc = 0, lastPaint = -1, statAt = 0;
  // قياسات النصف ثانية الأخيرة
  int painted = 0, timed = 0;
  double simUs = 0, buildUs = 0, rasterUs = 0;
  // الكاميرا: مركزها بوحدات العالم، والتقريب بكسل منطقي لكل وحدة
  double camX = 0, camY = 0, zoom = 2.2, lastScale = 1;

  @override
  void initState() {
    super.initState();
    SchedulerBinding.instance.addTimingsCallback(onTimings);
    Scene.load().then((s) {
      final h = s.battle.homes;
      camX = ((h[0][0] + h[1][0]) / 2 - (h[0][1] + h[1][1]) / 2) * s.hw;
      camY = ((h[0][0] + h[1][0]) / 2 + (h[0][1] + h[1][1]) / 2) * s.hh;
      setState(() => scene = s);
      ticker.start();
    });
  }

  @override
  void dispose() {
    SchedulerBinding.instance.removeTimingsCallback(onTimings);
    ticker.dispose();
    super.dispose();
  }

  void onTimings(List<ui.FrameTiming> list) {
    for (final t in list) {
      buildUs += t.buildDuration.inMicroseconds;
      rasterUs += t.rasterDuration.inMicroseconds;
    }
    timed += list.length;
  }

  void onTick(Duration elapsed) {
    final s = scene!, now = elapsed.inMicroseconds / 1e6;
    acc += (now - last).clamp(0, 0.25);
    last = now;
    final sw = Stopwatch()..start();
    while (acc >= tickSec) { s.battle.step(); acc -= tickSec; }
    simUs += sw.elapsedMicroseconds;
    // سقف 60 إطاراً إن تجاهل الجهاز طلب الـ 60 هرتز (MainActivity)
    if (now - lastPaint >= 0.012) { lastPaint = now; painted++; repaint.tick(); }
    if (now - statAt >= 0.5) {
      final dt = now - statAt;
      String ms(double us, int k) => k == 0 ? '-' : (us / k / 1000).toStringAsFixed(1);
      stats.value = 'إطارات/ث ${(painted / dt).round()}   واجهة ${ms(buildUs, timed)} م.ث   رسم ${ms(rasterUs, timed)} م.ث'
          '   محاكاة ${(simUs / dt / 1000 / 20).toStringAsFixed(2)} م.ث   جنود ${s.battle.alive(0) + s.battle.alive(1)}';
      statAt = now; painted = 0; timed = 0; simUs = buildUs = rasterUs = 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = scene;
    if (s == null) return const ColoredBox(color: Colors.black, child: Center(child: CircularProgressIndicator()));
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Stack(children: [
        Positioned.fill(child: GestureDetector(
          onScaleStart: (d) => lastScale = 1,
          onScaleUpdate: (d) {
            final size = MediaQuery.sizeOf(context);
            final fx = d.focalPoint.dx - size.width / 2, fy = d.focalPoint.dy - size.height / 2;
            final wx = camX + fx / zoom, wy = camY + fy / zoom;   // النقطة تحت الإصبعين تبقى تحتهما
            zoom = (zoom * d.scale / lastScale).clamp(0.6, 6.0);
            lastScale = d.scale;
            camX = wx - fx / zoom - d.focalPointDelta.dx / zoom;
            camY = wy - fy / zoom - d.focalPointDelta.dy / zoom;
          },
          child: CustomPaint(painter: BattlePainter(this), isComplex: true, willChange: true),
        )),
        Positioned(top: 6, right: 8, left: 8, child: ValueListenableBuilder<String>(
          valueListenable: stats,
          builder: (_, v, _) => Text(v, style: const TextStyle(color: Colors.white, fontSize: 13,
              shadows: [Shadow(blurRadius: 3, color: Colors.black)])),
        )),
        Positioned(bottom: 8, left: 8, child: Row(children: [
          for (final c in [200, 400, 800]) Padding(
            padding: const EdgeInsets.only(right: 6),
            child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: const Color(0xcc3a2f22), minimumSize: const Size(64, 40)),
              onPressed: () => s.battle.spawn(c),
              child: Text('$c'),
            ),
          ),
        ])),
      ]),
    );
  }
}

class BattlePainter extends CustomPainter {
  final TrialPageState page;
  BattlePainter(this.page) : super(repaint: page.repaint);

  static final groundPaint = Paint();
  static final atlasPaint = Paint()..filterQuality = FilterQuality.low;
  // مصفوفات ثابتة تُملأ في كل إطار: 4 أرقام لكل صورة (التحويل) و4 لمستطيلها في الأطلس
  static Float32List xf = Float32List(0), rects = Float32List(0);
  static final depth = Float64List(capacity);
  static final order = List<int>.filled(capacity, 0);

  @override
  void paint(Canvas canvas, Size size) {
    final p = page, s = p.scene!, b = s.battle;
    final total = s.buildings.length ~/ 4 + capacity;
    if (xf.length < total * 4) { xf = Float32List(total * 4); rects = Float32List(total * 4); }
    canvas.drawColor(const Color(0xff2b2620), BlendMode.src);
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(p.zoom);
    canvas.translate(-p.camX, -p.camY);
    canvas.drawVertices(s.ground, BlendMode.dst, groundPaint);

    // ما يظهر في الشاشة فقط (المبنى يرتفع فوق نقطة ارتكازه حتى 30 وحدة)
    final hw = size.width / 2 / p.zoom, hh = size.height / 2 / p.zoom;
    final x0 = p.camX - hw - 20, x1 = p.camX + hw + 20, y0 = p.camY - hh - 10, y1 = p.camY + hh + 32;
    final alpha = p.acc / tickSec, now = b.time - tickSec + p.acc;
    // الجنود الظاهرون مرتبون بعمقهم (i + j) كالمباني
    var nu = 0;
    for (var k = 0; k < b.units.length; k++) {
      final u = b.units[k];
      final i = u.px + (u.x - u.px) * alpha, j = u.py + (u.y - u.py) * alpha;
      final x = (i - j) * s.hw, y = (i + j) * s.hh;
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      depth[k] = i + j;
      order[nu++] = k;
    }
    final vis = order.sublist(0, nu)..sort((a, c) => depth[a].compareTo(depth[c]));
    final scale = 1 / s.px;
    var count = 0;
    void put(List<double> r, double x, double y) {
      final o = count * 4;
      xf[o] = scale; xf[o + 1] = 0; xf[o + 2] = x - scale * r[4]; xf[o + 3] = y - scale * r[5];
      rects[o] = r[0]; rects[o + 1] = r[1]; rects[o + 2] = r[0] + r[2]; rects[o + 3] = r[1] + r[3];
      count++;
    }
    // دمج القائمتين المرتبتين: المباني والجنود
    final bl = s.buildings;
    var bi = 0, ui0 = 0;
    while (bi < bl.length || ui0 < vis.length) {
      final takeBuilding = ui0 >= vis.length || (bi < bl.length && bl[bi] <= depth[vis[ui0]]);
      if (takeBuilding) {
        final x = bl[bi + 2], y = bl[bi + 3];
        if (x > x0 && x < x1 && y > y0 && y < y1) put(s.sprites[bl[bi + 1].toInt()], x, y);
        bi += 4;
      } else {
        final u = b.units[vis[ui0++]];
        final i = u.px + (u.x - u.px) * alpha, j = u.py + (u.y - u.py) * alpha;
        final f = s.frames[u.team], side = u.facing > 0 ? 'r' : 'l';
        List<double> r;
        if (u.dead) {
          final seq = f['death_$side']!;
          r = seq[((now - u.deadAt) / deathTime * seq.length).floor().clamp(0, seq.length - 1)];
        } else if (now - u.swing < swingTime) {
          final seq = f['attack_$side']!;
          r = seq[((now - u.swing) / swingTime * seq.length).floor().clamp(0, seq.length - 1)];
        } else if (u.moving) {
          final seq = f['walk_$side']!;
          r = seq[((now + u.phase) / s.walkPeriod[u.team] * seq.length).floor() % seq.length];
        } else {
          r = f['idle_$side']![0];
        }
        put(r, (i - j) * s.hw, (i + j) * s.hh);
      }
    }
    canvas.drawRawAtlas(s.atlas, Float32List.sublistView(xf, 0, count * 4), Float32List.sublistView(rects, 0, count * 4),
        null, null, null, atlasPaint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(BattlePainter old) => false;
}
