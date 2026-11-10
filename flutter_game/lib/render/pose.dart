// الوضعيات المفتاحية (js/render/anim.js وfightAnim.js): المزج والمشي والانتظار والترنّح والسقوط والموت،
// وعقد القتال حسب السلاح من جداول lib/data/poses.dart (مصدّرة من JavaScript نفسه بأرقامها)
import 'dart:math' as math;
import 'dart:typed_data';

import '../core/cfg.dart';
import '../data/js_config.dart';
import '../data/poses.dart' as T;

// حقول الوضعية: 18 رقماً بترتيب poses.dart، وNaN للغائب (tw في وضعيات المرجع)
const PX = 0, PY = 1, PL = 2, CB = 3, HT = 4, HDX = 5, HDY = 6, FHX = 7, FHY = 8, BHX = 9, BHY = 10, WA = 11,
    TF = 12, KF = 13, TB = 14, KB = 15, AIR = 16, TW = 17;

class Pose {
  final Float64List v;
  double pull = double.nan;   // شدّ وتر القوس (غائب: NaN)
  bool blocking = false, thrown = false;
  Pose(this.v);
  factory Pose.of(int index) => Pose(Float64List.fromList(T.POSES[index]));
  Pose copy() => Pose(Float64List.fromList(v))..pull = pull..blocking = blocking..thrown = thrown;
  double operator [](int k) => v[k];
  void operator []=(int k, double x) => v[k] = x;
  double get tw => v[TW].isNaN ? 0 : v[TW];
}

final _cache = <Pose>[for (var k = 0; k < T.POSES.length; k++) Pose.of(k)];
Pose _at(int index) => _cache[index];

double ease(double x) => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);

// mixPose: مفاتيح a وحدها، والغائب في b يبقى قيمة a
Pose mixPose(Pose a, Pose b, double t) {
  final r = Float64List(18);
  for (var k = 0; k < 18; k++) {
    final va = a.v[k];
    if (va.isNaN) { r[k] = double.nan; continue; }
    final vb = b.v[k].isNaN ? va : b.v[k];
    r[k] = va + (vb - va) * t;
  }
  return Pose(r);
}

double _easeOf(int e, double u) => switch (e) { 1 => u * u * u, 2 => 1 - (1 - u) * (1 - u), 3 => u, _ => ease(u) };

// keyAt في fightAnim.js (وkeyPose في anim.js بتسارع ease)
Pose keyAt(List<(num, int, int)> keys, double t) {
  if (t <= keys[0].$1) return _at(keys[0].$2);
  for (var i = 1; i < keys.length; i++) {
    final k = keys[i];
    if (t <= k.$1) {
      final p = keys[i - 1], u = (t - p.$1) / (k.$1 - p.$1);
      return mixPose(_at(p.$2), _at(k.$2), _easeOf(k.$3, u));
    }
  }
  return _at(keys.last.$2);
}

Pose atk(String key, double t) => keyAt(T.ATK[key]!, t);
Pose dodgePose(String type, double t) => keyAt(T.DODGE[type] ?? T.DODGE['leap']!, t);
Pose blockPose(double t) => keyAt(T.BLOCK, t)..blocking = true;

Pose _p(Map<int, double> o, [int base = T.G]) {
  final p = _at(base).copy();
  o.forEach((k, x) => p.v[k] = x);
  return p;
}

Pose poseIdle(double t, bool combat) {
  if (combat) {
    final b = math.sin(t * 4.2);
    final p = _at(T.G).copy();
    p[PY] = -10.3 + b * 0.3; p[CB] = 0.06 + b * 0.03; p[FHX] = 5; p[FHY] = -11 + b * 0.4; p[BHX] = 1.5; p[BHY] = -9.5 + b * 0.3;
    p[HT] = 0.05 - b * 0.03;
    return p;
  }
  final b = math.sin(t * 2.6);
  final p = _at(T.BASE).copy();
  p[PY] = -11 + b * 0.3; p[CB] = b * 0.03; p[HT] = -b * 0.04; p[FHX] = 3.5; p[FHY] = -6.5 + b * 0.3; p[BHX] = -2.5; p[BHY] = -6.5 + b * 0.3;
  return p;
}

const _tau = 6.2831853;
Pose poseWalk(double t, double spd, bool combat) {
  final ph = t * 2.55 * spd * _tau, s = math.sin(ph), c2 = math.cos(ph * 2);
  final r = _at(combat ? T.G : T.BASE).copy();
  r[PY] = -11.6 - c2 * 1.4; r[PL] = 0.28; r[CB] = 0.1 + c2 * 0.04; r[HT] = -0.12 - c2 * 0.05; r[AIR] = math.max(0, math.sin(ph * 2)) * 0.55;
  r[TF] = 0.95 * s; r[KF] = 1.55 * math.pow(0.5 + 0.5 * math.cos(ph - 4.12), 2.2) + 0.18;
  r[TB] = 0.95 * math.sin(ph + math.pi); r[KB] = 1.55 * math.pow(0.5 + 0.5 * math.cos(ph + math.pi - 4.12), 2.2) + 0.18;
  if (combat) { r[FHX] = 5.5 + s * -1.2; r[FHY] = -11.5 + c2 * 0.6; r[BHX] = -1 + s * 3; r[BHY] = -8.5; r[WA] = -1.0 + s * 0.15; }
  else { r[FHX] = 1.5 - s * 4.5; r[FHY] = -7 + s.abs() * 1.2; r[BHX] = -1.5 + s * 4.5; r[BHY] = -7 + s.abs() * 1.2; r[WA] = 0.9 - s * 0.5; }
  return r;
}

Pose poseStagger(double t, double d) => _p({PX: -2.6 * d, PY: -10.2, PL: -0.26 - 0.22 * math.sin(t * 20) * d, CB: -0.7 * d,
  HT: -0.85 * d + math.sin(t * 14) * 0.3 * d, FHX: 6.5 + math.sin(t * 11) * 3, FHY: -16.5 + math.cos(t * 9) * 2.6, BHX: -7.5,
  BHY: -15 + math.sin(t * 13) * 2.6, WA: -2.3 + math.sin(t * 10) * 0.5, TF: 0.35 + math.max(0, math.sin(t * 9)) * 0.6 * d,
  KF: 0.7, TB: -0.6, KB: 0.45});

final _downTime = COMBAT_REALISM.d('downTime');
Pose poseDown(double e) {
  final t = _downTime;
  if (e < t - 0.36) return _at(T.DOWN_LIE);
  return mixPose(_at(T.DOWN_KNEEL), _at(T.G), ease((e - (t - 0.36)) / 0.36));
}

double downAngle(double e) {
  final t = _downTime;
  if (e < 0.26) return -1.5 * ease(e / 0.26);
  if (e < t - 0.36) return -1.5 + math.sin((e - 0.26) * 14) * 0.06 * math.max(0, 1 - (e - 0.26) * 3);
  return -1.5 * (1 - ease((e - (t - 0.36)) / 0.36));
}

// ===================== fightAnim.js =====================
String _nodeKey(String node, String move) {
  if (node == 'S1') return move == 'kick_high' ? 'SKH' : move == 'kick_front' ? 'SKF' : 'S1';
  return node;
}

double _bigTime(double a) {
  if (a < 0.34) return math.min(0.34, a * 0.34 / 0.26);
  if (a < 0.53) return a;
  if (a < 0.66) return 0.53;
  return 0.53 + (a - 0.66) / 0.34 * 0.47;
}

Pose nodePose(String style, String node, String move, double a, bool big) {
  final key = _nodeKey(node, move), all = big ? T.BIG_NODES : T.NODES;
  final set = all[style] ?? T.NODES['blade']!;
  return keyAt(set[key] ?? set['L1']!, big ? _bigTime(a) : a);
}

const _flip = {'S1': [0.35, 0.42], 'SKH': [0.16, 0.3], 'L4': [0.16, 0.3]};
bool nodeFlip(String style, String node, String move, double a) {
  final key = _nodeKey(node, move), f = _flip[key];
  return f != null && a > f[0] && a < f[1] && !(style == 'fists' && key == 'S1');
}

const _striker = {
  'fists': {'L1': 'fh', 'L2': 'bh', 'L3': 'fh', 'L4': 'leg', 'H1': null, 'D': 'bh', 'S1': 'fh', 'SKF': 'fh', 'KF': 'fh', 'F': 'fh'},
  'shield': {'L1': 'fh', 'L2': 'fh', 'L3': 'fh', 'H1': 'fh', 'D': 'fh', 'F': 'fh', 'KF': 'fh', 'SKF': 'fh'},
};
const _strikerAll = {'P': 'bh', 'KF': 'leg', 'KH': 'leg', 'SKH': 'leg', 'L4': 'leg'};
String? nodeStriker(String style, String node, String move) {
  final key = _nodeKey(node, move), own = _striker[style];
  if (own != null && own.containsKey(key)) return own[key];
  return _strikerAll[key] ?? 'w';
}

Pose guardPose(String style, double t, bool big) {
  final g = _at((big ? T.BIG_GUARDS : T.GUARDS)[style] ?? T.GUARDS['blade']!);
  final fists = style == 'fists', w = big ? 2.6 : fists ? 6.2 : 3.8, b = math.sin(t * w);
  final p = g.copy();
  p[PY] = g[PY] + b * (fists ? 0.45 : 0.25); p[CB] = g[CB] + b * 0.035; p[HT] = g[HT] - b * 0.03;
  p[FHX] = g[FHX] + math.sin(t * w * 0.5) * 0.3; p[FHY] = g[FHY] + b * 0.35; p[BHY] = g[BHY] + b * 0.3;
  return p;
}

Pose walkArms(Pose p, String style, double t, bool big) {
  final g = _at((big ? T.BIG_GUARDS : T.GUARDS)[style] ?? T.GUARDS['blade']!), s = math.sin(t * 6);
  p[FHX] = g[FHX] - 0.6 + s * 0.6; p[FHY] = g[FHY] + 0.8; p[BHX] = g[BHX] - 0.4; p[BHY] = g[BHY] + 0.6 - s * 0.4; p[WA] = g[WA]; p[TW] = 0;
  return p;
}

final _strikeMoment = COMBAT_REALISM.d('strikeMoment');
double hitstopTime(double t, ({double wind, double strike, double total}) ph, double hs) {
  final hit = ph.wind + ph.strike * _strikeMoment, end = ph.total;
  hs = math.min(hs, (end - hit) * 0.6);
  if (t <= hit) return t;
  if (t < hit + hs) return hit;
  return hit + (t - hit - hs) * (end - hit) / (end - hit - hs);
}

const _heavyNode = {'H1', 'S1', 'F', 'D'}, _unarmedNode = {'P', 'KF', 'KH'};
String impactKind(String style, String node, bool bigA, bool echo) {
  if (style.isEmpty) return 'star';
  if (echo) return 'smash';
  if (node == 'F' || (style == 'fists' && node == 'S1') || (_heavyNode.contains(node) && (style == 'hammer' || bigA)) || (bigA && node == 'KF')) return 'quake';
  if (_unarmedNode.contains(node) || style == 'fists' || style == 'shield' || style == 'hammer') return 'smash';
  return style == 'spear' ? 'pierce' : 'slash';
}

const _stab = {'knife': {'L1', 'L3', 'D'}, 'spear': {'L1', 'L2', 'L3', 'H1', 'D', 'F'}, 'blade': {'D'}, 'ranged': {'L3', 'D'}};
String hitKind(String style, String node) {
  if (_stab[style]?.contains(node) ?? false) return 'stab';
  if (style == 'hammer' || style == 'shield' || node == 'H1' || node == 'F') return 'blunt';
  return 'snap';
}

Pose flinchPose(Pose p0, double f, bool fromBack, String k, bool heavy) {
  final s = fromBack ? -1.0 : 1.0, m = heavy ? 0.6 : 1.0;
  final p = p0.copy();
  f *= m;
  if (k == 'stab') {
    p[PX] -= 1.6 * f * s; p[PL] -= 0.1 * f; p[CB] += 0.62 * f; p[HT] += 0.5 * f; p[PY] += 0.7 * f;
    p[FHX] -= 2.6 * f; p[FHY] += 3.4 * f; p[BHX] += 1.6 * f; p[BHY] += 4.2 * f; p[TF] += 0.3 * f; p[KF] += 0.5 * f;
    return p;
  }
  if (k == 'blunt') {
    p[PX] -= 1.8 * f * s; p[PY] += 1.6 * f; p[CB] -= 0.3 * f * s; p[HT] += 0.4 * f;
    p[FHX] += 1.6 * f; p[FHY] -= 2 * f; p[BHX] -= 3.6 * f; p[BHY] -= 1.6 * f; p[TF] += 0.25 * f; p[KF] += 0.7 * f; p[KB] += 0.6 * f;
    return p;
  }
  p[CB] -= 0.72 * f * s; p[PL] -= 0.2 * f * s; p[HT] -= 0.95 * f * s; p[PX] -= 2.2 * f * s; p[PY] += 0.4 * f;
  p[FHX] -= 2.4 * f; p[FHY] -= 3 * f; p[BHX] -= 3.2 * f; p[BHY] -= 4 * f; p[TF] += 0.75 * f; p[KF] += 0.95 * f;
  return p;
}

Pose knockPose(Pose p, double k) => mixPose(p, _at(T.KNOCK), k);
Pose deathPose(bool front, double e) => keyAt(front ? T.DEATH_FRONT : T.DEATH_BACK, e);
double deathTilt(bool front, double e) {
  final start = front ? 0.24 : 0.16, k = ease(math.min(1, math.max(0, (e - start) / 0.34)));
  final land = e - start - 0.34, bounce = land > 0 ? math.sin(land * 22) * 0.07 * math.max(0, 1 - land * 4) : 0;
  return (front ? 1 : -1) * (k * 1.5708 - bounce);
}

// مزج الوضعيات عند تبدّل مصدرها: آخر وضعية رُسمت لكل وحدة
class _Mem { String src; Pose? from; double t0 = 0, dur = 0; Pose last; _Mem(this.src, this.last); }
final _mem = Expando<_Mem>();
Pose blendPose(Object unit, String src, Pose pose, double t, double dur) {
  final m = _mem[unit];
  if (m == null) { _mem[unit] = _Mem(src, pose); return pose; }
  if (m.src != src) { m.from = m.last; m.t0 = t; m.dur = dur; m.src = src; }
  var out = pose;
  final from = m.from;
  if (from != null && t - m.t0 < m.dur && t >= m.t0) {
    out = mixPose(from, pose, ease((t - m.t0) / m.dur));
    out.pull = pose.pull; out.blocking = pose.blocking; out.thrown = pose.thrown;
  } else {
    m.from = null;
  }
  m.last = out;
  return out;
}
