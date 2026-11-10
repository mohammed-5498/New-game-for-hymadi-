// الضربات المميزة (js/game/ults.js): الشحن وشرط الإطلاق والتأثير
import 'dart:math' as math;

import '../audio/sound.dart';
import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../map/pathfinding.dart';
import 'abilities.dart';
import 'alerts.dart';
import 'combat.dart';
import 'features.dart';
import 'realism.dart';
import 'spatial.dart';
import 'state.dart';
import 'units.dart';

bool _allied(MatchState state, Unit a, Unit b) => a.playerId == b.playerId || !isEnemy(state, a, b);
double _dsq(Unit a, Unit b) { final dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }

final _ultMax = ULT.d('max');
bool hasUlt(Unit unit) => truthy(unit.stats['ult']);
bool ultReady(Unit unit) => hasUlt(unit) && unit.ultCharge >= _ultMax;

double _chargeFactor(MatchState state, Unit unit) {
  if (unit.playerId < 0 || unit.playerId >= state.players.length) return 1;
  final player = state.players[unit.playerId];
  if (player.isHuman || player.neutral) return 1;
  final lvl = ai.m('levels').mm(player.difficulty);
  return lvl != null && truthy(lvl['chargeFactor']) ? lvl.d('chargeFactor') : 1;
}

void _announceReady(MatchState state, Unit unit) {
  if (unit.ultCharge < _ultMax || unit.ultAnnounced) return;
  unit.ultAnnounced = true;
  if (unit.playerId == state.humanId) soundAt(state, 'ult_ready', unit.x, unit.y);
}

void chargeOverTime(MatchState state, Unit unit) {
  if (!hasUlt(unit) || unit.ultCharge >= _ultMax) return;
  final rate = unit.champion ? ULT.d('championPerSecond') : ULT.d('perSecond');
  unit.ultCharge = math.min(_ultMax, unit.ultCharge + rate * TICK_SEC * _chargeFactor(state, unit));
  _announceReady(state, unit);
}

void chargeOnHit(MatchState state, Unit? unit) {
  if (unit == null || unit.isSource || !hasUlt(unit)) return;
  final amount = unit.champion ? ULT.d('championPerHit') : ULT.d('perHit');
  unit.ultCharge = math.min(_ultMax, unit.ultCharge + amount * _chargeFactor(state, unit));
  _announceReady(state, unit);
}

void chargeOnDamageTaken(MatchState state, Unit unit, double taken) {
  if (!hasUlt(unit)) return;
  unit.damageTaken += taken;
  final chunk = ULT.d('damageChunk');
  while (unit.damageTaken >= chunk) {
    unit.damageTaken -= chunk;
    unit.ultCharge = math.min(_ultMax, unit.ultCharge + ULT.d('perDamageChunk') * _chargeFactor(state, unit));
  }
  _announceReady(state, unit);
}

double _ultRange(Unit unit, J ult) => truthy(ult['range']) ? ult.d('range') : truthy(ult['radius']) ? ult.d('radius') : unit.stats.d('visionRange');

Unit? _nearestEnemy(MatchState state, Unit unit, double range) {
  Unit? best;
  var bestSq = range * range;
  forEachNearby(state, unit.x, unit.y, range, (other) {
    if (other == unit) return;
    final d2 = _dsq(unit, other);
    if (d2 >= bestSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    bestSq = d2;
    best = other;
  });
  return best;
}

Unit? _woundedAlly(MatchState state, Unit unit, double range) {
  Unit? best;
  double worst = 0;
  final rangeSq = range * range;
  forEachNearby(state, unit.x, unit.y, range, (other) {
    final missing = other.maxHp - other.hp;
    if (missing <= worst) return;
    if (_dsq(unit, other) > rangeSq) return;
    if (!isAlive(other) || !_allied(state, unit, other)) return;
    worst = missing;
    best = other;
  });
  return best;
}

Unit? _nearestPolice(MatchState state, Unit unit, double range) {
  Unit? best;
  var bestSq = range * range;
  forEachNearby(state, unit.x, unit.y, range, (other) {
    if (other.gang != 'police') return;
    final d2 = _dsq(unit, other);
    if (d2 >= bestSq || !isAlive(other)) return;
    bestSq = d2;
    best = other;
  });
  return best;
}

Unit? _ultTarget(MatchState state, Unit unit, J ult) {
  final range = _ultRange(unit, ult);
  final needs = ult['needs'];
  if (needs == 'ally') return _woundedAlly(state, unit, range);
  if (needs == 'police') return _nearestPolice(state, unit, range);
  if (needs == 'either') return _nearestEnemy(state, unit, range) ?? _woundedAlly(state, unit, range);
  return _nearestEnemy(state, unit, range);
}

void Function(MatchState, Unit, J)? summonHook;
void setSummonHook(void Function(MatchState, Unit, J)? fn) { summonHook = fn; }
bool Function(MatchState, Unit, J, Unit)? ultGate;
void setUltGate(bool Function(MatchState, Unit, J, Unit)? fn) { ultGate = fn; }

final _hitMoment = COMBAT.d('hitMoment');
bool tryCastUlt(MatchState state, Unit unit) {
  if (!ultReady(unit) || unit.pendingUlt != null || unit.attackCooldown > 0) return false;
  final ult = unit.stats.m('ult');
  final target = _ultTarget(state, unit, ult);
  if (target == null) return false;
  final gate = ultGate;
  if (gate != null && !gate(state, unit, ult, target)) return false;
  final rate = ULT.d('castSeconds');
  unit.ultCharge = 0;
  unit.ultAnnounced = false;
  soundAt(state, 'ult_cast', unit.x, unit.y);
  unit.pendingHit = null;
  unit.attackStart = state.time;
  unit.attackRate = rate;
  unit.attackCooldown = rate;
  unit.ultStart = state.time;
  unit.ultRate = rate;
  unit.pendingUlt = PendingUlt(target, state.time + rate * _hitMoment);
  if (unit.state == 'attacking') unit.path = [];
  if (target != unit) faceTowards(unit, target.x, target.y);
  return true;
}

void resolveUlt(MatchState state, Unit unit) {
  final pending = unit.pendingUlt!;
  unit.pendingUlt = null;
  if (!isAlive(unit)) return;
  _shakeCamera(state, unit);
  final ult = unit.stats.m('ult');
  final target = isAlive(pending.target) ? pending.target : null;
  switch (ult.s('kind')) {
    case 'harden': _harden(state, unit, ult.d('duration'));
    case 'slam': _slam(state, unit, ult);
    case 'arc': _arc(state, unit, ult, pending.target);
    case 'pierce': _pierce(state, unit, ult, pending.target);
    case 'flurry': _startFlurry(state, unit, ult, target);
    case 'buff': _buffAllies(state, unit, ult);
    case 'heal': _healAllies(state, unit, ult);
    case 'shot':
      if (target != null) {
        spawnProjectile(state, unit, target, _ultDamage(state, unit, ult.d('damage')), 0, null, true);
        registerSight(state, unit, target, true);
      }
    case 'fire': createFire(state, unit.playerId, (target ?? unit).x, (target ?? unit).y, ult.m('fire'));
    case 'arrows': _fireArrows(state, unit, ult, target);
    case 'bash': _bash(state, unit, ult, target);
    case 'summon': summonHook?.call(state, unit, ult);
    case 'caravan': _callCaravan(state, unit, ult);
    case 'falcon': _falconDive(state, unit, ult, target);
    case 'shout': _rallyShout(state, unit, ult);
    case 'whirl' || 'roda': _startFlurry(state, unit, ult, null, ult.d('radius'));
    case 'rain': _arrowRain(state, unit, ult, target);
    case 'throwdown' || 'knockout' || 'tango': _throwdown(state, unit, ult, target);
    case 'haste': _hasteAllies(state, unit, ult);
    case 'bribe': _bribePolice(state, unit, ult);
    case 'banner': _plantBanner(state, unit, ult);
  }
}

void _shakeCamera(MatchState state, Unit unit) {
  if (state.time - state.shakeAt < CAMERA.m('shake').d('minGapSeconds')) return;
  if (!onScreen(state, unit.x, unit.y)) return;
  state.shakeAt = state.time;
}

double _ultDamage(MatchState state, Unit unit, double amount) => amount * unit.damageMultiplier * stormDamageMul(state, unit.playerId);

void _harden(MatchState state, Unit unit, double duration) { unit.invulnUntil = state.time + duration; }

void _slam(MatchState state, Unit unit, J ult) {
  if (truthy(ult['harden'])) _harden(state, unit, ult.d('harden'));
  final radius = ult.d('radius'), radiusSq = radius * radius;
  forEachNearby(state, unit.x, unit.y, radius, (other) {
    if (_dsq(unit, other) > radiusSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    applyDamage(state, unit, other, _ultDamage(state, unit, ult.d('damage')));
    if (truthy(ult['slow'])) {
      other.slowFactor = ult.d('slow');
      other.slowUntil = state.time + ult.d('slowDuration');
    }
  });
}

void _arc(MatchState state, Unit unit, J ult, Unit? target) {
  final dx = target != null ? target.x - unit.x : 1.0;
  final dy = target != null ? target.y - unit.y : 0.0;
  var length = hypot(dx, dy);
  if (length == 0 || length.isNaN) length = 1;
  final fx = dx / length, fy = dy / length;
  final radius = ult.d('radius'), radiusSq = radius * radius;
  forEachNearby(state, unit.x, unit.y, radius, (other) {
    if (_dsq(unit, other) > radiusSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    if ((other.x - unit.x) * fx + (other.y - unit.y) * fy < 0) return;
    applyDamage(state, unit, other, _ultDamage(state, unit, ult.d('damage')));
  });
}

void _pierce(MatchState state, Unit unit, J ult, Unit? target) {
  final dx = target != null ? target.x - unit.x : 1.0;
  final dy = target != null ? target.y - unit.y : 0.0;
  var length = hypot(dx, dy);
  if (length == 0 || length.isNaN) length = 1;
  final fx = dx / length, fy = dy / length;
  final reach = ult.d('range') + COMBAT.d('pierceReachBonus');
  final width = COMBAT.d('pierceWidth');
  final online = <(Unit, double)>[];
  forEachNearby(state, unit.x, unit.y, reach, (other) {
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    final ox = other.x - unit.x, oy = other.y - unit.y;
    final along = ox * fx + oy * fy;
    if (along <= 0 || along > reach) return;
    final side = (ox * -fy + oy * fx).abs();
    if (side > width) return;
    online.add((other, along));
  });
  stableSort<(Unit, double)>(online, (a, b) => byNum(a.$2, b.$2));
  for (final hit in online.take(ult.i('targets'))) {
    applyDamage(state, unit, hit.$1, _ultDamage(state, unit, ult.d('damage')));
  }
}

void _startFlurry(MatchState state, Unit unit, J ult, Unit? target, [double radius = 0]) {
  if (target == null && radius == 0) return;
  unit.flurry = Flurry(target, ult.i('hits'), ult.d('damage'), ult.d('duration') / ult.d('hits'), state.time, radius);
}

void updateFlurry(MatchState state, Unit unit) {
  final flurry = unit.flurry;
  if (flurry == null) return;
  if (flurry.radius != 0) { _updateWhirl(state, unit, flurry); return; }
  if (!isAlive(unit) || !isAlive(flurry.target)) { unit.flurry = null; return; }
  if (state.time < flurry.next) return;
  applyDamage(state, unit, flurry.target!, _ultDamage(state, unit, flurry.damage));
  flurry.left--;
  flurry.next = state.time + flurry.interval;
  if (flurry.left <= 0) unit.flurry = null;
}

void _updateWhirl(MatchState state, Unit unit, Flurry whirl) {
  if (!isAlive(unit)) { unit.flurry = null; return; }
  if (state.time < whirl.next) return;
  final radiusSq = whirl.radius * whirl.radius;
  forEachNearby(state, unit.x, unit.y, whirl.radius, (other) {
    if (_dsq(unit, other) > radiusSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    applyDamage(state, unit, other, _ultDamage(state, unit, whirl.damage));
  });
  unit.attackStart = unit.ultStart = state.time;
  unit.attackRate = unit.ultRate = whirl.interval;
  if (unit.attackCooldown < whirl.interval) unit.attackCooldown = whirl.interval;
  whirl.left--;
  whirl.next = state.time + whirl.interval;
  if (whirl.left <= 0) unit.flurry = null;
}

void _buffAllies(MatchState state, Unit unit, J ult) {
  _forEachAlly(state, unit, ult.d('radius'), (ally) {
    ally.buffUntil = state.time + ult.d('duration');
    ally.buffDamage = ult.d('damageBonus');
    ally.buffAttackSpeed = ult.dz('attackSpeedBonus');
    if (truthy(ult['heal'])) _heal(ally, ult.d('heal'));
  });
  if (truthy(ult['heal'])) soundAt(state, 'heal', unit.x, unit.y);
  if (truthy(ult['ring'])) addUltFx(state, 'ring', unit.x, unit.y, ult.d('radius'), ult.s('ring'));
}

void _healAllies(MatchState state, Unit unit, J ult) {
  _forEachAlly(state, unit, ult.d('radius'), (ally) => _heal(ally, ult.d('heal')));
  soundAt(state, 'heal', unit.x, unit.y);
}

void _forEachAlly(MatchState state, Unit unit, double radius, void Function(Unit) action) {
  final radiusSq = radius * radius;
  forEachNearby(state, unit.x, unit.y, radius, (other) {
    if (_dsq(unit, other) > radiusSq) return;
    if (!isAlive(other) || !_allied(state, unit, other)) return;
    action(other);
  });
}

final _soldierHeal = STYLE_PERKS.d('soldierHeal');
void _heal(Unit unit, double amount) { unit.hp = math.min(unit.maxHp, unit.hp + amount * _soldierHeal); }

void _bash(MatchState state, Unit unit, J ult, Unit? target) {
  if (target == null) return;
  applyDamage(state, unit, target, _ultDamage(state, unit, ult.d('damage')));
  if (!isAlive(target)) return;
  target.slowFactor = ult.d('slow');
  target.slowUntil = state.time + ult.d('slowDuration');
  final dx = target.x - unit.x, dy = target.y - unit.y;
  var length = hypot(dx, dy);
  if (length == 0 || length.isNaN) length = 1;
  final toX = target.x + (dx / length) * ult.d('push');
  final toY = target.y + (dy / length) * ult.d('push');
  if (!state.map.isConnected(jsRound(toX), jsRound(toY))) return;
  target.x = toX;
  target.y = toY;
  target.path = [];
}

void _fireArrows(MatchState state, Unit unit, J ult, Unit? target) {
  if (target == null) return;
  final targets = <Unit>[target];
  final search = COMBAT.d('multiShotSearch'), searchSq = search * search;
  final arrows = ult.i('arrows');
  forEachNearby(state, target.x, target.y, search, (other) {
    if (targets.length >= arrows || targets.contains(other)) return;
    if (_dsq(other, target) > searchSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    targets.add(other);
  });
  for (var k = 0; k < arrows; k++) {
    final offset = (k - (arrows - 1) / 2) * COMBAT.d('multiShotSpread');
    spawnProjectile(state, unit, k < targets.length ? targets[k] : target, _ultDamage(state, unit, ult.d('damage')), offset, ult.m('fire'), false);
  }
}

void _callCaravan(MatchState state, Unit unit, J ult) {
  final player = state.players[unit.playerId];
  var alive = 0;
  for (final other in state.units) { if (other.playerId == unit.playerId && other.state != 'dead') alive++; }
  final room = math.min(ult.i('count'), state.maxUnits - alive);
  final ci = jsRound(unit.x), cj = jsRound(unit.y);
  final spots = findFreeTiles(state.map, ci, cj, ult.i('count') + 1, ult.i('spread'));
  final around = spots.where((s) => s.$1 != ci || s.$2 != cj).toList();
  final pick = (around.length >= room ? around : spots).take(math.max(0, room)).toList();
  for (final (i, j) in pick) {
    state.units.add(createUnit(state, player, i, j));
    addUltFx(state, 'dust', i.toDouble(), j.toDouble());
  }
  if (pick.isNotEmpty) soundAt(state, 'spawn', unit.x, unit.y);
  addUltFx(state, 'ring', unit.x, unit.y, ult.d('spread') + 0.5);
}

void _falconDive(MatchState state, Unit unit, J ult, Unit? fallback) {
  Unit? target;
  double farthest = -1;
  final range = ult.d('range'), rangeSq = range * range;
  forEachNearby(state, unit.x, unit.y, range, (other) {
    final d2 = _dsq(unit, other);
    if (d2 > rangeSq || d2 <= farthest) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    farthest = d2;
    target = other;
  });
  target ??= fallback;
  final t = target;
  if (t == null) return;
  final flight = math.min(ult.d('flightMax'), ult.d('flightMin') + ult.d('flightPerTile') * math.sqrt(_dsq(unit, t)));
  spawnFalcon(state, unit, t, _ultDamage(state, unit, ult.d('damage')), flight);
  unit.awayUntil = state.time + flight * 2;
  faceTowards(unit, t.x, t.y);
}

void _rallyShout(MatchState state, Unit unit, J ult) {
  final until = state.time + ult.d('duration');
  _forEachAlly(state, unit, ult.d('radius'), (ally) {
    ally.steadyUntil = until;
    if (ally.cState == 'stagger') { ally.cState = null; ally.cTimer = 0; }
  });
  addUltFx(state, 'ring', unit.x, unit.y, ult.d('radius'));
}

void _arrowRain(MatchState state, Unit unit, J ult, Unit? fallback) {
  var spot = fallback;
  var most = 0;
  final range = ult.d('range'), rangeSq = range * range;
  forEachNearby(state, unit.x, unit.y, range, (other) {
    if (_dsq(unit, other) > rangeSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    final around = _enemiesAround(state, unit, other, ult.d('area'));
    if (around > most) { most = around; spot = other; }
  });
  final s = spot;
  if (s == null) return;
  spawnRain(state, unit, s.x, s.y, ult, _ultDamage(state, unit, ult.d('damage')));
  addUltFx(state, 'ring', s.x, s.y, ult.d('area'), ult.s('ring'));
  faceTowards(unit, s.x, s.y);
}

int _enemiesAround(MatchState state, Unit unit, Unit spot, double radius) {
  var count = 0;
  final radiusSq = radius * radius;
  forEachNearby(state, spot.x, spot.y, radius, (other) {
    if (_dsq(spot, other) > radiusSq) return;
    if (isAlive(other) && isEnemy(state, unit, other)) count++;
  });
  return count;
}

void _throwdown(MatchState state, Unit unit, J ult, Unit? target) {
  if (target == null) return;
  applyDamage(state, unit, target, _ultDamage(state, unit, ult.d('damage')));
  if (isAlive(target)) knockDown(state, target, unit.x, unit.y, ult.d('throw'));
}

void _bribePolice(MatchState state, Unit unit, J ult) {
  final until = state.time + ult.d('duration'), radius = ult.d('radius'), radiusSq = radius * radius;
  final bribed = <Unit>[];
  forEachNearby(state, unit.x, unit.y, radius, (other) {
    if (other.gang != 'police' || !isAlive(other) || _dsq(unit, other) > radiusSq) return;
    other.bribedUntil = until;
    other.bribedBy = unit.playerId;
    if (other.target != null && other.target!.playerId == unit.playerId) _dropTarget(other);
    addPop(state, other, 'رُشي!', 'bribe');
    bribed.add(other);
  });
  for (final own in state.units) {
    if (own.playerId == unit.playerId && own.target != null && bribed.contains(own.target)) _dropTarget(own);
  }
  addUltFx(state, 'ring', unit.x, unit.y, radius, nations.m('fx').s('bribeColor'));
}

void _dropTarget(Unit unit) {
  unit.target = null;
  unit.commandedTarget = false;
  unit.pendingHit = null;
  if (unit.state == 'attacking') { unit.state = 'idle'; unit.path = []; }
}

void _plantBanner(MatchState state, Unit unit, J ult) {
  state.zones.add(Zone('banner', unit.x, unit.y, ult.d('radius'), state.time + ult.d('duration'), unit.playerId, unit.color));
  unit.awayUntil = state.time + ult.d('duration');
  addUltFx(state, 'ring', unit.x, unit.y, ult.d('radius'));
}

void _hasteAllies(MatchState state, Unit unit, J ult) {
  final until = state.time + ult.d('duration');
  _forEachAlly(state, unit, ult.d('radius'), (ally) {
    ally.hasteUntil = until;
    ally.hasteFactor = ult.d('bonus');
  });
  addUltFx(state, 'ring', unit.x, unit.y, ult.d('radius'), ult.s('ring'));
}
