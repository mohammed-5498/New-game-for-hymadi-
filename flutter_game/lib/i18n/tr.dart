// اللغات (2.5.0، بطلب المستخدم: "قم بإضافة اللغة الإنجليزية"). النص العربي في الكود هو المفتاح، والترجمة عند العرض وحده:
// Text هنا يحل محل Text في ملفات الواجهة (تستورد material بلا Text)، فلا يمس المحاكاة ولا بصمات اللعب المحلي ولا الملفات
// المولّدة. القاموس en.dart: نص كامل، أو قالب بـ {} مكان كل ${...} (يطابَق به النص المركّب وتُترجم أجزاؤه)، وما لا يُعرف
// يبقى عربياً. فحص التغطية: test/i18n_test.dart يجد كل نص عربي في lib/ بلا ترجمة
import 'dart:ui' as ui;

import 'package:flutter/material.dart' as m;
import 'package:flutter/rendering.dart';

import '../config.dart' show TEXT_FIT;
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
    final t = d != null ? m.Text(tr(d), style: style, textAlign: textAlign, textDirection: dir, overflow: overflow, maxLines: maxLines)
        : m.Text.rich(trSpan(textSpan!), style: style, textAlign: textAlign, textDirection: dir, overflow: overflow, maxLines: maxLines);
    // النص المحدود بأسطر أو بنقاط القطع يصغر خطه ليظهر كاملاً في مكانه (2.16.0)
    return maxLines != null || overflow == m.TextOverflow.ellipsis ? _Fit(child: t) : t;
  }
}

// نص يصغر ليتسع لمكانه بدل أن يُقطع (2.16.0، بطلب المستخدم: "النصوص لا تظهر بشكل كامل لذلك صغر الخط ليتناسب مع المكان"):
// يُرتّب النص بعرض أوسع ويُرسم مصغراً بالنسبة نفسها، بأكبر نسبة يتسع بها لأسطره، حتى TEXT_FIT.minScale ثم يُقطع كما كان
class _Fit extends m.SingleChildRenderObjectWidget {
  const _Fit({super.child});
  @override
  RenderObject createRenderObject(m.BuildContext context) => _RenderFit();
}

class _RenderFit extends RenderProxyBox {
  double _k = 1;

  RenderParagraph? get _paragraph {
    RenderObject? c = child;
    while (c is RenderProxyBox) { c = c.child; }
    return c is RenderParagraph ? c : null;
  }

  bool _fits(RenderBox c, RenderParagraph? p, double k) {
    c.layout(BoxConstraints(minWidth: constraints.minWidth / k, maxWidth: constraints.maxWidth / k), parentUsesSize: true);
    return !(p?.didExceedMaxLines ?? false);
  }

  @override
  void performLayout() {
    final c = child;
    if (c == null) { size = constraints.smallest; return; }
    final p = _paragraph;
    var k = 1.0;
    if (!_fits(c, p, 1) && constraints.hasBoundedWidth && p != null) {
      var lo = TEXT_FIT.minScale, hi = 1.0;
      if (_fits(c, p, lo)) {
        for (var n = 0; n < TEXT_FIT.steps; n++) {
          final mid = (lo + hi) / 2;
          if (_fits(c, p, mid)) { lo = mid; } else { hi = mid; }
        }
        _fits(c, p, lo);
      }
      k = lo;
    }
    _k = k;
    size = constraints.constrain(Size(c.size.width * k, c.size.height * k));
  }

  @override
  double? computeDistanceToActualBaseline(TextBaseline baseline) {
    final b = child?.getDistanceToActualBaseline(baseline);
    return b == null ? null : b * _k;
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    final c = child;
    if (c == null) return;
    if (_k == 1) { context.paintChild(c, offset); return; }
    context.pushTransform(needsCompositing, offset, Matrix4.diagonal3Values(_k, _k, 1), (ctx, o) => ctx.paintChild(c, o));
  }

  @override
  void applyPaintTransform(RenderBox child, Matrix4 transform) => transform.multiply(Matrix4.diagonal3Values(_k, _k, 1));

  @override
  bool hitTestChildren(BoxHitTestResult result, {required Offset position}) {
    final c = child;
    return c != null && result.addWithPaintTransform(transform: Matrix4.diagonal3Values(_k, _k, 1), position: position,
        hitTest: (r, q) => c.hitTest(r, position: q));
  }
}

m.InlineSpan trSpan(m.InlineSpan s) => s is m.TextSpan
    ? m.TextSpan(text: s.text == null ? null : tr(s.text!), style: s.style, children: s.children?.map(trSpan).toList())
    : s;
