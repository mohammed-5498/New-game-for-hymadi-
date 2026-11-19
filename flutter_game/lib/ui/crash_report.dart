// سبب آخر إغلاق للعبة (2.1.5، بعد أن أُغلقت عند بدء مباراة على جوال المستخدم): ما سجّله أندرويد عن خروج العملية
// (MainActivity.kt، من أندرويد 11: نفاد الذاكرة أو خطأ أندرويد أو انهيار المحرك أو عدم الاستجابة، بوصفه وذاكرته وأثره)،
// وآخر خطأ في كود أندرويد أو Dart. يُعرض مرة واحدة عند فتح اللعبة التالي بزر نسخ، ليُرسل للتشخيص.
// ومنذ 2.1.6: إشارة الانهيار الأصلي وأثره من سجل أندرويد، وآخر خطوة في المباراة بإعدادها (crumb)
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart' hide Text;
import 'package:flutter/services.dart';

import '../i18n/tr.dart';
import 'prefs.dart';
import 'widgets.dart';

const _diag = MethodChannel('gangcity/diag');
const _seenKey = 'gangcity.crashSeen', _dartKey = 'gangcity.dartError';
// أسباب الخروج التي تستحق العرض (ApplicationExitInfo.REASON_*)، وما سواها خروج عادي (المستخدم أو تحديث التطبيق)
const _reasons = {2: 'أوقفها النظام بإشارة', 3: 'نفاد الذاكرة: أغلقها النظام', 4: 'خطأ في كود أندرويد', 5: 'انهيار في المحرك (كود أصلي)',
  6: 'توقفت عن الاستجابة', 7: 'فشل التشغيل', 9: 'استهلاك مفرط للموارد', 13: 'سبب آخر'};

// أخطاء Dart التي لم تُلتقط: تُحفظ (آخرها) لتُعرض عند الفتح التالي، ثم يكمل التعامل المعتاد معها
void watchDartErrors() {
  final framework = FlutterError.onError;
  FlutterError.onError = (d) {
    _saveDart('${d.exceptionAsString()}\n${d.stack}');
    framework?.call(d);
  };
  PlatformDispatcher.instance.onError = (e, st) {
    _saveDart('$e\n$st');
    return false;
  };
}

// آخر خطوة (تحميل المباراة وأول إطار وثوانيها الأولى، بإعدادها): تُكتب في ملف فوراً فتبقى إن انهارت اللعبة بعدها
void crumb(String step) => _diag.invokeMethod<void>('step', '$step (${DateTime.now()})').catchError((_) {});

void _saveDart(String text) {
  final t = text.length > 4000 ? text.substring(0, 4000) : text;
  Prefs.writeRaw(_dartKey, '${DateTime.now().millisecondsSinceEpoch}|$t');
}

// نص التقرير إن كان هناك ما لم يُعرض بعد، وإلا null
Future<String?> pendingCrashReport() async {
  final seen = int.tryParse(Prefs.raw(_seenKey) ?? '') ?? 0;
  final out = <String>[];
  var newest = seen;
  try {
    final r = await _diag.invokeMapMethod<String, Object?>('lastExit');
    if (r != null) {
      for (final e in (r['exits'] as List? ?? const []).cast<Map>()) {
        final time = (e['time'] as num).toInt(), reason = (e['reason'] as num).toInt();
        if (time <= seen || !_reasons.containsKey(reason)) continue;
        if (time > newest) newest = time;
        out.add([
          '${_reasons[reason]} (${DateTime.fromMillisecondsSinceEpoch(time)})${reason == 5 ? ' • الإشارة ${e['status']}' : ''}',
          if ('${e['desc']}'.isNotEmpty) 'الوصف: ${e['desc']}',
          'الذاكرة: ${((e['pss'] as num) / 1024).round()} ميغابايت (rss ${((e['rss'] as num) / 1024).round()})',
          if ('${e['trace']}'.isNotEmpty) '${e['trace']}',
        ].join('\n'));
        if ('${r['step']}'.isNotEmpty) out.add('آخر خطوة: ${r['step']}');
        if ('${r['log']}'.isNotEmpty) out.add('سجل أندرويد:\n${r['log']}');
        break;   // آخر إغلاق غير عادي وحده
      }
      final err = '${r['error'] ?? ''}';
      if (err.isNotEmpty) out.add('آخر خطأ أندرويد:\n$err');
      if (out.isNotEmpty) out.insert(0, 'الجهاز ${r['device']} • أندرويد sdk ${r['sdk']}');
      await _diag.invokeMethod<void>('clear');
    }
  } catch (_) {}
  crumb('القوائم');
  final dart = Prefs.raw(_dartKey);
  if (dart != null && dart.isNotEmpty) {
    out.add('آخر خطأ في كود اللعبة:\n${dart.substring(dart.indexOf('|') + 1)}');
    Prefs.remove(_dartKey);
  }
  Prefs.writeRaw(_seenKey, '$newest');
  return out.isEmpty ? null : out.join('\n\n');
}

// نافذة التقرير: النص قابل للتحديد، وزر نسخ
Future<void> showCrashReport(BuildContext context, String text) => showDialog<void>(
  context: context,
  builder: (c) => StatefulBuilder(builder: (c, set) => Dialog(
    backgroundColor: Colors.transparent,
    child: Panel(padding: const EdgeInsets.all(12), child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Text('سبب إغلاق اللعبة آخر مرة', style: TextStyle(color: gold, fontSize: 16, fontWeight: FontWeight.w700)),
      const SizedBox(height: 4),
      const Text('صوّر هذه النافذة أو انسخ النص وأرسله للتشخيص', style: TextStyle(color: dim, fontSize: 12)),
      const SizedBox(height: 6),
      ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(c).height * 0.36),
        child: SingleChildScrollView(child: SelectableText(text, textDirection: TextDirection.ltr,
            style: const TextStyle(color: ink, fontSize: 10.5, fontFamily: 'monospace'))),
      ),
      const SizedBox(height: 6),
      if (_copied != null) Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(_copied!, style: const TextStyle(color: dim, fontSize: 12))),
      Row(mainAxisSize: MainAxisSize.min, children: [
        // الحافظة قد ترفض في بعض أجهزة سامسونج (SecurityException): لا خطأ، والتصوير يكفي
        WideButton('نسخ', () async {
          try {
            await Clipboard.setData(ClipboardData(text: text));
            set(() => _copied = 'نُسخ النص');
          } catch (_) {
            set(() => _copied = 'تعذر النسخ في هذا الجهاز: صوّر النافذة (مرّر النص لتصوير باقيه)');
          }
        }, width: 120, primary: true),
        const SizedBox(width: 8),
        WideButton('إغلاق', () => Navigator.of(c).pop(), width: 120),
      ]),
    ])),
  )),
).whenComplete(() => _copied = null);
String? _copied;
