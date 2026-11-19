// ألوان الرسم كـ js/render/colors.js وcityThemes.js: الألوان أعداد ARGB، والخلط بتقريب Math.round نفسه
import 'dart:math' as math;

import '../core/fmath.dart';

int hex(String s) => 0xFF000000 | int.parse(s.substring(1, 7), radix: 16);

int _ch(int c, int shift) => (c >> shift) & 0xFF;

// mix في colors.js: كل قناة round(c × (1 − a) + t × a)
int mix(int color, int target, double amount) {
  var out = 0xFF000000;
  for (final s in const [16, 8, 0]) {
    out |= jsRound(_ch(color, s) * (1 - amount) + _ch(target, s) * amount) << s;
  }
  return out;
}

// mixc في cityThemes.js: كل قناة round(v + (t − v) × a)
int mixc(int color, int target, double amount) {
  var out = 0xFF000000;
  for (final s in const [16, 8, 0]) {
    final v = _ch(color, s);
    out |= jsRound(v + (_ch(target, s) - v) * amount) << s;
  }
  return out;
}

// hsh في cityThemes.js: رقم ثابت من 0 إلى 1 لكل مربع وملح، ببذرة رسم الخريطة (seed % 10007)
double hsh(int i, int j, int k, int seed) {
  final s = fsin(i * 127.1 + j * 311.7 + k * 74.7 + (seed % 10007) * 0.013) * 43758.5453;
  return s - s.floorToDouble();
}

// tint في colors.js: صبغ المالك في فضاء OKLab (الإضاءة بنسبة amount، ودرجة اللون بـ amount × chroma)
double _lin(int v) { final x = v / 255; return x <= 0.04045 ? x / 12.92 : math.pow((x + 0.055) / 1.055, 2.4).toDouble(); }
double _unlin(double v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * math.pow(v, 1 / 2.4) - 0.055);
double _cbrt(double x) => x < 0 ? -math.pow(-x, 1 / 3).toDouble() : math.pow(x, 1 / 3).toDouble();
(double, double, double) _lab(int c) {
  final r = _lin(_ch(c, 16)), g = _lin(_ch(c, 8)), b = _lin(_ch(c, 0));
  final l = _cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  final m = _cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  final s = _cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
final _tintCache = <(int, int, double, double), int>{};
int oklabTint(int color, int owner, double amount, double chroma) {
  if (amount <= 0) return color;
  return _tintCache[(color, owner, amount, chroma)] ??= () {
    final a = _lab(color), o = _lab(owner), c = math.min(1.0, amount * chroma);
    final L = a.$1 + (o.$1 - a.$1) * amount, A = a.$2 + (o.$2 - a.$2) * c, B = a.$3 + (o.$3 - a.$3) * c;
    final l = math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3).toDouble();
    final m = math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3).toDouble();
    final s = math.pow(L - 0.0894841775 * A - 1.2914855480 * B, 3).toDouble();
    int ch(double v) => math.max(0, math.min(255, _unlin(v).round()));
    return 0xFF000000 | ch(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) << 16 |
        ch(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) << 8 | ch(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
  }();
}
