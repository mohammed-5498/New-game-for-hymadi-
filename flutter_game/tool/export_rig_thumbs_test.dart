// صور القوائم للشخصيات المقطّعة (أداة، لا تدخل الفحص العادي): flutter test tool/export_rig_thumbs_test.dart
// لكل أمة لها لوح بديل side_<أمة>.png، ولكل مظهر side_<أمة>_<نوع>.png (النخبة والأزياء الجديدة) في مجلد OUT (ثم webp بـ
// scripts/import_rigged.py --thumbs)، وONLY=<لاحقة> (outfit مثلاً) يصنع ألواحها وحدها
// كـ drawCharacters في js/ui/charThumb.js: الفرد العادي يميناً ثم المميزان ثم البطل، تنظر يساراً، بلون المتجر
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/core/cfg.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/data/js_config.dart';
import 'package:gangcity/data/rig_sprites.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/render/batch.dart';
import 'package:gangcity/render/unit_art.dart';
import 'package:gangcity/render/unit_atlas.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('side thumbs', (tester) async {
    final out = Platform.environment['OUT'] ?? '/tmp/rig_thumbs';
    Directory(out).createSync(recursive: true);
    final color = [for (final c in PLAYER_COLORS) c as J].firstWhere((c) => c['id'] == STORE.s('previewColor')).s('hex');
    final only = Platform.environment['ONLY'];
    for (final sheet in RIG_SHEETS.keys) {
      final nation = sheet.split('_').first, kind = sheet.substring(nation.length + 1), skin = kind == 'rig' ? null : kind;
      if (only != null && kind != only) continue;
      simRng = Rng(1);
      final s = createMatch((jsonDecode(jsonEncode({'mode': 'conquest', 'city': 'arab', 'mapSize': 'small', 'maxUnits': 50, 'weather': 'day',
        'players': [{'name': 'a', 'gang': nations.m(nation).s('style'), 'nation': nation, 'color': STORE.s('previewColor'), 'isHuman': false, 'team': 0,
                     'skin': skin},
                    {'name': 'b', 'gang': 'crows', 'nation': null, 'color': 'red', 'isHuman': false, 'team': 0}]})) as Map).cast<String, Object?>());
      setUnitSkins(s);
      final u = s.units.firstWhere((x) => x.playerId == 0 && x.nation == nation);
      final atlas = (await tester.runAsync(() => buildUnitAtlas([(sheet, color)])))!;
      final heroes = [for (final k in nations.m(nation).m('names').keys) if (k != 'common' && k != 'champion') k];
      final kinds = ['common', ...heroes, 'champion'];
      double scaleOf(String k) => k == 'champion' ? UNIT_ART.d('championScale') : k == 'common' ? 1 : UNIT_ART.d('heroScale');
      const w = 480.0, h = 192.0, top = 38.0, bottom = 5.0, slot = 24.0;
      final big = UNIT_ART.d('championScale'), span = kinds.fold(0.0, (a, k) => a + slot * scaleOf(k));
      final sc = [h / ((top + bottom) * big), w / span].reduce((a, b) => a < b ? a : b);
      var x = (w + span * sc) / 2;
      final y = h - bottom * big * sc;
      final rec = ui.PictureRecorder(), c = Canvas(rec);
      final b = TriBatch()..whiteU = 1.5..whiteV = 1.5;
      for (var n = 0; n < kinds.length; n++) {
        final k = kinds[n], one = sc * scaleOf(k), room = slot * scaleOf(k) * sc;
        u..state = 'idle'..facing = -1..hero = k == 'common' || k == 'champion' ? null : k..champion = k == 'champion';
        drawOne(b, atlas, u, '${nation}_$k', x - room / 2, y, one, color, 0.3 + n * 0.17, false, 0, 1, 0);
        x -= room;
      }
      b.flush(c, atlas.image);
      final img = await tester.runAsync(() => rec.endRecording().toImage(w.toInt(), h.toInt()));
      final bytes = await tester.runAsync(() => img!.toByteData(format: ui.ImageByteFormat.png));
      File('$out/side_${skin != null ? sheet : nation}.png').writeAsBytesSync(bytes!.buffer.asUint8List());
    }
  });
}
