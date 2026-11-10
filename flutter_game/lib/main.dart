// مدينة العصابات بـ Flutter (القسم 18 في GAME_SPEC): القائمة الرئيسية أولاً (lib/ui/menus.dart)
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'audio/sound.dart';
import 'core/cfg.dart';
import 'data/js_config.dart';
import 'ui/match_screen.dart';
import 'ui/menus.dart';
import 'ui/prefs.dart';
import 'ui/widgets.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
  await Prefs.init();
  Settings.load();
  await GameSound.init();
  GameSound.intro();
  WidgetsBinding.instance.addObserver(_AppLife());
  runApp(MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'مدينة العصابات',
    theme: ThemeData(brightness: Brightness.dark, colorSchemeSeed: gold, scaffoldBackgroundColor: deep),
    builder: (context, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
    home: _testMatch() ?? const MainMenu(),
  ));
}

// للفحص في المتصفح: ?match=1&city=hk&size=small&bots=3&ff=60&watch=1&spectate=1&zoom=3&mode=points
Widget? _testMatch() {
  final q = Uri.base.queryParameters;
  if (q['match'] != '1') return null;
  final gangs = [for (final g in GANG_IDS) g as String], colors = [for (final c in PLAYER_COLORS) (c as J).s('id')];
  final bots = int.tryParse(q['bots'] ?? '') ?? 3;
  return MatchScreen(settings: {
    'mapSize': q['size'] ?? 'medium', 'city': q['city'] ?? 'random', 'weather': q['weather'] ?? 'day', 'mode': q['mode'] ?? 'conquest',
    'maxUnits': 100, 'ff': double.tryParse(q['ff'] ?? '') ?? 0, 'watch': q['watch'] == '1', 'zoom': double.tryParse(q['zoom'] ?? ''),
    'players': [
      for (var k = 0; k <= bots; k++)
        {'name': k == 0 ? 'أنت' : 'بوت $k', ...resolveSide(q['side$k'] ?? gangs[k % 4]), 'color': colors[k], 'isHuman': k == 0 && q['spectate'] != '1',
          'team': 0, 'difficulty': q['level'] ?? 'medium'},
    ],
  });
}

// تصغير التطبيق: يصمت الصوت كله ويعود عند الرجوع
class _AppLife with WidgetsBindingObserver {
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) =>
      GameSound.hold(state == AppLifecycleState.paused || state == AppLifecycleState.hidden || state == AppLifecycleState.inactive);
}
