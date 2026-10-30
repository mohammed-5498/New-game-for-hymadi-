// مزايا المدن (القسم 3.11، بطلب المستخدم): ميزة واحدة لكل مدينة، في كل مباراة على الاقتصاد
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
// - الانقلابات (باريس): أحياء من العصابات الكبيرة تتمرد كل دقيقتين، ومتمردون يستولون على ما حولها (captures)
// - مركز الشرطة الرئيسي (روتنبورغ): من يحتله تصير الشرطة صديقة له وتنضم إليه (police.js)
// - برج الساعة (برمنغهام): دخل وإنتاج أسرع لمالكه، واحتلاله أبطأ
// - المجمع السكني (تينوتشتيتلان): عصابة محايدة تحرس أحياءها الأربعة وتستردها، وكل حي منها يرخّص جنود مالكه
// - تمثال ريو (ريو): جنود مالكه حوله أسرع ضرباً وأقوى، واحتلاله أبطأ
// - بيوت المرتزقة (لا بوكا): استئجار مرتزقين
// - قافلة التجارة (صحراء اليمامة): تجار لا يقاتلون (harmless) وحراس يعبرون المدينة، ومن يقتل تاجراً ينهب حمولته
// - السوق الكبير (المدينة العربية): مالكه يأخذ ضريبة مما يصرفه غيره (payTax في صرف empire.js)
// - مهرجان الألعاب النارية (المدينة الصينية): دوائر فوق أكبر تجمعات الجنود تنفجر بعد ثوانٍ (state.fireworks)
// - مقر الترياد (هونغ كونغ): مالكه يرسل مقاتلين مؤقتين إلى حي لعدوه (callTriads، أمر triads في empire.js)
// - إسطبل الفيلة (جايبور): تجنيد فيل حربي (مخلوق creature يُرسم بشكله) يدهس من حوله
// - ترول الجبل (القرية النرويجية): وحش محايد ضخم ينزل بموعد ويقصد أكبر تجمعات الجنود، ومن يقتله يأخذ مكافأته
// - محطة القطار (المدينة الأوروبية): من يملك محطتين ينقل جنوده بينهما (sendTrain، أمر train، وstate.trains في الطريق)
// - منجم الفضة (المدينة المكسيكية): دخل يكبر كلما طال امتلاكه (d.mineRate)
// - البنك (شيكاغو): خزنة تمتلئ (d.vault) يسرقها كلها من يحتل البنك
// الحي يحمل ميزته (district.feature، من مولّد الخريطة)، والمباراة ميزة مدينتها (state.feature).
// الأرقام كلها في CITY_FEATURES داخل config.js
import { TICK_SEC, CITY_FEATURES as F, EMPIRE as E, COMBAT, SPAWN, nations } from '../config.js';
import { createUnit, commandMove, commandAttackMove } from './units.js';
import { applyUpgrades, heroFor, tileOf, spend } from './empire.js';
import { isEnemyId, applyDamage } from './combat.js';
import { addPop, addUltFx } from './realism.js';
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
// villages: أهل القرى المسالمون، dojo: الساموراي، fortress: حراس الحصن، bandits: قطاع الطرق بشكل أمة المدينة،
// coups: المتمردون، cartel: عصابة المجمع، caravan: القافلة، fireworks: الألعاب النارية (بلا وحدات: صاحب ضررها)،
// troll: ترول الجبل
const RAIDERS = ['bandits', 'coups', 'cartel'];      // أطراف تستولي على الأحياء
export function createFeaturePlayer(players, feature, city) {
  const cfg = ['villages', 'dojo', 'fortress', 'bandits', 'coups', 'cartel', 'caravan', 'fireworks', 'troll'].includes(feature)
    ? F[feature] : null;
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
    captures: RAIDERS.includes(feature),   // يستولي على الأحياء (capture.js)
    // القافلة والترول والشرطة لا تتقاتل: هي للعصابات وحدها، غنيمة أو خصماً (friendOf في isEnemyId)
    friendOf: feature === 'caravan' || feature === 'troll' ? players.find(p => p.gang === 'police').id : -1,
    ownOnly: feature === 'cartel',     // عصابة المجمع تحرس أحياءها الأربعة فقط: لا تستولي على غيرها
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
  if (state.feature === 'cartel') initCartel(state);
  if (state.feature === 'fireworks') state.fireworks = [];
  if (state.feature === 'trains') state.trains = [];
  for (const d of state.map.districts) {
    if (!d.capture || d.featureTile === undefined) continue;
    d.cool = 0;
    if (d.feature === 'souk') d.taxed = 0;
    if (d.feature === 'triads' || d.feature === 'station') d.readyAt = 0;
    if (d.feature === 'mine') { d.mineOwner = null; d.mineSince = 0; d.mineRate = 0; }
    if (d.feature === 'bank') { d.vault = 0; d.bankOwner = null; }
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
    case 'coups': updateCoups(state); break;
    case 'cartel': updateCartel(state); break;
    case 'caravan': updateCaravan(state); break;
    case 'fireworks': updateFireworks(state); break;
    case 'triads': expireTriads(state); break;
    case 'elephants': trample(state); break;
    case 'troll': updateTroll(state); break;
    case 'trains': updateTrains(state); break;
    case 'mine': updateMine(state); break;
    case 'bank': updateBank(state); break;
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

// سطر شريط الطور: العاصفة الجارية أو القادمة حين تقترب، وموجة قطاع الطرق أو الانقلاب أو القافلة أو الألعاب النارية
// القادمة، والجارية منها (null بعيداً عنها)
export function featureBar(state) {
  if (state.feature === 'storm') {
    const now = stormAt(state.time);
    if (now.on) return { text: 'عاصفة رملية ' + clock(now.left), alarm: true };
    return now.left <= F.storm.duration ? { text: 'عاصفة بعد ' + clock(now.left), alarm: now.left <= F.storm.warn } : null;
  }
  if (state.feature === 'fireworks') {
    const pending = state.fireworks && state.fireworks.find(f => !f.done);
    if (pending) return { text: 'ألعاب نارية! ابتعد عن الدوائر ' + clock((pending.at - tickOf(state)) * TICK_SEC), alarm: true };
  }
  if (state.feature === 'caravan' && state.mode !== 'survival' && state.units.some(u => u.cargo && isAlive(u))) {
    return { text: 'قافلة في المدينة', alarm: false };
  }
  if (state.feature === 'troll' && state.mode !== 'survival' && state.units.some(u => u.creature === 'troll' && isAlive(u))) {
    return { text: 'ترول الجبل في المدينة!', alarm: true };
  }
  const name = EVENT_NAMES[state.feature];
  if (name && (state.feature === 'fireworks' || state.mode !== 'survival')) {
    const B = F[state.feature];
    const left = state.time < B.first ? B.first - state.time : B.every - ((state.time - B.first) % B.every);
    return left <= 30 ? { text: name + ' بعد ' + clock(left), alarm: left <= 10 } : null;
  }
  return null;
}
const EVENT_NAMES = { bandits: 'قطاع الطرق', coups: 'انقلاب', caravan: 'قافلة', fireworks: 'ألعاب نارية', troll: 'ترول الجبل' };

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
  if (d.feature === 'bank') return F.botValue.bank + d.vault / F.bank.botPer;     // كلما امتلأت الخزنة صار أغرى
  return F.botValue[d.feature] || null;
}

// ================= الهرم (القاهرة) =================
// دخل الحي في الثانية: الهرم بدل نقطة الحي العادي، وnull لغير حي الهرم
// والمنجم دخله الحالي (يكبر مع مدة امتلاكه، updateMine)، والبنك رسومه
export const featureIncome = (d) => d.feature === 'pyramid' ? F.pyramid.income : d.feature === 'mine' ? d.mineRate
  : d.feature === 'bank' ? F.bank.fee : null;

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
  unit.lookKind = cfg.look || null;           // ساموراي الدوجو بصورتهم
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
  // المخلوق (الفيل الحربي) من عصابة مالكه نفسها ويُرسم بشكله (render/creatureArt.js)
  const unit = R.creature ? createUnit(state, player, i, j, null)
    : createUnit(state, { ...player, gang: nations[R.nation].style, nation: R.nation }, i, j, R.hero);
  if (R.stats) boost(unit, R.stats);
  if (R.name) unit.name = R.name;
  if (R.creature) makeCreature(unit, R.creature, R.scale, R.barY);
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

function thinkBandits(state) {
  const player = featurePlayer(state);
  if (!player) return;
  const free = state.units.filter(u => u.playerId === player.id && isAlive(u) && u.state === 'idle');
  const cap = F.bandits.cap[state.settings.mapSize] || F.bandits.cap.medium;
  raid(state, player, free, cap, null);
}

// وجهة من لا يقاتل من طرف يستولي (قطاع الطرق والمتمردون): الحي الأقرب الذي ليس لهم (المجاور لأحيائهم أولاً)،
// حتى cap حياً، ثم حراسة أحيائهم (الذي يُنتزع منهم أولاً). لا قواعد اللاعبين ولا مراكز الشرطة، ولا التلة في ملك الحي.
// near: { i, j, r } حدود ما يقصدونه (المتمردون حول حيهم الأول)، أو null
function raid(state, player, free, cap, near) {
  if (!free.length) return;
  const map = state.map;
  const held = map.districts.filter(d => d.owner === player.id && d.capture);
  const cx = free.reduce((s, u) => s + u.x, 0) / free.length, cy = free.reduce((s, u) => s + u.y, 0) / free.length;
  const inside = (d) => !near || hypot(d.capture.i - near.i, d.capture.j - near.j) <= near.r;
  let target = null;
  if (held.length < cap) {
    const next = new Set();
    for (const d of held) for (const id of d.adj || []) next.add(id);
    let bestScore = Infinity;
    for (const d of map.districts) {
      if (!d.capture || d.owner === player.id || d.police || d.building === 'hq' || d.hill || !inside(d)) continue;
      const score = hypot(d.capture.i - cx, d.capture.j - cy) - (next.has(d.id) ? 6 : 0);
      if (score < bestScore) { bestScore = score; target = d; }
    }
  }
  if (!target) {
    const mine = held.filter(inside);
    target = mine.find(d => d.progress < 100) ||
             mine.reduce((a, b) => !a || hypot(b.capture.i - cx, b.capture.j - cy) < hypot(a.capture.i - cx, a.capture.j - cy) ? b : a, null);
  }
  if (!target) return;
  const go = free.filter(u => hypot(u.x - target.capture.i, u.y - target.capture.j) > 2.5);
  if (go.length) commandAttackMove(state, target.capture.i, target.capture.j, go, false);
}

// ================= الانقلابات (باريس) =================
// الانقلاب n عند first + (n − 1) × every: من كل عصابة تملك at[k] حياً فأكثر يتمرد k + 1 حياً، ثم المتمردون كل think ثانية
function updateCoups(state) {
  if (state.mode === 'survival') return;
  const C = F.coups, tick = tickOf(state), first = ticks(C.first), every = ticks(C.every);
  if (tick >= first && (tick - first) % every === 0) coup(state, (tick - first) / every + 1);
  if (tick % ticks(C.think) === 0) thinkRebels(state);
}

function coup(state, wave) {
  const C = F.coups, rebels = featurePlayer(state), map = state.map;
  if (!rebels) return;
  const mul = 1 + C.grow * (wave - 1);
  let mine = 0, total = 0;
  for (const player of state.players) {
    if (player.neutral) continue;
    const owned = map.districts.filter(d => d.owner === player.id && d.capture);
    const count = C.at.filter(n => owned.length >= n).length;
    if (!count) continue;
    // ما بلا مبنى أولاً، وبترتيب عشوائي مشترك بين الأجهزة
    const candidates = owned.filter(d => d.building !== 'hq' && !d.police && !d.hill)
      .map(d => ({ d, r: (d.building ? 1 : 0) + random() }))
      .sort((a, b) => a.r - b.r)
      .slice(0, count);
    for (const { d } of candidates) {
      d.owner = rebels.id;
      d.progress = 100;
      d.progressOwner = rebels.id;
      for (const [i, j] of findFreeTiles(map, d.capture.i, d.capture.j, C.perDistrict)) {
        const unit = createUnit(state, rebels, i, j);
        boost(unit, null, mul);
        unit.raidFrom = d.id;
        state.units.push(unit);
      }
      total++;
      if (player.id === state.humanId) mine++;
    }
  }
  if (!total) return;
  state.notice = mine
    ? { text: 'انقلاب! تمرد ' + (mine > 1 ? mine + ' من أحيائك' : 'حي من أحيائك'), mine: true, t: 4 }
    : { text: 'انقلاب في المدينة: تمردت ' + total + (total > 1 ? ' أحياء' : ' حي'), mine: false, t: 4 };
  sound('alert');
}

// كل جماعة متمردة (من حي واحد) تستولي على ما حول حيها داخل range مربعاً
function thinkRebels(state) {
  const rebels = featurePlayer(state);
  if (!rebels) return;
  const groups = new Map();
  for (const unit of state.units) {
    if (unit.playerId !== rebels.id || !isAlive(unit) || unit.state !== 'idle') continue;
    if (!groups.has(unit.raidFrom)) groups.set(unit.raidFrom, []);
    groups.get(unit.raidFrom).push(unit);
  }
  for (const [from, free] of groups) {
    const origin = state.map.districts[from];
    if (!origin || !origin.capture) continue;
    raid(state, rebels, free, Infinity, { i: origin.capture.i, j: origin.capture.j, r: F.coups.range });
  }
}

// ================= المجمع السكني (تينوتشتيتلان) =================
// أحياء العصابة الأربعة لها من البداية، وأفرادها المميزون حول المجمع
const cartelDistricts = (state) => state.map.districts.filter(d => d.feature === 'complex' || d.feature === 'cartel');

function initCartel(state) {
  const player = featurePlayer(state), complex = state.map.districts.find(d => d.feature === 'complex');
  if (!player || !complex || !complex.capture || complex.featureTile === undefined) return;
  for (const d of cartelDistricts(state)) {
    if (!d.capture) continue;
    d.owner = player.id;
    d.progress = 100;
    d.progressOwner = player.id;
    d.tintColor = player.color;
    d.tintMix = 1;
  }
  complex.produced = 0;
  complex.nextAt = F.cartel.every;
  for (let k = 0; k < F.cartel.start; k++) spawnCartel(state, complex);
}

function spawnCartel(state, complex) {
  const C = F.cartel;
  if (complex.produced >= C.total) return;
  const hero = C.heroes[complex.produced % C.heroes.length];
  if (spawnGuard(state, complex, { hero, stats: null })) {
    const unit = state.units[state.units.length - 1];
    unit.leash = C.leash;
    complex.produced++;
  }
}

// إنتاج حتى total ما دام المجمع لها، ثم استرداد أحيائها: من لا يقاتل يقصد أقرب حي انتُزع منها
function updateCartel(state) {
  const C = F.cartel, player = featurePlayer(state), complex = state.map.districts.find(d => d.feature === 'complex');
  if (!player || !complex || !complex.capture || complex.featureTile === undefined) return;
  if (complex.owner === player.id && complex.produced < C.total && state.time >= complex.nextAt) {
    spawnCartel(state, complex);
    complex.nextAt = state.time + C.every;
  }
  if (tickOf(state) % ticks(C.think)) return;
  const lost = cartelDistricts(state).filter(d => d.capture && d.owner !== player.id);
  const free = state.units.filter(u => u.playerId === player.id && isAlive(u) && u.state === 'idle');
  if (!lost.length || !free.length) return;
  const cx = free.reduce((s, u) => s + u.x, 0) / free.length, cy = free.reduce((s, u) => s + u.y, 0) / free.length;
  const target = lost.reduce((a, b) => hypot(b.capture.i - cx, b.capture.j - cy) < hypot(a.capture.i - cx, a.capture.j - cy) ? b : a);
  const go = free.filter(u => hypot(u.x - target.capture.i, u.y - target.capture.j) > 1.5);
  if (go.length) commandAttackMove(state, target.capture.i, target.capture.j, go, false);
}

// كلفة جنود اللاعب: أرخص بنسبة discount لكل حي من أحياء العصابة يملكه (1 لغيره)
export function featureCostMul(state, playerId) {
  if (state.feature !== 'cartel') return 1;
  let n = 0;
  for (const d of state.map.districts) if ((d.feature === 'complex' || d.feature === 'cartel') && d.owner === playerId) n++;
  return 1 - F.cartel.discount * n;
}

// ================= برج الساعة (برمنغهام) =================
const clockOwner = (state) => {
  if (state.feature !== 'clock') return -1;
  const d = state.map.districts.find(x => x.feature === 'clock');
  return d && d.owner !== null && !state.players[d.owner].neutral ? d.owner : -1;
};

// مضاعف دخل اللاعب (مالك برج الساعة أكثر)، و1 لغيره
export const featureIncomeMul = (state, playerId) => clockOwner(state) === playerId ? F.clock.incomeMul : 1;
// مضاعف زمن إنتاج جنود اللاعب (مالك برج الساعة أسرع)، و1 لغيره
export const featureProductionMul = (state, playerId) => clockOwner(state) === playerId ? 1 / F.clock.productionMul : 1;

// ================= تمثال ريو (ريو) =================
// التماثيل المملوكة الآن: { owner, x, y, r2 } لضرر جنود مالكها وسرعة ضربهم حولها (abilities.js)، وnull بلا تمثال مملوك
export function statueZones(state) {
  if (state.feature !== 'statue') return null;
  let zones = null;
  for (const d of state.map.districts) {
    if (d.feature !== 'statue' || d.owner === null || d.featureTile === undefined || state.players[d.owner].neutral) continue;
    const at = featureCenter(state.map, d);
    (zones || (zones = [])).push({ owner: d.owner, x: at.i, y: at.j, r2: F.statue.radius * F.statue.radius });
  }
  return zones;
}

export function inZone(zones, unit) {
  for (const z of zones) {
    if (z.owner !== unit.playerId) continue;
    const dx = unit.x - z.x, dy = unit.y - z.y;
    if (dx * dx + dy * dy <= z.r2) return true;
  }
  return false;
}

// ================= مركز الشرطة الرئيسي (روتنبورغ) =================
// شرطة المركز الرئيسي بشكل أفراد ألمانيا (والضابط بشكل captainLook)، وأقوى قليلاً (police.js)
export function dressMainPolice(unit, captain) {
  const P = F.policeHQ;
  unit.nation = P.nation;
  unit.lookKind = captain ? P.captainLook : null;
  boost(unit, null, P.boost);
}

// شرطي ينضم إلى صاحب المركز الرئيسي: جندي من جنوده بلونه، بلا مركز ولا حد مطاردة، ويستولي كالفرد العادي
export function joinPolice(state, unit, owner) {
  unit.playerId = owner.id;
  unit.color = owner.color;
  unit.artColor = owner.color;
  unit.stationId = -1;
  unit.homePost = null;
  unit.vanishAt = -1;
  unit.target = null;
  unit.stats = { ...unit.stats, capturePower: 1 };
  applyUpgrades(state, unit);
}

// ================= قافلة التجارة (صحراء اليمامة) =================
// القافلة n عند first + (n − 1) × every (لا قوافل في الصمود): تجار لا يقاتلون يحملون البضائع، وحراس من حراس القوافل،
// من بوابة في السور إلى أقرب شارع على الحافة المقابلة. كل تاجر يُقتل يعطي قاتله loot، ومن يبلغ المخرج يخرج بحمولته
function updateCaravan(state) {
  if (state.mode === 'survival') return;
  const C = F.caravan, tick = tickOf(state), first = ticks(C.first), every = ticks(C.every);
  if (tick >= first && (tick - first) % every === 0) spawnCaravan(state);
  lootMerchants(state);
  if (tick % ticks(C.think) === 0) moveCaravan(state);
}

// البوابات شوارع على الحافتين البعيدتين (buildCityWalls في المولّد): gateJ على i = 0 وgateI على j = 0،
// والمخرج أقرب شارع موصول على الحافة المقابلة
function caravanRoute(state) {
  const map = state.map, gates = [], last = map.n - 1;
  for (let k = 0; k < map.kind.length; k++) if (map.kind[k] === 'gateI' || map.kind[k] === 'gateJ') gates.push(k);
  if (!gates.length) return null;
  const k = gates[Math.floor(random() * gates.length)], gi = k % map.n, gj = Math.floor(k / map.n);
  const alongI = map.kind[k] === 'gateJ';
  let exit = null, best = Infinity;
  for (let a = 0; a < map.n; a++) {
    const i = alongI ? last : a, j = alongI ? a : last;
    if (!map.isConnected(i, j)) continue;
    const off = Math.abs(a - (alongI ? gj : gi));
    if (off < best) { best = off; exit = { i, j, until: state.time + F.caravan.maxSeconds }; }
  }
  return exit && { gi, gj, exit };
}

function spawnCaravan(state) {
  const C = F.caravan, player = featurePlayer(state);
  const route = player && caravanRoute(state);
  if (!route) return;
  const spots = findFreeTiles(state.map, route.gi, route.gj, C.merchants + C.guards.length);
  spots.forEach(([i, j], k) => {
    const merchant = k < C.merchants;
    const unit = createUnit(state, player, i, j, merchant ? null : C.guards[k - C.merchants]);
    boost(unit, merchant ? C.merchant : C.guard);
    unit.caravanExit = route.exit;
    if (merchant) {
      unit.harmless = true;          // لا يبحث عن هدف (combat.js)، ويُضرب كغيره
      unit.cargo = true;             // حمولته فوق رأسه (render/units.js) حتى يُنهب
      unit.name = C.merchantName;
    }
    state.units.push(unit);
  });
  if (!spots.length) return;
  state.notice = { text: 'قافلة تجارية دخلت المدينة! كل تاجر تنهبه: ' + C.loot + ' نقطة', mine: false, t: 4 };
  sound('alert');
  moveCaravan(state);
}

// تاجر سقط: حمولته لمن ضربه آخر مرة، مرة واحدة (لا شيء إن سقط بيد طرف محايد)
function lootMerchants(state) {
  const C = F.caravan, ms = state.modeState;
  for (const unit of state.units) {
    if (!unit.cargo || unit.state !== 'dead') continue;
    unit.cargo = false;
    const killer = unit.lastHitBy;
    if (killer < 0 || !state.players[killer] || state.players[killer].neutral) continue;
    ms.points[killer] += C.loot;
    ms.earned[killer] += C.loot;
    addPop(state, unit, '+' + C.loot, 'loot');
    soundAt(state, 'capture_done', unit.x, unit.y);
    if (killer === state.humanId) state.notice = { text: 'نهبت تاجراً: +' + C.loot + ' نقطة', mine: true, t: 2.5 };
  }
}

// كل think ثانية: من بلغ المخرج (أو انتهى وقت قافلته) يخرج بلا جثة، والتجار يمضون إليه،
// والحراس يرافقونهم بهجوم متحرك نحو وسطهم، ثم يتبعونهم إلى المخرج إن لم يبقَ تاجر
function moveCaravan(state) {
  const C = F.caravan, player = featurePlayer(state);
  if (!player) return;
  const mine = state.units.filter(u => u.playerId === player.id && u.caravanExit && isAlive(u));
  if (!mine.length) return;
  const gone = new Set();
  for (const u of mine) {
    const exit = u.caravanExit;
    if (state.time < exit.until && hypot(u.x - exit.i, u.y - exit.j) > C.exitRadius) continue;
    u.cargo = false;
    u.hp = 0;
    u.state = 'dead';
    u.deathTimer = 0;
    u.path = [];
    u.target = null;
    gone.add(u);
  }
  if (gone.size) state.units = state.units.filter(u => !gone.has(u));
  const merchants = mine.filter(u => u.harmless && !gone.has(u)), guards = mine.filter(u => !u.harmless && !gone.has(u));
  const idle = merchants.filter(u => u.state === 'idle');
  if (idle.length) commandMove(state, idle[0].caravanExit.i, idle[0].caravanExit.j, idle, false);
  const free = guards.filter(u => u.state !== 'attacking');
  if (!free.length) return;
  if (!merchants.length) {
    const moving = free.filter(u => u.state !== 'moving');
    if (moving.length) commandMove(state, moving[0].caravanExit.i, moving[0].caravanExit.j, moving, false);
    return;
  }
  const ci = merchants.reduce((a, u) => a + u.x, 0) / merchants.length, cj = merchants.reduce((a, u) => a + u.y, 0) / merchants.length;
  const far = free.filter(u => hypot(u.x - ci, u.y - cj) > C.escort);
  if (far.length) commandAttackMove(state, ci, cj, far, false);
}

// ================= السوق الكبير (المدينة العربية) =================
// ضريبة السوق: tax مما يصرفه غير مالكه (spend في empire.js) تُضاف لمالكه، ولا يدفع الصارف أكثر من سعره.
// d.taxed: ما جمعه السوق في المباراة (قائمته)
export function payTax(state, payer, amount) {
  if (state.feature !== 'souk') return;
  const d = state.map.districts.find(x => x.feature === 'souk');
  if (!d || d.owner === null || d.owner === payer || state.players[d.owner].neutral) return;
  const gain = amount * F.souk.tax, ms = state.modeState;
  ms.points[d.owner] += gain;
  ms.earned[d.owner] += gain;
  d.taxed += gain;
}

// ================= مهرجان الألعاب النارية (المدينة الصينية) =================
// العرض n عند first + (n − 1) × every، في كل الأطوار: دوائر فوق أكبر count تجمعات للجنود، وبعد warn ثانية تنفجر:
// damage لكل وحدة داخلها من أي طرف. state.fireworks: { x, y, at, done } (at رقم تحديث الانفجار)، ويبقى المنفجر fade ثانية
function updateFireworks(state) {
  const W = F.fireworks, tick = tickOf(state), first = ticks(W.first), every = ticks(W.every);
  if (tick >= first && (tick - first) % every === 0) markFireworks(state, tick + ticks(W.warn));
  if (!state.fireworks.length) return;
  for (const f of state.fireworks) if (!f.done && tick >= f.at) burstFireworks(state, f);
  if (state.fireworks.some(f => f.done && tick - f.at >= ticks(W.fade))) {
    state.fireworks = state.fireworks.filter(f => !f.done || tick - f.at < ticks(W.fade));
  }
}

const soldier = (state, u) => isAlive(u) && !state.players[u.playerId].neutral;

// أكبر تجمع: الجندي الذي حوله أكثر الجنود داخل radius (الأول عند التساوي، بترتيب الوحدات المشترك بين الأجهزة)،
// ثم لا يصلح من حوله مركزاً لدائرة أخرى فلا تتداخل الدوائر
function markFireworks(state, at) {
  const W = F.fireworks, r2 = W.radius * W.radius, used = new Set();
  let marks = 0;
  for (let n = 0; n < W.count; n++) {
    let best = null, bestCount = W.minUnits - 1;
    for (const u of state.units) {
      if (used.has(u) || !soldier(state, u)) continue;
      let count = 0;
      forEachNearby(state, u.x, u.y, W.radius, (o) => {
        const dx = o.x - u.x, dy = o.y - u.y;
        if (dx * dx + dy * dy <= r2 && !used.has(o) && soldier(state, o)) count++;
      });
      if (count > bestCount) { bestCount = count; best = u; }
    }
    if (!best) break;
    const x = best.x, y = best.y;
    forEachNearby(state, x, y, 2 * W.radius, (o) => {
      const dx = o.x - x, dy = o.y - y;
      if (dx * dx + dy * dy <= 4 * r2) used.add(o);
    });
    state.fireworks.push({ x, y, at, done: false });
    dodgeFireworks(state, x, y);
    marks++;
  }
  if (!marks) return;
  state.notice = { text: 'ألعاب نارية! ابتعد عن الدوائر الحمراء', mine: false, t: 3 };
  sound('alert');
}

// البوتات تُخرج جنودها من الدائرة بفرصة لكل بوت حسب صعوبته (dodgeChance): كل جندي إلى نقطة خارجها
// في اتجاهه من مركزها
function dodgeFireworks(state, x, y) {
  const W = F.fireworks, r = W.radius + 0.3, out = W.radius + W.dodge;
  const movers = [], decided = new Map();
  forEachNearby(state, x, y, r, (u) => {
    const p = state.players[u.playerId];
    if (!isAlive(u) || p.neutral || p.isHuman || hypot(u.x - x, u.y - y) > r) return;
    if (!decided.has(p.id)) decided.set(p.id, random() < (W.dodgeChance[p.difficulty] || 0));
    if (decided.get(p.id)) movers.push(u);
  });
  for (const u of movers) {
    const d = hypot(u.x - x, u.y - y), ux = d > 0.01 ? (u.x - x) / d : 1, uy = d > 0.01 ? (u.y - y) / d : 0;
    commandMove(state, x + ux * out, y + uy * out, [u], false);
  }
}

function burstFireworks(state, f) {
  const W = F.fireworks, r2 = W.radius * W.radius, player = featurePlayer(state), hit = [];
  f.done = true;
  if (!player) return;
  const by = { playerId: player.id };          // صاحب الضرر: طرف الألعاب النارية المحايد (لا مكافأة لأحد)
  forEachNearby(state, f.x, f.y, W.radius, (u) => {
    const dx = u.x - f.x, dy = u.y - f.y;
    if (dx * dx + dy * dy <= r2 && isAlive(u)) hit.push(u);
  });
  for (const u of hit) applyDamage(state, by, u, W.damage);
  soundAt(state, 'fire', f.x, f.y);
}

// ================= المخلوقات: الفيل الحربي وترول الجبل =================
// تُرسم بشكلها (creature) بحجم scale وشريط دمها عند barY، ولا تترنّح ولا تسقط (steadyUntil) ولا تُدفع (holdUntil)
const FOREVER = 1e9;
function makeCreature(unit, kind, scale, barY) {
  unit.creature = kind;
  unit.artScale = scale;
  unit.barY = barY;
  unit.steadyUntil = FOREVER;
  unit.holdUntil = FOREVER;
}

// ================= مقر الترياد (هونغ كونغ) =================
// مالك المقر يدفع cost ويختار حياً لعدو (لا لحليف ولا لطرف محايد إلا الشرطة في الصمود): مقاتلون بلونه يظهرون حوله ويهاجمون ما فيه،
// وبعد seconds يختفون. مرة كل cooldown لكل مقر (d.readyAt). يعيد { ok, reason } كأوامر الاقتصاد
export function canCallTriads(state, pid, d, target) {
  const T = F.triads;
  if (!d || d.feature !== 'triads' || d.featureTile === undefined || d.owner !== pid) return { ok: false, reason: 'ليس مبناك' };
  if (state.time < d.readyAt) return { ok: false, reason: 'يعودون بعد ' + Math.ceil(d.readyAt - state.time) + ' ث' };
  if (state.modeState.points[pid] < T.cost) return { ok: false, reason: 'النقاط لا تكفي' };
  if (target === undefined) return { ok: true, reason: '' };
  return triadTarget(state, pid, target) ? { ok: true, reason: '' } : { ok: false, reason: 'اختر حياً لعدوك' };
}

// حي يصلح هدفاً للترياد: لعدو من العصابات، وفي الصمود حي استولت عليه الشرطة أيضاً (عدو الفريق الوحيد)
export function triadTarget(state, pid, d) {
  if (!d || !d.capture || d.owner === null || d.owner === pid || !isEnemyId(state, pid, d.owner)) return false;
  const owner = state.players[d.owner];
  return !owner.neutral || (state.mode === 'survival' && owner.gang === 'police');
}

export function callTriads(state, pid, districtId, targetId) {
  const T = F.triads, d = state.map.districts[districtId];
  const target = Number.isInteger(targetId) ? state.map.districts[targetId] : null;
  const check = canCallTriads(state, pid, d, target || null);
  if (!check.ok) return check;
  const player = state.players[pid];
  const spots = findFreeTiles(state.map, target.capture.i, target.capture.j, T.heroes.length);
  if (!spots.length) return { ok: false, reason: 'لا مكان هناك' };
  spend(state, pid, T.cost);
  d.readyAt = state.time + T.cooldown;
  const look = { ...player, gang: nations[T.nation].style, nation: T.nation };
  const fighters = spots.map(([i, j], k) => {
    const unit = createUnit(state, look, i, j, T.heroes[k]);
    boost(unit, T.stats);
    unit.name = T.name;
    unit.expireAt = state.time + T.seconds;
    state.units.push(unit);
    applyUpgrades(state, unit);
    return unit;
  });
  addUltFx(state, 'dust', target.capture.i, target.capture.j);
  commandAttackMove(state, target.capture.i, target.capture.j, fighters, false);
  soundAt(state, 'spawn', target.capture.i, target.capture.j);
  if (target.owner === state.humanId) {
    state.notice = { text: 'الترياد يهاجمون حياً من أحيائك!', mine: true, t: 3 };
    sound('alert');
  }
  return { ok: true, reason: '' };
}

// انتهى وقت مقاتلي الترياد: يختفون في غبار بلا جثث
function expireTriads(state) {
  let gone = null;
  for (const u of state.units) {
    if (u.expireAt < 0 || state.time < u.expireAt || !isAlive(u)) continue;
    addUltFx(state, 'dust', u.x, u.y);
    u.hp = 0;
    u.state = 'dead';
    u.deathTimer = 0;
    u.path = [];
    u.target = null;
    (gone || (gone = new Set())).add(u);
  }
  if (gone) state.units = state.units.filter(u => !gone.has(u));
}

// ================= إسطبل الفيلة (جايبور) =================
// كل فيل حي يدهس كل عدو داخل radius كل every ثانية، ما دام بجانبه عدو
function trample(state) {
  const T = F.stable.trample, r2 = T.radius * T.radius;
  for (const u of state.units) {
    if (u.creature !== 'elephant' || !isAlive(u) || state.time < u.trampleAt) continue;
    const hit = [];
    forEachNearby(state, u.x, u.y, T.radius, (o) => {
      const dx = o.x - u.x, dy = o.y - u.y;
      if (dx * dx + dy * dy <= r2 && isAlive(o) && isEnemyId(state, u.playerId, o.playerId)) hit.push(o);
    });
    if (!hit.length) continue;
    u.trampleAt = state.time + T.every;
    for (const o of hit) applyDamage(state, u, o, T.damage);
    addUltFx(state, 'dust', u.x, u.y);
  }
}

// ================= ترول الجبل (القرية النرويجية) =================
// الترول n عند first + (n − 1) × every (لا ترول في الصمود): واحد في كل مرة، من مربع موصول على حافة الجبل (i = 0)،
// يقصد كل think ثانية أكبر تجمع للجنود، وبعد stay ثانية يعود إلى حيث نزل ويختفي. من يقتله يأخذ reward
function updateTroll(state) {
  if (state.mode === 'survival') return;
  const T = F.troll, tick = tickOf(state), first = ticks(T.first), every = ticks(T.every);
  if (tick >= first && (tick - first) % every === 0) spawnTroll(state);
  rewardTroll(state);
  if (tick % ticks(T.think) === 0) moveTroll(state);
}

function spawnTroll(state) {
  const T = F.troll, player = featurePlayer(state), map = state.map;
  if (!player || state.units.some(u => u.creature === 'troll' && isAlive(u))) return;
  const edge = [];
  for (let j = 0; j < map.n; j++) if (map.isConnected(0, j)) edge.push(j);
  if (!edge.length) return;
  const j = edge[Math.floor(random() * edge.length)];
  const unit = createUnit(state, player, 0, j, T.hero);
  boost(unit, T.stats);
  unit.name = T.name;
  makeCreature(unit, 'troll', T.scale, T.barY);
  unit.lair = { i: 0, j, until: state.time + T.stay };
  state.units.push(unit);
  addUltFx(state, 'dust', 0, j);
  state.notice = { text: 'ترول الجبل نزل إلى المدينة! من يقتله يأخذ ' + T.reward + ' نقطة', mine: false, t: 4 };
  sound('alert');
  moveTroll(state);
}

// سقط الترول: مكافأته لمن ضربه آخر مرة (مرة واحدة، ولا شيء إن سقط بيد طرف محايد)
function rewardTroll(state) {
  const T = F.troll, ms = state.modeState;
  for (const u of state.units) {
    if (u.creature !== 'troll' || u.state !== 'dead' || !u.lair) continue;
    u.lair = null;
    const killer = u.lastHitBy;
    if (killer < 0 || !state.players[killer] || state.players[killer].neutral) continue;
    ms.points[killer] += T.reward;
    ms.earned[killer] += T.reward;
    addPop(state, u, '+' + T.reward, 'loot');
    soundAt(state, 'capture_done', u.x, u.y);
    state.notice = killer === state.humanId
      ? { text: 'أسقطت ترول الجبل: +' + T.reward + ' نقطة', mine: true, t: 3 }
      : { text: state.players[killer].gangName + ' أسقطوا ترول الجبل', mine: false, t: 3 };
  }
}

// يقصد أكبر تجمع للجنود (الجندي الذي حوله أكثرهم داخل cluster مربع)، وإذا انتهى وقته يعود ويختفي عند الجبل
function moveTroll(state) {
  const T = F.troll;
  for (const u of state.units) {
    if (u.creature !== 'troll' || !isAlive(u) || !u.lair) continue;
    const lair = u.lair;
    if (state.time >= lair.until) {
      if (hypot(u.x - lair.i, u.y - lair.j) <= 1.6) {
        u.lair = null;
        addUltFx(state, 'dust', u.x, u.y);
        u.hp = 0;
        u.state = 'dead';
        u.deathTimer = 0;
        state.units = state.units.filter(x => x !== u);
        state.notice = { text: 'عاد ترول الجبل إلى الجبل', mine: false, t: 3 };
        return;
      }
      if (u.state !== 'moving') commandMove(state, lair.i, lair.j, [u], false);
      continue;
    }
    if (u.state === 'attacking') continue;
    const r2 = T.cluster * T.cluster;
    let best = null, bestCount = 0;
    for (const o of state.units) {
      if (!soldier(state, o)) continue;
      let count = 0;
      forEachNearby(state, o.x, o.y, T.cluster, (p) => {
        const dx = p.x - o.x, dy = p.y - o.y;
        if (dx * dx + dy * dy <= r2 && soldier(state, p)) count++;
      });
      if (count > bestCount) { bestCount = count; best = o; }
    }
    if (best) commandAttackMove(state, best.x, best.y, [u], false);
  }
}

// ================= ما يُختار بلمسة على الخريطة (القائمة ثم input.js) =================
// هجوم الترياد (حي عدو) ورحلة القطار (محطة أخرى للاعب). يعيد { ok, reason }
export function canPick(state, pid, pick, target) {
  const d = state.map.districts[pick.d];
  return pick.a === 'train' ? canSendTrain(state, pid, d, target) : canCallTriads(state, pid, d, target);
}

// ================= محطة القطار (المدينة الأوروبية) =================
const ownStations = (state, pid) =>
  state.map.districts.filter(d => d.feature === 'station' && d.featureTile !== undefined && d.owner === pid);

// الركاب: جنود اللاعب داخل radius من ساحة المحطة، الأقرب أولاً حتى seats (لا المخلوقات: لا تسعها العربات)
function riders(state, pid, d) {
  const T = F.station, near = [];
  for (const u of state.units) {
    if (u.playerId !== pid || !isAlive(u) || u.creature) continue;
    const dist = hypot(u.x - d.capture.i, u.y - d.capture.j);
    if (dist <= T.radius) near.push([dist, u]);
  }
  near.sort((a, b) => a[0] - b[0]);
  return near.slice(0, T.seats).map(([, u]) => u);
}

export function canSendTrain(state, pid, from, to) {
  if (!from || from.feature !== 'station' || from.featureTile === undefined || from.owner !== pid) return { ok: false, reason: 'ليست محطتك' };
  if (state.time < from.readyAt) return { ok: false, reason: 'القطار يعود بعد ' + Math.ceil(from.readyAt - state.time) + ' ث' };
  if (ownStations(state, pid).length < 2) return { ok: false, reason: 'تحتاج محطة ثانية' };
  if (!riders(state, pid, from).length) return { ok: false, reason: 'لا جنود حول المحطة' };
  if (to === undefined) return { ok: true, reason: '' };
  if (!to || to === from || to.feature !== 'station' || to.featureTile === undefined || to.owner !== pid) {
    return { ok: false, reason: 'اختر محطة أخرى لك' };
  }
  return { ok: true, reason: '' };
}

// المحطة الوحيدة التي يصل إليها القطار من هذه (حين يملك اللاعب محطتين فقط)، وإلا null فيختار بلمسة
export function onlyStation(state, pid, from) {
  const others = ownStations(state, pid).filter(d => d !== from);
  return others.length === 1 ? others[0].id : null;
}

// الركاب يغادرون الخريطة (لا يُرى منهم شيء ولا يُضرب) حتى يصلوا: من كان يقصدهم يترك هدفه، والمقذوفات إليهم تسقط
export function sendTrain(state, pid, fromId, toId) {
  const T = F.station, from = state.map.districts[fromId];
  const to = Number.isInteger(toId) ? state.map.districts[toId] : null;
  const check = canSendTrain(state, pid, from, to || null);
  if (!check.ok) return check;
  const units = riders(state, pid, from), aboard = new Set(units);
  from.readyAt = state.time + T.cooldown;
  for (const u of units) {
    u.path = []; u.flow = null; u.target = null; u.attackMove = null; u.state = 'idle';
    u.pendingHit = null; u.cMove = null; u.cPhases = null;
  }
  state.units = state.units.filter(u => !aboard.has(u));
  for (const u of state.units) if (u.target && aboard.has(u.target)) u.target = null;
  state.projectiles = state.projectiles.filter(p => !aboard.has(p.target));
  state.trains.push({ units, from: from.id, to: to.id, at: tickOf(state) + ticks(T.seconds) });
  addUltFx(state, 'dust', from.capture.i, from.capture.j);
  soundAt(state, 'whistle', from.capture.i, from.capture.j);
  return { ok: true, reason: '' };
}

// القطار وصل: الركاب ينزلون حول ساحة المحطة الأخرى (ولو سقطت أثناء الرحلة)
function updateTrains(state) {
  if (!state.trains.length) return;
  const tick = tickOf(state);
  for (const train of state.trains) {
    if (tick < train.at) continue;
    const to = state.map.districts[train.to];
    const spots = findFreeTiles(state.map, to.capture.i, to.capture.j, train.units.length);
    train.units.forEach((u, k) => {
      const [i, j] = spots[Math.min(k, spots.length - 1)] || [to.capture.i, to.capture.j];
      u.x = u.prevX = i;
      u.y = u.prevY = j;
      u.vx = u.vy = 0;
      u.chaseOrigin = { x: i, y: j };
      state.units.push(u);
    });
    addUltFx(state, 'dust', to.capture.i, to.capture.j);
    soundAt(state, 'whistle', to.capture.i, to.capture.j);
    if (train.units.some(u => u.playerId === state.humanId)) {
      state.notice = { text: 'وصل القطار: ' + train.units.length + ' من جنودك في ' + F.names.station, mine: true, t: 2.5 };
    }
    train.done = true;
  }
  state.trains = state.trains.filter(t => !t.done);
}

// ================= منجم الفضة (المدينة المكسيكية) =================
// الدخل يبدأ من base عند كل احتلال، ويزيد step كل every ثانية حتى max. لا دخل والمنجم محايد
function updateMine(state) {
  const M = F.mine;
  for (const d of state.map.districts) {
    if (d.feature !== 'mine') continue;
    if (d.owner !== d.mineOwner) { d.mineOwner = d.owner; d.mineSince = state.time; }
    const rate = d.owner === null ? 0 : Math.min(M.max, M.base + M.step * Math.floor((state.time - d.mineSince) / M.every));
    if (d.mineRate !== rate) d.mineRate = rate;
  }
}

// ================= البنك (شيكاغو) =================
// الخزنة تمتلئ fill نقطة/ث حتى cap، ومن يحتل البنك من العصابات يسرقها كلها فتبدأ من الصفر
function updateBank(state) {
  const B = F.bank, ms = state.modeState;
  for (const d of state.map.districts) {
    if (d.feature !== 'bank') continue;
    if (d.vault < B.cap) d.vault = Math.min(B.cap, d.vault + B.fill * TICK_SEC);
    if (d.owner === d.bankOwner) continue;
    d.bankOwner = d.owner;
    if (d.owner === null || state.players[d.owner].neutral) continue;
    const loot = Math.floor(d.vault);
    d.vault = 0;
    if (!loot) continue;
    ms.points[d.owner] += loot;
    ms.earned[d.owner] += loot;
    soundAt(state, 'capture_done', d.capture.i, d.capture.j);
    state.notice = d.owner === state.humanId
      ? { text: 'سرقت البنك: +' + loot + ' نقطة', mine: true, t: 3 }
      : { text: state.players[d.owner].gangName + ' سرقوا البنك: ' + loot + ' نقطة', mine: false, t: 3 };
  }
}
