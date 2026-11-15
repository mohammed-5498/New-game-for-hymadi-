// أطلس الجنود للمباراة: صورة كل عصابة (assets/units، ألوان فوق وقناع تحت) مصبوغة بلون كل لاعب منها مرة واحدة
// (paintAtlas في js/render/unitSprites.js بالحساب نفسه)، والكل في صورة واحدة يرسمها كرت الشاشة دفعة واحدة،
// ومعها مربع أبيض للأشكال الملونة (الظلال والحلقات والأشرطة والشرر)
import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/services.dart' show rootBundle;

import '../core/cfg.dart';
import '../data/rig_sprites.dart';
import '../data/unit_sprites.dart';

// لوح صور: القديم المقطّع من وضعية T، أو المقطّع أجزاءً منفصلة (البديل والنخبة)
J? sheetInfo(String gang) => (SPRITE_GANGS[gang] ?? RIG_SHEETS[gang]) as J?;

class UnitAtlas {
  final ui.Image image;
  final Map<String, (double, double)> sheets;     // 'عصابة|لون' ← ركن صورتها المصبوغة في الأطلس
  final Uint8List pixels;                         // نسخته في الذاكرة: يكبر بما ينقصه بلا صبغ ما فيه من جديد
  final List<int> colY;
  final missing = <(String, String)>{};           // ما طُلب رسمه ولا صورة له بعد (مجنّد بلون جديد...): يُضاف في الأطلس التالي
  UnitAtlas(this.image, this.sheets, this.pixels, this.colY);
  (double, double)? at(String gang, String color) => sheets['$gang|$color'];
}

const _white = 4;    // شريط أبيض أعلى الأطلس بارتفاعه
const _col = 1024, _cols = 4;   // أربعة أعمدة بعرض الصورة (كلها حتى 1024): الأطلس عريض قصير فتسع المرتزقة بألوان اللاعبين

Future<(Uint8List, int, int)> _load(String path) async {
  final data = await rootBundle.load(path);
  final codec = await ui.instantiateImageCodec(data.buffer.asUint8List());
  final frame = await codec.getNextFrame();
  final img = frame.image;
  final bytes = (await img.toByteData(format: ui.ImageByteFormat.rawStraightRgba))!.buffer.asUint8List();
  final r = (bytes, img.width, img.height);
  img.dispose();
  codec.dispose();
  return r;
}

(double, double, double) _hexHsv(String hex) {
  final n = int.parse(hex.substring(1, 7), radix: 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  final mx = math.max(r, math.max(g, b)), d = mx - math.min(r, math.min(g, b));
  final double h = d == 0 ? 0 : mx == r ? ((g - b) / d + 6) % 6 : mx == g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h, mx != 0 ? d / mx : 0, mx / 255);
}

const _sectors = [[0, 3, 1], [2, 0, 1], [1, 0, 3], [1, 2, 0], [3, 1, 0], [0, 1, 2]];

// pairs: (عصابة، لون) لكل ما يُرسم في المباراة. from: أطلس قائم يُضاف إليه ما ليس فيه
Future<UnitAtlas> buildUnitAtlas(Iterable<(String, String)> pairs, [UnitAtlas? from]) async {
  final list = <(String, String)>[];
  for (final p in pairs) { if (!list.contains(p) && sheetInfo(p.$1) != null && from?.at(p.$1, p.$2) == null) list.add(p); }
  final src = <String, (Uint8List, int, int)>{};
  for (final (gang, _) in list) {
    src[gang] ??= await _load(sheetInfo(gang)!.s('src'));
  }
  final colY = from != null ? [...from.colY] : List.filled(_cols, _white), spot = <(int, int)>[];
  for (final (gang, _) in list) {
    var c = 0;
    for (var k = 1; k < _cols; k++) { if (colY[k] < colY[c]) c = k; }
    spot.add((c * _col, colY[c]));
    colY[c] += sheetInfo(gang)!.i('h') + 2;
  }
  const width = _col * _cols;
  final height = colY.reduce(math.max);
  final out = Uint8List(width * height * 4);
  if (from != null) {
    out.setRange(0, from.pixels.length, from.pixels);
  } else {
    for (var y = 0; y < _white; y++) {
      for (var x = 0; x < 4; x++) { out.fillRange((y * width + x) * 4, (y * width + x) * 4 + 4, 255); }
    }
  }
  final sheets = <String, (double, double)>{...?from?.sheets};
  for (var n = 0; n < list.length; n++) {
    final (gang, color) = list[n];
    final (ox, oy) = spot[n];
    final g = sheetInfo(gang)!, h = g.i('h');
    final (px, w, _) = src[gang]!;
    final (hue, sat, val) = _hexHsv(color);
    final ks = sat / g.d('sat'), kv = val / g.d('val'), f = hue % 1, order = _sectors[hue.floor() % 6];
    final vpqt = [0.0, 0.0, 0.0, 0.0];
    final half = w * h * 4;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        final i = (y * w + x) * 4, o = ((oy + y) * width + ox + x) * 4;
        double r = px[i].toDouble(), gg = px[i + 1].toDouble(), b = px[i + 2].toDouble();
        final a = px[i + 3];
        final m = px[i + half + 3] / 255;
        if (m > 0) {
          final mx = math.max(r, math.max(gg, b)), mn = math.min(r, math.min(gg, b));
          final s = math.min(1.0, (mx != 0 ? (mx - mn) / mx : 0) * ks), v = math.min(255.0, mx * kv);
          vpqt[0] = v; vpqt[1] = v * (1 - s); vpqt[2] = v * (1 - s * f); vpqt[3] = v * (1 - s * (1 - f));
          r += (vpqt[order[0]] - r) * m; gg += (vpqt[order[1]] - gg) * m; b += (vpqt[order[2]] - b) * m;
        }
        // مضروبة في الشفافية (كما تتوقعها صور المحرك)
        out[o] = (r * a / 255).round(); out[o + 1] = (gg * a / 255).round(); out[o + 2] = (b * a / 255).round(); out[o + 3] = a;
      }
    }
    sheets['$gang|$color'] = (ox.toDouble(), oy.toDouble());
  }
  final done = Completer<ui.Image>();
  ui.decodeImageFromPixels(out, width, height, ui.PixelFormat.rgba8888, done.complete);
  return UnitAtlas(await done.future, sheets, out, colY);
}
