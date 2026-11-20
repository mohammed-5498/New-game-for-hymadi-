// حارس المعالج (2.8.0، بطلب المستخدم بعد رسالة "العناية بالجهاز" في سامسونج: "وتأكد من عدم حدوث ذلك مرة ثانية"):
// وقت اللعبة على المعالج من /proc/self/stat كل ثانية، بنسبته من الجهاز كله (الرقم نفسه في رسالة سامسونج). وفي المباراة
// إن تجاوز متوسطه حصتها (CPU في config.dart) نزل إيقاع اللعب درجة، وإن قل كثيراً مدة صعد. وخيوطها لعدّاد الأداء.
// لا يعمل حيث لا /proc (المتصفح)، ويتوقف والتطبيق في الخلفية
import 'dart:async';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/foundation.dart' show kIsWeb, visibleForTesting;

import '../config.dart';
import 'prefs.dart';

class CpuGuard {
  static final int cores = kIsWeb ? 1 : math.max(1, Platform.numberOfProcessors);
  // الحصة بالأنوية: share من الجهاز، ولا أكثر من CPU.cores، وأقل مع توفير البطارية
  static double get budget => math.min(CPU.cores, CPU.share * cores) * (Settings.battery ? CPU.saver : 1);
  static int step = 0;                     // درجة إيقاع اللعب في CPU.steps
  static double get fps => CPU.steps[step];
  static double used = -1;                 // متوسط آخر ثوانٍ بالأنوية (-1: لا يُقرأ هنا)
  static bool detail = false;              // عدّاد الأداء ظاهر: يقرأ الخيوط أيضاً
  static List<(String, double)> threads = const [];   // أثقل الخيوط بنسبة نواة

  static Timer? _timer;
  static bool _inMatch = false;
  static final _hist = <double>[];
  static final _clock = Stopwatch()..start();
  static int _last = -1, _at = 0, _calm = 0, _held = 0;
  static Map<int, (String, int)> _prev = const {};

  static void start() {
    if (kIsWeb || _timer != null) return;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _sample());
  }

  // الخلفية: لا قراءة، ولا فرق كبير بعدها
  static void stop() {
    _timer?.cancel();
    _timer = null;
    _last = -1;
    _hist.clear();
    _prev = const {};
  }

  // المباراة تعمل: يحكم بعد grace ثوانٍ (أول الإطارات تجهّز صوراً وظلالاً)، ولا يحكم في الإيقاف والقوائم والتحميل
  static void enter({int grace = 3}) { _inMatch = true; _held = grace; _hist.clear(); _calm = 0; }
  static void leave() => _inMatch = false;

  // utime + stime (الحقلان 14 و15) بأجزاء المئة من الثانية، بعد اسم الخيط بين القوسين (قد يحوي مسافات)
  static int _ticksOf(String stat) {
    final f = stat.substring(stat.lastIndexOf(')') + 2).split(' ');
    return int.parse(f[11]) + int.parse(f[12]);
  }

  static void _sample() {
    final int t;
    try { t = _ticksOf(File('/proc/self/stat').readAsStringSync()); } catch (_) { stop(); return; }
    final now = _clock.elapsedMicroseconds;
    if (_last >= 0 && now > _at) {
      final secs = (now - _at) / 1e6;
      if (detail) _threads(secs);
      add((t - _last) / 100 / secs);
    }
    _last = t;
    _at = now;
  }

  // قراءة ثانية بالأنوية (من _sample، أو من الفحص test/cpu_guard_test.dart)
  @visibleForTesting
  static void add(double cores) {
    _hist.add(cores);
    if (_hist.length > CPU.window) _hist.removeAt(0);
    used = _hist.reduce((a, b) => a + b) / _hist.length;
    if (_inMatch) _govern();
  }

  static void _govern() {
    if (_held > 0) { _held--; return; }
    if (_hist.length >= CPU.window && used > budget && step < CPU.steps.length - 1) {
      step++;
    } else {
      _calm = used < budget * CPU.relax ? _calm + 1 : 0;
      if (_calm < CPU.calmSeconds || step == 0) return;
      step--;
    }
    _calm = 0;
    _held = CPU.hold;
    _hist.clear();                        // الإيقاع الجديد يُقاس من أوله
  }

  // كل خيط بنسبة نواة منذ القراءة السابقة، والخيوط بالاسم نفسه معاً (الخيط الرئيسي فيه كود Dart منذ Flutter 3.29)
  static void _threads(double secs) {
    final now = <int, (String, int)>{};
    try {
      for (final e in Directory('/proc/self/task').listSync()) {
        try {
          final st = File('${e.path}/stat').readAsStringSync(), tid = int.parse(e.path.substring(e.path.lastIndexOf('/') + 1));
          now[tid] = (tid == pid ? 'main' : st.substring(st.indexOf('(') + 1, st.lastIndexOf(')')), _ticksOf(st));
        } catch (_) {}
      }
    } catch (_) { return; }
    final sums = <String, double>{};
    now.forEach((tid, v) {
      final before = _prev[tid];
      final d = v.$2 - (before?.$2 ?? v.$2);
      if (d > 0) sums[v.$1] = (sums[v.$1] ?? 0) + d / 100 / secs;
    });
    _prev = now;
    threads = [for (final e in sums.entries) (e.key, e.value)]..sort((a, b) => b.$2.compareTo(a.$2));
  }
}
