// ضباب الحرب على البوتات (2.0.6، بطلب المستخدم: "يجب أن يؤثر على الـ AI ويكتشفون المنطقة مثل اللاعبين ويخططون"،
// في التطبيق وحده): كل بوت يرى ما يرصده جنوده وحلفاؤه وأحياؤهم، ويتذكر مالك كل حي كما رآه آخر مرة (state.fogBelief).
// قراره (الاقتصاد والفرق) على ما يعرفه: الأحياء بمالكها المعروف، وما لم يُستكشف يظنه محايداً فيتوسع نحوه مستكشفاً،
// والأعداء الذين لا يراهم لا يُحسبون في الخطر والقوة. وأحياؤه هو يعرفها دائماً كما هي.
// بلا ضباب (settings.fog غير true) كما كان تماماً، فبصمات مباريات js/ مطابقة
import 'dart:math' as math;
import 'dart:typed_data';

import '../config.dart' show FOG;
import '../core/cfg.dart';
import '../core/fmath.dart';
import '../game/state.dart';

bool fogOn(MatchState s) => s.settings['fog'] == true;

int? fogViewer;                  // البوت الذي يقرر الآن (null: لا ضباب على القرار)
Uint8List _visible = Uint8List(0);
int _n = 0;

bool _ally(MatchState s, int a, int b) => a == b || (s.players[a].team != 0 && s.players[a].team == s.players[b].team);

// هل يرى البوت الذي يقرر الآن هذه الوحدة؟ (جنوده وحلفاؤه دائماً)
bool botSees(MatchState s, Unit u) {
  final v = fogViewer;
  if (v == null || _ally(s, v, u.playerId)) return true;
  final i = jsRound(u.x), j = jsRound(u.y);
  return i >= 0 && j >= 0 && i < _n && j < _n && _visible[j * _n + i] == 1;
}

// ما يراه اللاعب الآن: مناطق أحيائه وأحياء حلفائه، ودائرة رصد حول كل جندي منهم
void _see(MatchState s, int pid) {
  final n = s.map.n;
  if (_n != n) { _visible = Uint8List(n * n); _n = n; }
  _visible.fillRange(0, n * n, 0);
  final area = s.map.areaAt;
  if (area != null) {
    for (var k = 0; k < area.length; k++) {
      final id = area[k];
      if (id < 0) continue;
      final owner = s.map.districts[id].owner;
      if (owner != null && _ally(s, pid, owner)) _visible[k] = 1;
    }
  }
  for (final u in s.units) {
    if (u.state == 'dead' || u.hp <= 0 || !_ally(s, pid, u.playerId)) continue;
    final r = math.max(FOG.unitSight, u.stats.dz('visionRange')), r2 = r * r;
    final j0 = math.max(0, (u.y - r).floor()), j1 = math.min(n - 1, (u.y + r).ceil());
    final i0 = math.max(0, (u.x - r).floor()), i1 = math.min(n - 1, (u.x + r).ceil());
    for (var j = j0; j <= j1; j++) {
      final dj = j - u.y;
      for (var i = i0; i <= i1; i++) {
        final di = i - u.x;
        if (di * di + dj * dj <= r2) _visible[j * n + i] = 1;
      }
    }
  }
}

// قرار البوت على ما يعرفه: مالك كل حي من معرفته مدة القرار، ثم يعود الحقيقي
void withBotFog(MatchState s, Player p, void Function() decide) {
  if (!fogOn(s)) { decide(); return; }
  _see(s, p.id);
  final ds = s.map.districts, n = s.map.n;
  final belief = s.fogBelief.putIfAbsent(p.id, () => Int32List(ds.length)..fillRange(0, ds.length, -1));
  final real = Int32List(ds.length);
  for (final d in ds) {
    real[d.id] = d.owner ?? -1;
    final c = d.capture;
    final seen = c != null && _visible[c.j * n + c.i] == 1;
    if (seen || d.owner == p.id || belief[d.id] == p.id) belief[d.id] = d.owner ?? -1;
  }
  for (final d in ds) { d.owner = belief[d.id] < 0 ? null : belief[d.id]; }
  fogViewer = p.id;
  try {
    decide();
  } finally {
    fogViewer = null;
    for (final d in ds) { d.owner = real[d.id] < 0 ? null : real[d.id]; }
  }
}
