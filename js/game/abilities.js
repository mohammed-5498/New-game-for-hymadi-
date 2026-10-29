// قدرات الشخصيات المميزة ومكافآت الأحياء المميزة
// (هالة الزعيم، علاج الطبيب، المستشفى، مخزن السلاح، نار الزجاجات)
import { TICK_SEC, SPECIAL_BONUS, MAP_GEN } from '../config.js';
import { isEnemy, applyDamage, isEnemyId } from './combat.js';
import { ownsSpecial } from './spawn.js';
import { policeArmorBonus } from './police.js';
import { forEachNearby } from './spatialHash.js';
import { soundAt } from '../audio/sound.js';
import { homeMods, inOwnArea, brotherMods, phalanxMods, outnumberedMods, duelMods } from './nations.js';
import { empireDamageBonus, empireArmorBonus } from './empire.js';
import { pyramidZones, pyramidTaken, stormDamageMul, featureDamageBonus, statueZones, inZone } from './features.js';
import { CITY_FEATURES } from '../config.js';

const isAlive = (unit) => unit.state !== 'dead' && unit.hp > 0;
const allied = (state, a, b) => a.playerId === b.playerId || !isEnemy(state, a, b);

export function updateAbilities(state) {
  updateZones(state);
  applyDamageBonuses(state);
  applyHealing(state);
  updateFires(state);
}

// --- مضاعف الضرر: مخزن السلاح + الهالات ---
// هالة الزعيم وهالة بطل العقارب لا تتجمعان: يؤخذ الأقوى فقط (القسم 6.6)
function applyDamageBonuses(state) {
  const armoryBonus = state.players.map(p =>
    ownsSpecial(state, p.id, 'armory') ? SPECIAL_BONUS.armory.damageBonus : 0);
  // +10% درع لكل مركز شرطة مملوك، بحد أقصى +20% (القسم 3.8)، وترقيتا الدفاع والضرر في طور الإمبراطورية
  const empire = state.economy;
  const armorBonus = state.players.map(p => policeArmorBonus(state, p.id) + (empire ? empireArmorBonus(state, p.id) : 0));
  // ومالك دوجو الساموراي: كل جنوده أقوى (القسم 3.11)
  const upDamage = state.players.map(p => (empire ? empireDamageBonus(state, p.id) + featureDamageBonus(state, p.id) : 0));
  // سمات الأمم "داخل أحيائك" (القسم 3.10): null لكل لاعب بلا سمة من هذا النوع
  const home = state.players.map(homeMods);
  // «الـ108» (الصين) و«الكتيبة» (ألمانيا): null لكل لاعب بلا هذه السمة
  const brothers = state.players.map(brotherMods);
  const phalanx = state.players.map(phalanxMods);
  const outnumbered = state.players.map(outnumberedMods);
  const duel = state.players.map(duelMods);
  // الهرم (القسم 3.11): جنود مالكه حوله يتلقون ضرراً أقل، وتمثال ريو: أقوى وأسرع ضرباً (null بلا مبنى مملوك)
  const pyramids = pyramidZones(state);
  const statues = statueZones(state);

  // نبدأ من الصفر (المضاعف النهائي يُحسب في الحلقة الأخيرة بنفس ترتيب الجمع)
  // كتابة العدد العشري في خاصية الوحدة تحجز ذاكرة: لا نكتب إلا ما تغيّر فعلاً
  for (let k = 0, units = state.units; k < units.length; k++) {
    const unit = units[k];
    if (!isAlive(unit)) continue;
    const armor = armorBonus[unit.playerId];
    if (unit.armorBonus !== armor) unit.armorBonus = armor;
    unit.aura = false;
    if (unit.auraBonus !== 0) unit.auraBonus = 0;
    if (unit.auraHeal !== 0) unit.auraHeal = 0;
    if (unit.brothers !== 0) unit.brothers = 0;
  }

  // ثم نمر على أصحاب الهالات ونأخذ الأقوى لكل وحدة
  // (الحلقة تستدعي دالة منفصلة: دالة الجيران داخل الحلقة نفسها كانت تحجز ذاكرة لكل وحدة)
  for (let k = 0, units = state.units; k < units.length; k++) {
    const boss = units[k];
    if (!isAlive(boss) || !boss.stats.aura) continue;
    spreadAura(state, boss, boss.stats.aura);
  }

  // «الـ108»: كل شخصية مميزة حية تُحسب لكل فرد عادي من لاعبها حولها
  for (let k = 0, units = state.units; k < units.length; k++) {
    const hero = units[k];
    if (!hero.hero || !isAlive(hero)) continue;
    const mods = brothers[hero.playerId];
    if (mods) countBrothers(state, hero, mods.radius);
  }

  for (let k = 0, units = state.units; k < units.length; k++) {
    const unit = units[k];
    if (!isAlive(unit)) continue;
    let multiplier = 1 + armoryBonus[unit.playerId] + upDamage[unit.playerId];
    if (unit.aura) multiplier += unit.auraBonus;
    // تحفيز الزعيم أو بطل العقارب: مكافأة مؤقتة تُجمع فوق الباقي
    if (unit.buffUntil > state.time) multiplier += unit.buffDamage;
    // سمة الأمة داخل أحيائها: ضرر أكبر، أو ضرر متلقى أقل
    let taken = 1;
    const mods = home[unit.playerId];
    if (mods) {
      const inside = inOwnArea(state.map, unit);
      if (inside && mods.homeDamage) multiplier += mods.homeDamage;
      if (inside && mods.homeDamageTaken) taken = 1 - mods.homeDamageTaken;
    }
    if (unit.brothers) {
      const b = brothers[unit.playerId];
      multiplier += Math.min(b.max, unit.brothers * b.perHero);
    }
    // «روح عدوة»: ضرر أكبر للوحدة التي يفوقها الأعداء عدداً حولها
    const out = outnumbered[unit.playerId];
    if (out && enemiesOutnumber(state, unit, out.radius)) multiplier += out.bonus;
    // «مبارزة الفاكون»: ضرر أكبر في المواجهة الفردية (لا عدو حولها غير خصم واحد)
    const du = duel[unit.playerId];
    if (du && oneOnOne(state, unit, du.radius)) multiplier += du.bonus;
    // «الكتيبة»: ضرر متلقى أقل للوحدة داخل مجموعة كبيرة من وحدات لاعبها
    const ph = phalanx[unit.playerId];
    if (ph && inGroup(state, unit, ph)) taken = 1 - ph.reduce;
    if (pyramids) taken *= pyramidTaken(pyramids, unit);
    if (unit.takenMul !== taken) unit.takenMul = taken;
    let speed = 0;
    if (statues && inZone(statues, unit)) {
      multiplier += CITY_FEATURES.statue.damage;
      speed = CITY_FEATURES.statue.attackSpeed;
    }
    if (unit.auraSpeed !== speed) unit.auraSpeed = speed;
    if (unit.damageMultiplier !== multiplier) unit.damageMultiplier = multiplier;
  }
}

function spreadAura(state, boss, aura) {
  const radiusSq = aura.radius * aura.radius;
  forEachNearby(state, boss.x, boss.y, aura.radius, (unit) => {
    const dx = unit.x - boss.x, dy = unit.y - boss.y;
    if (dx * dx + dy * dy > radiusSq) return;
    if (!isAlive(unit) || !allied(state, unit, boss)) return;
    unit.aura = true;
    if (aura.damageBonus > unit.auraBonus) unit.auraBonus = aura.damageBonus;
    // هالة بطل العقارب تعالج الحلفاء أيضاً، وتؤخذ الأقوى كذلك
    const healing = aura.healPerSecond || 0;
    if (healing > unit.auraHeal) unit.auraHeal = healing;
  });
}

// هل حول الوحدة (ومعها نفسها) count من وحدات لاعبها الحية داخل نصف القطر؟
function inGroup(state, unit, ph) {
  const radiusSq = ph.radius * ph.radius;
  let count = 0;
  forEachNearby(state, unit.x, unit.y, ph.radius, (other) => {
    if (other.playerId !== unit.playerId || !isAlive(other)) return;
    const dx = other.x - unit.x, dy = other.y - unit.y;
    if (dx * dx + dy * dy <= radiusSq) count++;
  });
  return count >= ph.count;
}

// هل الأعداء حول الوحدة أكثر من وحدات لاعبها وحلفائه (ومعهم هي نفسها)؟
function enemiesOutnumber(state, unit, radius) {
  const radiusSq = radius * radius;
  let foes = 0, friends = 0;
  forEachNearby(state, unit.x, unit.y, radius, (other) => {
    if (!isAlive(other)) return;
    const dx = other.x - unit.x, dy = other.y - unit.y;
    if (dx * dx + dy * dy > radiusSq) return;
    if (allied(state, unit, other)) friends++; else foes++;
  });
  return foes > friends;
}

// هل حول الوحدة عدو واحد على الأكثر؟ (والمواجهة نفسها لا تحتاج أكثر من خصمها)
function oneOnOne(state, unit, radius) {
  const radiusSq = radius * radius;
  let foes = 0;
  forEachNearby(state, unit.x, unit.y, radius, (other) => {
    if (foes > 1 || !isAlive(other) || allied(state, unit, other)) return;
    const dx = other.x - unit.x, dy = other.y - unit.y;
    if (dx * dx + dy * dy <= radiusSq) foes++;
  });
  return foes <= 1;
}

// --- مناطق ضربات الأبطال (القسم 3.10): الراية المغروسة ---
// كل حليف داخلها يصمد (لا ترنّح ولا سقوط) ولا يُدفع ما دامت قائمة، والمنطقة تزول عند انتهاء مدتها
function updateZones(state) {
  if (!state.zones.length) return;
  state.zones = state.zones.filter(zone => zone.until > state.time);
  for (const zone of state.zones) {
    const radiusSq = zone.radius * zone.radius, hold = state.time + 2 * TICK_SEC;
    forEachNearby(state, zone.x, zone.y, zone.radius, (unit) => {
      const dx = unit.x - zone.x, dy = unit.y - zone.y;
      if (dx * dx + dy * dy > radiusSq || !isAlive(unit)) return;
      if (unit.playerId !== zone.playerId && isEnemyId(state, unit.playerId, zone.playerId)) return;
      if (unit.steadyUntil < hold) unit.steadyUntil = hold;
      if (unit.holdUntil < hold) unit.holdUntil = hold;
      if (unit.cState === 'stagger') { unit.cState = null; unit.cTimer = 0; }
    });
  }
}

// الأفراد العاديون من لاعب الشخصية المميزة داخل نصف القطر (لا الشخصيات ولا البطل)
function countBrothers(state, hero, radius) {
  const radiusSq = radius * radius;
  forEachNearby(state, hero.x, hero.y, radius, (unit) => {
    if (unit.playerId !== hero.playerId || unit.hero || unit.champion) return;
    const dx = unit.x - hero.x, dy = unit.y - hero.y;
    if (dx * dx + dy * dy > radiusSq || !isAlive(unit)) return;
    unit.brothers++;
  });
}

// --- العلاج: الطبيب + المستشفى ---
function applyHealing(state) {
  const hospitals = state.map.districts.filter(d => d.special === 'hospital' && d.owner !== null);

  for (let k = 0, units = state.units; k < units.length; k++) {
    const unit = units[k];
    if (!isAlive(unit)) continue;

    // المستشفى: 0.5 دم/ث لكل وحداته في أي مكان، و5 دم/ث داخل منطقة استيلائه
    for (const hospital of hospitals) {
      if (hospital.owner !== unit.playerId) continue;
      heal(unit, SPECIAL_BONUS.hospital.globalHealPerSecond * TICK_SEC);
      const dx = unit.x - hospital.capture.i, dy = unit.y - hospital.capture.j;
      const inside = dx * dx + dy * dy <= MAP_GEN.captureRadius * MAP_GEN.captureRadius;
      if (inside) heal(unit, SPECIAL_BONUS.hospital.zoneHealPerSecond * TICK_SEC);
    }
  }

  // هالة بطل العقارب: تعالج كل حليف داخلها (الطبيب أسرع لكنه يعالج هدفاً واحداً)
  for (let k = 0, units = state.units; k < units.length; k++) {
    const unit = units[k];
    if (isAlive(unit) && unit.auraHeal > 0) heal(unit, unit.auraHeal * TICK_SEC);
  }

  // الطبيب: يعالج أكثر حليف متضرر داخل مداه، ولا يعالج نفسه
  for (let k = 0, units = state.units; k < units.length; k++) {
    const medic = units[k];
    if (!isAlive(medic) || !medic.stats.heal) continue;
    medicHeal(state, medic);
  }
}

function medicHeal(state, medic) {
  const { radius, perSecond } = medic.stats.heal;

  let patient = null, worst = 0;
  const radiusSq = radius * radius;
  forEachNearby(state, medic.x, medic.y, radius, (other) => {
    if (other === medic) return;
    const missing = other.maxHp - other.hp;
    if (missing <= worst) return;
    const dx = medic.x - other.x, dy = medic.y - other.y;
    if (dx * dx + dy * dy > radiusSq) return;
    if (!isAlive(other) || !allied(state, medic, other)) return;
    worst = missing;
    patient = other;
  });
  if (patient) {
    heal(patient, perSecond * TICK_SEC);
    medic.healingTarget = patient;
  } else {
    medic.healingTarget = null;
  }
}

function heal(unit, amount) {
  unit.hp = Math.min(unit.maxHp, unit.hp + amount);
}

// --- النار على الأرض: زجاجة رامي النار أو سهم بطل الأفاعي المشتعل ---
export function createFire(state, playerId, i, j, fire) {
  soundAt(state, 'fire', i, j);
  state.fires.push({
    playerId,
    x: i, y: j,
    radius: fire.radius,
    damagePerSecond: fire.damagePerSecond,
    life: fire.duration,
    maxLife: fire.duration
  });
}

function updateFires(state) {
  if (!state.fires.length) return;
  const remaining = [];
  const weak = stormDamageMul(state);     // العاصفة الرملية تضعف النار (القسم 3.11)

  for (const fire of state.fires) {
    fire.life -= TICK_SEC;

    const radiusSq = fire.radius * fire.radius;
    forEachNearby(state, fire.x, fire.y, fire.radius, (unit) => {
      const dx = unit.x - fire.x, dy = unit.y - fire.y;
      if (dx * dx + dy * dy > radiusSq) return;
      if (!isAlive(unit)) return;
      if (!isEnemyId(state, fire.playerId, unit.playerId)) return;   // العدو فقط
      // درع المطارق "ضد كل أنواع الضرر"، فيسري على النار أيضاً
      applyDamage(state, { playerId: fire.playerId }, unit, fire.damagePerSecond * TICK_SEC * weak);
    });

    if (fire.life > 0) remaining.push(fire);
  }
  state.fires = remaining;
}
