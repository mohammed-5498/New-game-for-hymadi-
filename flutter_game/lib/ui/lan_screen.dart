// شاشة اللعب المحلي (js/ui/lanScreen.js، القسم 16): تبحث وحدها حين تُفتح، فتظهر المباريات القريبة أزراراً ولمسة
// تنضم إليها، وزر استضافة كبير، والاسم معبأ سلفاً، وعنوان المضيف باليد مخفي تحت رابط صغير.
// بعد الانضمام: غرفة انتظار المنضم. والمضيف يعدّ المباراة في قائمة الإعداد نفسها (SetupScreen(lan: true))
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';

import '../core/cfg.dart';
import '../data/js_config.dart';
import '../net/session.dart';
import 'match_screen.dart';
import 'menus.dart';
import 'prefs.dart';
import 'widgets.dart';

const _prefsKey = 'gangcity.prefs';   // كاللعبة الحالية (js/prefs.js): lanName وlanSide

class LanScreen extends StatefulWidget {
  const LanScreen({super.key});
  @override
  State<LanScreen> createState() => _LanScreenState();
}

class _LanScreenState extends State<LanScreen> {
  String view = 'home';          // home (المباريات القريبة والاستضافة) | lobby (غرفة انتظار المنضم)
  bool busy = false, manual = false, inMatch = false;
  String status = '';
  bool statusError = false;
  late final TextEditingController nameCtl, ipCtl = TextEditingController();
  late String side;
  StreamSubscription<String>? _sub;
  Timer? _timer;

  Map<String, Object?> get _prefs => Prefs.read(_prefsKey) ?? {};
  void _pref(String k, Object v) => Prefs.write(_prefsKey, {..._prefs, k: v});

  @override
  void initState() {
    super.initState();
    // اسم جاهز من أول مرة (لاعب ورقم)، فلا خطوة قبل اللعب، ويبقى قابلاً للتغيير
    var name = _prefs['lanName'] as String?;
    if (name == null) { name = cleanName('لاعب ${10 + math.Random().nextInt(90)}'); _pref('lanName', name); }
    nameCtl = TextEditingController(text: name);
    side = _prefs['lanSide'] is String ? _prefs['lanSide'] as String : 'random';
    _sub = Lan.events.listen(_onEvent);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) { if (mounted && view == 'home') setState(() {}); });   // المضيف الذي توقف إعلانه يختفي
    if (!kIsWeb) _goHome();
  }

  @override
  void dispose() {
    _sub?.cancel();
    _timer?.cancel();
    Lan.leave();
    super.dispose();
  }

  Future<void> _onEvent(String e) async {
    if (!mounted) return;
    if (e == 'start' && Lan.L != null && !inMatch) {
      // المضيف بدأ المباراة: المنضم يدخلها مباشرة (ولو كانت لوحة الأمم مفتوحة عنده)
      Navigator.of(context).popUntil((r) => r is! PopupRoute);   // لوحة الأمم إن كانت مفتوحة
      inMatch = true;
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => MatchScreen(lanState: Lan.L!.state)));
      inMatch = false;
      if (!mounted) return;
      if (Lan.role == 'client' && Lan.phase == 'lobby') { setState(() => view = 'lobby'); } else if (Lan.role == null) { _goHome(); }
      return;
    }
    if (e == 'left') {                  // انقطع المنضم عن المضيف (أو أغلق المضيف الجلسة)
      _goHome();
      _status(Lan.leftReason, true);
      return;
    }
    setState(() {});
  }

  // الشاشة الأولى: البحث يبدأ وحده (ويعاد بعد كل رجوع إليها)
  void _goHome() {
    setState(() { view = 'home'; status = ''; });
    Lan.search().then((_) { if (mounted) setState(() {}); });
  }

  void _status(String text, [bool error = false]) => setState(() { status = text; statusError = error; });

  String _myName() {
    final name = cleanName(nameCtl.text);
    nameCtl.text = name;
    _pref('lanName', name);
    return name;
  }

  Future<void> _host() async {
    if (busy) return;
    busy = true;
    _status('جارٍ بدء الاستضافة…');
    try {
      await Lan.hostLan(_myName());
      _status('');
      if (mounted) await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SetupScreen(lan: true)));
      // رجع المضيف من قائمة الإعداد: يوقف الاستضافة ويعود لهذه الشاشة
      Lan.leave();
      if (mounted) _goHome();
    } catch (e) {
      _status('$e'.replaceFirst('Exception: ', ''), true);
      Lan.search();
    }
    busy = false;
  }

  Future<void> _connect(String ip, int port) async {
    ip = ip.trim();
    if (busy || ip.isEmpty) return;
    busy = true;
    _status('جارٍ الاتصال…');
    try {
      await Lan.join(ip, port, _myName(), side);
      setState(() { view = 'lobby'; status = ''; });
    } catch (e) {
      _goHome();                         // البحث يعود فيختار غيرها أو يعيد المحاولة
      _status('$e'.replaceFirst('Exception: ', ''), true);
    }
    busy = false;
  }

  void _back() {
    if (view == 'lobby') { Lan.leave(); _goHome(); return; }
    Navigator.of(context).pop();
  }

  Future<void> _pickSide() async {
    final pick = await pickSide(context, side);
    if (pick == null) return;
    setState(() => side = pick);
    _pref('lanSide', pick);
    Lan.setSide(pick);
  }

  Widget _home() {
    final now = DateTime.now();
    final games = [for (final g in Lan.found.values) if (now.difference(g.at).inSeconds < NET.i('foundSeconds')) g];
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Row(mainAxisSize: MainAxisSize.min, children: [
        const Text('اسمك  ', style: TextStyle(color: ink, fontSize: 14)),
        SizedBox(width: 180, child: TextField(controller: nameCtl, maxLength: NET.i('maxNameLength'), onSubmitted: (_) => _myName(),
            style: const TextStyle(color: ink), decoration: const InputDecoration(counterText: '', isDense: true))),
      ]),
      const SizedBox(height: 8),
      if (games.isEmpty) const Padding(padding: EdgeInsets.all(8), child: Text('جارٍ البحث… تظهر هنا مباراة صديقك حين يضغط "استضافة مباراة جديدة".',
          style: TextStyle(color: dim, fontSize: 13), textAlign: TextAlign.center)),
      for (final g in games)
        WideButton('انضم إلى «${g.name}»', () => _connect(g.ip, g.port), primary: true,
            note: g.version != '${NET.i('version')}' ? 'نسخة مختلفة' : null),
      const SizedBox(height: 6),
      WideButton('استضافة مباراة جديدة', _host, note: 'أصدقاؤك يرون مباراتك هنا'),
      TextButton(onPressed: () => setState(() => manual = !manual),
          child: const Text('الاتصال بعنوان المضيف', style: TextStyle(color: dim, fontSize: 12.5))),
      if (manual) Row(mainAxisSize: MainAxisSize.min, children: [
        SizedBox(width: 170, child: TextField(controller: ipCtl, keyboardType: TextInputType.number, style: const TextStyle(color: ink),
            decoration: const InputDecoration(hintText: '192.168.1.5', isDense: true))),
        const SizedBox(width: 8),
        WideButton('اتصال', () => _connect(ipCtl.text, NET.i('port')), width: 110),
      ]),
    ]);
  }

  // غرفة الانتظار: ما يعدّه المضيف الآن، واللاعبون بألوانهم وأممهم، وأمتك
  Widget _lobby() {
    final room = Lan.lobby;
    final parts = ['المضيف: ${Lan.hostName}'];
    if (room != null) {
      if (gameModes.has('${room['mode']}')) parts.add(gameModes.m('${room['mode']}').s('name'));
      parts.add(room['city'] == 'random' ? 'مدينة عشوائية' : room['city'] == 'host' ? 'مدينة المضيف' : cityShort('${room['city']}'));
      if (MAP_SIZES.has('${room['mapSize']}')) parts.add('خريطة ${MAP_SIZES.m('${room['mapSize']}').s('name')}');
    }
    final players = room?['players'] is List ? (room!['players'] as List).whereType<Map>() : const <Map>[];
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Text(parts.join(' • '), style: const TextStyle(color: gold, fontSize: 14)),
      const SizedBox(height: 6),
      for (final p in players) Builder(builder: (_) {
        final me = p['kind'] == 'net' && p['peer'] == Lan.myId;
        final hex = PLAYER_COLORS.cast<J>().where((c) => c['id'] == p['color']).firstOrNull?.s('hex') ?? '#888888';
        return Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 14, height: 14, decoration: BoxDecoration(color: colorOf(hex), shape: BoxShape.circle)),
          const SizedBox(width: 8),
          SizedBox(width: 170, child: Text('${p['name'] ?? ''}${p['kind'] == 'host' ? ' (المضيف)' : me ? ' (أنت)' : ''}',
              style: TextStyle(color: me ? gold : ink, fontSize: 13.5, fontWeight: me ? FontWeight.w700 : FontWeight.w400))),
          SizedBox(width: 150, child: Text('${sideName('${p['side']}')}${p['team'] is int && p['team'] != 0 ? ' • فريق ${p['team']}' : ''}',
              style: const TextStyle(color: dim, fontSize: 12))),
        ]));
      }),
      const SizedBox(height: 8),
      WideButton('أمتك: ${sideName(side)}', _pickSide, note: sideNote(side).isEmpty ? null : sideNote(side)),
      const Text('المضيف يبدأ المباراة حين يجهز الجميع', style: TextStyle(color: dim, fontSize: 12.5)),
    ]);
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: view != 'lobby',
    onPopInvokedWithResult: (didPop, _) { if (!didPop) _back(); },
    child: Scaffold(body: SafeArea(child: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(12), child: Panel(
      padding: const EdgeInsets.all(14),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('لعب محلي', style: TextStyle(color: gold, fontSize: 20, fontWeight: FontWeight.w800)),
        const Text('على نفس الواي فاي أو نقطة اتصال جوال أحدكم', style: TextStyle(color: dim, fontSize: 12.5)),
        const SizedBox(height: 8),
        if (kIsWeb) const Text('اللعب المحلي في تطبيق أندرويد: ثبّتوا نفس ملف اللعبة على كل جوال.', style: TextStyle(color: ink))
        else view == 'home' ? _home() : _lobby(),
        if (status.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6),
            child: Text(status, style: TextStyle(color: statusError ? danger : dim, fontSize: 13), textAlign: TextAlign.center)),
        const SizedBox(height: 6),
        WideButton('رجوع', _back, ghost: true, width: 160),
      ]),
    ))))),
  );
}
