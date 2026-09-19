// البحث عن المسارات: A* بثمانية اتجاهات + بحث BFS عن مربعات فارغة
import { UNITS } from '../config.js';

export const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// A* على الشبكة، مع منع قطع الزوايا بين المباني
export function findPath(map, si, sj, ti, tj) {
  if (!map.isWalkable(ti, tj) || !map.inBounds(si, sj)) return null;
  if (si === ti && sj === tj) return [];

  const n = map.n;
  const heuristic = (i, j) => {
    const dx = Math.abs(i - ti), dy = Math.abs(j - tj);
    return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
  };

  const start = map.idx(si, sj);
  const open = [start];
  const inOpen = new Set([start]);
  const gScore = new Map([[start, 0]]);
  const fScore = new Map([[start, heuristic(si, sj)]]);
  const cameFrom = new Map();
  const closed = new Set();

  while (open.length) {
    // نأخذ أقل تكلفة متوقعة (بحث بسيط، يكفي لأحجام خرائطنا)
    let best = 0;
    for (let k = 1; k < open.length; k++) {
      if (fScore.get(open[k]) < fScore.get(open[best])) best = k;
    }
    const current = open.splice(best, 1)[0];
    inOpen.delete(current);

    const i = current % n, j = (current - i) / n;
    if (i === ti && j === tj) return rebuildPath(cameFrom, current, n);

    closed.add(current);

    for (const [dx, dy] of D8) {
      const a = i + dx, b = j + dy;
      if (!map.isWalkable(a, b)) continue;
      // منع قطع الزوايا: لا حركة قطرية إذا كان أحد الجانبين مبنى
      if (dx && dy && (!map.isWalkable(i + dx, j) || !map.isWalkable(i, j + dy))) continue;

      const next = map.idx(a, b);
      if (closed.has(next)) continue;

      const cost = gScore.get(current) + (dx && dy ? 1.414 : 1);
      if (!gScore.has(next) || cost < gScore.get(next)) {
        gScore.set(next, cost);
        fScore.set(next, cost + heuristic(a, b));
        cameFrom.set(next, current);
        if (!inOpen.has(next)) { open.push(next); inOpen.add(next); }
      }
    }
  }
  return null; // لا يوجد طريق
}

function rebuildPath(cameFrom, endNode, n) {
  const path = [];
  let node = endNode;
  while (cameFrom.has(node)) {
    const i = node % n;
    path.push([i, (node - i) / n]);
    node = cameFrom.get(node);
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
    for (const [dx, dy] of D8) {
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

    for (const [dx, dy] of D8) {
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
  for (const [dx, dy] of D8) {
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
