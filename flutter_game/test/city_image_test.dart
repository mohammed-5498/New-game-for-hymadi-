// المدينة صورة جاهزة (2.10.0): إطار معركة في شبام (أبراج عالية وجنود خلفها وأمامها) بالصورة والمباني المعادة فوق الجنود كالإطار
// المرسوم مباشرة، والإعادة تحدث فعلاً. OUT=<مجلد> يحفظ الإطارين صوراً، وCITY وFF لمشهد آخر
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/render/city_layer.dart';
import 'package:gangcity/ui/match_screen.dart';
import 'package:gangcity/ui/prefs.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('إطار المدينة الجاهزة كالمباشر', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await Prefs.init();
    tester.view.physicalSize = const Size(2280, 1080);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(tester.view.reset);
    final key = GlobalKey<MatchScreenState>();
    await tester.runAsync(() => tester.pumpWidget(MaterialApp(home: MatchScreen(key: key, settings: {
      'seed': 777, 'mapSize': 'medium', 'city': Platform.environment['CITY'] ?? 'shibam', 'weather': 'day', 'mode': 'conquest', 'maxUnits': 100,
      'ff': double.parse(Platform.environment['FF'] ?? '150'), 'watch': true, 'fog': false, 'temples': true, 'zoom': 2.2,
      'players': [
        for (var k = 0; k < 4; k++)
          {'name': 'p$k', 'gang': ['crows', 'hammers', 'vipers', 'scorpions'][k], 'nation': null, 'color': ['blue', 'red', 'green', 'yellow'][k],
            'isHuman': false, 'team': 0, 'difficulty': 'hard'},
      ],
    }))));
    await tester.runAsync(() async {
      for (var k = 0; k < 4000 && key.currentState?.layer == null; k++) { await Future<void>.delayed(const Duration(milliseconds: 50)); }
    });
    await tester.pump();
    final st = key.currentState!;
    final scene = tester.allRenderObjects.whereType<RenderCustomPaint>().firstWhere((r) => r.painter.runtimeType.toString() == '_MatchPainter');
    Future<List<int>> shot() async {
      st.frame.value++;
      await tester.pump(Duration.zero);
      final img = (await tester.runAsync(() => (scene.parent! as RenderRepaintBoundary).toImage(pixelRatio: 2.625)))!;
      final data = (await tester.runAsync(() => img.toByteData()))!;
      final out = Platform.environment['OUT'];
      if (out != null) {
        final png = (await tester.runAsync(() => img.toByteData(format: ui.ImageByteFormat.png)))!;
        File('$out/${GroundCache.enabled ? 'cached' : 'direct'}.png').writeAsBytesSync(png.buffer.asUint8List());
      }
      return data.buffer.asUint8List();
    }
    for (var k = 0; k < 8; k++) { st.frame.value++; await tester.pump(Duration.zero); }   // تستقر الكاميرا وتُرسم الصورة
    CityLayer.redrawn = 0;
    final cached = await shot();
    expect(CityLayer.redrawn, greaterThan(0), reason: 'في المشهد جنود خلف مبانٍ');
    GroundCache.enabled = false;
    final direct = await shot();
    GroundCache.enabled = true;
    var sum = 0, big = 0;
    for (var k = 0; k < direct.length; k++) {
      final d = (direct[k] - cached[k]).abs();
      sum += d;
      if (d > 60) big++;
    }
    // ignore: avoid_print
    print('CITY-IMAGE mean ${(sum / direct.length).toStringAsFixed(3)} big ${(big / direct.length * 100).toStringAsFixed(3)}% redrawn ${CityLayer.redrawn}');
    expect(sum / direct.length, lessThan(2.0));
    expect(big / direct.length, lessThan(0.003));
  }, timeout: const Timeout(Duration(minutes: 5)));
}
