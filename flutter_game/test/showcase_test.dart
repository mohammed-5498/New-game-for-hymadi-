// عرض الشخصيات في المتجر (2.6.0): كل عصابة وأمة ومظهر نخبة يُرسم واقفاً وضارباً بلا خطأ، ولكل لوح صورته في الأطلس
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/core/cfg.dart';
import 'package:gangcity/data/js_config.dart';
import 'package:gangcity/data/rig_sprites.dart';
import 'package:gangcity/render/batch.dart';
import 'package:gangcity/render/unit_art.dart';
import 'package:gangcity/render/unit_atlas.dart';
import 'package:gangcity/ui/showcase.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('كل عصابة وأمة ونخبة تُرسم في العرض', (tester) async {
    final sides = <(String, String?, bool)>[
      for (final g in GANG_IDS) (g as String, null, false),
      for (final n in nations.l('order').cast<String>()) ...[
        (nations.m(n).s('style'), n, false),
        if (RIG_SHEETS.containsKey('${n}_elite')) (nations.m(n).s('style'), n, true),
      ],
    ];
    for (final (gang, nation, elite) in sides) {
      final (cast, hex) = showcaseCast(gang, nation, elite);
      expect(cast.where((u) => u.champion).length, 1, reason: '$gang $nation');
      final sheets = {for (final u in cast) sheetOf(u, previewSkin[u])}.whereType<String>().toList();
      final atlas = (await tester.runAsync(() => buildUnitAtlas([for (final s in sheets) (s, hex)])))!;
      for (final t in [0.4, 1.0]) {   // واقفاً، ثم في منتصف ضربة
        final b = TriBatch();
        for (final u in cast) {
          u.attackStart = t > 0.5 ? t - 0.25 : null;
          drawOne(b, atlas, u, artKey(u, t), 100, 100, 2, hex, t, false, 0, 1, 0);
        }
        expect(b.count, greaterThan(0), reason: '$gang $nation $elite');
      }
      expect(atlas.missing, isEmpty, reason: '$gang $nation $elite');
      atlas.image.dispose();
    }
  }, timeout: const Timeout(Duration(minutes: 4)));
}
