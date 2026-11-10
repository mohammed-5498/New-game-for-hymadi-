// قدرات الشخصيات ومكافآت الأحياء (js/game/abilities.js): الهالات والعلاج والمستشفى ومخزن السلاح والنار
import 'dart:math' as math;

import '../audio/sound.dart';
import '../core/cfg.dart';
import '../data/js_config.dart';
import 'combat.dart';
import 'empire.dart';
import 'features.dart';
import 'nations.dart';
import 'police.dart';
import 'spatial.dart';
import 'spawn.dart';
import 'state.dart';

bool _alive(Unit u) => u.state != 'dead' && u.hp > 0;
bool _allied(MatchState state, Unit a, Unit b) => a.playerId == b.playerId || !isEnemy(state, a, b);

void updateAbilities(MatchState state) {
  _updateZones(state);
  _applyDamageBonuses(state);
  _applyHealing(state);
  _updateFires(state);
}

final _armoryBonus = SPECIAL_BONUS.m('armory').d('damageBonus');
final _statue = CITY_FEATURES.m('statue'), _cathedral = CITY_FEATURES.m('cathedral');
final _soldierDamage = STYLE_PERKS.d('soldierDamage'), _soldierHeal = STYLE_PERKS.d('soldierHeal');

void _applyDamageBonuses(MatchState state) {
  final players = state.players;
  final armory = [for (final p in players) ownsSpecial(state, p.id, 'armory') ? _armoryBonus : 0.0];
  final empire = state.economy;
  final armorBonus = [for (final p in players) policeArmorBonus(state, p.id) + (empire ? empireArmorBonus(state, p.id) : 0)];
  final upDamage = [for (final p in players) empire ? empireDamageBonus(state, p.id) + featureDamageBonus(state, p.id) : 0.0];
  final home = [for (final p in players) homeMods(p)];
  final brothers = [for (final p in players) brotherMods(p)];
  final phalanx = [for (final p in players) phalanxMods(p)];
  final outnumbered = [for (final p in players) outnumberedMods(p)];
  final duel = [for (final p in players) duelMods(p)];
  final pyramids = pyramidZones(state);
  final statues = statueZones(state);
  final units = state.units;
  for (var k = 0; k < units.length; k++) {
    final unit = units[k];
    if (!_alive(unit)) continue;
    unit.armorBonus = armorBonus[unit.playerId];
    unit.aura = false;
    unit.auraBonus = 0;
    unit.auraHeal = 0;
    unit.brothers = 0;
  }
  for (var k = 0; k < units.length; k++) {
    final boss = units[k];
    if (!_alive(boss) || !truthy(boss.stats['aura'])) continue;
    _spreadAura(state, boss, boss.stats.m('aura'));
  }
  for (var k = 0; k < units.length; k++) {
    final hero = units[k];
    if (hero.hero == null || !_alive(hero)) continue;
    final mods = brothers[hero.playerId];
    if (mods != null) _countBrothers(state, hero, mods.d('radius'));
  }
  for (var k = 0; k < units.length; k++) {
    final unit = units[k];
    if (!_alive(unit)) continue;
    var multiplier = 1 + armory[unit.playerId] + upDamage[unit.playerId];
    if (unit.aura) multiplier += unit.auraBonus;
    if (unit.buffUntil > state.time) multiplier += unit.buffDamage;
    double taken = 1;
    final mods = home[unit.playerId];
    if (mods != null) {
      final inside = inOwnArea(state.map, unit);
      if (inside && mods.b('homeDamage')) multiplier += mods.d('homeDamage');
      if (inside && mods.b('homeDamageTaken')) taken = 1 - mods.d('homeDamageTaken');
    }
    if (unit.brothers != 0) {
      final b = brothers[unit.playerId]!;
      multiplier += math.min(b.d('max'), unit.brothers * b.d('perHero'));
    }
    final out = outnumbered[unit.playerId];
    if (out != null && _enemiesOutnumber(state, unit, out.d('radius'))) multiplier += out.d('bonus');
    final du = duel[unit.playerId];
    if (du != null && _oneOnOne(state, unit, du.d('radius'))) multiplier += du.d('bonus');
    final ph = phalanx[unit.playerId];
    if (ph != null && _inGroup(state, unit, ph)) taken = 1 - ph.d('reduce');
    if (pyramids != null) taken *= pyramidTaken(pyramids, unit);
    unit.takenMul = taken;
    double speed = 0;
    if (statues != null && inZone(statues, unit)) {
      multiplier += _statue.d('damage');
      speed = _statue.d('attackSpeed');
    }
    unit.auraSpeed = speed;
    if (unit.rallyUntil > state.time) multiplier += _cathedral.d('damage');
    if (unit.gang == 'scorpions' && unit.creature == null) multiplier += hordeBonus(state, unit);
    if (unit.creature == null) multiplier *= _soldierDamage;
    unit.damageMultiplier = multiplier;
  }
}

final _horde = STYLE_PERKS.m('horde');
final _hordeRadius = _horde.d('radius');
final _hordeTiers = [for (final t in _horde.l('tiers')) ((t as List)[0] as num, (t[1] as num).toDouble())];
double hordeBonus(MatchState state, Unit unit) {
  final radiusSq = _hordeRadius * _hordeRadius;
  var count = 0;
  forEachNearby(state, unit.x, unit.y, _hordeRadius, (other) {
    if (other.playerId != unit.playerId || other.gang != 'scorpions' || other.creature != null || !_alive(other)) return;
    final dx = other.x - unit.x, dy = other.y - unit.y;
    if (dx * dx + dy * dy <= radiusSq) count++;
  });
  for (final (n, bonus) in _hordeTiers) { if (count >= n) return bonus; }
  return 0;
}

void _spreadAura(MatchState state, Unit boss, J aura) {
  final radius = aura.d('radius'), radiusSq = radius * radius;
  final damageBonus = aura.d('damageBonus'), healing = aura.dz('healPerSecond');
  forEachNearby(state, boss.x, boss.y, radius, (unit) {
    final dx = unit.x - boss.x, dy = unit.y - boss.y;
    if (dx * dx + dy * dy > radiusSq) return;
    if (!_alive(unit) || !_allied(state, unit, boss)) return;
    unit.aura = true;
    if (damageBonus > unit.auraBonus) unit.auraBonus = damageBonus;
    if (healing > unit.auraHeal) unit.auraHeal = healing;
  });
}

bool _inGroup(MatchState state, Unit unit, J ph) {
  final radius = ph.d('radius'), radiusSq = radius * radius;
  var count = 0;
  forEachNearby(state, unit.x, unit.y, radius, (other) {
    if (other.playerId != unit.playerId || !_alive(other)) return;
    final dx = other.x - unit.x, dy = other.y - unit.y;
    if (dx * dx + dy * dy <= radiusSq) count++;
  });
  return count >= ph.d('count');
}

bool _enemiesOutnumber(MatchState state, Unit unit, double radius) {
  final radiusSq = radius * radius;
  var foes = 0, friends = 0;
  forEachNearby(state, unit.x, unit.y, radius, (other) {
    if (!_alive(other)) return;
    final dx = other.x - unit.x, dy = other.y - unit.y;
    if (dx * dx + dy * dy > radiusSq) return;
    if (_allied(state, unit, other)) { friends++; } else { foes++; }
  });
  return foes > friends;
}

bool _oneOnOne(MatchState state, Unit unit, double radius) {
  final radiusSq = radius * radius;
  var foes = 0;
  forEachNearby(state, unit.x, unit.y, radius, (other) {
    if (foes > 1 || !_alive(other) || _allied(state, unit, other)) return;
    final dx = other.x - unit.x, dy = other.y - unit.y;
    if (dx * dx + dy * dy <= radiusSq) foes++;
  });
  return foes <= 1;
}

void _updateZones(MatchState state) {
  if (state.zones.isEmpty) return;
  state.zones = state.zones.where((z) => z.until > state.time).toList();
  for (final zone in state.zones) {
    final radiusSq = zone.radius * zone.radius, hold = state.time + 2 * TICK_SEC;
    forEachNearby(state, zone.x, zone.y, zone.radius, (unit) {
      final dx = unit.x - zone.x, dy = unit.y - zone.y;
      if (dx * dx + dy * dy > radiusSq || !_alive(unit)) return;
      if (unit.playerId != zone.playerId && isEnemyId(state, unit.playerId, zone.playerId)) return;
      if (unit.steadyUntil < hold) unit.steadyUntil = hold;
      if (unit.holdUntil < hold) unit.holdUntil = hold;
      if (unit.cState == 'stagger') { unit.cState = null; unit.cTimer = 0; }
    });
  }
}

void _countBrothers(MatchState state, Unit hero, double radius) {
  final radiusSq = radius * radius;
  forEachNearby(state, hero.x, hero.y, radius, (unit) {
    if (unit.playerId != hero.playerId || unit.hero != null || unit.champion) return;
    final dx = unit.x - hero.x, dy = unit.y - hero.y;
    if (dx * dx + dy * dy > radiusSq || !_alive(unit)) return;
    unit.brothers++;
  });
}

final _hospital = SPECIAL_BONUS.m('hospital');
final _captureRadius = MAP_GEN.d('captureRadius');
void _applyHealing(MatchState state) {
  final hospitals = state.map.districts.where((d) => d.special == 'hospital' && d.owner != null).toList();
  final units = state.units;
  for (var k = 0; k < units.length; k++) {
    final unit = units[k];
    if (!_alive(unit)) continue;
    for (final hospital in hospitals) {
      if (hospital.owner != unit.playerId) continue;
      _heal(unit, _hospital.d('globalHealPerSecond') * TICK_SEC);
      final dx = unit.x - hospital.capture!.i, dy = unit.y - hospital.capture!.j;
      if (dx * dx + dy * dy <= _captureRadius * _captureRadius) _heal(unit, _hospital.d('zoneHealPerSecond') * TICK_SEC);
    }
  }
  for (var k = 0; k < units.length; k++) {
    final unit = units[k];
    if (_alive(unit) && unit.auraHeal > 0) _heal(unit, unit.auraHeal * TICK_SEC);
  }
  for (var k = 0; k < units.length; k++) {
    final medic = units[k];
    if (!_alive(medic) || !truthy(medic.stats['heal'])) continue;
    _medicHeal(state, medic);
  }
}

void _medicHeal(MatchState state, Unit medic) {
  final h = medic.stats.m('heal');
  final radius = h.d('radius'), perSecond = h.d('perSecond');
  Unit? patient;
  double worst = 0;
  final radiusSq = radius * radius;
  forEachNearby(state, medic.x, medic.y, radius, (other) {
    if (other == medic) return;
    final missing = other.maxHp - other.hp;
    if (missing <= worst) return;
    final dx = medic.x - other.x, dy = medic.y - other.y;
    if (dx * dx + dy * dy > radiusSq) return;
    if (!_alive(other) || !_allied(state, medic, other)) return;
    worst = missing;
    patient = other;
  });
  if (patient != null) {
    _heal(patient!, perSecond * TICK_SEC);
    medic.healingTarget = patient;
  } else {
    medic.healingTarget = null;
  }
}

void _heal(Unit unit, double amount) {
  unit.hp = math.min(unit.maxHp, unit.hp + amount * _soldierHeal);
}

void createFire(MatchState state, int playerId, double i, double j, J fire) {
  soundAt(state, 'fire', i, j);
  state.fires.add(Fire(playerId, i, j, fire.d('radius'), fire.d('damagePerSecond'), fire.d('duration')));
}

final _sources = <int, Unit>{};
Unit sourceOf(int playerId) => _sources[playerId] ??= Unit.source(playerId);

void _updateFires(MatchState state) {
  if (state.fires.isEmpty) return;
  final remaining = <Fire>[];
  for (final fire in state.fires) {
    fire.life -= TICK_SEC;
    final weak = stormDamageMul(state, fire.playerId);
    final radiusSq = fire.radius * fire.radius;
    final src = sourceOf(fire.playerId);
    forEachNearby(state, fire.x, fire.y, fire.radius, (unit) {
      final dx = unit.x - fire.x, dy = unit.y - fire.y;
      if (dx * dx + dy * dy > radiusSq) return;
      if (!_alive(unit)) return;
      if (!isEnemyId(state, fire.playerId, unit.playerId)) return;
      applyDamage(state, src, unit, fire.damagePerSecond * TICK_SEC * weak);
    });
    if (fire.life > 0) remaining.add(fire);
  }
  state.fires = remaining;
}
