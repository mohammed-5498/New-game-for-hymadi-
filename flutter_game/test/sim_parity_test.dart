// المحاكاة المنقولة تخرج المباراة نفسها بالبذرة نفسها: بصمات sim_parity.json من js/ (scripts/export_sim_parity.mjs)،
// مباريات بوتات (صعب ضد متوسط، 2 لكل جانب) بلا مزايا المدن، والبصمة كل ثانية في أول دقيقتين ثم كل 20 ثانية
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/state.dart';

int _i32(int v) => ((v & 0xFFFFFFFF) ^ 0x80000000) - 0x80000000;

int hashOf(MatchState state) {
  var h = 2166136261;
  void mix(double v) { h = ((h ^ (_i32(jsRound(v * 1000)) & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF; }
  mix(state.units.length.toDouble());
  for (final u in state.units) {
    mix(u.id.toDouble()); mix(u.x); mix(u.y); mix(u.hp); mix(u.state.length.toDouble()); mix(u.playerId.toDouble());
  }
  for (final d in state.map.districts) { mix((d.owner ?? -1).toDouble()); mix(d.progress); }
  for (final p in state.empire?.points ?? const <double>[]) { mix(p); }
  return h;
}

void main() {
  final cases = (jsonDecode(File('test/sim_parity.json').readAsStringSync()) as List).cast<Map<String, dynamic>>();
  for (final c in cases.where((c) => c['settings'] != null)) {
    final settings = (c['settings'] as Map).cast<String, Object?>();
    test('${settings['mode']} (${c['city']})${c['full'] == true ? '، تفصيل كامل' : ''}', () {
      simRng = Rng(c['seed'] as int);
      final state = createMatch(jsonDecode(jsonEncode(settings)) as Map<String, Object?>);
      state.running = true;
      if (c['full'] == true) { state.viewW = 1e6; state.viewH = 1e6; }
      expect(state.map.city, c['city']);
      final want = (c['hashes'] as List).cast<int>();
      expect(hashOf(state), want[0], reason: 'البداية');
      var ticks = 0;
      for (var k = 1; k < want.length; k++) {
        final step = ticks < 2400 ? 20 : 400;
        for (var t = 0; t < step && state.matchResult == null; t++) { updateMatch(state); }
        ticks += step;
        expect(hashOf(state), want[k], reason: 'بعد ${ticks ~/ 20} ث');
      }
      expect(state.matchResult?.reason, c['result']);
    });
  }
  for (final c in cases.where((c) => c['settings'] == null)) {
    test('${c['a']} ضد ${c['b']}، ${c['size']}${c['full'] == true ? '، تفصيل كامل' : ''} (${c['city']})', () {
      simRng = Rng(c['seed'] as int);
      final state = createBattle(a: c['a'], b: c['b'], perSide: 2, mapSize: c['size'], mirror: c['mirror'] as bool,
          teams: c['teams'] == true);
      if (c['full'] == true) { state.viewW = 1e6; state.viewH = 1e6; }
      expect(state.map.city, c['city']);
      final want = (c['hashes'] as List).cast<int>();
      expect(hashOf(state), want[0], reason: 'البداية');
      var ticks = 0;
      for (var k = 1; k < want.length; k++) {
        final step = ticks < 2400 ? 20 : 400;
        stepBattle(state, step);
        ticks += step;
        expect(hashOf(state), want[k], reason: 'بعد ${ticks ~/ 20} ث');
      }
      expect(battleWinner(state), c['winner']);
    });
  }
}
