// الضربات المميزة (القسم 6.7): الشحن، شرط الإطلاق، والتأثير الفعلي
// الأفراد العاديون لا يملكون ضربة مميزة، فلا شحن لهم.
import { TICK_SEC, COMBAT, ULT, CAMERA, ai, nations, STYLE_PERKS } from '../config.js';
import { isEnemy, applyDamage, spawnProjectile, spawnFalcon, spawnRain } from './combat.js';
import { stormDamageMul } from './features.js';
import { createFire } from './abilities.js';
import { faceTowards, createUnit } from './units.js';
import { forEachNearby } from './spatialHash.js';
import { registerSight, addUltFx, knockDown, addPop } from './realism.js';
import { findFreeTiles } from '../map/pathfinding.js';
import { soundAt } from '../audio/sound.js';
import { onScreen } from './alerts.js';
import { hypot } from './hypot.js';

const isAlive = (unit) => unit && unit.state !== 'dead' && unit.hp > 0;
const allied = (state, a, b) => a.playerId === b.playerId || !isEnemy(state, a, b);
const distanceSq = (a, b) => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const hasUlt = (unit) => !!unit.stats.ult;
export const ultReady = (unit) => hasUlt(unit) && unit.ultCharge >= ULT.max;
// --- الشحن ---
// البوت المجنون يشحن أسرع 25% (مزية إضافية معلنة، القسم 11.3)
function chargeFactor(state, unit) {
  const player = state.players[unit.playerId];
  if (!player || player.isHuman || player.neutral) return 1;
  const lvl = ai.levels[player.difficulty];
  return (lvl && lvl.chargeFactor) || 1;
}

// نغمة اكتمال الشحن تُسمع مرة واحدة عند امتلاء الشريط لا في كل تحديث، ولوحدات اللاعب وحده:
// شحن وحدات الخصوم لا يعنيه، وتكراره في المعركة الكبيرة رنين بلا معنى (المرحلة 5ب)
function announceReady(state, unit) {
  if (unit.ultCharge < ULT.max || unit.ultAnnounced) return;
  unit.ultAnnounced = true;
  if (unit.playerId === state.humanId) soundAt(state, 'ult_ready', unit.x, unit.y);
}

export function chargeOverTime(state, unit) {
  if (!hasUlt(unit) || unit.ultCharge >= ULT.max) return;
  const rate = unit.champion ? ULT.championPerSecond : ULT.perSecond;
  unit.ultCharge = Math.min(ULT.max, unit.ultCharge + rate * TICK_SEC * chargeFactor(state, unit));
  announceReady(state, unit);
}

// عن كل ضربة تُصيب
export function chargeOnHit(state, unit) {
  if (!unit || !unit.stats || !hasUlt(unit)) return;
  const amount = unit.champion ? ULT.championPerHit : ULT.perHit;
  unit.ultCharge = Math.min(ULT.max, unit.ultCharge + amount * chargeFactor(state, unit));
  announceReady(state, unit);
}

// عن كل 50 ضرراً تتلقاه
export function chargeOnDamageTaken(state, unit, taken) {
  if (!hasUlt(unit)) return;
  unit.damageTaken += taken;
  while (unit.damageTaken >= ULT.damageChunk) {
    unit.damageTaken -= ULT.damageChunk;
    unit.ultCharge = Math.min(ULT.max, unit.ultCharge + ULT.perDamageChunk * chargeFactor(state, unit));
  }
  announceReady(state, unit);
}

// --- الإطلاق التلقائي عند اكتمال الشحن وتحقق الشرط ---

// مدى التحقق من الشرط: مدى الضربة أو نصف قطرها، وإلا مدى رصد الوحدة
const ultRange = (unit, ult) => ult.range || ult.radius || unit.stats.visionRange;

// أقرب عدو داخل مدى الضربة
function nearestEnemy(state, unit, range) {
  let best = null, bestSq = range * range;
  forEachNearby(state, unit.x, unit.y, range, (other) => {
    if (other === unit) return;
    const d2 = distanceSq(unit, other);
    if (d2 >= bestSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    bestSq = d2;
    best = other;
  });
  return best;
}

// أكثر حليف متضرر داخل مدى الضربة (تشمل الوحدة نفسها)
function woundedAlly(state, unit, range) {
  let best = null, worst = 0;
  const rangeSq = range * range;
  forEachNearby(state, unit.x, unit.y, range, (other) => {
    const missing = other.maxHp - other.hp;
    if (missing <= worst) return;
    if (distanceSq(unit, other) > rangeSq) return;
    if (!isAlive(other) || !allied(state, unit, other)) return;
    worst = missing;
    best = other;
  });
  return best;
}

// أقرب شرطي داخل المدى (رشوة الشرطي، القسم 3.10): الشرطة لاعب محايد له وحداته
function nearestPolice(state, unit, range) {
  let best = null, bestSq = range * range;
  forEachNearby(state, unit.x, unit.y, range, (other) => {
    if (other.gang !== 'police') return;
    const d2 = distanceSq(unit, other);
    if (d2 >= bestSq || !isAlive(other)) return;
    bestSq = d2;
    best = other;
  });
  return best;
}

// شرط الضربة: عدو في المدى، أو حليف متضرر للعلاج، أو شرطي قريب
function ultTarget(state, unit, ult) {
  const range = ultRange(unit, ult);
  if (ult.needs === 'ally') return woundedAlly(state, unit, range);
  if (ult.needs === 'police') return nearestPolice(state, unit, range);
  if (ult.needs === 'either') return nearestEnemy(state, unit, range) || woundedAlly(state, unit, range);
  return nearestEnemy(state, unit, range);
}

// تبدأ حركة الضربة الآن، ويقع تأثيرها عند لحظة الارتطام (47%) مثل الضربة العادية
// نداء التعزيز لقائد الشرطة في الصمود: يُسجَّل من game/modes.js (يستدعي شرطة فوراً)
let summonHook = null;
export function setSummonHook(fn) { summonHook = fn; }

// بوابة الضربات الذكية للبوتات (القسم 11.2): تُسجَّل من ai/bot.js
let ultGate = null;
export function setUltGate(fn) { ultGate = fn; }

export function tryCastUlt(state, unit) {
  if (!ultReady(unit) || unit.pendingUlt || unit.attackCooldown > 0) return false;

  const ult = unit.stats.ult;
  const target = ultTarget(state, unit, ult);
  if (!target) return false;
  if (ultGate && !ultGate(state, unit, ult, target)) return false;   // تُمسك حتى يستحق الموقف

  const rate = ULT.castSeconds;
  unit.ultCharge = 0;
  unit.ultAnnounced = false;
  soundAt(state, 'ult_cast', unit.x, unit.y);
  unit.pendingHit = null;          // تلغي ضربة عادية كانت في منتصفها
  unit.attackStart = state.time;
  unit.attackRate = rate;
  unit.attackCooldown = rate;
  unit.ultStart = state.time;
  unit.ultRate = rate;
  unit.pendingUlt = { target, at: state.time + rate * COMBAT.hitMoment };
  // المشتبكة تتوقف لتضرب، أما المتقدمة في هجوم متحرك فتواصل طريقها
  if (unit.state === 'attacking') unit.path = [];
  if (target !== unit) faceTowards(unit, target.x, target.y);
  return true;
}

// --- لحظة تأثير الضربة ---
export function resolveUlt(state, unit) {
  const pending = unit.pendingUlt;
  unit.pendingUlt = null;
  if (!isAlive(unit)) return;

  shakeCamera(state, unit);

  const ult = unit.stats.ult;
  const target = isAlive(pending.target) ? pending.target : null;

  switch (ult.kind) {
    case 'harden':  harden(state, unit, ult.duration); break;
    case 'slam':    slam(state, unit, ult); break;
    case 'arc':     arc(state, unit, ult, pending.target); break;
    case 'pierce':  pierce(state, unit, ult, pending.target); break;
    case 'flurry':  startFlurry(state, unit, ult, target); break;
    case 'buff':    buffAllies(state, unit, ult); break;
    case 'heal':    healAllies(state, unit, ult); break;
    // طلقة القناص البعيدة: الضربة المميزة الوحيدة التي تُتفادى، وبنصف الاحتمال (القسم 5.4)
    case 'shot':    if (target) { spawnProjectile(state, unit, target, ultDamage(state, unit, ult.damage), 0, null, true);
                      registerSight(state, unit, target, true); } break;
    case 'fire':    createFire(state, unit.playerId, (target || unit).x, (target || unit).y, ult.fire); break;
    case 'arrows':  fireArrows(state, unit, ult, target); break;
    case 'bash':    bash(state, unit, ult, target); break;
    case 'summon':  if (summonHook) summonHook(state, unit, ult); break;
    // ضربات أبطال الأمم (القسم 3.10)
    case 'caravan': callCaravan(state, unit, ult); break;
    case 'falcon':  falconDive(state, unit, ult, target); break;
    case 'shout':   rallyShout(state, unit, ult); break;
    case 'whirl':                                                      // رقصة الشارع والروضة (بالركل)
    case 'roda':    startFlurry(state, unit, ult, null, ult.radius); break;
    case 'rain':    arrowRain(state, unit, ult, target); break;
    case 'throwdown':
    case 'knockout':
    case 'tango':   throwdown(state, unit, ult, target); break;      // رقصة الأباتشي والضربة القاضية وتانغو الموت
    case 'haste':   hasteAllies(state, unit, ult); break;
    case 'bribe':   bribePolice(state, unit, ult); break;
    case 'banner':  plantBanner(state, unit, ult); break;
  }
}

// ارتجاجة خفيفة عند لحظة تأثير الضربة، لضربة يراها اللاعب فقط،
// ومرة واحدة كل ثانية مهما تعددت الضربات حتى لا تصبح الشاشة مزعجة
function shakeCamera(state, unit) {
  if (state.time - state.shakeAt < CAMERA.shake.minGapSeconds) return;
  if (!onScreen(state, unit.x, unit.y)) return;
  state.shakeAt = state.time;
}

// ضرر الضربة يتأثر بمكافآت الضرر مثل الضربة العادية (مخزن السلاح، الهالات)
// والعاصفة الرملية تضعفها (القسم 3.11)
const ultDamage = (state, unit, amount) => amount * unit.damageMultiplier * stormDamageMul(state);

function harden(state, unit, duration) {
  unit.invulnUntil = state.time + duration;
}

// ضربة أرضية حول الوحدة، وقد يرافقها تصلّب (بطل المطارق)
function slam(state, unit, ult) {
  if (ult.harden) harden(state, unit, ult.harden);
  const radiusSq = ult.radius * ult.radius;

  forEachNearby(state, unit.x, unit.y, ult.radius, (other) => {
    if (distanceSq(unit, other) > radiusSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    applyDamage(state, unit, other, ultDamage(state, unit, ult.damage));
    if (ult.slow) {
      other.slowFactor = ult.slow;
      other.slowUntil = state.time + ult.slowDuration;
    }
  });
}

// قوس أمام الوحدة باتجاه هدفها (بطل الغربان)
function arc(state, unit, ult, target) {
  const dx = target ? target.x - unit.x : 1;
  const dy = target ? target.y - unit.y : 0;
  const length = hypot(dx, dy) || 1;
  const fx = dx / length, fy = dy / length;
  const radiusSq = ult.radius * ult.radius;

  forEachNearby(state, unit.x, unit.y, ult.radius, (other) => {
    if (distanceSq(unit, other) > radiusSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    // أمامه فقط: نصف الدائرة في اتجاه الهدف
    if ((other.x - unit.x) * fx + (other.y - unit.y) * fy < 0) return;
    applyDamage(state, unit, other, ultDamage(state, unit, ult.damage));
  });
}

// طعنة تخترق أول عدوين في خط الطعنة (حامل الرمح)
function pierce(state, unit, ult, target) {
  const dx = target ? target.x - unit.x : 1;
  const dy = target ? target.y - unit.y : 0;
  const length = hypot(dx, dy) || 1;
  const fx = dx / length, fy = dy / length;
  const reach = ult.range + COMBAT.pierceReachBonus;

  const online = [];
  forEachNearby(state, unit.x, unit.y, reach, (other) => {
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    const ox = other.x - unit.x, oy = other.y - unit.y;
    const along = ox * fx + oy * fy;                    // البعد على خط الطعنة
    if (along <= 0 || along > reach) return;
    const side = Math.abs(ox * -fy + oy * fx);          // البعد الجانبي عن الخط
    if (side > COMBAT.pierceWidth) return;
    online.push({ unit: other, along });
  });

  online.sort((a, b) => a.along - b.along);
  for (const hit of online.slice(0, ult.targets)) {
    applyDamage(state, unit, hit.unit, ultDamage(state, unit, ult.damage));
  }
}

// وابل: عدة ضربات متتالية على نفس الهدف خلال مدة قصيرة (المزدوج)
// radius: رقصة الشارع (زعيم الكابوكيمونو، القسم 3.10): كل ضربة على كل عدو حوله بدل هدف واحد
function startFlurry(state, unit, ult, target, radius = 0) {
  if (!target && !radius) return;
  unit.flurry = {
    target,
    left: ult.hits,
    damage: ult.damage,
    interval: ult.duration / ult.hits,
    next: state.time,
    radius
  };
}

export function updateFlurry(state, unit) {
  const flurry = unit.flurry;
  if (!flurry) return;
  if (flurry.radius) { updateWhirl(state, unit, flurry); return; }
  if (!isAlive(unit) || !isAlive(flurry.target)) { unit.flurry = null; return; }
  if (state.time < flurry.next) return;

  applyDamage(state, unit, flurry.target, ultDamage(state, unit, flurry.damage));
  flurry.left--;
  flurry.next = state.time + flurry.interval;
  if (flurry.left <= 0) unit.flurry = null;
}

// رقصة الشارع: ضربة على كل عدو داخل نصف القطر كل interval، وكل ضربة لفّة سريعة في الرسم.
// لا ضربة عادية قبل أن تنتهي الرقصة
function updateWhirl(state, unit, whirl) {
  if (!isAlive(unit)) { unit.flurry = null; return; }
  if (state.time < whirl.next) return;
  const radiusSq = whirl.radius * whirl.radius;
  forEachNearby(state, unit.x, unit.y, whirl.radius, (other) => {
    if (distanceSq(unit, other) > radiusSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    applyDamage(state, unit, other, ultDamage(state, unit, whirl.damage));
  });
  unit.attackStart = unit.ultStart = state.time;
  unit.attackRate = unit.ultRate = whirl.interval;
  if (unit.attackCooldown < whirl.interval) unit.attackCooldown = whirl.interval;
  whirl.left--;
  whirl.next = state.time + whirl.interval;
  if (whirl.left <= 0) unit.flurry = null;
}

// تحفيز الحلفاء (الزعيم وبطل العقارب)، وقد يرافقه علاج فوري
// ring: حلقة تتسع حوله بهذا اللون (راية الأخوة، القسم 3.10)
function buffAllies(state, unit, ult) {
  forEachAlly(state, unit, ult.radius, (ally) => {
    ally.buffUntil = state.time + ult.duration;
    ally.buffDamage = ult.damageBonus;
    ally.buffAttackSpeed = ult.attackSpeedBonus || 0;
    if (ult.heal) heal(ally, ult.heal);
  });
  if (ult.heal) soundAt(state, 'heal', unit.x, unit.y);
  if (ult.ring) addUltFx(state, 'ring', unit.x, unit.y, ult.radius, ult.ring);
}

// علاج جماعي دفعة واحدة (الطبيب)
function healAllies(state, unit, ult) {
  forEachAlly(state, unit, ult.radius, (ally) => heal(ally, ult.heal));
  soundAt(state, 'heal', unit.x, unit.y);
}

function forEachAlly(state, unit, radius, action) {
  const radiusSq = radius * radius;
  forEachNearby(state, unit.x, unit.y, radius, (other) => {
    if (distanceSq(unit, other) > radiusSq) return;
    if (!isAlive(other) || !allied(state, unit, other)) return;
    action(other);
  });
}

const heal = (unit, amount) => { unit.hp = Math.min(unit.maxHp, unit.hp + amount * STYLE_PERKS.soldierHeal); };

// صدّة بالدرع: ضرر ودفع العدو مربعاً للخلف مع إبطائه (الشرطي، القسم 3.8)
function bash(state, unit, ult, target) {
  if (!target) return;
  applyDamage(state, unit, target, ultDamage(state, unit, ult.damage));
  if (!isAlive(target)) return;

  target.slowFactor = ult.slow;
  target.slowUntil = state.time + ult.slowDuration;

  // الدفع لا يمر عبر المباني: نتوقف عند آخر مربع موصول في طريق الدفع
  const dx = target.x - unit.x, dy = target.y - unit.y;
  const length = hypot(dx, dy) || 1;
  const toX = target.x + (dx / length) * ult.push;
  const toY = target.y + (dy / length) * ult.push;
  if (!state.map.isConnected(Math.round(toX), Math.round(toY))) return;

  target.x = toX;
  target.y = toY;
  target.path = [];          // مساره القديم لم يعد يبدأ من مكانه
}

// ثلاثة سهام نارية: كل سهم يضر ويشعل بقعة صغيرة حيث يسقط (بطل الأفاعي)
function fireArrows(state, unit, ult, target) {
  if (!target) return;
  const targets = [target];
  const searchSq = COMBAT.multiShotSearch * COMBAT.multiShotSearch;
  forEachNearby(state, target.x, target.y, COMBAT.multiShotSearch, (other) => {
    if (targets.length >= ult.arrows || targets.includes(other)) return;
    if (distanceSq(other, target) > searchSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    targets.push(other);
  });

  for (let k = 0; k < ult.arrows; k++) {
    const offset = (k - (ult.arrows - 1) / 2) * COMBAT.multiShotSpread;
    spawnProjectile(state, unit, targets[k] || target, ultDamage(state, unit, ult.damage), offset, ult.fire, false);
  }
}

// --- ضربات أبطال الأمم (القسم 3.10، الأرقام في config.js تحت nations) ---

// نداء القوافل (ملكة سبأ): أفراد عاديون من أمتها يظهرون فوراً حولها، ضمن الحد الأقصى للوحدات
function callCaravan(state, unit, ult) {
  const player = state.players[unit.playerId];
  let alive = 0;
  for (const other of state.units) if (other.playerId === unit.playerId && other.state !== 'dead') alive++;
  const room = Math.min(ult.count, state.maxUnits - alive);
  const ci = Math.round(unit.x), cj = Math.round(unit.y);
  const spots = findFreeTiles(state.map, ci, cj, ult.count + 1, ult.spread);
  const around = spots.filter(([i, j]) => i !== ci || j !== cj);     // لا يظهر أحد فوقها إن وُجد غيره
  const pick = (around.length >= room ? around : spots).slice(0, Math.max(0, room));
  for (const [i, j] of pick) {
    state.units.push(createUnit(state, player, i, j));
    addUltFx(state, 'dust', i, j);
  }
  if (pick.length) soundAt(state, 'spawn', unit.x, unit.y);
  addUltFx(state, 'ring', unit.x, unit.y, ult.spread + 0.5);
}

// انقضاض الصقر (الصقّار): على أبعد عدو داخل المدى، ثم يعود إلى ساعده
function falconDive(state, unit, ult, fallback) {
  let target = null, farthest = -1;
  const rangeSq = ult.range * ult.range;
  forEachNearby(state, unit.x, unit.y, ult.range, (other) => {
    const d2 = distanceSq(unit, other);
    if (d2 > rangeSq || d2 <= farthest) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    farthest = d2;
    target = other;
  });
  if (!target) target = fallback;
  if (!target) return;
  const flight = Math.min(ult.flightMax, ult.flightMin + ult.flightPerTile * Math.sqrt(distanceSq(unit, target)));
  spawnFalcon(state, unit, target, ultDamage(state, unit, ult.damage), flight);
  unit.awayUntil = state.time + flight * 2;          // يغيب الصقر عن ساعده ذهاباً وإياباً
  faceTowards(unit, target.x, target.y);
}

// صيحة الحارة (كبير الفتوات): كل حليف حوله، ومعه الكبير، يصمد بلا ترنّح ولا سقوط،
// ومن كان يترنّح الآن يستعيد توازنه فوراً
function rallyShout(state, unit, ult) {
  const until = state.time + ult.duration;
  forEachAlly(state, unit, ult.radius, (ally) => {
    ally.steadyUntil = until;
    if (ally.cState === 'stagger') { ally.cState = null; ally.cTimer = 0; }
  });
  addUltFx(state, 'ring', unit.x, unit.y, ult.radius);
}

// مطر السهام (قائد الهوارانغ): على أكثف تجمع للأعداء داخل المدى، وحلقة تعلّم مكان الوابل
function arrowRain(state, unit, ult, fallback) {
  let spot = fallback, most = 0;
  const rangeSq = ult.range * ult.range;
  forEachNearby(state, unit.x, unit.y, ult.range, (other) => {
    if (distanceSq(unit, other) > rangeSq) return;
    if (!isAlive(other) || !isEnemy(state, unit, other)) return;
    const around = enemiesAround(state, unit, other, ult.area);
    if (around > most) { most = around; spot = other; }
  });
  if (!spot) return;
  spawnRain(state, unit, spot.x, spot.y, ult, ultDamage(state, unit, ult.damage));
  addUltFx(state, 'ring', spot.x, spot.y, ult.area, ult.ring);
  faceTowards(unit, spot.x, spot.y);
}

function enemiesAround(state, unit, spot, radius) {
  let count = 0;
  const radiusSq = radius * radius;
  forEachNearby(state, spot.x, spot.y, radius, (other) => {
    if (distanceSq(spot, other) > radiusSq) return;
    if (isAlive(other) && isEnemy(state, unit, other)) count++;
  });
  return count;
}

// رقصة الأباتشي (ملك الأباتشي): يقذف خصمه بعيداً ويسقطه أرضاً (ومن يصمد يتلقى الضرر وحده)
function throwdown(state, unit, ult, target) {
  if (!target) return;
  applyDamage(state, unit, target, ultDamage(state, unit, ult.damage));
  if (isAlive(target)) knockDown(state, target, unit.x, unit.y, ult.throw);
}

// رشوة الشرطي (زعيم الحي): هدنة مؤقتة بين الشرطة القريبة الآن ووحدات لاعبه، فيترك كلٌّ منهما الآخر
function bribePolice(state, unit, ult) {
  const until = state.time + ult.duration, radiusSq = ult.radius * ult.radius, bribed = [];
  forEachNearby(state, unit.x, unit.y, ult.radius, (other) => {
    if (other.gang !== 'police' || !isAlive(other) || distanceSq(unit, other) > radiusSq) return;
    other.bribedUntil = until;
    other.bribedBy = unit.playerId;
    if (other.target && other.target.playerId === unit.playerId) dropTarget(other);
    addPop(state, other, 'رُشي!', 'bribe');
    bribed.push(other);
  });
  // ووحداته تترك من كانت تقاتله منهم
  for (const own of state.units) {
    if (own.playerId === unit.playerId && own.target && bribed.includes(own.target)) dropTarget(own);
  }
  addUltFx(state, 'ring', unit.x, unit.y, ult.radius, nations.fx.bribeColor);
}

function dropTarget(unit) {
  unit.target = null;
  unit.commandedTarget = false;
  unit.pendingHit = null;
  if (unit.state === 'attacking') { unit.state = 'idle'; unit.path = []; }
}

// غرس الراية (حامل الراية): منطقة مكانه تبقى مدة (abilities.js يطبّق أثرها)، والراية تغيب عن يده حتى تزول
function plantBanner(state, unit, ult) {
  state.zones.push({ kind: 'banner', x: unit.x, y: unit.y, radius: ult.radius, until: state.time + ult.duration,
                     playerId: unit.playerId, color: unit.color });
  unit.awayUntil = state.time + ult.duration;
  addUltFx(state, 'ring', unit.x, unit.y, ult.radius);
}

// هجوم عدوة (الراس): كل حليف حوله، ومعه الراس، أسرع مدة محدودة
function hasteAllies(state, unit, ult) {
  const until = state.time + ult.duration;
  forEachAlly(state, unit, ult.radius, (ally) => {
    ally.hasteUntil = until;
    ally.hasteFactor = ult.bonus;
  });
  addUltFx(state, 'ring', unit.x, unit.y, ult.radius, ult.ring);
}
