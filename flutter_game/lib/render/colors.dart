// ألوان الرسم كـ js/render/colors.js وcityThemes.js: الألوان أعداد ARGB، والخلط بتقريب Math.round نفسه
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
