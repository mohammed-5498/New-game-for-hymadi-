// قدرات الشخصيات المميزة ومكافآت الأحياء المميزة
// (هالة الزعيم، علاج الطبيب، المستشفى، مخزن السلاح، نار الزجاجات)
import { TICK_SEC, SPECIAL_BONUS, MAP_GEN } from '../config.js';
import { isEnemy, applyDamage } from './combat.js';
import { ownsSpecial } from './spawn.js';
import { policeArmorBonus } from './police.js';
import { forEachNearby } from './spatialHash.js';
import { soundAt } from '../audio/sound.js';

const isAlive = (unit) => unit.state !== 'dead' && unit.hp > 0;
const allied = (state, a, b) => a.playerId === b.playerId || !isEnemy(state, a, b);

export function updateAbilities(state) {
  applyDamageBonuses(state);
  applyHealing(state);
  updateFires(state);
}

// --- مضاعف الضرر: مخزن السلاح + الهالات ---
// هالة الزعيم وهالة بطل العقارب لا تتجمعان: يؤخذ الأقوى فقط (القسم 6.6)
function applyDamageBonuses(state) {
  const armoryBonus = state.players.map(p =>
    ownsSpecial(state, p.id, 'armory') ? SPECIAL_BONUS.armory.damageBonus : 0);
  // +10% درع لكل مركز شرطة مملوك، بحد أقصى +20% (القسم 3.8)
  const armorBonus = state.players.map(p => policeArmorBonus(state, p.id));

  // نبدأ من مكافأة مخزن السلاح فقط
  for (const unit of state.units) {
    if (!isAlive(unit)) continue;
    unit.armorBonus = armorBonus[unit.playerId];
    unit.aura = false;
    unit.auraBonus = 0;
    unit.auraHeal = 0;
    unit.damageMultiplier = 1 + armoryBonus[unit.playerId];
  }

  // ثم نمر على أصحاب الهالات ونأخذ الأقوى لكل وحدة
  for (const boss of state.units) {
    if (!isAlive(boss) || !boss.stats.aura) continue;
    const aura = boss.stats.aura;

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

  for (const unit of state.units) {
    if (!isAlive(unit)) continue;
    if (unit.aura) unit.damageMultiplier += unit.auraBonus;
    // تحفيز الزعيم أو بطل العقارب: مكافأة مؤقتة تُجمع فوق الباقي
    if (unit.buffUntil > state.time) unit.damageMultiplier += unit.buffDamage;
  }
}

// --- العلاج: الطبيب + المستشفى ---
function applyHealing(state) {
  const hospitals = state.map.districts.filter(d => d.special === 'hospital' && d.owner !== null);

  for (const unit of state.units) {
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
  for (const unit of state.units) {
    if (isAlive(unit) && unit.auraHeal > 0) heal(unit, unit.auraHeal * TICK_SEC);
  }

  // الطبيب: يعالج أكثر حليف متضرر داخل مداه، ولا يعالج نفسه
  for (const medic of state.units) {
    if (!isAlive(medic) || !medic.stats.heal) continue;
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

  for (const fire of state.fires) {
    fire.life -= TICK_SEC;

    const radiusSq = fire.radius * fire.radius;
    forEachNearby(state, fire.x, fire.y, fire.radius, (unit) => {
      const dx = unit.x - fire.x, dy = unit.y - fire.y;
      if (dx * dx + dy * dy > radiusSq) return;
      if (!isAlive(unit)) return;
      if (!isEnemy(state, { playerId: fire.playerId }, unit)) return;   // العدو فقط
      // درع المطارق "ضد كل أنواع الضرر"، فيسري على النار أيضاً
      applyDamage(state, { playerId: fire.playerId }, unit, fire.damagePerSecond * TICK_SEC);
    });

    if (fire.life > 0) remaining.push(fire);
  }
  state.fires = remaining;
}
