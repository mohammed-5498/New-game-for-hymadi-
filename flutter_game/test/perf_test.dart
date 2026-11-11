// قياس كلفة الإطار على المعالج (للفحص فقط، لا يدخل الفحص العادي: flutter test test/perf_test.dart)
// مباراة أربعة لاعبين بعد دقيقتين ونصف، والكاميرا على أكبر اشتباك: زمن التحديث، وزمن بناء الإطار بأقسامه
@Tags(['perf'])
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/empire.dart';
import 'package:gangcity/game/modes.dart';
import 'package:gangcity/game/spawn.dart';
import 'package:gangcity/game/victory.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/render/city_layer.dart';
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
      'seed': 777, 'mapSize': 'medium', 'city': 'rio', 'weather': 'night', 'mode': 'conquest', 'maxUnits': 100, 'ff': 240.0, 'watch': true,
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
    final sims = <int>[], frames = <int>[];
    final sw = Stopwatch()..start();
    final worst = <(int, Map<String, int>)>[];
    // تسخين: أول 400 إطار يبنيها مترجم وضع الفحص (لا يوجد في التطبيق)، ثم القياس
    for (var k = 0; k < 400; k++) { updateMatch(s); await tester.pump(const Duration(milliseconds: 17)); }
    probe.clear();
    for (var k = 0; k < 400; k++) {
      sw.reset();
      updateMatch(s);
      sims.add(sw.elapsedMicroseconds);
      final before = Map.of(probe);
      sw.reset();
      await tester.pump(const Duration(milliseconds: 17));
      frames.add(sw.elapsedMicroseconds);
      worst.add((sw.elapsedMicroseconds, {for (final e in probe.entries) if (e.value - (before[e.key] ?? 0) > 300) e.key: e.value - (before[e.key] ?? 0)}));
    }
    worst.sort((a, b) => b.$1 - a.$1);
    // ignore: avoid_print
    for (final w in worst.take(6)) { print('spike ${(w.$1 / 1000).toStringAsFixed(1)} ms: ${w.$2.map((k, v) => MapEntry(k, (v / 1000).toStringAsFixed(1)))}'); }
    perfProbe = null;
    final st = key.currentState!, lsw = Stopwatch()..start();
    for (var k = 0; k < 5; k++) { CityLayer(s.map, st.art!, s.weather).dispose(); }
    // ignore: avoid_print
    print('city layer rebuild ${(lsw.elapsedMicroseconds / 5 / 1000).toStringAsFixed(1)} ms; map changes during run: ${s.mapVersion}');
    // الواجهة وحدها: إعادة بنائها بلا تحديث للمنطق، وإطار بلا شيء
    final hudT = <int>[], idleT = <int>[];
    for (var k = 0; k < 30; k++) {
      st.hud.value++;
      sw.reset(); await tester.pump(Duration.zero); hudT.add(sw.elapsedMicroseconds);
      st.frame.value++;
      sw.reset(); await tester.pump(Duration.zero); idleT.add(sw.elapsedMicroseconds);
    }
    // الواجهة مع قائمة القاعدة مفتوحة
    st.menuDistrict = s.map.districts.firstWhere((d) => d.owner == 0 && d.building == 'hq', orElse: () => s.map.districts.first).id;
    final menuT = <int>[];
    for (var k = 0; k < 30; k++) { st.hud.value++; sw.reset(); await tester.pump(Duration.zero); menuT.add(sw.elapsedMicroseconds); }
    {
      final t = Stopwatch()..start();
      void time(String name, void Function() f) {
        t.reset();
        for (var k = 0; k < 20; k++) { f(); }
        // ignore: avoid_print
        print('  $name ${(t.elapsedMicroseconds / 20 / 1000).toStringAsFixed(3)} ms');
      }
      time('modeBar', () => modeBar(s));
      time('powerColumn', () => powerColumn(s));
      time('incomeOf', () => incomeOf(s, 0));
      time('owned+count all', () { for (final p in s.players) { ownedDistricts(s, p.id); countUnits(s, p.id); isPlayerAlive(s, p.id); } });
    }
    // ignore: avoid_print
    print('hud rebuild ${(hudT.reduce((a, b) => a + b) / 30000).toStringAsFixed(2)} ms, with menu ${(menuT.reduce((a, b) => a + b) / 30000).toStringAsFixed(2)} ms, scene only ${(idleT.reduce((a, b) => a + b) / 30000).toStringAsFixed(2)} ms');
    String stat(List<int> v) {
      final o = [...v]..sort();
      return 'avg ${(v.reduce((a, b) => a + b) / v.length / 1000).toStringAsFixed(2)} p95 ${(o[(o.length * 0.95).floor()] / 1000).toStringAsFixed(2)} max ${(o.last / 1000).toStringAsFixed(2)}';
    }
    // ignore: avoid_print
    print('units ${s.units.where((u) => u.state != 'dead').length}  sim [${stat(sims)}]  frame [${stat(frames)}]  sections: '
        '${probe.map((k, v) => MapEntry(k, (v / 400 / 1000).toStringAsFixed(2)))}');
  });
}
