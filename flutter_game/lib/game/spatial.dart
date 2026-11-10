// الشبكة المكانية بخلايا 2 × 2 مربع (js/game/spatialHash.js): البحث عن الوحدات القريبة بدل مقارنة كل وحدة بكل وحدة.
// الدلاء بترتيب state.units، والمرور على الخلايا بإحداثياتها، فالنتيجة بترتيب اللعبة الحالية نفسه
import '../core/cfg.dart';
import '../data/js_config.dart';
import 'state.dart';

final _cell = PERFORMANCE.d('hashCellTiles');
const _offset = 2048, _stride = 4096;

int _cellIndex(double x, double y) => ((x / _cell).floor() + _offset) * _stride + ((y / _cell).floor() + _offset);

void buildUnitHash(MatchState state) {
  final cells = state.unitHash;
  for (final bucket in cells.values) { bucket.clear(); }
  for (final unit in state.units) {
    if (unit.state == 'dead') continue;
    (cells[_cellIndex(unit.x, unit.y)] ??= []).add(unit);
  }
  state.unitHashTime = state.time;
}

void ensureUnitHash(MatchState state) {
  if (state.unitHashTime == state.time && state.unitHash.isNotEmpty) return;
  buildUnitHash(state);
}

// لكل وحدة داخل الخلايا التي تغطي دائرة نصف قطرها radius
void forEachNearby(MatchState state, double x, double y, double radius, void Function(Unit) callback) {
  ensureUnitHash(state);
  final cells = state.unitHash;
  final minI = ((x - radius) / _cell).floor(), maxI = ((x + radius) / _cell).floor();
  final minJ = ((y - radius) / _cell).floor(), maxJ = ((y + radius) / _cell).floor();
  for (var ci = minI; ci <= maxI; ci++) {
    final base = (ci + _offset) * _stride + _offset;
    for (var cj = minJ; cj <= maxJ; cj++) {
      final bucket = cells[base + cj];
      if (bucket == null) continue;
      for (var k = 0; k < bucket.length; k++) { callback(bucket[k]); }
    }
  }
}

// مدى الخلايا التي تغطي دائرة (نفس حساب forEachNearby)
(int, int, int, int) cellBox(double x, double y, double radius) =>
    (((x - radius) / _cell).floor(), ((x + radius) / _cell).floor(), ((y - radius) / _cell).floor(), ((y + radius) / _cell).floor());

// وحدات خلية واحدة (للمسح الكبير بالخلايا: البوتات)
List<Unit>? cellUnits(MatchState state, int ci, int cj) {
  ensureUnitHash(state);
  return state.unitHash[(ci + _offset) * _stride + cj + _offset];
}
