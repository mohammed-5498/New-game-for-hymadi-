// إنشاء الوحدات وحركتها على المسار
import { UNIT_BASE, GANGS, HEROES, CHAMPIONS, POLICE, UNITS, TICK_SEC, PERFORMANCE } from '../config.js';
import { findPath, findFreeTiles, nearestWalkable, buildFlowField, flowStep } from '../map/pathfinding.js';
import { clearCombatOrders } from './combat.js';
import { moveSpeed } from './weather.js';
import { initRealism, faceAngleTo } from './realism.js';
import { hypot } from './hypot.js';

// إحصائيات الوحدة: الأساس + ميزة العصابة، أو الأساس + قيم الشخصية المميزة أو البطل
// والشرطة المحايدة لها جدولها الخاص (القسم 3.8)
export function unitStats(gangId, heroId, champion = false) {
  if (gangId === 'police') return { ...UNIT_BASE, ...POLICE[heroId === 'captain' ? 'captain' : 'common'] };
  if (champion) return { ...UNIT_BASE, ...CHAMPIONS[gangId].stats };
  if (heroId) return { ...UNIT_BASE, ...HEROES[heroId].stats };
  const gang = GANGS[gangId];
  return { ...UNIT_BASE, ...(gang && gang.unit ? gang.unit : {}) };
}

// اسم الوحدة كما يظهر للاعب
function unitName(gangId, heroId, champion) {
  if (gangId === 'police') return POLICE[heroId === 'captain' ? 'captain' : 'common'].name;
  if (champion) return CHAMPIONS[gangId].name;
  return heroId ? HEROES[heroId].name : 'فرد';
}

// champion: بطل العصابة (القسم 6.6). رسمه جاهز، وقواعد ظهوره في المرحلة 4
export function createUnit(state, player, i, j, heroId = null, champion = false) {
  const stats = unitStats(player.gang, heroId, champion);
  const unit = {
    id: state.nextUnitId++,
    playerId: player.id,
    gang: player.gang,
    color: player.color,
    hero: champion ? null : heroId,    // null للفرد العادي
    champion,                          // بطل اللاعب الوحيد
    name: unitName(player.gang, heroId, champion),
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

    // الضربة المميزة (القسم 6.7): الأفراد العاديون بلا ضربة ولا شحن
    ultCharge: 0,           // شريط الشحن من 0 إلى 100
    ultAnnounced: false,    // أُسمعت نغمة الجاهزية لهذا الشحن
    whistleAt: -99,         // آخر صافرة أطلقتها الشرطة
    ultStart: null,         // زمن بداية حركة الضربة المميزة (يقرأه الرسم)
    ultRate: 0,
    pendingUlt: null,       // تأثير ينتظر لحظة الارتطام
    damageTaken: 0,         // الضرر المتراكم لحساب شحن الضربة
    flurry: null,           // ضربات الوابل المتبقية
    invulnUntil: 0,         // تصلّب: لا يتلقى ضرراً حتى هذا الزمن
    buffUntil: 0,           // تحفيز: مكافأة ضرر وسرعة ضرب مؤقتة
    buffDamage: 0,
    buffAttackSpeed: 0,
    slowUntil: 0,           // إبطاء من الضربة الأرضية
    slowFactor: 0,

    // الشرطة المحايدة (القسم 3.8)
    stationId: -1,          // رقم حي المركز الذي تتبعه
    homePost: null,         // مركزها: لا تبتعد عنه أكثر من 6 مربعات
    vanishAt: -1,           // بعد الاستيلاء على مركزها تختفي عند هذا الزمن

    armorBonus: 0,          // درع إضافي من مكافأة مراكز الشرطة المملوكة

    // المكافآت المحسوبة كل تحديث (الهالات، مخزن السلاح)
    damageMultiplier: 1,
    aura: false,            // هل هو داخل هالة
    auraBonus: 0,           // أقوى مكافأة ضرر من الهالات المحيطة
    auraHeal: 0,            // علاج هالة بطل العقارب

    // حقول تُملأ لاحقاً، موجودة من البداية بقيمة "لا شيء" حتى يبقى لكل الوحدات نفس الشكل
    // (المحرك يبطئ كل وصول لخصائص الكائنات إن اختلفت أشكالها)
    hardened: false,        // تصلّب (realism.js)
    botTask: null,          // مهمة البوت (ai/bot.js)
    gatherRally: null,      // نقطة تجمع الفرقة (ai/squads.js)
    kiteAt: -99,            // آخر ابتعاد للرامي (ai/tactics.js)
    ultHeldSince: -1,       // بداية تأجيل الضربة المميزة (ai/tactics.js)
    lastHitBy: -1,          // آخر لاعب ضربه (حماية الزعيم)
    fadeAt: -1,             // زمن التلاشي بعد سقوط الزعيم
    wave: 0,                // رقم موجة الصمود (وحدات الشرطة فيه)
    waveFactor: 0,
    riot: false,
    boss: false,
    alwaysBlock: false,
    focusHeroes: false,
    artColor: null,
    artScale: null,
    healingTarget: null     // آخر من عالجه الطبيب
  };

  // القتال الواقعي (القسم 5.4): بذرة الشخصية وأسلوب القتال والحالات الجديدة
  initRealism(state, unit);
  if (!shapeWarm) warmShape(unit);
  return unit;
}

// حقول تبدأ null وتحمل أرقاماً لاحقاً
const NULL_NUMBERS = new Set(['attackStart', 'ultStart', 'gatherRally', 'artScale']);
let shapeWarm = false;

// (المرحلة 8) أول وحدة في الجلسة فقط: كل حقل يأخذ مرة واحدة أعم نوع سيحمله ثم يعود لقيمته فوراً.
// المحرك يعيد ترتيب شكل الكائن كلما تلقى حقلٌ نوعاً جديداً لأول مرة (عدد بفاصلة، رقم بدل null...)
// ويرمي الكود المحسّن لكل الوحدات أثناء اللعب؛ هكذا يحدث ذلك مرة واحدة هنا قبل أن يبدأ اللعب.
// القيم لا تتغير أبداً: نفس القيمة الأصلية تُعاد.
function warmShape(unit) {
  shapeWarm = true;
  for (const key of Object.keys(unit)) {
    const v = unit[key];
    if (typeof v === 'number') { unit[key] = 0.5; unit[key] = v; }
    else if (v === null) { unit[key] = NULL_NUMBERS.has(key) ? 0.5 : {}; unit[key] = null; }
    else if (typeof v === 'boolean') { unit[key] = !v; unit[key] = v; }
    else if (typeof v === 'string') { unit[key] = v + '_'; unit[key] = v; }
  }
}

// أمر حركة لمجموعة الوحدات المحددة
// المجموعات الكبيرة تستخدم حقل تدفق واحد، والصغيرة A* عبر طابور محدود
// showMarker: حلقة مكان الأمر للاعب وحده؛ أوامر البوتات والخلفية الحية بلا حلقة
export function commandMove(state, targetI, targetJ, units, showMarker = true) {
  const map = state.map;
  const group = units.filter(u => u.state !== 'dead');
  if (!group.length) return 0;

  const clampedI = Math.max(0, Math.min(map.n - 1, Math.round(targetI)));
  const clampedJ = Math.max(0, Math.min(map.n - 1, Math.round(targetJ)));
  const start = nearestWalkable(map, clampedI, clampedJ);
  if (!start) return 0;

  if (showMarker) state.moveMarker = { i: clampedI, j: clampedJ, t: 0 };

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
    hypot(a.x - start[0], a.y - start[1]) - hypot(b.x - start[0], b.y - start[1]));

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
export function commandAttackMove(state, targetI, targetJ, units, showMarker = true) {
  const map = state.map;
  const ordered = commandMove(state, targetI, targetJ, units, false);
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
  if (showMarker) state.moveMarker = { i: clampedI, j: clampedJ, t: 0, attack: true };   // حلقة حمراء
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
    if (unit.cState) continue;          // تفادٍ أو صدّ أو ترنّح: لا حركة على المسار
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
    const point = unit.path[0], tx = point[0], ty = point[1];
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
    if (unit.state !== 'attacking') faceAngleTo(unit, tx, ty);   // تمشي فتنظر حيث تمشي
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

// اتجاه الرسم مشتق من وجه الوحدة في العالم (القتال الواقعي يدوّر الوجه لا الاتجاه)
export function facingFromAngle(unit) {
  const screenDx = Math.cos(unit.faceAngle) - Math.sin(unit.faceAngle);
  if (Math.abs(screenDx) > 0.01) unit.facing = screenDx >= 0 ? 1 : -1;
}

// قوة تباعد خفيفة حتى لا تتداخل الوحدات، بشرط ألا تدفع أي وحدة داخل مبنى
// الشبكة بخلايا بحجم مسافة التباعد في مصفوفات أرقام تُعاد كل تحديث (بلا نصوص ولا كائنات جديدة)،
// وكل خلية تحفظ وحداتها بترتيب state.units نفسه: نفس المقارنات بنفس الترتيب، فالنتيجة مطابقة تماماً
const sepGrid = { cx: new Int32Array(0), cy: new Int32Array(0), count: new Int32Array(0), start: new Int32Array(0), list: new Int32Array(0) };

function applySeparation(state) {
  const map = state.map, units = state.units, total = units.length;
  const radius = UNITS.separationRadius;
  const radiusSq = radius * radius;
  const push = UNITS.separationStrength * TICK_SEC;
  const g = sepGrid;
  if (g.cx.length < total) {
    const size = Math.max(64, total * 2);
    g.cx = new Int32Array(size); g.cy = new Int32Array(size); g.list = new Int32Array(size);
  }

  // خلية كل وحدة حية، وحدود الشبكة
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let k = 0; k < total; k++) {
    const unit = units[k];
    if (unit.state === 'dead') continue;
    const x = Math.floor(unit.x / radius), y = Math.floor(unit.y / radius);
    g.cx[k] = x; g.cy[k] = y;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (minX === Infinity) return;
  // هامش خلية من كل جانب: الجيران عند الحافة خلايا فارغة لا خارج المصفوفة
  const w = maxX - minX + 3, h = maxY - minY + 3, cells = w * h;
  if (g.count.length < cells) { g.count = new Int32Array(cells * 2); g.start = new Int32Array(cells * 2); }
  const count = g.count, start = g.start, list = g.list;
  count.fill(0, 0, cells);
  const cellIndex = (x, y) => (x - minX + 1) + (y - minY + 1) * w;
  for (let k = 0; k < total; k++) if (units[k].state !== 'dead') count[cellIndex(g.cx[k], g.cy[k])]++;
  let sum = 0;
  for (let c = 0; c < cells; c++) { start[c] = sum; sum += count[c]; count[c] = 0; }
  for (let k = 0; k < total; k++) {
    if (units[k].state === 'dead') continue;
    const c = cellIndex(g.cx[k], g.cy[k]);
    list[start[c] + count[c]++] = k;
  }

  for (let k = 0; k < total; k++) {
    const unit = units[k];
    if (unit.state === 'dead') continue;
    let ox = 0, oy = 0;
    const cx = g.cx[k], cy = g.cy[k];

    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const c = cellIndex(cx + a, cy + b);
        const end = start[c] + count[c];
        for (let q = start[c]; q < end; q++) {
          const other = units[list[q]];
          if (other === unit) continue;
          const dx = unit.x - other.x, dy = unit.y - other.y;
          const distSq = dx * dx + dy * dy;
          if (distSq >= radiusSq) continue;
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
