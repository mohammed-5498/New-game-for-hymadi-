// اللغات (2.5.0، بطلب المستخدم: "قم بإضافة اللغة الإنجليزية"). النص العربي في الكود هو المفتاح، والترجمة عند العرض وحده:
// Text هنا يحل محل Text في ملفات الواجهة (تستورد material بلا Text)، فلا يمس المحاكاة ولا بصمات اللعب المحلي ولا الملفات
// المولّدة. القاموس en.dart: نص كامل، أو قالب بـ {} مكان كل ${...} (يطابَق به النص المركّب وتُترجم أجزاؤه)، وما لا يُعرف
// يبقى عربياً. فحص التغطية: test/i18n_test.dart يجد كل نص عربي في lib/ بلا ترجمة
import 'dart:ui' as ui;

import 'package:flutter/material.dart' as m;

import '../ui/prefs.dart';
import 'en.dart';

class Lang {
  static final notifier = m.ValueNotifier<String>('ar');
  static String get code => notifier.value;
  static bool get en => notifier.value == 'en';
  static m.TextDirection get dir => en ? m.TextDirection.ltr : m.TextDirection.rtl;
  static const _key = 'gangcity.lang';

  // أول تشغيل بلغة الجوال (العربية لجوال عربي، والإنجليزية لغيره)، ثم ما اختاره اللاعب
  static void load() {
    final saved = Prefs.raw(_key);
    notifier.value = saved == 'ar' || saved == 'en' ? saved! : ui.PlatformDispatcher.instance.locale.languageCode == 'ar' ? 'ar' : 'en';
  }

  static void set(String code) {
    Prefs.writeRaw(_key, code);
    _memo.clear();
    notifier.value = code;
  }
}

// --- الترجمة ---
final _arabic = RegExp(r'[؀-ۿ]');
final _memo = <String, String>{};

String tr(String s) {
  if (!Lang.en || !_arabic.hasMatch(s)) return s;
  final hit = _memo[s];
  if (hit != null) return hit;
  if (_memo.length > 4000) _memo.clear();
  return _memo[s] = _translate(s);
}

// ما يفصل أجزاء نص مركّب، وبديله بالإنجليزية
const _seps = [('\n', '\n'), (' — ', ' — '), (' • ', ' • '), (' · ', ' · '), ('، ', ', '), (': ', ': '), (' - ', ' - ')];
// وأسماء فريق وعناوين: لا تُعتمد إلا إن تُرجم كل جزء (' و' بداية كلمات كثيرة: واجه ووصل)
const _strict = [(' و', ' & '), (' أو ', ' or ')];

int _arCount(String s) {
  var n = 0;
  for (final c in s.codeUnits) { if (c >= 0x600 && c <= 0x6FF) n++; }
  return n;
}

// كل طريقة تجرَّب بالترتيب، وأول ترجمة بلا حرف عربي تُعتمد، وإلا فأقلها عربيةً (اسم لاعب عربي يبقى كما هو)
final _lead = RegExp(r'^[^\u0600-\u06FF]+'), _tail = RegExp(r'[^\u0600-\u06FF]+$');
String _translate(String s) {
  final exact = EN[s];
  if (exact != null) return exact;
  final t = s.trim();
  if (t.length != s.length && t.isNotEmpty) return s.replaceFirst(t, tr(t));   // المسافات حوله كما هي
  if (s.length > 2 && s.startsWith('«') && s.endsWith('»')) return '“${tr(s.substring(1, s.length - 1))}”';
  String? best;
  var fewest = _arCount(s);
  bool take(String c) {
    final n = _arCount(c);
    if (n < fewest) { best = c; fewest = n; }
    return n == 0;
  }
  for (final (re, en) in _templates) {
    final mt = re.firstMatch(s);
    if (mt != null && take(_fill(en, [for (var g = 1; g <= mt.groupCount; g++) tr(mt.group(g)!)]))) return best!;
  }
  for (final (ar, en) in _seps) {
    if (s.contains(ar) && take(s.split(ar).map(tr).join(en))) return best!;
  }
  for (final (ar, en) in _strict) {
    if (!s.contains(ar)) continue;
    final c = s.split(ar).map(tr).join(en);
    if (_arCount(c) == 0) return c;
  }
  // ما قبل النص وما بعده بلا عربية كما هو: '✓ ' و'1. ' و')'
  final lead = _lead.firstMatch(s), tail = _tail.firstMatch(s);
  if (lead != null && lead.end < s.length && take(lead[0]! + tr(s.substring(lead.end)))) return best!;
  if (tail != null && tail.start > 0 && take(tr(s.substring(0, tail.start)) + tail[0]!)) return best!;
  // نص معروف ثم ما يُضاف إليه في الكود (عدّاد أو اسم): 'صاروخ البارود! ابتعد عن الدائرة ' + '0:05'
  final pre = _prefixOf(s);
  if (pre != null) take(EN[pre]! + tr(s.substring(pre.length)));
  return best ?? s;
}

// القوالب: ما فيه {} ونص عربي ثابت، الأطول نصاً أولاً (الأدق). القصير جداً ({}ث، {} د، حي {}) أجزاؤه بلا عربية (أرقام)،
// ولا يعبر جزء فاصلاً بين نصين ( — و • وسطر جديد) فيُقسم النص المركّب عنده
final _templates = () {
  final list = <(RegExp, String, int)>[];
  EN.forEach((k, v) {
    if (!k.contains('{}')) return;
    final parts = k.split('{}');
    final letters = _arCount(parts.join());
    if (letters == 0) return;
    final group = letters < 3 ? r'([^؀-ۿ]*?)' : r'((?:(?! — | • |\n).)*?)';
    list.add((RegExp('^${parts.map(RegExp.escape).join(group)}\$', dotAll: true), v, parts.join().length));
  });
  list.sort((a, b) => b.$3.compareTo(a.$3));
  return [for (final (re, en, _) in list) (re, en)];
}();

// أطول نص معروف يبدأ به s (بلا قوالب، ثلاثة أحرف على الأقل)
String? _prefixOf(String s) {
  String? best;
  for (final k in EN.keys) {
    if (k.length >= 3 && k.length < s.length && !k.contains('{}') && s.startsWith(k) && (best == null || k.length > best.length)) best = k;
  }
  return best;
}

// {0} {1} بترتيبها، و{} بالتتابع
final _slot = RegExp(r'\{(\d?)\}');
String _fill(String en, List<String> g) {
  var next = 0;
  return en.replaceAllMapped(_slot, (m) {
    final n = m[1]!.isEmpty ? next++ : int.parse(m[1]!);
    return n < g.length ? g[n] : '';
  });
}

// نص لا يُترجم (اسم اللغة بلغتها في زر اللغة)
typedef RawText = m.Text;

// --- Text يترجم نفسه، ويُعاد بناؤه حين تتغير اللغة (LangScope) ولو كان const ---
class LangScope extends m.InheritedWidget {
  final String code;
  const LangScope({super.key, required this.code, required super.child});
  @override
  bool updateShouldNotify(LangScope oldWidget) => oldWidget.code != code;
}

class Text extends m.StatelessWidget {
  final String? data;
  final m.InlineSpan? textSpan;
  final m.TextStyle? style;
  final m.TextAlign? textAlign;
  final m.TextDirection? textDirection;
  final m.TextOverflow? overflow;
  final int? maxLines;
  const Text(String this.data, {super.key, this.style, this.textAlign, this.textDirection, this.overflow, this.maxLines}) : textSpan = null;
  const Text.rich(m.InlineSpan this.textSpan, {super.key, this.style, this.textAlign, this.textDirection, this.overflow, this.maxLines})
      : data = null;

  @override
  m.Widget build(m.BuildContext context) {
    context.dependOnInheritedWidgetOfExactType<LangScope>();
    final d = data;
    // الترتيب من اليمين لليسار في اللغتين، والجملة الإنجليزية نفسها من اليسار لليمين (فلا تنقلب علامات الترقيم)
    final dir = textDirection ?? (Lang.en ? m.TextDirection.ltr : null);
    if (d != null) return m.Text(tr(d), style: style, textAlign: textAlign, textDirection: dir, overflow: overflow, maxLines: maxLines);
    return m.Text.rich(trSpan(textSpan!), style: style, textAlign: textAlign, textDirection: dir, overflow: overflow, maxLines: maxLines);
  }
}

m.InlineSpan trSpan(m.InlineSpan s) => s is m.TextSpan
    ? m.TextSpan(text: s.text == null ? null : tr(s.text!), style: s.style, children: s.children?.map(trSpan).toList())
    : s;
