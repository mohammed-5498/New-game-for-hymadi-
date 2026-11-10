// رياضيات ثابتة بين الأجهزة (القسم 18.1): نتيجة كل دالة واحدة بالبت على كل جوال، ومطابقة لمحرك V8 في اللعبة
// الحالية، فتتطابق المباراة في اللعب المحلي وتتطابق النسختان في فحص البصمات.
// - fsin وfcos: خوارزمية fdlibm 5.3 (التي يستعملها V8 لـ Math.sin/cos، فُحصت على 6 ملايين قيمة) لا دوال الجهاز
// - hypot: كـ js/game/hypot.js (خوارزمية V8)، وjsRound: Math.round في JavaScript (النصف للأعلى دائماً)
// - Rng: مولّد mulberry32 ببذرة، كـ js/game/random.js
// - stableSort: ترتيب ثابت كـ Array.prototype.sort (المتساويان يبقيان بترتيبهما)
import 'dart:math' as math;
import 'dart:typed_data';

final _b = ByteData(8);
int _hi(double x) { _b.setFloat64(0, x); return _b.getInt32(0); }
double _withHi(int hi) { _b.setInt32(0, hi); _b.setUint32(4, 0); return _b.getFloat64(0); }

const _s1 = -1.66666666666666324348e-01, _s2 = 8.33333333332248946124e-03, _s3 = -1.98412698298579493134e-04,
    _s4 = 2.75573137070700676789e-06, _s5 = -2.50507602534068634195e-08, _s6 = 1.58969099521155010221e-10;
const _c1 = 4.16666666666666019037e-02, _c2 = -1.38888888888741095749e-03, _c3 = 2.48015872894767294178e-05,
    _c4 = -2.75573143513906633035e-07, _c5 = 2.08757232129817482790e-09, _c6 = -1.13596475577881948265e-11;

double _kSin(double x, double y, int iy) {
  final ix = _hi(x) & 0x7fffffff;
  if (ix < 0x3e400000 && x.truncate() == 0) return x;
  final z = x * x, v = z * x, r = _s2 + z * (_s3 + z * (_s4 + z * (_s5 + z * _s6)));
  return iy == 0 ? x + v * (_s1 + z * r) : x - ((z * (0.5 * y - v * r) - y) - v * _s1);
}

double _kCos(double x, double y) {
  final ix = _hi(x) & 0x7fffffff;
  if (ix < 0x3e400000 && x.truncate() == 0) return 1;
  final z = x * x, r = z * (_c1 + z * (_c2 + z * (_c3 + z * (_c4 + z * (_c5 + z * _c6)))));
  if (ix < 0x3fd33333) return 1 - (0.5 * z - (z * r - x * y));
  final qx = ix > 0x3fe90000 ? 0.28125 : _withHi(ix - 0x00200000);
  final hz = 0.5 * z - qx, a = 1 - qx;
  return a - (hz - (z * r - x * y));
}

const _npio2hw = [0x3FF921FB, 0x400921FB, 0x4012D97C, 0x401921FB, 0x401F6A7A, 0x4022D97C, 0x4025FDBB, 0x402921FB,
  0x402C463A, 0x402F6A7A, 0x4031475C, 0x4032D97C, 0x40346B9C, 0x4035FDBB, 0x40378FDB, 0x403921FB, 0x403AB41B,
  0x403C463A, 0x403DD85A, 0x403F6A7A, 0x40407E4C, 0x4041475C, 0x4042106C, 0x4042D97C, 0x4043A28C, 0x40446B9C,
  0x404534AC, 0x4045FDBB, 0x4046C6CB, 0x40478FDB, 0x404858EB, 0x404921FB];
const _invpio2 = 6.36619772367581382433e-01, _pio2_1 = 1.57079632673412561417e+00, _pio2_1t = 6.07710050650619224932e-11,
    _pio2_2 = 6.07710050630396597660e-11, _pio2_2t = 2.02226624879595063154e-21, _pio2_3 = 2.02226624871116645580e-21,
    _pio2_3t = 8.47842766036889956997e-32;
double _y0 = 0, _y1 = 0;

// x مختزَل إلى [-π/4, π/4] في (_y0 + _y1)، ويعيد رقم الربع. القيم الضخمة (> 2^19·π/2) لا تقع في اللعبة
int _remPio2(double x) {
  final hx = _hi(x), ix = hx & 0x7fffffff;
  if (ix <= 0x3fe921fb) { _y0 = x; _y1 = 0; return 0; }
  if (ix < 0x4002d97c) {
    if (hx > 0) {
      var z = x - _pio2_1;
      if (ix != 0x3ff921fb) { _y0 = z - _pio2_1t; _y1 = (z - _y0) - _pio2_1t; }
      else { z -= _pio2_2; _y0 = z - _pio2_2t; _y1 = (z - _y0) - _pio2_2t; }
      return 1;
    }
    var z = x + _pio2_1;
    if (ix != 0x3ff921fb) { _y0 = z + _pio2_1t; _y1 = (z - _y0) + _pio2_1t; }
    else { z += _pio2_2; _y0 = z + _pio2_2t; _y1 = (z - _y0) + _pio2_2t; }
    return -1;
  }
  if (ix > 0x413921fb) throw ArgumentError('fmath: زاوية أكبر من المدعوم: $x');
  var t = x.abs();
  final n = (t * _invpio2 + 0.5).truncate(), fn = n.toDouble();
  var r = t - fn * _pio2_1, w = fn * _pio2_1t;
  if (n < 32 && ix != _npio2hw[n - 1]) {
    _y0 = r - w;
  } else {
    final j = ix >> 20;
    _y0 = r - w;
    var i = j - ((_hi(_y0) >> 20) & 0x7ff);
    if (i > 16) {
      t = r; w = fn * _pio2_2; r = t - w; w = fn * _pio2_2t - ((t - r) - w); _y0 = r - w;
      i = j - ((_hi(_y0) >> 20) & 0x7ff);
      if (i > 49) { t = r; w = fn * _pio2_3; r = t - w; w = fn * _pio2_3t - ((t - r) - w); _y0 = r - w; }
    }
  }
  _y1 = (r - _y0) - w;
  if (hx < 0) { _y0 = -_y0; _y1 = -_y1; return -n; }
  return n;
}

double fsin(double x) {
  if ((_hi(x) & 0x7fffffff) <= 0x3fe921fb) return _kSin(x, 0, 0);
  if (!x.isFinite) return double.nan;
  switch (_remPio2(x) & 3) {
    case 0: return _kSin(_y0, _y1, 1);
    case 1: return _kCos(_y0, _y1);
    case 2: return -_kSin(_y0, _y1, 1);
    default: return -_kCos(_y0, _y1);
  }
}

double fcos(double x) {
  if ((_hi(x) & 0x7fffffff) <= 0x3fe921fb) return _kCos(x, 0);
  if (!x.isFinite) return double.nan;
  switch (_remPio2(x) & 3) {
    case 0: return _kCos(_y0, _y1);
    case 1: return -_kSin(_y0, _y1, 1);
    case 2: return -_kCos(_y0, _y1);
    default: return _kSin(_y0, _y1, 1);
  }
}

// Math.hypot لعددين كما في V8 (التطبيع بالأكبر ثم جمع كاهان)
double hypot(double a, double b) {
  a = a.abs(); b = b.abs();
  final max = a > b ? a : b;
  if (max == double.infinity) return double.infinity;
  if (a.isNaN || b.isNaN) return double.nan;
  if (max == 0) return 0;
  final n0 = a / max, n1 = b / max, s0 = n0 * n0;
  final summand = n1 * n1 - ((s0 - 0) - s0);
  return math.sqrt(s0 + summand) * max;
}

// Math.round في JavaScript: الأقرب، والنصف دائماً للأعلى (round في Dart يبعده عن الصفر)
int jsRound(double x) {
  final f = x.floorToDouble();
  return (x - f >= 0.5 ? f + 1 : f).toInt();
}

// mulberry32 كـ js/game/random.js: الحالة 32 بت بلا إشارة
class Rng {
  int state;
  Rng(int seed) : state = seed & 0xFFFFFFFF;
  double call() {
    state = (state + 0x6D2B79F5) & 0xFFFFFFFF;
    var t = state;
    t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF;
    t = (t ^ (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF))) & 0xFFFFFFFF;
    return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296;
  }
  int below(int n) => (call() * n).floor();   // Math.floor(Math.random() * n)
}

// ترتيب ثابت: المتساويان بترتيبهما الأصلي، فالنتيجة كترتيب V8 تماماً (Dart يرتب القوائم الكبيرة بلا ثبات)
void stableSort<T>(List<T> list, int Function(T a, T b) compare) {
  final order = List<int>.generate(list.length, (k) => k);
  order.sort((x, y) { final c = compare(list[x], list[y]); return c != 0 ? c : x - y; });
  final copy = [for (final k in order) list[k]];
  list.setAll(0, copy);
}

// مقارنة بفرق رقمين كـ (a, b) => ka - kb في JavaScript
int byNum(double a, double b) => a < b ? -1 : a > b ? 1 : 0;
