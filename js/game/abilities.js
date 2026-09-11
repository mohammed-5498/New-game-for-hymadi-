// قدرات الشخصيات المميزة ومكافآت الأحياء المميزة
// (هالة الزعيم، علاج الطبيب، المستشفى، مخزن السلاح، نار الزجاجات)
import { TICK_SEC, SPECIAL_BONUS, MAP_GEN } from '../config.js';
import { isEnemy, applyDamage } from './combat.js';
import { ownsSpecial } from './spawn.js';

const isAlive = (unit) => unit.state !== 'dead' && unit.hp > 0;
const allied = (state, a, b) => a.playerId === b.playerId || !isEnemy(state, a, b);

export function updateAbilities(state) {
  applyDamageBonuses(state);
  applyHealing(state);
  updateFires(state);
}

// --- مضاعف الضرر: مخزن السلاح + هالة الزعيم (الهالتان لا تتجمعان) ---
function applyDamageBonuses(state) {
  const armoryBonus = state.players.map(p =>
    ownsSpecial(state, p.id, 'armory') ? SPECIAL_BONUS.armory.damageBonus : 0);

  const bosses = state.units.filter(u => isAlive(u) && u.stats.aura);

  for (const unit of state.units) {
    if (!isAlive(unit)) continue;
    let auraBonus = 0;

    for (const boss of bosses) {
      if (!allied(state, unit, boss)) continue;
      const aura = boss.stats.aura;
      if (Math.hypot(unit.x - boss.x, unit.y - boss.y) > aura.radius) continue;
      auraBonus = Math.max(auraBonus, aura.damageBonus);   // لا تتجمع هالتان
    }

    unit.aura = auraBonus > 0;
    unit.damageMultiplier = 1 + armoryBonus[unit.playerId] + auraBonus;
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
      const inside = Math.hypot(unit.x - hospital.capture.i, unit.y - hospital.capture.j) <= MAP_GEN.captureRadius;
      if (inside) heal(unit, SPECIAL_BONUS.hospital.zoneHealPerSecond * TICK_SEC);
    }
  }

  // الطبيب: يعالج أكثر حليف متضرر داخل مداه، ولا يعالج نفسه
  for (const medic of state.units) {
    if (!isAlive(medic) || !medic.stats.heal) continue;
    const { radius, perSecond } = medic.stats.heal;

    let patient = null, worst = 0;
    for (const other of state.units) {
      if (other === medic || !isAlive(other)) continue;
      if (!allied(state, medic, other)) continue;
      const missing = other.maxHp - other.hp;
      if (missing <= worst) continue;
      if (Math.hypot(medic.x - other.x, medic.y - other.y) > radius) continue;
      worst = missing;
      patient = other;
    }
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

// --- النار على الأرض من زجاجات رامي النار ---
export function createFire(state, thrower, i, j) {
  const fire = thrower.stats.fire;
  state.fires.push({
    playerId: thrower.playerId,
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

    for (const unit of state.units) {
      if (!isAlive(unit)) continue;
      if (!isEnemy(state, { playerId: fire.playerId }, unit)) continue;   // العدو فقط
      if (Math.hypot(unit.x - fire.x, unit.y - fire.y) > fire.radius) continue;
      // درع المطارق "ضد كل أنواع الضرر"، فيسري على النار أيضاً
      applyDamage(state, { playerId: fire.playerId }, unit, fire.damagePerSecond * TICK_SEC);
    }

    if (fire.life > 0) remaining.push(fire);
  }
  state.fires = remaining;
}
