// أثر الطقس على اللعب (js/game/weather.js): الرصد ليلاً، والسرعة في الثلج، ودقة الرمي في المطر
import '../core/cfg.dart';
import '../data/js_config.dart';
import 'empire.dart';
import 'features.dart';
import 'state.dart';

double visionRange(MatchState state, Unit unit) {
  if (unit.stats.b('weatherProof')) return unit.stats.d('visionRange');
  return unit.stats.d('visionRange') * WEATHER.m(state.weather).d('visionMul');
}

final _cathedralSpeed = CITY_FEATURES.m('cathedral').d('speed');
double moveSpeed(MatchState state, Unit unit) {
  var speed = unit.stats.d('speed') * WEATHER.m(state.weather).d('speedMul') * unit.traits.spd;
  if (unit.hasteUntil > state.time) speed *= 1 + unit.hasteFactor;
  if (unit.rallyUntil > state.time) speed *= 1 + _cathedralSpeed;
  if (state.feature == 'coups' && buildingOwner(state, 'arch') == unit.playerId) speed *= 1 + CITY_FEATURES.m('arch').d('speed');
  if (state.feature != null) speed *= eventSpeedMul(state, unit);
  if (state.economy) speed *= empireSpeedMul(state, unit.playerId);
  if (unit.slowUntil > state.time) return speed * (1 - unit.slowFactor);
  return speed;
}

bool rangedShotHits(MatchState state, Unit? unit) {
  if (unit != null && unit.stats.b('weatherProof')) return true;
  final chance = WEATHER.m(state.weather).d('rangedHitChance');
  return chance >= 1 || random() < chance;
}
