// إنشاء الوحدات وحركتها على المسار
import { UNIT_BASE, GANGS, HEROES, UNITS, TICK_SEC, PERFORMANCE } from '../config.js';
import { findPath, findFreeTiles, nearestWalkable, buildFlowField, flowStep } from '../map/pathfinding.js';
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

    // الحركة
    flow: null,             // حقل تدفق للمجموعات الكبيرة
    awaitingPath: false,    // طلب مسار في الطابور
    orderSeq: 0,            // رقم الأمر: يلغي الطلبات القديمة في الطابور

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

// أمر حركة لمجموعة الوحدات المحددة
// المجموعات الكبيرة تستخدم حقل تدفق واحد، والصغيرة A* عبر طابور محدود
export function commandMove(state, targetI, targetJ, units) {
  const map = state.map;
  const group = units.filter(u => u.state !== 'dead');
  if (!group.length) return 0;

  const clampedI = Math.max(0, Math.min(map.n - 1, Math.round(targetI)));
  const clampedJ = Math.max(0, Math.min(map.n - 1, Math.round(targetJ)));
  const start = nearestWalkable(map, clampedI, clampedJ);
  if (!start) return 0;

  state.moveMarker = { i: clampedI, j: clampedJ, t: 0 };

  // مجموعة كبيرة: حقل تدفق واحد من الهدف بدل A* لكل وحدة
  if (group.length > PERFORMANCE.flowFieldMinGroup) {
    const field = buildFlowField(map, start[0], start[1]);
    if (field) {
      for (const unit of group) {
        beginOrder(unit);
        unit.flow = field;
        unit.state = 'moving';
      }
      return group.length;
    }
  }

  const spots = findFreeTiles(map, start[0], start[1], group.length * UNITS.groupSpotsFactor);
  if (!spots.length) return 0;

  // الأقرب للهدف يأخذ المربعات الأقرب
  const sorted = [...group].sort((a, b) =>
    Math.hypot(a.x - start[0], a.y - start[1]) - Math.hypot(b.x - start[0], b.y - start[1]));

  let spotIndex = 0, ordered = 0;
  for (const unit of sorted) {
    if (spotIndex >= spots.length) break;
    const [i, j] = spots[spotIndex++];
    beginOrder(unit);
    unit.state = 'moving';
    unit.awaitingPath = true;
    state.pathQueue.push({ unit, i, j, seq: unit.orderSeq });
    ordered++;
  }
  return ordered;
}

// بداية أمر جديد: يلغي المسار والقتال والطلبات القديمة
function beginOrder(unit) {
  clearCombatOrders(unit);
  unit.path = [];
  unit.flow = null;
  unit.awaitingPath = false;
  unit.orderSeq++;
}

// طابور طلبات المسار: عدد محدود من عمليات A* في كل تحديث
export function processPathQueue(state) {
  let budget = UNITS.pathRequestsPerTick;

  while (budget > 0 && state.pathQueue.length) {
    const request = state.pathQueue.shift();
    const unit = request.unit;
    // طلب قديم ألغاه أمر أحدث، أو وحدة ماتت
    if (unit.state === 'dead' || unit.orderSeq !== request.seq) continue;

    budget--;
    const path = findPath(state.map, Math.round(unit.x), Math.round(unit.y), request.i, request.j);
    unit.awaitingPath = false;
    if (path && path.length) {
      unit.path = path;
      unit.state = 'moving';
    } else {
      unit.state = 'idle';
    }
  }
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
  // مجموعة كبيرة تتبع حقل التدفق: نأخذ المربع التالي كلما فرغ المسار
  if (!unit.path.length && unit.flow) {
    const step = flowStep(state.map, unit.flow, Math.round(unit.x), Math.round(unit.y));
    if (step) unit.path = [step];
    else { unit.flow = null; unit.state = 'idle'; return; }   // وصلت الهدف
  }

  if (!unit.path.length) {
    // تنتظر مسارها من الطابور: تبقى في حالة الحركة حتى تتجاهل الأعداء
    if (unit.state === 'moving' && !unit.awaitingPath) unit.state = 'idle';
    return;
  }

  const step = moveSpeed(state, unit) * TICK_SEC;   // الثلج يبطئ الجميع
  let remaining = step;

  // قد تقطع الوحدة أكثر من نقطة مسار في التحديث الواحد إذا كانت سريعة
  while (remaining > 0 && unit.path.length) {
    const [tx, ty] = unit.path[0];
    const dx = tx - unit.x, dy = ty - unit.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

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

  // الوحدة المهاجمة تبقى في حالتها؛ وأمر الحركة ينتهي بالانتظار
  // (إلا إذا كانت تتبع حقل تدفق أو تنتظر مسارها)
  if (!unit.path.length && unit.state === 'moving' && !unit.flow && !unit.awaitingPath) {
    unit.state = 'idle';
  }
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
          const distSq = dx * dx + dy * dy;
          if (distSq >= radius * radius) continue;
          const dist = Math.sqrt(distSq);
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
