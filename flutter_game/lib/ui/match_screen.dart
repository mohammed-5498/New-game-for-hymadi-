// شاشة المباراة: الحلقة (20 تحديثاً في الثانية بالمنطق المنقول، والرسم بإيقاع الشاشة بتنعيم بين تحديثين)،
// والكاميرا، ورسم المدينة صفاً صفاً بالعمق والجنود في صفوفهم، واللمس (js/ui/input.js): تحديد وتحريك وهجوم
import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../core/cfg.dart';
import '../config.dart' show PACE;
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../audio/sound.dart';
import '../game/capture.dart';
import '../game/combat.dart';
import '../game/empire.dart';
import '../game/match.dart';
import '../game/modes.dart';
import '../game/state.dart';
import '../game/save.dart';
import '../game/story.dart';
import '../game/units.dart';
import '../map/generator.dart';
import '../net/session.dart';
import '../render/batch.dart';
import '../render/city_art.dart';
import '../render/city_layer.dart';
import '../render/fx_art.dart';
import '../render/unit_art.dart';
import '../render/unit_atlas.dart';
import '../render/weather_art.dart';
import '../render/empire_art.dart';
import 'hud.dart';
import 'menus.dart';
import 'prefs.dart';
import 'story_screen.dart';
import 'widgets.dart';

class MatchScreen extends StatefulWidget {
  final J? settings;
  final bool resume;              // متابعة المباراة المحفوظة (UI.matchKey)
  final MatchState? lanState;     // اللعب المحلي (net/session.dart): المباراة كما بدأت عند الجميع
  const MatchScreen({super.key, this.settings, this.resume = false, this.lanState});
  @override
  State<MatchScreen> createState() => MatchScreenState();
}

class MatchScreenState extends State<MatchScreen> with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  MatchState? state;
  late J settings = widget.settings ?? const {};
  double loadProgress = 0;
  String tip = '';
  bool _recorded = false;
  ({String title, List<(String, String)> lines, String reward, String ending, String next})? storyResult;
  late bool _resumePending = widget.resume;
  StreamSubscription<String>? _lanSub;
  int _frames = 0;
  String? get lanRole => state?.lanRole;
  String? get lanText => lanRole == null ? null : Lan.status();
  int _activeUntil = 0;
  Timer? _rest;
  double _camX = 0, _camY = 0, _camZ = 0;
  CityArt? art;
  CityLayer? layer;
  UnitAtlas? units;
  late final Ticker _ticker;
  final frame = ValueNotifier<int>(0), hud = ValueNotifier<int>(0);
  Duration _last = Duration.zero;
  double _acc = 0, alpha = 0, _lastScale = 1;
  int _mapVersion = 0, _ticks = 0;
  bool selectMode = false, paused = false;
  Offset? boxStart, boxEnd;
  int? menuDistrict;
  Unit? _lastTapUnit;
  int _lastTapAt = 0, _lastDistrictTapAt = 0, _lastDistrictTap = -1;
  final batch = TriBatch();
  final weather = WeatherFx();
  double frameDt = 0;                 // زمن الإطار للطقس (صفر في الإيقاف)

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick);
    WidgetsBinding.instance.addObserver(this);
    if (widget.lanState != null) _lanSub = Lan.events.listen(_onLan);
    _start();
  }

  // تصغير التطبيق: إيقاف وحفظ (حدث pause في اللعبة الحالية)
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) openPause(saveNow: true);
  }

  @override
  void dispose() {
    GameSound.matchSilence(false);
    GameSound.menuMusic(true);
    _lanSub?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _rest?.cancel();
    _ticker.dispose();
    layer?.dispose();
    art?.dispose();
    units?.image.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    final began = DateTime.now();
    final tips = UI.m('blackout').l('tips');
    setState(() { loadProgress = 0; tip = tips[math.Random().nextInt(tips.length)] as String; });
    GameSound.matchSilence(true);
    MatchState s;
    if (widget.lanState != null) {
      s = widget.lanState!;
      settings = s.settings;
    } else if (_resumePending) {
      _resumePending = false;
      try {
        s = decodeMatch(Prefs.raw(UI.s('matchKey'))!);
      } catch (_) {
        // حفظ تالف أو بنسخة أخرى: يُحذف ويعود اللاعب إلى القائمة
        clearSavedMatch();
        if (mounted) Navigator.of(context).pop();
        return;
      }
      settings = s.settings;
    } else {
      final seed = (settings['seed'] as int?) ?? DateTime.now().microsecondsSinceEpoch & 0x7FFFFFFF;   // seed: للفحص
      simRng = Rng(seed);
      s = createMatch(settings)..seed = seed;
      // للفحص في المتصفح (?ff=ثوانٍ): تقديم المباراة قبل عرضها
      final ff = (settings['ff'] as num?)?.toDouble() ?? 0;
      for (var t = 0.0; t < ff && s.matchResult == null; t += TICK_SEC) { updateMatch(s); }
    }
    s.running = true;
    _recorded = false;
    setState(() => loadProgress = 0.3);
    final a = await CityArt.load(s.map.city);
    if (mounted) setState(() => loadProgress = 0.7);
    final pairs = [
      for (final p in s.players) if (!p.passive) (spriteGang(p.gang, p.nation), p.gang == 'police' ? UNIT_ART.s('policeColor') : p.color),
      if (s.mode == 'survival') ('police', gameModes.m('survival').m('riot').s('color')),   // وحدات التدخل بلونها
    ];
    final u = await buildUnitAtlas(pairs);
    await WeatherFx.init();
    warmMatchArt(s);
    batch.whiteU = 1.5; batch.whiteV = 1.5;
    if (!mounted) return;
    final z = (settings['zoom'] as num?)?.toDouble();
    if (z != null) s.camera.z = z;
    setState(() => loadProgress = 1);
    // شاشة التحميل لا ترتفع قبل minSeconds (UI.blackout)، إلا في الفحص
    final wait = (UI.m('blackout').d('minSeconds') * 1000).round() - DateTime.now().difference(began).inMilliseconds;
    if (wait > 0 && settings['ff'] == null) await Future<void>.delayed(Duration(milliseconds: wait));
    if (!mounted) return;
    setState(() {
      state = s;
      art = a;
      units = u;
      layer = CityLayer(s.map, a, s.weather);
      _mapVersion = s.mapVersion;
    });
    GameSound.matchSilence(false, s.map.city);
    _ticker.start();
  }

  // اللعب المحلي: إعادة المزامنة تستبدل المباراة كلها، والمضيف يعود إلى الغرفة، أو ينقطع الاتصال به
  void _onLan(String e) {
    if (!mounted) return;
    if (e == 'resynced' && Lan.L != null && state != null) {
      final s = Lan.L!.state;
      layer?.dispose();
      setState(() { state = s; layer = CityLayer(s.map, art!, s.weather); _mapVersion = s.mapVersion; });
    } else if ((e == 'back' || e == 'left') && lanRole == 'client') {
      Navigator.of(context).pop();
    }
  }

  void lanBackToLobby() {
    Lan.backToLobby();
    Navigator.of(context).pop();
  }

  // أمر من قائمة الحي (فُحص قبلها): في اللعب المحلي يُرسل فينفذه كل جهاز في التحديث نفسه
  void empire(String a, int did, Object? x) {
    final s = state;
    if (s == null) return;
    if (lanRole != null) { Lan.command({'k': 'emp', 'a': a, 'd': did, 'x': x}); return; }
    final r = empireCommand(s, s.humanId, a, did, x);
    if (!r.ok && r.reason.isNotEmpty) s.notice = Notice(r.reason, true, 2.5);
  }

  // زر نهاية مرحلة القصة: التالية أو إعادتها، أو العودة إلى قائمة القصة بعد آخرها
  void storyNext() {
    final next = storyAgain(settings, state?.matchResult?.won ?? false);
    if (next == null) { Navigator.of(context).pop(); return; }
    settings = next;
    restart();
  }

  void restart() {
    storyResult = null;
    _ticker.stop();
    layer?.dispose();
    art?.dispose();
    units?.image.dispose();
    clearSavedMatch();
    setState(() { state = null; layer = null; art = null; units = null; menuDistrict = null; paused = false; });
    _last = Duration.zero; _acc = 0;
    _start();
  }

  // --- الإيقاف والحفظ (hud.js: openPause وleaveToMain) ---
  void saveMatch() {
    final s = state;
    if (s == null || s.matchResult != null || s.lanRole != null) return;   // المحلية لا تمس مباراتك المحفوظة
    Prefs.writeRaw(UI.s('matchKey'), encodeMatch(s));
    Prefs.write(UI.s('matchInfoKey'), saveInfo(s));
  }

  void openPause({bool saveNow = false}) {
    final s = state;
    if (s == null || s.matchResult != null) return;
    if (!paused) { paused = true; hud.value++; if (s.lanRole != 'client') GameSound.cityMusic(null); }
    if (s.lanRole == 'host') Lan.pause(true);
    if (s.lanRole != null) return;
    if (saveNow) { saveMatch(); return; }
    // نقطة حفظ بعد ظهور القائمة حتى لا يتقطع
    Future<void>.delayed(Duration(milliseconds: UI.i('fadeMs') + 30), () { if (paused && mounted) saveMatch(); });
  }

  void closePause() {
    paused = false;
    hud.value++;
    if (lanRole != 'client') GameSound.cityMusic(state?.map.city);
    if (lanRole == 'host') Lan.pause(false);
  }

  // اللعب المحلي: المغادرة نهائية (جيش المنضم يقوده بوت عند الباقين، وخروج المضيف ينهيها عند الجميع)
  void leaveToMain() {
    if (lanRole != null) {
      Lan.leave();
      Navigator.of(context).popUntil((r) => r.isFirst);
      return;
    }
    saveMatch();
    Navigator.of(context).pop();
  }

  void openSettings() => Navigator.of(context).push(PageRouteBuilder(opaque: false,
      pageBuilder: (_, _, _) => const SettingsScreen(overlay: true)));

  // زر الرجوع في أندرويد: يغلق قائمة الحي، ثم يفتح الإيقاف أو يغلقه
  void onBack() {
    final s = state;
    if (s == null) return;
    if (s.matchResult != null) { Navigator.of(context).pop(); return; }
    if (menuDistrict != null) { menuDistrict = null; hud.value++; return; }
    paused ? closePause() : openPause();
  }

  // نهاية المباراة: يُحذف الحفظ، وتُضاف للإحصائيات الدائمة مرة واحدة (الصمود له رقمه القياسي)
  void _ended(MatchState s) {
    if (_recorded) return;
    _recorded = true;
    if (s.lanRole == null) clearSavedMatch();
    final r = s.matchResult!;
    GameSound.cityMusic(null);
    if (s.humanId >= 0) sound(r.won ? 'victory' : 'defeat');
    final human = s.humanId >= 0 ? s.players[s.humanId] : null;
    if (settings['story'] != null) storyResult = storyEnd(settings, r.won);
    if (human != null && s.mode != 'survival' && settings['story'] == null) {
      Stats.record(won: r.won, duration: r.duration, kills: r.kills, losses: r.losses, maxDistricts: r.maxDistricts, gang: human.nation ?? human.gang);
    }
  }

  // إيقاع الرسم (PACE): الإيقاف والنهاية 5، وتوفير البطارية 30، و60 مع اللمس والكاميرا والقتال، و30 بعدها
  double _targetFps(MatchState s) {
    if (paused || s.matchResult != null) return GRAPHICS.d('idleFps');
    if (Settings.battery) return GRAPHICS.d('batteryFps');
    return DateTime.now().millisecondsSinceEpoch <= _activeUntil ? 60 : PACE.calmFps;
  }

  // اختيار حي على الخريطة بعد خانة الترياد أو الصاروخ (takePick في empireMenu.js)
  (String, int)? picking;
  void startPick(String action, int did, String text) {
    final s = state;
    if (s == null) return;
    picking = (action, did);
    menuDistrict = null;
    s.notice = Notice(text, true, 5);
    hud.value++;
  }

  void markActive() {
    _activeUntil = DateTime.now().millisecondsSinceEpoch + PACE.activeMs;
    if (_ticker.muted) { _rest?.cancel(); wakeTicker(_ticker, context); }
  }

  void _onTick(Duration now) {
    final s = state;
    if (s == null) return;
    var dt = _last == Duration.zero ? 0.0 : (now - _last).inMicroseconds / 1e6;
    _last = now;
    frameDt = paused && s.lanRole != 'client' ? 0 : math.min(dt, 0.1);
    if (s.lanRole != null && Lan.L != null) {
      // اللعب المحلي: التحديثات حسب أدوار المضيف، والمضيف يوقفها عند الجميع
      if (s.lanRole == 'host') s.paused = paused;
      final before = s.netTick;
      alpha = Lan.frame(math.min(dt, 0.25));
      if (s.netTick ~/ 10 != before ~/ 10 || ++_frames % 30 == 0) hud.value++;
      if (s.matchResult != null && !_recorded) { _ended(s); hud.value++; }
    } else {
      if (paused || s.matchResult != null) dt = 0;
      _acc = math.min(_acc + dt, 0.25);
      while (_acc >= TICK_SEC) {
        final pr = perfProbe, t0 = pr == null ? 0 : _clockUs();
        updateMatch(s);
        if (pr != null) pr['tickSim'] = (pr['tickSim'] ?? 0) + _clockUs() - t0;
        _acc -= TICK_SEC;
        if (++_ticks % 10 == 0) hud.value++;   // الواجهة مرتين في الثانية (واللمس يحدّثها فوراً)
        if (s.matchResult != null) { _ended(s); hud.value++; break; }
      }
      alpha = _acc / TICK_SEC;
    }
    if (settings['watch'] == true && _ticks % 20 == 0) _watch(s);
    if (s.mapVersion != _mapVersion) {
      _mapVersion = s.mapVersion;
      // مبنى جديد أو ترقية أو تحصين: صورة مربع المبنى وحده تتبدل (الترقيات والأسوار لا تمس الطبقة)، والطبقة كلها نادراً
      final tiles = [for (final d in s.map.districts) if (d.buildTile != null) d.buildTile!];
      if (!(layer?.refreshTiles(s.map, art!, tiles) ?? true)) {
        layer?.dispose();
        layer = CityLayer(s.map, art!, s.weather);
      }
    }
    final c = s.camera;
    if (c.x != _camX || c.y != _camY || c.z != _camZ) { _camX = c.x; _camY = c.y; _camZ = c.z; markActive(); }
    final pr = perfProbe, t0 = pr == null ? 0 : _clockUs();
    _retint(s);
    if (pr != null) pr['retint'] = (pr['retint'] ?? 0) + _clockUs() - t0;
    frame.value++;
    _rest?.cancel();
    _rest = restTicker(_ticker, _targetFps(s), context);
  }

  // للفحص (?watch=1): الكاميرا على أكبر اشتباك
  void _watch(MatchState s) {
    Unit? best;
    var most = 0;
    for (final u in s.units) {
      if (u.state != 'attacking') continue;
      var n = 0;
      for (final o in s.units) { if (o.state == 'attacking' && (o.x - u.x).abs() < 4 && (o.y - u.y).abs() < 4) n++; }
      if (n > most) { most = n; best = u; }
    }
    if (best != null) centerOn(best.x, best.y);
  }

  final J _cap = CAPTURE;
  void _retint(MatchState s) {
    final steps = _cap.d('tintSteps');
    layer?.retint([for (final d in s.map.districts) (d.tintColor, d.tintColor == null ? 0.0 : jsRound(d.tintMix * steps) / steps)],
        _cap.d('groundTintAlpha'), _cap.d('groundTintChroma'), _cap.d('wallTintAlpha'), _cap.d('tintChroma'));
  }

  // --- الكاميرا ---
  void _clamp(MatchState s) {
    final half = s.map.n * TILE_HALF_W;
    s.camera.x = s.camera.x.clamp(-half, half);
    s.camera.y = s.camera.y.clamp(0.0, s.map.n * 2 * TILE_HALF_H);
  }

  Offset toWorld(MatchState s, Offset p, Size size) =>
      Offset(s.camera.x + (p.dx - size.width / 2) / s.camera.z, s.camera.y + (p.dy - size.height / 2) / s.camera.z);
  Offset toScreen(MatchState s, double wx, double wy, Size size) =>
      Offset((wx - s.camera.x) * s.camera.z + size.width / 2, (wy - s.camera.y) * s.camera.z + size.height / 2);
  (double, double) worldToTile(double x, double y) => ((x / TILE_HALF_W + y / TILE_HALF_H) / 2, (y / TILE_HALF_H - x / TILE_HALF_W) / 2);

  void centerOn(double i, double j) {
    final s = state;
    if (s == null) return;
    s.camera.x = (i - j) * TILE_HALF_W;
    s.camera.y = (i + j) * TILE_HALF_H;
    _clamp(s);
  }

  void _onScaleStart(ScaleStartDetails d) {
    _lastScale = 1;
    markActive();
    if (selectMode && d.pointerCount == 1) { boxStart = d.localFocalPoint; boxEnd = d.localFocalPoint; }
  }

  void _onScale(ScaleUpdateDetails d, Size size) {
    final s = state;
    if (s == null) return;
    markActive();
    if (boxStart != null && d.pointerCount == 1) { boxEnd = d.localFocalPoint; return; }
    final c = s.camera;
    final fx = d.localFocalPoint.dx - size.width / 2, fy = d.localFocalPoint.dy - size.height / 2;
    final wx = c.x + fx / c.z, wy = c.y + fy / c.z;
    c.z = (c.z * d.scale / _lastScale).clamp(CAMERA.d('minZoom'), CAMERA.d('maxZoom'));
    _lastScale = d.scale;
    c.x = wx - fx / c.z - d.focalPointDelta.dx / c.z;
    c.y = wy - fy / c.z - d.focalPointDelta.dy / c.z;
    _clamp(s);
  }

  void _onScaleEnd(Size size) {
    final s = state, a = boxStart, b = boxEnd;
    boxStart = null; boxEnd = null;
    if (s == null || a == null || b == null) return;
    final r = Rect.fromPoints(a, b);
    if (r.width < 8 && r.height < 8) return;
    var n = 0;
    for (final u in s.units) {
      if (u.playerId != s.humanId || u.state == 'dead') { u.selected = false; continue; }
      final p = toScreen(s, (u.x - u.y) * TILE_HALF_W, (u.x + u.y) * TILE_HALF_H - 8, size);
      u.selected = r.contains(p);
      if (u.selected) n++;
    }
    if (n > 0) setState(() => selectMode = false);
    hud.value++;
  }

  Unit? _unitAt(MatchState s, Offset p, Size size) {
    Unit? best;
    var bestD = INPUT.d('unitTapRadiusPx');
    for (final u in s.units) {
      if (u.state == 'dead') continue;
      final q = toScreen(s, (u.x - u.y) * TILE_HALF_W, (u.x + u.y) * TILE_HALF_H - 8 * s.camera.z / 2.2, size);
      final d = (q - p).distance;
      if (d < bestD) { bestD = d; best = u; }
    }
    return best;
  }

  District? _areaAt(MatchState s, Offset p, Size size) {
    final w = toWorld(s, p, size);
    final (ti, tj) = worldToTile(w.dx, w.dy);
    final i = jsRound(ti), j = jsRound(tj), m = s.map;
    if (i < 0 || j < 0 || i >= m.n || j >= m.n || m.areaAt == null) return null;
    final id = m.areaAt![j * m.n + i];
    return id >= 0 && id < m.districts.length ? m.districts[id] : null;
  }

  void _onTap(TapUpDetails d, Size size) {
    final s = state;
    if (s == null || s.matchResult != null) return;
    markActive();
    final p = d.localPosition, now = DateTime.now().millisecondsSinceEpoch;
    final pick = picking;
    if (pick != null) {
      picking = null;
      if (pick.$1 == 'rally') {                 // مكان الإنتاج: المربع الملموس (والقاعدة نفسها تلغيه)
        final w = toWorld(s, p, size);
        final (ti, tj) = worldToTile(w.dx, w.dy);
        final k = jsRound(tj).clamp(0, s.map.n - 1) * s.map.n + jsRound(ti).clamp(0, s.map.n - 1);
        empire('rally', pick.$2, s.map.districtAt[k] == pick.$2 ? -1 : k);
        hud.value++;
        return;
      }
      final target = _areaAt(s, p, size);
      empire(pick.$1, pick.$2, target?.id);
      hud.value++;
      return;
    }
    final hit = _unitAt(s, p, size);
    // لمستان سريعتان على حي تملكه تفتحان قائمته (empireMenu)
    final area = hit != null && hit.playerId == s.humanId ? null : _areaAt(s, p, size);
    final mine = area != null && area.owner == s.humanId ? area : null;
    if (mine != null && _lastDistrictTap == mine.id && now - _lastDistrictTapAt <= INPUT.i('doubleTapMs')) {
      _lastDistrictTap = -1;
      for (final u in s.units) { u.selected = false; }
      setState(() => menuDistrict = mine.id);
      return;
    }
    _lastDistrictTap = mine?.id ?? -1;
    _lastDistrictTapAt = now;
    if (menuDistrict != null) { setState(() => menuDistrict = null); return; }
    final group = s.units.where((u) => u.selected && u.state != 'dead').toList();
    // لمسة ثانية قرب الجندي نفسه: تحديد من حوله
    final last = _lastTapUnit;
    if (last != null && now - _lastTapAt <= INPUT.i('doubleTapMs')) {
      final q = toScreen(s, (last.x - last.y) * TILE_HALF_W, (last.x + last.y) * TILE_HALF_H, size);
      if ((q - p).distance <= INPUT.d('doubleTapSlackPx')) {
        final r = INPUT.d('groupSelectRadiusTiles');
        for (final u in s.units) {
          u.selected = u.playerId == last.playerId && u.state != 'dead' &&
              (u.x - last.x) * (u.x - last.x) + (u.y - last.y) * (u.y - last.y) <= r * r;
        }
        _lastTapUnit = null;
        hud.value++;
        return;
      }
    }
    if (hit != null && hit.playerId == s.humanId) {
      sound('select');
      for (final u in s.units) { u.selected = false; }
      hit.selected = true;
      _lastTapUnit = hit;
      _lastTapAt = now;
      hud.value++;
      return;
    }
    _lastTapUnit = null;
    if (group.isEmpty) return;
    sound('command');
    final w = toWorld(s, p, size);
    final (ti, tj) = worldToTile(w.dx, w.dy);
    if (s.lanRole != null) {
      // اللعب المحلي: أمر ينفذه كل جهاز في التحديث نفسه، وحلقة مكانه تظهر هنا فوراً
      final ids = [for (final u in group) u.id];
      if (hit != null && isEnemy(s, group[0], hit)) { Lan.command({'k': 'attack', 'u': ids, 't': hit.id}); return; }
      final i = jsRound(ti).clamp(0, s.map.n - 1), j = jsRound(tj).clamp(0, s.map.n - 1);
      Lan.command({'k': 'move', 'u': ids, 'i': i, 'j': j});
      s.moveMarker = MoveMarker(i, j, false);
      return;
    }
    if (hit != null && isEnemy(s, group[0], hit)) { commandAttack(s, group, hit); return; }
    commandMove(s, ti, tj, group);
  }

  void _onLongPress(LongPressStartDetails d, Size size) {
    final s = state;
    if (s == null) return;
    final area = _areaAt(s, d.localPosition, size);
    if (area != null && area.owner == s.humanId) {
      for (final u in s.units) { u.selected = false; }
      setState(() => menuDistrict = area.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = state;
    if (s == null || art == null || units == null) return LoadingScreen(progress: loadProgress, tip: tip);
    final size = MediaQuery.sizeOf(context);
    s.viewW = size.width; s.viewH = size.height;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) { if (!didPop) onBack(); },
      child: Scaffold(
        body: Stack(children: [
          Positioned.fill(child: GestureDetector(
            onScaleStart: _onScaleStart,
            onScaleUpdate: (d) => _onScale(d, size),
            onScaleEnd: (_) => _onScaleEnd(size),
            onTapUp: (d) => _onTap(d, size),
            onLongPressStart: (d) => _onLongPress(d, size),
            // طبقتان منفصلتان: المشهد يُرسم كل إطار، والواجهة حين تتغير فقط
            child: RepaintBoundary(child: CustomPaint(painter: _MatchPainter(this))),
          )),
          Positioned.fill(child: RepaintBoundary(child: MatchHud(screen: this))),
        ]),
      ),
    );
  }
}

void clearSavedMatch() { Prefs.remove(UI.s('matchKey')); Prefs.remove(UI.s('matchInfoKey')); }

// شاشة التحميل (blackout.js): شريط تقدم ونصيحة
class LoadingScreen extends StatelessWidget {
  final double progress;
  final String tip;
  const LoadingScreen({super.key, required this.progress, required this.tip});
  @override
  Widget build(BuildContext context) => Scaffold(backgroundColor: deep, body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    const Text('مدينة العصابات', style: TextStyle(color: gold, fontSize: 26, fontWeight: FontWeight.w900)),
    const SizedBox(height: 14),
    SizedBox(width: 320, child: ClipRRect(borderRadius: BorderRadius.circular(4), child: LinearProgressIndicator(
        value: progress, minHeight: 7, color: gold, backgroundColor: card))),
    const SizedBox(height: 14),
    SizedBox(width: 440, child: Text(tip, textAlign: TextAlign.center, style: const TextStyle(color: dim, fontSize: 14))),
  ])));
}

// صورة كلمة طائرة بلونها، مرة واحدة لكل كلمة
const _popScale = 4.0;
final _pops = <String, ui.Image>{};
ui.Image popImage(String text, String color) => _pops['$text|$color'] ??= () {
  final pb = ui.ParagraphBuilder(ui.ParagraphStyle(textAlign: TextAlign.center, textDirection: TextDirection.rtl, fontSize: 5.5 * _popScale,
      fontWeight: FontWeight.w800))
    ..pushStyle(ui.TextStyle(color: Color(0xFF000000 | hexRgb(color)), shadows: const [Shadow(color: Color(0xCC000000), blurRadius: 1.2 * _popScale)]))
    ..addText(text);
  final para = pb.build()..layout(const ui.ParagraphConstraints(width: 60 * _popScale));
  final rec = ui.PictureRecorder();
  Canvas(rec).drawParagraph(para, Offset.zero);
  return rec.endRecording().toImageSync((60 * _popScale).round(), (para.height + 2 * _popScale).ceil());
}();

// كل ما يُرسم أول مرة أثناء القتال يُجهَّز عند التحميل فلا يتأخر إطار في أول معركة: الكلمات الطائرة بألوانها
void warmMatchArt(MatchState s) {
  final C = COMBAT_REALISM.m('pops').m('colors');
  for (final (t, k) in const [('اصطدام!', 'bump'), ('رُشي!', 'bribe'), ('تفادى!', 'dodge'), ('سقط!', 'down'), ('صدّ!', 'block'), ('من الخلف!', 'back')]) {
    popImage(t, C.s(k));
  }
  if (s.feature == 'storm') popImage(CITY_FEATURES.m('storm').s('pop'), C.s('miss'));
  for (final u in s.units) {
    final show = u.stats['showoff'];
    if (show is Map && show['pop'] is String) popImage(show['pop'] as String, C.s('show'));
  }
}

// قياس أقسام الإطار (للفحص فقط: test/perf_test.dart)
Map<String, int>? perfProbe;
final _clock = Stopwatch()..start();
int _clockUs() => _clock.elapsedMicroseconds;
final _sw = Stopwatch();
void _mark(String k) {
  final p = perfProbe;
  if (p == null) return;
  p[k] = (p[k] ?? 0) + _sw.elapsedMicroseconds;
  _sw..reset()..start();
}

class _MatchPainter extends CustomPainter {
  final MatchScreenState v;
  _MatchPainter(this.v) : super(repaint: v.frame);

  final _rows = <List<Unit>>[];

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawColor(const Color(0xFF1B1611), BlendMode.src);
    final s = v.state, layer = v.layer, art = v.art, atlas = v.units;
    if (s == null || layer == null || art == null || atlas == null) return;
    final c = s.camera, b = v.batch, alpha = v.alpha, img = atlas.image;
    final time = s.time + alpha * TICK_SEC;
    if (perfProbe != null) _sw..reset()..start();
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(c.z);
    canvas.translate(-c.x, -c.y);
    final halfW = size.width / 2 / c.z, halfH = size.height / 2 / c.z;
    final left = c.x - halfW - 40, right = c.x + halfW + 40, top = c.y - halfH - 20, bottom = c.y + halfH + 60;
    final depths = 2 * s.map.n - 1;
    while (_rows.length < depths) { _rows.add([]); }
    for (final r in _rows) { r.clear(); }
    var visible = 0;
    var busy = false;
    for (final u in s.units) {
      final i = u.prevX + (u.x - u.prevX) * alpha, j = u.prevY + (u.y - u.prevY) * alpha;
      final x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
      if (x < left || x > right || y < top || y > bottom) continue;
      final d = (i + j).floor().clamp(0, depths - 1);
      _rows[d].add(u);
      visible++;
      if (u.state == 'attacking' || (u.selected && u.state == 'moving')) busy = true;
    }
    if (busy) v.markActive();   // قتال ظاهر أو جنودك المحددون يمشون: 60 إطاراً
    final crowded = visible > COMBAT_REALISM.m('lod').i('fullUnits');
    b.reset();
    _mark('sortUnits');
    layer.paint(canvas, art.image, c.y - halfH, c.y + halfH, onGround: () {
      _borders(b, s);
      for (final f in s.fires) { drawFire(b, f, time); }
      for (final z in s.zones) { drawZone(b, z, time); }
      if (s.feature != null) drawFeatureGround(b, s, time);
      drawFeatureHalos(b, s, time);
      drawEmpireHalos(b, s, time);
      for (final u in s.units) { if (u.state != 'dead' && truthy(u.stats['aura']) && u.playerId == s.humanId) drawAura(b, u, alpha); }
      b.flush(canvas, img);
    }, afterRow: (d) {
      for (final fl in _flagsAt(s, d)) {
        _flag(b, s, fl, time);
        if (fl.hill) drawHillCrown(b, (fl.capture!.i - fl.capture!.j) * TILE_HALF_W, (fl.capture!.i + fl.capture!.j) * TILE_HALF_H, time,
            (s.modeState as ModeState?)?.blocked ?? false);
      }
      final row = _rows[d];
      if (row.isNotEmpty) {
        row.sort((p, q) => (p.x + p.y).compareTo(q.x + q.y));
        _mark('city+flags');
        for (final u in row) {
          drawUnit(b, atlas, u, alpha, c.z, time, crowded);
          if (u.cargo && u.state != 'dead') {
            final i = u.prevX + (u.x - u.prevX) * alpha, j = u.prevY + (u.y - u.prevY) * alpha;
            drawCargo(b, (i - j) * TILE_HALF_W, (i + j) * TILE_HALF_H);
          }
        }
      }
      _mark('units');
      b.flush(canvas, img);
      _mark('flush');
    });
    for (final shot in s.projectiles) { drawProjectile(b, shot, alpha); }
    drawEmpireShots(b, s, alpha);
    drawFlagArrows(b, s, time, left, right, top, bottom);
    for (final fx in s.fx) {
      final gx = (fx.x - fx.y) * TILE_HALF_W, gy = (fx.x + fx.y) * TILE_HALF_H;
      drawImpact(b, fx, gx, gy, UNIT_ART.d('scale'), fx.t + alpha * TICK_SEC);
    }
    for (final cl in s.clashes) { drawClash(b, (cl.x - cl.y) * TILE_HALF_W, (cl.x + cl.y) * TILE_HALF_H - 8, cl.t); }
    for (final fx in s.ultFx) { drawUltFx(b, fx); }
    if (s.feature != null) drawFeatureOver(b, s, time);
    if (s.story != null) {
      final tp = targetPoint(s);
      if (tp != null) drawStoryMarker(b, tp.$1, tp.$2, tp.$3, time);
    }
    for (final u in s.units) { if (u.selected && u.state != 'dead') drawSelectionRing(b, u, alpha); }
    if (s.moveMarker != null) drawMoveMarker(b, s.moveMarker!);
    b.flush(canvas, img);
    _mark('fx');
    if (Settings.pops) _drawPops(canvas, s);
    _mark('pops');
    canvas.restore();
    v.weather.paint(canvas, size, s, layer.lights, v.frameDt, Settings.gfx);   // الطقس والإضاءة فوق المشهد
    _mark('weather');
    // الشارات والطابور والمدى والراية فوق طبقة الليل لتُقرأ دائماً
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.scale(c.z);
    canvas.translate(-c.x, -c.y);
    drawEmpireMarks(b, s, art, v.menuDistrict, left, right, top, bottom);
    b.flush(canvas, img);
    canvas.restore();
    _mark('marks');
    final bs = v.boxStart, be = v.boxEnd;
    if (bs != null && be != null) {
      final r = Rect.fromPoints(bs, be);
      canvas.drawRect(r, Paint()..color = const Color(0x33F3EAD6));
      canvas.drawRect(r, Paint()..color = const Color(0xCCF3EAD6)..style = PaintingStyle.stroke..strokeWidth = 1);
    }
  }

  // حدود الأحياء المملوكة بلون مالكها (CAPTURE.border)
  static final _edges = Expando<List<List<double>>>();
  void _borders(TriBatch b, MatchState s) {
    final m = s.map;
    final edges = _edges[m] ??= _buildEdges(m);
    final B = CAPTURE.m('border');
    for (final d in m.districts) {
      if (d.tintColor == null || d.tintMix <= 0) continue;
      final col = hexRgb(d.tintColor!), al = B.d('alpha') * d.tintMix;
      final e = edges[d.id];
      for (var k = 0; k < e.length; k += 4) { b.line(e[k], e[k + 1], e[k + 2], e[k + 3], B.d('underWidth'), 0x18120c, 0.45 * d.tintMix); }
      for (var k = 0; k < e.length; k += 4) { b.line(e[k], e[k + 1], e[k + 2], e[k + 3], B.d('width'), col, al); }
    }
    // أسوار الأحياء المحصّنة (القسم 3.12): حجر بارتفاع المستوى، وأعلاه بلون المالك
    // ponytail: سور بسيط بلا طراز كل منطقة ولا أبراج (chunkCache.js)، والطراز مع التلميع في ن12
    for (final d in m.districts) {
      if (d.fort <= 0) continue;
      final h = 2.0 + 2.0 * d.fort, e = edges[d.id];
      final top = d.owner != null ? hexRgb(s.players[d.owner!].color) : 0xb8ab94;
      for (var k = 0; k < e.length; k += 4) {
        final x1 = e[k], y1 = e[k + 1], x2 = e[k + 2], y2 = e[k + 3];
        b.quad(x1, y1, x2, y2, x2, y2 - h, x1, y1 - h, x2 > x1 == y2 > y1 ? 0x8c7f6b : 0x76695a);
        b.line(x1, y1 - h, x2, y2 - h, 1.2, top);
      }
    }
  }

  List<List<double>> _buildEdges(GameMap m) {
    final inset = CAPTURE.m('border').d('inset'), W = TILE_HALF_W, H = TILE_HALF_H;
    final out = [for (final _ in m.districts) <double>[]];
    for (final d in m.districts) {
      for (final (i, j) in d.tiles) {
        final x = (i - j) * W, y = (i + j) * H;
        void edge(int ni, int nj, double x1, double y1, double x2, double y2) {
          if (m.inBounds(ni, nj) && m.districtAt[m.idx(ni, nj)] == d.id) return;
          // نحو مركز المربع بقدر الإزاحة
          final cx = x - (x1 + x2) / 2, cy = y - (y1 + y2) / 2, l = math.sqrt(cx * cx + cy * cy);
          final ox = cx / l * inset, oy = cy / l * inset;
          out[d.id].addAll([x1 + ox, y1 + oy, x2 + ox, y2 + oy]);
        }
        edge(i + 1, j, x + W, y, x, y + H);
        edge(i - 1, j, x - W, y, x, y - H);
        edge(i, j + 1, x, y + H, x - W, y);
        edge(i, j - 1, x, y - H, x + W, y);
      }
    }
    return out;
  }

  Iterable<District> _flagsAt(MatchState s, int d) sync* {
    for (final x in s.map.districts) {
      final c = x.capture;
      if (c != null && c.i + c.j == d) yield x;
    }
  }

  // علم الحي: سارية وراية بلون المالك (أو محايدة)، وحلقة تقدم الاستيلاء
  void _flag(TriBatch b, MatchState s, District d, double time) {
    final c = d.capture!;
    final x = (c.i - c.j) * TILE_HALF_W, y = (c.i + c.j) * TILE_HALF_H;
    final owner = d.owner != null ? s.players[d.owner!] : null;
    final col = owner != null ? hexRgb(owner.gang == 'police' ? UNIT_ART.s('policeColor') : owner.color) : (d.police ? 0x8fa6c4 : 0xe8e2d6);
    b.ellipse(x, y, 3.2, 1.5, 0x000000, 0.3);
    b.ring(x, y, 4.2, 2.1, 0.8, 0xffd34d, 0.85);
    b.line(x, y, x, y - 22, 1, 0x4a3a2a);
    final wv = math.sin(time * 3 + c.i) * 0.8;
    b.quad(x, y - 22, x + 10, y - 20 + wv, x + 10, y - 15 + wv, x, y - 16, col);
    if (d.progress > 0 && d.progress < 100 && d.progressOwner != null) {
      final po = s.players[d.progressOwner!];
      final pc = hexRgb(po.gang == 'police' ? UNIT_ART.s('policeColor') : po.color);
      b.ring(x, y, 9, 4.5, 1.6, 0x141210, 0.6, 32);
      b.ring(x, y, 9, 4.5, 1.6, pc, 1, 32, -math.pi / 2, -math.pi / 2 + 2 * math.pi * d.progress / 100);
    }
  }

  // الكلمات الطائرة: تفادى! صدّ! من الخلف! كل كلمة بلونها صورة صغيرة (popImage، تُجهَّز عند التحميل)، وتُرسم بشفافيتها
  // بلا طبقة خارج الشاشة لكل كلمة
  final _popPaint = Paint()..filterQuality = FilterQuality.medium;
  void _drawPops(Canvas canvas, MatchState s) {
    final secs = COMBAT_REALISM.m('pops').d('seconds');
    for (final p in s.pops) {
      final g = p.t / secs, img = popImage(p.text, p.color);
      final x = (p.x - p.y) * TILE_HALF_W - 30, y = (p.x + p.y) * TILE_HALF_H - 26 - g * 10;
      _popPaint.color = Color.fromRGBO(255, 255, 255, (1 - g).clamp(0.0, 1.0));
      canvas.drawImageRect(img, Rect.fromLTWH(0, 0, img.width.toDouble(), img.height.toDouble()),
          Rect.fromLTWH(x, y, img.width / _popScale, img.height / _popScale), _popPaint);
    }
  }

  @override
  bool shouldRepaint(_MatchPainter old) => true;
}

double tintOf(District d) => tintAmount(d, 1);
