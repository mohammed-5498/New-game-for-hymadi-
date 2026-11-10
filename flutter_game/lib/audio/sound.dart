// الصوت (ن10): هنا ما يحتاجه المنطق وحده. soundAt يعيد هل الحدث على الشاشة (للتنبيهات) كـ js/audio/sound.js
import '../core/cfg.dart';
import '../data/js_config.dart';
import '../game/state.dart';

final _margin = AUDIO.d('screenMargin');

bool soundOnScreen(MatchState state, double i, double j) {
  if (state.viewW == 0) return false;
  final c = state.camera;
  final x = ((i - j) * TILE_HALF_W - c.x) * c.z + state.viewW / 2;
  final y = ((i + j) * TILE_HALF_H - c.y) * c.z + state.viewH / 2;
  return !(x < -_margin || x > state.viewW + _margin || y < -_margin || y > state.viewH + _margin);
}

bool soundAt(MatchState state, String name, double i, double j, [String? style]) => soundOnScreen(state, i, j);
void soundAlert(MatchState state, String name, double i, double j) {}
void sound(String name) {}
