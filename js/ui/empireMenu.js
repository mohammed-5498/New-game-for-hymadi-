// قائمة الحي في طور الإمبراطورية (بطلب المستخدم): لمستان على حي تملكه تفتحانها، واللعب لا يتوقف خلفها.
// - القاعدة الرئيسية: إنتاج الجنود الأربعة بالنقاط (وطابورها) وسرعة إنتاجها، وترقيات العصابة
// - حي بلا مبنى: بناء برج رماية أو مستشفى أو قاعدة رئيسية (المبنى لا يتغير بعد بنائه)
// - البرج والمستشفى: خانتا ترقيتهما
// كل خيار خانة باسمه وكلفته (ومستواه)، والمعطلة تكتب سببها. تُغلق بزرها أو بلمسة على الخريطة
// أو بزر الرجوع في أندرويد، ووحدها إن سقط الحي أو انتهت المباراة.
import { EMPIRE as E, TILE_HALF_W, TILE_HALF_H, CITY_FEATURES as F, DISTRICT_SIZES as DS } from '../config.js';
import { sizeOf } from '../map/sizes.js';
import {
  canQueue, unitPrice, heroFor, productionTime, nextUpgrade, canUpgrade, canBuild, nextBuildingUpgrade, canUpgradeBuilding,
  empireCommand, towerStats, hospitalStats, incomeOf, tileOf, nextFort, canFortify
} from '../game/empire.js';
import { lanCommand } from '../net/session.js';
import { recruitsAt, featureTowerStats, featureCostMul, canCallTriads, canRingBells, clinicStats } from '../game/features.js';
import { drawCreatureIcon } from '../render/creatureArt.js';
import { worldToScreen } from '../map/coords.js';
import { drawCharacters } from './charThumb.js';
import { unitName } from './storeScreen.js';
import { sound } from '../audio/sound.js';

const el = (id) => document.getElementById(id);

let open = null;          // { id, map, building, built, slots, stats, queue }: الحي المفتوحة قائمته وعناصرها
let refreshAt = 0;

export function setupEmpireMenu(state) {
  el('emClose').addEventListener('click', () => { sound('ui_tap'); closeEmpireMenu(state); });
}

export const isEmpireMenuOpen = () => open !== null;

export function openEmpireMenu(state, districtId) {
  open = { id: districtId, map: state.map, building: null, built: false };
  state.empireOpen = districtId;              // دائرة مدى البرج أو المستشفى (empireArt.js)
  el('empireMenu').hidden = false;
  refresh(state);
  revealDistrict(state, state.map.districts[districtId]);
}

export function closeEmpireMenu(state) {
  if (!open) return;
  open = null;
  state.empireOpen = null;
  el('empireMenu').hidden = true;
}

// من حلقة اللعبة كل إطار: القائمة تتحدث 4 مرات في الثانية، وتُغلق إن لم يعد الحي لك
export function updateEmpireMenu(state, now) {
  if (!open) return;
  const district = state.map.districts[open.id];
  if (state.map !== open.map || !state.economy || !state.running || state.matchResult ||
      !district || district.owner !== state.humanId) {
    closeEmpireMenu(state);
    return;
  }
  if (now < refreshAt) return;
  refreshAt = now + E.menu.refreshMs;
  refresh(state);
}

// شخصية كل درجة إنتاج في رسم الشخصيات وأسمائها: العادي، والمميزتان، والبطل
const artOf = (player, kind) => kind === 'common' ? 'common' : kind === 'leader' ? 'champion' : heroFor(player, kind);

// --- الخانات: كل خانة { name, cost(), check(), cmd, level(), max, art, perks() }، وcmd أمرها { a, d, x } (empireCommand) ---
// perks: رموز صغيرة بأرقامها بدل الوصف (بطلب المستخدم: قائمة أصغر في صفحة واحدة) [[رمز، نص]...]، بقيمة المستوى التالي
const pct = (v) => Math.round(v * 100) + '%';
const sec = (v) => (Math.round(v * 10) / 10) + 'ث';
// قيمة المستوى التالي (أو الحالي إن اكتملت): مستوى الخانة الآن وعدد مستوياتها
const nextLevel = (level, max) => Math.min(level + 1, max);

// وفي كل حي تملكه: خانة تحصينه بثلاثة مستويات (القسم 3.12) في صف آخر قسم
function sectionsFor(state, district) {
  const F = E.fortify, sections = districtSections(state, district);
  sections[sections.length - 1].slots.push({
    name: 'سور', max: F.costs.length,
    perks: () => [['castle', '+' + pct(F.capture[nextLevel(district.fort || 0, F.costs.length) - 1])]],
    level: () => district.fort || 0,
    cost: () => (nextFort(district) || {}).cost,
    check: () => canFortify(state, state.humanId, district),
    cmd: { a: 'fortify', d: district.id }
  });
  return sections;
}

function districtSections(state, district) {
  const pid = state.humanId, player = state.players[pid];
  const side = player.nation || player.gang;
  const levels = state.modeState.levels[pid];

  // مبنى ميزة المدينة (القسم 3.11): ما يعطيه، وخانات التجنيد فيه إن كان له تجنيد (دار العلاج والحصن)
  if (district.featureTile !== undefined) {
    const sections = [{ title: 'ما يعطيه', stats: true, slots: [] }];
    const recruits = recruitsAt(district);
    if (recruits) {
      sections.push({ title: 'التجنيد', queue: true, slots: recruits.map(kind => {
        const R = F.recruits[kind], art = R.look || R.hero || 'common';
        return {
          name: R.name || unitName(R.nation, art), art, side: R.nation, creature: R.creature, color: player.color,
          cost: () => unitPrice(state, pid, kind),
          check: () => canQueue(state, pid, district, kind),
          cmd: { a: 'queue', d: district.id, x: kind }
        };
      }) });
    }
    // مقر الترياد: الخانة تبدأ اختيار الحي (pick)، واللمسة التالية على الخريطة ترسلهم إليه (input.js)
    if (district.feature === 'triads') {
      const T = F.triads;
      sections.push({ title: 'الترياد', slots: [{
        name: 'هجوم الترياد', perks: () => [['people', String(T.heroes.length)], ['clock', sec(T.seconds)]],
        art: 'common', side: T.nation, color: player.color, pick: { text: 'المس حياً لعدوك ليهجم عليه الترياد' },
        cost: () => T.cost,
        check: () => canCallTriads(state, pid, district),
        cmd: { a: 'triads', d: district.id }
      }] });
    }
    // الكاتدرائية: لمسة تقرع الأجراس
    if (district.feature === 'cathedral') {
      const C = F.cathedral;
      sections.push({ title: 'الأجراس', slots: [{
        name: 'اقرع الأجراس', perks: () => [['boot', '+' + pct(C.speed)], ['sword', '+' + pct(C.damage)], ['clock', sec(C.seconds)]],
        art: 'common', side, color: player.color,
        cost: () => 'مجاناً',
        check: () => canRingBells(state, pid, district),
        cmd: { a: 'bells', d: district.id }
      }] });
    }
    return sections;
  }

  if (district.building === 'hq') {
    const art = (kind) => artOf(player, kind);
    return [
      // الجنود، وبعدهم سرعة إنتاج هذه القاعدة (ترقيتها هي: تبقى فيها لمن يحتلها)
      { title: 'الإنتاج', queue: true, slots: [...E.units.order.map(kind => ({
        name: unitName(side, art(kind)), art: art(kind), side, color: player.color,
        cost: () => unitPrice(state, pid, kind),
        check: () => canQueue(state, pid, district, kind),
        cmd: { a: 'queue', d: district.id, x: kind }
      })), ...buildingSlots(state, pid, district)] },
      { title: 'ترقيات العصابة', slots: E.upgrades.order.map(key => ({
        name: E.upgrades[key].name, max: E.upgrades[key].costs.length,
        perks: () => [[GANG_ICON[key], '+' + pct(E.upgrades[key].per * nextLevel(levels[key], E.upgrades[key].costs.length))]],
        level: () => levels[key],
        cost: () => (nextUpgrade(state, pid, key) || {}).cost,
        check: () => canUpgrade(state, pid, key),
        cmd: { a: 'upgrade', d: district.id, x: key }
      })) }
    ];
  }

  if (!district.building) {
    return [{ title: 'ابنِ في هذا الحي', slots: E.buildings.order.map(type => ({
      name: E.buildings[type].name,
      perks: () => buildPerks(district, type),
      cost: () => E.buildings[type].cost,
      check: () => canBuild(state, pid, district, type),
      cmd: { a: 'build', d: district.id, x: type }
    })) }];
  }

  return [{ title: 'ترقيات ' + E.buildings[district.building].name, stats: true, slots: buildingSlots(state, pid, district) }];
}

// ترقيات المبنى نفسه (سرعة إنتاج القاعدة، وخانتا البرج والمستشفى): مستوياتها في district.blv
function buildingSlots(state, pid, district) {
  const U = E.buildings[district.building].upgrades;
  return U.order.map(key => ({
    name: U[key].name, max: U[key].costs.length,
    perks: () => upgradePerks(district.building, key, nextLevel((district.blv && district.blv[key]) || 0, U[key].costs.length)),
    level: () => (district.blv && district.blv[key]) || 0,
    cost: () => (nextBuildingUpgrade(district, key) || {}).cost,
    check: () => canUpgradeBuilding(state, pid, district, key),
    cmd: { a: 'improve', d: district.id, x: key }
  }));
}

const TITLES = { hq: E.buildings.hq.name, tower: E.buildings.tower.name, hospital: E.buildings.hospital.name };

// --- الرموز: صور صغيرة SVG بلون النص، ورقمها بجانبها ---
const SVG = (body) => '<svg viewBox="0 0 12 12" aria-hidden="true">' + body + '</svg>';
const ICON = {
  coin: SVG('<ellipse cx="6" cy="9" rx="4.6" ry="1.9" fill="currentColor"/><ellipse cx="6" cy="6" rx="4.6" ry="1.9" fill="currentColor" opacity=".7"/><ellipse cx="6" cy="3" rx="4.6" ry="1.9" fill="currentColor"/>'),
  shield: SVG('<path d="M6 1L10.5 2.8V6C10.5 8.6 8.5 10.3 6 11C3.5 10.3 1.5 8.6 1.5 6V2.8Z" fill="currentColor"/>'),
  castle: SVG('<path d="M1.5 11V4H3V2H4.6V4H5.2V2H6.8V4H7.4V2H9V4H10.5V11H7.4V8.2H4.6V11Z" fill="currentColor"/>'),
  sword: SVG('<path d="M10.6 1.4L4.5 7.5L3.3 6.3L9.4 0.2Z" transform="translate(0 1)" fill="currentColor"/><path d="M2.2 7.4L4.6 9.8M1.4 10.6L3.2 8.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
  range: SVG('<circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="6" cy="6" r="2.2" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="6" cy="6" r="0.9" fill="currentColor"/>'),
  clock: SVG('<circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6 3.2V6L8 7.2" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/>'),
  heart: SVG('<path d="M6 10.4C2.4 7.8 1 6.2 1 4.2C1 2.6 2.2 1.6 3.5 1.6C4.6 1.6 5.4 2.3 6 3.2C6.6 2.3 7.4 1.6 8.5 1.6C9.8 1.6 11 2.6 11 4.2C11 6.2 9.6 7.8 6 10.4Z" fill="currentColor"/>'),
  boot: SVG('<path d="M2 3L5.5 6L2 9M6.5 3L10 6L6.5 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'),
  gear: SVG('<path d="M6 1.2V2.6M6 9.4V10.8M1.2 6H2.6M9.4 6H10.8M2.6 2.6L3.6 3.6M8.4 8.4L9.4 9.4M2.6 9.4L3.6 8.4M8.4 3.6L9.4 2.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="6" cy="6" r="2.4" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
  people: SVG('<circle cx="4" cy="3.6" r="1.7" fill="currentColor"/><circle cx="8.2" cy="3.6" r="1.7" fill="currentColor"/><path d="M1 10.5C1 7.6 7 7.6 7 10.5ZM5.4 10.5C5.6 8.2 11 7.6 11 10.5Z" fill="currentColor"/>'),
  block: SVG('<rect x="2" y="2" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/>')
};
const GANG_ICON = { hp: 'heart', damage: 'sword', armor: 'shield', speed: 'boot' };

// رقائق الرموز في عنصرها { el, sig }: [[رمز، نص]...]، ولا يُلمس DOM إلا حين تتغير
function chips(target, list) {
  const sig = list.map(c => c.join(':')).join('|');
  if (sig === target.sig) return;
  target.sig = sig;
  target.el.innerHTML = list.map(([icon, text]) => '<span class="em-chip">' + (ICON[icon] || '') + (text ? '<span>' + text + '</span>' : '') + '</span>').join('');
}

// ما يعطيه المبنى إن بُني هنا (بحجم الحي): ضرر البرج، وعلاج المستشفى، ودخل القاعدة
function buildPerks(district, type) {
  const size = sizeOf(district);
  if (type === 'tower') return [['sword', String(Math.round(E.buildings.tower.damage * DS.power[size]))], ['range', String(Math.round(E.buildings.tower.range * DS.reach[size] * 10) / 10)]];
  if (type === 'hospital') return [['heart', (Math.round(E.buildings.hospital.perSecond * DS.power[size] * 10) / 10) + '/ث']];
  return [['coin', '+' + (Math.round(E.income.hq * DS.income[size] * 10) / 10) + '/ث'], ['people', '']];
}

// ترقية مبنى بمستواها: سرعة إنتاج القاعدة (زمن أقل)، وضرر البرج وسرعته، ومدى المستشفى وعلاجه
function upgradePerks(building, key, level) {
  const U = E.buildings[building].upgrades[key];
  if (building === 'hq') return [['gear', '−' + pct(1 - U.times[level])]];
  if (building === 'tower') return key === 'damage' ? [['sword', '+' + pct(U.per * level)]] : [['clock', '−' + pct(U.per * level)]];
  return key === 'radius' ? [['range', '+' + U.per * level]] : [['heart', '+' + pct(U.per * level)]];
}

// سطر حجم الحي وتحصينه بالرموز (القسم 3.12): الدخل، وصعوبة احتلاله، وقوة مبانيه ومداها، وسرعة الإنتاج فيه
function sizeChips(district) {
  const size = sizeOf(district), list = [['block', 'حي ' + DS.names[size]]];
  const signed = (v) => (v >= 0 ? '+' : '−') + pct(Math.abs(v));
  if (size !== 'medium') {
    list.push(['coin', signed(DS.income[size] - 1)], ['shield', signed(1 / DS.capture[size] - 1)],
              ['sword', signed(DS.power[size] - 1)], ['range', signed(DS.reach[size] - 1)]);
    if (district.building === 'hq' || recruitsAt(district)) list.push(['gear', signed(1 - DS.production[size])]);
  }
  if (district.fort) list.push(['castle', '+' + pct(E.fortify.capture[district.fort - 1])]);
  return list;
}

// قدرة البرج والمستشفى الآن بالرموز (ومباني المزايا بسطرها النصي)
function statsChips(district) {
  if (district.building === 'tower') {
    const s = towerStats(district);
    return [['sword', String(Math.round(s.damage))], ['clock', sec(s.attackTime)], ['range', String(Math.round(s.range * 10) / 10)]];
  }
  if (district.building === 'hospital') {
    const s = hospitalStats(district);
    return [['heart', (Math.round(s.perSecond * 10) / 10) + '/ث'], ['range', String(Math.round(s.radius * 10) / 10)]];
  }
  return null;
}

// سطر قدرة البرج أو المستشفى الآن (بعد ترقياته)، أو ما يعطيه مبنى ميزة المدينة
function statsLine(state, district) {
  const fmt = (v) => String(Math.round(v * 10) / 10);
  const pct = (v) => Math.round(v * 100) + '%';
  if (district.feature === 'pyramid') {
    const P = F.pyramid;
    return '+' + P.income + ' نقاط في الثانية • جنودك داخل ' + P.radius + ' مربعات منه يتلقون ضرراً أقل ' + pct(P.damageTaken);
  }
  if (district.feature === 'dojo') return 'كل جنودك +' + pct(F.dojo.damageBonus) + ' ضرر ما دمت تملكه';
  if (district.feature === 'clinic') {
    const s = clinicStats(district);
    return 'يعالج ' + fmt(s.perSecond) + ' دم/ث لكل جندي • المدى ' + fmt(s.radius) + ' مربع';
  }
  if (district.feature === 'policeHQ') return 'الشرطة صديقة لك ما دمت تملكه • شرطة كل مركز تحتله تنضم إليك';
  if (district.feature === 'clock') {
    return '+' + pct(F.clock.incomeMul - 1) + ' نقاط و+' + pct(F.clock.productionMul - 1) + ' سرعة إنتاج الجنود • احتلاله أبطأ';
  }
  if (district.feature === 'complex') {
    return 'كل حي من أحياء المجمع تملكه يخفض سعر جنودك ' + pct(F.cartel.discount) +
           ' • خصمك الآن ' + pct(1 - featureCostMul(state, state.humanId));
  }
  if (district.feature === 'statue') {
    const S = F.statue;
    return 'جنودك داخل ' + S.radius + ' مربعات منه: +' + pct(S.damage) + ' ضرر و+' + pct(S.attackSpeed) + ' سرعة ضرب • احتلاله أبطأ';
  }
  if (district.feature === 'mercs') return 'مرتزقة بالنقاط: الخفيف سريع ورخيص، والثقيل قوي وغالٍ';
  if (district.feature === 'triads') {
    const T = F.triads, wait = Math.ceil((district.readyAt || 0) - state.time);
    return 'ترسل ' + T.heroes.length + ' مقاتلين إلى حي لعدوك يقاتلون ' + T.seconds + ' ث • مرة كل ' + T.cooldown + ' ث' +
           (wait > 0 ? ' • جاهزون بعد ' + wait + ' ث' : '');
  }
  if (district.feature === 'cathedral') {
    const C = F.cathedral, wait = Math.ceil((district.readyAt || 0) - state.time);
    return 'أجراسها تجعل كل جنودك أسرع وأقوى ' + C.seconds + ' ث • مرة كل ' + C.cooldown + ' ث' + (wait > 0 ? ' • تُقرع بعد ' + wait + ' ث' : '');
  }
  if (district.feature === 'mine') {
    return 'دخله الآن ' + district.mineRate + ' نقطة/ث • يكبر كل دقيقة حتى ' + F.mine.max + '، ويعود إلى ' + F.mine.base + ' إن احتُل';
  }
  if (district.feature === 'bank') {
    return 'في الخزنة ' + Math.floor(district.vault) + ' نقطة لمن يحتله • رسومه لك ' + F.bank.fee + ' نقطة/ث';
  }
  if (district.feature === 'stable') {
    const R = F.recruits.elephant;
    return 'الفيل الحربي: دم ' + R.stats.hp + '، يدهس كل من حوله • فيل واحد لك في كل مرة';
  }
  if (district.feature === 'souk') {
    return 'تأخذ ' + pct(F.souk.tax) + ' من كل ما يصرفه غيرك • جمعت منه ' + Math.floor(district.taxed || 0) + ' نقطة';
  }
  if (district.feature === 'fortress' || district.feature === 'khartoum') {
    const s = featureTowerStats(district);
    return 'سهم بضرر ' + Math.round(s.damage) + ' كل ' + fmt(s.attackTime) + ' ث • المدى ' + fmt(s.range) + ' مربع' +
           (district.feature === 'khartoum' ? ' • احتلاله أبطأ بكثير' : '');
  }
  if (district.building === 'tower') {
    const s = towerStats(district);
    return 'سهم بضرر ' + Math.round(s.damage) + ' كل ' + fmt(s.attackTime) + ' ث • المدى ' + fmt(s.range) + ' مربع';
  }
  const s = hospitalStats(district);
  return 'يعالج ' + fmt(s.perSecond) + ' دم/ث لكل جندي • المدى ' + fmt(s.radius) + ' مربع';
}

function node(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

// يبني القائمة حين يتغير نوع المبنى (أول فتح، أو بعد البناء)، ثم يحدّث الخانات فقط
function build(state, district) {
  const body = el('emBody');
  body.innerHTML = '';
  open.building = district.building || null;
  open.built = true;
  open.slots = [];
  open.stats = null;
  open.queue = null;
  el('emTitle').textContent = TITLES[district.building] || (district.featureTile !== undefined && F.names[district.feature]) || 'حي بلا مبنى';
  open.size = { el: body.appendChild(node('div', 'em-size em-chips')), sig: '' };
  const arts = [];
  for (const section of sectionsFor(state, district)) {
    body.appendChild(node('div', 'em-title', section.title));
    if (section.stats) open.stats = { el: body.appendChild(node('div', 'em-stats')), sig: '' };
    const row = body.appendChild(node('div', 'em-slots'));
    for (const slot of section.slots) {
      const button = row.appendChild(node('button', 'em-slot'));
      if (slot.art) {
        const canvas = button.appendChild(node('canvas', 'em-art'));
        arts.push([canvas, slot]);
      }
      button.appendChild(node('b', '', slot.name));
      const perks = slot.perks ? { el: button.appendChild(node('span', 'em-chips')), sig: '' } : null;
      let pips = null;
      if (slot.max) {
        pips = button.appendChild(node('span', 'em-pips'));
        for (let k = 0; k < slot.max; k++) pips.appendChild(node('i'));
      }
      const cost = button.appendChild(node('span', 'em-cost'));
      const why = button.appendChild(node('small', 'em-why'));
      const entry = { slot, button, cost, why, pips, perks, sig: '' };
      button.addEventListener('click', () => press(state, entry));
      open.slots.push(entry);
    }
    if (section.queue) {
      const queue = body.appendChild(node('div', 'em-queue'));
      open.queue = { text: queue.appendChild(node('span')), fill: queue.appendChild(node('div', 'em-bar')).appendChild(node('i')) };
    }
  }
  for (const [canvas, slot] of arts) {             // بعد وضعها: بمقاسها
    if (slot.creature) drawCreatureIcon(canvas, slot.creature, slot.color);
    else drawCharacters(canvas, slot.side, [slot.art], slot.color);
  }
}

// أمر من الواجهة: في اللعب المحلي (القسم 16) يُفحص هنا ثم يُرسل فينفذه كل جهاز في نفس التحديث (بعد لحظة)،
// وإلا يُنفذ مباشرة. يعيد { ok, reason }
export function sendEmpire(state, cmd, check) {
  if (!state.lanRole) return empireCommand(state, state.humanId, cmd.a, cmd.d, cmd.x);
  const result = check();
  if (result.ok) lanCommand({ k: 'emp', ...cmd });
  return result;
}

// اختيار حي على الخريطة بعد خانة pick (هجوم الترياد): حالة هذا الجهاز وحده، خارج حالة المباراة المشتركة
let picking = null;
export function takePick() {
  const pick = picking;
  picking = null;
  return pick;
}

function press(state, entry) {
  const { cmd } = entry.slot;
  let result;
  const pick = entry.slot.pick;
  const direct = pick && pick.direct ? pick.direct() : null;
  if (pick && direct === null) {
    result = entry.slot.check();
    if (result.ok) {
      picking = { ...cmd };
      sound('select');
      closeEmpireMenu(state);
      state.notice = { text: pick.text, mine: true, t: 5 };
      return;
    }
  } else if (pick) {
    result = sendEmpire(state, { ...cmd, x: direct }, entry.slot.check);
  } else {
    result = sendEmpire(state, cmd, entry.slot.check);
  }
  if (result.ok) {
    sound('select');
    refresh(state);
    return;
  }
  // معطلة: ومضة على سببها
  sound('ui_tap');
  entry.button.classList.remove('deny');
  void entry.button.offsetWidth;            // يعيد تشغيل الومضة إن تكررت
  entry.button.classList.add('deny');
}

function refresh(state) {
  const district = state.map.districts[open.id];
  if (!open.built || (district.building || null) !== open.building) build(state, district);
  const pid = state.humanId, ms = state.modeState;
  el('emPoints').textContent = Math.floor(ms.points[pid]) + '  (+' + +incomeOf(state, pid).toFixed(1) + '/ث)';

  for (const entry of open.slots) {
    const { slot } = entry;
    const check = slot.check(), cost = slot.cost(), level = slot.level ? slot.level() : 0;
    const maxed = cost === undefined;
    const sig = check.ok + '|' + check.reason + '|' + cost + '|' + level;
    if (sig === entry.sig) continue;          // لا نلمس DOM إلا حين يتغير شيء
    entry.sig = sig;
    entry.button.classList.toggle('off', !check.ok);
    entry.button.classList.toggle('max', maxed);
    entry.cost.textContent = maxed ? 'أعلى مستوى' : String(cost);
    entry.why.textContent = check.ok || maxed ? '' : check.reason;
    if (entry.pips) [...entry.pips.children].forEach((pip, k) => pip.classList.toggle('on', k < level));
    if (entry.perks) chips(entry.perks, entry.slot.perks());      // قيمة المستوى التالي
  }

  // القدرة الآن بالرموز (البرج والمستشفى)، أو سطر مبنى الميزة، وحجم الحي وتحصينه
  if (open.stats) {
    const list = statsChips(district);
    if (list) { open.stats.el.classList.add('em-chips'); chips(open.stats, list); }
    else if (open.stats.sig !== statsLine(state, district)) open.stats.el.textContent = open.stats.sig = statsLine(state, district);
  }
  chips(open.size, sizeChips(district));
  if (open.queue) {
    const queue = ms.queues[district.id] || [];
    const item = queue[0];
    const player = state.players[pid];
    const R = item && F.recruits[item.kind];      // مجنَّد مبنى مميز (القسم 3.11)
    open.queue.text.textContent = item
      ? 'الطابور ' + queue.length + '/' + E.queueMax + ': ' +
        (R ? R.name || unitName(R.nation, R.hero || 'common') : unitName(player.nation || player.gang, artOf(player, item.kind)))
      : 'الطابور فارغ';
    const done = item ? Math.min(1, item.t / productionTime(state, district, item.kind)) : 0;
    open.queue.fill.style.width = (done * 100).toFixed(1) + '%';
  }
}

// الحي تحت القائمة: الكاميرا تنزلق حتى يظهر فوقها
function revealDistrict(state, district) {
  const k = district.buildTile !== undefined && district.buildTile >= 0 ? district.buildTile : null;
  const at = k !== null ? tileOf(state.map, k) : district.capture;
  if (!at) return;
  const x = (at.i - at.j) * TILE_HALF_W, y = (at.i + at.j) * TILE_HALF_H;
  const top = el('empireMenu').getBoundingClientRect().top - el('game').getBoundingClientRect().top;
  const screen = worldToScreen(x, y, state.camera, state.view);
  if (screen.y < top - 24) return;            // ظاهر فوقها
  const want = top * E.menu.revealAt;
  state.cameraTween = {
    fromX: state.camera.x, fromY: state.camera.y,
    toX: state.camera.x, toY: state.camera.y + (screen.y - want) / state.camera.z,
    t: 0
  };
}
