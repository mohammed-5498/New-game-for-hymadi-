// واجهة المباراة على شاشة بحجم جوال المستخدم (2.16.0، نحو 690×360 نقطة): قائمة القاعدة بأقسامها والإشعار فوقها بلا أخطاء،
// ومجموعات التحكم ثلاث، واللمسة الواحدة تحدد فوراً (كانت تنتظر 300 ملي ث احتمال لمسة ثانية)
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/config.dart' show GROUPS;
import 'package:gangcity/game/state.dart';
import 'package:gangcity/ui/match_screen.dart';
import 'package:gangcity/ui/prefs.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('قائمة القاعدة والإشعار والمجموعات', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await Prefs.init();
    tester.view.physicalSize = const Size(1811, 945);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(tester.view.reset);
    final key = GlobalKey<MatchScreenState>();
    await tester.runAsync(() => tester.pumpWidget(MaterialApp(home: MatchScreen(key: key, settings: {
      'seed': 5, 'mapSize': 'medium', 'city': 'shibam', 'weather': 'day', 'mode': 'king', 'maxUnits': 100, 'fog': false, 'temples': true,
      'players': [
        for (var k = 0; k < 4; k++)
          {'name': 'p$k', 'gang': ['crows', 'hammers', 'vipers', 'scorpions'][k], 'nation': null, 'color': ['blue', 'red', 'green', 'yellow'][k],
            'isHuman': k == 0, 'team': 0, 'difficulty': 'medium'},
      ],
    }))));
    await tester.runAsync(() async {
      for (var k = 0; k < 4000 && key.currentState?.layer == null; k++) { await Future<void>.delayed(const Duration(milliseconds: 50)); }
    });
    await tester.pump();
    final st = key.currentState!, s = st.state!;

    // قائمة القاعدة وفوقها إشعار طويل
    st.menuDistrict = s.map.districts.firstWhere((d) => d.owner == s.humanId && d.building == 'hq').id;
    s.notice = Notice('ميزة المدينة — القرى المحايدة: أهلها ينضمون لمن يستولي على قريتهم، وإشعار أطول ليأخذ سطرين في الشاشة', true, 5);
    st.hud.value++;
    await tester.pump();
    expect(tester.takeException(), isNull);
    for (final t in ['الجنود', 'ترقيات العصابة', 'السور', 'القاعدة الرئيسية']) { expect(find.text(t), findsOneWidget, reason: t); }

    // المجموعات: GROUPS.count خانات، واللمسة تحدد بلا انتظار
    final mine = [for (final u in s.units) if (u.playerId == s.humanId && u.state != 'dead') u];
    for (final u in mine) { u.group = 1; u.selected = false; }
    st.hud.value++;
    await tester.pump();
    expect(find.byWidgetPredicate((w) => w.runtimeType.toString() == '_Group'), findsNWidgets(GROUPS.count));
    expect(find.textContaining('·'), findsOneWidget, reason: 'مجموعة واحدة فيها جنود');
    await tester.tap(find.text('1·${mine.length}'));
    await tester.pump();
    expect(mine.every((u) => u.selected), isTrue, reason: 'تحددت فوراً');
    expect(tester.takeException(), isNull);
  }, timeout: const Timeout(Duration(minutes: 5)));
}
