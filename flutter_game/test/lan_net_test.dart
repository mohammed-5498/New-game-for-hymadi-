// اللعب المحلي على اتصالات حقيقية (net/session.dart) داخل هذا الجهاز: المضيف يجيب سؤال البحث، ويرحّب بالنسخة نفسها
// ويرفض غيرها، ويرسل الغرفة والمباراة والأدوار، والمنضم الآخر (اتصال خام هنا) يحاكيها فتتطابق البصمات.
// ثم العكس: الجلسة منضمة إلى مضيف خام
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gangcity/core/fmath.dart';
import 'package:gangcity/data/js_config.dart';
import 'package:gangcity/game/match.dart';
import 'package:gangcity/game/save.dart';
import 'package:gangcity/game/state.dart';
import 'package:gangcity/net/lockstep.dart';
import 'package:gangcity/net/session.dart';

class _Raw {
  final Socket s;
  final lines = <Map<String, Object?>>[];
  _Raw(this.s) {
    utf8.decoder.bind(s).transform(const LineSplitter()).listen((l) {
      try { lines.add((jsonDecode(l) as Map).cast<String, Object?>()); } catch (_) {}
    });
  }
  void send(Map<String, Object?> m) => s.write('${jsonEncode(m)}\n');
  Future<Map<String, Object?>> next(String t) async {
    for (var k = 0; k < 200; k++) {
      final i = lines.indexWhere((m) => m['t'] == t);
      if (i >= 0) return lines.removeAt(i);
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
    throw StateError('لم تصل $t');
  }
}

Map<String, Object?> _settings() => {
  'mode': 'conquest', 'city': 'arab', 'mapSize': 'small', 'maxUnits': 50, 'weather': 'day',
  'players': [
    {'name': 'مضيف', 'gang': 'crows', 'nation': null, 'color': 'red', 'isHuman': true, 'team': 0, 'difficulty': 'medium'},
    {'name': 'صديق', 'gang': 'vipers', 'nation': null, 'color': 'blue', 'isHuman': true, 'team': 0, 'difficulty': 'medium'},
    {'name': 'بوت', 'gang': 'hammers', 'nation': null, 'color': 'green', 'isHuman': false, 'team': 0, 'difficulty': 'medium'},
  ],
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final port = NET['port'] as int;

  test('المضيف: البحث والترحيب والرفض والغرفة والمباراة', () async {
    addTearDown(Lan.leave);
    await Lan.hostLan('مضيف');
    // سؤال البحث: سطر الإعلان ثم يُغلق
    final probe = await Socket.connect('127.0.0.1', port);
    probe.write('GANGCITY?\n');
    final reply = await utf8.decoder.bind(probe).transform(const LineSplitter()).first;
    expect(reply, 'GANGCITY|${NET['version']}|$port|مضيف');
    // نسخة أخرى تُرفض
    final old = _Raw(await Socket.connect('127.0.0.1', port))..send({'t': 'hello', 'v': 0, 'mv': saveVersion, 'name': 'قديم'});
    expect((await old.next('reject'))['reason'], contains('نسخة'));
    // الصديق يُرحَّب به ويصله وصف الغرفة
    final raw = _Raw(await Socket.connect('127.0.0.1', port))..send({'t': 'hello', 'v': NET['version'], 'mv': saveVersion, 'name': 'صديق', 'side': 'arab'});
    final welcome = await raw.next('welcome');
    expect(welcome['host'], 'مضيف');
    expect(Lan.helloPeers.single.side, 'arab');
    Lan.broadcastLobby({'mode': 'conquest', 'players': []});
    expect((await raw.next('lobby'))['mode'], 'conquest');

    simRng = Rng(77);
    final s = createMatch(_settings())..seed = 77;
    final host = Lan.startHost(s, [null, welcome['id'] as int, null])..running = true..viewW = 900..viewH = 420;
    final start = await raw.next('start');
    expect(start['you'], 1);
    final client = Lockstep(false, 1, (_, m) => raw.send(m), loadLan(start['s'] as String, you: 1)..lanRole = 'client');
    client.state..running = true..viewW = 900..viewH = 420;
    // 600 تحديث: المضيف يتقدم، والمنضم يحاكي ما يصله ويرسل أوامره وبصماته
    final hashes = <int, int>{}, theirs = <int, int>{};
    var moved = false;
    for (var f = 0; f < 600; f++) {
      Lan.frame(0.05);
      if (host.netTick % 20 == 0) hashes[host.netTick] = hashState(host);
      if (f > 100 && f < 160) moved |= host.units.any((u) => u.playerId == 1 && u.state == 'moving');
      await Future<void>.delayed(Duration.zero);
      for (final m in [...raw.lines]) { client.receive(m, 0); }
      raw.lines.clear();
      if (f == 100) {
        final mine = [for (final u in client.state.units) if (u.playerId == 1) u.id];
        client.command({'k': 'move', 'u': mine, 'i': client.state.map.n ~/ 2, 'j': client.state.map.n ~/ 2});
      }
      client.step(0.05);
      if (client.state.netTick % 20 == 0) theirs[client.state.netTick] = hashState(client.state);
      await Future<void>.delayed(Duration.zero);
    }
    await Future<void>.delayed(const Duration(milliseconds: 100));
    for (var k = 0; k < 10; k++) { Lan.frame(0.05); await Future<void>.delayed(Duration.zero); }
    expect(Lan.L!.resyncs, 0);
    final common = theirs.keys.where(hashes.containsKey).toList();
    expect(common.length, greaterThan(20));
    for (final t in common) { expect(theirs[t], hashes[t], reason: 'التحديث $t'); }
    expect(moved, isTrue, reason: 'أمر المنضم وصل ونُفذ عند المضيف');
    // المنضم يغادر: يقوده بوت عند المضيف
    raw.s.destroy();
    for (var k = 0; k < 20; k++) { await Future<void>.delayed(const Duration(milliseconds: 10)); Lan.frame(0.05); }
    expect(Lan.L!.state.players[1].isHuman, isFalse);
    Lan.leave();
    old.s.destroy();
  });

  test('المنضم: الانضمام والغرفة والمباراة من مضيف', () async {
    addTearDown(Lan.leave);
    final server = await ServerSocket.bind(InternetAddress.loopbackIPv4, port);
    final got = Completer<_Raw>();
    server.listen((s) => got.complete(_Raw(s)));
    final events = <String>[];
    final sub = Lan.events.listen(events.add);
    final joined = Lan.join('127.0.0.1', port, 'صديق', 'random');
    final host = await got.future;
    final hello = await host.next('hello');
    expect(hello['name'], 'صديق');
    host.send({'t': 'welcome', 'id': 1, 'host': 'مضيف'});
    expect(await joined, 'مضيف');
    host.send({'t': 'lobby', 'mode': 'king', 'players': []});
    simRng = Rng(5);
    final s = createMatch(_settings())..seed = 5;
    prepareLanMatch(s);
    s.netRng = simRng;
    host.send({'t': 'start', 'you': 1, 's': encodeMatch(s)});
    for (var k = 0; k < 50 && Lan.L == null; k++) { await Future<void>.delayed(const Duration(milliseconds: 10)); }
    expect(Lan.lobby?['mode'], 'king');
    expect(events, contains('start'));
    expect(Lan.L!.state.humanId, 1);
    for (var n = 3; n < 23; n++) { host.send({'t': 'turn', 'n': n, 'c': []}); }
    await Future<void>.delayed(const Duration(milliseconds: 50));
    for (var k = 0; k < 30; k++) { Lan.frame(0.05); }
    expect(Lan.L!.state.netTick, 23);
    expect((await host.next('hash'))['n'], 20);
    host.s.destroy();
    for (var k = 0; k < 20 && !events.contains('left'); k++) { await Future<void>.delayed(const Duration(milliseconds: 10)); }
    expect(events, contains('left'));
    expect(Lan.role, isNull);
    await sub.cancel();
    await server.close();
  });
}
