// مزايا المدن (القسم 3.11، بطلب المستخدم): ميزة واحدة لكل مدينة أمة، في كل مباراة على الاقتصاد
// - العاصفة الرملية (الدرعية): حدث يتكرر بزمن المباراة وحده (لا حالة تُحفظ)، يقصّر مدى الرماة والأبراج
//   ويجعل الضربات والسهام تخطئ أحياناً، والنار وضربات الأبطال أضعف
// - القرى المحايدة (شبام): أفراد طرف محايد مسالم (passive: لا يهاجم ولا يُهاجَم ولا يجمّد الاستيلاء)
//   ينضمون لمن يستولي على قريتهم
// - الهرم (القاهرة): دخل أكبر لحيه، وجنود مالكه حوله يتلقون ضرراً أقل
// - دوجو الساموراي (إيدو): حرس محايد معادٍ للجميع كالشرطة، ومالكه جنوده أقوى
// - قطاع الطرق (غيونغجو وكانو): عصابة محايدة تظهر في الوسط بموجات وتستولي على الأحياء (captures)
// - دار العلاج (كايفنغ): علاج قوي حولها، وتجنيد طبيب
// - الحصن (غوندر): حراس محايدون وسهام، وتجنيد أبطال عدوة
// - برج الخرطوم (مروي): برج رماية أقوى، واحتلاله أبطأ
// الحي يحمل ميزته (district.feature، من مولّد الخريطة)، والمباراة ميزة مدينتها (state.feature).
// الأرقام كلها في CITY_FEATURES داخل config.js
import { TICK_SEC, CITY_FEATURES as F, EMPIRE as E, COMBAT, SPAWN, nations } from '../config.js';
import { createUnit, commandAttackMove } from './units.js';
import { applyUpgrades, heroFor, tileOf } from './empire.js';
import { isEnemyId } from './combat.js';
import { forEachNearby } from './spatialHash.js';
import { findFreeTiles } from '../map/pathfinding.js';
import { sound, soundAt } from '../audio/sound.js';
import { hypot } from './hypot.js';
import { random } from './random.js';   // عشوائية المنطق: مشتركة بين الأجهزة في اللعب المحلي

const isAlive = (unit) => unit.state !== 'dead' && unit.hp > 0;
const tickOf = (state) => Math.round(state.time / TICK_SEC);     // رقم التحديث: لا خطأ تراكمي في المواعيد
const ticks = (seconds) => Math.round(seconds / TICK_SEC);
const cityNation = (city) => nations.order.find(id => nations[id].city === city) || null;

export const cityFeature = (city) => F.cities[city] || null;

// --- الطرف المحايد الذي تحتاجه الميزة (يُضاف بعد الشرطة)، وnull لغيرها ---
// villages: أهل القرى المسالمون، dojo: الساموراي، fortress: حراس الحصن، bandits: قطاع الطرق بشكل أمة المدينة
export function createFeaturePlayer(players, feature, city) {
  const cfg = feature === 'villages' ? F.villages : feature === 'dojo' ? F.dojo : feature === 'fortress' ? F.fortress
            : feature === 'bandits' ? F.bandits : null;
  if (!cfg) return null;
  const nation = feature === 'bandits' ? cityNation(city) : cfg.nation;
  if (!nation || !nations[nation]) return null;
  return {
    id: players.length,
    name: cfg.name,
    gang: nations[nation].style,       // أفراد الأمة وشخصياتها بقواعد نمطها
    nation,
    gangName: cfg.name,
    color: cfg.color,
    isHuman: false,
    neutral: true,                     // خارج حساب الفوز والخسارة والبوتات كالشرطة
    passive: feature === 'villages',   // لا يهاجم ولا يُهاجَم ولا يُحسب جانباً في الاستيلاء (combat.js وcapture.js)
    captures: feature === 'bandits',   // يستولي على الأحياء (capture.js)
    feature,
    team: 0,
    difficulty: 'medium',
    homeDistrictId: -1
  };
}

export const featurePlayer = (state) => state.players.find(p => p.feature) || null;

// وسط مبنى الميزة بالمربعات: وسط كتلته 2×2 (مربعها الأمامي featureTile ناقص نصف مربع)، أو مربعه الوحيد
export function featureCenter(map, d) {
  const at = tileOf(map, d.featureTile);
  return d.featureBig ? { i: at.i - 0.5, j: at.j - 0.5 } : at;
}

// إحصائيات وحدة محايدة أو مجنَّدة فوق إحصائيات شخصيتها، وmul للدم والضرر (قطاع الطرق في الموجات المتأخرة)
function boost(unit, extra, mul = 1) {
  const s = { ...unit.stats, ...(extra || {}) };
  if (mul !== 1) {
    s.hp *= mul;
    s.damage *= mul;
    if (s.meleeDamage) s.meleeDamage *= mul;
  }
  unit.stats = s;
  unit.maxHp = s.hp;
  unit.hp = s.hp;
}

// --- البداية ---
export function initFeatures(state) {
  if (state.feature === 'villages') initVillages(state);
  for (const d of state.map.districts) {
    if (!d.capture || d.featureTile === undefined) continue;
    d.cool = 0;
    if (d.feature === 'dojo') {
      for (let k = 0; k < F.dojo.start; k++) spawnGuard(state, d, F.dojo);
      d.nextAt = F.dojo.every;
    } else if (d.feature === 'fortress') {
      for (let k = 0; k < F.fortress.guards; k++) spawnGuard(state, d, F.fortress);
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
  switch (state.feature) {
    case 'storm': stormNotices(state); break;
    case 'villages': joinVillagers(state); break;
    case 'dojo': updateDojo(state); vanishGuards(state); break;
    case 'fortress': updateFortresses(state); vanishGuards(state); break;
    case 'khartoum': updateKhartoum(state); break;
    case 'clinic': updateClinics(state); break;
    case 'bandits': updateBandits(state); break;
  }
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

const clock = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

// سطر شريط الطور: العاصفة الجارية أو القادمة حين تقترب، وموجة قطاع الطرق القادمة (null بعيداً عنهما)
export function featureBar(state) {
  if (state.feature === 'storm') {
    const now = stormAt(state.time);
    if (now.on) return { text: 'عاصفة رملية ' + clock(now.left), alarm: true };
    return now.left <= F.storm.duration ? { text: 'عاصفة بعد ' + clock(now.left), alarm: now.left <= F.storm.warn } : null;
  }
  if (state.feature === 'bandits' && state.mode !== 'survival') {
    const B = F.bandits;
    const left = state.time < B.first ? B.first - state.time : B.every - ((state.time - B.first) % B.every);
    return left <= 30 ? { text: 'قطاع الطرق بعد ' + clock(left), alarm: left <= 10 } : null;
  }
  return null;
}

// ================= القرى المحايدة (شبام) =================
function initVillages(state) {
  const player = featurePlayer(state);
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

// قرية لم ينضم أهلها بعد (قيمتها عند البوتات، وشارتها وهالتها فوق علمها)
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
    const at = featureCenter(state.map, d);
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

// ================= الحراس المحايدون: ساموراي الدوجو وحراس الحصن =================
// يظهرون حول ساحة مبناهم، ولا يبتعدون عنه أكثر من POLICE.chaseTiles (homePost كالشرطة، combat.js)
function spawnGuard(state, d, cfg) {
  const player = featurePlayer(state);
  if (!player) return false;
  const spots = findFreeTiles(state.map, d.capture.i, d.capture.j, 6);
  if (!spots.length) return false;
  const [i, j] = spots[Math.floor(random() * spots.length)];
  const unit = createUnit(state, player, i, j, cfg.hero);
  boost(unit, cfg.stats);
  const c = featureCenter(state.map, d);
  unit.garrisonOf = d.id;
  unit.homePost = { x: c.i, y: c.j };
  state.units.push(unit);
  return true;
}

function countGuards(state, id) {
  let n = 0;
  for (const unit of state.units) if (unit.garrisonOf === id && isAlive(unit)) n++;
  return n;
}

// أول استيلاء على المبنى: الحراس الباقون يختفون خلال seconds (كشرطة المركز المستولى عليه)
function releaseGuards(state, d, seconds) {
  d.garrisonOff = true;
  for (const unit of state.units) {
    if (unit.garrisonOf === d.id && isAlive(unit)) unit.vanishAt = state.time + random() * seconds;
  }
}

function vanishGuards(state) {
  for (const unit of state.units) {
    if (unit.garrisonOf < 0 || unit.vanishAt < 0 || state.time < unit.vanishAt || !isAlive(unit)) continue;
    unit.hp = 0;
    unit.state = 'dead';
    unit.deathTimer = COMBAT.deathTime;
    unit.target = null;
    unit.path = [];
  }
}

// ================= دوجو الساموراي (إيدو) =================
// ساموراي واحد كل every ثانية حتى max، وأول استيلاء يوقفهم نهائياً
function updateDojo(state) {
  for (const d of state.map.districts) {
    if (d.feature !== 'dojo' || !d.capture || d.featureTile === undefined) continue;
    if (d.owner !== null && !d.garrisonOff) {
      releaseGuards(state, d, F.dojo.vanishSeconds);
      if (d.owner === state.humanId) {
        state.notice = { text: 'استوليت على الدوجو: جنودك +' + Math.round(F.dojo.damageBonus * 100) + '% ضرر', mine: true, t: 4 };
      }
    }
    if (d.garrisonOff || state.time < d.nextAt) continue;
    if (countGuards(state, d.id) < F.dojo.max) spawnGuard(state, d, F.dojo);
    d.nextAt = state.time + F.dojo.every;
  }
}

// مالك الدوجو: كل جنوده أقوى (abilities.js)، و0 لغيره
export function featureDamageBonus(state, playerId) {
  if (state.feature !== 'dojo') return 0;
  for (const d of state.map.districts) if (d.feature === 'dojo' && d.owner === playerId) return F.dojo.damageBonus;
  return 0;
}

// ================= أبراج المزايا: الحصن (غوندر) وبرج الخرطوم (مروي) =================
// سهم على أقرب عدو للرامي داخل المدى كل attackTime، بسهام أبراج الاقتصاد نفسها (empire.js) من أعلى المبنى
export function featureTowerStats(d, state = null) {
  const range = state ? stormRangeMul(state) : 1;
  if (d.feature === 'fortress') {
    const T = F.fortress.tower;
    return { range: T.range * range, damage: T.damage, attackTime: T.attackTime };
  }
  const T = E.buildings.tower, K = F.khartoum;
  return { range: K.range * range, damage: T.damage * K.damageMul, attackTime: T.attackTime / K.rateMul };
}

function shoot(state, d, shooter, top) {
  if (d.cool > 0) { d.cool -= TICK_SEC; return; }
  const stats = featureTowerStats(d, state), c = featureCenter(state.map, d);
  let best = null, bestD = stats.range;
  forEachNearby(state, c.i, c.j, stats.range, (unit) => {
    if (!isAlive(unit) || !isEnemyId(state, shooter, unit.playerId)) return;
    const dist = hypot(unit.x - c.i, unit.y - c.j);
    if (dist <= bestD) { bestD = dist; best = unit; }
  });
  if (!best) return;                                    // جاهز ينتظر عدواً
  d.cool = stats.attackTime;
  state.modeState.shots.push({ owner: shooter, target: best, i: c.i, j: c.j, t: 0, prevT: 0,
                               duration: E.arrow.flight, damage: stats.damage, top });
  soundAt(state, 'arrow', c.i, c.j);
}

// الحصن: حراسه، ثم سهامه على كل من يقترب وهو محايد، وعلى أعداء مالكه بعد احتلاله
function updateFortresses(state) {
  const guards = featurePlayer(state);
  for (const d of state.map.districts) {
    if (d.feature !== 'fortress' || !d.capture || d.featureTile === undefined) continue;
    if (d.owner !== null && !d.garrisonOff) {
      releaseGuards(state, d, F.fortress.vanishSeconds);
      if (d.owner === state.humanId) state.notice = { text: 'استوليت على الحصن: جنّد أبطال عدوة من قائمته', mine: true, t: 4 };
    }
    const shooter = d.owner === null ? (guards ? guards.id : null) : state.players[d.owner].neutral ? null : d.owner;
    if (shooter !== null) shoot(state, d, shooter, F.fortress.top - 8);
  }
}

// برج الخرطوم: يرمي لمالكه وحده
function updateKhartoum(state) {
  for (const d of state.map.districts) {
    if (d.feature !== 'khartoum' || d.owner === null || d.featureTile === undefined || state.players[d.owner].neutral) continue;
    shoot(state, d, d.owner, F.khartoum.top - 10);
  }
}

// سرعة الاستيلاء على الحي (capture.js): برج الخرطوم أبطأ بكثير، و1 لغيره
export const featureCaptureMul = (d) => (d.feature && F[d.feature] && F[d.feature].captureMul) || 1;

// ================= دار العلاج (كايفنغ) =================
function updateClinics(state) {
  const C = F.clinic, amount = C.perSecond * TICK_SEC, r2 = C.radius * C.radius;
  for (const d of state.map.districts) {
    if (d.feature !== 'clinic' || d.owner === null || d.featureTile === undefined || state.players[d.owner].neutral) continue;
    const c = featureCenter(state.map, d);
    forEachNearby(state, c.i, c.j, C.radius, (unit) => {
      if (unit.playerId !== d.owner || !isAlive(unit) || unit.hp >= unit.maxHp) return;
      const dx = unit.x - c.i, dy = unit.y - c.j;
      if (dx * dx + dy * dy <= r2) unit.hp = Math.min(unit.maxHp, unit.hp + amount);
    });
  }
}

// ================= التجنيد في المباني المميزة (دار العلاج والحصن) =================
// أنواع التجنيد في مبنى الحي (من قائمته، بطابور القاعدة نفسه في empire.js)، وnull لغيره
export function recruitsAt(d) {
  if (!d || d.featureTile === undefined || !d.feature) return null;
  return (F[d.feature] && F[d.feature].recruits) || null;
}

// يظهر المجنَّد حول ساحة المبنى بلون صاحبه وشكل أمته (طبيب كايفنغ بشكل فتى الجبل، وأبطال عدوة بأشكالهم)
export function spawnRecruit(state, player, d, kind) {
  const R = F.recruits[kind];
  const spots = findFreeTiles(state.map, d.capture.i, d.capture.j, SPAWN.spotSearchTiles);
  if (!spots.length) return false;
  const [i, j] = spots[Math.floor(random() * spots.length)];
  const unit = createUnit(state, { ...player, gang: nations[R.nation].style, nation: R.nation }, i, j, R.hero);
  if (R.stats) boost(unit, R.stats);
  if (R.name) unit.name = R.name;
  unit.recruitKind = kind;
  state.units.push(unit);
  applyUpgrades(state, unit);
  soundAt(state, 'spawn', i, j);
  return true;
}

// ================= قطاع الطرق (غيونغجو وكانو) =================
// الموجة n تظهر في وسط الخريطة عند first + (n − 1) × every، وكل think ثانية يقرر من لا يقاتل منهم وجهته.
// لا موجات في الصمود (الطور لموجات الشرطة وحدها)
function updateBandits(state) {
  if (state.mode === 'survival') return;
  const B = F.bandits, tick = tickOf(state), first = ticks(B.first), every = ticks(B.every);
  if (tick >= first && (tick - first) % every === 0) spawnBandits(state, (tick - first) / every + 1);
  if (tick % ticks(B.think) === 0) thinkBandits(state);
}

function spawnBandits(state, wave) {
  const B = F.bandits, player = featurePlayer(state), map = state.map;
  if (!player) return;
  const count = Math.min(B.maxCount, B.count + B.perWave * (wave - 1));
  const mul = 1 + B.grow * (wave - 1);
  const spots = findFreeTiles(map, Math.round((map.land - 1) / 2), Math.round((map.n - 1) / 2), count);
  spots.forEach(([i, j], k) => {
    const hero = wave >= B.heroFrom && k % B.heroEvery === B.heroEvery - 1 ? heroFor(player, 'strong') : null;
    const unit = createUnit(state, player, i, j, hero);
    boost(unit, null, mul);
    state.units.push(unit);
  });
  if (spots.length) {
    state.notice = { text: B.name + ' ظهروا في وسط المدينة! (الموجة ' + wave + ')', mine: false, t: 4 };
    sound('alert');
  }
}

// وجهة من لا يقاتل منهم: الحي الأقرب الذي ليس لهم (المجاور لأحيائهم أولاً)، حتى cap حياً،
// ثم حراسة أحيائهم (الذي يُنتزع منهم أولاً). لا قواعد اللاعبين ولا مراكز الشرطة، ولا التلة في ملك الحي
function thinkBandits(state) {
  const player = featurePlayer(state);
  if (!player) return;
  const free = state.units.filter(u => u.playerId === player.id && isAlive(u) && u.state === 'idle');
  if (!free.length) return;
  const map = state.map, B = F.bandits;
  const cap = B.cap[state.settings.mapSize] || B.cap.medium;
  const held = map.districts.filter(d => d.owner === player.id && d.capture);
  const cx = free.reduce((s, u) => s + u.x, 0) / free.length, cy = free.reduce((s, u) => s + u.y, 0) / free.length;
  let target = null;
  if (held.length < cap) {
    const near = new Set();
    for (const d of held) for (const id of d.adj || []) near.add(id);
    let bestScore = Infinity;
    for (const d of map.districts) {
      if (!d.capture || d.owner === player.id || d.police || d.building === 'hq' || d.hill) continue;
      const score = hypot(d.capture.i - cx, d.capture.j - cy) - (near.has(d.id) ? 6 : 0);
      if (score < bestScore) { bestScore = score; target = d; }
    }
  } else {
    target = held.find(d => d.progress < 100) ||
             held.reduce((a, b) => hypot(a.capture.i - cx, a.capture.j - cy) <= hypot(b.capture.i - cx, b.capture.j - cy) ? a : b);
  }
  if (!target) return;
  const go = free.filter(u => hypot(u.x - target.capture.i, u.y - target.capture.j) > 2.5);
  if (go.length) commandAttackMove(state, target.capture.i, target.capture.j, go, false);
}
