// شبكة ما يُغطى (2.10.0، بطلب المستخدم: "ابدأ بتخفيف الأعلام والحدود وصفوف المباني"): المدينة كلها صورة جاهزة، والجنود
// والأعلام وما على الأرض في طبقة فوقها يُمسح منها ما يقع خلف مبنى أمامه. الشبكة مربعات بوحدات العالم فوق الشاشة، في كل مربع
// أصغر عمق لما رُسم فيه (صف المحتوى i + j، و-1 لما على الأرض تحت المباني كلها)، فصورة الصف e تُمسح إن غطت مربعاً فيه ما عمقه
// أصغر من e (خلفها). والمسح بشكل الصورة نفسها، فما يجاورها ولا يقع خلفها لا يتغير
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

class OcclusionGrid {
  static const _none = 1 << 30;
  double _x0 = 0, _y0 = 0, _cell = 16;
  int _w = 0, _h = 0;
  Int32List _min = Int32List(0), _rowMin = Int32List(0);   // أصغر عمق في كل مربع، وفي كل صف من الشبكة (رفض سريع)
  bool any = false;                                        // فيها شيء

  void reset(ui.Rect view) {
    _cell = math.max(16.0, view.width / 64);
    _x0 = view.left;
    _y0 = view.top;
    _w = (view.width / _cell).ceil() + 1;
    _h = (view.height / _cell).ceil() + 1;
    if (_min.length < _w * _h) _min = Int32List(_w * _h);
    if (_rowMin.length < _h) _rowMin = Int32List(_h);
    _min.fillRange(0, _w * _h, _none);
    _rowMin.fillRange(0, _h, _none);
    any = false;
  }

  void _mark(int cx0, int cy0, int cx1, int cy1, int depth) {
    cx0 = math.max(cx0, 0);
    cy0 = math.max(cy0, 0);
    cx1 = math.min(cx1, _w - 1);
    cy1 = math.min(cy1, _h - 1);
    if (cx0 > cx1 || cy0 > cy1) return;
    for (var cy = cy0; cy <= cy1; cy++) {
      final o = cy * _w;
      for (var cx = cx0; cx <= cx1; cx++) { if (_min[o + cx] > depth) _min[o + cx] = depth; }
      if (_rowMin[cy] > depth) _rowMin[cy] = depth;
    }
    any = true;
  }

  int _cx(double x) => ((x - _x0) / _cell).floor();
  int _cy(double y) => ((y - _y0) / _cell).floor();

  void markRect(ui.Rect r, int depth) => markBox(r.left, r.top, r.right, r.bottom, depth);
  void markBox(double x0, double y0, double x1, double y1, int depth) => _mark(_cx(x0), _cy(y0), _cx(x1), _cy(y1), depth);

  // المثلثات بين رأسين: الصغير بمستطيله، والكبير (شريط السيل) بما يغطيه فعلاً صفاً صفاً
  void markTriangles(Float32List p, int from, int to, int depth) {
    for (var k = from * 2; k + 5 < to * 2; k += 6) {
      final ax = p[k], ay = p[k + 1], bx = p[k + 2], by = p[k + 3], cx = p[k + 4], cy = p[k + 5];
      final gx0 = _cx(math.min(ax, math.min(bx, cx))), gx1 = _cx(math.max(ax, math.max(bx, cx)));
      final gy0 = _cy(math.min(ay, math.min(by, cy))), gy1 = _cy(math.max(ay, math.max(by, cy)));
      if ((gx1 - gx0 + 1) * (gy1 - gy0 + 1) <= 6) { _mark(gx0, gy0, gx1, gy1, depth); continue; }
      for (var gy = math.max(0, gy0); gy <= math.min(_h - 1, gy1); gy++) {
        final s0 = _y0 + gy * _cell, s1 = s0 + _cell;
        var lo = double.infinity, hi = -double.infinity;
        void at(double x) { if (x < lo) lo = x; if (x > hi) hi = x; }
        void edge(double ux, double uy, double vx, double vy) {
          if (uy >= s0 && uy <= s1) at(ux);
          if ((uy - s0) * (vy - s0) < 0) at(ux + (vx - ux) * (s0 - uy) / (vy - uy));
          if ((uy - s1) * (vy - s1) < 0) at(ux + (vx - ux) * (s1 - uy) / (vy - uy));
        }
        edge(ax, ay, bx, by);
        edge(bx, by, cx, cy);
        edge(cx, cy, ax, ay);
        if (lo <= hi) _mark(_cx(lo), gy, _cx(hi), gy, depth);
      }
    }
  }

  // هل في المستطيل شيء عمقه أصغر من depth (خلف صورة في الصف depth)
  bool covers(double x0, double y0, double x1, double y1, int depth) {
    final cx0 = math.max(_cx(x0), 0), cx1 = math.min(_cx(x1), _w - 1), cy0 = math.max(_cy(y0), 0), cy1 = math.min(_cy(y1), _h - 1);
    for (var cy = cy0; cy <= cy1; cy++) {
      if (_rowMin[cy] >= depth) continue;
      final o = cy * _w;
      for (var cx = cx0; cx <= cx1; cx++) { if (_min[o + cx] < depth) return true; }
    }
    return false;
  }
}
