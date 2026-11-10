// تنبيهات الحافة (js/game/alerts.js): سهم يشير إلى ما يحدث خارج الشاشة
import '../core/cfg.dart';
import '../data/js_config.dart';
import 'state.dart';

final _region = ALERTS.d('regionTiles');
bool _sameRegion(dynamic a, num i, num j) {
  final dx = a.i - i, dy = a.j - j;
  return dx * dx + dy * dy <= _region * _region;
}

// هل هذا المربع داخل الشاشة؟ (حساب الكاميرا في الرسم نفسه)
bool onScreen(MatchState state, double i, double j, [double margin = 0]) {
  final camera = state.camera;
  if (state.viewW == 0) return true;
  final wx = (i - j) * TILE_HALF_W, wy = (i + j) * TILE_HALF_H;
  final x = (wx - camera.x) * camera.z + state.viewW / 2;
  final y = (wy - camera.y) * camera.z + state.viewH / 2;
  return x >= -margin && x <= state.viewW + margin && y >= -margin && y <= state.viewH + margin;
}

bool raiseAlert(MatchState state, String kind, int i, int j) {
  if (onScreen(state, i.toDouble(), j.toDouble())) return false;
  for (final a in state.alerts) {
    if (a.kind == kind && _sameRegion(a, i, j)) { a.i = i; a.j = j; a.life = ALERTS.d('lifeSeconds'); return false; }
  }
  AlertSeen? seen;
  for (final a in state.alertSeen) { if (a.kind == kind && _sameRegion(a, i, j)) { seen = a; break; } }
  if (seen != null && state.time - seen.t < ALERTS.d('repeatSeconds')) return false;
  if (seen != null) { seen.i = i; seen.j = j; seen.t = state.time; } else { state.alertSeen.add(AlertSeen(kind, i, j, state.time)); }
  state.alertSeen.removeWhere((a) => !(state.time - a.t < ALERTS.d('repeatSeconds')));
  if (state.alerts.length >= ALERTS.i('maxArrows')) {
    state.alerts.sort((a, b) => a.life.compareTo(b.life));
    state.alerts.removeAt(0);
  }
  state.alerts.add(Alert(kind, i, j, ALERTS.d('lifeSeconds')));
  return true;
}

void updateAlerts(MatchState state) {
  if (state.alerts.isEmpty) return;
  for (final a in state.alerts) { a.life -= TICK_SEC; }
  state.alerts.removeWhere((a) => !(a.life > 0 && !onScreen(state, a.i.toDouble(), a.j.toDouble())));
}
