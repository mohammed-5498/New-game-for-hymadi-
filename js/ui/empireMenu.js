// قائمة الحي في طور الإمبراطورية (بطلب المستخدم): لمستان على حي تملكه تفتحانها، واللعب لا يتوقف خلفها.
// - القاعدة الرئيسية: إنتاج الجنود الأربعة بالنقاط (وطابورها) وسرعة إنتاجها، وترقيات العصابة
// - حي بلا مبنى: بناء برج رماية أو مستشفى أو قاعدة رئيسية (المبنى لا يتغير بعد بنائه)
// - البرج والمستشفى: خانتا ترقيتهما
// كل خيار خانة باسمه وكلفته (ومستواه)، والمعطلة تكتب سببها. تُغلق بزرها أو بلمسة على الخريطة
// أو بزر الرجوع في أندرويد، ووحدها إن سقط الحي أو انتهت المباراة.
import { EMPIRE as E, TILE_HALF_W, TILE_HALF_H, CITY_FEATURES as F } from '../config.js';
import {
  canQueue, unitPrice, heroFor, productionTime, nextUpgrade, canUpgrade, canBuild, nextBuildingUpgrade, canUpgradeBuilding,
  empireCommand, towerStats, hospitalStats, incomeOf, tileOf
} from '../game/empire.js';
import { lanCommand } from '../net/session.js';
import { recruitsAt, featureTowerStats, featureCostMul } from '../game/features.js';
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

// --- الخانات: كل خانة { name, cost(), check(), cmd, level(), max, art, desc }، وcmd أمرها { a, d, x } (empireCommand) ---
function sectionsFor(state, district) {
  const pid = state.humanId, player = state.players[pid];
  const side = player.nation || player.gang;
  const levels = state.modeState.levels[pid];

  // مبنى ميزة المدينة (القسم 3.11): ما يعطيه، وخانات التجنيد فيه إن كان له تجنيد (دار العلاج والحصن)
  if (district.featureTile !== undefined) {
    const sections = [{ title: 'ما يعطيه', stats: true, slots: [] }];
    const recruits = recruitsAt(district);
    if (recruits) {
      sections.push({ title: 'التجنيد', queue: true, slots: recruits.map(kind => {
        const R = F.recruits[kind], art = R.hero || 'common';
        return {
          name: R.name || unitName(R.nation, art), art, side: R.nation, color: player.color,
          cost: () => unitPrice(state, pid, kind),
          check: () => canQueue(state, pid, district, kind),
          cmd: { a: 'queue', d: district.id, x: kind }
        };
      }) });
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
      { title: 'ترقيات العصابة', note: 'لكل جنودك', slots: E.upgrades.order.map(key => ({
        name: E.upgrades[key].name, max: E.upgrades[key].costs.length,
        level: () => levels[key],
        cost: () => (nextUpgrade(state, pid, key) || {}).cost,
        check: () => canUpgrade(state, pid, key),
        cmd: { a: 'upgrade', d: district.id, x: key }
      })) }
    ];
  }

  if (!district.building) {
    return [{ title: 'ابنِ في هذا الحي', note: 'المبنى لا يتغير بعد بنائه', slots: E.buildings.order.map(type => ({
      name: E.buildings[type].name,
      desc: type === 'hq' ? E.buildings.hq.desc + '، +' + E.income.hq + '/ث' : E.buildings[type].desc,
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
    level: () => (district.blv && district.blv[key]) || 0,
    cost: () => (nextBuildingUpgrade(district, key) || {}).cost,
    check: () => canUpgradeBuilding(state, pid, district, key),
    cmd: { a: 'improve', d: district.id, x: key }
  }));
}

const TITLES = { hq: E.buildings.hq.name, tower: E.buildings.tower.name, hospital: E.buildings.hospital.name };

// سطر قدرة البرج أو المستشفى الآن (بعد ترقياته)، أو ما يعطيه مبنى ميزة المدينة
function statsLine(state, district) {
  const fmt = (v) => String(Math.round(v * 10) / 10);
  const pct = (v) => Math.round(v * 100) + '%';
  if (district.feature === 'pyramid') {
    const P = F.pyramid;
    return '+' + P.income + ' نقاط في الثانية • جنودك داخل ' + P.radius + ' مربعات منه يتلقون ضرراً أقل ' + pct(P.damageTaken);
  }
  if (district.feature === 'dojo') return 'كل جنودك +' + pct(F.dojo.damageBonus) + ' ضرر ما دمت تملكه';
  if (district.feature === 'clinic') return 'يعالج ' + F.clinic.perSecond + ' دم/ث لكل جندي • المدى ' + F.clinic.radius + ' مربع';
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
  const arts = [];
  for (const section of sectionsFor(state, district)) {
    const head = body.appendChild(node('div', 'em-title', section.title));
    if (section.note) head.appendChild(node('span', 'em-note', ' — ' + section.note));
    if (section.stats) open.stats = body.appendChild(node('div', 'em-stats'));
    const row = body.appendChild(node('div', 'em-slots'));
    for (const slot of section.slots) {
      const button = row.appendChild(node('button', 'em-slot'));
      if (slot.art) {
        const canvas = button.appendChild(node('canvas', 'em-art'));
        arts.push([canvas, slot]);
      }
      button.appendChild(node('b', '', slot.name));
      if (slot.desc) button.appendChild(node('small', 'em-desc', slot.desc));
      let pips = null;
      if (slot.max) {
        pips = button.appendChild(node('span', 'em-pips'));
        for (let k = 0; k < slot.max; k++) pips.appendChild(node('i'));
      }
      const cost = button.appendChild(node('span', 'em-cost'));
      const why = button.appendChild(node('small', 'em-why'));
      const entry = { slot, button, cost, why, pips, sig: '' };
      button.addEventListener('click', () => press(state, entry));
      open.slots.push(entry);
    }
    if (section.queue) {
      const queue = body.appendChild(node('div', 'em-queue'));
      open.queue = { text: queue.appendChild(node('span')), fill: queue.appendChild(node('div', 'em-bar')).appendChild(node('i')) };
    }
  }
  for (const [canvas, slot] of arts) drawCharacters(canvas, slot.side, [slot.art], slot.color);   // بعد وضعها: بمقاسها
}

// اللعب المحلي (القسم 16): الخانة المتاحة تُرسل أمرها فينفذه كل جهاز في نفس التحديث (بعد لحظة)
function press(state, entry) {
  const { cmd } = entry.slot;
  let result;
  if (state.lanRole) {
    result = entry.slot.check();
    if (result.ok) lanCommand({ k: 'emp', ...cmd });
  } else {
    result = empireCommand(state, state.humanId, cmd.a, cmd.d, cmd.x);
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
  }

  if (open.stats) open.stats.textContent = statsLine(state, district);
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
