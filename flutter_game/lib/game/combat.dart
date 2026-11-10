// الهجوم التلقائي وأمر الهجوم والمقذوفات والضرر والموت (js/game/combat.js سطراً بسطر)
import 'dart:math' as math;

import '../audio/sound.dart';
import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/exact.dart' show COMBO_POW;
import '../data/js_config.dart';
import '../map/pathfinding.dart';
import 'abilities.dart';
import 'alerts.dart';
import 'features.dart';
import 'realism.dart';
import 'spatial.dart';
import 'state.dart';
import 'ults.dart';
import 'units.dart';
import 'weather.dart';

// اختيار الهدف للبوتات: يعيد useDefaultTarget ليبقى الاختيار العادي (undefined في JavaScript)
final Unit useDefaultTarget = Unit.source(-99);
Unit? Function(MatchState, Unit, double)? targetPicker;
void setTargetPicker(Unit? Function(MatchState, Unit, double)? fn) { targetPicker = fn; }

Unit? _chooseTarget(MatchState state, Unit unit) {
  final picker = targetPicker;
  if (picker != null) {
    final picked = picker(state, unit, visionRange(state, unit));
    if (!identical(picked, useDefaultTarget)) return picked;
  }
  return _findNearestEnemy(state, unit);
}

bool isEnemy(MatchState state, Unit a, Unit b) {
  if (a.bribedUntil > state.time && a.bribedBy == b.playerId) return false;
  if (b.bribedUntil > state.time && b.bribedBy == a.playerId) return false;
  if (state.cityEvent != null && holiTruce(state, a, b)) return false;
  return isEnemyId(state, a.playerId, b.playerId);
}

bool isEnemyId(MatchState state, int a, int b) {
  if (a == b) return false;
  final pa = state.players[a], pb = state.players[b];
  if (pa.passive || pb.passive) return false;
  if (pa.friendOf == b || pb.friendOf == a) return false;
  final teamA = pa.team, teamB = pb.team;
  if (teamA != 0 && teamB != 0 && teamA == teamB) return false;
  return true;
}

bool isAlive(Unit? unit) => unit != null && unit.state != 'dead' && unit.hp > 0;
double _distance(Unit a, Unit b) {
  final dx = a.x - b.x, dy = a.y - b.y;
  return math.sqrt(dx * dx + dy * dy);
}
double _distTo(Unit a, Point2 b) {
  final dx = a.x - b.x, dy = a.y - b.y;
  return math.sqrt(dx * dx + dy * dy);
}
double _distanceSq(Unit a, Unit b) {
  final dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

void commandAttack(MatchState state, Iterable<Unit> units, Unit target) {
  for (final unit in units) {
    if (!isAlive(unit)) continue;
    unit.target = target;
    unit.commandedTarget = true;
    unit.state = 'attacking';
    unit.chaseOrigin = Point2(unit.x, unit.y);
    unit.repathTimer = 0;
    unit.path = [];
  }
}

void clearCombatOrders(Unit unit) {
  unit.target = null;
  unit.commandedTarget = false;
  unit.pendingHit = null;
  unit.attackMove = null;
}

final _scanTicks = math.max(1, jsRound(COMBAT.d('scanInterval') / TICK_SEC));
final _comboChance = CR.d('comboChance'), _comboPause = CR.d('comboPause');
final _crMoves = CR.m('moves');

void updateCombat(MatchState state) {
  final budget = [UNITS.i('pathRequestsPerTick')];
  final tick = jsRound(state.time / TICK_SEC);
  updateLod(state);
  updatePops(state);
  // بالفهرس كـ for...of في JavaScript: ما يُضاف أثناء الحلقة (استدعاء ضربة بطل) يُزار أيضاً
  final units = state.units;
  for (var k = 0; k < units.length; k++) {
    final unit = units[k];
    if (unit.hitFlash > 0) unit.hitFlash -= TICK_SEC;
    if (unit.hurtTimer > 0) unit.hurtTimer -= TICK_SEC;
    final reacting = updateRealism(state, unit);
    if (unit.state == 'dead') { unit.deathTimer -= TICK_SEC; continue; }
    if (reacting) continue;
    if (unit.attackCooldown > 0) unit.attackCooldown -= TICK_SEC;
    if (unit.cMove != null) {
      unit.cMoveT += TICK_SEC;
      if (unit.cMoveT >= unit.cPhases!.total) {
        final finished = unit.cMove!;
        unit.cMove = null;
        unit.cPhases = null;
        unit.chainAt = state.time;
        if (_crMoves.m(finished).b('unarmed') && finished != 'kick_high' && unit.rng() < _comboChance) {
          unit.combo = true;
          unit.attackCooldown = _comboPause;
          state.combatEvents['combo'] = state.combatEvents['combo']! + 1;
        } else {
          unit.combo = false;
          unit.attackCooldown = attackPause(unit);
        }
      }
    }
    chargeOverTime(state, unit);
    updateFlurry(state, unit);
    if (unit.pendingHit != null && state.time >= unit.pendingHit!.at) _resolveHit(state, unit);
    if (unit.pendingUlt != null && state.time >= unit.pendingUlt!.at) resolveUlt(state, unit);
    if (unit.state == 'moving') {
      if (unit.homePost != null) _blockedPolice(state, unit);
      continue;
    }
    if (unit.state == 'attacking' && !isAlive(unit.target)) {
      unit.commandedTarget = false;
      final next = _chooseTarget(state, unit);
      if (next != null) { _startAttack(unit, next, state); } else { _finishFight(state, unit); }
    }
    if ((unit.state == 'idle' || unit.state == 'attackMove') && !unit.harmless) {
      if ((tick + unit.id) % _scanTicks == 0) {
        final target = _chooseTarget(state, unit);
        if (target != null) _startAttack(unit, target, state);
      }
    }
    if (truthy(unit.stats['ult']) && tryCastUlt(state, unit)) continue;
    if (unit.state == 'attacking') _fightTarget(state, unit, budget);
  }
  _updateProjectiles(state);
  updateBumps(state, isEnemy);
}

void _resolveHit(MatchState state, Unit unit) {
  final hit = unit.pendingHit!;
  unit.pendingHit = null;
  unit.hitDoneAt = state.time;
  if (!isAlive(unit)) return;
  if (hit.ranged) { if (isAlive(hit.target)) _spawnVolley(state, unit, hit.target, hit.damage); return; }
  if (stormMiss(state, unit.playerId)) { addPop(state, unit, CITY_FEATURES.m('storm').s('pop'), 'miss'); return; }
  if (hit.move != null) { _resolveMove(state, unit, hit); return; }
  if (!isAlive(hit.target)) return;
  _strike(state, unit, hit.target, hit.damage);
  chargeOnHit(state, unit);
}

final _reachBonus = CR.d('reachBonus'), _arcTolerance = CR.d('arcTolerance');
final _flinchTime = CR.d('flinchTime'), _pushFlinch = CR.d('pushFlinch');

void _resolveMove(MatchState state, Unit unit, PendingHit hit) {
  final m = _crMoves.m(hit.move!);
  final reach = hit.range + m.d('rangeAdd') + _reachBonus;
  final targets = <Unit>[];
  if (hit.move == 'spin') {
    forEachNearby(state, unit.x, unit.y, reach, (other) {
      if (!isAlive(other) || other == unit) return;
      if (_distance(unit, other) > reach) return;
      if (!isEnemy(state, unit, other)) return;
      targets.add(other);
    });
  } else if (isAlive(hit.target)) {
    final target = hit.target;
    final off = wrapAngle(fatan2(target.y - unit.y, target.x - unit.x) - unit.faceAngle).abs();
    if (_distance(unit, target) <= reach && off <= m.d('arc') * math.pi / 360 + _arcTolerance) targets.add(target);
  }
  if (targets.length == 1 && hit.move != 'spin' && unit.lod != 'stat' && tryClash(state, unit, targets[0])) {
    soundAt(state, 'hit_shield', targets[0].x, targets[0].y);
    return;
  }
  var landed = false;
  final unarmed = m.b('unarmed');
  for (final target in targets) {
    final echo = landed;
    if (target.cState == 'dodge') continue;
    final zone = zoneOf(target, unit.x, unit.y);
    if (target.cState == 'block' && zone == 'front') {
      blockedBy(state, unit, target);
      soundAt(state, 'hit_shield', target.x, target.y);
      return;
    }
    final lodFactor = unit.lod == 'stat' ? statDamageFactor : 1;
    final amount = hit.damage * zoneDamage(zone) * lodFactor;
    final ev = state.combatEvents;
    if (zone == 'back') { ev['back'] = ev['back']! + 1; addPop(state, target, 'من الخلف!', 'back'); }
    else if (zone == 'side') { ev['side'] = ev['side']! + 1; }
    if (unarmed) { final k = hit.move == 'punch' ? 'punch' : 'kick'; ev[k] = ev[k]! + 1; }
    addBurst(state, unit, target, hit.move, echo);
    ev['hits'] = ev['hits']! + 1;
    unit.landAt = state.time;
    target.hitAt = state.time;
    target.hitStyle = fightStyle(unit);
    target.hitNode = unit.cNode ?? '';
    target.hitStop = hitstopOf(target.hitStyle, target.hitNode, fightBig(unit));
    final died = (hit.move == 'spin' || unarmed) ? applyDamage(state, unit, target, amount) : _strike(state, unit, target, amount);
    landed = true;
    final s = unit.stats;
    if (died) {
      corpseKnock(state, target, unit, hit.move);
    } else if (!isAlive(target) || target.invulnUntil > state.time) {
      // تصلّب: لا ترنّح ولا دفع
    } else if (truthy(s['slam']) && target.cState != 'down') {
      knockDown(state, target, unit.x, unit.y, s.d('slam'));
    } else if (truthy(m['down']) && target.cState != 'down' && unit.rng() < m.d('down')) {
      knockDown(state, target, unit.x, unit.y, (truthy(m['knock']) ? m.d('knock') : 1) * 1.3);
    } else if (truthy(m['stagger'])) {
      stagger(state, target, hit.move == 'heavy' && truthy(s['heavyStagger']) ? m.d('stagger') * s.d('heavyStagger') : m.d('stagger'));
      knockback(target, unit.x, unit.y, m.dn('knock') ?? double.nan);
    } else if (truthy(m['push'])) {
      flinch(target, unit.x, unit.y, zone == 'back', false);
      target.flinch = _flinchTime * _pushFlinch;
      knockback(target, unit.x, unit.y, m.d('push'));
    } else if (hit.move == 'punch' && truthy(s['punches']) && unit.rng() < s.m('punches').d('stagger')) {
      stagger(state, target, s.m('punches').d('staggerTime'));
    } else {
      flinch(target, unit.x, unit.y, zone == 'back');
    }
    if (truthy(s['slowHits']) && !died && isAlive(target)) _slowDown(state, target, s.m('slowHits'));
  }
  if (landed) chargeOnHit(state, unit);
}

void _slowDown(MatchState state, Unit target, J slow) {
  if (target.slowUntil > state.time && target.slowFactor > slow.d('factor')) return;
  target.slowFactor = slow.d('factor');
  target.slowUntil = state.time + slow.d('duration');
}

final _multiShotSearch = COMBAT.d('multiShotSearch'), _multiShotSpread = COMBAT.d('multiShotSpread');
void _spawnVolley(MatchState state, Unit unit, Unit target, double damage) {
  final arrows = unit.stats.dn('arrows') ?? 0;
  final n = arrows == 0 ? 1 : arrows.toInt();
  if (n <= 1) { spawnProjectile(state, unit, target, damage, 0); return; }
  final targets = <Unit>[target];
  final searchSq = _multiShotSearch * _multiShotSearch;
  forEachNearby(state, target.x, target.y, _multiShotSearch, (other) {
    if (targets.length >= n || targets.contains(other)) return;
    if (_distanceSq(other, target) > searchSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    targets.add(other);
  });
  for (var k = 0; k < n; k++) {
    final offset = (k - (n - 1) / 2) * _multiShotSpread;
    spawnProjectile(state, unit, k < targets.length ? targets[k] : target, damage, offset);
  }
}

void _finishFight(MatchState state, Unit unit) {
  unit.target = null;
  unit.commandedTarget = false;
  unit.path = [];
  final am = unit.attackMove;
  if (am != null) {
    unit.state = 'attackMove';
    unit.orderSeq++;
    unit.awaitingPath = true;
    state.pathQueue.add(PathRequest(unit, am.i, am.j, unit.orderSeq));
    return;
  }
  unit.state = 'idle';
}

final _rangeTolerance = COMBAT.d('rangeTolerance');
void _blockedPolice(MatchState state, Unit unit) {
  final reach = unit.stats.d('attackRange') + _rangeTolerance;
  Unit? blocker;
  forEachNearby(state, unit.x, unit.y, reach, (other) {
    if (blocker != null || other == unit) return;
    if (_distance(unit, other) > reach) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    blocker = other;
  });
  if (blocker != null) _startAttack(unit, blocker!, state);
}

void _startAttack(Unit unit, Unit target, MatchState state) {
  unit.target = target;
  unit.state = 'attacking';
  if (unit.homePost == null) unit.chaseOrigin = Point2(unit.x, unit.y);
  unit.repathTimer = 0;
  if (unit.homePost != null && unit.gang == 'police' && state.time - unit.whistleAt > AUDIO.d('whistleSeconds')) {
    unit.whistleAt = state.time;
    soundAt(state, 'whistle', unit.x, unit.y);
  }
}

void _becomeIdle(Unit unit) {
  unit.target = null;
  unit.commandedTarget = false;
  unit.state = 'idle';
  unit.path = [];
}

Unit? _findNearestEnemy(MatchState state, Unit unit) {
  final vision = visionRange(state, unit);
  Unit? best;
  var bestScore = vision;
  forEachNearby(state, unit.x, unit.y, vision, (other) {
    if (other == unit) return;
    final d = _distance(unit, other);
    if (d >= vision) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    final score = d - busyBonus(unit, other);
    if (score >= bestScore) return;
    bestScore = score;
    best = other;
  });
  return best;
}

double _comboAttackTime(MatchState state, Unit unit, Unit target, double baseTime) {
  final c = unit.stats['combo'];
  if (!truthy(c)) return baseTime;
  final combo = c as J;
  final stopped = state.time - unit.comboTime > combo.d('resetSeconds');
  final switched = combo.b('sameTarget') && unit.comboTarget != target;
  if (stopped || switched) unit.comboStacks = 0;
  final floor = combo.has('minAttackTime') ? combo.d('minAttackTime') : baseTime * combo.d('minFactor');
  final pows = COMBO_POW[combo.d('step')]!;
  final time = math.max(floor, baseTime * (unit.comboStacks < pows.length ? pows[unit.comboStacks] : 0));
  if (!combo.has('maxStacks') || unit.comboStacks < combo.i('maxStacks')) unit.comboStacks++;
  unit.comboTime = state.time;
  unit.comboTarget = target;
  return time;
}

final _chaseVisionFactor = COMBAT.d('chaseVisionFactor'), _chaseMaxTiles = COMBAT.d('chaseMaxTiles');
final _fireRate = STYLE_PERKS.d('fireRate'), _swiftRate = STYLE_PERKS.d('swiftRate');
final _repathInterval = COMBAT.d('repathInterval');

void _fightTarget(MatchState state, Unit unit, List<int> budget) {
  final target = unit.target!;
  if (state.cityEvent != null && holiTruce(state, unit, target)) { _finishFight(state, unit); return; }
  final dist = _distance(unit, target);
  final aimOff = turnToward(unit, target.x, target.y, TICK_SEC);
  facingFromAngle(unit);
  final s = unit.stats;
  if (unit.homePost != null) {
    if (_distTo(unit, unit.homePost!) > (unit.leash != 0 ? unit.leash : POLICE.d('chaseTiles'))) { _returnToOrigin(state, unit); return; }
  } else if (!unit.commandedTarget) {
    final visionLimit = visionRange(state, unit) * _chaseVisionFactor;
    final fromOrigin = _distTo(unit, unit.chaseOrigin);
    if (dist > visionLimit || fromOrigin > _chaseMaxTiles) { _returnToOrigin(state, unit); return; }
  }
  final meleeRange = s.dn('meleeRange');
  final melee = meleeRange != null && dist <= meleeRange;
  final ranged = !melee && truthy(s['projectile']);
  final range = melee ? meleeRange : s.d('attackRange') * (ranged ? rangeMul(state, unit.playerId) : 1);
  final damage = melee ? s.d('meleeDamage') : s.d('damage');
  var attackTime = melee ? s.d('meleeAttackTime') : s.d('attackTime');
  final reachAdd = ranged || unit.lod != 'full' ? 0 : _longestReachAdd(unit);
  if (dist <= range + reachAdd + _rangeTolerance) {
    if (unit.path.isNotEmpty) unit.path = [];
    if (unit.attackCooldown <= 0 && unit.cMove == null) {
      attackTime = _comboAttackTime(state, unit, target, attackTime);
      if (unit.buffUntil > state.time && unit.buffAttackSpeed != 0) attackTime /= 1 + unit.buffAttackSpeed;
      if (unit.auraSpeed != 0) attackTime /= 1 + unit.auraSpeed;
      if (ranged && unit.gang == 'vipers') attackTime /= 1 + _fireRate;
      if (unit.gang == 'crows' && unit.creature == null) attackTime /= 1 + _swiftRate;
      if (ranged) { _rangedSwing(state, unit, target, damage, attackTime); }
      else { _meleeSwing(state, unit, target, dist, range, damage, attackTime, aimOff); }
    }
    return;
  }
  if (state.time - unit.approachAt > TICK_SEC * 1.5) unit.approachSince = state.time;
  unit.approachAt = state.time;
  final double gx, gy;
  if (ranged) { gx = target.x; gy = target.y; } else { final p = approachPoint(unit, target, range); gx = p.x; gy = p.y; }
  if (!ranged && _closeSteer(state, unit, gx, gy, dist)) return;
  unit.repathTimer -= TICK_SEC;
  if ((unit.path.isEmpty || unit.repathTimer <= 0) && budget[0] > 0) {
    budget[0]--;
    unit.repathTimer = _repathInterval;
    final path = findPath(state.map, jsRound(unit.x), jsRound(unit.y), jsRound(gx), jsRound(gy));
    if (path != null) unit.path = path;
  }
}

double _longestReachAdd(Unit unit) {
  double add = 0;
  for (final key in unit.style.moves) {
    final extra = _crMoves.m(key).d('rangeAdd');
    if (extra > add) add = extra;
  }
  return add;
}

final _flankSteerTiles = COMBAT.d('flankSteerTiles'), _arriveDistance = UNITS.d('arriveDistance');
bool _closeSteer(MatchState state, Unit unit, double gx, double gy, double dist) {
  if (dist > _flankSteerTiles) return false;
  final dx = gx - unit.x, dy = gy - unit.y;
  final need = math.sqrt(dx * dx + dy * dy);
  if (need < _arriveDistance) return true;
  final step = math.min(need, moveSpeed(state, unit) * TICK_SEC);
  final nx = unit.x + (dx / need) * step;
  final ny = unit.y + (dy / need) * step;
  if (!state.map.isWalkable(jsRound(nx), jsRound(ny))) return false;
  unit.x = nx; unit.y = ny;
  if (unit.path.isNotEmpty) unit.path = [];
  return true;
}

final _hitMoment = COMBAT.d('hitMoment'), _strikeMoment = CR.d('strikeMoment'), _aimTolerance = CR.d('aimTolerance');
void _rangedSwing(MatchState state, Unit unit, Unit target, double damage, double attackTime) {
  unit.attackCooldown = attackTime;
  unit.attackStart = state.time;
  unit.attackRate = attackTime;
  unit.ultStart = null;
  soundAt(state, 'swing', unit.x, unit.y, fightStyle(unit));
  unit.pendingHit = PendingHit(target: target, damage: damage * unit.damageMultiplier * _showoff(state, unit), ranged: true,
      at: state.time + attackTime * _hitMoment);
  registerSight(state, unit, target, true);
}

double _showoff(MatchState state, Unit unit) {
  final sh = unit.stats['showoff'];
  if (!truthy(sh)) return 1;
  final show = sh as J;
  final rested = state.time - unit.lastSwingAt >= show.d('idle');
  unit.lastSwingAt = state.time;
  if (!rested) return 1;
  addPop(state, unit, show.s('pop'), 'show');
  return 1 + show.d('bonus');
}

double _moveBonus(Unit unit, String key) {
  final s = unit.stats;
  if (truthy(s['kicks']) && (key == 'kick_front' || key == 'kick_high')) return 1 + s.m('kicks').d('damage');
  if (truthy(s['punches']) && key == 'punch') return 1 + s.m('punches').d('damage');
  return 1;
}

void _meleeSwing(MatchState state, Unit unit, Unit target, double dist, double range, double damage, double attackTime, double aimOff) {
  if (aimOff > _aimTolerance) return;
  if (unit.lod == 'stat') {
    unit.attackCooldown = attackTime;
    unit.attackStart = null;
    unit.pendingHit = PendingHit(target: target, move: 'quick', range: range,
        damage: damage * unit.damageMultiplier * _crMoves.m('quick').d('dmg') * _showoff(state, unit), ranged: false,
        at: state.time + attackTime * _hitMoment);
    return;
  }
  final near = unit.lod == 'simple' ? 0 : crowdCount(state, unit, isEnemy);
  final key = unit.lod == 'simple' ? 'quick' : chooseMove(unit, target, dist, near, range);
  if (key == null) return;
  final phases = moveTiming(key, attackTime);
  unit.cMove = key;
  unit.cMoveT = 0;
  unit.cPhases = phases;
  unit.cNode = fightNode(state, unit, key, target);
  unit.attackCooldown = 0;
  unit.attackStart = state.time;
  unit.attackRate = phases.total;
  unit.ultStart = null;
  soundAt(state, 'swing', unit.x, unit.y, fightStyle(unit));
  unit.pendingHit = PendingHit(target: target, move: key, range: range,
      damage: damage * unit.damageMultiplier * _crMoves.m(key).d('dmg') * _showoff(state, unit) * _moveBonus(unit, key),
      ranged: false, at: state.time + phases.wind + phases.strike * _strikeMoment);
  registerSight(state, unit, target, false);
}

void _returnToOrigin(MatchState state, Unit unit) {
  if (unit.attackMove != null) { _finishFight(state, unit); return; }
  final origin = unit.homePost ?? unit.chaseOrigin;
  unit.target = null;
  unit.commandedTarget = false;
  final path = findPath(state.map, jsRound(unit.x), jsRound(unit.y), jsRound(origin.x), jsRound(origin.y));
  if (path != null && path.isNotEmpty) {
    unit.path = path;
    unit.state = 'moving';
  } else {
    _becomeIdle(unit);
  }
}

void _retaliateIfCloser(MatchState state, Unit attacker, Unit target) {
  if (attacker.isSource) return;
  if (target.state != 'attacking') return;
  if (target.commandedTarget) return;
  if (target.target == null) return;
  if (attacker == target.target || !isAlive(attacker)) return;
  if (_distanceSq(target, attacker) >= _distanceSq(target, target.target!)) return;
  target.target = attacker;
  target.repathTimer = 0;
  target.path = [];
}

final _shieldArmor = AUDIO.d('shieldArmor'), _heavyDamage = AUDIO.d('heavyDamage');
void _hitSound(MatchState state, Unit attacker, Unit target, double amount) {
  final name = target.stats.d('armor') >= _shieldArmor ? 'hit_shield' : amount >= _heavyDamage ? 'hit_heavy' : 'hit_melee';
  final heard = !attacker.isSource ? soundAt(state, name, target.x, target.y, fightStyle(attacker)) : soundOnScreen(state, target.x, target.y);
  if (heard || target.playerId != state.humanId) return;
  if (raiseAlert(state, 'attack', jsRound(target.x), jsRound(target.y))) soundAlert(state, 'alert', target.x, target.y);
}

bool _strike(MatchState state, Unit attacker, Unit target, double amount, [bool shot = false]) {
  final splash = attacker.stats.dz('splashRadius');
  if (splash == 0) return applyDamage(state, attacker, target, amount, shot);
  var died = false;
  final splashSq = splash * splash;
  forEachNearby(state, target.x, target.y, splash, (other) {
    if (other.state == 'dead' || other.hp <= 0) return;
    if (_distanceSq(other, target) > splashSq) return;
    if (!isEnemy(state, attacker, other)) return;
    final killed = applyDamage(state, attacker, other, amount, shot);
    if (other == target) died = killed;
  });
  return died;
}

final _beats = STYLE_PERKS.m('beats'), _counter = STYLE_PERKS.m('counter');
final _pierce = STYLE_PERKS.d('pierce'), _shotGuard = STYLE_PERKS.d('shotGuard');
final _maxArmor = COMBAT.d('maxArmor'), _hitFlashTime = COMBAT.d('hitFlashTime'), _deathTime = COMBAT.d('deathTime');
final _hurtSeconds = UNIT_ART.d('hurtSeconds');
final _evadePer = EMPIRE.m('upgrades').m('speed').d('evade');

bool applyDamage(MatchState state, Unit attacker, Unit target, double amount, [bool shot = false]) {
  if (!isAlive(target)) return false;
  if (target.invulnUntil > state.time) return false;
  final evade = state.economy ? state.empire!.levels[target.playerId].speed * _evadePer : 0.0;
  if (evade != 0 && random() < evade) { if (!attacker.isSource) addPop(state, target, 'تفادى!', 'dodge'); return false; }
  _retaliateIfCloser(state, attacker, target);
  final beats = attacker.creature == null && target.creature == null && _beats[attacker.gang] == target.gang;
  if (beats) amount *= 1 + _counter.d(attacker.gang);
  if (target.creature == 'troll' && attacker.playerId == buildingOwner(state, 'hunters')) amount *= CITY_FEATURES.m('hunters').d('trollDamage');
  _hitSound(state, attacker, target, amount);
  var armor = math.min(_maxArmor, target.stats.d('armor') + target.armorBonus);
  if (beats && attacker.gang == 'crows') armor *= 1 - _pierce;
  var taken = amount * (1 - armor) * target.takenMul;
  if (shot && target.gang == 'hammers' && target.creature == null) taken *= 1 - _shotGuard;
  target.hp -= taken;
  target.lastHitBy = attacker.playerId;
  chargeOnDamageTaken(state, target, taken);
  target.hitFlash = _hitFlashTime;
  target.hurtTimer = _hurtSeconds;
  if (target.hp <= 0) {
    target.hp = 0;
    target.state = 'dead';
    target.hurtTimer = 0;
    target.attackStart = null;
    target.ultStart = null;
    target.pendingHit = null;
    target.pendingUlt = null;
    target.flurry = null;
    target.deathTimer = _deathTime;
    target.deathFront = !attacker.isSource && zoneOf(target, attacker.x, attacker.y) == 'back';
    target.path = [];
    target.target = null;
    target.selected = false;
    soundAt(state, 'death', target.x, target.y);
    state.stats.kills[attacker.playerId]++;
    state.stats.losses[target.playerId]++;
    return true;
  }
  return false;
}

// --- المقذوفات ---
final _pMin = COMBAT.d('projectileMinTime'), _pMax = COMBAT.d('projectileMaxTime'), _shotSpeed = STYLE_PERKS.d('shotSpeed');
final _missSpread = COMBAT.d('missSpread');
void spawnProjectile(MatchState state, Unit unit, Unit target, double damage, [double offset = 0, J? fire, bool dodgeable = true]) {
  final dist = _distance(unit, target);
  final maxRange = math.max(unit.stats.d('attackRange'), 0.1);
  final ratio = math.min(1.0, dist / maxRange);
  final duration = (_pMin + (_pMax - _pMin) * ratio) / (unit.gang == 'vipers' ? 1 + _shotSpeed : 1);
  final hits = rangedShotHits(state, unit) && !stormMiss(state, unit.playerId);
  final angle = random() * 6.2832;
  final spread = _missSpread * (0.6 + random() * 0.4);
  soundAt(state, unit.stats['projectile'] == 'arrow' ? 'arrow' : 'stone', unit.x, unit.y);
  final sf = unit.stats['fire'];
  state.projectiles.add(Projectile(kind: unit.stats.ss('projectile'), attacker: unit, target: target, damage: damage, dodgeable: dodgeable,
      fire: fire ?? (truthy(sf) ? sf as J : null), hits: hits,
      missX: target.x + fcos(angle) * spread, missY: target.y + fsin(angle) * spread,
      startX: unit.x + offset, startY: unit.y - offset, duration: duration));
}

void spawnFalcon(MatchState state, Unit unit, Unit target, double damage, double duration) {
  soundAt(state, 'arrow', unit.x, unit.y);
  state.projectiles.add(Projectile(kind: 'falcon', attacker: unit, target: target, damage: damage, dodgeable: false, fire: null, hits: true,
      missX: target.x, missY: target.y, startX: unit.x, startY: unit.y, duration: duration, returns: true));
}

void spawnRain(MatchState state, Unit unit, double cx, double cy, J ult, double damage) {
  soundAt(state, 'arrow', unit.x, unit.y);
  for (var k = 0; k < ult.i('arrows'); k++) {
    final angle = random() * 6.2832, r = math.sqrt(random()) * ult.d('area');
    state.projectiles.add(Projectile(kind: 'arrow', attacker: unit, target: null, damage: damage, dodgeable: false, fire: null, hits: false,
        missX: cx + fcos(angle) * r, missY: cy + fsin(angle) * r, startX: unit.x, startY: unit.y,
        duration: ult.d('flight') + random() * ult.d('spreadSeconds'), area: ult.d('hitRadius')));
  }
}

void _rainLanding(MatchState state, Projectile shot) {
  final areaSq = shot.area * shot.area;
  forEachNearby(state, shot.x, shot.y, shot.area, (other) {
    final dx = other.x - shot.x, dy = other.y - shot.y;
    if (dx * dx + dy * dy > areaSq) return;
    if (!isAlive(other) || !isEnemy(state, shot.attacker, other)) return;
    applyDamage(state, shot.attacker, other, shot.damage, true);
  });
}

Projectile _returnFlight(Projectile shot) => Projectile(kind: shot.kind, attacker: shot.attacker, target: shot.attacker, damage: 0,
    dodgeable: false, fire: null, hits: true, missX: shot.x, missY: shot.y, startX: shot.x, startY: shot.y,
    duration: shot.duration, back: true);

void _updateProjectiles(MatchState state) {
  final remaining = <Projectile>[];
  for (final shot in state.projectiles) {
    shot.prevX = shot.x;
    shot.prevY = shot.y;
    shot.prevT = shot.t;
    shot.t += TICK_SEC;
    final following = shot.hits && isAlive(shot.target);
    final endX = following ? shot.target!.x : (shot.hits ? shot.x : shot.missX);
    final endY = following ? shot.target!.y : (shot.hits ? shot.y : shot.missY);
    final progress = math.min(1.0, shot.t / shot.duration);
    shot.x = shot.startX + (endX - shot.startX) * progress;
    shot.y = shot.startY + (endY - shot.startY) * progress;
    if (shot.t >= shot.duration) {
      if (shot.fire != null) createFire(state, shot.attacker.playerId, shot.x, shot.y, shot.fire!);
      if (shot.area > 0) _rainLanding(state, shot);
      final dodged = shot.dodgeable && isAlive(shot.target) && shot.target!.cState == 'dodge';
      if (shot.damage > 0 && shot.hits && !dodged && isAlive(shot.target)) {
        final target = shot.target!;
        _strike(state, shot.attacker, target, shot.damage, true);
        if (isAlive(target) && target.cState == null) {
          flinch(target, shot.startX, shot.startY, zoneOf(target, shot.startX, shot.startY) == 'back', false);
        }
        final ss = shot.attacker.stats['slowShots'];
        if (truthy(ss) && isAlive(target)) _slowDown(state, target, ss as J);
        chargeOnHit(state, shot.attacker);
        if (shot.kind == 'falcon') state.fx.add(Fx(x: target.x, y: target.y, big: true, h: 14));
      }
      if (shot.returns && isAlive(shot.attacker)) remaining.add(_returnFlight(shot));
      continue;
    }
    remaining.add(shot);
  }
  state.projectiles = remaining;
}

void removeDeadUnits(MatchState state) {
  if (!state.units.any((u) => u.state == 'dead' && u.deathTimer <= 0)) return;
  for (final unit in state.units) {
    if (unit.state == 'dead' && unit.deathTimer <= 0) releaseRagdoll(state, unit);
  }
  state.units.removeWhere((u) => u.state == 'dead' && u.deathTimer <= 0);
}
