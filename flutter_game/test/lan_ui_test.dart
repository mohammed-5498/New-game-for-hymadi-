// قائمة إعداد المضيف (SetupScreen(lan: true)) بمقاس جوال أفقي: بلا فيض، وأطوار اللعب المحلي وحدها، ولا بدء بلا صديق
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/ui/menus.dart';
import 'package:gangcity/ui/prefs.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('إعداد المضيف', (tester) async {
    SharedPreferences.setMockInitialValues({'gangcity.setup': '{"mode":"survival"}'});
    await Prefs.init();
    tester.view.physicalSize = const Size(2000, 780);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(const MaterialApp(home: Directionality(textDirection: TextDirection.rtl, child: SetupScreen(lan: true))));
    await tester.pump();
    expect(find.textContaining('مباراة محلية باسم'), findsOneWidget);
    expect(find.textContaining('بانتظار الأصدقاء'), findsOneWidget);
    expect(find.text('الصمود ضد الشرطة'), findsNothing, reason: 'الصمود ليس من أطوار اللعب المحلي');
    await tester.tap(find.text('ابدأ'));
    await tester.pump();
    expect(find.text('انتظر حتى ينضم صديق واحد على الأقل.'), findsOneWidget);
  });
}
