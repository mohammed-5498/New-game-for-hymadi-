// الطقس والإضاءة (js/render/weather.js، وdrawStorm في featureArt.js): طبقة لون الطقس، وإضاءة الليل الدافئة جمعاً
// فوقها (أعمدة الممرات وبراميل النار والدوار والمعالم والمباني المميزة وساحات الأعلام والنار)، وندف الثلج وخطوط
// المطر، وغبار العاصفة الرملية. رسم فقط بزمن الشاشة، لا يدخل المحاكاة. الإضاءة كلها أمر رسم واحد من صورة توهج واحدة
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import '../core/cfg.dart';
import '../data/js_config.dart';
import '../game/features.dart' show stormAt;
import '../game/state.dart';
import '../map/generator.dart';

class Light {
  final double x, y, r, a;
  final int rgb;
  const Light(this.x, this.y, this.r, this.rgb, this.a);
}

int _rgb(String s) {
  final p = RegExp(r'[\d.]+').allMatches(s).map((m) => double.parse(m[0]!)).toList();
  return (p[0].round() << 16) | (p[1].round() << 8) | p[2].round();
}
double _alpha(String s) => RegExp(r'[\d.]+').allMatches(s).map((m) => double.parse(m[0]!)).toList()[3];

// ما لا تضعه الزينة: المعالم والمباني المميزة وساحات الأعلام
List<Light> mapLights(GameMap map, List<Light> decor) {
  final out = [...decor], F = CITY_FEATURES, n = map.n;
  for (var j = 0; j < n; j++) {
    for (var i = 0; i < n; i++) {
      final k = map.idx(i, j), x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
      if (map.kind[k] == 'monument') out.add(Light(x, y - 16, 30, 0xffd78c, 0.4));
      if (map.type[k] == tP) out.add(Light(x, y - 4, 18, 0xffebbe, 0.25));
    }
  }
  for (final d in map.districts) {
    final t = d.featureTile, f = d.feature;
    if (t == null || f == null || !F.has(f)) continue;
    final i = t % n, j = t ~/ n, x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
    final top = (F.m(f).dn('top') ?? 40) * (d.featureBig ? 1 : 0.55), cy = d.featureBig ? y - TILE_HALF_H : y;
    out.add(Light(x, cy - top * 0.55, F.m('halo').d('light'), _rgb(F.m('colors').ss(f) ?? '255,206,84'), 0.45));
  }
  return out;
}

class WeatherFx {
  final _rand = math.Random();
  String _key = '';
  ui.Size _size = ui.Size.zero;
  Float32List _p = Float32List(0);           // لكل ذرة: x وy وvx وvy وحجمها
  Float32List _sand = Float32List(0);        // لكل ذرة رمل: x وy وسرعتها وطولها
  static ui.Image? _glow;
  static const _g = 32.0;

  // صورة التوهج: أبيض في الوسط يخفت إلى الحافة (cachedGradient في weather.js)
  static Future<void> init() async {
    if (_glow != null) return;
    final rec = ui.PictureRecorder();
    ui.Canvas(rec).drawCircle(const ui.Offset(_g, _g), _g, ui.Paint()
      ..shader = ui.Gradient.radial(const ui.Offset(_g, _g), _g, const [ui.Color(0xFFFFFFFF), ui.Color(0x00FFFFFF)]));
    _glow = await rec.endRecording().toImage((_g * 2).toInt(), (_g * 2).toInt());
  }

  void _reset(String key, ui.Size size, double share) {
    _key = key;
    _size = size;
    final count = (WEATHER.m(key).d('particles') * share).round();
    _p = Float32List(count * 5);
    for (var k = 0; k < count; k++) {
      final o = k * 5, r = _rand.nextDouble;
      if (key == 'snow') {
        _p..[o] = r() * size.width..[o + 1] = r() * size.height..[o + 2] = -4 + r() * 8..[o + 3] = 18 + r() * 22..[o + 4] = 0.8 + r() * 1.6;
      } else {
        _p..[o] = r() * (size.width + 40)..[o + 1] = r() * size.height..[o + 2] = -70..[o + 3] = 420 + r() * 120..[o + 4] = 9 + r() * 6;
      }
    }
  }

  final _lx = Float32List(4 * 160), _lr = Float32List(4 * 160);
  final _lc = Int32List(160);
  final _fl = <double>[];             // أضواء النيران المدموجة: x وy ونصف القطر والعدد
  static final _plus = ui.Paint()..blendMode = ui.BlendMode.plus..filterQuality = ui.FilterQuality.low;

  // بعد رسم العالم، بإحداثيات الشاشة. statics من mapLights، وdt زمن الإطار (صفر في الإيقاف)
  // lit: قوة الضوء في هذا الموضع من العالم (ضباب الحرب: لا أضواء فيما لم يُستكشف، وأخفت فيما لا يُرى الآن)
  void paint(ui.Canvas canvas, ui.Size size, MatchState s, List<Light> statics, double dt, J gfx, [double Function(double, double)? lit]) {
    final w = WEATHER.m(s.weather), c = s.camera;
    final overlay = w.ss('overlay');
    if (overlay != null) canvas.drawRect(ui.Offset.zero & size, ui.Paint()..color = ui.Color((((_alpha(overlay) * 255).round()) << 24) | _rgb(overlay)));
    if (s.weather == 'night' && _glow != null) {
      final max = math.min(160, (PERFORMANCE.d('maxLights') * gfx.d('lights')).round());
      var n = 0;
      void add(double wx, double wy, double r, int rgb, double a) {
        if (n >= max) return;
        if (lit != null) { final f = lit(wx, wy); if (f <= 0) return; a *= f; }
        final sx = (wx - c.x) * c.z + size.width / 2, sy = (wy - c.y) * c.z + size.height / 2, rr = r * c.z;
        if (rr < 1 || sx < -rr || sy < -rr || sx > size.width + rr || sy > size.height + rr) return;
        final k = rr / _g, o = n * 4;
        _lx..[o] = k..[o + 1] = 0..[o + 2] = sx - _g * k..[o + 3] = sy - _g * k;
        _lr..[o] = 0..[o + 1] = 0..[o + 2] = _g * 2..[o + 3] = _g * 2;
        _lc[n++] = ((a.clamp(0, 1) * 255).round() << 24 | rgb).toSigned(32);
      }
      // النيران المتقاربة ضوء واحد يكبر قليلاً بعددها: كانت كل نار ضوءاً يُجمع فوق غيره فتصير بقعة بيضاء تعمي ما حولها
      _fl.clear();
      for (final f in s.fires) {
        final x = (f.x - f.y) * TILE_HALF_W, y = (f.x + f.y) * TILE_HALF_H, r = f.radius * 28;
        var k = 0;
        while (k < _fl.length && ((_fl[k] - x) * (_fl[k] - x) + (_fl[k + 1] - y) * (_fl[k + 1] - y)) > r * r) { k += 4; }
        if (k == _fl.length) { _fl.addAll([x, y, r, 1]); continue; }
        final m = _fl[k + 3];
        _fl[k] = (_fl[k] * m + x) / (m + 1); _fl[k + 1] = (_fl[k + 1] * m + y) / (m + 1);
        _fl[k + 2] = math.max(_fl[k + 2], r); _fl[k + 3] = m + 1;
      }
      for (var k = 0; k < _fl.length; k += 4) { add(_fl[k], _fl[k + 1], _fl[k + 2] * math.min(1.6, 1 + 0.15 * (_fl[k + 3] - 1)), 0xff963c, 0.5); }
      for (final l in statics) { add(l.x, l.y, l.r, l.rgb, l.a); }
      if (n > 0) {
        canvas.drawRawAtlas(_glow!, Float32List.sublistView(_lx, 0, n * 4), Float32List.sublistView(_lr, 0, n * 4),
            Int32List.sublistView(_lc, 0, n), ui.BlendMode.modulate, null, _plus);
      }
    }
    final particles = w.d('particles') > 0;
    if (particles && (_key != s.weather || _size != size)) _reset(s.weather, size, gfx.d('particles'));
    if (particles && _p.isNotEmpty) {
      final snow = s.weather == 'snow', count = _p.length ~/ 5;
      final pts = Float32List(snow ? count * 2 : count * 4);
      for (var k = 0; k < count; k++) {
        final o = k * 5;
        _p[o + 1] += _p[o + 3] * dt;
        _p[o] += _p[o + 2] * dt + (snow ? math.sin(_p[o + 1] * 0.03) * 12 * dt : 0);
        if (_p[o + 1] > size.height + 10) { _p[o + 1] = -10; _p[o] = _rand.nextDouble() * (size.width + 40); }
        if (_p[o] < -20) _p[o] = size.width + 10;
        if (_p[o] > size.width + 20) _p[o] = -10;
        if (snow) {
          pts..[k * 2] = _p[o]..[k * 2 + 1] = _p[o + 1];
        } else {
          pts..[k * 4] = _p[o]..[k * 4 + 1] = _p[o + 1]..[k * 4 + 2] = _p[o] - 2.5..[k * 4 + 3] = _p[o + 1] + _p[o + 4];
        }
      }
      canvas.drawRawPoints(snow ? ui.PointMode.points : ui.PointMode.lines, pts, ui.Paint()
        ..color = snow ? const ui.Color(0xD9FFFFFF) : const ui.Color(0x73C8D7EB)
        ..strokeWidth = snow ? 2.4 : 1
        ..strokeCap = ui.StrokeCap.round);
    }
    _storm(canvas, size, s, dt);
  }

  // غبار العاصفة الرملية في الدرعية: طبقة لون وخطوط رمل تجري مع الريح، تشتد في أولها وتخف في آخرها
  void _storm(ui.Canvas canvas, ui.Size size, MatchState s, double dt) {
    if (s.feature != 'storm') return;
    final S = CITY_FEATURES.m('storm'), now = stormAt(s.time);
    if (!now.on) return;
    final k = math.max(0.0, math.min(1.0, math.min(now.since / S.d('fade'), now.left / S.d('fade'))));
    canvas.drawRect(ui.Offset.zero & size, ui.Paint()..color = ui.Color(((S.d('alpha') * k * 255).round() << 24) | _rgb(S.s('color'))));
    final count = S.i('particles');
    if (_sand.length != count * 4) {
      _sand = Float32List(count * 4);
      for (var n = 0; n < count; n++) {
        _sand..[n * 4] = _rand.nextDouble() * size.width..[n * 4 + 1] = _rand.nextDouble() * size.height
          ..[n * 4 + 2] = 260 + _rand.nextDouble() * 260..[n * 4 + 3] = 8 + _rand.nextDouble() * 16;
      }
    }
    final pts = Float32List(count * 4);
    for (var n = 0; n < count; n++) {
      final o = n * 4;
      _sand[o] -= _sand[o + 2] * dt;
      _sand[o + 1] += _sand[o + 2] * 0.12 * dt;
      if (_sand[o] < -30) { _sand[o] = size.width + _rand.nextDouble() * 40; _sand[o + 1] = _rand.nextDouble() * size.height; }
      if (_sand[o + 1] > size.height + 10) _sand[o + 1] = -10;
      pts..[o] = _sand[o]..[o + 1] = _sand[o + 1]..[o + 2] = _sand[o] + _sand[o + 3]..[o + 3] = _sand[o + 1] - _sand[o + 3] * 0.12;
    }
    canvas.drawRawPoints(ui.PointMode.lines, pts, ui.Paint()
      ..color = ui.Color(((0.8 * k * 255).round() << 24) | _rgb(S.s('streak')))..strokeWidth = 1.4);
  }
}
