// ما يُحفظ على الجهاز (localStorage في اللعبة الحالية): الإعدادات والإحصائيات وآخر إعداد مباراة والمباراة المحفوظة،
// بالمفاتيح نفسها (UI.statsKey...). SharedPreferences: ملف التطبيق في أندرويد، وlocalStorage في المتصفح
import 'dart:convert';
import 'dart:math' as math;


import 'package:shared_preferences/shared_preferences.dart';

import '../core/cfg.dart';
import '../data/js_config.dart';

class Prefs {
  static SharedPreferences? _p;
  static Future<void> init() async {
    try { _p = await SharedPreferences.getInstance(); } catch (_) { _p = null; }   // لا تخزين: تعمل اللعبة بلا حفظ
  }

  static Map<String, Object?>? read(String key) {
    try {
      final s = _p?.getString(key);
      return s == null ? null : (jsonDecode(s) as Map).cast<String, Object?>();
    } catch (_) { return null; }
  }

  static void write(String key, Object? value) {
    try { _p?.setString(key, jsonEncode(value)); } catch (_) {}
  }

  static void remove(String key) { try { _p?.remove(key); } catch (_) {} }
  static String? raw(String key) { try { return _p?.getString(key); } catch (_) { return null; } }
  static void writeRaw(String key, String value) { try { _p?.setString(key, value); } catch (_) {} }
}

// --- الإعدادات (شاشة الإعدادات في menus.js) ---
class Settings {
  static double sfx = AUDIO.d('sfxVolume'), music = AUDIO.d('musicVolume');
  static bool mute = false, pops = true, battery = false;
  static String quality = 'auto';               // auto | high | medium | low (GRAPHICS)
  static const _key = 'gangcity.settings';

  static void load() {
    final s = Prefs.read(_key);
    if (s == null) return;
    sfx = (s['sfx'] as num?)?.toDouble() ?? sfx;
    music = (s['music'] as num?)?.toDouble() ?? music;
    mute = s['mute'] == true;
    pops = s['pops'] != false;
    battery = s['battery'] == true;
    if (GRAPHICS.l('order').contains(s['quality'])) quality = s['quality'] as String;
  }

  static void save() => Prefs.write(_key, {'sfx': sfx, 'music': music, 'mute': mute, 'pops': pops, 'battery': battery, 'quality': quality});

  // جودة الرسم ثابتة: العالية (60 إطاراً دائماً وكل التفاصيل، بطلب المستخدم بحذف الخيار). توفير البطارية وحده يخفضها إلى 30
  static String get level => 'high';
  static J get gfx => GRAPHICS.m('levels').m(level);
  static int get fpsCap => battery ? GRAPHICS.i('batteryFps') : gfx.i('fps');
}

// --- الإحصائيات الدائمة (js/stats.js) ---
class Stats {
  static const _fields = ['played', 'wins', 'losses', 'kills', 'unitsLost', 'bestDistricts', 'fastestWin', 'totalSeconds'];
  final Map<String, double> v = {for (final f in _fields) f: 0};
  final Map<String, double> gangs = {};

  static Stats load() {
    final s = Stats(), saved = Prefs.read(UI.s('statsKey'));
    if (saved == null) return s;
    for (final f in _fields) {
      final x = saved[f];
      if (x is num && x.isFinite && x >= 0) s.v[f] = x.toDouble();
    }
    final g = saved['gangs'];
    if (g is Map) {
      g.forEach((k, x) { if (x is num && x > 0) s.gangs['$k'] = x.toDouble(); });
    }
    return s;
  }

  static void record({required bool won, required double duration, required int kills, required int losses, required int maxDistricts, String? gang}) {
    final s = load();
    s.v['played'] = s.v['played']! + 1;
    if (won) {
      s.v['wins'] = s.v['wins']! + 1;
      if (s.v['fastestWin'] == 0 || duration < s.v['fastestWin']!) s.v['fastestWin'] = duration;
    } else {
      s.v['losses'] = s.v['losses']! + 1;
    }
    s.v['kills'] = s.v['kills']! + kills;
    s.v['unitsLost'] = s.v['unitsLost']! + losses;
    s.v['bestDistricts'] = math.max(s.v['bestDistricts']!, maxDistricts.toDouble());
    s.v['totalSeconds'] = s.v['totalSeconds']! + duration;
    if (gang != null) s.gangs[gang] = (s.gangs[gang] ?? 0) + 1;
    Prefs.write(UI.s('statsKey'), {...s.v, 'gangs': s.gangs});
  }

  String? get favorite {
    String? best;
    gangs.forEach((g, n) { if (best == null || n > gangs[best]!) best = g; });
    return best;
  }
}
