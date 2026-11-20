# خطافات القياس على نسخة لينكس من اللعبة (2.8.0، لا تمس المستودع): الإعداد من GC_Q (كـ ?match=1... في المتصفح)، وعدّاد
# الأداء يُطبع كل 5 ث (GC_METER)، وإخفاء طبقات (GC_HIDE=city,units,fog,weather، وGC_NOHUD، وGC_BLANK مشهد فارغ)، وإيقاف بعد
# 8 ث (GC_PAUSE)، وبلا أرض المدينة (GC_SKIPGROUND) أو بلا صفوفها (GC_SKIPROWS)، وحارس المعالج لا يحكم (GC_NOGUARD: خيوط llvmpipe تُحسب على اللعبة هنا)، وImpeller ونافذة بمقاس الجوال
# الاستعمال: python3 patch.py <مجلد النسخة>
import sys, re
b = sys.argv[1]
p = f'{b}/lib/main.dart'; s = open(p, encoding='utf-8').read()
if 'GC_Q' not in s:
    s = s.replace("import 'package:flutter/foundation.dart'", "import 'dart:io' show Platform;\nimport 'package:flutter/foundation.dart'", 1)
    s = s.replace("final q = Uri.base.queryParameters;", "final q = Uri.parse('?${Platform.environment['GC_Q'] ?? ''}').queryParameters;", 1)
    s = s.replace("  await GameSound.init();", "  if (Platform.environment['GC_SOUND'] != null) await GameSound.init();", 1)
    open(p, 'w', encoding='utf-8').write(s)
p = f'{b}/lib/ui/match_screen.dart'; s = open(p, encoding='utf-8').read()
if 'GC_METER' not in s:
    s = s.replace("    _crumb('أول إطار');", "    if (Platform.environment['GC_METER'] != null) { toggleMeter(); final hide = Platform.environment['GC_HIDE'] ?? ''; hideCity = hide.contains('city'); hideUnits = hide.contains('units'); hideFog = hide.contains('fog'); hideWeather = hide.contains('weather'); Timer.periodic(const Duration(seconds: 5), (_) { if (mounted) print('METER ' + (meter.value ?? '').replaceAll('\\n', ' | ')); }); }\n    if (Platform.environment['GC_PAUSE'] != null) Timer(const Duration(seconds: 8), () { if (mounted) openPause(); });\n    _crumb('أول إطار');", 1)
    if "import 'dart:io'" not in s: s = "import 'dart:io' show Platform;\n" + s
    s = s.replace("Positioned.fill(child: RepaintBoundary(child: MatchHud(screen: this))),", "if (Platform.environment['GC_NOHUD'] == null) Positioned.fill(child: RepaintBoundary(child: MatchHud(screen: this))),", 1)
    s = s.replace("    canvas.drawColor(const Color(0xFF1B1611), BlendMode.src);\n    final s = v.state,", "    canvas.drawColor(const Color(0xFF1B1611), BlendMode.src);\n    if (Platform.environment['GC_BLANK'] != null) return;\n    final s = v.state,", 1)
    open(p, 'w', encoding='utf-8').write(s)
p = f'{b}/lib/render/city_layer.dart'; s = open(p, encoding='utf-8').read()
if 'GC_SKIPGROUND' not in s:
    s = "import 'dart:io' show Platform;\n" + s
    s = s.replace("    final any = !skip && b0 <= b1;", "    final any = !skip && b0 <= b1 && Platform.environment['GC_SKIPGROUND'] == null;", 1)
    s = s.replace("      if (row != null) canvas.drawVertices(row, ui.BlendMode.dst, _paint);", "      if (row != null && Platform.environment['GC_SKIPROWS'] == null) canvas.drawVertices(row, ui.BlendMode.dst, _paint);", 1)
    s = s.replace("      if (b > a) {\n        // نوافذ الصف", "      if (b > a && Platform.environment['GC_SKIPROWS'] == null) {\n        // نوافذ الصف", 1)
    open(p, 'w', encoding='utf-8').write(s)
p = f'{b}/lib/ui/cpu_guard.dart'
try:
    s = open(p, encoding='utf-8').read()
    s = s.replace("    if (_inMatch) _govern();", "    if (_inMatch && Platform.environment['GC_NOGUARD'] == null) _govern();", 1)
    open(p, 'w', encoding='utf-8').write(s)
except FileNotFoundError:
    pass
p = f'{b}/linux/runner/my_application.cc'; s = open(p).read()
s = s.replace('gtk_window_set_default_size(window, 1280, 720);', 'gtk_window_set_default_size(window, 868, 412);')
if 'set_enable_impeller' not in s:
    s = s.replace('g_autoptr(FlDartProject) project = fl_dart_project_new();',
                  'g_autoptr(FlDartProject) project = fl_dart_project_new();\n  fl_dart_project_set_enable_impeller(project, g_getenv("GC_SKIA") == nullptr);')
open(p, 'w').write(s)
