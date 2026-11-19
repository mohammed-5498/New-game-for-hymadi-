// البحث عن المسارات: منقول من js/map/pathfinding.js بالترتيب نفسه (فالمسار نفسه بالضبط):
// A* بثمانية اتجاهات بلا قطع الزوايا، وكومة ثنائية مرتبة بالتكلفة ثم بترتيب الدخول، وحقول التدفق، والمربعات الفارغة
import 'dart:collection';
import 'dart:typed_data';

import '../data/js_config.dart';
import '../core/cfg.dart';
import 'generator.dart';

const _d8x = [1, -1, 0, 0, 1, 1, -1, -1], _d8y = [0, 0, 1, -1, 1, -1, 1, -1];

class _AStar {
  int size = 0, stamp = 0;
  Uint32List seen = Uint32List(0), done = Uint32List(0);
  Float64List g = Float64List(0), f = Float64List(0);
  Int32List from = Int32List(0), seq = Int32List(0), pos = Int32List(0), heap = Int32List(0);
  void ensure(int n) {
    if (size >= n) return;
    size = n;
    seen = Uint32List(n); done = Uint32List(n);
    g = Float64List(n); f = Float64List(n);
    from = Int32List(n); seq = Int32List(n); pos = Int32List(n); heap = Int32List(n);
  }
}

final _a = _AStar();

List<(int, int)>? findPath(GameMap map, int si, int sj, int ti, int tj) {
  if (!map.isWalkable(ti, tj) || !map.inBounds(si, sj)) return null;
  if (si == ti && sj == tj) return [];
  final n = map.n;
  double heuristic(int i, int j) {
    final dx = (i - ti).abs(), dy = (j - tj).abs();
    return (dx > dy ? dx : dy) + 0.414 * (dx < dy ? dx : dy);
  }
  final w = _a..ensure(n * n);
  w.stamp++;
  final seen = w.seen, done = w.done, g = w.g, f = w.f, from = w.from, seq = w.seq, pos = w.pos, heap = w.heap, stamp = w.stamp;
  var size = 0, order = 0;
  bool less(int x, int y) => f[x] < f[y] || (f[x] == f[y] && seq[x] < seq[y]);
  void up(int k) {
    final node = heap[k];
    while (k > 0) {
      final p = (k - 1) >> 1, parent = heap[p];
      if (!less(node, parent)) break;
      heap[k] = parent; pos[parent] = k; k = p;
    }
    heap[k] = node; pos[node] = k;
  }
  void down(int k) {
    final node = heap[k];
    for (;;) {
      final l = 2 * k + 1;
      if (l >= size) break;
      final r = l + 1;
      final c = r < size && less(heap[r], heap[l]) ? r : l;
      if (!less(heap[c], node)) break;
      heap[k] = heap[c]; pos[heap[k]] = k; k = c;
    }
    heap[k] = node; pos[node] = k;
  }

  final start = map.idx(si, sj);
  seen[start] = stamp; g[start] = 0; f[start] = heuristic(si, sj); from[start] = -1; seq[start] = order++;
  heap[0] = start; pos[start] = 0; size = 1;

  while (size > 0) {
    final current = heap[0];
    size--;
    if (size > 0) { heap[0] = heap[size]; pos[heap[0]] = 0; down(0); }
    final i = current % n, j = current ~/ n;
    if (i == ti && j == tj) return _rebuild(from, current, n);
    done[current] = stamp;
    for (var d = 0; d < 8; d++) {
      final dx = _d8x[d], dy = _d8y[d], a = i + dx, b = j + dy;
      if (!map.isWalkable(a, b)) continue;
      if (dx != 0 && dy != 0 && (!map.isWalkable(i + dx, j) || !map.isWalkable(i, j + dy))) continue;
      final next = map.idx(a, b);
      if (done[next] == stamp) continue;
      final cost = g[current] + (dx != 0 && dy != 0 ? 1.414 : 1);
      final known = seen[next] == stamp;
      if (!known || cost < g[next]) {
        g[next] = cost;
        f[next] = cost + heuristic(a, b);
        from[next] = current;
        if (!known) {
          seen[next] = stamp; seq[next] = order++;
          heap[size] = next; pos[next] = size; size++;
          up(size - 1);
        } else {
          up(pos[next]);
        }
      }
    }
  }
  return null;
}

List<(int, int)> _rebuild(Int32List from, int endNode, int n) {
  final path = <(int, int)>[];
  var node = endNode;
  while (from[node] != -1) {
    path.add((node % n, node ~/ n));
    node = from[node];
  }
  return path.reversed.toList();
}

// مربعات فارغة موصولة بالشوارع قرب نقطة (للتوزيع على المجموعة)، بحث عرضي حتى maxRadius
List<(int, int)> findFreeTiles(GameMap map, int si, int sj, int count, [int maxRadius = 10]) {
  final out = <(int, int)>[];
  final seen = <int>{map.idx(si, sj)};
  final queue = Queue<(int, int)>()..add((si, sj));
  while (queue.isNotEmpty && out.length < count) {
    final (i, j) = queue.removeFirst();
    if (map.isConnected(i, j)) out.add((i, j));
    for (var d = 0; d < 8; d++) {
      final a = i + _d8x[d], b = j + _d8y[d];
      if (!map.inBounds(a, b)) continue;
      final key = map.idx(a, b);
      if (seen.contains(key)) continue;
      if (((a - si).abs() > (b - sj).abs() ? (a - si).abs() : (b - sj).abs()) > maxRadius) continue;
      seen.add(key);
      queue.add((a, b));
    }
  }
  return out;
}

class FlowField {
  final (int, int) target;
  final Int32List distance;
  FlowField(this.target, this.distance);
}

// حقل تدفق: مسافة كل مربع عن الهدف (بحث عرضي واحد من الهدف)
FlowField? buildFlowField(GameMap map, int ti, int tj) {
  if (!map.isWalkable(ti, tj)) return null;
  final n = map.n;
  final distance = Int32List(n * n)..fillRange(0, n * n, -1);
  final start = map.idx(ti, tj);
  distance[start] = 0;
  final queue = Int32List(n * n);
  var head = 0, tail = 0;
  queue[tail++] = start;
  while (head < tail) {
    final current = queue[head++], i = current % n, j = current ~/ n, step = distance[current] + 1;
    for (var d = 0; d < 8; d++) {
      final dx = _d8x[d], dy = _d8y[d], a = i + dx, b = j + dy;
      if (!map.isWalkable(a, b)) continue;
      if (dx != 0 && dy != 0 && (!map.isWalkable(i + dx, j) || !map.isWalkable(i, j + dy))) continue;
      final next = map.idx(a, b);
      if (distance[next] >= 0) continue;
      distance[next] = step;
      queue[tail++] = next;
    }
  }
  return FlowField((ti, tj), distance);
}

// المربع التالي نحو الهدف حسب حقل التدفق
(int, int)? flowStep(GameMap map, FlowField field, int i, int j) {
  if (!map.inBounds(i, j)) return null;
  final here = field.distance[map.idx(i, j)];
  if (here <= 0) return null;
  (int, int)? best;
  var bestValue = here;
  for (var d = 0; d < 8; d++) {
    final dx = _d8x[d], dy = _d8y[d], a = i + dx, b = j + dy;
    if (!map.isWalkable(a, b)) continue;
    if (dx != 0 && dy != 0 && (!map.isWalkable(i + dx, j) || !map.isWalkable(i, j + dy))) continue;
    final value = field.distance[map.idx(a, b)];
    if (value >= 0 && value < bestValue) { bestValue = value; best = (a, b); }
  }
  return best;
}

(int, int)? nearestWalkable(GameMap map, int i, int j, [int maxRadius = 8]) {
  if (map.isConnected(i, j)) return (i, j);
  final found = findFreeTiles(map, i, j, 1, maxRadius);
  return found.isEmpty ? null : found[0];
}

final MAX_PATHS_PER_TICK = UNITS.i('pathRequestsPerTick');
