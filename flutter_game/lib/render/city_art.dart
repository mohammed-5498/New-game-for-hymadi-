// صور المدينة: أطلس واحد لكل مدينة (scripts/pack_atlases.py من حزمة الصور)، يُحمَّل كصورة واحدة فيرسمه كرت الشاشة
// بأمر واحد وبمستويات تصغير. كل صورة فيه بمستطيلها ونقطة ارتكازها (وسط قاعدة مربعها) ونوعها
import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/services.dart';

class Sprite {
  final String key, group, kind;
  final int variant;
  final String? size;
  final double x, y, w, h, ax, ay;
  Sprite(Map<String, dynamic> j)
      : key = j['key'], group = j['group'], kind = j['kind'], variant = j['variant'] ?? 1, size = j['size'],
        x = (j['r'][0] as num).toDouble(), y = (j['r'][1] as num).toDouble(),
        w = (j['r'][2] as num).toDouble(), h = (j['r'][3] as num).toDouble(),
        ax = (j['r'][4] as num).toDouble(), ay = (j['r'][5] as num).toDouble();
}

class CityArt {
  final String city;
  final ui.Image image;
  final double px, scale;              // بكسل الأطلس لكل وحدة عالم، وحجم المبنى العادي في المدن المفتوحة
  final Map<String, String?> colors;   // ground وroad وroad2 وplaza وwater
  final List<Sprite> sprites;
  final Map<String, List<Sprite>> _byKind = {};

  CityArt._(this.city, this.image, this.px, this.scale, this.colors, this.sprites) {
    for (final s in sprites) { (_byKind['${s.group}/${s.kind}'] ??= []).add(s); }
    for (final list in _byKind.values) { list.sort((a, b) => a.variant - b.variant); }
  }

  static Future<CityArt> load(String city) async {
    final meta = jsonDecode(await rootBundle.loadString('assets/map/atlas/$city.json')) as Map<String, dynamic>;
    final bytes = await rootBundle.load('assets/map/atlas/$city.webp');
    final codec = await ui.instantiateImageCodec(bytes.buffer.asUint8List());
    final image = (await codec.getNextFrame()).image;
    codec.dispose();
    return CityArt._(city, image, (meta['pxPerUnit'] as num).toDouble(), (meta['scale'] as num).toDouble(),
        (meta['colors'] as Map).cast<String, String?>(),
        [for (final s in meta['sprites']) Sprite(s as Map<String, dynamic>)]);
  }

  // النسخة variant (1-3) من نوع في مجموعة، أو الأولى إن كانت نسخه أقل
  Sprite? find(String group, String kind, [int variant = 1]) {
    final list = _byKind['$group/$kind'];
    if (list == null) return null;
    return variant <= list.length ? list[variant - 1] : list.first;
  }

  // مبنى الاقتصاد بحجم حيه: القاعدة والبرج والمستشفى (والشرطة بحجم واحد)
  Sprite? economy(String kind, String size) {
    final list = _byKind['economy/$kind'];
    if (list == null) return null;
    return list.firstWhere((s) => s.size == size, orElse: () => list.first);
  }

  bool has(String kind) => _byKind.containsKey('building/$kind') || _byKind.containsKey('prop/$kind');

  void dispose() => image.dispose();
}
