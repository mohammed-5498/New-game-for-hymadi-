// المولّد المنقول يخرج الخريطة نفسها بالبذرة نفسها: بصمات map_parity.json من js/map/generator.js
// (scripts/export_flutter_data.mjs)، 24 مدينة × 3 أحجام × 3 بذور، بلاعبين وفرق مختلفة
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/config.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/map/generator.dart';

const _gangs = ['crows', 'hammers', 'vipers', 'scorpions'];

List<MapPlayer> playersFor(String sizeKey, int seed) {
  final count = [2, MAP_SIZES[sizeKey]!.maxPlayers, 4][seed % 3];
  return List.generate(count, (k) => MapPlayer(_gangs[k % 4], seed % 2 == 1 ? (k % 2) + 1 : 0));
}

// نص الخريطة الكامل بترتيب ثابت، كـ canon في scripts/export_flutter_data.mjs
String canon(GameMap map, List<MapPlayer> players) {
  final parts = <String>['${map.n}', '${map.land}', '${map.seed}', map.city];
  parts.add(String.fromCharCodes(map.type));
  parts.add(map.road.join(''));
  parts.add(map.dash.join(''));
  parts.add(map.region.join(','));
  parts.add(map.kind.map((k) => k ?? '').join(','));
  parts.add((map.decor.keys.toList()..sort()).map((k) => '$k${map.decor[k]}').join(','));
  parts.add(map.districtAt.join(','));
  parts.add(map.connected!.join(''));
  for (final d in map.districts) {
    parts.add([d.id, d.tiles.map((t) => '${t.$1}:${t.$2}').join(' '), d.region, d.capturable ? 1 : 0,
      d.capture != null ? '${d.capture!.i}:${d.capture!.j}' : '-', d.isHome ? 1 : 0, d.special ?? '-', d.feature ?? '-',
      d.police ? 1 : 0, d.policeMain ? 1 : 0, d.featureTile ?? '-', d.featureBig ? 1 : 0, d.owner ?? '-'].join('|'));
  }
  parts.add(players.map((p) => p.homeDistrictId).join(','));
  return parts.join('\n');
}

String fnv(String s) {
  var h = 0x811c9dc5;
  for (final c in s.codeUnits) { h = ((h ^ c) * 0x01000193) & 0xFFFFFFFF; }
  return h.toRadixString(16).padLeft(8, '0');
}

void main() {
  test('fmath: hypot و jsRound كـ JavaScript', () {
    expect(jsRound(2.5), 3);
    expect(jsRound(-2.5), -2);
    expect(jsRound(0.49999999999999994), 0);
    expect(hypot(3, 4), 5);
  });

  test('fsin وfcos وfatan2 مطابقة لـ V8 بالبت', () {
    final rows = (jsonDecode(File('test/fmath_parity.json').readAsStringSync()) as List).cast<List<dynamic>>();
    final b = ByteData(8);
    double f(String hex) {
      b.setUint32(0, int.parse(hex.substring(0, 8), radix: 16));
      b.setUint32(4, int.parse(hex.substring(8), radix: 16));
      return b.getFloat64(0);
    }
    var bad = 0;
    for (final r in rows) {
      final x = f(r[0]);
      if (fsin(x) != f(r[1]) || fcos(x) != f(r[2]) || fatan2(f(r[3]), x) != f(r[4])) bad++;
    }
    expect(bad, 0);
  });

  final cases = (jsonDecode(File('test/map_parity.json').readAsStringSync()) as List).cast<Map<String, dynamic>>();
  test('الخرائط مطابقة للمولّد الحالي (${cases.length} خريطة)', () {
    final bad = <String>[];
    for (final c in cases) {
      final city = c['city'] as String, size = c['size'] as String, seed = c['seed'] as int;
      final players = playersFor(size, seed);
      final map = createMap(size, players, city, Rng(seed), specials: false, features: true)!;
      final h = fnv(canon(map, players));
      if (h != c['hash']) bad.add('$city/$size/$seed');
    }
    expect(bad, isEmpty);
  });
}
