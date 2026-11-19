// كلفة المحاكاة بأقسامها في المعركة الكبيرة (للفحص فقط: flutter test --tags perf test/sim_profile_test.dart)
@Tags(['perf'])
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/ai/bot.dart';
import 'package:gangcity/audio/sound.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/game/abilities.dart';
import 'package:gangcity/game/alerts.dart';
import 'package:gangcity/game/capture.dart';
import 'package:gangcity/game/combat.dart';
import 'package:gangcity/game/features.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/modes.dart';
import 'package:gangcity/game/police.dart';
import 'package:gangcity/game/spatial.dart';
import 'package:gangcity/game/spawn.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/game/story.dart';
import 'package:gangcity/game/units.dart';
import 'package:gangcity/game/victory.dart';

void main() {
  test('كلفة المحاكاة', () {
    final env = Platform.environment;
    final seed = int.parse(env['PERF_SEED'] ?? '777');
    simRng = Rng(seed);
    final s = createMatch((jsonDecode(jsonEncode({
      'mode': 'conquest', 'city': env['PERF_CITY'] ?? 'gondar', 'mapSize': env['PERF_SIZE'] ?? 'large', 'maxUnits': 100, 'weather': 'day',
      'temples': true, 'fog': env['PERF_FOG'] == '1',
      'players': [for (var k = 0; k < 4; k++) {'name': 'p$k', 'gang': ['crows', 'hammers', 'vipers', 'scorpions'][k],
        'nation': ['yemen', 'saudi', 'egypt', 'japan'][k], 'color': ['blue', 'red', 'green', 'yellow'][k], 'isHuman': k == 0, 'team': 0, 'difficulty': 'hard'}],
    })) as Map).cast<String, Object?>())..seed = seed;
    s.running = true;
    final ff = double.parse(env['PERF_FF'] ?? '600');
    for (var t = 0.0; t < ff; t += 0.05) { updateMatch(s); }
    final steps = <(String, void Function(MatchState))>[
      ('hash', buildUnitHash), ('abilities', updateAbilities), ('combat', updateCombat), ('paths', processPathQueue), ('units', updateUnits),
      ('dead', removeDeadUnits), ('capture', updateCapture), ('tints', updateDistrictTints), ('spawn', updateSpawn), ('police', updatePolice),
      ('features', updateFeatures), ('bots', updateBots), ('mode', updateMode), ('fades', updateFades), ('story', updateStory),
      ('victory', updateVictory), ('notice', updateNotice), ('alerts', updateAlerts), ('sounds', (_) => flushSounds()),
    ];
    final tot = <String, int>{}, mx = <String, int>{}, ticks = <int>[];
    final sw = Stopwatch()..start(), all = Stopwatch()..start();
    for (var k = 0; k < 1200; k++) {
      all.reset();
      s.time += 0.05;
      for (final (name, f) in steps) {
        sw.reset(); f(s);
        final e = sw.elapsedMicroseconds;
        tot[name] = (tot[name] ?? 0) + e;
        if (e > (mx[name] ?? 0)) mx[name] = e;
      }
      ticks.add(all.elapsedMicroseconds);
    }
    final o = [...ticks]..sort();
    // ignore: avoid_print
    print('units ${s.units.length} time ${s.time.toStringAsFixed(0)} tick avg ${(ticks.reduce((a, b) => a + b) / ticks.length / 1000).toStringAsFixed(2)} '
        'p95 ${(o[(o.length * .95).floor()] / 1000).toStringAsFixed(2)} p99 ${(o[(o.length * .99).floor()] / 1000).toStringAsFixed(2)} max ${(o.last / 1000).toStringAsFixed(2)}');
    for (final e in (tot.entries.toList()..sort((a, b) => b.value - a.value)).take(10)) {
      // ignore: avoid_print
      print('  ${e.key.padRight(10)} avg ${(e.value / ticks.length / 1000).toStringAsFixed(3)}  max ${(mx[e.key]! / 1000).toStringAsFixed(2)} ms');
    }
  }, timeout: const Timeout(Duration(minutes: 10)));
}
