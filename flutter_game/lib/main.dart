// مدينة العصابات بـ Flutter (القسم 18 في GAME_SPEC): القائمة الرئيسية أولاً (lib/ui/menus.dart)
import 'package:flutter/foundation.dart' show LicenseEntryWithLineBreaks, LicenseRegistry;
import 'package:flutter/material.dart' hide Text;
import 'package:flutter/services.dart';

import 'audio/sound.dart';
import 'core/cfg.dart';
import 'data/js_config.dart';
import 'i18n/tr.dart';
import 'ui/cpu_guard.dart';
import 'ui/crash_report.dart';
import 'ui/match_screen.dart';
import 'ui/menus.dart';
import 'ui/migrate.dart';
import 'ui/prefs.dart';
import 'ui/achievements.dart';
import 'ui/daily.dart';
import 'ui/wallet.dart';
import 'ui/widgets.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
  await Prefs.init();
  Lang.load();                // العربية أو الإنجليزية (2.5.0): ما اختاره اللاعب، أو لغة الجوال أول مرة
  LicenseRegistry.addLicense(() async* {   // خط El Messiri برخصة SIL OFL 1.1
    yield LicenseEntryWithLineBreaks(['El Messiri'], await rootBundle.loadString('assets/fonts/OFL.txt'));
  });
  watchDartErrors();          // أخطاء كود اللعبة تُحفظ وتُعرض عند الفتح التالي (ui/crash_report.dart، 2.1.5)
  await migrateOldSave();     // أول تشغيل فوق اللعبة القديمة: إحصائياتها وتقدمها وإعداداتها (ui/migrate.dart)
  Settings.load();
  Wallet.load();              // الذهب والمشتريات (2.12.0)
  Wallet.testGift();          // ذهب التجربة مرة واحدة (2.16.0)
  Achievements.load();        // الإنجازات (2.13.0)
  Daily.load();               // المكافآت اليومية (2.14.0)
  await GameSound.init();
  GameSound.intro();
  CpuGuard.start();           // حارس المعالج (2.8.0): وقت اللعبة على المعالج، وإيقاع اللعب ينزل إن تجاوزت حصتها
  WidgetsBinding.instance.addObserver(_AppLife());
  runApp(MaterialApp(
    debugShowCheckedModeBanner: false,
    title: Lang.en ? 'Gang City' : 'مدينة العصابات',
    theme: ThemeData(brightness: Brightness.dark, colorSchemeSeed: gold, scaffoldBackgroundColor: deep, fontFamily: 'ElMessiri'),
    // اللغة فوق كل الشاشات: تغييرها يعيد بناء كل Text (LangScope) والقائمة مكانها. والترتيب من اليمين لليسار في اللغتين
    // (2.6.0، بطلب المستخدم: "عند تغيير اللغة إلى الإنجليزية لا تقم بعكس الاتجاه")، ونص الإنجليزية نفسه من اليسار لليمين (Text)
    builder: (context, child) => ValueListenableBuilder<String>(valueListenable: Lang.notifier, builder: (_, code, _) =>
        LangScope(code: code, child: Directionality(textDirection: TextDirection.rtl, child: child!))),
    home: _testMatch() ?? const _Intro(),
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
    'maxUnits': 100, 'fog': q['fog'] == '1', 'seed': int.tryParse(q['seed'] ?? ''), 'ff': double.tryParse(q['ff'] ?? '') ?? 0, 'watch': q['watch'] == '1', 'zoom': double.tryParse(q['zoom'] ?? ''), 'temples': q['temples'] != '0', 'cam': q['cam'], 'fort': int.tryParse(q['fort'] ?? ''),
    'players': [
      for (var k = 0; k <= bots; k++)
        {'name': k == 0 ? 'أنت' : 'بوت $k', ...resolveSide(q['side$k'] ?? gangs[k % 4]), 'color': colors[k], 'isHuman': k == 0 && q['spectate'] != '1',
          'team': 0, 'difficulty': q['level'] ?? 'medium'},
    ],
  });
}

// تصغير التطبيق: يصمت الصوت كله ويعود عند الرجوع، ولا يقرأ حارس المعالج والتطبيق في الخلفية
class _AppLife with WidgetsBindingObserver {
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    GameSound.hold(state == AppLifecycleState.paused || state == AppLifecycleState.hidden || state == AppLifecycleState.inactive);
    if (state == AppLifecycleState.resumed) CpuGuard.start();
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) CpuGuard.stop();
  }
}

// شاشة التشغيل (introBlackout في blackout.js، UI.intro): سوداء مع صوت البداية، ثم تتلاشى إلى القائمة ولحنها
class _Intro extends StatefulWidget {
  const _Intro();
  @override
  State<_Intro> createState() => _IntroState();
}

class _IntroState extends State<_Intro> {
  bool done = false;
  @override
  void initState() {
    super.initState();
    Future<void>.delayed(Duration(milliseconds: (UI.m('intro').d('seconds') * 1000).round()), () { if (mounted) setState(() => done = true); });
  }
  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
    duration: Duration(milliseconds: UI.m('intro').i('fadeMs')),
    child: done ? const MainMenu() : const ColoredBox(color: Colors.black, child: SizedBox.expand()),
  );
}
