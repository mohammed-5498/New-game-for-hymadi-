// الصوت (القسم 13.5، منقول من js/audio/sound.js وsamples.js): ملفات المستخدم (assets/audio) بنسخ يُختار منها عشوائياً
// وبسرعة وارتفاع يتغيران قليلاً، والمؤثرات المولَّدة بالكود (docs/audio.js) ملفات WAV جاهزة (assets/audio/synth، من
// scripts/export_synth_sounds.cjs). مؤثرات القتال تُجمع ويُسمع أهمها آخر كل تحديث (المازج)، وبحد combatVoices معاً،
// وارتفاعها من قرب الكاميرا. ولحن القوائم ولحن كل مدينة وأصوات البداية والتحميل بمشغل الموسيقى.
// المنطق يسأل soundAt عن الظهور على الشاشة (للتنبيهات) ولا يتأثر بالصوت: عشوائية الصوت خاصة به
import 'dart:async';
import 'dart:math' as math;

import 'package:audioplayers/audioplayers.dart';

import '../core/cfg.dart';
import '../data/js_config.dart';
import '../game/state.dart';
import '../ui/prefs.dart';

final J _A = AUDIO;
final _margin = _A.d('screenMargin');

// --- موقع الحدث على الشاشة (للمنطق والصوت) ---
(double, double)? _screenPos(MatchState state, double i, double j) {
  if (state.viewW == 0) return null;
  final c = state.camera;
  final x = ((i - j) * TILE_HALF_W - c.x) * c.z + state.viewW / 2;
  final y = ((i + j) * TILE_HALF_H - c.y) * c.z + state.viewH / 2;
  if (x < -_margin || x > state.viewW + _margin || y < -_margin || y > state.viewH + _margin) return null;
  return (x, y);
}

bool soundOnScreen(MatchState state, double i, double j) => _screenPos(state, i, j) != null;

// ارتفاع الحدث من قرب الكاميرا (AUDIO.near)، وأخفض عند أطراف الشاشة
double _nearness(MatchState state, (double, double) at) {
  final N = _A.m('near'), z = state.camera.z;
  final t = ((z - N.d('quiet')) / (N.d('loud') - N.d('quiet'))).clamp(0.0, 1.0);
  final dx = at.$1 / state.viewW * 2 - 1, dy = at.$2 / state.viewH * 2 - 1;
  return (N.d('floor') + (1 - N.d('floor')) * math.pow(t, N.d('curve'))) * (1 - N.d('edge') * math.min(1.0, (dx * dx + dy * dy) / 2));
}

// صوت حدث في مكان من الخريطة: لا يُسمع خارج الشاشة. مؤثرات القتال للمازج، والباقي فوراً. true إن كان على الشاشة
bool soundAt(MatchState state, String name, double i, double j, [String? style]) {
  final at = _screenPos(state, i, j);
  if (at == null) return false;
  if (!GameSound.ready || GameSound._silenced) return true;
  final priority = _A.m('mix').m('priority').dn(name);
  final gain = _nearness(state, at) * (priority == null ? 1 : _A.d('combatGain'));
  if (priority == null) {
    GameSound._play(name, style, gain);
  } else if (GameSound._queue.length < _A.m('mix').i('queueMax')) {
    final centered = 1 - math.min(1.0, (at.$1 / state.viewW * 2 - 1).abs());
    final score = priority + GameSound._rand() * _A.m('mix').d('jitter') + centered * _A.m('mix').d('center');
    GameSound._queue.add((name, style, gain, score));
  }
  return true;
}

// التنبيهات تُسمع ولو كان مصدرها خارج الشاشة، وبارتفاعها كاملاً
void soundAlert(MatchState state, String name, double i, double j) {
  if (GameSound.ready && !GameSound._silenced) GameSound._play(name, null, 1);
}

// أصوات الواجهة وتنبيهات اللاعب (لا موقع لها)
void sound(String name) {
  if (GameSound.ready && !GameSound._silenced) GameSound._play(name, null, 1);
}

// آخر كل تحديث: يُسمع من مؤثرات القتال حتى maxPerTick بلا تكرار، بالأهمية
void flushSounds() => GameSound._flush();

class GameSound {
  static bool ready = false;
  static final _sfx = <AudioPlayer>[];
  static final _busyUntil = <double>[];
  static final _fight = <bool>[];
  static var _next = 0;
  static late AudioPlayer _music, _track;
  static String? _musicName;
  static bool _silenced = false, _wantTheme = false, _held = false;
  static String? _city;                       // لحن المدينة المطلوب (المباراة)
  static final _queue = <(String, String?, double, double)>[];
  static final _lastPick = <String, String>{}, _lastAt = <String, double>{};
  static var _seed = 0x2545f491;
  static final _clock = Stopwatch()..start();
  static Timer? _fade;

  static double _rand() { _seed = (_seed * 1664525 + 1013904223) & 0xFFFFFFFF; return _seed / 4294967296; }
  static double _now() => _clock.elapsedMicroseconds / 1e6;
  static double get _sfxVol => Settings.mute ? 0 : Settings.sfx;
  static double get _musicVol => Settings.mute ? 0 : Settings.music;

  static Future<void> init() async {
    try {
      final voices = _A.i('combatVoices') + 4;
      final ctx = AudioContextConfig(focus: AudioContextConfigFocus.mixWithOthers).build();
      for (var k = 0; k < voices; k++) {
        final p = AudioPlayer()..setReleaseMode(ReleaseMode.stop);
        await p.setPlayerMode(PlayerMode.lowLatency);
        await p.setAudioContext(ctx);
        _sfx.add(p);
        _busyUntil.add(0);
        _fight.add(false);
      }
      _music = AudioPlayer();
      _track = AudioPlayer();
      await _music.setReleaseMode(ReleaseMode.loop);
      // الملفات القصيرة جاهزة قبل أول حاجة
      final names = <String>{for (final n in _A.m('files').l('sfx')) 'audio/$n.mp3'};
      unawaited(AudioCache.instance.loadAll(names.toList()).catchError((_) => <Uri>[]));
      ready = true;
    } catch (_) {
      ready = false;                            // لا صوت على هذا الجهاز: اللعبة تعمل بلا صوت
    }
  }

  // ملف الحدث: من ملفات المستخدم بنسخة عشوائية لا تتكرر مرتين متتاليتين، وإلا المولَّد (رابطه، ارتفاعه، سرعته)
  static (String, double, double)? _sourceOf(String event, String? style) {
    final E = _A.m('events').mm(event);
    if (E != null) {
      final list = (style != null && E[style] is List ? E.l(style) : E.l('any')).cast<String>();
      if (list.isEmpty) return null;
      final key = '$event${style ?? ''}';
      var k = (_rand() * list.length).floor();
      if (list.length > 1 && list[k] == _lastPick[key]) k = (k + 1) % list.length;
      _lastPick[key] = list[k];
      return ('audio/${list[k]}.mp3', E.dn('gain') ?? 1, E.dn('rate') ?? 1);
    }
    return ('audio/synth/$event.wav', _A.d('synthGain'), 1);
  }

  static void _play(String event, String? style, double gain) {
    if (_held || _sfxVol <= 0) return;
    final fight = _A.m('mix').m('priority').has(event);
    final now = _now();
    var live = 0;
    for (var k = 0; k < _sfx.length; k++) { if (_fight[k] && _busyUntil[k] > now) live++; }
    if (fight && live >= _A.i('combatVoices')) return;
    final gap = _A.m('mix').m('minGap').dn(event) ?? 0.045;
    if (now - (_lastAt[event] ?? -1) < gap) return;
    final src = _sourceOf(event, style);
    if (src == null) return;
    _lastAt[event] = now;
    final rj = _A.d('rateJitter'), gj = _A.d('gainJitter');
    final vol = (_sfxVol * src.$2 * gain * (1 + (_rand() * 2 - 1) * gj)).clamp(0.0, 1.0);
    final rate = src.$3 * (1 + (_rand() * 2 - 1) * rj);
    // الصوت التالي في الدور، أو أقدم ما بدأ
    var slot = _next;
    for (var n = 0; n < _sfx.length; n++) {
      final k = (_next + n) % _sfx.length;
      if (_busyUntil[k] <= now) { slot = k; break; }
    }
    _next = (slot + 1) % _sfx.length;
    _busyUntil[slot] = now + 0.6;
    _fight[slot] = fight;
    final p = _sfx[slot];
    unawaited(() async {
      try {
        await p.stop();
        await p.setPlaybackRate(rate);
        await p.play(AssetSource(src.$1), volume: vol);
      } catch (_) {}
    }());
  }

  static void _flush() {
    if (_queue.isEmpty) return;
    _queue.sort((a, b) => b.$4.compareTo(a.$4));
    final used = <String>[];
    for (final s in _queue) {
      if (used.length >= _A.m('mix').i('maxPerTick')) break;
      if (used.contains(s.$1)) continue;
      used.add(s.$1);
      _play(s.$1, s.$2, s.$3);
    }
    _queue.clear();
  }

  // --- الموسيقى: لحن القوائم أو لحن المدينة، بصعود وخفوت ---
  static void _fadeTo(double target, double seconds, [void Function()? done]) {
    _fade?.cancel();
    final steps = math.max(1, (seconds * 20).round());
    var k = 0;
    var from = _music.volume;
    _fade = Timer.periodic(const Duration(milliseconds: 50), (t) {
      k++;
      final v = from + (target - from) * k / steps;
      unawaited(_music.setVolume(v.clamp(0.0, 1.0)));
      if (k >= steps) { t.cancel(); done?.call(); }
    });
  }

  static void _playMusic(String name, String file, double level, double fadeIn) {
    if (!ready) return;
    if (_musicName == name) { _fadeTo(_musicVol * level, 0.3); return; }
    _musicName = name;
    _fade?.cancel();
    unawaited(() async {
      try {
        await _music.stop();
        await _music.setVolume(0);
        await _music.play(AssetSource(file));
        _fadeTo(_musicVol * level, fadeIn);
      } catch (_) {}
    }());
  }

  static void _stopMusic(double fadeOut) {
    if (!ready || _musicName == null) return;
    _musicName = null;
    _fadeTo(0, fadeOut, () => unawaited(_music.stop()));
  }

  static void _refresh() {
    if (!ready) return;
    final T = _A.m('tracks');
    if (_held || _silenced || _musicVol <= 0) { _stopMusic(0.3); return; }
    final city = _city;
    if (city != null) {
      final track = _A.m('cityMusic').ss(city);
      if (track != null) { _playMusic('city:$track', 'audio/music/$track.mp3', T.d('city'), T.d('cityFadeIn')); return; }
      _stopMusic(T.d('cityFadeOut'));
      return;
    }
    if (_wantTheme && _now() < _introUntil) return;   // صوت التشغيل أولاً
    if (_wantTheme) { _playMusic('theme', 'audio/theme.mp3', T.d('theme'), T.d('themeFadeIn')); return; }
    _stopMusic(T.d('themeFadeOut'));
  }

  // القوائم ظاهرة: لحنها يدور
  static void menuMusic(bool on) {
    if (_wantTheme == on && (!on || _city == null)) return;
    _wantTheme = on;
    if (on) _city = null;
    _refresh();
  }

  // تشغيل اللعبة: صوت البداية ثم لحن القوائم
  static void intro() {
    if (!ready) return;
    _oneShot('game_start');
    _introUntil = _now() + UI.m('intro').d('seconds');
    Timer(Duration(milliseconds: (UI.m('intro').d('seconds') * 1000).round() + 50), _refresh);
  }
  static double _introUntil = 0;

  static void _oneShot(String name, [double delay = 0]) {
    final level = _A.m('tracks').dn(name) ?? 1;
    unawaited(Future<void>.delayed(Duration(milliseconds: (delay * 1000).round()), () async {
      try {
        await _track.stop();
        await _track.play(AssetSource('audio/$name.mp3'), volume: (_musicVol * level).clamp(0.0, 1.0));
      } catch (_) {}
    }));
  }

  // شاشة التحميل: يصمت كل شيء إلا صوت البداية ثم صوت التحميل، وبعدها لحن المدينة
  static void matchSilence(bool on, [String? city]) {
    if (!ready) return;
    _silenced = on;
    _queue.clear();
    if (on) {
      _wantTheme = false;
      _city = null;
      _refresh();
      _oneShot('match_start');
      _oneShot('loading', _A.m('tracks').d('loadingDelay'));
    } else {
      unawaited(_track.stop());
      _city = city;
      _refresh();
    }
  }

  // الإيقاف والخروج من المباراة: بلا لحن المدينة
  static void cityMusic(String? city) { _city = city; _refresh(); }

  // تصغير التطبيق: يصمت كل شيء ويعود عند الرجوع
  static void hold(bool on) {
    if (!ready || _held == on) return;
    _held = on;
    if (on) {
      for (final p in _sfx) { unawaited(p.stop()); }
      unawaited(_track.stop());
      unawaited(_music.pause());
    } else {
      if (_musicName != null) unawaited(_music.resume());
      _refresh();
    }
  }

  // تغيّرت الإعدادات
  static void applyVolumes() { if (ready) _refresh(); }
}
