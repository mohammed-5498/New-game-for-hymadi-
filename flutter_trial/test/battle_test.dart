// المعركة تنتهي بفريق واحد، ولا يدخل أحد مبنى
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity_trial/battle.dart';

void main() {
  test('battle ends and nobody walks into buildings', () {
    const n = 30;
    final walk = Uint8List(n * n)..fillRange(0, n * n, 1);
    for (var j = 10; j < 20; j++) { walk[j * n + 14] = 0; walk[j * n + 15] = 0; }   // جدار في الوسط
    final b = Battle(n, walk, [[3, 15], [26, 15]]);
    b.spawn(100);
    var ended = false;
    for (var t = 0; t < 20 * 120 && !ended; t++) {
      b.step();
      for (final u in b.units) { expect(b.openAt(u.x, u.y), isTrue); }
      ended = b.endedAt != null;
    }
    expect(ended, isTrue);
  });
}
