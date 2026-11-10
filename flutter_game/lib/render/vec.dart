// رسم متجهي يُبنى مرة ويرسمه كرت الشاشة بأمر واحد: شبكة مثلثات ملونة (drawVertices) بدل أوامر Canvas الكثيرة.
// الأدوات بأسماء أدوات cityThemes.js نفسها (poly وcirc وln وrc وel وbox وglow) فيُنقل رسم الزينة سطراً بسطر.
// حادة في كل تقريب (لا صور)، وبلا عمل على المعالج بعد بنائها
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import '../core/fmath.dart';

final _colors = <String, int>{};

// لون CSS: #rgb و#rrggbb وrgb() وrgba()
int css(String s) => _colors[s] ??= _parse(s);
int _parse(String s) {
  if (s.startsWith('#')) {
    var h = s.substring(1);
    if (h.length == 3) h = h.split('').map((c) => '$c$c').join();
    return 0xFF000000 | int.parse(h.substring(0, 6), radix: 16);
  }
  final v = s.substring(s.indexOf('(') + 1, s.indexOf(')')).split(',').map((t) => double.parse(t.trim())).toList();
  final a = v.length > 3 ? v[3] : 1.0;
  return ((a * 255).round() << 24) | (v[0].round() << 16) | (v[1].round() << 8) | v[2].round();
}

const _tau = 6.2831853;

class Vec {
  final _pos = <double>[];
  final _col = <int>[];
  double alpha = 1;      // globalAlpha

  bool get isEmpty => _pos.isEmpty;

  int _a(int c) {
    if (alpha == 1) return c;
    return ((((c >> 24) & 0xFF) * alpha).round() << 24) | (c & 0xFFFFFF);
  }

  void tri(double x1, double y1, double x2, double y2, double x3, double y3, int c1, [int? c2, int? c3]) {
    _pos..add(x1)..add(y1)..add(x2)..add(y2)..add(x3)..add(y3);
    _col..add(_a(c1))..add(_a(c2 ?? c1))..add(_a(c3 ?? c1));
  }

  // مضلع مملوء (مروحة من رأسه الأول: يكفي للمحدب ولأغلب أشكال الزينة)
  void poly(List<List<double>> p, String color) {
    final c = css(color);
    for (var k = 1; k + 1 < p.length; k++) {
      tri(p[0][0], p[0][1], p[k][0], p[k][1], p[k + 1][0], p[k + 1][1], c);
    }
  }

  void el(double x, double y, double rx, double ry, String color, [double a0 = 0, double a1 = _tau]) {
    final c = css(color);
    const n = 16;
    final steps = math.max(3, (n * (a1 - a0) / _tau).ceil());
    var px = x + fcos(a0) * rx, py = y + fsin(a0) * ry;
    for (var k = 1; k <= steps; k++) {
      final t = a0 + (a1 - a0) * k / steps, qx = x + fcos(t) * rx, qy = y + fsin(t) * ry;
      tri(x, y, px, py, qx, qy, c);
      px = qx; py = qy;
    }
  }

  void circ(double x, double y, double r, String color) => el(x, y, r, r, color);

  void rc(double x, double y, double w, double h, String color) =>
      poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], color);

  // خط بعرضه (طرفاه مقصوصان: الخطوط هنا رفيعة)
  void ln(double x1, double y1, double x2, double y2, String color, double w) => _seg(x1, y1, x2, y2, css(color), w);

  void _seg(double x1, double y1, double x2, double y2, int c, double w) {
    final dx = x2 - x1, dy = y2 - y1, l = math.sqrt(dx * dx + dy * dy);
    if (l < 1e-6) return;
    final nx = -dy / l * w / 2, ny = dx / l * w / 2;
    tri(x1 + nx, y1 + ny, x2 + nx, y2 + ny, x2 - nx, y2 - ny, c);
    tri(x1 + nx, y1 + ny, x2 - nx, y2 - ny, x1 - nx, y1 - ny, c);
  }

  // خط متعدد النقاط
  void stroke(List<List<double>> p, String color, double w) {
    final c = css(color);
    for (var k = 0; k + 1 < p.length; k++) { _seg(p[k][0], p[k][1], p[k + 1][0], p[k + 1][1], c, w); }
  }

  // منحنى quadraticCurveTo بثماني قطع
  void quad(double x0, double y0, double cx, double cy, double x1, double y1, String color, double w) {
    final p = <List<double>>[];
    for (var k = 0; k <= 8; k++) {
      final t = k / 8, u = 1 - t;
      p.add([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
    }
    stroke(p, color, w);
  }

  // محيط قطع ناقص، ومتقطع إن أُعطي dash [خط، فراغ]
  void ring(double x, double y, double rx, double ry, String color, double w, [List<double>? dash]) {
    const n = 48;
    final c = css(color);
    var dist = 0.0;
    for (var k = 0; k < n; k++) {
      final a0 = _tau * k / n, a1 = _tau * (k + 1) / n;
      final x0 = x + fcos(a0) * rx, y0 = y + fsin(a0) * ry, x1 = x + fcos(a1) * rx, y1 = y + fsin(a1) * ry;
      final len = math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
      final on = dash == null || (dist % (dash[0] + dash[1])) < dash[0];
      if (on) _seg(x0, y0, x1, y1, c, w);
      dist += len;
    }
  }

  // صندوق بزاوية المدينة: وجهان وسطح (box في cityThemes.js)
  void box(double x, double y, double w, double d, double h, String l, String r, [String? t]) {
    poly([[x - w, y], [x, y + d], [x, y + d - h], [x - w, y - h]], l);
    poly([[x, y + d], [x + w, y], [x + w, y - h], [x, y + d - h]], r);
    if (t != null) poly([[x - w, y - h], [x, y - d - h], [x + w, y - h], [x, y + d - h]], t);
  }

  // وهج: لون المركز يتلاشى إلى الحافة (تدرج قطري)
  void glow(double x, double y, double r, String color) {
    final c = css(color), edge = c & 0xFFFFFF;
    const n = 20;
    for (var k = 0; k < n; k++) {
      final a0 = _tau * k / n, a1 = _tau * (k + 1) / n;
      tri(x, y, x + fcos(a0) * r, y + fsin(a0) * r, x + fcos(a1) * r, y + fsin(a1) * r, c, edge, edge);
    }
  }

  // قبة (dome في cityThemes.js): نصف قطع ناقص وظله وحافته، وقمتها
  void dome(double x, double y, double r, String col, String shade, [String? tip]) {
    el(x, y, r, r * 1.15, col, math.pi, _tau);
    el(x + r * 0.25, y, r * 0.75, r * 1.1, shade, -math.pi / 2, 0);
    el(x, y, r, r * 0.32, shade);
    if (tip != null) { ln(x, y - r * 1.15, x, y - r * 1.15 - 4, tip, 0.9); circ(x, y - r * 1.15 - 4.4, 0.9, tip); }
  }

  ui.Vertices? build() => _pos.isEmpty ? null
      : ui.Vertices.raw(ui.VertexMode.triangles, Float32List.fromList(_pos),
          colors: Int32List.fromList([for (final c in _col) c.toSigned(32)]));
}
