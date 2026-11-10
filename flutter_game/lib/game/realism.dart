// القتال الواقعي (js/game/realism.js) سطراً بسطر: الحركات والرؤية ورد الفعل والتفادي والصدّ والزاوية
// والترنّح والارتداد والالتفاف والاصطدام ومستويات التفصيل. الزوايا بـ fatan2/fsin/fcos (مطابقة لـ V8)
import 'dart:math' as math;

import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/exact.dart';
import '../data/js_config.dart';
import 'alerts.dart';
import 'spatial.dart';
import 'state.dart';

final J CR = COMBAT_REALISM;
const _pi = math.pi;

double wrapAngle(double a) {
  while (a > _pi) { a -= 6.283185307; }
  while (a < -_pi) { a += 6.283185307; }
  return a;
}

double Function() _rng32(int seed) {
  var s = seed & 0xFFFFFFFF;
  return () {
    s = (s + 0x6D2B79F5) & 0xFFFFFFFF;
    var t = ((s ^ (s >> 15)) * (1 | s)) & 0xFFFFFFFF;
    t = ((t + (((t ^ (t >> 7)) * (61 | t)) & 0xFFFFFFFF)) & 0xFFFFFFFF) ^ t;
    return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296;
  };
}

double _spread(double Function() rng, List<Object?> ab) {
  final a = (ab[0] as num).toDouble(), b = (ab[1] as num).toDouble();
  return a + (b - a) * rng();
}

const _stylePrefix = {'crows': 'crow', 'hammers': 'hammer', 'vipers': 'viper', 'scorpions': 'scorpion', 'police': 'police'};

FightStyleInfo _styleOf(Unit unit) {
  final prefix = _stylePrefix[unit.gang] ?? 'crow';
  final kind = unit.champion ? 'champion' : (unit.hero ?? 'common');
  final gangs = COMBAT_STYLE.m('gangs'), units = COMBAT_STYLE.m('units');
  final gang = gangs.mm(unit.gang) ?? gangs.m('crows');
  final own = units.mm('${prefix}_$kind') ?? units.mm('${prefix}_common') ?? const <String, Object?>{};
  return FightStyleInfo(
    own.has('turn') ? own.d('turn') : gang.d('turn'),
    own.has('flank') ? own.d('flank') : gang.d('flank'),
    own.has('moves') ? own.l('moves').cast<String>() : const ['quick'],
    own.b('block'),
    own.ss('primary'),
  );
}

// الوحدة تحمل مولّدها كدالة (unit.rng)
void initRealism(MatchState state, Unit unit) {
  final rng = _rng32(((unit.id * 2654435761) & 0xFFFFFFFF) ^ state.combatSeed);
  unit.style = _styleOf(unit);
  unit.rng = rng;
  final tr = CR.m('traits');
  unit.traits = Traits(_spread(rng, tr.l('aggr')), _spread(rng, tr.l('dodgeSkill')), _spread(rng, tr.l('react')),
      _spread(rng, tr.l('spd')), _spread(rng, tr.l('size')));
  unit.faceAngle = 0;
  unit.cState = null;
  unit.cTimer = 0;
  unit.cMove = null;
  unit.cMoveT = 0;
  unit.cPhases = null;
  unit.sight = null;
  unit.stamina = _stMax;
  unit.dodgeCd = 0;
  unit.vx = 0; unit.vy = 0;
  unit.dvx = 0; unit.dvy = 0;
  unit.bumpCd = 0;
  unit.blockFlash = 0;
  unit.dodgeType = 'leap';
  unit.flinch = 0;
  unit.flinchBack = false;
  unit.combo = false;
  unit.rolling = false;
  unit.lod = 'full';
  unit.lodAt = 0;
  unit.cNode = null;
  unit.chainAt = -1e9;
  unit.approachAt = -1e9;
  unit.approachSince = -1e9;
  unit.landAt = -1e9;
  unit.hitDoneAt = -1e9;
  unit.hitAt = -1e9;
  unit.hitStop = 0;
  unit.hitStyle = '';
  unit.hitNode = '';
  unit.deathFront = false;
}

// بعد تحميل مباراة محفوظة (restoreRng في realism.js): الأسلوب من الوحدة، ومولّد جديد ببذرة الزمن، والسمات المحفوظة
void restoreRealism(MatchState state, Unit unit, Traits traits) {
  unit.style = _styleOf(unit);
  unit.rng = _rng32(((unit.id * 2654435761) & 0xFFFFFFFF) ^ state.combatSeed ^ ((state.time * 1000).floor() & 0xFFFFFFFF));
  unit.traits = traits;
}

final _stMax = CR.d('stMax');
final _moves = CR.m('moves');
final _moveTimeBase = CR.d('moveTimeBase');

Phases moveTiming(String key, double baseAttackTime) {
  final m = _moves.m(key);
  final scale = baseAttackTime / _moveTimeBase;
  return Phases(m.d('wind') * scale, m.d('strike') * scale, m.d('hold') * scale, m.d('rec') * scale,
      (m.d('wind') + m.d('strike') + m.d('hold') + m.d('rec')) * scale);
}

final _frontHalf = CR.d('frontHalf'), _sideHalf = CR.d('sideHalf');
String zoneOf(Unit target, double fromX, double fromY) {
  final d = wrapAngle(fatan2(fromY - target.y, fromX - target.x) - target.faceAngle).abs();
  return d <= _frontHalf ? 'front' : d <= _sideHalf ? 'side' : 'back';
}

double zoneDamage(String zone) => CR.m('dmgMul').d(zone);

bool _inRecovery(Unit unit) {
  if (unit.cState == 'stagger' || unit.cState == 'down') return true;
  if (unit.cMove == null || unit.cPhases == null) return false;
  final p = unit.cPhases!;
  return unit.cMoveT > p.wind + p.strike + p.hold;
}

final _reachBonus = CR.d('reachBonus'), _primaryBonus = CR.d('primaryBonus'), _jitter = CR.d('jitter');
String? chooseMove(Unit unit, Unit target, double dist, int nearCount, double range) {
  String? best;
  var bestScore = -1e9;
  final low = unit.hp / unit.maxHp < 0.3;
  for (final key in unit.style.moves) {
    final m = _moves.m(key);
    if (dist > range + m.d('rangeAdd') + _reachBonus) continue;
    double score = 1;
    if (key == 'quick') score = 1.0 + (low ? 1.0 : 0);
    if (key == 'heavy') score = 0.8 + (_inRecovery(target) ? 2.0 : 0) + (unit.traits.aggr - 1) * 0.8 - (low ? 0.5 : 0);
    if (key == 'thrust') score = 0.6 + (dist > range * 0.8 ? 1.2 : 0);
    if (key == 'spin') score = 0.2 + (nearCount >= 3 ? 2.5 : nearCount == 2 ? 0.6 : 0);
    if (key == 'punch') score = 0.9 + (dist < range * 0.7 ? 1.0 : 0);
    if (key == 'kick_front') score = 0.7 + (dist < range * 0.6 ? 0.9 : 0);
    if (key == 'kick_high') score = 0.45 + (_inRecovery(target) ? 1.4 : 0) + (unit.traits.aggr - 1) * 0.8;
    if (unit.combo) score += m.b('unarmed') ? -0.8 : 1.2;
    if (key == unit.style.primary) score += _primaryBonus;
    final kicks = unit.stats['kicks'];
    if (truthy(kicks) && (key == 'kick_front' || key == 'kick_high')) score += ((kicks as J).d('prefer'));
    score *= 1 + (unit.rng() * 2 - 1) * _jitter;
    if (score > bestScore) { bestScore = score; best = key; }
  }
  return best;
}

// --- أنميشن القتال حسب السلاح (للرسم وحده) ---
String fightStyle(Unit unit) {
  final w = FIGHT.m('weapons');
  final table = w.mm(unit.nation ?? '') ?? w.mm(unit.gang) ?? w.m('crows');
  return table.ss(unit.champion ? 'champion' : (unit.hero ?? 'common')) ?? 'blade';
}

bool fightBig(Unit unit) => !unit.champion && truthy(FIGHT.m('big')[unit.hero ?? '']);

final Map<String, List<String>> _leaderChain = {
  for (final e in FIGHT.m('styles').entries) e.key: [...(e.value as J).l('chain').cast<String>(), 'L4']
};
final _special = FIGHT.l('special').cast<String>();

String fightNode(MatchState state, Unit unit, String key, Unit? target) {
  final name = fightStyle(unit), style = FIGHT.m('styles').m(name);
  String? special;
  for (final k in _special) { if (unit.style.moves.contains(k)) { special = k; break; } }
  if (unit.champion && target != null && target.hp <= target.maxHp * FIGHT.d('finisherHp') && (key == 'heavy' || key == special)) return 'F';
  if (style.l('dash').contains(key) && state.time - unit.approachAt <= FIGHT.d('dashWindow') &&
      unit.approachAt - unit.approachSince >= FIGHT.d('dashMin')) return 'D';
  if (key == 'heavy') return 'H1';
  if (key == special) return 'S1';
  if (style.l('light').contains(key)) {
    final chain = unit.champion ? _leaderChain[name]! : style.l('chain').cast<String>();
    if (state.time - unit.chainAt > FIGHT.d('window')) return chain[0];
    if (unit.cNode == 'P') return chain[1];
    return chain[(chain.indexOf(unit.cNode ?? '') + 1) % chain.length];
  }
  return key == 'punch' ? 'P' : key == 'kick_front' ? 'KF' : key == 'kick_high' ? 'KH' : key == 'spin' ? 'S1' : 'D';
}

const _nodeGroup = {'L1': 'light', 'L2': 'light', 'L3': 'light', 'L4': 'light', 'D': 'dash', 'P': 'punch', 'KF': 'kick_front',
  'KH': 'kick_high', 'H1': 'heavy', 'S1': 'special', 'F': 'finisher'};
double hitstopOf(String style, String node, bool big) {
  final hs = FIGHT.m('hitstop'), mul = FIGHT.m('hitstopMul');
  final g = _nodeGroup[node];
  final s = (truthy(hs[style]) ? hs.d(style) : hs.d('blade')) *
      (g != null && truthy(mul[g]) ? mul.d(g) : 1) * (big ? FIGHT.d('hitstopBig') : 1);
  return math.min(FIGHT.d('hitstopMax'), s);
}

// --- الرؤية المعلّقة ---
void registerSight(MatchState state, Unit attacker, Unit? target, [bool ranged = false]) {
  if (target == null || target.state == 'dead' || target.hp <= 0) return;
  if (target.sight != null) return;
  if (target.cState != null) return;
  if (target.lod == 'stat' || target.lod == 'simple') return;
  final night = state.weather == 'night' ? CR.d('nightReact') : 0;
  target.sight = Sight(state.time + target.traits.react + night, attacker, ranged);
}

void _beginDodge(MatchState state, Unit unit, Unit attacker) {
  final mv = attacker.cMove;
  unit.dodgeType = (mv == 'thrust' || mv == 'kick_front') ? 'leap'
      : mv == 'kick_high' ? 'duck' : (unit.rng() < CR.d('duckChance') ? 'duck' : 'leap');
  final away = fatan2(unit.y - attacker.y, unit.x - attacker.x) + (unit.rng() * 2 - 1) * 1.2;
  final speed = CR.d('dodgeDist') / CR.d('dodgeTime') * (unit.dodgeType == 'duck' ? CR.d('duckSpeed') : 1);
  _cancelSwing(unit);
  unit.cState = 'dodge';
  unit.cTimer = CR.d('dodgeTime');
  unit.dvx = fcos(away) * speed;
  unit.dvy = fsin(away) * speed;
  unit.stamina -= CR.d('dodgeCost');
  unit.dodgeCd = CR.d('dodgeCd');
  state.combatEvents['dodge'] = state.combatEvents['dodge']! + 1;
  addPop(state, unit, 'تفادى!', 'dodge');
}

void _beginBlock(MatchState state, Unit unit) {
  _cancelSwing(unit);
  unit.cState = 'block';
  unit.cTimer = CR.d('blockTime');
  unit.stamina -= CR.d('blockCost');
  state.combatEvents['block'] = state.combatEvents['block']! + 1;
  addPop(state, unit, 'صدّ!', 'block');
}

void _cancelSwing(Unit unit) {
  unit.cMove = null;
  unit.cPhases = null;
  unit.pendingHit = null;
  unit.attackStart = null;
  unit.chainAt = -1e9;
}

void tryReact(MatchState state, Unit unit, Unit? attacker, bool ranged) {
  if (attacker == null || attacker.state == 'dead' || attacker.hp <= 0) return;
  if (attacker.cMove == null && !ranged) return;
  if (unit.invulnUntil > state.time) return;
  final earlyWind = unit.cMove != null && unit.cPhases != null && unit.cMoveT < unit.cPhases!.wind * 0.5;
  if (unit.cState != null || (unit.cMove != null && !earlyWind)) return;
  final zone = zoneOf(unit, attacker.x, attacker.y);
  var mul = CR.m('angleMul').d(zone);
  if (mul <= 0) return;
  if (!ranged && unit.style.block && zone == 'front' && unit.stamina >= CR.d('blockCost') &&
      (unit.alwaysBlock || unit.rng() < CR.d('blockBase') * unit.traits.skill)) {
    _beginBlock(state, unit);
    return;
  }
  if (ranged) mul *= CR.d('projectileDodge');
  final dodge = unit.stats['dodge'];
  final base = truthy(dodge) ? CR.d('dodgeBase') * unit.traits.skill + (dodge as num) : CR.d('dodgeBase') * unit.traits.skill;
  if (unit.stamina >= CR.d('dodgeCost') && unit.dodgeCd <= 0 && unit.rng() < base * mul) {
    _beginDodge(state, unit, attacker);
  }
}

final _friction = CR.d('friction');
void knockback(Unit unit, double fromX, double fromY, double tiles) {
  if (tiles == 0 || tiles.isNaN) return;
  if (unit.hardened) return;
  final angle = fatan2(unit.y - fromY, unit.x - fromX);
  final v = tiles * _friction;
  unit.vx += fcos(angle) * v;
  unit.vy += fsin(angle) * v;
}

void stagger(MatchState state, Unit unit, double seconds) {
  if (unit.invulnUntil > state.time) return;
  if (unit.steadyUntil > state.time) return;
  _cancelSwing(unit);
  unit.sight = null;
  unit.cState = 'stagger';
  unit.cTimer = seconds;
  state.combatEvents['stagger'] = state.combatEvents['stagger']! + 1;
}

void blockedBy(MatchState state, Unit attacker, Unit blocker) {
  blocker.blockFlash = 0.2;
  stagger(state, attacker, CR.d('staggerBlocked'));
  knockback(attacker, blocker.x, blocker.y, 0.5);
}

void corpseKnock(MatchState state, Unit target, Unit attacker, String? moveKey) {
  final big = moveKey == 'heavy' || moveKey == 'spin';
  if (big && state.rollingCorpses >= CR.i('maxRagdolls')) return;
  knockback(target, attacker.x, attacker.y, big ? CR.d('corpseKnockBig') : CR.d('corpseKnockSmall'));
  if (big) { target.rolling = true; state.rollingCorpses++; state.combatEvents['roll'] = state.combatEvents['roll']! + 1; }
}

final _turnWhileAttacking = CR.d('turnWhileAttacking');
double turnToward(Unit unit, double targetX, double targetY, double seconds) {
  final want = fatan2(targetY - unit.y, targetX - unit.x);
  final delta = wrapAngle(want - unit.faceAngle);
  final rate = unit.cMove != null ? math.min(unit.style.turn, _turnWhileAttacking) : unit.style.turn;
  final step = rate * seconds;
  unit.faceAngle = wrapAngle(unit.faceAngle + math.max(-step, math.min(step, delta)));
  return wrapAngle(want - unit.faceAngle).abs();
}

void faceAngleTo(Unit unit, double targetX, double targetY) {
  unit.faceAngle = fatan2(targetY - unit.y, targetX - unit.x);
}

final approach = Point2(0, 0);
Point2 approachPoint(Unit unit, Unit target, double range) {
  final R = range * 0.85;
  final tt = target.target;
  final engagedElse = tt != null && tt != unit && tt.state != 'dead' && tt.hp > 0;
  final weight = engagedElse ? unit.style.flank : unit.style.flank * 0.25;
  final bx = target.x - fcos(target.faceAngle) * R;
  final by = target.y - fsin(target.faceAngle) * R;
  final ang = fatan2(unit.y - target.y, unit.x - target.x);
  final fx = target.x + fcos(ang) * R;
  final fy = target.y + fsin(ang) * R;
  approach.x = fx + (bx - fx) * weight;
  approach.y = fy + (by - fy) * weight;
  return approach;
}

final _busyBonus = CR.d('busyBonus');
double busyBonus(Unit unit, Unit other) {
  final ot = other.target;
  final busy = ot != null && ot != unit && ot.state != 'dead' && ot.hp > 0;
  return busy ? _busyBonus * unit.style.flank : 0;
}

final _crowdRadius = CR.d('crowdRadius');
int crowdCount(MatchState state, Unit unit, bool Function(MatchState, Unit, Unit) isEnemyFn) {
  var count = 0;
  forEachNearby(state, unit.x, unit.y, _crowdRadius, (other) {
    if (other == unit || other.state == 'dead' || other.hp <= 0) return;
    final dx = other.x - unit.x, dy = other.y - unit.y;
    if (dx * dx + dy * dy > _crowdRadius * _crowdRadius) return;
    if (!isEnemyFn(state, unit, other)) return;
    count++;
  });
  return count;
}

final _stRegen = CR.d('stRegen');
bool updateRealism(MatchState state, Unit unit) {
  final map = state.map;
  unit.blockFlash = math.max(0, unit.blockFlash - TICK_SEC);
  unit.flinch = math.max(0, unit.flinch - TICK_SEC);
  unit.bumpCd = math.max(0, unit.bumpCd - TICK_SEC);
  if (unit.vx != 0 || unit.vy != 0) {
    final nx = unit.x + unit.vx * TICK_SEC;
    final ny = unit.y + unit.vy * TICK_SEC;
    if (map.isWalkable(jsRound(nx), jsRound(ny))) { unit.x = nx; unit.y = ny; } else { unit.vx = 0; unit.vy = 0; }
    unit.vx *= FRICTION_DECAY; unit.vy *= FRICTION_DECAY;
    if (unit.vx.abs() < 0.01 && unit.vy.abs() < 0.01) {
      unit.vx = 0; unit.vy = 0;
      releaseRagdoll(state, unit);
    }
  }
  if (unit.state == 'dead') return true;
  unit.hardened = unit.invulnUntil > state.time || unit.holdUntil > state.time;
  if (unit.cState != 'dodge') unit.stamina = math.min(_stMax, unit.stamina + _stRegen * TICK_SEC);
  unit.dodgeCd = math.max(0, unit.dodgeCd - TICK_SEC);
  final sight = unit.sight;
  if (sight != null && state.time >= sight.at) {
    unit.sight = null;
    tryReact(state, unit, sight.from, sight.ranged);
  }
  if (unit.cState == null) return false;
  if (unit.cState == 'dodge') {
    final nx = unit.x + unit.dvx * TICK_SEC;
    final ny = unit.y + unit.dvy * TICK_SEC;
    if (map.isWalkable(jsRound(nx), jsRound(ny))) { unit.x = nx; unit.y = ny; }
  }
  unit.cTimer -= TICK_SEC;
  if (unit.cTimer <= 0) { unit.cState = null; unit.dvx = 0; unit.dvy = 0; }
  return true;
}

void releaseRagdoll(MatchState state, Unit unit) {
  if (!unit.rolling) return;
  unit.rolling = false;
  state.rollingCorpses = math.max(0, state.rollingCorpses - 1);
}

final _bumpSpeed = CR.d('bumpSpeed');
void updateBumps(MatchState state, bool Function(MatchState, Unit, Unit) isEnemyFn) {
  final units = state.units;
  for (var k = 0; k < units.length; k++) {
    final unit = units[k];
    final speed = hypot(unit.vx, unit.vy);
    if (speed <= _bumpSpeed || unit.bumpCd > 0) continue;
    _bumpFrom(state, unit, isEnemyFn);
  }
}

void _bumpFrom(MatchState state, Unit unit, bool Function(MatchState, Unit, Unit) isEnemyFn) {
  final dead = unit.state == 'dead';
  forEachNearby(state, unit.x, unit.y, _crowdRadius, (other) {
    if (other == unit || unit.bumpCd > 0) return;
    if (other.state == 'dead' || other.hp <= 0) return;
    final dx = other.x - unit.x, dy = other.y - unit.y;
    if (dx * dx + dy * dy > 0.45 * 0.45) return;
    if (dead) {
      other.vx += unit.vx * 0.4; other.vy += unit.vy * 0.4;
      unit.vx *= 0.6; unit.vy *= 0.6;
      unit.bumpCd = CR.d('corpseBumpCd');
      return;
    }
    if (isEnemyFn(state, unit, other)) return;
    if (other.cState == 'stagger' || other.cState == 'dodge') return;
    if (other.invulnUntil > state.time) return;
    stagger(state, other, CR.d('staggerBump'));
    other.vx += unit.vx * 0.5; other.vy += unit.vy * 0.5;
    unit.vx *= 0.5; unit.vy *= 0.5;
    unit.bumpCd = CR.d('bumpCd');
    state.combatEvents['bump'] = state.combatEvents['bump']! + 1;
    addPop(state, other, 'اصطدام!', 'bump');
  });
}

// --- مستويات التفصيل (القسم 5.4.5) من كاميرا هذا الجهاز ---
final _lod = CR.m('lod');
class _Vis { final Unit unit; final double d; _Vis(this.unit, this.d); }
void updateLod(MatchState state) {
  if (state.time < state.lodAt) return;
  state.lodAt = state.time + _lod.d('refreshSeconds');
  final cx = state.camera.x, cy = state.camera.y;
  final visible = <_Vis>[];
  var alive = 0;
  for (final unit in state.units) {
    if (unit.state != 'dead') alive++;
    if (!onScreen(state, unit.x, unit.y, 40)) { unit.lod = 'stat'; continue; }
    unit.lod = 'simple';
    final wx = (unit.x - unit.y) * 18, wy = (unit.x + unit.y) * 9;
    final dx = wx - cx, dy = wy - cy;
    visible.add(_Vis(unit, dx * dx + dy * dy));
  }
  final fullUnits = alive > _lod.i('crowdedAbove') ? _lod.i('fullUnitsCrowded') : _lod.i('fullUnits');
  state.lodCrowded = visible.length > fullUnits;
  if (visible.length <= fullUnits) {
    for (final v in visible) { v.unit.lod = 'full'; }
    return;
  }
  stableSort<_Vis>(visible, (a, b) => byNum(a.d, b.d));
  for (var k = 0; k < fullUnits; k++) { visible[k].unit.lod = 'full'; }
}

final statDamageFactor = _lod.d('offScreenDamage');

double attackPause(Unit unit) => (CR.d('pauseMin') + unit.rng() * CR.d('pauseRandom')) / unit.traits.aggr;

// --- الكلمات الطائرة ---
final _popColors = CR.m('pops').m('colors');
final _popMax = CR.m('pops').i('max');
void addPop(MatchState state, Unit unit, String text, String kind) {
  if (unit.lod == 'stat') return;
  state.pops.add(Pop(unit.x, unit.y, text, _popColors.s(kind)));
  if (state.pops.length > _popMax) state.pops.removeAt(0);
}

void addUltFx(MatchState state, String kind, double x, double y, [double r = 1, String color = '#e6c25a']) {
  state.ultFx.add(Fx(kind: kind, x: x, y: y, r: r, color: color));
}

final _nationFx = nations.m('fx');
void updatePops(MatchState state) {
  if (state.ultFx.isNotEmpty) {
    for (final fx in state.ultFx) { fx.t += TICK_SEC; }
    state.ultFx.removeWhere((fx) => !(fx.t < _nationFx.d('${fx.kind}Seconds')));
  }
  if (state.pops.isNotEmpty) {
    for (final pop in state.pops) { pop.t += TICK_SEC; }
    final s = CR.m('pops').d('seconds');
    state.pops.removeWhere((p) => !(p.t < s));
  }
  if (state.fx.isNotEmpty) {
    for (final fx in state.fx) { fx.t += TICK_SEC; }
    final b = CR.d('burstSeconds');
    state.fx.removeWhere((fx) => !(fx.t < (fx.life != 0 ? fx.life : b)));
  }
  if (state.clashes.isNotEmpty) {
    for (final fx in state.clashes) { fx.t += TICK_SEC; }
    final c = CR.d('clashFxSeconds');
    state.clashes.removeWhere((fx) => !(fx.t < c));
  }
}

void flinch(Unit unit, double fromX, double fromY, bool fromBack, [bool push = true]) {
  unit.flinch = CR.d('flinchTime');
  unit.flinchBack = fromBack;
  if (push) knockback(unit, fromX, fromY, CR.d('flinchKnock'));
}

bool tryClash(MatchState state, Unit unit, Unit target) {
  if (target.cMove == null || target.cPhases == null || target.pendingHit == null) return false;
  if (target.target != unit) return false;
  if (zoneOf(target, unit.x, unit.y) != 'front' || zoneOf(unit, target.x, target.y) != 'front') return false;
  final hitAt = target.cPhases!.wind + target.cPhases!.strike * CR.d('strikeMoment');
  if ((target.cMoveT - hitAt).abs() > CR.d('clashWindow')) return false;
  final bonus = math.max((unit.stats['clashBonus'] as num? ?? 0).toDouble(), (target.stats['clashBonus'] as num? ?? 0).toDouble());
  if (unit.rng() >= (bonus != 0 ? CR.d('clashChance') + bonus : CR.d('clashChance'))) return false;
  for (final pair in [[unit, target], [target, unit]]) {
    stagger(state, pair[0], CR.d('clashStagger'));
    knockback(pair[0], pair[1].x, pair[1].y, CR.d('clashKnock'));
  }
  final mx = (unit.x + target.x) / 2, my = (unit.y + target.y) / 2;
  state.clashes.add(Fx(x: mx, y: my));
  state.combatEvents['clash'] = state.combatEvents['clash']! + 1;
  if (unit.lod != 'stat') {
    state.pops.add(Pop(mx, my, 'تصادم!', _popColors.s('clash')));
    if (state.pops.length > _popMax) state.pops.removeAt(0);
  }
  return true;
}

bool knockDown(MatchState state, Unit unit, double fromX, double fromY, double tiles) {
  if (unit.invulnUntil > state.time) return false;
  if (unit.steadyUntil > state.time) return false;
  _cancelSwing(unit);
  unit.sight = null;
  unit.combo = false;
  unit.cState = 'down';
  unit.cTimer = CR.d('downTime');
  knockback(unit, fromX, fromY, tiles);
  state.combatEvents['down'] = state.combatEvents['down']! + 1;
  addPop(state, unit, 'سقط!', 'down');
  return true;
}

const _fxHeight = {'kick_high': 22.0, 'kick_front': 12.0};
const _fxBig = {'heavy', 'kick_high', 'spin', 'kick_front'};
void addBurst(MatchState state, Unit attacker, Unit target, String? move, [bool echo = false]) {
  if (attacker.lod == 'stat' && target.lod == 'stat') return;
  final dx = target.x - attacker.x, dy = target.y - attacker.y;
  var d = math.sqrt(dx * dx + dy * dy);
  if (d == 0 || d.isNaN) d = 1;
  state.fx.add(Fx(x: (target.x * 2 + attacker.x) / 3, y: (target.y * 2 + attacker.y) / 3,
      big: _fxBig.contains(move), h: _fxHeight[move] ?? 16,
      style: fightStyle(attacker), node: attacker.cNode ?? '', bigA: fightBig(attacker), life: FIGHT.m('quake').d('seconds'),
      dx: dx / d, dy: dy / d, echo: echo));
}
