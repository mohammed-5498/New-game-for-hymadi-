// البحث عن المسارات: A* بثمانية اتجاهات + بحث BFS عن مربعات فارغة
import { UNITS } from '../config.js';

export const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// نفس الاتجاهات بنفس الترتيب في مصفوفتين: حلقة أرقام بلا تفكيك مصفوفات في الحلقات الساخنة
const D8X = D8.map(d => d[0]), D8Y = D8.map(d => d[1]);

// A* على الشبكة، مع منع قطع الزوايا بين المباني
// القائمة المفتوحة كومة ثنائية مرتبة بالتكلفة المتوقعة ثم بترتيب الدخول (أسبق الداخلين أولاً عند التساوي):
// نفس اختيار البحث الخطي القديم تماماً فنفس المسار، لكن بلا Map ولا Set ولا مسح للمصفوفات (رقم "جيل" لكل بحث)
let A = null;
function astarArrays(size) {
  if (!A || A.size < size) {
    A = {
      size, stamp: 0,
      seen: new Uint32Array(size),     // = stamp: المربع اكتُشف في هذا البحث (له g وf وfrom وseq)
      done: new Uint32Array(size),     // = stamp: المربع أُغلق
      g: new Float64Array(size), f: new Float64Array(size),
      from: new Int32Array(size), seq: new Int32Array(size),
      pos: new Int32Array(size), heap: new Int32Array(size)
    };
  }
  A.stamp++;
  return A;
}

export function findPath(map, si, sj, ti, tj) {
  if (!map.isWalkable(ti, tj) || !map.inBounds(si, sj)) return null;
  if (si === ti && sj === tj) return [];

  const n = map.n;
  const heuristic = (i, j) => {
    const dx = Math.abs(i - ti), dy = Math.abs(j - tj);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };
  const W = astarArrays(n * n);
  const { seen, done, g, f, from, seq, pos, heap } = W, stamp = W.stamp;
  let size = 0, order = 0;
  // أصغر (f ثم seq) في الأعلى
  const less = (x, y) => f[x] < f[y] || (f[x] === f[y] && seq[x] < seq[y]);
  const up = (k) => {
    const node = heap[k];
    while (k > 0) {
      const p = (k - 1) >> 1, parent = heap[p];
      if (!less(node, parent)) break;
      heap[k] = parent; pos[parent] = k; k = p;
    }
    heap[k] = node; pos[node] = k;
  };
  const down = (k) => {
    const node = heap[k];
    for (;;) {
      const l = 2 * k + 1;
      if (l >= size) break;
      const r = l + 1;
      const c = r < size && less(heap[r], heap[l]) ? r : l;
      if (!less(heap[c], node)) break;
      heap[k] = heap[c]; pos[heap[k]] = k; k = c;
    }
    heap[k] = node; pos[node] = k;
  };

  const start = map.idx(si, sj);
  seen[start] = stamp; g[start] = 0; f[start] = heuristic(si, sj); from[start] = -1; seq[start] = order++;
  heap[0] = start; pos[start] = 0; size = 1;

  while (size) {
    const current = heap[0];
    size--;
    if (size) { heap[0] = heap[size]; pos[heap[0]] = 0; down(0); }

    const i = current % n, j = (current - i) / n;
    if (i === ti && j === tj) return rebuildPath(from, current, n);

    done[current] = stamp;

    for (let d = 0; d < 8; d++) {
      const dx = D8X[d], dy = D8Y[d];
      const a = i + dx, b = j + dy;
      if (!map.isWalkable(a, b)) continue;
      // منع قطع الزوايا: لا حركة قطرية إذا كان أحد الجانبين مبنى
      if (dx && dy && (!map.isWalkable(i + dx, j) || !map.isWalkable(i, j + dy))) continue;

      const next = map.idx(a, b);
      if (done[next] === stamp) continue;

      const cost = g[current] + (dx && dy ? 1.414 : 1);
      const known = seen[next] === stamp;
      if (!known || cost < g[next]) {
        g[next] = cost;
        f[next] = cost + heuristic(a, b);
        from[next] = current;
        if (!known) {
          // مربع جديد يدخل القائمة المفتوحة برقم دخوله
          seen[next] = stamp; seq[next] = order++;
          heap[size] = next; pos[next] = size; size++;
          up(size - 1);
        } else {
          up(pos[next]);       // تكلفته نقصت وهو ما زال في القائمة المفتوحة
        }
      }
    }
  }
  return null; // لا يوجد طريق
}

function rebuildPath(from, endNode, n) {
  const path = [];
  let node = endNode;
  while (from[node] !== -1) {
    const i = node % n;
    path.push([i, (node - i) / n]);
    node = from[node];
  }
  return path.reverse();
}

// يبحث عن عدد من المربعات الفارغة القريبة من نقطة (للتوزيع على المجموعة)
// لا يعيد إلا المربعات الموصولة بشبكة الشوارع (القسم 3.4.1): الظهور والحركة
// لا يستهدفان فراغاً معزولاً حتى لو كان قابلاً للمشي
export function findFreeTiles(map, si, sj, count, maxRadius = 10) {
  const out = [];
  const seen = new Set([map.idx(si, sj)]);
  const queue = [[si, sj]];

  while (queue.length && out.length < count) {
    const [i, j] = queue.shift();
    if (map.isConnected(i, j)) out.push([i, j]);
    for (let d = 0; d < 8; d++) {
      const dx = D8X[d], dy = D8Y[d];
      const a = i + dx, b = j + dy;
      if (!map.inBounds(a, b)) continue;
      const key = map.idx(a, b);
      if (seen.has(key)) continue;
      if (Math.max(Math.abs(a - si), Math.abs(b - sj)) > maxRadius) continue;
      seen.add(key);
      queue.push([a, b]);
    }
  }
  return out;
}

// حقل تدفق: مسافة كل مربع عن الهدف (بحث عرضي واحد من الهدف)
// يُبنى مرة واحدة للمجموعة الكبيرة بدل A* لكل وحدة
export function buildFlowField(map, ti, tj) {
  if (!map.isWalkable(ti, tj)) return null;

  const n = map.n;
  const distance = new Int32Array(n * n).fill(-1);
  const start = map.idx(ti, tj);
  distance[start] = 0;

  const queue = new Int32Array(n * n);
  let head = 0, tail = 0;
  queue[tail++] = start;

  while (head < tail) {
    const current = queue[head++];
    const i = current % n, j = (current - i) / n;
    const step = distance[current] + 1;

    for (let d = 0; d < 8; d++) {
      const dx = D8X[d], dy = D8Y[d];
      const a = i + dx, b = j + dy;
      if (!map.isWalkable(a, b)) continue;
      // منع قطع الزوايا مثل A*
      if (dx && dy && (!map.isWalkable(i + dx, j) || !map.isWalkable(i, j + dy))) continue;
      const next = map.idx(a, b);
      if (distance[next] >= 0) continue;
      distance[next] = step;
      queue[tail++] = next;
    }
  }
  return { target: [ti, tj], distance };
}

// المربع التالي في اتجاه الهدف حسب حقل التدفق
export function flowStep(map, field, i, j) {
  if (!map.inBounds(i, j)) return null;
  const here = field.distance[map.idx(i, j)];
  if (here <= 0) return null;             // وصلنا الهدف أو مربع غير موصول

  let best = null, bestValue = here;
  for (let d = 0; d < 8; d++) {
    const dx = D8X[d], dy = D8Y[d];
    const a = i + dx, b = j + dy;
    if (!map.isWalkable(a, b)) continue;
    if (dx && dy && (!map.isWalkable(i + dx, j) || !map.isWalkable(i, j + dy))) continue;
    const value = field.distance[map.idx(a, b)];
    if (value >= 0 && value < bestValue) { bestValue = value; best = [a, b]; }
  }
  return best;
}

// أقرب مربع يمكن المشي عليه من نقطة معينة
export function nearestWalkable(map, i, j, maxRadius = 8) {
  if (map.isConnected(i, j)) return [i, j];
  const found = findFreeTiles(map, i, j, 1, maxRadius);
  return found.length ? found[0] : null;
}

export const MAX_PATHS_PER_TICK = UNITS.pathRequestsPerTick;
