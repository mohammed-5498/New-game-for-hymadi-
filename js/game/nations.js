// الأمم (القسم 3.10، docs/NATIONS.md): الأمة نمط قتالي (عصابة كلاسيكية بقواعدها كما هي تماماً)
// + سمة وطنية + أسماء لوحداتها + ضربة بطل خاصة + مدينة. الأرقام كلها في config.js تحت nations،
// والمظهر في render/nationArt.js. الوحدة تحمل gang (نمطها: كل القواعد) وnation (الاسم والمظهر والسمة).
import { nations as NATIONS, GANGS, GANG_IDS } from '../config.js';

// الأمة من مفتاحها، أو null (عصابة كلاسيكية، أو الشرطة)
export const nationOf = (id) => (id && NATIONS.order.includes(id) ? NATIONS[id] : null);

// خيارات خانة اللاعب في قائمة الإعداد: الأمم المتاحة، ثم العصابات الكلاسيكية، ثم عشوائي
export const SIDE_CHOICES = [...NATIONS.order, ...GANG_IDS, 'random'];

// اختيار الخانة ← {gang, nation}. العشوائي يختار من الأمم والعصابات الكلاسيكية معاً
export function resolveSide(choice) {
  if (choice === 'random') choice = SIDE_CHOICES[Math.floor(Math.random() * (SIDE_CHOICES.length - 1))];
  const nation = nationOf(choice);
  if (nation) return { gang: nation.style, nation: choice };
  return { gang: GANGS[choice] ? choice : GANG_IDS[0], nation: null };
}

// اسم الجانب كما يراه اللاعب: اسم عصابة الأمة («أبناء سبأ») أو اسم العصابة الكلاسيكية
export function sideName(gang, nationId) {
  const nation = nationOf(nationId);
  return nation ? nation.gangName : GANGS[gang].name;
}

// إحصائيات وحدة الأمة: إحصائيات نمطها كما هي، ثم معدِّلات السمة الثابتة، وضربة البطل الخاصة
// heroId: الشخصية المميزة (null للفرد العادي والبطل)
export function nationStats(stats, nationId, champion, heroId = null) {
  const nation = nationOf(nationId);
  if (!nation) return stats;
  const mods = nation.trait.mods;
  if (mods.vision) stats.visionRange += mods.vision;
  if (mods.rangedRange && stats.projectile) stats.attackRange += mods.rangedRange;
  if (mods.showoff) stats.showoff = mods.showoff;                        // الاستعراض (combat.js)
  if (mods.weatherProof && stats.projectile) stats.weatherProof = true;   // الرماة لا يتأثرون بالطقس (weather.js)
  if (mods.kicks) stats.kicks = mods.kicks;                              // السافات (combat.js وrealism.js)
  if (mods.commonArmor && !champion && !heroId) stats.armor += mods.commonArmor;   // معاطف الصوف للأفراد
  if (mods.heavyStagger) stats.heavyStagger = 1 + mods.heavyStagger;     // ترنّح الضربة القوية أطول (combat.js)
  if (mods.punches) stats.punches = mods.punches;                        // اليد الملفوفة (combat.js)
  if (mods.armorAll) stats.armor += mods.armorAll;                       // درع كل الوحدات
  if (mods.rangedDamage && stats.projectile) stats.damage *= 1 + mods.rangedDamage;   // ضرر الرمي (لا القريب)
  if (mods.dodge) stats.dodge = mods.dodge;                              // الجينغا: تفادٍ أكثر (realism.js)
  if (mods.duel) stats.clashBonus = mods.duel.clash;                     // مبارزة الفاكون: تصادم أكثر (realism.js)
  if (mods.slowShots && stats.projectile) stats.slowShots = mods.slowShots;   // رمية الأتلاتل (combat.js)
  const hero = heroId && nation.heroMods && nation.heroMods[heroId];
  if (hero && hero.slowHits) stats.slowHits = hero.slowHits;            // ضربة الغاوتشو تُبطئ (combat.js)
  if (champion && nation.ult) stats.ult = nation.ult;
  return stats;
}

// اسم الوحدة في أمتها، أو null للعصابات الكلاسيكية
export function nationUnitName(nationId, heroId, champion) {
  const nation = nationOf(nationId);
  if (!nation) return null;
  return champion ? nation.names.champion : heroId ? nation.names[heroId] : nation.names.common;
}

// --- "داخل أحيائك" ---
// الشوارع لا تنتمي لأي حي والجنود يمشون فيها غالباً، فمنطقة الحي = مربعاته ومعها كل مربع أقرب إليه من غيره:
// بحث عرضي واحد يبدأ من مربعات كل الأحياء القابلة للاستيلاء معاً. وحيّان متجاوران إذا تلامست منطقتاهما.
export function buildTerritory(map) {
  const n = map.n, total = n * n;
  const area = new Int32Array(total).fill(-1), queue = new Int32Array(total);
  let tail = 0;
  for (let k = 0; k < total; k++) {
    const d = map.districtAt[k];
    if (d >= 0 && map.districts[d].capture) { area[k] = d; queue[tail++] = k; }
  }
  for (let head = 0; head < tail; head++) {
    const k = queue[head], i = k % n, a = area[k];
    if (i > 0 && area[k - 1] < 0) { area[k - 1] = a; queue[tail++] = k - 1; }
    if (i < n - 1 && area[k + 1] < 0) { area[k + 1] = a; queue[tail++] = k + 1; }
    if (k >= n && area[k - n] < 0) { area[k - n] = a; queue[tail++] = k - n; }
    if (k + n < total && area[k + n] < 0) { area[k + n] = a; queue[tail++] = k + n; }
  }
  map.areaAt = area;

  const adj = map.districts.map(() => new Set());
  const touch = (a, b) => { if (a >= 0 && b >= 0 && a !== b) { adj[a].add(b); adj[b].add(a); } };
  for (let k = 0; k < total; k++) {
    if (k % n < n - 1) touch(area[k], area[k + 1]);
    if (k + n < total) touch(area[k], area[k + n]);
  }
  map.districts.forEach((d, id) => { d.adj = [...adj[id]].sort((x, y) => x - y); });
}

// هل تقف الوحدة داخل منطقة حي يملكه لاعبها؟
export function inOwnArea(map, unit) {
  const i = Math.round(unit.x), j = Math.round(unit.y);
  if (i < 0 || j < 0 || i >= map.n || j >= map.n) return false;
  const a = map.areaAt[j * map.n + i];
  return a >= 0 && map.districts[a].owner === unit.playerId;
}

// معدِّلات "داخل أحيائك" للاعب (homeDamage وhomeDamageTaken)، أو null لمن لا يملك منها شيئاً
export function homeMods(player) {
  const nation = nationOf(player.nation);
  const mods = nation && nation.trait.mods;
  return mods && (mods.homeDamage || mods.homeDamageTaken) ? mods : null;
}

// «الـ108» للاعب: {radius, perHero, max} إن كانت لأمته، وإلا null (abilities.js)
export function brotherMods(player) {
  const nation = nationOf(player.nation);
  return (nation && nation.trait.mods.brothers) || null;
}

// «روح عدوة» للاعب: {radius, bonus} إن كانت لأمته، وإلا null (abilities.js)
export function outnumberedMods(player) {
  const nation = nationOf(player.nation);
  return (nation && nation.trait.mods.outnumbered) || null;
}

// «مبارزة الفاكون» للاعب: {radius, bonus, clash} إن كانت لأمته، وإلا null (abilities.js)
export function duelMods(player) {
  const nation = nationOf(player.nation);
  return (nation && nation.trait.mods.duel) || null;
}

// «الكتيبة» للاعب: {count, radius, reduce} إن كانت لأمته، وإلا null (abilities.js)
export function phalanxMods(player) {
  const nation = nationOf(player.nation);
  return (nation && nation.trait.mods.phalanx) || null;
}

// نسبة تُضاف لسرعة استيلاء اللاعب على هذا الحي: على أي حي (capture، الجينغا)،
// وعلى حي مجاور لحي يملكه (adjacentCapture، مصر). 0 لمن لا سمة له
export function captureBonus(state, district, playerId) {
  const nation = nationOf(state.players[playerId].nation);
  if (!nation) return 0;
  const mods = nation.trait.mods, all = mods.capture || 0, bonus = mods.adjacentCapture;
  if (!bonus || !district.adj) return all;
  for (const id of district.adj) if (state.map.districts[id].owner === playerId) return all + bonus;
  return all;
}

// إشعار بداية المباراة: سمة أمة اللاعب (حتى يعرف ما الذي يميّزه)
export function traitNotice(player) {
  const nation = player && nationOf(player.nation);
  if (!nation) return null;
  // keep: لا يحل محله إشعار استيلاء لاعب آخر قبل أن تنتهي مدته
  return { text: nation.gangName + ' — «' + nation.trait.name + '»: ' + nation.trait.desc, mine: true, t: NATIONS.noticeSeconds, keep: true };
}
