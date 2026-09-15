// الاستيلاء على الأحياء: مناطق الاستيلاء، التقدم، تغيّر الملكية
import { TICK_SEC, CAPTURE, MAP_GEN } from '../config.js';
import { isEnemy } from './combat.js';

// منطقة الاستيلاء: دائرة نصف قطرها 1.5 مربع حول نقطة الاستيلاء
// (تشمل مربعات الشارع المجاورة، وقد تتداخل منطقتان فيُحسب المربع للاثنتين)
export function buildCaptureZones(state) {
  const map = state.map;
  const radius = MAP_GEN.captureRadius;
  map.zoneAt = new Map();

  for (const district of map.districts) {
    if (!district.capture) continue;
    district.zone = [];
    const { i: ci, j: cj } = district.capture;
    const span = Math.ceil(radius);

    for (let j = cj - span; j <= cj + span; j++) {
      for (let i = ci - span; i <= ci + span; i++) {
        if (!map.inBounds(i, j)) continue;
        if (Math.hypot(i - ci, j - cj) > radius) continue;
        const key = map.idx(i, j);
        district.zone.push(key);
        if (!map.zoneAt.has(key)) map.zoneAt.set(key, []);
        map.zoneAt.get(key).push(district.id);
      }
    }
  }
}

// مفتاح الجانب: أعضاء الفريق الواحد جانب واحد، ومن بلا فريق جانب بنفسه
const sideKey = (state, playerId) => {
  const team = state.players[playerId].team;
  return team ? 'team' + team : 'player' + playerId;
};

const allied = (state, a, b) => a === b || !isEnemy(state,
  { playerId: a }, { playerId: b });

export function updateCapture(state) {
  const map = state.map;

  // نجمع قوى الاستيلاء داخل كل منطقة بمرور واحد على الوحدات
  const zones = new Map();   // districtId -> Map(sideKey -> {power, playerId})
  for (const unit of state.units) {
    if (unit.state === 'dead') continue;
    const key = map.idx(Math.round(unit.x), Math.round(unit.y));
    const districtIds = map.zoneAt.get(key);
    if (!districtIds) continue;

    for (const id of districtIds) {
      if (!zones.has(id)) zones.set(id, new Map());
      const sides = zones.get(id);
      const side = sideKey(state, unit.playerId);
      const entry = sides.get(side) || { power: 0, playerId: unit.playerId };
      entry.power += unit.stats.capturePower;
      sides.set(side, entry);
    }
  }

  for (const district of map.districts) {
    if (!district.capture) continue;
    const sides = zones.get(district.id);
    district.contested = false;

    if (!sides || sides.size === 0) {
      decayProgress(state, district);
      continue;
    }
    // وحدات من جانبين غير متحالفين: يتجمد التقدم
    if (sides.size > 1) { district.contested = true; continue; }

    const [{ power, playerId }] = [...sides.values()];
    advanceProgress(state, district, playerId, Math.min(power, CAPTURE.maxCapturePower));
  }
}

function advanceProgress(state, district, playerId, power) {
  const step = CAPTURE.pointsPerSecond * power * TICK_SEC;

  // حي محايد بلا تقدم: يبدأ التقدم لصالح الواقف فيه
  if (district.progressOwner === null) district.progressOwner = playerId;

  if (allied(state, playerId, district.progressOwner)) {
    // يملأ لصالحه (أو يعيد ملء حي حليف تعرض لهجوم)
    district.progress = Math.min(100, district.progress + step);
    if (district.progress >= 100 && district.owner !== district.progressOwner) {
      const ownerBefore = district.owner;
      district.owner = district.progressOwner;
      // الحلفاء لا يستولون على أحياء بعضهم: الملكية تبقى لصاحبها
      if (ownerBefore !== null && allied(state, ownerBefore, district.owner)) {
        district.owner = ownerBefore;
        district.progressOwner = ownerBefore;
      } else {
        announceCapture(state, district);
      }
    }
  } else {
    // عدو: يُنزل التقدم أولاً إلى 0 فيصبح الحي محايداً
    district.progress = Math.max(0, district.progress - step);
    if (district.progress <= 0) {
      district.owner = null;
      district.progressOwner = playerId;
    }
  }
}

// خلو المنطقة: يرجع التقدم تدريجياً لحالة المالك
function decayProgress(state, district) {
  const step = CAPTURE.decayPerSecond * TICK_SEC;

  if (district.owner !== null) {
    district.progressOwner = district.owner;
    district.progress = Math.min(100, district.progress + step);
  } else if (district.progress > 0) {
    district.progress = Math.max(0, district.progress - step);
    if (district.progress <= 0) district.progressOwner = null;
  }
}

function announceCapture(state, district) {
  const player = state.players[district.owner];
  const mine = district.owner === state.humanId;
  const name = district.special ? specialName(district.special) : 'حي';
  state.notice = {
    text: mine ? 'استوليت على ' + name : player.name + ' استولى على ' + name,
    mine,
    t: CAPTURE.noticeSeconds
  };
}

function specialName(special) {
  return special === 'hospital' ? 'المستشفى'
       : special === 'armory' ? 'مخزن السلاح'
       : 'برج الساعة';
}

export function updateNotice(state) {
  if (!state.notice) return;
  state.notice.t -= TICK_SEC;
  if (state.notice.t <= 0) state.notice = null;
}


// --- تلوين الحي بلون مالكه (القسم 8) ---
// الانتقال اللوني يتم خلال نصف ثانية لا دفعة واحدة: أرض الحي ومبانيه معاً
export function updateDistrictTints(state) {
  const step = TICK_SEC / CAPTURE.tintSeconds;

  for (const district of state.map.districts) {
    const target = district.owner !== null ? state.players[district.owner].color : null;

    if (target) {
      if (district.tintColor !== target) { district.tintColor = target; district.tintMix = 0; }
      district.tintMix = Math.min(1, district.tintMix + step);
    } else if (district.tintColor) {
      // خسر الحي: ترجع الألوان تدريجياً إلى الحياد
      district.tintMix = Math.max(0, district.tintMix - step);
      if (district.tintMix <= 0) district.tintColor = null;
    }
  }
}

// الأحياء المنزلية تبدأ ملوّنة بلا انتقال
export function snapDistrictTints(state) {
  for (const district of state.map.districts) {
    if (district.owner === null) continue;
    district.tintColor = state.players[district.owner].color;
    district.tintMix = 1;
  }
}

// نسبة الصبغ الحالية، مدرّجة حتى لا نولّد لوناً مخلوطاً جديداً في كل إطار
export function tintAmount(district, alpha) {
  if (!district || !district.tintColor) return 0;
  const steps = CAPTURE.tintSteps;
  return alpha * Math.round(district.tintMix * steps) / steps;
}
