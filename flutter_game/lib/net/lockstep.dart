// اللعب المحلي (js/net/lockstep.js، القسم 16): المحاكاة خطوة بخطوة على كل الأجهزة (lockstep).
// كل جهاز يحاكي المباراة كلها بنفسه، والذي يسافر بينها أوامر اللاعبين وحدها. المضيف يحدد لكل أمر تحديثاً بعد
// NET.delayTicks ويرسله في "دور" ذلك التحديث، فينفذه الجميع في التحديث نفسه بالترتيب نفسه. العشوائية من مولّد
// المباراة نفسها (netRng)، ومستويات التفصيل من كاميرات كل اللاعبين (realism.dart). وكل NET.hashTicks تحديثاً يقارن
// المضيف بصمة المباراة عند الجميع، فإن اختلفت أرسل المباراة كلها (إعادة مزامنة).
// بلا Flutter: يعمل في الاختبار كما في اللعبة. send(to, msg): to رقم خانة اللاعب، أو all للجميع
import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../game/combat.dart';
import '../game/empire.dart';
import '../game/match.dart';
import '../game/modes.dart';
import '../game/save.dart';
import '../game/state.dart';
import '../game/units.dart';

const all = -1;
final J _net = NET;
typedef Send = void Function(int to, Map<String, Object?> msg);

// بصمة المباراة: ما يغيّر اللعب فقط (المواقع والدم والحالات والأحياء والمولّد ونقاط الأطوار)، لا ما يخص الشاشة
int hashState(MatchState s) {
  var h = 2166136261;
  void mix(num v) {
    final i = v.isFinite ? v.truncate() : 0;
    h = ((h ^ (i & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF;
  }
  mix((s.netRng ?? simRng).state); mix(s.nextUnitId); mix(s.units.length); mix(s.netTick);
  for (final u in s.units) { mix(u.id); mix(u.x * 1000); mix(u.y * 1000); mix(u.hp * 100); mix(u.state.length); mix(u.playerId); }
  for (final d in s.map.districts) { mix(d.owner ?? -1); mix(d.progress * 100); }
  final e = s.empire;
  if (e != null) { for (final v in [...e.points, ...e.earned]) { mix(v * 100); } }
  if (s.modeState != null) { for (final v in modeOf(s).held) { mix(v * 100); } }
  return h;
}

// مباراة جديدة عند المضيف قبل إرسالها: العدّاد وكاميرات اللاعبين عند أحيائهم
void prepareLanMatch(MatchState s) {
  s.netTick = 0;
  s.netCams = [
    for (final p in s.players)
      if (!p.isHuman) null
      else () {
        final home = p.homeDistrictId >= 0 && p.homeDistrictId < s.map.districts.length ? s.map.districts[p.homeDistrictId].capture : null;
        final i = home?.i.toDouble() ?? s.map.n / 2, j = home?.j.toDouble() ?? s.map.n / 2;
        return NetCam(jsRoundD((i - j) * TILE_HALF_W).toDouble(), jsRoundD((i + j) * TILE_HALF_H).toDouble(), CAMERA.d('startZoom'),
            _net.m('defaultView').d('w'), _net.m('defaultView').d('h'));
      }(),
  ];
}

// المباراة كما وصلت (البداية وإعادة المزامنة): مولّدها لها وحدها، وما يخص هذا الجهاز يبقى كما كان
MatchState loadLan(String text, {MatchState? keep, int? you}) {
  final s = decodeMatch(text);
  s.netRng ??= simRng;
  if (keep == null) {
    s.humanId = you ?? 0;
    centerCameraOnHome(s);
    return s;
  }
  s..humanId = keep.humanId..lanRole = keep.lanRole..running = keep.running..paused = keep.paused
    ..viewW = keep.viewW..viewH = keep.viewH..notice = keep.notice..moveMarker = keep.moveMarker;
  s.camera..x = keep.camera.x..y = keep.camera.y..z = keep.camera.z;
  final selected = {for (final u in keep.units) if (u.selected) u.id};
  for (final u in s.units) { u.selected = selected.contains(u.id) && u.playerId == s.humanId; }
  return s;
}

// --- تنفيذ الأوامر: نفس النتيجة على كل جهاز ---
double _num(Object? v, [double d = 0]) => v is num && v.isFinite ? v.toDouble() : d;

void _apply(MatchState s, Map c) {
  final p = c['p'];
  if (p is! int || p < 0 || p >= s.players.length) return;
  final player = s.players[p];
  if (c['k'] == 'cam') {
    if (s.netCams != null && player.isHuman) {
      s.netCams![p] = NetCam(_num(c['x']), _num(c['y']), _num(c['z'], 1), _num(c['w'], 1), _num(c['h'], 1));
    }
    return;
  }
  if (c['k'] == 'leave') {                     // غادر لاعب: يقود جيشه بوت من الآن
    if (!player.isHuman) return;
    player.isHuman = false;
    s.botTimers[p] = 0;
    s.netCams?[p] = null;
    s.notice = Notice('غادر ${player.name} • يقود جيشه بوت الآن', false, 4);
    return;
  }
  if (!player.isHuman) return;                 // لاعب صار بوتاً: أوامره القديمة لا تُنفذ
  if (c['k'] == 'emp') {                       // الاقتصاد: إنتاج وترقيات ومبانٍ من قائمة الحي
    if (s.economy) empireCommand(s, p, '${c['a']}', _num(c['d'], -1).round(), c['x']);
    return;
  }
  final ids = c['u'];
  if (ids is! List || ids.isEmpty) return;
  final wanted = ids.toSet();
  final units = [for (final u in s.units) if (wanted.contains(u.id) && u.playerId == p && u.state != 'dead' && u.hp > 0) u];
  if (units.isEmpty) return;
  final i = _num(c['i'], double.nan), j = _num(c['j'], double.nan);
  if (c['k'] == 'attack') {
    final t = c['t'];
    for (final target in s.units) {
      if (target.id != t) continue;
      if (target.state != 'dead' && target.hp > 0 && isEnemy(s, units[0], target)) commandAttack(s, units, target);
      return;
    }
    return;
  }
  if (i.isNaN || j.isNaN) return;
  if (c['k'] == 'move') commandMove(s, i.roundToDouble(), j.roundToDouble(), units, false);
  if (c['k'] == 'amove') commandAttackMove(s, i.roundToDouble(), j.roundToDouble(), units, false);
}

// تحديث واحد: أوامره ثم المحاكاة، والعشوائية كلها من مولّد هذه المباراة
void runTurn(MatchState s, List cmds) {
  final outer = simRng;
  simRng = s.netRng ?? simRng;
  try {
    for (final c in cmds) { if (c is Map) _apply(s, c); }
    if (s.matchResult == null) updateMatch(s);
    s.netTick++;
  } finally {
    s.netRng = simRng;
    simRng = outer;
  }
}

// --- الجلسة: المضيف أو منضم ---
class Lockstep {
  final bool host;
  final int slot;                // خانة لاعب هذا الجهاز
  final Send send;
  MatchState state;              // تُستبدل كلها عند إعادة المزامنة
  void Function(MatchState)? onResync;
  final turns = <int, List>{};   // التحديث ← أوامره
  List<Map<String, Object?>> pending = [];   // المضيف: أوامر لم تُحدد لها تحديثات
  double acc = 0;                // ثوانٍ
  final hostHashes = <int, int>{}, _peerHashes = <int, List<(int, int)>>{};
  double camAt = -1e9;
  String camSent = '';
  int resyncs = 0;

  Lockstep(this.host, this.slot, this.send, this.state) {
    for (var n = 0; n < _net.i('delayTicks'); n++) { turns[state.netTick + n] = []; }   // الأدوار الأولى بلا أوامر عند الجميع
  }

  // أمر من لاعب هذا الجهاز (من اللمس)
  void command(Map<String, Object?> cmd) {
    cmd['p'] = slot;
    if (host) { pending.add(cmd); } else { send(0, {'t': 'cmd', 'c': cmd}); }
  }

  // المضيف: لاعب غادر أو انقطع
  void playerLeft(int playerSlot) { if (host) pending.add({'k': 'leave', 'p': playerSlot}); }

  // رسالة وصلت. fromSlot: خانة المرسل (المضيف يعرفها من اتصاله، فلا يصدق ما يكتبه المرسل عن نفسه)
  void receive(Map msg, int fromSlot) {
    if (host) {
      final c = msg['c'];
      if (msg['t'] == 'cmd' && c is Map && c['k'] != 'leave') {
        pending.add({...c.cast<String, Object?>(), 'p': fromSlot});
      } else if (msg['t'] == 'hash' && msg['n'] is int && msg['h'] is int) {
        _checkHash(msg['n'] as int, msg['h'] as int, fromSlot);
      }
      return;
    }
    if (msg['t'] == 'turn' && msg['n'] is int) {
      turns[msg['n'] as int] = msg['c'] is List ? msg['c'] as List : const [];
    } else if (msg['t'] == 'sync' && msg['s'] is String && msg['n'] is int) {
      _load(msg['s'] as String, msg['n'] as int);
    }
  }

  // --- المضيف ---
  void _hostTick() {
    final n = state.netTick + _net.i('delayTicks');
    final cmds = pending;
    pending = [];
    turns[n] = cmds;
    send(all, {'t': 'turn', 'n': n, 'c': cmds});
    runTurn(state, turns[state.netTick] ?? const []);
    turns.remove(state.netTick - 1);
    final every = _net.i('hashTicks');
    if (state.netTick % every == 0) {
      hostHashes[state.netTick] = hashState(state);
      hostHashes.remove(state.netTick - every * 10);
      final waiting = _peerHashes.remove(state.netTick);
      if (waiting != null) { for (final (slot, h) in waiting) { _checkHash(state.netTick, h, slot); } }
    }
  }

  void _checkHash(int n, int h, int fromSlot) {
    final mine = hostHashes[n];
    if (mine == null) {                        // المنضم سبق المضيف: نقارن حين يبلغه
      if (n > state.netTick && n < state.netTick + _net.i('keepTicks')) (_peerHashes[n] ??= []).add((fromSlot, h));
      return;
    }
    if (mine != h) resyncAll();
  }

  // إعادة المزامنة: المضيف يرسل مباراته كلها ويفكها هو أيضاً، فيتطابق الجميع
  void resyncAll() {
    final text = encodeMatch(state);
    state = loadLan(text, keep: state);
    hostHashes.clear();
    _peerHashes.clear();
    resyncs++;
    send(all, {'t': 'sync', 'n': state.netTick, 's': text});
    onResync?.call(state);
  }

  // --- المنضم ---
  void _load(String text, int n) {
    state = loadLan(text, keep: state);
    turns.removeWhere((k, _) => k < n);
    resyncs++;
    onResync?.call(state);
  }

  void _clientTick() {
    runTurn(state, turns[state.netTick]!);
    turns.remove(state.netTick - 1 - _net.i('keepTicks'));
    if (state.netTick % _net.i('hashTicks') == 0) send(0, {'t': 'hash', 'n': state.netTick, 'h': hashState(state)});
  }

  int _ready() {
    var k = 0;
    while (turns.containsKey(state.netTick + k)) { k++; }
    return k;
  }

  // إطار واحد: التحديثات حسب الوقت (والمنضم حسب الأدوار التي وصلت). يعيد كسر التحديث للرسم (0..1)
  double step(double dt) {
    if (state.matchResult != null) { acc = 0; return 0; }
    if (host) {
      if (state.paused) { acc = 0; return 0; }
      acc += dt;
      var steps = 0;
      while (acc >= TICK_SEC && steps < 5 && state.matchResult == null) { _hostTick(); acc -= TICK_SEC; steps++; }
      if (acc > TICK_SEC * 5) acc = 0;
      return (acc / TICK_SEC).clamp(0.0, 1.0);
    }
    acc += dt;
    var avail = _ready(), steps = 0;
    final max = avail > _net.i('catchUpAbove') ? _net.i('catchUpSteps') : 5;
    while (avail > 0 && steps < max && (acc >= TICK_SEC || avail > _net.i('catchUpAbove')) && state.matchResult == null) {
      _clientTick();
      acc = (acc - TICK_SEC).clamp(0.0, double.infinity);
      avail--;
      steps++;
    }
    if (!turns.containsKey(state.netTick)) acc = acc.clamp(0.0, TICK_SEC);   // ينتظر المضيف: لا يدّخر وقتاً
    return (acc / TICK_SEC).clamp(0.0, 1.0);
  }

  // كاميرا هذا الجهاز أمراً مشتركاً (لمستويات التفصيل)، حين تتغير وكل NET.camSeconds على الأكثر
  void sendCamera(double nowSeconds) {
    if (nowSeconds - camAt < _net.d('camSeconds')) return;
    camAt = nowSeconds;
    final c = state.camera;
    final cam = <String, Object?>{'k': 'cam', 'x': c.x.round(), 'y': c.y.round(), 'z': (c.z * 100).round() / 100,
      'w': state.viewW.round(), 'h': state.viewH.round()};
    final key = '${cam['x']},${cam['y']},${cam['z']},${cam['w']},${cam['h']}';
    if (key == camSent) return;
    camSent = key;
    command(cam);
  }
}
