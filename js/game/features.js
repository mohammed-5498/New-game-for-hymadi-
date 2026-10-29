// مزايا المدن (القسم 3.11، بطلب المستخدم): ميزة واحدة لكل مدينة أمة، في كل مباراة على الاقتصاد
// - العاصفة الرملية (الدرعية): حدث يتكرر بزمن المباراة وحده (لا حالة تُحفظ)، يقصّر مدى الرماة والأبراج
//   ويجعل الضربات والسهام تخطئ أحياناً، والنار وضربات الأبطال أضعف
// - القرى المحايدة (شبام): أفراد طرف محايد مسالم (passive: لا يهاجم ولا يُهاجَم ولا يجمّد الاستيلاء)
//   ينضمون لمن يستولي على قريتهم
// - الهرم (القاهرة): دخل أكبر لحيه، وجنود مالكه حوله يتلقون ضرراً أقل
// الحي يحمل ميزته (district.feature، من مولّد الخريطة)، والمباراة ميزة مدينتها (state.feature).
// الأرقام كلها في CITY_FEATURES داخل config.js
import { TICK_SEC, CITY_FEATURES as F, nations } from '../config.js';
import { createUnit } from './units.js';
import { applyUpgrades, tileOf } from './empire.js';
import { findFreeTiles } from '../map/pathfinding.js';
import { sound } from '../audio/sound.js';
import { random } from './random.js';   // عشوائية المنطق: مشتركة بين الأجهزة في اللعب المحلي

const isAlive = (unit) => unit.state !== 'dead' && unit.hp > 0;

export const cityFeature = (city) => F.cities[city] || null;

// الطرف المحايد الذي تحتاجه الميزة (يُضاف بعد الشرطة): أهل القرى في شبام، وnull لغيرها
export function createFeaturePlayer(players, feature) {
  if (feature !== 'villages') return null;
  const V = F.villages;
  return {
    id: players.length,
    name: V.name,
    gang: nations[V.nation].style,     // أفراد أمة القرية العاديون بقواعد نمطها
    nation: V.nation,
    gangName: V.name,
    color: V.color,
    isHuman: false,
    neutral: true,           // خارج حساب الفوز والخسارة والبوتات كالشرطة
    passive: true,           // لا يهاجم ولا يُهاجَم ولا يُحسب جانباً في الاستيلاء (combat.js وcapture.js)
    team: 0,
    difficulty: 'medium',
    homeDistrictId: -1
  };
}

const villagePlayer = (state) => state.players.find(p => p.passive) || null;

// --- البداية: أهل كل قرية عند ساحة علمها ---
export function initFeatures(state) {
  if (state.feature !== 'villages') return;
  const player = villagePlayer(state);
  if (!player) return;
  const [low, high] = F.villages.people;
  for (const d of state.map.districts) {
    if (d.feature !== 'village' || !d.capture) continue;
    const count = low + Math.floor(random() * (high - low + 1));
    for (const [i, j] of findFreeTiles(state.map, d.capture.i, d.capture.j, count)) {
      const unit = createUnit(state, player, i, j);
      unit.villageId = d.id;
      state.units.push(unit);
    }
  }
}

// --- كل تحديث ---
export function updateFeatures(state) {
  if (!state.feature) return;
  // ميزة المدينة مرة واحدة في البداية، بعد سمة الأمة وتلميح قائمة الحي (إشعار لهذا الجهاز وحده)
  if (!state.featureHinted && state.empireHinted && !state.notice) {
    state.featureHinted = true;
    state.notice = { text: 'ميزة المدينة — ' + F.desc[state.feature], mine: true, t: F.hintSeconds };
  }
  if (state.feature === 'storm') stormNotices(state);
  else if (state.feature === 'villages') joinVillagers(state);
}

// ================= العاصفة الرملية (الدرعية) =================
// العاصفة رقم n تبدأ عند first + n × every وتدوم duration. يعيد { on, left } (left: ما بقي منها أو حتى التالية)
export function stormAt(time) {
  const S = F.storm;
  const n = Math.floor((time - S.first) / S.every);
  const start = S.first + n * S.every;
  if (n >= 0 && time - start < S.duration) return { on: true, left: start + S.duration - time, since: time - start };
  return { on: false, left: (n < 0 ? S.first : start + S.every) - time, since: 0 };
}

export const stormActive = (state) => state.feature === 'storm' && stormAt(state.time).on;

// مدى الرماة والأبراج الآن (1 بلا عاصفة)
export const stormRangeMul = (state) => stormActive(state) ? F.storm.rangeMul : 1;

// ضرر النار وضربات الأبطال الآن (1 بلا عاصفة): أضعف بقدر احتمال الخطأ
export const stormDamageMul = (state) => stormActive(state) ? 1 - F.storm.miss : 1;

// هل تخطئ هذه الضربة أو هذا السهم؟ (لا رقم عشوائي يُسحب بلا عاصفة)
export const stormMiss = (state) => stormActive(state) && random() < F.storm.miss;

// التنبيه قبلها، وبدايتها ونهايتها: بمقارنة هذا التحديث بالذي قبله
function stormNotices(state) {
  const S = F.storm, now = stormAt(state.time), before = stormAt(state.time - TICK_SEC);
  if (now.on && !before.on) {
    state.notice = { text: 'عاصفة رملية! مدى الرماة أقل، والضربات تخطئ', mine: false, t: 4 };
  } else if (!now.on && before.on) {
    state.notice = { text: 'انتهت العاصفة الرملية', mine: false, t: 3 };
  } else if (!now.on && now.left <= S.warn && before.left > S.warn) {
    state.notice = { text: 'عاصفة رملية بعد ' + S.warn + ' ثوانٍ!', mine: false, t: 3 };
    sound('alert');
  }
}

// سطر شريط الطور: العاصفة الجارية، أو القادمة حين تقترب (null بعيداً عنها)
export function featureBar(state) {
  if (state.feature !== 'storm') return null;
  const now = stormAt(state.time), s = Math.max(0, Math.ceil(now.left));
  const clock = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  if (now.on) return { text: 'عاصفة رملية ' + clock, alarm: true };
  return now.left <= F.storm.duration ? { text: 'عاصفة بعد ' + clock, alarm: now.left <= F.storm.warn } : null;
}

// ================= القرى المحايدة (شبام) =================
// من يستولي على قرية ينضم إليه أهلها الأحياء بلونه (مرة واحدة: بعدها حي عادي)
function joinVillagers(state) {
  for (const d of state.map.districts) {
    if (d.feature !== 'village' || d.villageJoined || d.owner === null || state.players[d.owner].neutral) continue;
    d.villageJoined = true;
    const owner = state.players[d.owner];
    let joined = 0;
    for (const unit of state.units) {
      if (unit.villageId !== d.id || !isAlive(unit)) continue;
      unit.villageId = -1;
      unit.playerId = owner.id;
      unit.color = owner.color;
      applyUpgrades(state, unit);       // ترقية الدم لعصابته الجديدة
      joined++;
    }
    if (joined && owner.id === state.humanId) {
      state.notice = { text: 'انضم إليك ' + joined + ' من ' + F.villages.name, mine: true, t: 3 };
      sound('spawn');
    }
  }
}

// قرية لم ينضم أهلها بعد (قيمتها عند البوتات، وشارتها فوق علمها)
export const villageWaiting = (d) => d.feature === 'village' && !d.villageJoined;

// قيمة حي الميزة عند البوتات (squads.js)، وnull لغيره (والقرية بعد انضمام أهلها حي عادي)
export function featureValue(d) {
  if (!d.feature || (d.feature === 'village' && d.villageJoined)) return null;
  return F.botValue[d.feature] || null;
}

// ================= الهرم (القاهرة) =================
// دخل الحي في الثانية: الهرم بدل نقطة الحي العادي، وnull لغير حي الهرم
export const featureIncome = (d) => d.feature === 'pyramid' ? F.pyramid.income : null;

// الأهرام المملوكة الآن: { owner, x, y, r2 } لحساب الضرر المتلقى حولها (abilities.js)
export function pyramidZones(state) {
  if (state.feature !== 'pyramid') return null;
  let zones = null;
  for (const d of state.map.districts) {
    if (d.feature !== 'pyramid' || d.owner === null || d.featureTile === undefined || state.players[d.owner].neutral) continue;
    const at = tileOf(state.map, d.featureTile);
    (zones || (zones = [])).push({ owner: d.owner, x: at.i, y: at.j, r2: F.pyramid.radius * F.pyramid.radius });
  }
  return zones;
}

// مضاعف الضرر المتلقى للوحدة من الأهرام (1 خارجها)
export function pyramidTaken(zones, unit) {
  for (const z of zones) {
    if (z.owner !== unit.playerId) continue;
    const dx = unit.x - z.x, dy = unit.y - z.y;
    if (dx * dx + dy * dy <= z.r2) return 1 - F.pyramid.damageTaken;
  }
  return 1;
}
