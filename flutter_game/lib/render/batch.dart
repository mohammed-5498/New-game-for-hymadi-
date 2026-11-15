// دفعة مثلثات واحدة على أطلس واحد (drawVertices بظلّال الصورة): أجزاء صور الجنود والأشكال الملونة معاً
// (الأشكال تأخذ مربعاً أبيض من الأطلس ولونها من لون الرأس)، بتحويل وشفافية كلوحة الرسم في JavaScript
// (save وrestore وtranslate وrotate وscale)، فيُنقل رسم الوحدات أمراً بأمر ويُرسل لكرت الشاشة دفعة واحدة
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

class TriBatch {
  Float32List _pos = Float32List(6 * 2 * 4096), _uv = Float32List(6 * 2 * 4096);
  Int32List _col = Int32List(6 * 4096);
  int _n = 0;                      // عدد الرؤوس
  // التحويل الجاري: x' = a x + c y + e، y' = b x + d y + f
  double a = 1, b = 0, c = 0, d = 1, e = 0, f = 0, alpha = 1;
  var _stack = Float64List(7 * 64);
  int _sp = 0;
  double whiteU = 1.5, whiteV = 1.5;   // مركز المربع الأبيض في الأطلس

  bool get isEmpty => _n == 0;
  void reset() { _n = 0; a = 1; b = 0; c = 0; d = 1; e = 0; f = 0; alpha = 1; _sp = 0; }

  void save() {
    if (_sp + 7 > _stack.length) _stack = Float64List(_stack.length * 2)..setRange(0, _sp, _stack);
    final st = _stack;
    st[_sp] = a; st[_sp + 1] = b; st[_sp + 2] = c; st[_sp + 3] = d; st[_sp + 4] = e; st[_sp + 5] = f; st[_sp + 6] = alpha;
    _sp += 7;
  }
  void restore() {
    _sp -= 7;
    final st = _stack, s = _sp;
    a = st[s]; b = st[s + 1]; c = st[s + 2]; d = st[s + 3]; e = st[s + 4]; f = st[s + 5]; alpha = st[s + 6];
  }
  void translate(double x, double y) { e += a * x + c * y; f += b * x + d * y; }
  void scale(double sx, double sy) { a *= sx; b *= sx; c *= sy; d *= sy; }
  void rotate(double r) {
    final cs = math.cos(r), sn = math.sin(r);
    final na = a * cs + c * sn, nb = b * cs + d * sn, nc = c * cs - a * sn, nd = d * cs - b * sn;
    a = na; b = nb; c = nc; d = nd;
  }
  // c.transform(m11, m12, m21, m22, dx, dy)
  void transform(double m11, double m12, double m21, double m22, double dx, double dy) {
    final na = a * m11 + c * m12, nb = b * m11 + d * m12, nc = a * m21 + c * m22, nd = b * m21 + d * m22;
    e += a * dx + c * dy; f += b * dx + d * dy;
    a = na; b = nb; c = nc; d = nd;
  }

  void _grow(int more) {
    if (_n + more <= _col.length) return;
    final cap = math.max(_col.length * 2, _n + more);
    _pos = Float32List(cap * 2)..setRange(0, _n * 2, _pos);
    _uv = Float32List(cap * 2)..setRange(0, _n * 2, _uv);
    _col = Int32List(cap)..setRange(0, _n, _col);
  }

  int _argb(int rgb, double al) => ((math.max(0, math.min(1, al * alpha)) * 255).round() << 24 | (rgb & 0xFFFFFF)).toSigned(32);

  void _vert(double x, double y, double u, double v, int col) {
    final k = _n * 2;
    _pos[k] = a * x + c * y + e; _pos[k + 1] = b * x + d * y + f;
    _uv[k] = u; _uv[k + 1] = v;
    _col[_n++] = col;
  }

  // صورة: المستطيل (sx, sy, w, h) من الأطلس، وزاويته اليسرى العليا عند (x, y) في الإحداثيات الجارية
  void image(double sx, double sy, double w, double h, double x, double y, [int rgb = 0xFFFFFF, double al = 1]) {
    _grow(6);
    final col = _argb(rgb, al);
    _vert(x, y, sx, sy, col); _vert(x + w, y, sx + w, sy, col); _vert(x + w, y + h, sx + w, sy + h, col);
    _vert(x, y, sx, sy, col); _vert(x + w, y + h, sx + w, sy + h, col); _vert(x, y + h, sx, sy + h, col);
  }

  // صورة مستديرة حول مفصلها: مفصلها (ax, ay) من المستطيل عند (x, y) بزاوية r ومقياس k في الإحداثيات الجارية
  // (save ثم translate ثم rotate ثم scale ثم image ثم restore، بلا حفظ ولا ذاكرة)
  void imageAt(double sx, double sy, double w, double h, double ax, double ay, double x, double y, double r, double k) {
    _grow(6);
    final cs = math.cos(r) * k, sn = math.sin(r) * k;
    // المحور x للصورة (cs, sn) والمحور y (-sn, cs) في الإحداثيات الجارية، ثم التحويل الجاري
    final ux = a * cs + c * sn, uy = b * cs + d * sn, vx = c * cs - a * sn, vy = d * cs - b * sn;
    final ox = a * x + c * y + e - ux * ax - vx * ay, oy = b * x + d * y + f - uy * ax - vy * ay;
    final col = _argb(0xFFFFFF, 1);
    void v(double px, double py, double u, double t) {
      final k2 = _n * 2;
      _pos[k2] = ox + ux * px + vx * py; _pos[k2 + 1] = oy + uy * px + vy * py;
      _uv[k2] = u; _uv[k2 + 1] = t;
      _col[_n++] = col;
    }
    v(0, 0, sx, sy); v(w, 0, sx + w, sy); v(w, h, sx + w, sy + h);
    v(0, 0, sx, sy); v(w, h, sx + w, sy + h); v(0, h, sx, sy + h);
  }

  void tri(double x1, double y1, double x2, double y2, double x3, double y3, int rgb, [double al = 1]) {
    _grow(3);
    final col = _argb(rgb, al);
    _vert(x1, y1, whiteU, whiteV, col); _vert(x2, y2, whiteU, whiteV, col); _vert(x3, y3, whiteU, whiteV, col);
  }

  // مثلث بلون واحد وشفافية لكل رأس (حواف ضباب الحرب الناعمة)
  void triA(double x1, double y1, double a1, double x2, double y2, double a2, double x3, double y3, double a3, int rgb) {
    _grow(3);
    _vert(x1, y1, whiteU, whiteV, _argb(rgb, a1)); _vert(x2, y2, whiteU, whiteV, _argb(rgb, a2)); _vert(x3, y3, whiteU, whiteV, _argb(rgb, a3));
  }

  void quad(double x1, double y1, double x2, double y2, double x3, double y3, double x4, double y4, int rgb, [double al = 1]) {
    tri(x1, y1, x2, y2, x3, y3, rgb, al);
    tri(x1, y1, x3, y3, x4, y4, rgb, al);
  }

  void rect(double x, double y, double w, double h, int rgb, [double al = 1]) => quad(x, y, x + w, y, x + w, y + h, x, y + h, rgb, al);

  // خط بعرض w (بنهايتين مستديرتين تقريباً: مربعان صغيران)
  void line(double x1, double y1, double x2, double y2, double w, int rgb, [double al = 1]) {
    final dx = x2 - x1, dy = y2 - y1, l = math.sqrt(dx * dx + dy * dy);
    if (l < 1e-6) return;
    final nx = -dy / l * w / 2, ny = dx / l * w / 2, tx = dx / l * w / 2, ty = dy / l * w / 2;
    quad(x1 + nx - tx, y1 + ny - ty, x2 + nx + tx, y2 + ny + ty, x2 - nx + tx, y2 - ny + ty, x1 - nx - tx, y1 - ny - ty, rgb, al);
  }

  // جيب وجيب تمام الدائرة الكاملة لكل عدد قطع، مرة واحدة (الحلقات والأقراص كل إطار)
  static final _circles = <int, Float64List>{};
  static Float64List _circle(int seg) => _circles[seg] ??= Float64List(seg * 2 + 2)
    ..setAll(0, [for (var k = 0; k <= seg; k++) ...[math.cos(k / seg * 2 * math.pi), math.sin(k / seg * 2 * math.pi)]]);

  void ellipse(double cx, double cy, double rx, double ry, int rgb, [double al = 1, int seg = 12]) {
    final t = _circle(seg);
    for (var k = 0; k < seg; k++) {
      tri(cx, cy, cx + t[k * 2] * rx, cy + t[k * 2 + 1] * ry, cx + t[k * 2 + 2] * rx, cy + t[k * 2 + 3] * ry, rgb, al);
    }
  }

  // حلقة بيضاوية بعرض w (dash: طول القطعة وفراغها بالراديان، 0 بلا تقطيع)
  void ring(double cx, double cy, double rx, double ry, double w, int rgb, [double al = 1, int seg = 20, double from = 0, double to = 2 * math.pi, int dash = 0]) {
    final full = from == 0 && to == 2 * math.pi, t = full ? _circle(seg) : null;
    for (var k = 0; k < seg; k++) {
      if (dash > 0 && (k ~/ dash).isOdd) continue;
      final double c0, s0, c1, s1;
      if (t != null) {
        c0 = t[k * 2]; s0 = t[k * 2 + 1]; c1 = t[k * 2 + 2]; s1 = t[k * 2 + 3];
      } else {
        final a0 = from + (to - from) * k / seg, a1 = from + (to - from) * (k + 1) / seg;
        c0 = math.cos(a0); s0 = math.sin(a0); c1 = math.cos(a1); s1 = math.sin(a1);
      }
      final h = w / 2;
      quad(cx + c0 * (rx - h), cy + s0 * (ry - h), cx + c0 * (rx + h), cy + s0 * (ry + h),
          cx + c1 * (rx + h), cy + s1 * (ry + h), cx + c1 * (rx - h), cy + s1 * (ry - h), rgb, al);
    }
  }

  // مضلع محدب بمروحة من رأسه الأول
  void fan(List<double> xy, int rgb, [double al = 1]) {
    for (var k = 2; k + 1 < xy.length; k += 2) {
      if (k == 2) continue;
      tri(xy[0], xy[1], xy[k - 2], xy[k - 1], xy[k], xy[k + 1], rgb, al);
    }
  }

  // نسخة من رؤوس رسمٍ مضى (من from حتى الآن)، ثم إعادته بإزاحة: الجندي يُحسب شكله مرة ويُعاد بمكانه الجديد
  int get count => _n;
  void keep(TriClip c, int from) {
    final m = _n - from;
    if (c.col.length < m) {
      c.pos = Float32List(m * 2 + 64);
      c.uv = Float32List(m * 2 + 64);
      c.col = Int32List(m + 32);
    }
    c.pos.setRange(0, m * 2, _pos, from * 2);
    c.uv.setRange(0, m * 2, _uv, from * 2);
    c.col.setRange(0, m, _col, from);
    c.n = m;
  }
  void replay(TriClip c, double dx, double dy) {
    _grow(c.n);
    final p = _pos, q = c.pos, o = _n * 2;
    for (var k = 0; k < c.n * 2; k += 2) { p[o + k] = q[k] + dx; p[o + k + 1] = q[k + 1] + dy; }
    _uv.setRange(o, o + c.n * 2, c.uv);
    _col.setRange(_n, _n + c.n, c.col);
    _n += c.n;
  }

  // ما في الدفعة رؤوساً ثابتة في ذاكرة كرت الشاشة (تُنسخ عند إنشائها)، تُرسم كل إطار بلا حساب: حدود الأحياء حتى يتغير مالك
  ui.Vertices bake() {
    final v = ui.Vertices.raw(ui.VertexMode.triangles, Float32List.sublistView(_pos, 0, _n * 2),
        textureCoordinates: Float32List.sublistView(_uv, 0, _n * 2), colors: Int32List.sublistView(_col, 0, _n));
    _n = 0;
    return v;
  }
  static void drawBaked(ui.Canvas canvas, ui.Image atlas, ui.Vertices v) => canvas.drawVertices(v, ui.BlendMode.modulate, _paintOf(atlas));

  static final _paints = Expando<ui.Paint>();
  static ui.Paint _paintOf(ui.Image atlas) => _paints[atlas] ??= (ui.Paint()
      ..shader = ui.ImageShader(atlas, ui.TileMode.clamp, ui.TileMode.clamp, Float64List.fromList(
          [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), filterQuality: ui.FilterQuality.medium));
  void flush(ui.Canvas canvas, ui.Image atlas) {
    if (_n == 0) return;
    final paint = _paints[atlas] ??= (ui.Paint()
      ..shader = ui.ImageShader(atlas, ui.TileMode.clamp, ui.TileMode.clamp, Float64List.fromList(
          [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), filterQuality: ui.FilterQuality.medium));
    final v = ui.Vertices.raw(ui.VertexMode.triangles, Float32List.sublistView(_pos, 0, _n * 2),
        textureCoordinates: Float32List.sublistView(_uv, 0, _n * 2), colors: Int32List.sublistView(_col, 0, _n));
    canvas.drawVertices(v, ui.BlendMode.modulate, paint);
    v.dispose();
    _n = 0;
  }
}

// رسم محفوظ: رؤوسه، ومكان صاحبه وزمنه وتقريب الكاميرا حين حُسب
class TriClip {
  Float32List pos = Float32List(0), uv = Float32List(0);
  Int32List col = Int32List(0);
  int n = 0;
  double x = 0, y = 0, t = -1e9, z = 0;
}

int hexRgb(String hex) {
  if (hex.startsWith('#')) return int.parse(hex.substring(1, 7), radix: 16);
  // rgba(r,g,b,a) كما في بعض ألوان الإعداد
  final v = hex.substring(hex.indexOf('(') + 1, hex.indexOf(')')).split(',').map((x) => double.parse(x.trim()).round()).toList();
  return (v[0] << 16) | (v[1] << 8) | v[2];
}
