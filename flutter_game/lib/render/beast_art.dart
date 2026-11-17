// الترول الثلجي والفارس الأسود (2.2.1، بحزمتي المستخدم): قطع صورهما في أطلس الجنود، وحركاتهما إطارات جاهزة
// (lib/data/beast_frames.dart من scripts/import_beasts.py) يُمزج بين كل إطارين، فلا هيكل ولا وضعيات تُحسب
import 'dart:math' as math;

import '../data/beast_frames.dart';
import 'batch.dart';
import 'unit_atlas.dart';

// clip: الحركة، وt ثانيتها فيها (تتكرر الدائرة منها وتقف الأخرى عند آخرها). dir اتجاه الوجه (1 يمين)، وsize
// نسبة حجمها إلى حجمها المعتاد. false: لا لوح لها في الأطلس (يُرسم شكلها القديم)
bool drawBeast(TriBatch b, UnitAtlas atlas, String key, String clip, double t, double x, double y, double dir, double size, double alpha) {
  final beast = BEASTS[key], at = atlas.at(key, '#ffffff');
  if (beast == null || at == null) {
    if (beast != null) atlas.missing.add((key, '#ffffff'));
    return false;
  }
  final c = beast.clips[clip] ?? beast.clips['idle']!;
  final (_, loop, data) = c;
  final per = beast.parts.length * 3, n = data.length ~/ per;
  var f = t * BEAST_FPS;
  if (loop) { f %= n; } else { f = f.clamp(0.0, (n - 1).toDouble()); }
  final i0 = f.floor() % n, i1 = loop ? (i0 + 1) % n : math.min(n - 1, i0 + 1), u = f - f.floor();
  final (ox, oy) = at;
  final k = beast.unit, w = beast.world * size;
  b.save();
  b.alpha = alpha;
  b.translate(x, y);
  b.scale(w * dir, w);
  // ظل تحت القدمين بعرض الشخصية
  b.ellipse(0, 0, 14 / beast.world, 3.2 / beast.world, 0x000000, 0.28);
  for (var p = 0; p < beast.parts.length; p++) {
    final a0 = i0 * per + p * 3, a1 = i1 * per + p * 3, q = beast.parts[p];
    b.imageAt(ox + q[0], oy + q[1], q[2], q[3], q[4], q[5],
        data[a0] + (data[a1] - data[a0]) * u, data[a0 + 1] + (data[a1 + 1] - data[a0 + 1]) * u,
        data[a0 + 2] + (data[a1 + 2] - data[a0 + 2]) * u, k);
  }
  b.restore();
  return true;
}
