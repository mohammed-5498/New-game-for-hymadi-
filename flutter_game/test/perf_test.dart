// قياس كلفة الإطار على المعالج (للفحص فقط، لا يدخل الفحص العادي: flutter test test/perf_test.dart)
// مباراة أربعة لاعبين بعد دقيقتين ونصف، والكاميرا على أكبر اشتباك: زمن التحديث، وزمن بناء الإطار بأقسامه
@Tags(['perf'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/ui/match_screen.dart';
import 'package:gangcity/ui/prefs.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('كلفة الإطار', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await Prefs.init();
    tester.view.physicalSize = const Size(2280, 1080);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(tester.view.reset);
    final key = GlobalKey<MatchScreenState>();
    await tester.runAsync(() => tester.pumpWidget(MaterialApp(home: MatchScreen(key: key, settings: {
      'seed': 777, 'mapSize': 'medium', 'city': 'rio', 'weather': 'night', 'mode': 'conquest', 'maxUnits': 100, 'ff': 150.0, 'watch': true,
      'players': [
        for (var k = 0; k < 4; k++)
          {'name': 'p$k', 'gang': ['crows', 'hammers', 'vipers', 'scorpions'][k], 'nation': k == 1 ? 'brazil' : null,
            'color': ['blue', 'red', 'green', 'yellow'][k], 'isHuman': false, 'team': 0, 'difficulty': 'hard'},
      ],
    }))));
    await tester.runAsync(() async {
      for (var k = 0; k < 4000 && key.currentState?.layer == null; k++) { await Future<void>.delayed(const Duration(milliseconds: 50)); if (k % 400 == 0) print("load ${key.currentState?.loadProgress}"); }
    });
    await tester.pump();
    final s = key.currentState!.state!;
    s.camera.z = 2.2;
    final probe = perfProbe = <String, int>{};
    final sim = Stopwatch(), frame = Stopwatch();
    for (var k = 0; k < 240; k++) {
      sim.start();
      updateMatch(s);
      sim.stop();
      frame.start();
      await tester.pump(const Duration(milliseconds: 17));
      frame.stop();
    }
    perfProbe = null;
    final n = 240;
    // ignore: avoid_print
    print('units ${s.units.where((u) => u.state != 'dead').length}  sim ${(sim.elapsedMicroseconds / n / 1000).toStringAsFixed(2)} ms'
        '  frame ${(frame.elapsedMicroseconds / n / 1000).toStringAsFixed(2)} ms  sections: '
        '${probe.map((k, v) => MapEntry(k, (v / n / 1000).toStringAsFixed(2)))}');
  });
}
