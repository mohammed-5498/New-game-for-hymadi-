// اللعب المحلي (net/lockstep.dart): مضيف ومنضمان في عملية واحدة، والرسائل بينهم JSON كما على الشبكة. الأوامر
// من الثلاثة (حركة وهجوم وإنتاج) وكاميراتهم تتحرك، وأحدهم يتأخر ويلحق، ثم يغادر فيقود جيشه بوت.
// البصمات تتطابق كل NET.hashTicks بلا إعادة مزامنة، وإعادة المزامنة المتعمدة تعيدهم إلى البصمة نفسها
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/save.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/net/lockstep.dart';

Map<String, Object?> _wire(Map<String, Object?> m) => (jsonDecode(jsonEncode(m)) as Map).cast<String, Object?>();

void main() {
  for (final (mode, city) in [('conquest', 'hk'), ('points', 'arab'), ('king', 'europe')]) {
    test('$mode في $city: ثلاثة أجهزة متطابقة', () {
      simRng = Rng(4242);
      final settings = {
        'mode': mode, 'modeOptions': {'minutes': 5, 'holdMinutes': 2}, 'city': city, 'mapSize': 'small', 'maxUnits': 50, 'weather': 'day',
        'players': [
          {'name': 'مضيف', 'gang': 'crows', 'nation': null, 'color': 'red', 'isHuman': true, 'team': 0, 'difficulty': 'medium'},
          {'name': 'صديق', 'gang': 'hammers', 'nation': null, 'color': 'blue', 'isHuman': true, 'team': 0, 'difficulty': 'medium'},
          {'name': 'آخر', 'gang': 'vipers', 'nation': null, 'color': 'green', 'isHuman': true, 'team': 0, 'difficulty': 'medium'},
          {'name': 'بوت', 'gang': 'scorpions', 'nation': null, 'color': 'yellow', 'isHuman': false, 'team': 0, 'difficulty': 'hard'},
        ],
      };
      final s = createMatch(jsonDecode(jsonEncode(settings)) as Map<String, Object?>)..seed = 4242;
      prepareLanMatch(s);
      s.netRng = simRng;
      final text = encodeMatch(s);
      final toHost = <(int, Map<String, Object?>)>[], toClient = [<Map<String, Object?>>[], <Map<String, Object?>>[]];
      final host = Lockstep(true, 0, (to, m) {
        for (var k = 0; k < 2; k++) { if (to < 0 || to == k + 1) toClient[k].add(_wire(m)); }
      }, loadLan(text, you: 0)..lanRole = 'host');
      final clients = [
        for (var k = 0; k < 2; k++) Lockstep(false, k + 1, (_, m) => toHost.add((k + 1, _wire(m))), loadLan(text, you: k + 1)..lanRole = 'client'),
      ];
      for (final l in [host, ...clients]) { l.state..running = true..viewW = 900..viewH = 420; }
      expect(hashState(host.state), hashState(clients[0].state));

      final seen = <int, Map<int, int>>{};   // التحديث ← بصمة كل جهاز
      void note(Lockstep l, int who) {
        if (l.state.netTick % 20 == 0) (seen[l.state.netTick] ??= {})[who] = hashState(l.state);
      }
      // أوامر كل جهاز: حركة جنوده نحو حي، وهجوم أقرب عدو، وإنتاج في قاعدته، وتحريك كاميرته
      void act(Lockstep l, int frame) {
        final st = l.state, me = st.humanId;
        if (!st.players[me].isHuman) return;
        final mine = [for (final u in st.units) if (u.playerId == me && u.state != 'dead') u];
        if (frame % 37 == me * 5 && mine.isNotEmpty) {
          final d = st.map.districts[(frame ~/ 37 + me) % st.map.districts.length].capture;
          if (d != null) l.command({'k': frame % 74 == me * 5 ? 'amove' : 'move', 'u': [for (final u in mine) u.id], 'i': d.i, 'j': d.j});
        }
        if (frame % 53 == 11 && mine.isNotEmpty) {
          final foe = st.units.where((u) => u.playerId != me && u.state != 'dead' && !st.players[u.playerId].neutral).firstOrNull;
          if (foe != null) l.command({'k': 'attack', 'u': [mine.first.id], 't': foe.id});
        }
        if (frame % 61 == 7) {
          final hq = st.map.districts.where((d) => d.owner == me && d.building == 'hq').firstOrNull;
          if (hq != null) l.command({'k': 'emp', 'a': 'queue', 'd': hq.id, 'x': 'common'});
        }
        st.camera.x += (frame % 9 - 4) * 3;
        l.sendCamera(frame * 0.05);
      }

      const frames = 2400;
      for (var f = 0; f < frames && host.state.matchResult == null; f++) {
        act(host, f);
        host.step(0.05);
        note(host, 0);
        for (var k = 0; k < 2; k++) {
          // المنضم الثاني يتأخر: رسائله تصله دفعة كل ثانيتين في أول دقيقة، فيلحق بعدها
          final lag = k == 1 && f < 1200 && f % 40 != 0;
          if (!lag) {
            for (final m in toClient[k]) { clients[k].receive(m, 0); }
            toClient[k].clear();
          }
          act(clients[k], f);
          clients[k].step(0.05);
          note(clients[k], k + 1);
        }
        for (final (from, m) in toHost) { host.receive(m, from); }
        toHost.clear();
        if (f == 1800) clients[1].send(0, {'t': 'cmd', 'c': {'k': 'leave'}});   // لا يصدّقه المضيف من المرسل
        if (f == 1900) host.playerLeft(2);
      }
      expect(host.resyncs, 0, reason: 'لا إعادة مزامنة');
      expect(host.state.players[2].isHuman, false, reason: 'غادر فقاده بوت');
      var compared = 0;
      seen.forEach((tick, by) {
        if (by.length < 3) return;
        compared++;
        expect(by[1], by[0], reason: 'المنضم الأول عند $tick');
        expect(by[2], by[0], reason: 'المنضم الثاني عند $tick');
      });
      expect(compared, greaterThan(60));
      expect(host.state.units.length, greaterThan(10));

      // إعادة المزامنة: المضيف يرسل مباراته فيعود الجميع إلى بصمته
      clients[0].state.units.first.x += 0.5;
      host.resyncAll();
      for (var k = 0; k < 2; k++) {
        for (final m in toClient[k]) { clients[k].receive(m, 0); }
        toClient[k].clear();
        expect(hashState(clients[k].state), hashState(host.state));
        expect(clients[k].state.humanId, k + 1);
      }
    }, timeout: const Timeout(Duration(minutes: 5)));
  }
}
