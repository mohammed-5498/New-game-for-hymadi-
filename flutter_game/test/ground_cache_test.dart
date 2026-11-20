// صورة الأرض الجاهزة (2.9.0): تُرسم بعد استقرار التقريب وتبقى ما دامت الشاشة داخلها، وتُرسم من جديد إذا خرجت الشاشة عنها
// (لا أكثر من مرة كل gap إطارات) أو تغير ما فيها، وبين ذلك الأرض مباشرة. والإطار منها كالإطار المرسوم مباشرة
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/config.dart' show GROUND_CACHE, TILE_HALF_H;
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/data/js_config.dart' show GANG_IDS;
import 'package:gangcity/map/generator.dart';
import 'package:gangcity/render/city_art.dart';
import 'package:gangcity/render/city_layer.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('متى تُرسم صورة الأرض', () {
    final cache = GroundCache();
    var draws = 0;
    bool frame(ui.Rect view, double z, [Object key = 1]) {
      final rec = ui.PictureRecorder(), c = ui.Canvas(rec);
      final ok = cache.paint(c, view, z, 2, key, (c, area) { draws++; c.drawRect(area, ui.Paint()); });
      rec.endRecording().dispose();
      return ok;
    }
    const v = ui.Rect.fromLTWH(0, 0, 400, 200);
    for (var k = 0; k < GROUND_CACHE.settle; k++) { expect(frame(v, 2), isFalse, reason: 'التقريب لم يستقر بعد'); }
    expect(frame(v, 2), isTrue);
    expect(draws, 1);
    for (var k = 0; k < 20; k++) { expect(frame(v.shift(const ui.Offset(30, 15)), 2), isTrue); }
    expect(draws, 1, reason: 'الكاميرا داخل الهامش: الصورة نفسها');
    expect(frame(v.shift(const ui.Offset(300, 0)), 2), isTrue);
    expect(draws, 2, reason: 'خرجت الشاشة عن الصورة');
    expect(frame(v.shift(const ui.Offset(900, 0)), 2), isFalse, reason: 'الكاميرا تجري: مباشرة حتى يمر gap');
    for (var k = 1; k < GROUND_CACHE.gap - 1; k++) { frame(v.shift(const ui.Offset(900, 0)), 2); }
    expect(frame(v.shift(const ui.Offset(900, 0)), 2), isTrue);
    expect(draws, 3);
    expect(frame(v.shift(const ui.Offset(900, 0)), 2.4), isFalse, reason: 'التقريب يتغير: مباشرة');
    for (var k = 0; k < GROUND_CACHE.settle + GROUND_CACHE.gap; k++) { frame(v.shift(const ui.Offset(900, 0)), 2.4); }
    expect(draws, 4, reason: 'استقر التقريب الجديد');
    for (var k = 0; k < GROUND_CACHE.gap; k++) { frame(v.shift(const ui.Offset(900, 0)), 2.4, 2); }
    expect(draws, 5, reason: 'تغير لون حي أو حدوده');
    cache.dispose();
  });

  testWidgets('الإطار من صورة الأرض كالمرسوم مباشرة', (tester) async {
    final m = createMap('medium', [for (final g in GANG_IDS) MapPlayer(g as String)], 'shibam', Rng(7), specials: false, features: true, temples: true)!;
    final art = (await tester.runAsync(() => CityArt.load(m.city)))!;
    final layer = CityLayer(m, art);
    // شاشة الجوال (868×412 بنقاط 2.625) بتقريب 1.7 على وسط الخريطة، والكاميرا بين نقطتين
    const w = 868.0, h = 412.0, dpr = 2.625, z = 1.7, cx = 13.37;
    final cy = m.n * TILE_HALF_H + 7.71;
    final cache = GroundCache();
    Future<Uint8List> shot(bool cached) async {
      final rec = ui.PictureRecorder(), c = ui.Canvas(rec);
      c.drawColor(const ui.Color(0xFF15110D), ui.BlendMode.src);
      c..scale(dpr)..translate(w / 2, h / 2)..scale(z)..translate(-cx, -cy);
      final view = ui.Rect.fromLTRB(cx - w / 2 / z, cy - h / 2 / z, cx + w / 2 / z, cy + h / 2 / z);
      if (cached) {
        var drawn = false;
        for (var k = 0; k <= GROUND_CACHE.settle && !drawn; k++) {
          drawn = cache.paint(c, view, z, dpr, 1, (gc, area) => layer.paintGround(gc, art.image, area.top, area.bottom));
        }
        expect(drawn, isTrue);
      } else {
        layer.paintGround(c, art.image, view.top, view.bottom);
      }
      final img = (await tester.runAsync(() => rec.endRecording().toImage((w * dpr).round(), (h * dpr).round())))!;
      return (await tester.runAsync(() => img.toByteData()))!.buffer.asUint8List();
    }
    final a = await shot(false), b = await shot(true);
    var sum = 0, big = 0;
    for (var k = 0; k < a.length; k++) {
      final d = (a[k] - b[k]).abs();
      sum += d;
      if (d > 48) big++;
    }
    // الفرق من إعادة أخذ النقاط (أقل من نقطة إزاحة وحواف المربعات): صغير في المتوسط ونادر الكبير
    expect(sum / a.length, lessThan(3.0));
    expect(big / a.length, lessThan(0.01));
    cache.dispose();
    layer.dispose();
    art.dispose();
  });
}
