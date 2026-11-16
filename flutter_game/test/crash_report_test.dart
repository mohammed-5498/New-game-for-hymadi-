// نافذة سبب الإغلاق تُعرض بلا أخطاء تخطيط (2.1.5)
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/ui/crash_report.dart';

void main() {
  testWidgets('نافذة التقرير', (tester) async {
    tester.view.physicalSize = const Size(2280, 1080);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(tester.view.reset);
    final text = ['الجهاز SM-N975F • أندرويد sdk 31', 'انهيار في المحرك (كود أصلي)\n${'#00 pc 000123 libflutter.so\n' * 60}'].join('\n\n');
    await tester.pumpWidget(MaterialApp(home: Builder(builder: (c) => Directionality(textDirection: TextDirection.rtl,
        child: Scaffold(body: TextButton(onPressed: () => showCrashReport(c, text), child: const Text('x')))))));
    await tester.tap(find.text('x'));
    await tester.pumpAndSettle();
    expect(find.text('سبب إغلاق اللعبة آخر مرة'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
