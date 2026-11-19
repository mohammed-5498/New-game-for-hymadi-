// الترجمة (2.5.0، بطلب المستخدم): كل نص عربي في lib/ له ترجمة في en.dart (نص كامل، أو قالب بـ {} مكان كل ${...})،
// وخانات كل قالب بعددها، وtr تترجم النص المركّب بقالبه وفواصله. ما ينقص يُكتب في build/i18n_missing.txt
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/i18n/en.dart';
import 'package:gangcity/i18n/tr.dart';

final _arabic = RegExp(r'[؀-ۿ]');

// نصوص ملف Dart بلا تعليقاته: \n وأخواتها بمعناها، و$اسم و${...} تصير {}، والنصوص داخل ${...} تُجمع أيضاً
List<String> literals(String src) {
  final out = <String>[];
  var i = 0;
  bool idStart(String c) => RegExp(r'[A-Za-z_]').hasMatch(c);
  bool idChar(String c) => RegExp(r'[A-Za-z0-9_]').hasMatch(c);
  late (String, int) Function(int) str;
  str = (int at) {
    var p = at;
    final raw = src[p] == 'r';
    if (raw) p++;
    final q = src[p];
    final delim = src.startsWith(q * 3, p) ? q * 3 : q;
    p += delim.length;
    final b = StringBuffer();
    while (!src.startsWith(delim, p)) {
      final c = src[p];
      if (!raw && c == r'\') {
        final e = src[p + 1];
        b.write(switch (e) { 'n' => '\n', 't' => '\t', _ => e });
        p += 2;
      } else if (!raw && c == r'$' && src[p + 1] == '{') {
        var depth = 1;
        p += 2;
        while (depth > 0) {
          final d = src[p];
          if (d == "'" || d == '"') {
            final (s, end) = str(p);
            if (_arabic.hasMatch(s)) out.add(s);
            p = end;
            continue;
          }
          if (d == '{') depth++;
          if (d == '}') depth--;
          p++;
        }
        b.write('{}');
      } else if (!raw && c == r'$' && idStart(src[p + 1])) {
        p++;
        while (idChar(src[p])) { p++; }
        b.write('{}');
      } else {
        b.write(c);
        p++;
      }
    }
    return (b.toString(), p + delim.length);
  };
  while (i < src.length) {
    if (src.startsWith('//', i)) {
      i = src.indexOf('\n', i);
      if (i < 0) break;
    } else if (src.startsWith('/*', i)) {
      i = src.indexOf('*/', i) + 2;
    } else if (src[i] == "'" || src[i] == '"' || (src[i] == 'r' && i + 1 < src.length && (src[i + 1] == "'" || src[i + 1] == '"') &&
        (i == 0 || !idChar(src[i - 1])))) {
      var (s, end) = str(i);
      // نصان متجاوران نص واحد
      var j = end;
      while (j < src.length && (src[j] == ' ' || src[j] == '\n')) { j++; }
      while (j < src.length && (src[j] == "'" || src[j] == '"')) {
        final (s2, e2) = str(j);
        s += s2;
        end = e2;
        j = end;
        while (j < src.length && (src[j] == ' ' || src[j] == '\n')) { j++; }
      }
      if (_arabic.hasMatch(s)) out.add(s);
      i = end;
    } else {
      i++;
    }
  }
  return out;
}

void main() {
  test('كل نص عربي في lib/ له ترجمة إنجليزية', () {
    final missing = <String, String>{};
    for (final f in Directory('lib').listSync(recursive: true).whereType<File>().where((f) => f.path.endsWith('.dart'))) {
      if (f.path.contains('/i18n/')) continue;   // القاموس ومحرّكه
      for (final s in literals(f.readAsStringSync())) {
        if (!EN.containsKey(s)) missing.putIfAbsent(s, () => f.path);
      }
    }
    Directory('build').createSync();
    File('build/i18n_missing.txt').writeAsStringSync([for (final e in missing.entries) '${e.value}\t${e.key.replaceAll('\n', r'\n')}'].join('\n'));
    expect(missing.length, 0, reason: '${missing.length} نصاً بلا ترجمة (build/i18n_missing.txt)، أولها: ${missing.keys.take(5).toList()}');
  });

  test('خانات كل قالب بعددها', () {
    final slot = RegExp(r'\{(\d?)\}');
    EN.forEach((k, v) {
      final n = '{}'.allMatches(k).length;
      final used = slot.allMatches(v).toList();
      final top = used.isEmpty ? 0 : used.map((m) => m[1]!.isEmpty ? used.where((x) => x[1]!.isEmpty).length : int.parse(m[1]!) + 1).reduce((a, b) => a > b ? a : b);
      expect(top, n, reason: '$k → $v');
    });
  });

  test('tr: نص كامل وقالب وفواصل، والعربية كما هي', () {
    Lang.notifier.value = 'en';
    expect(tr('لعب'), EN['لعب']);
    expect(tr('Play 12'), 'Play 12');
    expect(tr('بوت 3'), EN['بوت {}']!.replaceFirst('{}', '3'));
    expect(tr('لعب • القصة'), '${EN['لعب']} • ${EN['القصة']}');
    // قالب قصير لا يأخذ اسماً عربياً ({}ث للثواني)، والقسمة عند الفاصل الصحيح، واسم لاعب عربي يبقى
    expect(tr('12ث'), '12s');
    expect(tr('نخبة بريطانيا — فتيان سمول هيث'), 'Britain Elite — Small Heath Boys');
    expect(tr('«معاطف الصوف»: الأفراد العاديون +10% درع، والضربة القوية ترنّح أطول 25%'),
        '“Wool Coats”: ${EN['الأفراد العاديون +10% درع، والضربة القوية ترنّح أطول 25%']}');
    expect(tr('انتهى الوقت والغربان والمطارق أعلى نقاطاً'), "Time's up, and The Crows & The Hammers has the most points");
    expect(tr('محمد (المضيف)'), 'محمد (host)');
    expect(tr('1. دافع عن بئر الحي (دفاع) — احمِ حي البئر من موجات الشبكة حتى ينتهي العدّ.'),
        "1. Defend the quarter's well (Defend) — ${EN['احمِ حي البئر من موجات الشبكة حتى ينتهي العدّ.']}");
    expect(tr('4. واجه راشد العين (الزعيم)'), '4. Face Rashid the Eye (Boss)');
    expect(tr('حي متوسط'), 'Medium district');
    expect(tr('بلا الضباب'), 'No Fog');
    expect(tr('سقط الجسر القديم'), 'The old bridge has fallen');
    expect(tr('نمط الرامي: ${'قتال من بعيد'}'), startsWith('Archer style: '));
    expect(tr('✓ دافع عن بئر الحي • +60 نقطة • المهمة التالية بعد لحظات'),
        "✓ Defend the quarter's well • +60 points • Next mission in a moment");
    Lang.notifier.value = 'ar';
    expect(tr('لعب'), 'لعب');
  });
}
