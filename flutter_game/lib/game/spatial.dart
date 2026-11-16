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
  // الدلاء نفسها في مصفوفة بأرقام الخلايا داخل الخريطة (2.1.2): البحث يصل إلى الدلو مباشرة بلا جدول (Map)
  final gw = (state.map.n / _cell).ceil() + 1;
  if (state.gridW != gw) {
    state.gridW = gw;
    state.unitGrid = List<List<Unit>?>.filled(gw * gw, null);
    for (final e in cells.entries) { _place(state, e.key, e.value); }
  }
  for (final unit in state.units) {
    if (unit.state == 'dead') continue;
    final key = _cellIndex(unit.x, unit.y);
    var bucket = cells[key];
    if (bucket == null) { cells[key] = bucket = []; _place(state, key, bucket); }
    bucket.add(unit);
  }
  state.unitHashTime = state.time;
  // الخلايا المشغولة وحدها مرتبة بإحداثياتها (i ثم j، كترتيب المرور على الخلايا): المسح الكبير للبوتات يمر عليها
  // بدل كل خلايا مربعه (169 خلية لنصف قطر 12، وأغلبها فارغة)، بالترتيب نفسه فالنتيجة نفسها
  final keys = [for (final e in cells.entries) if (e.value.isNotEmpty) e.key]..sort();
  state.unitCells
    ..clear()
    ..addAll([for (final k in keys) (k ~/ _stride - _offset, k % _stride - _offset, cells[k]!)]);
}

void _place(MatchState state, int key, List<Unit> bucket) {
  final ci = key ~/ _stride - _offset, cj = key % _stride - _offset, gw = state.gridW;
  if (ci >= 0 && cj >= 0 && ci < gw && cj < gw) state.unitGrid[ci * gw + cj] = bucket;
}

void ensureUnitHash(MatchState state) {
  if (state.unitHashTime == state.time && state.unitHash.isNotEmpty) return;
  buildUnitHash(state);
}

// لكل وحدة داخل الخلايا التي تغطي دائرة نصف قطرها radius
void forEachNearby(MatchState state, double x, double y, double radius, void Function(Unit) callback) {
  ensureUnitHash(state);
  final cells = state.unitHash, grid = state.unitGrid, gw = state.gridW;
  final minI = ((x - radius) / _cell).floor(), maxI = ((x + radius) / _cell).floor();
  final minJ = ((y - radius) / _cell).floor(), maxJ = ((y + radius) / _cell).floor();
  for (var ci = minI; ci <= maxI; ci++) {
    final base = (ci + _offset) * _stride + _offset, inside = ci >= 0 && ci < gw;
    for (var cj = minJ; cj <= maxJ; cj++) {
      final bucket = inside && cj >= 0 && cj < gw ? grid[ci * gw + cj] : cells[base + cj];
      if (bucket == null) continue;
      for (var k = 0; k < bucket.length; k++) { callback(bucket[k]); }
    }
  }
}

// مدى الخلايا التي تغطي دائرة (نفس حساب forEachNearby)
(int, int, int, int) cellBox(double x, double y, double radius) =>
    (((x - radius) / _cell).floor(), ((x + radius) / _cell).floor(), ((y - radius) / _cell).floor(), ((y + radius) / _cell).floor());

