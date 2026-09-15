// إنشاء الوحدات وحركتها على المسار
import { UNIT_BASE, GANGS, HEROES, CHAMPIONS, UNITS, TICK_SEC, PERFORMANCE } from '../config.js';
import { findPath, findFreeTiles, nearestWalkable, buildFlowField, flowStep } from '../map/pathfinding.js';
import { clearCombatOrders } from './combat.js';
import { moveSpeed } from './weather.js';

// إحصائيات الوحدة: الأساس + ميزة العصابة، أو الأساس + قيم الشخصية المميزة أو البطل
export function unitStats(gangId, heroId, champion = false) {
  if (champion) return { ...UNIT_BASE, ...CHAMPIONS[gangId].stats };
  if (heroId) return { ...UNIT_BASE, ...HEROES[heroId].stats };
  const gang = GANGS[gangId];
  return { ...UNIT_BASE, ...(gang && gang.unit ? gang.unit : {}) };
}

// champion: بطل العصابة (القسم 6.6). رسمه جاهز، وقواعد ظهوره في المرحلة 4
export function createUnit(state, player, i, j, heroId = null, champion = false) {
  const stats = unitStats(player.gang, heroId, champion);
  return {
    id: state.nextUnitId++,
    playerId: player.id,
    gang: player.gang,
    color: player.color,
    hero: champion ? null : heroId,    // null للفرد العادي
    champion,                          // بطل اللاعب الوحيد
    name: champion ? CHAMPIONS[player.gang].name : heroId ? HEROES[heroId].name : 'فرد',
    x: i, y: j,           // الموقع الحالي بالمربعات
    prevX: i, prevY: j,   // الموقع في التحديث السابق (لتنعيم الرسم)
    stats,
    hp: stats.hp,
    maxHp: stats.hp,
    state: 'idle',        // idle | moving | attackMove | attacking | dead
    facing: 1,            // اتجاه الرسم: 1 يمين و-1 يسار (اتجاه الشاشة)
    path: [],
    selected: false,

    // الحركة
    flow: null,             // حقل تدفق للمجموعات الكبيرة
    awaitingPath: false,    // طلب مسار في الطابور
    orderSeq: 0,            // رقم الأمر: يلغي الطلبات القديمة في الطابور
    attackMove: null,       // وجهة أمر الهجوم المتحرك {i, j}

    // القتال
    target: null,           // الوحدة التي تهاجمها
    commandedTarget: false, // أمر هجوم من اللاعب: بدون حد مطاردة
    chaseOrigin: { x: i, y: j },
    attackCooldown: 0,
    attackStart: null,      // زمن بداية آخر ضربة (يقرأه الرسم)
    attackRate: 0,          // زمن الضربة الحالية
    pendingHit: null,       // ضربة في منتصفها تنتظر لحظة الارتطام
    repathTimer: 0,
    hitFlash: 0,            // ومضة عند تلقي ضربة
    hurtTimer: 0,           // مدة عرض أنميشن تلقي الضرر
    deathTimer: 0,          // زمن السقوط قبل الاختفاء

    // تسارع الاشتباك (المزدوج وبطل الغربان): ضربات متتالية تقصّر زمن الضربة
    comboStacks: 0,
    comboTime: -99,         // زمن آخر ضربة في السلسلة
    comboTarget: null,

    // المكافآت المحسوبة كل تحديث (الهالات، مخزن السلاح)
    damageMultiplier: 1,
    aura: false,            // هل هو داخل هالة
    auraBonus: 0,           // أقوى مكافأة ضرر من الهالات المحيطة
    auraHeal: 0             // علاج هالة بطل العقارب
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
  clearCombatOrders(unit);      // يلغي الهدف والضربة المعلّقة ووجهة الهجوم المتحرك
  unit.path = [];
  unit.flow = null;
  unit.awaitingPath = false;
  unit.orderSeq++;
}

// أمر الهجوم المتحرك: تتقدم المجموعة نحو المكان، وتتوقف لقتال من يعترضها
// ثم تواصل تقدمها (عكس أمر الحركة العادي الذي يتجاهل الأعداء)
export function commandAttackMove(state, targetI, targetJ, units) {
  const map = state.map;
  const ordered = commandMove(state, targetI, targetJ, units);
  if (!ordered) return 0;

  const clampedI = Math.max(0, Math.min(map.n - 1, Math.round(targetI)));
  const clampedJ = Math.max(0, Math.min(map.n - 1, Math.round(targetJ)));
  const destination = nearestWalkable(map, clampedI, clampedJ);
  if (!destination) return 0;

  for (const unit of units) {
    if (unit.state === 'dead') continue;
    unit.attackMove = { i: destination[0], j: destination[1] };
    if (unit.state === 'moving') unit.state = 'attackMove';
  }
  state.moveMarker = { i: clampedI, j: clampedJ, t: 0, attack: true };   // حلقة حمراء
  return ordered;
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
      unit.state = unit.attackMove ? 'attackMove' : 'moving';
    } else {
      unit.state = 'idle';
      unit.attackMove = null;
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
    if ((unit.state === 'moving' || unit.state === 'attackMove') && !unit.awaitingPath) {
      unit.state = 'idle';
      unit.attackMove = null;     // وصلت وجهة الهجوم المتحرك
    }
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
    faceTowards(unit, tx, ty);
  }

  // الوحدة المهاجمة تبقى في حالتها؛ وأمر الحركة ينتهي بالانتظار
  // (إلا إذا كانت تتبع حقل تدفق أو تنتظر مسارها)
  if (!unit.path.length && !unit.flow && !unit.awaitingPath &&
      (unit.state === 'moving' || unit.state === 'attackMove')) {
    unit.state = 'idle';
    unit.attackMove = null;
  }
}

// اتجاه النظر: موجب إذا كان الهدف إلى يمين الشاشة
// (في الرسم المائل يكون يمين الشاشة باتجاه زيادة i ونقصان j)
export function faceTowards(unit, targetI, targetJ) {
  const screenDx = (targetI - unit.x) - (targetJ - unit.y);
  if (Math.abs(screenDx) > 0.01) unit.facing = screenDx >= 0 ? 1 : -1;
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
