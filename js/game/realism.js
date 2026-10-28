// القتال الواقعي (القسم 5.4): منقول من التنفيذ المرجعي في docs/combat-reference.html
// الحركات الأربع، الرؤية ورد الفعل، التفادي والصدّ، قاعدة الزاوية، الترنّح والارتداد،
// الالتفاف، والاصطدام بالحلفاء. كل الأرقام في COMBAT_REALISM و COMBAT_STYLE.
//
// المرجع يعمل بالبكسل وبخطوة زمنية حرة؛ هنا كل المسافات بالمربعات والخطوة ثابتة (TICK_SEC).
import { TICK_SEC, COMBAT_REALISM as CR, COMBAT_STYLE, FIGHT, nations } from '../config.js';
import { forEachNearby } from './spatialHash.js';
import { onScreen } from './alerts.js';
import { hypot } from './hypot.js';

const NATION_FX = nations.fx;

// --- أدوات ---
export const wrapAngle = (a) => {
  while (a > Math.PI) a -= 6.283185307;
  while (a < -Math.PI) a += 6.283185307;
  return a;
};

// مولّد أرقام شبه عشوائي ببذرة: نفس البذرة تعطي نفس الشخصية دائماً
function rng32(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const spread = (rng, [a, b]) => a + (b - a) * rng();

// بعد تحميل مباراة محفوظة: مولّد جديد للوحدة (الدالة لا تُحفظ، وتتابع أرقامها لا يهم اللعب)
export function restoreRng(state, unit) {
  unit.rng = rng32(((unit.id * 2654435761) ^ (state.combatSeed || 0) ^ Math.floor(state.time * 1000)) >>> 0);
}

// مفتاح أسلوب القتال: بادئة العصابة + نوع الوحدة
const STYLE_PREFIX = { crows: 'crow', hammers: 'hammer', vipers: 'viper', scorpions: 'scorpion', police: 'police' };

function styleOf(unit) {
  const prefix = STYLE_PREFIX[unit.gang] || 'crow';
  const kind = unit.champion ? 'champion' : (unit.hero || 'common');
  const gang = COMBAT_STYLE.gangs[unit.gang] || COMBAT_STYLE.gangs.crows;
  const own = COMBAT_STYLE.units[prefix + '_' + kind] || COMBAT_STYLE.units[prefix + '_common'] || {};
  return {
    turn: own.turn !== undefined ? own.turn : gang.turn,
    flank: own.flank !== undefined ? own.flank : gang.flank,
    moves: own.moves || ['quick'],
    block: !!own.block,
    primary: own.primary || null
  };
}

// بذرة الشخصية عند إنشاء الوحدة (تُستدعى من createUnit)
export function initRealism(state, unit) {
  const rng = rng32(((unit.id * 2654435761) ^ (state.combatSeed || 0)) >>> 0);
  unit.style = styleOf(unit);
  unit.rng = rng;
  unit.traits = {
    aggr: spread(rng, CR.traits.aggr),
    skill: spread(rng, CR.traits.dodgeSkill),
    react: spread(rng, CR.traits.react),
    spd: spread(rng, CR.traits.spd),
    size: spread(rng, CR.traits.size)
  };

  unit.faceAngle = 0;          // وجه الوحدة في عالم المربعات (راديان)
  unit.cState = null;          // dodge | block | stagger (فوق الحالة الأصلية)
  unit.cTimer = 0;
  unit.cMove = null;           // الحركة الجارية: quick | heavy | thrust | spin
  unit.cMoveT = 0;
  unit.cPhases = null;         // أزمنة الحركة الجارية بعد التحجيم
  unit.sight = null;           // رؤية معلّقة {at, from, ranged}
  unit.stamina = CR.stMax;
  unit.dodgeCd = 0;
  unit.vx = 0; unit.vy = 0;    // ارتداد (مربع/ثانية)
  unit.dvx = 0; unit.dvy = 0;  // قفزة التفادي
  unit.bumpCd = 0;
  unit.blockFlash = 0;
  unit.dodgeType = 'leap';     // leap | duck
  unit.flinch = 0;             // ارتداد خفيف مرئي بعد الإصابة
  unit.flinchBack = false;     // الضربة جاءت من الخلف فيميل للأمام
  unit.combo = false;          // أنهى لكمة أو ركلة ويكمل بالسلاح (القسم 5.4.7)
  unit.rolling = false;        // جثة متدحرجة
  unit.lod = 'full';
  unit.lodAt = 0;

  // أنميشن القتال حسب السلاح (القسم 5.4.8): يكتبها القتال ويقرؤها الرسم وحده، فلا تغيّر اللعب
  unit.cNode = null;           // عقدة الحركة الجارية أو الأخيرة في شجرة التتابع (L1, H1, D...)
  unit.chainAt = -1e9;         // متى انتهت الحركة الأخيرة (نافذة التتابع)
  unit.approachAt = -1e9;      // آخر تقدّم نحو الهدف، وبداية هذا التقدّم (ضربة الاندفاع)
  unit.approachSince = -1e9;
  unit.landAt = -1e9;          // متى أصابت ضربتها الأخيرة (التجمّد عند الارتطام)، ومتى عُرفت نتيجتها أصابت أم لا
  unit.hitDoneAt = -1e9;
  unit.hitAt = -1e9;           // متى أُصيبت آخر مرة، وتجمّدها، وأسلوب الضارب وعقدته (رد فعلها)
  unit.hitStop = 0;
  unit.hitStyle = '';
  unit.hitNode = '';
  unit.deathFront = false;     // ماتت بضربة من الخلف: تسقط على وجهها
}

// --- أزمنة الحركة ---
// الأزمنة في المرجع مطلقة؛ هنا نسبية لزمن ضربة الوحدة حتى تبقى أرقام القسم 6 كما هي
export function moveTiming(key, baseAttackTime) {
  const m = CR.moves[key];
  const scale = baseAttackTime / CR.moveTimeBase;
  return {
    wind: m.wind * scale,
    strike: m.strike * scale,
    hold: m.hold * scale,
    rec: m.rec * scale,
    total: (m.wind + m.strike + m.hold + m.rec) * scale
  };
}

// --- قاعدة الزاوية ---
// أمام ±60°، جانب حتى ±120°، وما بعدها خلف (لا يرى الضربة ولا يتفاداها)
export function zoneOf(target, fromX, fromY) {
  const d = Math.abs(wrapAngle(Math.atan2(fromY - target.y, fromX - target.x) - target.faceAngle));
  return d <= CR.frontHalf ? 'front' : d <= CR.sideHalf ? 'side' : 'back';
}

export const zoneDamage = (zone) => CR.dmgMul[zone];

// هل الوحدة في مرحلة التعافي من حركتها؟ (يحبّب على المهاجم الضربة القوية)
function inRecovery(unit) {
  if (unit.cState === 'stagger' || unit.cState === 'down') return true;
  if (!unit.cMove || !unit.cPhases) return false;
  const p = unit.cPhases;
  return unit.cMoveT > p.wind + p.strike + p.hold;
}

// --- اختيار الحركة بالنقاط (كما في chooseMove المرجعية) ---
export function chooseMove(unit, target, dist, nearCount, range) {
  let best = null, bestScore = -1e9;
  const low = unit.hp / unit.maxHp < 0.3;

  for (const key of unit.style.moves) {
    const m = CR.moves[key];
    if (dist > range + m.rangeAdd + CR.reachBonus) continue;

    let score = 1;
    if (key === 'quick')  score = 1.0 + (low ? 1.0 : 0);
    if (key === 'heavy')  score = 0.8 + (inRecovery(target) ? 2.0 : 0) + (unit.traits.aggr - 1) * 0.8 - (low ? 0.5 : 0);
    if (key === 'thrust') score = 0.6 + (dist > range * 0.8 ? 1.2 : 0);
    if (key === 'spin')   score = 0.2 + (nearCount >= 3 ? 2.5 : nearCount === 2 ? 0.6 : 0);
    if (key === 'punch')      score = 0.9 + (dist < range * 0.7 ? 1.0 : 0);
    if (key === 'kick_front') score = 0.7 + (dist < range * 0.6 ? 0.9 : 0);
    if (key === 'kick_high')  score = 0.45 + (inRecovery(target) ? 1.4 : 0) + (unit.traits.aggr - 1) * 0.8;
    if (unit.combo) score += m.unarmed ? -0.8 : 1.2;       // بعد لكمة أو ركلة: غالباً يكمل بالسلاح
    if (key === unit.style.primary) score += CR.primaryBonus;
    // السافات (سمة فرنسا، القسم 3.10): الركلات تُختار أكثر
    if (unit.stats.kicks && (key === 'kick_front' || key === 'kick_high')) score += unit.stats.kicks.prefer;

    score *= 1 + (unit.rng() * 2 - 1) * CR.jitter;
    if (score > bestScore) { bestScore = score; best = key; }
  }
  return best;
}

// --- أنميشن القتال حسب السلاح (القسم 5.4.8) ---
// أسلوب الشخصية من سلاحها، وعقدة الحركة المختارة في شجرة تتابع أسلوبها. للرسم وحده: لا يقرؤها اللعب
export function fightStyle(unit) {
  const table = FIGHT.weapons[unit.nation] || FIGHT.weapons[unit.gang] || FIGHT.weapons.crows;
  return table[unit.champion ? 'champion' : (unit.hero || 'common')] || 'blade';
}
export const fightBig = (unit) => !unit.champion && !!FIGHT.big[unit.hero];
// القائد (البطل): سلسلة أسلوبه ورابعة بعدها L4
const LEADER_CHAIN = {};
for (const [name, style] of Object.entries(FIGHT.styles)) LEADER_CHAIN[name] = style.chain.concat('L4');

export function fightNode(state, unit, key, target) {
  const name = fightStyle(unit), style = FIGHT.styles[name];
  const special = FIGHT.special.find(k => unit.style.moves.includes(k));
  if (unit.champion && target && target.hp <= target.maxHp * FIGHT.finisherHp && (key === 'heavy' || key === special)) return 'F';
  if (style.dash.includes(key) && state.time - unit.approachAt <= FIGHT.dashWindow &&
      unit.approachAt - unit.approachSince >= FIGHT.dashMin) return 'D';
  if (key === 'heavy') return 'H1';
  if (key === special) return 'S1';
  if (style.light.includes(key)) {
    const chain = unit.champion ? LEADER_CHAIN[name] : style.chain;
    if (state.time - unit.chainAt > FIGHT.window) return chain[0];
    if (unit.cNode === 'P') return chain[1];                       // اللكمة تفتح السلسلة
    return chain[(chain.indexOf(unit.cNode) + 1) % chain.length];   // غير موجودة (-1) ← الأولى
  }
  return key === 'punch' ? 'P' : key === 'kick_front' ? 'KF' : key === 'kick_high' ? 'KH' : key === 'spin' ? 'S1' : 'D';
}

// التجمّد عند الارتطام بالثواني لضربة هذه العقدة (يقرؤه رسم الضارب والمُصاب)
const NODE_GROUP = { L1: 'light', L2: 'light', L3: 'light', L4: 'light', D: 'dash', P: 'punch', KF: 'kick_front',
                     KH: 'kick_high', H1: 'heavy', S1: 'special', F: 'finisher' };
export function hitstopOf(style, node, big) {
  const s = (FIGHT.hitstop[style] || FIGHT.hitstop.blade) * (FIGHT.hitstopMul[NODE_GROUP[node]] || 1) * (big ? FIGHT.hitstopBig : 1);
  return Math.min(FIGHT.hitstopMax, s);
}

// --- الرؤية المعلّقة ---
// عندما يبدأ المهاجم استعداده يسجّل عند الهدف رؤية تنفَّذ بعد زمن رد فعله.
// ليلاً يتأخر رد الفعل لأن الوحدة ترى الضربة متأخرة (القسم 7).
export function registerSight(state, attacker, target, ranged = false) {
  if (!target || target.state === 'dead' || target.hp <= 0) return;
  if (target.sight) return;                             // رؤية معلّقة قائمة
  if (target.cState) return;                            // مترنّح أو متفادٍ أو صادّ
  if (target.lod === 'stat' || target.lod === 'simple') return;   // المستوى المبسّط بلا رؤية معلّقة
  const night = state.weather === 'night' ? CR.nightReact : 0;   // ترى الضربة متأخرة
  target.sight = { at: state.time + target.traits.react + night, from: attacker, ranged };
}

// --- التفادي والصدّ ---
function beginDodge(state, unit, attacker) {
  // نوع التفادي: الطعنة تُتفادى بالقفز للخلف، والتلويح والضربة القوية بالانحناء تحتها غالباً
  const mv = attacker.cMove;
  unit.dodgeType = (mv === 'thrust' || mv === 'kick_front') ? 'leap'
    : mv === 'kick_high' ? 'duck' : (unit.rng() < CR.duckChance ? 'duck' : 'leap');
  const away = Math.atan2(unit.y - attacker.y, unit.x - attacker.x) + (unit.rng() * 2 - 1) * 1.2;
  const speed = CR.dodgeDist / CR.dodgeTime * (unit.dodgeType === 'duck' ? CR.duckSpeed : 1);
  cancelSwing(unit);
  unit.cState = 'dodge';
  unit.cTimer = CR.dodgeTime;
  unit.dvx = Math.cos(away) * speed;
  unit.dvy = Math.sin(away) * speed;
  unit.stamina -= CR.dodgeCost;
  unit.dodgeCd = CR.dodgeCd;
  state.combatEvents.dodge++;
  addPop(state, unit, 'تفادى!', 'dodge');
}

function beginBlock(state, unit) {
  cancelSwing(unit);
  unit.cState = 'block';
  unit.cTimer = CR.blockTime;
  unit.stamina -= CR.blockCost;
  state.combatEvents.block++;
  addPop(state, unit, 'صدّ!', 'block');
}

// يُلغي ضربة في منتصفها (التفادي في أول نصف الاستعداد يلغي الضربة)، وتبدأ سلسلة التتابع من أولها
function cancelSwing(unit) {
  unit.cMove = null;
  unit.cPhases = null;
  unit.pendingHit = null;
  unit.attackStart = null;
  unit.chainAt = -1e9;
}

// الوحدة رأت الاستعداد: هل تتفادى أو تصدّ؟
export function tryReact(state, unit, attacker, ranged) {
  if (!attacker || attacker.state === 'dead' || attacker.hp <= 0) return;
  if (!attacker.cMove && !ranged) return;              // ألغى ضربته
  if (unit.invulnUntil > state.time) return;           // تصلّب: لا يحتاج تفادياً

  // يتفادى المنتظر والماشي، ومن كان في النصف الأول من استعداده فيلغي ضربته.
  // المترنّح ومن في الضرب أو التعافي لا يتفادى.
  const earlyWind = !!unit.cMove && unit.cPhases && unit.cMoveT < unit.cPhases.wind * 0.5;
  if (unit.cState || (unit.cMove && !earlyWind)) return;

  const zone = zoneOf(unit, attacker.x, attacker.y);
  let mul = CR.angleMul[zone];
  if (mul <= 0) return;                                 // من الخلف: لا يرى ولا يتفادى

  // الدرع يصدّ الضربات القريبة من الأمام فقط، والمقذوف لا يُصَدّ
  // (وحدة التدخل في الصمود تصدّ دائماً ما دام معها تحمّل: alwaysBlock)
  if (!ranged && unit.style.block && zone === 'front' && unit.stamina >= CR.blockCost &&
      (unit.alwaysBlock || unit.rng() < CR.blockBase * unit.traits.skill)) {
    beginBlock(state, unit);
    return;
  }

  if (ranged) mul *= CR.projectileDodge;                 // المقذوف بنصف الاحتمال
  // الجينغا (البرازيل، القسم 3.10): نقاط تُضاف إلى فرصة التفادي الأساسية
  const base = unit.stats.dodge ? CR.dodgeBase * unit.traits.skill + unit.stats.dodge : CR.dodgeBase * unit.traits.skill;
  if (unit.stamina >= CR.dodgeCost && unit.dodgeCd <= 0 &&
      unit.rng() < base * mul) {
    beginDodge(state, unit, attacker);
  }
}

// --- الارتداد الفيزيائي ---
export function knockback(unit, fromX, fromY, tiles) {
  if (!tiles) return;
  if (unit.hardened) return;                     // تصلّب: لا يُدفع
  const angle = Math.atan2(unit.y - fromY, unit.x - fromX);
  const v = tiles * CR.friction;          // الإزاحة الكلية = tiles بعد تباطؤ الاحتكاك
  unit.vx += Math.cos(angle) * v;
  unit.vy += Math.sin(angle) * v;
}

// ترنّح: يُلغي الضربة والرؤية المعلّقة
export function stagger(state, unit, seconds) {
  if (unit.invulnUntil > state.time) return;     // تصلّب: لا يترنّح
  if (unit.steadyUntil > state.time) return;     // صيحة الحارة (القسم 3.10): يصمد بلا ترنّح
  cancelSwing(unit);
  unit.sight = null;
  unit.cState = 'stagger';
  unit.cTimer = seconds;
  state.combatEvents.stagger++;
}

// الصدّ نجح: المهاجم يرتد ويترنّح
export function blockedBy(state, attacker, blocker) {
  blocker.blockFlash = 0.2;
  stagger(state, attacker, CR.staggerBlocked);
  knockback(attacker, blocker.x, blocker.y, 0.5);
}

// دفع الجثة بضربة قاتلة: القوية والدائرية تدحرجها أبعد
export function corpseKnock(state, target, attacker, moveKey) {
  const big = moveKey === 'heavy' || moveKey === 'spin';
  if (big && state.rollingCorpses >= CR.maxRagdolls) return;   // سقف الجثث المتدحرجة
  knockback(target, attacker.x, attacker.y, big ? CR.corpseKnockBig : CR.corpseKnockSmall);
  if (big) { target.rolling = true; state.rollingCorpses++; state.combatEvents.roll++; }
}

// --- دوران الوجه بسرعة محدودة: البطيء في الدوران يُلتف عليه ---
export function turnToward(unit, targetX, targetY, seconds) {
  const want = Math.atan2(targetY - unit.y, targetX - unit.x);
  const delta = wrapAngle(want - unit.faceAngle);
  // أثناء الضربة يدور الجميع ببطء واحد، فمن يضرب لا يستطيع متابعة من يلتف عليه
  const rate = unit.cMove ? Math.min(unit.style.turn, CR.turnWhileAttacking) : unit.style.turn;
  const step = rate * seconds;
  unit.faceAngle = wrapAngle(unit.faceAngle + Math.max(-step, Math.min(step, delta)));
  return Math.abs(wrapAngle(want - unit.faceAngle));
}

// وجه الوحدة فوراً (أوامر اللاعب والحركة العادية)
export function faceAngleTo(unit, targetX, targetY) {
  unit.faceAngle = Math.atan2(targetY - unit.y, targetX - unit.x);
}

// --- الالتفاف: نقطة الاقتراب ---
// إن كان الهدف مشغولاً بقتال غيرنا اتجهنا إلى نقطة خلفه بقدر ميل الالتفاف
export function approachPoint(unit, target, range) {
  const R = range * 0.85;
  const engagedElse = target.target && target.target !== unit &&
                      target.target.state !== 'dead' && target.target.hp > 0;
  const weight = engagedElse ? unit.style.flank : unit.style.flank * 0.25;

  const bx = target.x - Math.cos(target.faceAngle) * R;      // خلف الهدف
  const by = target.y - Math.sin(target.faceAngle) * R;
  const ang = Math.atan2(unit.y - target.y, unit.x - target.x);
  const fx = target.x + Math.cos(ang) * R;                   // أمامه من جهتنا
  const fy = target.y + Math.sin(ang) * R;

  // كائن واحد يُعاد في كل استدعاء: المستدعي (fightTarget) يقرأ x وy فوراً ولا يحفظه
  APPROACH.x = fx + (bx - fx) * weight;
  APPROACH.y = fy + (by - fy) * weight;
  return APPROACH;
}
const APPROACH = { x: 0, y: 0 };

// تفضيل الهدف المشغول بغيرنا عند اختيار الهدف (يُطرح من المسافة)
export function busyBonus(unit, other) {
  const busy = other.target && other.target !== unit &&
               other.target.state !== 'dead' && other.target.hp > 0;
  return busy ? CR.busyBonus * unit.style.flank : 0;
}

// عدد الأعداء الملاصقين: الضربة الدائرية تُختار حين يكثرون
export function crowdCount(state, unit, isEnemyFn) {
  let count = 0;
  forEachNearby(state, unit.x, unit.y, CR.crowdRadius, (other) => {
    if (other === unit || other.state === 'dead' || other.hp <= 0) return;
    const dx = other.x - unit.x, dy = other.y - unit.y;
    if (dx * dx + dy * dy > CR.crowdRadius * CR.crowdRadius) return;
    if (!isEnemyFn(state, unit, other)) return;
    count++;
  });
  return count;
}

// --- التحديث لكل وحدة: الارتداد، التحمّل، المؤقتات، الرؤية المعلّقة ---
// يعيد true إذا كانت الوحدة مشغولة بحالة قتالية (تفادٍ أو صدّ أو ترنّح) فلا تتصرف
export function updateRealism(state, unit) {
  const map = state.map;
  unit.blockFlash = Math.max(0, unit.blockFlash - TICK_SEC);
  unit.flinch = Math.max(0, unit.flinch - TICK_SEC);
  unit.bumpCd = Math.max(0, unit.bumpCd - TICK_SEC);

  // الارتداد: سرعة تتناقص بالاحتكاك، ولا تدفع الوحدة أبداً داخل مبنى
  if (unit.vx || unit.vy) {
    const nx = unit.x + unit.vx * TICK_SEC;
    const ny = unit.y + unit.vy * TICK_SEC;
    if (map.isWalkable(Math.round(nx), Math.round(ny))) { unit.x = nx; unit.y = ny; }
    else { unit.vx = 0; unit.vy = 0; }
    const friction = Math.exp(-CR.friction * TICK_SEC);
    unit.vx *= friction; unit.vy *= friction;
    if (Math.abs(unit.vx) < 0.01 && Math.abs(unit.vy) < 0.01) {
      unit.vx = 0; unit.vy = 0;
      releaseRagdoll(state, unit);
    }
  }

  if (unit.state === 'dead') return true;

  // تصلّب أو راية مغروسة (لا يُدفع، القسم 3.10): يقرأه الارتداد والاصطدام
  unit.hardened = unit.invulnUntil > state.time || unit.holdUntil > state.time;
  if (unit.cState !== 'dodge') unit.stamina = Math.min(CR.stMax, unit.stamina + CR.stRegen * TICK_SEC);
  unit.dodgeCd = Math.max(0, unit.dodgeCd - TICK_SEC);

  // الرؤية المعلّقة: القرار يقع بعد زمن رد الفعل، فالضربة السريعة تسبق البطيء
  if (unit.sight && state.time >= unit.sight.at) {
    const { from, ranged } = unit.sight;
    unit.sight = null;
    tryReact(state, unit, from, ranged);
  }

  if (!unit.cState) return false;

  // تفادٍ: قفزة جانبية لا تدخل مبنى
  if (unit.cState === 'dodge') {
    const nx = unit.x + unit.dvx * TICK_SEC;
    const ny = unit.y + unit.dvy * TICK_SEC;
    if (map.isWalkable(Math.round(nx), Math.round(ny))) { unit.x = nx; unit.y = ny; }
  }

  unit.cTimer -= TICK_SEC;
  if (unit.cTimer <= 0) { unit.cState = null; unit.dvx = 0; unit.dvy = 0; }
  return true;
}

// تُفرج عن مكان في سقف الجثث المتدحرجة (عند التوقف أو عند حذف الجثة)
export function releaseRagdoll(state, unit) {
  if (!unit.rolling) return;
  unit.rolling = false;
  state.rollingCorpses = Math.max(0, state.rollingCorpses - 1);
}

// --- الاصطدام: وحدة مرتدة تصطدم بحليفها فتُترنّحه، والجثة المتدحرجة تزحزح من تلمسه ---
export function updateBumps(state, isEnemyFn) {
  // (دالة الجيران في دالة منفصلة: داخل الحلقة كانت تحجز ذاكرة لكل وحدة حتى الواقفة)
  for (let k = 0, units = state.units; k < units.length; k++) {
    const unit = units[k];
    const speed = hypot(unit.vx, unit.vy);
    if (speed <= CR.bumpSpeed || unit.bumpCd > 0) continue;
    bumpFrom(state, unit, isEnemyFn);
  }
}

function bumpFrom(state, unit, isEnemyFn) {
  const dead = unit.state === 'dead';
  forEachNearby(state, unit.x, unit.y, CR.crowdRadius, (other) => {
    if (other === unit || unit.bumpCd > 0) return;
    if (other.state === 'dead' || other.hp <= 0) return;
    const dx = other.x - unit.x, dy = other.y - unit.y;
    if (dx * dx + dy * dy > 0.45 * 0.45) return;          // ملاصقة فعلاً

    if (dead) {                                            // جثة متدحرجة: تزحزح بلا ترنّح
      other.vx += unit.vx * 0.4; other.vy += unit.vy * 0.4;
      unit.vx *= 0.6; unit.vy *= 0.6;
      unit.bumpCd = CR.corpseBumpCd;
      return;
    }
    if (isEnemyFn(state, unit, other)) return;             // الاصطدام بالحلفاء وحدهم
    if (other.cState === 'stagger' || other.cState === 'dodge') return;
    if (other.invulnUntil > state.time) return;           // تصلّب: لا يترنّح ولا يُدفع

    stagger(state, other, CR.staggerBump);
    other.vx += unit.vx * 0.5; other.vy += unit.vy * 0.5;
    unit.vx *= 0.5; unit.vy *= 0.5;
    unit.bumpCd = CR.bumpCd;
    state.combatEvents.bump++;
    addPop(state, other, 'اصطدام!', 'bump');
  });
}

// --- مستويات التفصيل (القسم 5.4.5) ---
// كامل: أقرب 60 وحدة داخل الشاشة. مبسّط: باقي ما في الشاشة. إحصائي: خارجها.
// يُعاد الحساب كل نصف ثانية لا كل تحديث.
export function updateLod(state) {
  if (state.time < state.lodAt) return;
  state.lodAt = state.time + CR.lod.refreshSeconds;

  const cx = state.camera.x, cy = state.camera.y;
  const visible = [];
  let alive = 0;
  for (const unit of state.units) {
    if (unit.state !== 'dead') alive++;
    if (!onScreen(state, unit.x, unit.y, 40)) { unit.lod = 'stat'; continue; }
    unit.lod = 'simple';
    const wx = (unit.x - unit.y) * 18, wy = (unit.x + unit.y) * 9;
    const dx = wx - cx, dy = wy - cy;
    visible.push({ unit, d: dx * dx + dy * dy });
  }
  // مباراة فيها أكثر من 800 وحدة: حد المستوى الكامل 30 بدل 60 (القسم 5.4.5)
  const fullUnits = alive > CR.lod.crowdedAbove ? CR.lod.fullUnitsCrowded : CR.lod.fullUnits;
  state.lodCrowded = visible.length > fullUnits;   // يقلل أشباح أثر السلاح عند الازدحام
  if (visible.length <= fullUnits) {
    for (const v of visible) v.unit.lod = 'full';
    return;
  }
  visible.sort((a, b) => a.d - b.d);
  for (let k = 0; k < fullUnits; k++) visible[k].unit.lod = 'full';
}

// الضرر الإحصائي خارج الشاشة أقل قليلاً (القسم 5.4.5)
export const statDamageFactor = CR.lod.offScreenDamage;

// الفاصل بعد التعافي: انتظار عشوائي مقسوم على الجرأة
export const attackPause = (unit) => (CR.pauseMin + unit.rng() * CR.pauseRandom) / unit.traits.aggr;

// --- الكلمات الطائرة (القسم 5.4.4ب): تُسجَّل هنا وتُرسم فوق الحدث ---
export function addPop(state, unit, text, kind) {
  if (unit.lod === 'stat') return;                     // خارج الشاشة: لا أحد يراها
  state.pops.push({ x: unit.x, y: unit.y, text, color: CR.pops.colors[kind], t: 0 });
  if (state.pops.length > CR.pops.max) state.pops.shift();
}

// آثار ضربات أبطال الأمم (القسم 3.10): حلقة تتسع أو غبار، تُرسم فوق طبقة الليل (renderer.js)
// r: نصف قطر الحلقة بالمربعات
export function addUltFx(state, kind, x, y, r = 1, color = '#e6c25a') {
  state.ultFx.push({ kind, x, y, r, color, t: 0 });
}

export function updatePops(state) {
  if (state.ultFx.length) {
    for (const fx of state.ultFx) fx.t += TICK_SEC;
    state.ultFx = state.ultFx.filter(fx => fx.t < NATION_FX[fx.kind + 'Seconds']);
  }
  if (state.pops.length) {
    for (const pop of state.pops) pop.t += TICK_SEC;
    state.pops = state.pops.filter(pop => pop.t < CR.pops.seconds);
  }
  if (state.fx.length) {
    for (const fx of state.fx) fx.t += TICK_SEC;
    state.fx = state.fx.filter(fx => fx.t < (fx.life || CR.burstSeconds));
  }
  if (state.clashes.length) {
    for (const fx of state.clashes) fx.t += TICK_SEC;
    state.clashes = state.clashes.filter(fx => fx.t < CR.clashFxSeconds);
  }
}

// --- ارتداد خفيف مع كل ضربة عادية: ميلان 0.2 ث ودفع صغير، ولا يقطع هجوم المصاب ---
export function flinch(unit, fromX, fromY, fromBack, push = true) {
  unit.flinch = CR.flinchTime;
  unit.flinchBack = fromBack;
  if (push) knockback(unit, fromX, fromY, CR.flinchKnock);
}

// --- تصادم الأسلحة: متقابلان يضرب كل منهما الآخر في نفس اللحظة تقريباً ---
// يعيد true إذا تصادمت الضربتان (لا ضرر على أحد)
export function tryClash(state, unit, target) {
  if (!target.cMove || !target.cPhases || !target.pendingHit) return false;
  if (target.target !== unit) return false;
  if (zoneOf(target, unit.x, unit.y) !== 'front' || zoneOf(unit, target.x, target.y) !== 'front') return false;
  const hitAt = target.cPhases.wind + target.cPhases.strike * CR.strikeMoment;
  if (Math.abs(target.cMoveT - hitAt) > CR.clashWindow) return false;
  // مبارزة الفاكون (الأرجنتين، القسم 3.10): تصادم أكثر إن كان أحدهما يملكها
  const bonus = Math.max(unit.stats.clashBonus || 0, target.stats.clashBonus || 0);
  if (unit.rng() >= (bonus ? CR.clashChance + bonus : CR.clashChance)) return false;

  for (const [a, b] of [[unit, target], [target, unit]]) {
    stagger(state, a, CR.clashStagger);                   // يُلغي ضربة الهدف أيضاً
    knockback(a, b.x, b.y, CR.clashKnock);
  }
  const mx = (unit.x + target.x) / 2, my = (unit.y + target.y) / 2;
  state.clashes.push({ x: mx, y: my, t: 0 });
  state.combatEvents.clash++;
  if (unit.lod !== 'stat') {
    state.pops.push({ x: mx, y: my, text: 'تصادم!', color: CR.pops.colors.clash, t: 0 });
    if (state.pops.length > CR.pops.max) state.pops.shift();
  }
  return true;
}

// --- السقوط على الأرض (القسم 5.4.7): يسقط على ظهره ثم ينهض بالركوع، لا يهاجم ولا يتفادى، ويمكن ضربه ---
export function knockDown(state, unit, fromX, fromY, tiles) {
  if (unit.invulnUntil > state.time) return false;   // تصلّب: لا يسقط
  if (unit.steadyUntil > state.time) return false;   // صيحة الحارة: لا يسقط
  cancelSwing(unit);
  unit.sight = null;
  unit.combo = false;
  unit.cState = 'down';
  unit.cTimer = CR.downTime;
  knockback(unit, fromX, fromY, tiles);
  state.combatEvents.down++;
  addPop(state, unit, 'سقط!', 'down');
  return true;
}

// --- نجمة انفجار في نقطة الارتطام: ثلثا المسافة نحو المصاب، وارتفاعها حسب الحركة ---
const FX_HEIGHT = { kick_high: 22, kick_front: 12 };
const FX_BIG = { heavy: true, kick_high: true, spin: true, kick_front: true };
// style وnode وbigA: أسلوب الضارب وعقدته وهل هو العضو الضخم، فيُرسم أثر الارتطام بلغة سلاحه (القسم 5.4.8)،
// وdx وdy اتجاه الضربة (لخط سرعة الطعنة وقوس الجرح)
// echo: إصابة ثانية فما بعد من نفس الضربة الدائرية (أثرها نجمة صغيرة بلا حلقة اهتزاز ثانية)
export function addBurst(state, attacker, target, move, echo = false) {
  if (attacker.lod === 'stat' && target.lod === 'stat') return;
  const dx = target.x - attacker.x, dy = target.y - attacker.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
  state.fx.push({ x: (target.x * 2 + attacker.x) / 3, y: (target.y * 2 + attacker.y) / 3, t: 0,
                  big: !!FX_BIG[move], h: FX_HEIGHT[move] || 16,
                  style: fightStyle(attacker), node: attacker.cNode || '', bigA: fightBig(attacker), life: FIGHT.quake.seconds,
                  dx: dx / d, dy: dy / d, echo });
}
