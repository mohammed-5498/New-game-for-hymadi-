// صور المدن في القوائم (أداة، لا تدخل الفحص العادي): OUT=<مجلد> flutter test tool/export_city_thumbs_test.dart
// من رسم المدينة في اللعبة نفسها (2.6.0، كانت من رسم نسخة المتصفح القديم): وسط الخريطة بمعبده نهاراً، 780×390 بصيغة png،
// ثم webp إلى assets/thumbs/city_<مدينة>.webp (ZOOM للتقريب، 1.5 افتراضياً)
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/config.dart' show CITIES, RETIRED_CITIES, TILE_HALF_H;
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/data/js_config.dart' show GANG_IDS;
import 'package:gangcity/map/generator.dart';
import 'package:gangcity/render/city_art.dart';
import 'package:gangcity/render/city_layer.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('city thumbs', (tester) async {
    final out = Platform.environment['OUT'] ?? '/tmp/city_thumbs';
    final zoom = double.tryParse(Platform.environment['ZOOM'] ?? '') ?? 1.5;
    Directory(out).createSync(recursive: true);
    const w = 780.0, h = 390.0;
    for (final city in CITIES.order.where((c) => !RETIRED_CITIES.contains(c))) {
      final m = createMap('medium', [for (final g in GANG_IDS) MapPlayer(g as String)], city, Rng(7), specials: false, features: true, temples: true)!;
      final art = (await tester.runAsync(() => CityArt.load(m.city)))!;
      final layer = CityLayer(m, art);
      final rec = ui.PictureRecorder(), c = Canvas(rec);
      c.drawColor(const Color(0xFF15110D), BlendMode.src);
      final cy = m.n * TILE_HALF_H, half = h / 2 / zoom;
      c..translate(w / 2, h / 2)..scale(zoom)..translate(0, -cy);
      layer.paint(c, art.image, cy - half, cy + half);
      final img = (await tester.runAsync(() => rec.endRecording().toImage(w.toInt(), h.toInt())))!;
      final bytes = await tester.runAsync(() => img.toByteData(format: ui.ImageByteFormat.png));
      File('$out/city_$city.png').writeAsBytesSync(bytes!.buffer.asUint8List());
      layer.dispose();
      art.dispose();
    }
  }, timeout: const Timeout(Duration(minutes: 10)));
}
