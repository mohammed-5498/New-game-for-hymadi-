// رسم الوحدة (js/render/units.js وcombatArt.js وunitSprites.js): الوضعية من حالتها، والهيكل، وأجزاء صورتها
// على مفاصله، والآثار حولها (الظل، وحلقة البطل، ووهج الضربة المميزة، وأثر السلاح، وإطار الارتطام، والوميض،
// وشرر الصدّ، ونجوم الترنّح، وأشرطة الدم والشحن). كلها في دفعة الأطلس (batch.dart) بإحداثيات العالم
import 'dart:math' as math;

import '../core/cfg.dart';
import '../data/js_config.dart';
import '../data/unit_sprites.dart';
import '../game/realism.dart' show fightStyle, fightBig, hitstopOf;
import '../game/state.dart';
import 'batch.dart';
import 'pose.dart';
import 'unit_atlas.dart';

final J _CR = COMBAT_REALISM, _ART = UNIT_ART;
const _ultMove = {
  'pierce': 'thrust', 'flurry': 'quick', 'slam': 'heavy', 'shot': 'shoot', 'fire': 'throw', 'buff': 'heavy', 'heal': 'heavy',
  'arc': 'spin', 'arrows': 'shoot', 'bash': 'thrust', 'harden': 'block', 'caravan': 'heavy', 'falcon': 'throw', 'shout': 'heavy',
  'whirl': 'spin', 'rain': 'shoot', 'throwdown': 'spin', 'bribe': 'thrust', 'banner': 'heavy', 'haste': 'heavy', 'knockout': 'punch',
  'roda': 'kick_high', 'tango': 'spin'
};
const _classNode = {'quick': 'L1', 'heavy': 'H1', 'thrust': 'L1', 'spin': 'S1', 'punch': 'P', 'kick_front': 'KF', 'kick_high': 'KH'};

const ART_KEYS = {
  'crows': {'common': 'crow_common', 'spear': 'crow_spear', 'dual': 'crow_dual', 'champion': 'crow_hero'},
  'hammers': {'common': 'hammer_common', 'armored': 'hammer_shield', 'smasher': 'hammer_breaker', 'champion': 'hammer_hero'},
  'vipers': {'common': 'viper_common', 'sniper': 'viper_sniper', 'firebomber': 'viper_firebomber', 'champion': 'viper_hero'},
  'scorpions': {'common': 'scorp_common', 'boss': 'scorp_boss', 'medic': 'scorp_medic', 'champion': 'scorp_hero'},
  'police': {'common': 'police_common', 'captain': 'police_captain'},
};

// من BODIES في bodies.js: عرض الخط وطول السلاح وحمله باليدين وعرض الظل وزينة القدمين (r حلقة البطل، d حلقة متقطعة)
const _bodies = <String, (double, double, bool, double, String)>{
  'crow_common': (2.8, 4.2, false, 0, ''), 'crow_spear': (2.8, 12, true, 0, ''), 'crow_dual': (2.8, 5.4, false, 0, ''),
  'crow_hero': (3, 12.5, true, 0, 'r'), 'hammer_common': (3.3, 5.2, false, 0, ''), 'hammer_shield': (3.5, 3, false, 0, ''),
  'hammer_breaker': (3.5, 12, true, 0, ''), 'hammer_hero': (3.5, 4.6, false, 5, 'r'), 'viper_common': (2.8, 1.5, false, 0, ''),
  'viper_sniper': (2.8, 2, false, 0, ''), 'viper_firebomber': (2.8, 2, false, 0, ''), 'viper_hero': (3, 2, false, 0, 'r'),
  'scorp_common': (2.9, 4.4, false, 0, ''), 'scorp_boss': (3, 3.4, false, 0, 'boss'), 'scorp_medic': (2.9, 1.6, false, 0, ''),
  'scorp_hero': (3.1, 3.8, false, 0, 'medic'), 'police_common': (3, 4, false, 0, ''), 'police_captain': (3.2, 4.4, false, 0, 'cap'),
};

typedef _Hook = void Function(_Ctx k, Pose p);

class _Desc {
  final String key, gang;
  final Map<String, List<double>> parts;
  final double size, lw, wlen, shadowW, tipLen, butt;
  final bool twoH, shoots, weapon;
  final String ground;
  final _Hook held;
  final _Hook? back, front;
  _Desc(this.key, this.gang, this.parts, this.size, this.lw, this.wlen, this.shadowW, this.tipLen, this.butt, this.twoH, this.shoots,
      this.weapon, this.ground, this.held, this.back, this.front);
}

// سياق رسم وحدة واحدة: الدفعة وأجزاؤها ومفاصلها
class _Ctx {
  final TriBatch b;
  final Map<String, List<double>> parts;
  final double oy;
  double hipX = 0, hipY = 0, midX = 0, midY = 0, chestX = 0, chestY = 0, headX = 0, headY = 0, a2 = 0, pl = 0;
  double sbX = 0, sbY = 0, sfX = 0, sfY = 0, hbX = 0, hbY = 0, hfX = 0, hfY = 0, efX = 0, efY = 0;
  _Ctx(this.b, this.parts, this.oy);
  List<double> part(String name) => parts[name]!;
}

final double _upp = SPRITE_UPP;
void _part(_Ctx k, List<double> p, double x, double y, double ang, [double s = 1]) =>
    k.b.imageAt(p[0], p[1] + k.oy, p[2], p[3], p[4], p[5], x, y, ang - p[6], _upp * s);

double _angleOf(double ax, double ay, double bx, double by) => math.atan2(by - ay, bx - ax);
(double, double) _rot(double x, double y, double a) => (x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a));

_Hook _inHand(String n) => (k, p) { final w = k.part(n); _part(k, w, k.hfX, k.hfY, p[WA], w[7]); };
void _shieldAt(_Ctx k, List<double> w, double x, double y) => _part(k, w, x, y, w[6] + k.a2 * 0.6, w[7]);
_Hook _bow(int arrows, bool fire, [String name = 'bow']) => (k, p) {
  final w = k.part(name), aim = p.pull.isNaN ? p[WA] * 0.4 : p[WA], pull = p.pull.isNaN ? 0.0 : p.pull;
  final dx = math.cos(aim), dy = math.sin(aim), ux = dy, uy = -dx, s = _upp * w[7];
  _part(k, w, k.hfX, k.hfY, aim + w[6], w[7]);
  if (pull <= 0.05) return;
  final depth = w[4] * s, half = w[3] * 0.47 * s;
  final t1x = k.hfX - dx * depth + ux * half, t1y = k.hfY - dy * depth + uy * half;
  final t2x = k.hfX - dx * depth - ux * half, t2y = k.hfY - dy * depth - uy * half;
  k.b.line(t1x, t1y, k.hbX, k.hbY, 0.6, 0xd9d3c6);
  k.b.line(k.hbX, k.hbY, t2x, t2y, 0.6, 0xd9d3c6);
  if (pull > 0.2) {
    for (var i = 0; i < arrows; i++) {
      final o = (i - (arrows - 1) / 2) * 0.9;
      final tx = k.hfX + dx * 3.8 + ux * o, ty = k.hfY + dy * 3.8 + uy * o;
      k.b.line(k.hbX + ux * o * 0.4, k.hbY + uy * o * 0.4, tx, ty, 0.8, 0xd9d3c6);
      if (fire) _flame(k.b, tx, ty + 0.6, 0.55);
    }
  }
};

void _flame(TriBatch b, double x, double y, double s) {
  b.tri(x - 1.2 * s, y, x, y - 3.6 * s, x + 1.2 * s, y, 0xf0902a);
  b.tri(x - 0.6 * s, y, x, y - 2.2 * s, x + 0.6 * s, y, 0xffd45a);
}

void _quiver(_Ctx k, Pose p, String n) {
  final (q1x, q1y) = _rot(-1.8, 0.6, k.a2);
  final (q2x, q2y) = _rot(-3.4, 1.2, p[PL]);
  final ax = k.chestX + q1x, ay = k.chestY + q1y, bx = k.midX + q2x, by = k.midY + q2y;
  final w = k.part(n);
  _part(k, w, (ax + bx) / 2, (ay + by) / 2, _angleOf(bx, by, ax, ay), w[7]);
}

final _art = <String, (_Hook, _Hook?, _Hook?, bool, bool)>{   // held, back, front, twoH, shoots
  'crow_common': (_inHand('dagger'), null, null, false, false),
  'crow_spear': (_inHand('spear'), null, null, false, false),
  'crow_hero': (_inHand('spear'), null, null, false, false),
  'crow_dual': (_inHand('blade'), (k, p) { final w = k.part('blade2'); _part(k, w, k.hbX, k.hbY, _angleOf(k.sbX, k.sbY, k.hbX, k.hbY) - 0.9, w[7]); }, null, false, false),
  'hammer_common': (_inHand('hammer'), null, null, false, false),
  'hammer_breaker': (_inHand('hammer'), null, null, false, false),
  'hammer_shield': ((k, p) {}, null, (k, p) => _shieldAt(k, k.part('shield'), k.hfX + 1.2, k.hfY), false, false),
  'hammer_hero': (_inHand('hammer'), (k, p) { if (!p.blocking) _shieldAt(k, k.part('shield'), k.hbX + 0.8, k.hbY - 3.5); },
      (k, p) { if (p.blocking) _shieldAt(k, k.part('shield'), k.hbX + 0.8, k.hbY - 3.5); }, false, false),
  'viper_common': (_inHand('dagger'), null, null, false, false),
  'viper_sniper': (_bow(1, false), null, null, false, false),
  'viper_firebomber': (_bow(1, true), null, null, false, true),
  'viper_hero': (_bow(3, false), (k, p) => _quiver(k, p, 'quiver'), null, false, false),
  'scorp_common': (_inHand('club'), null, null, false, false),
  'scorp_boss': (_inHand('club'), null, null, false, false),
  'scorp_medic': ((k, p) { final w = k.part('kit'); _part(k, w, k.hfX + 0.4, k.hfY - 0.3, math.pi / 2, w[7]); }, null, null, false, false),
  'scorp_hero': (_inHand('staff'), (k, p) {
    final (rx, ry) = _rot(-4, 0.4, p[PL]); final w = k.part('kit'); _part(k, w, k.midX + rx, k.midY + ry - 1.6, math.pi / 2, w[7]); }, null, true, false),
  // الشرطة (uses: shield 'side'، baton 'hand')
  'police_common': (_inHand('baton'), (k, p) { if (!p.blocking) _shieldAt(k, k.part('shield'), k.hbX + 0.8, k.hbY - 3.5); },
      (k, p) { if (p.blocking) _shieldAt(k, k.part('shield'), k.hbX + 0.8, k.hbY - 3.5); }, false, false),
};

final _descs = <String, _Desc?>{};
_Desc? describe(String key) {
  if (_descs.containsKey(key)) return _descs[key];
  String? gang;
  J? parts;
  for (final e in SPRITE_GANGS.entries) {
    final units = (e.value as J).m('units');
    if (units.has(key)) { gang = e.key; parts = units.m(key); break; }
  }
  final body = _bodies[key], art = _art[key] ?? (key.startsWith('police') ? _art['police_common'] : null);
  if (gang == null || parts == null || body == null || art == null) return _descs[key] = null;
  List<num>? weapon;
  for (final v in parts.values) {
    if (v is List && v.length > 8 && (v[8] as num) > 0) { weapon = v.cast<num>(); break; }
  }
  final (lw, wlen, twoH, shadowW, ground) = body;
  // الأجزاء أرقاماً مرة واحدة (لا قوائم جديدة في كل إطار)
  final pt = <String, List<double>>{
    for (final e in parts.entries) if (e.value is List) e.key: [for (final x in e.value as List) (x as num).toDouble()]
  };
  return _descs[key] = _Desc(key, gang, pt, key == 'hammer_hero' ? 1.1 : 1, lw, wlen, shadowW,
      weapon != null ? weapon[8].toDouble() : 0, weapon != null && weapon[9] > 0 ? weapon[9].toDouble() : 0,
      art.$4 || twoH, art.$5, true, ground, art.$1, art.$2, art.$3);
}

String artKey(Unit unit) {
  final kind = unit.champion ? 'champion' : (unit.lookKind ?? unit.hero ?? 'common');
  final gang = ART_KEYS[unit.gang] ?? ART_KEYS['crows']!;
  return gang[kind] ?? gang['common']!;
}

double artScale(Unit unit) => _ART.d('scale') * (unit.champion ? _ART.d('championScale') : unit.hero != null ? _ART.d('heroScale') : 1) *
    unit.traits.size * (unit.artScale ?? 1);
String artColor(Unit unit) => unit.artColor ?? (unit.gang == 'police' ? _ART.s('policeColor') : unit.color);
bool isWalking(Unit unit) => unit.state == 'moving' || unit.state == 'attackMove' || (unit.state == 'attacking' && unit.path.isNotEmpty);

// --- الحركة الجارية على الخط القياسي ---
class _Swing { final String key, node; final double a; final bool ult, landed, stop;
  _Swing(this.key, this.a, this.ult, this.node, this.landed, this.stop); }

double _canonA(Phases ph, double t) {
  if (t < ph.wind) return 0.34 * t / ph.wind;
  if (t < ph.wind + ph.strike) return 0.34 + 0.10 * (t - ph.wind) / ph.strike;
  if (t < ph.wind + ph.strike + ph.hold) return 0.44 + 0.09 * (t - ph.wind - ph.strike) / ph.hold;
  return math.min(1, 0.53 + 0.47 * (t - ph.wind - ph.strike - ph.hold) / ph.rec);
}

final _strikeMoment = _CR.d('strikeMoment'), _hitMoment = COMBAT.d('hitMoment');
_Swing? _swingOf(Unit unit, double time, _Desc ud, String style, bool big, double sub) {
  final ph = unit.cPhases;
  if (unit.cMove != null && ph != null && unit.attackStart != null) {
    final node = unit.cNode ?? _classNode[unit.cMove] ?? 'L1';
    final hit = ph.wind + ph.strike * _strikeMoment;
    var t = math.min(ph.total, unit.cMoveT + sub);
    var stop = false;
    final landed = unit.landAt >= unit.attackStart!;
    if (unit.hitDoneAt >= unit.attackStart!) {
      final hs = math.max(landed ? hitstopOf(style, node, big) : 0.0, unit.hitDoneAt - unit.attackStart! - hit);
      stop = landed && t >= hit && t < hit + hs;
      t = hitstopTime(t, (wind: ph.wind, strike: ph.strike, total: ph.total), hs);
    } else if (unit.pendingHit != null && t > hit) {
      t = hit;
    }
    return _Swing(unit.cMove!, _canonA(ph, t), false, node, landed, stop);
  }
  if (unit.attackStart == null || unit.attackRate == 0) return null;
  final elapsed = time - unit.attackStart!;
  if (elapsed < 0 || elapsed >= unit.attackRate) return null;
  final a = elapsed / unit.attackRate;
  final ult = unit.ultStart != null && time - unit.ultStart! < unit.ultRate;
  if (ult) {
    final kind = (unit.stats['ult'] as J?)?.ss('kind');
    final key = _ultMove[kind] ?? 'heavy';
    final near = _classNode.containsKey(key) ? (a < _hitMoment ? a * 0.4 / _hitMoment : 0.4 + (a - _hitMoment) * 0.6 / (1 - _hitMoment)) : a;
    return _Swing(ud.shoots && key == 'throw' ? 'shoot' : key, near, true, _classNode[key] ?? 'L1', false, false);
  }
  final projectile = unit.stats['projectile'];
  final key = projectile == 'arrow' || (ud.shoots && truthy(projectile)) ? 'shoot' : truthy(projectile) ? 'throw' : 'quick';
  return _Swing(key, a, false, 'L1', false, false);
}

final _combatPoseTiles = _CR.d('combatPoseTiles'), _dodgeTime = _CR.d('dodgeTime'), _blockTime = _CR.d('blockTime');
final _flinchTime = _CR.d('flinchTime'), _pushFlinch = _CR.d('pushFlinch');
final J _blend = FIGHT.m('blend');

Pose _poseOf(Unit unit, double rt, double animT, bool walking, _Swing? sw, String style, bool big, double sub) {
  Pose p;
  String src;
  var dur = _blend.d('react');
  if (sw != null) {
    if (sw.key == 'block') { p = blockPose(sw.a); }
    else if (sw.key == 'shoot') { p = atk('shoot', sw.a)..pull = sw.a < 0.47 ? ease(math.min(1, sw.a / 0.34)) : 0; }
    else if (sw.key == 'throw') { p = atk('throw', sw.a)..thrown = sw.a >= 0.47 && sw.a < 0.9; }
    else { p = nodePose(style, sw.node, sw.key, sw.a, big); }
    src = sw.ult ? 'u${unit.ultStart}' : 's${unit.attackStart}';
    dur = _blend.d('swing');
  } else if (unit.cState == 'dodge') {
    p = dodgePose(unit.dodgeType, 1 - (unit.cTimer - sub) / _dodgeTime);
    src = 'dodge';
  } else if (unit.cState == 'block') {
    p = blockPose(1 - (unit.cTimer - sub) / _blockTime).copy();
    final im = (unit.blockFlash - sub) / 0.2;
    if (im > 0) { p[CB] -= 0.35 * im; p[PX] -= 1.6 * im; p[HT] -= 0.2 * im; p[FHX] -= 1.8 * im; }
    src = 'block';
  } else if (unit.cState == 'stagger') {
    p = poseStagger(animT, math.min(1, math.max(0, unit.cTimer - sub) / 0.4));
    src = 'stagger';
  } else if (unit.cState == 'down') {
    p = poseDown(_CR.d('downTime') - (unit.cTimer - sub));
    src = 'down';
  } else {
    final t = unit.target;
    final combat = t != null && t.state != 'dead' && t.hp > 0 && math.sqrt((t.x - unit.x) * (t.x - unit.x) + (t.y - unit.y) * (t.y - unit.y)) < _combatPoseTiles;
    final spd = unit.stats.d('speed') / 2.2;
    if (combat) { p = walking ? walkArms(poseWalk(animT, spd, true), style, animT, big) : guardPose(style, animT, big); }
    else { p = walking ? poseWalk(animT, spd, false) : poseIdle(animT, false); }
    src = walking ? 'w' : combat ? 'g' : 'i';
    dur = walking ? _blend.d('walk') : _blend.d('rest');
  }
  if (sw == null && unit.cState != 'dodge' && unit.cState != 'down') {
    final v = math.sqrt(unit.vx * unit.vx + unit.vy * unit.vy);
    if (v > 2.2) p = knockPose(p, math.min(1, (v - 2.2) / 3));
  }
  p = blendPose(unit, src, p, rt, dur);
  final fl = unit.flinch - sub;
  if (fl > 0) {
    final since = rt - unit.hitAt, recent = since >= 0 && since < _flinchTime * _pushFlinch + 0.1;
    double f;
    if (recent) {
      final u = (since - unit.hitStop) / math.max(0.05, fl + since - unit.hitStop);
      f = u <= 0 ? 0 : math.sin(math.pi * math.min(1, u));
    } else {
      f = math.sin(math.pi * math.min(1, fl / _flinchTime));
    }
    if (f > 0) p = flinchPose(p, f, unit.flinchBack, recent ? hitKind(unit.hitStyle, unit.hitNode) : 'snap', big);
  }
  return p;
}

Pose _twoHand(_Desc ud, Pose p) {
  if (!ud.twoH) return p;
  final q = p.copy();
  q[BHX] = p[FHX] - math.cos(p[WA]) * 3.2; q[BHY] = p[FHY] - math.sin(p[WA]) * 3.2;
  return q;
}

// الكتف واليد الفعلية لطرف (اليد لا تتجاوز طول الذراع 7.35)
(double, double, double, double) _armOf(Pose p, bool front) {
  final a2 = p[PL] + p[CB], tw = p.tw;
  final (m1x, m1y) = _rot(0, -4.6, p[PL]);
  final (m2x, m2y) = _rot(0, -4.6, a2);
  final cx = p[PX] + m1x + m2x, cy = p[PY] + m1y + m2y;
  final (ox, oy) = front ? _rot(0.9 - 0.9 * tw, 0.5, a2) : _rot(-0.9 + 1.5 * tw, 0.7, a2);
  final sx = cx + ox, sy = cy + oy, tx = front ? p[FHX] : p[BHX], ty = front ? p[FHY] : p[BHY];
  final dx = tx - sx, dy = ty - sy, d = math.sqrt(dx * dx + dy * dy), k = d > 7.35 ? 7.35 / d : 1;
  return (sx, sy, sx + dx * k, sy + dy * k);
}

(double, double, double, double, double, double) _legOf(Pose p) {
  final hx = p[PX] + 1.2, hy = p[PY], kx = hx + math.sin(p[TF]) * 5.8, ky = hy + math.cos(p[TF]) * 5.8;
  return (hx, hy, kx, ky, kx + math.sin(p[TF] - p[KF]) * 6, ky + math.cos(p[TF] - p[KF]) * 6);
}

// ik2 في anim.js: مرفق ويد لذراع من الكتف o نحو t
(double, double, double, double) _ik2(double ox, double oy, double tx, double ty, double l1, double l2) {
  final dx = tx - ox, dy = ty - oy;
  var d = math.sqrt(dx * dx + dy * dy);
  if (d == 0) d = 0.001;
  final cl = math.max((l1 - l2).abs() + 0.05, math.min(d, l1 + l2 - 0.05));
  final ex = ox + dx / d * cl, ey = oy + dy / d * cl, a = math.atan2(ey - oy, ex - ox);
  final aa = math.acos(math.max(-1, math.min(1, (l1 * l1 + cl * cl - l2 * l2) / (2 * l1 * cl)))), g = a + aa;
  return (ox + math.cos(g) * l1, oy + math.sin(g) * l1, ex, ey);
}

// drawSpriteBody: المفاصل كما في drawBody والأجزاء من الصور (الساقان قبل الجذع)
void _spriteBody(_Ctx k, Pose p, _Desc ud) {
  final hx = p[PX], hy = p[PY];
  final (m1x, m1y) = _rot(0, -4.6, p[PL]);
  final mx = hx + m1x, my = hy + m1y, a2 = p[PL] + p[CB];
  final (c1x, c1y) = _rot(0, -4.6, a2);
  final cx = mx + c1x, cy = my + c1y;
  final (n1x, n1y) = _rot(0, -1.3, a2);
  final nx = cx + n1x, ny = cy + n1y, ha = a2 + p[HT];
  final (h1x, h1y) = _rot(0, -3.1, ha);
  final headX = nx + h1x + p[HDX], headY = ny + h1y + p[HDY];
  final tw = p.tw;
  final (sb1, sb2) = _rot(-0.9 + 1.5 * tw, 0.7, a2);
  final (sf1, sf2) = _rot(0.9 - 0.9 * tw, 0.5, a2);
  k..hipX = hx..hipY = hy..midX = mx..midY = my..chestX = cx..chestY = cy..headX = headX..headY = headY..a2 = a2..pl = p[PL]
    ..sbX = cx + sb1..sbY = cy + sb2..sfX = cx + sf1..sfY = cy + sf2;
  _leg(k, k.part('thD'), k.part('snD'), hx - 1.2, hy, p[TB], p[KB]);
  _leg(k, k.part('th'), k.part('sn'), hx + 1.2, hy, p[TF], p[KF]);
  final (bjx, bjy, bex, bey) = _ik2(k.sbX, k.sbY, p[BHX], p[BHY], 3.7, 3.7);
  k..hbX = bex..hbY = bey;
  _part(k, k.part('uaD'), k.sbX, k.sbY, _angleOf(k.sbX, k.sbY, bjx, bjy));
  _part(k, k.part('laD'), bjx, bjy, _angleOf(bjx, bjy, bex, bey));
  ud.back?.call(k, p);
  if (ud.parts.containsKey('skirt')) _skirt(k, p, ud);
  _part(k, k.part('torso'), hx, hy, _angleOf(hx, hy, cx, cy));
  final head = k.part('head');
  _part(k, head, headX, headY, ha + head[6]);
  final (fjx, fjy, fex, fey) = _ik2(k.sfX, k.sfY, p[FHX], p[FHY], 3.7, 3.7);
  k..hfX = fex..hfY = fey..efX = fjx..efY = fjy;
  ud.held(k, p);
  _part(k, k.part('ua'), k.sfX, k.sfY, _angleOf(k.sfX, k.sfY, fjx, fjy));
  _part(k, k.part('la'), fjx, fjy, _angleOf(fjx, fjy, fex, fey));
  ud.front?.call(k, p);
}

final _legs = <List<double>>[[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]];
var _legN = 0;
void _leg(_Ctx k, List<double> th, List<double> sn, double hx, double hy, double t, double fl) {
  final kx = hx + math.sin(t) * 5.8, ky = hy + math.cos(t) * 5.8;
  _part(k, th, hx, hy, math.atan2(ky - hy, kx - hx));
  _part(k, sn, kx, ky, math.atan2(math.cos(t - fl), math.sin(t - fl)));
  final L = _legs[_legN++ % 2];
  L[0] = hx; L[1] = hy; L[2] = kx; L[3] = ky; L[4] = kx + math.sin(t - fl) * 6; L[5] = ky + math.cos(t - fl) * 6;
}

(double, double) _legPt(List<double> L, double t) {
  final u = t <= 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  final ax = t <= 0.5 ? L[0] : L[2], ay = t <= 0.5 ? L[1] : L[3], bx = t <= 0.5 ? L[2] : L[4], by = t <= 0.5 ? L[3] : L[5];
  return (ax + (bx - ax) * u, ay + (by - ay) * u);
}

// الإزار معلّق من الحوض ونازل نحو منتصف الساقين (skirtPart): تحويل بميل وقص
void _skirt(_Ctx k, Pose p, _Desc ud) {
  final s = k.part('skirt'), len = s[8];
  final legB = _legs[0], legF = _legs[1];
  final (bx, by) = _legPt(legB, math.min(1.0, len / 11.8));
  final (fx, fy) = _legPt(legF, math.min(1.0, len / 11.8));
  final ca = math.cos(p[PL]), sa = math.sin(p[PL]);
  final dx = (bx + fx) / 2 - k.hipX, dy = (by + fy) / 2 - k.hipY;
  var d = math.sqrt(dx * dx + dy * dy);
  if (d == 0) d = 1;
  final m = math.min(1.1, math.max(0.75, d / len));
  final tilt = math.max(-0.9, math.min(0.9, math.atan2(dx * ca + dy * sa, dy * ca - dx * sa)));
  final yx = (-sa * math.cos(tilt) + ca * math.sin(tilt)) * m, yy = (ca * math.cos(tilt) + sa * math.sin(tilt)) * m;
  k.b.save();
  k.b.transform(ca * _upp, sa * _upp, yx * _upp, yy * _upp, k.hipX, k.hipY);
  k.b.image(s[0], s[1] + k.oy, s[2], s[3], -s[4], -s[5]);
  k.b.restore();
}

(double, double) _tipOf(_Desc ud, _Ctx k, Pose p) {
  final L = ud.tipLen != 0 ? ud.tipLen : (ud.twoH ? 8.6 : ud.wlen);
  return (k.hfX + math.cos(p[WA]) * L, k.hfY + math.sin(p[WA]) * L);
}

void _star(TriBatch b, double x, double y, double r, [int rgb = 0xffffff, double al = 1]) {
  final pts = <double>[];
  for (var i = 0; i < 8; i++) {
    final an = i * math.pi / 4, kk = i.isOdd ? 0.32 : 1.0;
    pts..add(x + math.cos(an) * r * kk)..add(y + math.sin(an) * r * kk);
  }
  for (var i = 0; i < 8; i++) { b.tri(x, y, pts[i * 2], pts[i * 2 + 1], pts[(i + 1) % 8 * 2], pts[(i + 1) % 8 * 2 + 1], rgb, al); }
}

const _shadow = 0x000000;
int _hex(String c) => hexRgb(c);
final _hexCache = <String, int>{};

// drawOne: وحدة واحدة عند (x, y) في العالم
void drawOne(TriBatch b, UnitAtlas atlas, Unit unit, String key, double x, double y, double scale, String color, double time,
    bool walking, int ghosts, double alpha, double sub) {
  final ud = describe(key) ?? describe('crow_common')!;
  final oy = atlas.yOf(ud.gang, color);
  if (oy == null) return;
  final rt = time + sub, animT = rt + (unit.id % 17) * 0.13;
  final dead = unit.state == 'dead';
  final style = fightStyle(unit), big = fightBig(unit);
  final sw = dead ? null : _swingOf(unit, rt, ud, style, big, sub);
  final deadT = dead ? COMBAT.d('deathTime') - (unit.deathTimer - sub) : 0.0;
  final pose = dead ? blendPose(unit, 'dead', deathPose(unit.deathFront, deadT), rt, _blend.d('react'))
      : _poseOf(unit, rt, animT, walking, sw, style, big, sub);
  final p = sw != null && sw.key == 'punch' ? pose : _twoHand(ud, pose);
  final a = sw != null ? sw.a : -1.0;
  final melee = sw != null && sw.key != 'shoot' && sw.key != 'throw' && sw.key != 'block';
  final striker = melee ? nodeStriker(style, sw.node, sw.key) : null;
  var dir = unit.facing.toDouble();
  if (melee && nodeFlip(style, sw.node, sw.key, a)) dir = -dir;
  final col = _hexCache[color] ??= _hex(color);

  b.save();
  b.alpha = alpha;
  b.translate(x, y);
  final shook = rt - unit.hitAt;
  if (!dead && shook >= 0 && shook < unit.hitStop) b.translate(math.sin(shook * 170) * 0.9 * (1 - shook / unit.hitStop) * scale, 0);
  b.scale(scale * dir * ud.size, scale * ud.size);

  if (dead) {
    final tilt = deathTilt(unit.deathFront, deadT), kk = tilt.abs() / 1.5708;
    b.alpha *= deadT > 0.72 ? math.max(0, 1 - (deadT - 0.72) / 0.28) : 1;
    b.ellipse(0, 0.6, (ud.shadowW != 0 ? ud.shadowW : 4) * (1 + kk * 0.5), 1.6, _shadow, 0.3);
    final land = deadT - (unit.deathFront ? 0.58 : 0.5);
    if (land > 0 && land < 0.3) _dust(b, unit.deathFront ? 9 : -9, land / 0.3, big ? 1.5 : 1);
    b.translate(tilt * (unit.deathFront ? 1.6 : 2.2), 0);
    b.rotate(tilt);
  } else if (unit.cState == 'down') {
    final an = downAngle(_CR.d('downTime') - (unit.cTimer - sub));
    b.ellipse(-3, 0.6, 5.5, 1.8, _shadow, 0.3);
    b.translate(an * 2.2, 0);
    b.rotate(an);
  } else {
    if (ud.ground == 'r') b.ring(0, 0.6, 6.4, 2.6, 0.9, 0xf0c04a, 0.8);
    if (ud.ground == 'boss') { final kk = 1 + math.sin(animT * 2.4) * 0.05; b.ring(0, 0.5, 10.5 * kk, 4.2 * kk, 1, 0xf0b64a, 0.9, 32, 0, 2 * math.pi, 1); }
    if (ud.ground == 'medic') b.ring(0, 0.5, 8.6, 3.4, 1, 0x78aae6, 0.75, 32, 0, 2 * math.pi, 1);
    if (ud.ground == 'cap') b.ring(0, 0.6, 6.4, 2.6, 0.9, 0xf0c04a, 0.8);
    if (sw != null && sw.ult) _ultGlow(b, a);
    if (sw != null && sw.node == 'F' && a > 0.16 && a < 0.6) _finisherGlow(b, a);
    final s = 1 - p[AIR] * 0.35, sw0 = ud.shadowW != 0 ? ud.shadowW : (ud.twoH ? 4.6 : 3.8);
    b.ellipse(0, 0.6, sw0 * s, 1.6 * s, _shadow, 0.3 * s);
  }

  if (melee && sw.key == 'spin' && sw.node == 'S1' && style != 'fists' && a > 0.34 && a < 0.62) {
    final g = (a - 0.34) / 0.28;
    b.ring(0, -5, 13 + g * 7, 5.5 + g * 2.6, 1.8, 0xffe08a, math.max(0, 1 - g) * 0.85, 24);
  }
  if (ghosts > 0 && striker != null && striker != 'w' && a >= 0.3 && a < 0.54) {
    for (var i = ghosts; i >= 1; i--) {
      final pa = nodePose(style, sw!.node, sw.key, a - i * 0.03, big);
      final al = 0.16 * (4 - i);
      if (striker == 'leg') {
        final (h1, h2, k1, k2, f1, f2) = _legOf(pa);
        b.line(h1, h2, k1, k2, ud.lw * 1.1, col, al); b.line(k1, k2, f1, f2, ud.lw * 1.1, col, al);
      } else {
        final (s1, s2, e1, e2) = _armOf(pa, striker == 'fh');
        b.line(s1, s2, e1, e2, ud.lw * 1.1, col, al);
      }
    }
  }
  if (ghosts > 0 && striker == 'w' && a >= 0.3 && a < 0.55 && ud.weapon) {
    final L = ud.tipLen != 0 ? ud.tipLen : (ud.twoH ? 8.6 : ud.wlen), butt = ud.butt != 0 ? ud.butt : 3.4;
    for (var i = ghosts; i >= 1; i--) {
      final pa = _twoHand(ud, nodePose(style, sw!.node, sw.key, a - i * 0.028, big));
      final dx = math.cos(pa[WA]), dy = math.sin(pa[WA]);
      final (_, _, hx, hy) = _armOf(pa, true);
      final s0x = ud.twoH ? hx - dx * butt : hx, s0y = ud.twoH ? hy - dy * butt : hy;
      b.line(s0x, s0y, hx + dx * L, hy + dy * L, ud.twoH ? 2.2 : 1.6, 0xf3eee2, 0.14 * (4 - i));
    }
  }

  final k = _Ctx(b, ud.parts, oy);
  _spriteBody(k, p, ud);

  if (sw != null && sw.stop) {
    if (striker == 'w' && ud.weapon) {
      final (tx, ty) = _tipOf(ud, k, p);
      b.line(k.hfX, k.hfY, tx, ty, 1.1, 0xffffff, 0.85);
      _star(b, tx, ty, 3.2, 0xffffff, 0.85);
    } else if (striker != null) {
      double qx, qy;
      if (striker == 'fh') { qx = k.hfX; qy = k.hfY; }
      else if (striker == 'bh') { qx = k.hbX; qy = k.hbY; }
      else { final l = _legOf(p); qx = l.$5; qy = l.$6; }
      _star(b, qx, qy, 3.6, 0xffffff, 0.9);
    }
  }
  if (striker == 'w' && sw!.landed && a >= 0.4 && a < 0.58 && ud.weapon) {
    final g = 1 - (a - 0.4) / 0.18;
    final (tx, ty) = _tipOf(ud, k, p);
    for (var i = 0; i < 6; i++) {
      final an = i * 1.047 + 0.3;
      b.line(tx, ty, tx + math.cos(an) * (2 + g * 3.6), ty + math.sin(an) * (2 + g * 3.6), 0.9, 0xffe08a, g * 0.95);
    }
    b.ellipse(tx, ty, 1.2 + g * 2.2, 1.2 + g * 2.2, 0xffecaa, g * 0.7 * 0.95);
  }
  if (!dead) {
    if (unit.hitFlash - sub > 0) {
      final al = math.min(1.0, (unit.hitFlash - sub) / 0.1) * 0.55;
      b.ellipse(k.chestX, k.chestY - 1, 5.5, 9, 0xffffff, al);
      b.ellipse(k.headX, k.headY, 3.6, 3.6, 0xffffff, al);
    }
    if (unit.cState == 'block' && unit.blockFlash > 0) {
      final g = unit.blockFlash / 0.2;
      b.ring(k.hfX + 3, k.hfY, 5 + (1 - g) * 6, 5 + (1 - g) * 6, 1.6, 0xbfe2ff, g, 8, -1.1, 1.1);
      for (var i = 0; i < 5; i++) {
        final an = -0.9 + i * 0.45;
        b.line(k.hfX + 4, k.hfY, k.hfX + 4 + math.cos(an) * (4 + (1 - g) * 5), k.hfY + math.sin(an) * (4 + (1 - g) * 5), 0.9, 0xffffff, g);
      }
    }
    if (unit.cState == 'stagger') {
      for (var i = 0; i < 3; i++) {
        final an = animT * 8 + i * 2.1, sx = k.headX + math.cos(an) * 4.6, sy = k.headY - 4.6 + math.sin(an) * 1.4;
        b.tri(sx - 1, sy, sx, sy - 1.6, sx + 1, sy, 0xffd66e);
        b.tri(sx - 1, sy, sx, sy + 1.6, sx + 1, sy, 0xffd66e);
      }
    }
  }
  b.restore();
}

void _ultGlow(TriBatch b, double a) {
  final g = a < 0.44 ? a / 0.44 : math.max(0, 1 - (a - 0.44) / 0.3);
  b.ellipse(0, -11, 9 + g * 4, 13 + g * 5, 0xffd66e, 0.35 * g * 0.55);
  b.ring(0, 0.6, 7 + g * 4, 2.8 + g * 1.6, 1.1, 0xffd66e, 0.8 * g * 0.95);
}

void _finisherGlow(TriBatch b, double a) {
  final g = math.min(1, (a - 0.16) / 0.18) * (a > 0.45 ? math.max(0, 1 - (a - 0.45) / 0.15) : 1);
  b.ellipse(0, -13, 9, 14, 0xffaa3c, 0.55 * g * 0.35);
  b.ring(0, -13, 9, 14, 1.2, 0xffd36a, 0.55 * g);
}

void _dust(TriBatch b, double x, double g, double s) {
  for (var i = 0; i < 3; i++) {
    final an = i * 2.1 + 0.6, d = (2 + g * 5) * s;
    b.ellipse(x + math.cos(an) * d * 1.4, -1 - g * 2 * s + math.sin(an) * d * 0.35, (2.2 + g * 2.6) * s, (1.2 + g * 1.2) * s, 0xcdbb98, 0.55 * (1 - g));
  }
}

// ===================== الوحدة كلها (drawUnit في units.js) =====================
final _detailZoom = PERFORMANCE.d('unitDetailZoom');
final _speedLinesAbove = _CR.d('speedLinesAbove');
void drawUnit(TriBatch b, UnitAtlas atlas, Unit unit, double alpha, double zoom, double time, bool crowded) {
  final i = unit.prevX + (unit.x - unit.prevX) * alpha, j = unit.prevY + (unit.y - unit.prevY) * alpha;
  final x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
  final dead = unit.state == 'dead';
  final color = artColor(unit);
  if (!dead && zoom < _detailZoom) {
    final size = unit.champion ? 6.0 : unit.hero != null ? 5.0 : 4.0;
    b.rect(x - size / 2, y - size, size, size, _hexCache[color] ??= _hex(color));
    return;
  }
  final key = artKey(unit), scale = artScale(unit), walking = isWalking(unit);
  final full = unit.lod == 'full';
  final sub = alpha * TICK_SEC;
  if (!dead) {
    final vi = unit.cState == 'dodge' ? unit.dvx : unit.vx, vj = unit.cState == 'dodge' ? unit.dvy : unit.vy;
    final speed = math.sqrt(vi * vi + vj * vj);
    if (speed > _speedLinesAbove) _speedLines(b, x, y, (vi - vj) * TILE_HALF_W, (vi + vj) * TILE_HALF_H, speed, scale);
  }
  if (full && unit.cState == 'dodge') {
    for (var g = 1; g <= 2; g++) {
      final di = unit.dvx * 0.035 * g, dj = unit.dvy * 0.035 * g;
      drawOne(b, atlas, unit, key, x - (di - dj) * TILE_HALF_W, y - (di + dj) * TILE_HALF_H, scale, color, time, walking, 0, 0.18, sub);
    }
  }
  final ghosts = full ? (crowded ? _CR.i('trailGhostsCrowded') : _CR.i('trailGhosts')) : 0;
  final ring = dead ? null : unit.steadyUntil > time ? nations.m('fx').s('steadyRing') : unit.bribedUntil > time ? nations.m('fx').s('bribeRing')
      : unit.rallyUntil > time ? CITY_FEATURES.m('cathedral').s('ring') : null;
  if (ring != null) b.ring(x, y + 0.6, 6.2 * scale, 2.5 * scale, 0.9, _hex(ring));
  drawOne(b, atlas, unit, key, x, y, scale, color, time, walking, ghosts, 1, sub);
  if (dead) return;
  final bar = unit.hp < unit.maxHp || unit.selected || unit.champion;
  if (bar) _healthBar(b, unit, x, y, color);
  final ult = truthy(unit.stats['ult']);
  final ready = ult && unit.ultCharge >= ULT.d('max');
  if (ult && (unit.selected || ready)) _chargeBar(b, unit, x, y, bar);
  if (ready) _readyStar(b, x, y, time);
}

void _speedLines(TriBatch b, double x, double y, double vx, double vy, double speed, double sc) {
  var v = math.sqrt(vx * vx + vy * vy);
  if (v == 0) v = 1;
  final nx = -vx / v, ny = -vy / v, k = math.min(1.0, (speed - _speedLinesAbove) / 5.33);
  for (var i = 0; i < 3; i++) {
    final oy = (i - 1) * 7 * sc, ox = -ny * oy, oyy = nx * oy, L = (10 + i * 4) * sc * k;
    b.line(x + ox + nx * 6 * sc, y - 14 * sc + oyy + ny * 6 * sc, x + ox + nx * (6 * sc + L), y - 14 * sc + oyy + ny * (6 * sc + L), 1.2 * sc, 0x5b554c, 0.5 * k);
  }
}

double _barTop(Unit unit) => unit.barY != 0 ? unit.barY : unit.champion ? _ART.d('championHealthBarY') : unit.hero != null ? _ART.d('heroHealthBarY') : _ART.d('healthBarY');

void _healthBar(TriBatch b, Unit unit, double x, double y, String color) {
  final w = unit.champion ? 8.0 : unit.hero != null ? 6.5 : 5.0, h = 1.1;
  final top = y + _barTop(unit), ratio = math.max(0.0, unit.hp / unit.maxHp);
  b.rect(x - w / 2, top, w, h, 0x141210, 0.75);
  b.rect(x - w / 2, top, w * ratio, h, _hexCache[color] ??= _hex(color));
}

void _chargeBar(TriBatch b, Unit unit, double x, double y, bool under) {
  final w = unit.champion ? 8.0 : unit.hero != null ? 6.5 : 5.0;
  final top = y + _barTop(unit) + (under ? _ART.d('chargeBarGap') : 0);
  final ratio = math.max(0.0, math.min(1.0, unit.ultCharge / ULT.d('max')));
  b.rect(x - w / 2, top, w, 0.9, 0x141210, 0.75);
  b.rect(x - w / 2, top, w * ratio, 0.9, ratio >= 1 ? 0xffe08a : 0xc99a2e);
}

void _readyStar(TriBatch b, double x, double y, double time) {
  final pulse = 0.85 + 0.15 * math.sin(time * 6), r = _ART.d('starSize') * pulse, inner = r * 0.42, top = y + _ART.d('starY');
  final pts = <double>[];
  for (var k = 0; k < 10; k++) {
    final angle = -math.pi / 2 + k * math.pi / 5, rad = k.isOdd ? inner : r;
    pts..add(x + math.cos(angle) * rad)..add(top + math.sin(angle) * rad);
  }
  for (var k = 0; k < 10; k++) { b.tri(x, top, pts[k * 2], pts[k * 2 + 1], pts[(k + 1) % 10 * 2], pts[(k + 1) % 10 * 2 + 1], 0xffe08a); }
}

// دائرة التحديد عند القدمين (فوق كل شيء)
void drawSelectionRing(TriBatch b, Unit unit, double alpha) {
  final i = unit.prevX + (unit.x - unit.prevX) * alpha, j = unit.prevY + (unit.y - unit.prevY) * alpha;
  b.ring((i - j) * TILE_HALF_W, (i + j) * TILE_HALF_H, 5.5, 2.8, 1, 0xf3ead6, 1, 20);
}
