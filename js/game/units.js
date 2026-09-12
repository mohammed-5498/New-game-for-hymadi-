// إنشاء الوحدات وحركتها على المسار
import { UNIT_BASE, GANGS, HEROES, UNITS, TICK_SEC } from '../config.js';
import { findPath, findFreeTiles, nearestWalkable } from '../map/pathfinding.js';
import { clearCombatOrders } from './combat.js';
import { moveSpeed } from './weather.js';

// إحصائيات الوحدة: الأساس + ميزة العصابة، أو الأساس + قيم الشخصية المميزة
export function unitStats(gangId, heroId) {
  if (heroId) return { ...UNIT_BASE, ...HEROES[heroId].stats };
  const gang = GANGS[gangId];
  return { ...UNIT_BASE, ...(gang && gang.unit ? gang.unit : {}) };
}

export function createUnit(state, player, i, j, heroId = null) {
  const stats = unitStats(player.gang, heroId);
  return {
    id: state.nextUnitId++,
    playerId: player.id,
    gang: player.gang,
    color: player.color,
    hero: heroId,                      // null للفرد العادي
    name: heroId ? HEROES[heroId].name : 'فرد',
    x: i, y: j,           // الموقع الحالي بالمربعات
    prevX: i, prevY: j,   // الموقع في التحديث السابق (لتنعيم الرسم)
    stats,
    hp: stats.hp,
    maxHp: stats.hp,
    state: 'idle',        // idle | moving | attacking | dead
    path: [],
    selected: false,

    // القتال
    target: null,           // الوحدة التي تهاجمها
    commandedTarget: false, // أمر هجوم من اللاعب: بدون حد مطاردة
    chaseOrigin: { x: i, y: j },
    attackCooldown: 0,
    repathTimer: 0,
    hitFlash: 0,            // ومضة عند تلقي ضربة
    deathTimer: 0,          // زمن السقوط قبل الاختفاء

    // المكافآت المحسوبة كل تحديث (هالة الزعيم، مخزن السلاح)
    damageMultiplier: 1,
    aura: false             // هل هو داخل هالة زعيم
  };
}

// أمر حركة لمجموعة الوحدات المحددة، مع توزيع مربعات متجاورة حتى لا تتكدس
export function commandMove(state, targetI, targetJ, units) {
  const map = state.map;
  const group = units.filter(u => u.state !== 'dead');
  if (!group.length) return 0;

  const clampedI = Math.max(0, Math.min(map.n - 1, Math.round(targetI)));
  const clampedJ = Math.max(0, Math.min(map.n - 1, Math.round(targetJ)));
  const start = nearestWalkable(map, clampedI, clampedJ);
  if (!start) return 0;

  const spots = findFreeTiles(map, start[0], start[1], group.length * UNITS.groupSpotsFactor);
  if (!spots.length) return 0;

  // الأقرب للهدف يأخذ المربعات الأقرب
  const sorted = [...group].sort((a, b) =>
    Math.hypot(a.x - start[0], a.y - start[1]) - Math.hypot(b.x - start[0], b.y - start[1]));

  let spotIndex = 0, ordered = 0;
  for (const unit of sorted) {
    while (spotIndex < spots.length) {
      const [i, j] = spots[spotIndex++];
      const path = findPath(map, Math.round(unit.x), Math.round(unit.y), i, j);
      if (path) {
        clearCombatOrders(unit);
        unit.path = path;
        unit.state = path.length ? 'moving' : 'idle';
        ordered++;
        break;
      }
    }
  }

  state.moveMarker = { i: clampedI, j: clampedJ, t: 0 };
  return ordered;
}

export function stopUnit(unit) {
  unit.path = [];
  if (unit.state === 'moving') unit.state = 'idle';
}

// تحديث كل الوحدات: خطوة زمنية ثابتة (TICK_SEC)
export function updateUnits(state) {
  for (const unit of state.units) {
    unit.prevX = unit.x;
    unit.prevY = unit.y;
    if (unit.state === 'dead') continue;
    moveAlongPath(state, unit);
  }
  applySeparation(state);
}

function moveAlongPath(state, unit) {
  if (!unit.path.length) {
    if (unit.state === 'moving') unit.state = 'idle';
    return;
  }

  const step = moveSpeed(state, unit) * TICK_SEC;   // الثلج يبطئ الجميع
  let remaining = step;

  // قد تقطع الوحدة أكثر من نقطة مسار في التحديث الواحد إذا كانت سريعة
  while (remaining > 0 && unit.path.length) {
    const [tx, ty] = unit.path[0];
    const dx = tx - unit.x, dy = ty - unit.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= remaining + UNITS.arriveDistance) {
      unit.x = tx; unit.y = ty;
      unit.path.shift();
      remaining -= dist;
    } else {
      unit.x += (dx / dist) * remaining;
      unit.y += (dy / dist) * remaining;
      remaining = 0;
    }
  }

  // الوحدة المهاجمة تبقى في حالتها؛ فقط أمر الحركة ينتهي بالانتظار
  if (!unit.path.length && unit.state === 'moving') unit.state = 'idle';
}

// قوة تباعد خفيفة حتى لا تتداخل الوحدات، بشرط ألا تدفع أي وحدة داخل مبنى
function applySeparation(state) {
  const map = state.map;
  const radius = UNITS.separationRadius;
  const push = UNITS.separationStrength * TICK_SEC;

  // شبكة بسيطة بخلايا بحجم مسافة التباعد لتقليل المقارنات
  const cells = new Map();
  const cellKey = (x, y) => Math.floor(x / radius) + ',' + Math.floor(y / radius);
  for (const unit of state.units) {
    if (unit.state === 'dead') continue;
    const key = cellKey(unit.x, unit.y);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(unit);
  }

  for (const unit of state.units) {
    if (unit.state === 'dead') continue;
    let ox = 0, oy = 0;
    const cx = Math.floor(unit.x / radius), cy = Math.floor(unit.y / radius);

    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const group = cells.get((cx + a) + ',' + (cy + b));
        if (!group) continue;
        for (const other of group) {
          if (other === unit) continue;
          const dx = unit.x - other.x, dy = unit.y - other.y;
          const dist = Math.hypot(dx, dy);
          if (dist >= radius) continue;
          if (dist < 0.0001) {   // متطابقتان تماماً: دفعة عشوائية صغيرة
            ox += (Math.random() - 0.5) * push;
            oy += (Math.random() - 0.5) * push;
            continue;
          }
          const force = ((radius - dist) / radius) * push;
          ox += (dx / dist) * force;
          oy += (dy / dist) * force;
        }
      }
    }

    if (ox === 0 && oy === 0) continue;
    const nx = unit.x + ox, ny = unit.y + oy;
    // لا ندفع الوحدة أبداً فوق مبنى
    if (map.isWalkable(Math.round(nx), Math.round(ny))) {
      unit.x = nx;
      unit.y = ny;
    }
  }
}
