// ساحة تجربة القتال (أداة تحقق من المرحلة 4د): 7 غربان ضد 4 مطارق متقاربين والكاميرا مكبّرة.
// لا ظهور ولا بوتات ولا شرطة ولا فوز: قتال فقط، وبعد فناء أحد الطرفين تبدأ معركة جديدة.
import { COMBAT_REALISM } from '../config.js';
import { createUnit } from './units.js';
import { findFreeTiles, nearestWalkable } from '../map/pathfinding.js';
import { hypot } from './hypot.js';

const A = COMBAT_REALISM.arena;
const alive = (u) => u.state !== 'dead' && u.hp > 0;

// أوسع رقعة مفتوحة قرب مركز الخريطة (تقاطع أو ساحة) حتى لا تحجب المباني القتال،
// والمحور الذي يمتد فيه الشارع أطول: الصفان يقفان على طرفيه
function battleLine(map) {
  const c = map.n / 2, reach = Math.floor(map.n / 3);
  let best = null, bestScore = -1;
  for (let i = 2; i < map.n - 2; i++) {
    for (let j = 2; j < map.n - 2; j++) {
      if (!map.isWalkable(i, j) || hypot(i - c, j - c) > reach) continue;
      let open = 0;
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (map.isWalkable(i + a, j + b)) open++;
      const score = open - hypot(i - c, j - c) * 0.05;
      if (score > bestScore) { bestScore = score; best = [i, j]; }
    }
  }
  if (!best) return null;
  const run = (di, dj) => { let n = 0; while (n < 4 && map.isWalkable(best[0] + di * n, best[1] + dj * n)) n++; return n; };
  const alongI = run(1, 0) + run(-1, 0), alongJ = run(0, 1) + run(0, -1);
  const [di, dj] = alongI >= alongJ ? [1, 0] : [0, 1];
  // نبدأ من طرف الشارع حتى يقف الصفان على جانبي المركز
  return { i: best[0] - Math.round(di * A.gapTiles / 2), j: best[1] - Math.round(dj * A.gapTiles / 2), di, dj };
}

export function buildArena(state) {
  const map = state.map;
  state.units = [];
  state.projectiles = [];
  state.pathQueue = [];
  state.fires = [];
  state.arena = { overAt: -1 };

  const line = battleLine(map) || (() => { const [i, j] = nearestWalkable(map, map.n >> 1, map.n >> 1); return { i, j, di: 1, dj: 0 }; })();
  const a = [line.i, line.j];
  const b = [Math.round(line.i + line.di * A.gapTiles), Math.round(line.j + line.dj * A.gapTiles)];
  const left = findFreeTiles(map, a[0], a[1], A.crows);
  const right = findFreeTiles(map, b[0], b[1], A.hammers.length);

  for (let k = 0; k < A.crows; k++) {
    const [i, j] = left[k % left.length];
    const unit = createUnit(state, state.players[0], i + (k % 2) * 0.3, j + (k % 3) * 0.2);
    unit.faceAngle = Math.atan2(line.dj, line.di);
    state.units.push(unit);
  }
  A.hammers.forEach((hero, k) => {
    const [i, j] = right[k % right.length];
    const unit = createUnit(state, state.players[1], i, j, hero);
    unit.faceAngle = Math.atan2(-line.dj, -line.di);
    state.units.push(unit);
  });

  // الكاميرا مكبّرة على منتصف الصفين
  const mi = (a[0] + b[0]) / 2, mj = (a[1] + b[1]) / 2;
  state.camera.x = (mi - mj) * 18;
  state.camera.y = (mi + mj) * 9;
  state.camera.z = A.zoom;
}

export function updateArena(state) {
  const sides = new Set();
  for (const u of state.units) if (alive(u) && u.gang !== 'police') sides.add(u.playerId);
  if (sides.size > 1) return;
  if (state.arena.overAt < 0) { state.arena.overAt = state.time; return; }
  if (state.time - state.arena.overAt >= A.restartSeconds) {
    const camera = { ...state.camera };
    buildArena(state);
    Object.assign(state.camera, camera);             // لا نغيّر ما اختاره اللاعب من تقريب وموضع
  }
}
