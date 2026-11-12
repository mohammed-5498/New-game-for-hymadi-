// الاستيلاء على الأحياء (js/game/capture.js): مناطق الاستيلاء والتقدم وتغيّر الملكية والصبغ
import 'dart:math' as math;

import '../audio/sound.dart';
import '../core/cfg.dart';
import '../core/fmath.dart';
import '../data/js_config.dart';
import '../map/generator.dart';
import '../map/sizes.dart';
import 'alerts.dart';
import 'combat.dart';
import 'empire.dart' show classCaptureMul;
import 'features.dart';
import 'nations.dart';
import 'state.dart';

void buildCaptureZones(MatchState state) {
  final map = state.map;
  final radius = MAP_GEN.d('captureRadius');
  map.zoneAt.clear();
  for (final district in map.districts) {
    final cap = district.capture;
    if (cap == null) continue;
    district.zone = [];
    final ci = cap.i, cj = cap.j, span = radius.ceil();
    for (var j = cj - span; j <= cj + span; j++) {
      for (var i = ci - span; i <= ci + span; i++) {
        if (!map.inBounds(i, j)) continue;
        if (hypot((i - ci).toDouble(), (j - cj).toDouble()) > radius) continue;
        final key = map.idx(i, j);
        district.zone.add(key);
        (map.zoneAt[key] ??= []).add(district.id);
      }
    }
  }
}

String sideKeyOf(MatchState state, int playerId) {
  final team = state.players[playerId].team;
  return team != 0 ? 'team$team' : 'player$playerId';
}

bool _allied(MatchState state, int a, int b) => a == b || !isEnemyId(state, a, b);

class _Side { double power = 0; final int playerId; _Side(this.playerId); }

final _maxPower = CAPTURE.d('maxCapturePower');
void updateCapture(MatchState state) {
  final map = state.map;
  final zones = <int, Map<String, _Side>>{};
  final survival = state.mode == 'survival';
  for (final unit in state.units) {
    if (unit.state == 'dead') continue;
    final owner = state.players[unit.playerId];
    if (owner.passive || (owner.neutral && !survival && !owner.captures)) continue;
    final ids = map.zoneAt[map.idx(jsRound(unit.x), jsRound(unit.y))];
    if (ids == null) continue;
    for (final id in ids) {
      if (owner.ownOnly && map.districts[id].feature == null) continue;
      final sides = zones[id] ??= {};
      final entry = sides[sideKeyOf(state, unit.playerId)] ??= _Side(unit.playerId);
      entry.power += unit.stats.d('capturePower');
    }
  }
  for (final district in map.districts) {
    if (district.capture == null) continue;
    if (survival && district.police) continue;
    final sides = zones[district.id];
    district.contested = false;
    if (sides == null || sides.isEmpty) { _decayProgress(state, district); continue; }
    if (sides.length > 1) { district.contested = true; continue; }
    final s = sides.values.first;
    _advanceProgress(state, district, s.playerId, math.min(s.power, _maxPower));
  }
}

final _fortCapture = EMPIRE.m('fortify').l('capture');
void _advanceProgress(MatchState state, District district, int playerId, double power) {
  var step = CAPTURE.d('pointsPerSecond') * power * TICK_SEC * featureCaptureMul(district) * DISTRICT_SIZES.m('capture').d(sizeOf(district));
  if (state.economy) step *= classCaptureMul(state, playerId);   // ترقية الحشد (2026-11-12)
  if (district.fort != 0 && (district.owner == null || !_allied(state, playerId, district.owner!))) {
    step /= 1 + (_fortCapture[district.fort - 1] as num);
  }
  if (district.owner == null || !_allied(state, playerId, district.owner!)) {
    final bonus = captureBonus(state, district, playerId);
    if (bonus != 0) step *= 1 + bonus;
  }
  district.progressOwner ??= playerId;
  if (_allied(state, playerId, district.progressOwner!)) {
    _captureTick(state, district, playerId);
    district.progress = math.min(100, district.progress + step);
    if (district.progress >= 100 && district.owner != district.progressOwner) {
      final ownerBefore = district.owner;
      district.owner = district.progressOwner;
      if (ownerBefore != null && _allied(state, ownerBefore, district.owner!)) {
        district.owner = ownerBefore;
        district.progressOwner = ownerBefore;
      } else {
        _announceCapture(state, district);
      }
    }
  } else {
    final wasMine = district.owner == state.humanId;
    if (wasMine) raiseAlert(state, 'capture', district.capture!.i, district.capture!.j);
    _captureTick(state, district, playerId);
    district.progress = math.max(0, district.progress - step);
    if (district.progress <= 0) {
      district.owner = null;
      district.progressOwner = playerId;
      if (wasMine) sound('district_lost');
    }
  }
}

void _captureTick(MatchState state, District district, int playerId) {
  if (playerId != state.humanId && district.owner != state.humanId) return;
  if (state.time - district.tickAt < AUDIO.d('captureTickSeconds')) return;
  district.tickAt = state.time;
  soundAt(state, 'capture_tick', district.capture!.i.toDouble(), district.capture!.j.toDouble());
}

void _decayProgress(MatchState state, District district) {
  final step = CAPTURE.d('decayPerSecond') * TICK_SEC;
  if (district.owner != null) {
    district.progressOwner = district.owner;
    district.progress = math.min(100, district.progress + step);
  } else if (district.progress > 0) {
    district.progress = math.max(0, district.progress - step);
    if (district.progress <= 0) district.progressOwner = null;
  }
}

void _announceCapture(MatchState state, District district) {
  final player = state.players[district.owner!];
  final mine = district.owner == state.humanId;
  if (mine) sound(district.feature != null || district.building != null ? 'capture_special' : 'capture_done');
  if (!mine && state.notice != null && state.notice!.keep) return;
  final name = district.special != null ? _specialName(district.special!) : 'حي';
  state.notice = Notice(
      mine ? 'استوليت على $name'
          : player.gang == 'police' ? 'الشرطة استولت على $name'
          : player.neutral ? '${player.name} استولوا على $name'
          : '${player.name} استولى على $name',
      mine, CAPTURE.d('noticeSeconds'));
}

String _specialName(String special) => special == 'hospital' ? 'المستشفى' : special == 'armory' ? 'مخزن السلاح' : 'برج الساعة';

void updateNotice(MatchState state) {
  final n = state.notice;
  if (n == null) return;
  n.t -= TICK_SEC;
  if (n.t <= 0) state.notice = null;
}

// --- صبغ الحي بلون مالكه في نصف ثانية ---
void updateDistrictTints(MatchState state) {
  final step = TICK_SEC / CAPTURE.d('tintSeconds');
  for (final district in state.map.districts) {
    final target = district.owner != null ? state.players[district.owner!].color : null;
    if (target != null) {
      if (district.tintColor != target) { district.tintColor = target; district.tintMix = 0; }
      district.tintMix = math.min(1, district.tintMix + step);
    } else if (district.tintColor != null) {
      district.tintMix = math.max(0, district.tintMix - step);
      if (district.tintMix <= 0) district.tintColor = null;
    }
  }
}

void snapDistrictTints(MatchState state) {
  for (final district in state.map.districts) {
    if (district.owner == null) continue;
    district.tintColor = state.players[district.owner!].color;
    district.tintMix = 1;
  }
}

double tintAmount(District? district, double alpha) {
  if (district == null || district.tintColor == null) return 0;
  final steps = CAPTURE.d('tintSteps');
  return alpha * jsRound(district.tintMix * steps) / steps;
}
