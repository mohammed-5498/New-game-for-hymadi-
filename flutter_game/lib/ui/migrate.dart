// نقل الحفظ من النسخة الحالية (القسم 18، ن12): التطبيق الجديد يُثبَّت فوق اللعبة بمعرّفها، فيبقى مجلد WebView القديم
// في بياناته. أول تشغيل يفتحه بـ WebView مخفية بأصل اللعبة القديمة (https://localhost، MainActivity.kt) ويقرأ مفاتيحها:
// الإحصائيات وآخر إعداد مباراة وتقدم القصة وصعوبتها وأرقام الصمود والإعدادات والاسم في اللعب المحلي. المباراة المحفوظة
// لا تنتقل (شكل حفظها مختلف). مرة واحدة، ولا يكتب فوق ما حفظه التطبيق الجديد
import 'dart:convert';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';

import 'prefs.dart';

const _channel = MethodChannel('gangcity/migrate');
const _doneKey = 'gangcity.migrated';
int migrated = 0;        // ما نُقل في هذا التشغيل (سطر في القائمة الرئيسية)

Future<void> migrateOldSave() async {
  if (kIsWeb || Prefs.raw(_doneKey) != null) return;
  final String? text;
  try {
    text = await _channel.invokeMethod<String>('read').timeout(const Duration(seconds: 6));
  } catch (_) {
    return;              // لا WebView الآن: يُعاد في التشغيل التالي
  }
  final old = <String, String>{};
  try {
    final inner = text == null ? null : jsonDecode(text);
    final m = inner is String ? jsonDecode(inner) : null;
    if (m is Map) m.forEach((k, v) { if (k is String && v is String) old[k] = v; });
  } catch (_) {}
  migrated = moveOldKeys(old);
  Prefs.writeRaw(_doneKey, '$migrated');
}

// مفاتيح اللعبة القديمة ← مفاتيح هذا التطبيق (الأشكال نفسها إلا الإعدادات: الصوت والتفضيلات في مفتاح واحد هنا)
int moveOldKeys(Map<String, String> old) {
  var n = 0;
  void copy(String k) {
    final v = old[k];
    if (v == null || Prefs.raw(k) != null) return;
    Prefs.writeRaw(k, v);
    n++;
  }
  for (final k in ['gangcity.stats', 'gangcity.setup', 'gangcity.story', 'gangcity.storyDifficulty', 'gangcity.prefs']) { copy(k); }
  for (final k in old.keys) { if (k.startsWith('gangcity.survivalBest.')) copy(k); }
  if (Prefs.raw('gangcity.settings') == null && (old['gangcity.audio'] != null || old['gangcity.prefs'] != null)) {
    Map<String, Object?> j(String k) { try { return (jsonDecode(old[k] ?? '{}') as Map).cast<String, Object?>(); } catch (_) { return {}; } }
    final a = j('gangcity.audio'), p = j('gangcity.prefs');
    Prefs.write('gangcity.settings', {
      if (a['sfx'] is num) 'sfx': a['sfx'], if (a['music'] is num) 'music': a['music'], 'mute': a['muted'] == true,
      'pops': p['pops'] != false, 'battery': p['battery'] == true, if (p['quality'] is String) 'quality': p['quality'],
    });
    n++;
  }
  return n;
}
