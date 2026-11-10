// اللعب المحلي (js/net/session.js وtransport.js وLanCore.java، القسم 16): الاستضافة والبحث والانضمام وغرفة الانتظار
// وبدء المباراة وأثناءها ونهايتها، والنقل نفسه بـ dart:io: خادم TCP بأسطر JSON عند المضيف، وإعلان UDP على الواي فاي،
// والبحث يسمع الإعلانات ويسأل عناوين شبكته /24 (إن منعت الشبكة البث). المضيف يرسل المباراة كلها عند البدء ثم الأدوار.
// أرقام الاتصالات: المنضمون عند المضيف من 1، والمضيف عند المنضم 0
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';

import '../core/cfg.dart';
import '../data/js_config.dart';
import '../game/save.dart';
import '../game/state.dart';
import 'lockstep.dart';

final J _net = NET;
const _tag = 'GANGCITY', _probe = 'GANGCITY?';
const _lock = MethodChannel('gangcity/lan');   // قفل البث المتعدد في أندرويد (MainActivity.kt): بعض الأجهزة لا تستقبل الإعلانات بدونه

String cleanName(Object? name) {
  final s = '${name ?? ''}'.replaceAll(RegExp(r'[\r\n|]'), ' ').trim();
  final cut = s.length > _net.i('maxNameLength') ? s.substring(0, _net.i('maxNameLength')) : s;
  return cut.isEmpty ? 'لاعب' : cut;
}

class LanPeer {
  final int id;
  final Socket socket;
  String name = '', side = 'random';
  bool hello = false;
  LanPeer(this.id, this.socket);
}

class Found { final String name, ip, version; final int port; final DateTime at; Found(this.name, this.ip, this.port, this.version, this.at); }

// الجلسة واحدة في التطبيق كله. الشاشات تستمع إلى events: lobby | found | start | left | back | resynced
class Lan {
  static String? role;                 // host | client
  static String phase = 'idle';        // search | lobby | game
  static String name = '', hostName = '';
  static List<String> ips = [];
  static final peers = <int, LanPeer>{};      // المضيف: المتصلون
  static final slotOf = <int, int>{};         // المضيف أثناء المباراة: رقم الاتصال ← رقم اللاعب
  static Map<String, Object?>? lobby;         // المنضم: آخر وصف للغرفة
  static int? myId;                           // المنضم: رقم اتصاله عند المضيف
  static final found = <String, Found>{};
  static Lockstep? L;
  static bool hostPaused = false;
  static DateTime? waitingSince;
  static String leftReason = '';
  static bool leftInGame = false;
  static final _events = StreamController<String>.broadcast();
  static Stream<String> get events => _events.stream;
  static bool Function() canSeat = () => true;

  static ServerSocket? _server;
  static RawDatagramSocket? _beacon, _listen;
  static Timer? _beaconTimer, _scanTimer;
  static Socket? _host;
  static int _nextId = 1;
  static Completer<String>? _join;
  static String? _reply;             // المضيف: سطر الإعلان جواباً للسؤال

  static bool get active => phase == 'game' && L != null;
  static void _emit(String e) => _events.add(e);

  static void _reset() {
    role = null; phase = 'idle'; ips = []; peers.clear(); slotOf.clear(); found.clear();
    lobby = null; _join = null; L = null; hostPaused = false; myId = null; waitingSince = null;
  }

  // --- النقل ---
  static void _send(Socket? s, Map<String, Object?> msg) {
    if (s == null) return;
    try { s.write('${jsonEncode(msg)}\n'); } catch (_) {}
  }
  static void send(int to, Map<String, Object?> msg) {
    if (role == 'client') { _send(_host, msg); return; }
    if (to < 0) {
      final line = '${jsonEncode(msg)}\n';
      for (final p in peers.values) { try { p.socket.write(line); } catch (_) {} }
    } else {
      _send(peers[to]?.socket, msg);
    }
  }

  static Map? _parse(String line) { try { final v = jsonDecode(line); return v is Map ? v : null; } catch (_) { return null; } }

  static void _lines(Socket s, void Function(String) onLine, void Function() onDone) {
    utf8.decoder.bind(s).transform(const LineSplitter()).listen(onLine, onDone: onDone, onError: (_) => onDone(), cancelOnError: true);
  }

  static Future<List<NetworkInterface>> _wifi() async {
    try {
      final list = await NetworkInterface.list(type: InternetAddressType.IPv4);
      // بيانات الجوال والشبكات الافتراضية خارج البحث (rmnet وccmni وtun)
      return [for (final n in list) if (!RegExp(r'^(rmnet|ccmni|tun|pdp|dummy)').hasMatch(n.name)) n];
    } catch (_) { return []; }
  }

  static bool _local(String ip) {
    final p = ip.split('.').map(int.tryParse).toList();
    if (p.length != 4 || p.contains(null)) return false;
    return p[0] == 10 || (p[0] == 172 && p[1]! >= 16 && p[1]! < 32) || (p[0] == 192 && p[1] == 168);
  }

  static void _wakeLock(bool on) { _lock.invokeMethod(on ? 'lock' : 'unlock').catchError((_) => null); }

  static void _stopAll() {
    _beaconTimer?.cancel(); _beaconTimer = null;
    _scanTimer?.cancel(); _scanTimer = null;
    _beacon?.close(); _beacon = null;
    _listen?.close(); _listen = null;
    _server?.close(); _server = null;
    _reply = null;
    for (final p in peers.values) { p.socket.destroy(); }
    _host?.destroy(); _host = null;
    _wakeLock(false);
  }

  // --- المضيف ---
  static Future<List<String>> hostLan(String myName) async {
    if (role != null) leave();
    name = cleanName(myName);
    role = 'host';
    phase = 'lobby';
    try {
      for (var port = _net.i('port'); port < _net.i('port') + 10 && _server == null; port++) {
        try { _server = await ServerSocket.bind(InternetAddress.anyIPv4, port, shared: false); } catch (_) {}
      }
      if (_server == null) throw const SocketException('لا منفذ متاح');
      _server!.listen(_accept);
      final port = _server!.port;
      _reply = '$_tag|${_net.i('version')}|$port|$name';
      _beacon = await RawDatagramSocket.bind(InternetAddress.anyIPv4, 0)..broadcastEnabled = true;
      final nets = await _wifi();
      ips = [for (final n in nets) for (final a in n.addresses) if (!a.isLoopback) a.address];
      final targets = {'255.255.255.255', for (final ip in ips) if (_local(ip)) '${ip.substring(0, ip.lastIndexOf('.'))}.255'};
      final data = utf8.encode(_reply!);
      void beacon() { for (final t in targets) { try { _beacon?.send(data, InternetAddress(t), _net.i('beaconPort')); } catch (_) {} } }
      beacon();
      _beaconTimer = Timer.periodic(Duration(milliseconds: (_net.d('beaconSeconds') * 1000).round()), (_) => beacon());
      _wakeLock(true);
      return ips;
    } catch (e) {
      _stopAll();
      _reset();
      throw Exception('تعذرت الاستضافة: تأكد أنك متصل بالواي فاي أو فتحت نقطة اتصال');
    }
  }

  // اتصال وارد: أول سطر سؤال البحث (يُجاب ويُغلق) أو أول رسالة لاعب. والصامت 5 ث ليس من اللعبة
  static void _accept(Socket s) {
    try { s.setOption(SocketOption.tcpNoDelay, true); } catch (_) {}
    LanPeer? peer;
    final silent = Timer(const Duration(seconds: 5), () { if (peer == null) s.destroy(); });
    var first = true;
    _lines(s, (line) {
      if (first) {
        first = false;
        silent.cancel();
        if (line == _probe) {
          if (_reply != null) s.write('$_reply\n');
          s.flush().whenComplete(s.destroy);
          return;
        }
        peer = LanPeer(_nextId++, s);
        peers[peer!.id] = peer!;
      }
      final msg = line.isEmpty ? null : _parse(line);
      if (msg != null && peer != null) _hostMessage(peer!, msg);
    }, () {
      silent.cancel();
      final p = peer;
      if (p == null || peers[p.id] != p) return;
      peers.remove(p.id);
      final k = slotOf.remove(p.id);
      if (phase == 'game' && L != null && k != null) L!.playerLeft(k);
      _emit('lobby');
    });
  }

  static void _hostMessage(LanPeer peer, Map msg) {
    if (msg['t'] == 'hello') {
      final reason = msg['v'] != _net.i('version') || msg['mv'] != saveVersion ? 'نسخة اللعبة مختلفة عند المضيف: ثبّتوا نفس الملف على كل الأجهزة'
          : phase != 'lobby' ? 'المباراة بدأت، انتظر حتى تنتهي'
          : !canSeat() ? 'الغرفة ممتلئة' : null;
      if (reason != null) {
        _send(peer.socket, {'t': 'reject', 'reason': reason});
        Future<void>.delayed(const Duration(milliseconds: 400), () => closePeer(peer.id));
        return;
      }
      peer..name = cleanName(msg['name'])..side = msg['side'] is String ? msg['side'] as String : 'random'..hello = true;
      _send(peer.socket, {'t': 'welcome', 'id': peer.id, 'host': name});
      _emit('lobby');
    } else if (msg['t'] == 'side' && msg['side'] is String) {
      peer.side = msg['side'] as String;
      _emit('lobby');
    } else if (msg['t'] == 'bye') {
      closePeer(peer.id);
    } else if (phase == 'game' && L != null && slotOf.containsKey(peer.id)) {
      L!.receive(msg, slotOf[peer.id]!);
    }
  }

  static void closePeer(int id) {
    final p = peers.remove(id);
    if (p == null) return;
    p.socket.destroy();
    final k = slotOf.remove(id);
    if (phase == 'game' && L != null && k != null) L!.playerLeft(k);
    _emit('lobby');
  }

  static List<LanPeer> get helloPeers => [for (final p in peers.values) if (p.hello) p];

  static void broadcastLobby(Map<String, Object?> view) { if (role == 'host' && phase == 'lobby') send(all, {'t': 'lobby', ...view}); }

  // بدء المباراة عند المضيف: s من createMatch، وpeerOfPlayer[k] رقم اتصال صاحب اللاعب k أو null. يعيد مباراة المضيف
  static MatchState startHost(MatchState s, List<int?> peerOfPlayer) {
    prepareLanMatch(s);
    s.netRng = simRng;
    final text = encodeMatch(s);
    final mine = loadLan(text, you: 0)..lanRole = 'host';   // المضيف يبدأ من الحالة المفكوكة حرفياً، كالمنضمين
    slotOf.clear();
    for (var k = 0; k < peerOfPlayer.length; k++) {
      final id = peerOfPlayer[k];
      if (id == null || !peers.containsKey(id)) continue;
      slotOf[id] = k;
      _send(peers[id]!.socket, {'t': 'start', 'you': k, 's': text});
    }
    L = Lockstep(true, 0, send, mine)..onResync = (_) => _emit('resynced');
    phase = 'game';
    return mine;
  }

  // المضيف أوقف المباراة أو استأنفها (اللافتة عند المنضمين، والتوقف نفسه لأن الأدوار لا تصل)
  static void pause(bool on) { if (role == 'host') send(all, {'t': 'pause', 'on': on}); }

  // بعد النهاية: المضيف يعود بالجميع إلى الغرفة لمباراة جديدة
  static void backToLobby() {
    if (role != 'host') return;
    phase = 'lobby';
    L = null;
    slotOf.clear();
    send(all, {'t': 'back'});
    _emit('lobby');
  }

  // --- المنضم ---
  static Future<void> search() async {
    if (role != null) leave();
    role = 'client';
    phase = 'search';
    _wakeLock(true);
    try {
      _listen = await RawDatagramSocket.bind(InternetAddress.anyIPv4, _net.i('beaconPort'), reuseAddress: true);
      _listen!.broadcastEnabled = true;
      _listen!.listen((ev) {
        if (ev != RawSocketEvent.read) return;
        final dg = _listen?.receive();
        if (dg != null) _beaconLine(utf8.decode(dg.data, allowMalformed: true), dg.address.address);
      });
    } catch (_) {
      _emit('found');                // البحث بالبث لا يعمل هنا: السؤال وكتابة العنوان باليد يبقيان
    }
    void scan() => _scan();
    scan();
    _scanTimer = Timer.periodic(Duration(milliseconds: (_net.d('scanSeconds') * 1000).round()), (_) => scan());
  }

  static void _beaconLine(String text, String ip) {
    final parts = text.trim().split('|');
    if (parts.length < 4 || parts[0] != _tag || role != 'client' || phase != 'search') return;
    final port = int.tryParse(parts[2]);
    if (port == null) return;
    found[ip] = Found(cleanName(parts.sublist(3).join('|')), ip, port, parts[1], DateTime.now());
    _emit('found');
  }

  static bool _scanning = false;
  // يسأل عناوين /24 حول عناوين هذا الجهاز على منفذ المضيف، 32 معاً
  static Future<void> _scan() async {
    if (_scanning || phase != 'search') return;
    _scanning = true;
    try {
      final mine = {for (final n in await _wifi()) for (final a in n.addresses) if (_local(a.address)) a.address};
      final targets = <String>{
        for (final ip in mine)
          for (var h = 1; h < 255; h++) '${ip.substring(0, ip.lastIndexOf('.'))}.$h',
      }..removeAll(mine);
      final list = targets.toList();
      for (var k = 0; k < list.length && phase == 'search'; k += 32) {
        await Future.wait([for (final ip in list.skip(k).take(32)) _ask(ip)]);
      }
    } finally {
      _scanning = false;
    }
  }

  static Future<void> _ask(String ip) async {
    final ms = _net.i('probeMs');
    try {
      final s = await Socket.connect(ip, _net.i('port'), timeout: Duration(milliseconds: ms));
      s.write('$_probe\n');
      final line = await utf8.decoder.bind(s).transform(const LineSplitter()).first.timeout(Duration(milliseconds: ms * 3));
      s.destroy();
      _beaconLine(line, ip);
    } catch (_) {}
  }

  static Future<String> join(String ip, int port, String myName, String side) async {
    if (role != 'client') await search();
    name = cleanName(myName);
    _scanTimer?.cancel();
    _listen?.close(); _listen = null;
    final Socket s;
    try {
      s = await Socket.connect(ip.trim(), port, timeout: const Duration(seconds: 4));
    } catch (_) {
      throw Exception('تعذر الاتصال بـ $ip: تأكد من العنوان، وأن المضيف في قائمة الإعداد، وأنكما على نفس الشبكة');
    }
    try { s.setOption(SocketOption.tcpNoDelay, true); } catch (_) {}
    _host = s;
    final join = _join = Completer<String>();
    _lines(s, (line) {
      final msg = line.isEmpty ? null : _parse(line);
      if (msg != null) _clientMessage(msg);
    }, () {
      if (_host != s) return;
      final inGame = phase == 'game', pending = _join;
      _stopAll();
      _reset();
      if (pending != null && !pending.isCompleted) {
        pending.completeError(Exception('أغلق المضيف الاتصال'));
      } else {
        leftReason = 'انقطع الاتصال بالمضيف';
        leftInGame = inGame;
        _emit('left');
      }
    });
    send(0, {'t': 'hello', 'v': _net.i('version'), 'mv': saveVersion, 'name': name, 'side': side});
    return join.future.timeout(const Duration(seconds: 6), onTimeout: () {
      leave();
      throw Exception('لا رد من المضيف');
    });
  }

  static void _clientMessage(Map msg) {
    final t = msg['t'];
    if (t == 'welcome') {
      phase = 'lobby';
      hostName = cleanName(msg['host']);
      myId = msg['id'] as int?;
      final j = _join;
      _join = null;
      if (j != null && !j.isCompleted) j.complete(hostName);
    } else if (t == 'reject') {
      final j = _join;
      leave();
      if (j != null && !j.isCompleted) j.completeError(Exception('${msg['reason'] ?? 'رفض المضيف'}'));
    } else if (t == 'lobby') {
      lobby = msg.cast<String, Object?>();
      _emit('lobby');
    } else if (t == 'start' && msg['s'] is String && msg['you'] is int) {
      final MatchState s;
      try {
        s = loadLan(msg['s'] as String, you: msg['you'] as int)..lanRole = 'client';
      } catch (e) {
        leave();
        leftReason = 'تعذر استلام المباراة';
        leftInGame = false;
        _emit('left');
        return;
      }
      L = Lockstep(false, msg['you'] as int, send, s)..onResync = (_) => _emit('resynced');
      hostPaused = false;
      waitingSince = null;
      phase = 'game';
      _emit('start');
    } else if (t == 'pause') {
      hostPaused = msg['on'] == true;
    } else if (t == 'back') {
      phase = 'lobby';
      L = null;
      hostPaused = false;
      _emit('back');
    } else if (L != null) {
      L!.receive(msg, 0);
    }
  }

  static void setSide(String side) { if (role == 'client') send(0, {'t': 'side', 'side': side}); }

  // مغادرة الجلسة (المنضم يودّع المضيف، والمضيف يغلق الكل)
  static void leave() {
    if (role == 'client' && _host != null) {
      final h = _host!;
      _host = null;               // الإغلاق المقصود لا يُعلن انقطاعاً
      _send(h, {'t': 'bye'});
      h.flush().whenComplete(h.destroy).catchError((_) => null);
    }
    _stopAll();
    _reset();
  }

  // --- أثناء المباراة ---
  static void command(Map<String, Object?> cmd) => L?.command(cmd);

  // إطار واحد: موضع الكاميرا ثم التحديثات. يعيد كسر التحديث للرسم
  static double frame(double dt) {
    final l = L!;
    l.sendCamera(DateTime.now().millisecondsSinceEpoch / 1000);
    final before = l.state.netTick;
    final alpha = l.step(dt);
    if (role == 'client') {
      if (l.state.netTick != before || l.state.matchResult != null) {
        waitingSince = null;
      } else {
        waitingSince ??= DateTime.now();
      }
    }
    return alpha;
  }

  // سطر قصير للافتة أعلى الشاشة أثناء المباراة، أو null
  static String? status() {
    if (phase != 'game') return null;
    if (role == 'client' && hostPaused) return 'أوقف المضيف المباراة';
    final w = waitingSince;
    if (role == 'client' && w != null && DateTime.now().difference(w).inMilliseconds > 1500) return 'بانتظار المضيف…';
    return null;
  }
}
