// حارس المعالج (2.8.0): فوق الحصة ينزل إيقاع اللعب درجة بعد window ثوانٍ، ولا ينزل ثانية قبل hold، ويقف عند آخر درجة،
// وتحت relax منها calmSeconds يصعد، ولا يحكم خارج المباراة
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/config.dart' show CPU;
import 'package:gangcity/ui/cpu_guard.dart';

void main() {
  test('حارس المعالج', () {
    final high = CpuGuard.budget * 2, low = CpuGuard.budget * CPU.relax * 0.5;
    void feed(double v, int n) { for (var k = 0; k < n; k++) { CpuGuard.add(v); } }
    CpuGuard.step = 0;
    CpuGuard.enter(grace: 0);
    feed(high, CPU.window - 1);
    expect(CpuGuard.step, 0, reason: 'لا ينزل قبل أن تمتلئ نافذة القياس');
    feed(high, 1);
    expect(CpuGuard.step, 1);
    expect(CpuGuard.fps, CPU.steps[1]);
    feed(high, CPU.hold);
    expect(CpuGuard.step, 1, reason: 'ينتظر hold بعد كل تغيير');
    feed(high, 100);
    expect(CpuGuard.step, CPU.steps.length - 1, reason: 'يقف عند أبطأ درجة');
    feed(low, CPU.hold + CPU.calmSeconds);
    expect(CpuGuard.step, CPU.steps.length - 2, reason: 'يصعد درجة بعد هدوء calmSeconds');
    CpuGuard.leave();
    feed(high, 100);
    expect(CpuGuard.step, CPU.steps.length - 2, reason: 'لا يحكم خارج المباراة');
    CpuGuard.enter(grace: 0);
    feed(low, 100);
    expect(CpuGuard.step, 0, reason: 'يعود إلى أسرع درجة');
    CpuGuard.leave();
  });
}
