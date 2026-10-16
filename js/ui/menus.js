// القوائم (القسم 12): الرئيسية، الإعداد، الإعدادات، الإحصائيات، سؤال الخروج، وتبديل الشاشات
import {
  MAP_SIZES, PLAYER_COLORS, GANGS, GANG_IDS, BOT, BOT_LEVELS,
  WEATHER, WEATHER_KEYS, UNITS, MATCH_DEFAULTS, AUDIO, UI, CITIES, REGIONS, gameModes as GM, nations as NATIONS
} from '../config.js';
import { SIDE_CHOICES, resolveSide, nationOf } from '../game/nations.js';
import { sound, audioSettings, setAudioSettings, startMusic } from '../audio/sound.js';
import { isNativeApp, exitApp } from '../platform.js';
import { getPref, setPref } from '../prefs.js';
import { loadStats, favoriteGang } from '../stats.js';
import { savedMatchInfo } from '../matchSave.js';
import { fadeIn, fadeOut, isShown } from './transition.js';
import { showMenuScene, hideMenuScene } from './menuScene.js';
import { setupBattleScreen } from './battleScreen.js';
import { updateCityThumb, drawCardThumb } from './cityThumb.js';
import { setupPicker, openPicker, isPickerOpen } from './picker.js';
import { THEMES } from '../render/cityThemes.js';

const el = (id) => document.getElementById(id);

const MAP_SIZE_KEYS = ['small', 'medium', 'large'];
const MAX_UNIT_CHOICES = [30, 50, 100, 150, 200, 250];
const WEATHER_CHOICES = [...WEATHER_KEYS, 'random'];
// خيار المدينة: المدن، ثم "مدينة المضيف" (مدينة أمة اللاعب الأول، القسم 3.10)، ثم عشوائي
const CITY_CHOICES = [...CITIES.order, 'host', 'random'];
const TEAM_CHOICES = [0, 1, 2, 3, 4];
const SLOT_TYPES = { human: 'أنت', bot: 'بوت', closed: 'مغلقة' };
const MAX_SLOTS = 8;

// --- لوحتا الاختيار حسب المنطقة (picker.js): تبويب لكل منطقة بمدنها أو عصاباتها ---
// تحت اسم المدينة بلدها (الجزء بعد "—" من اسمها الكامل)، أو اسمها الكامل إن لم يكن لها بلد
const cityNote = (city) => {
  const name = THEMES[city] ? THEMES[city].name : '';
  return name.includes('—') ? name.split('—')[1].trim() : name;
};
// تبويب "أخرى" لما لم يُذكر في أي منطقة (مدينة أو أمة جديدة)، فلا تختفي من القائمة
function regionGroups(key, all, title, item) {
  const groups = REGIONS.order.map(r => ({
    name: REGIONS[r].name, title: REGIONS[r][title],
    items: REGIONS[r][key].filter(v => all.includes(v)).map(item)
  }));
  const rest = all.filter(v => !REGIONS.order.some(r => REGIONS[r][key].includes(v)));
  if (rest.length) groups.push({ name: REGIONS.other.name, title: REGIONS.other[title], items: rest.map(item) });
  return groups;
}
const CITY_GROUPS = regionGroups('cities', CITIES.order, 'cityTitle',
  city => ({ value: city, text: CITIES.short[city], note: cityNote(city) }));
const SIDE_GROUPS = [
  ...regionGroups('nations', NATIONS.order, 'nationTitle',
    id => ({ value: id, text: NATIONS[id].name, note: NATIONS[id].gangName + ' • ' + NATIONS.styles[NATIONS[id].style].name })),
  { name: REGIONS.classic.name, title: REGIONS.classic.nationTitle,
    items: GANG_IDS.map(id => ({ value: id, text: GANGS[id].name, note: NATIONS.styles[id].name })) }
];
const regionOf = (groups, value) => groups.find(group => group.items.some(item => item.value === value));

// إعدادات قائمة الإعداد (تتحول إلى إعدادات مباراة عند الضغط على "ابدأ")
const setup = {
  mode: GM.defaultMode,                       // طور اللعب (القسم 9.5)
  pointsMinutes: GM.points.defaultMinutes,
  kingMinutes: GM.king.defaultHoldMinutes,
  allies: GM.survival.defaultAllies,
  survivalLevel: GM.survival.defaultLevel,
  mapSize: MATCH_DEFAULTS.mapSize,
  city: CITIES.defaultCity,                   // طابع المدينة (القسم 3.9)، الافتراضي عشوائي، أو 'host'
  maxUnits: UNITS.maxUnitsDefault,
  weather: 'day',
  slots: []
};

function defaultSlots() {
  const slots = [];
  for (let k = 0; k < MAX_SLOTS; k++) {
    slots.push({
      type: k === 0 ? 'human' : (k < 4 ? 'bot' : 'closed'),
      side: GANG_IDS[k % GANG_IDS.length],      // الأمة أو العصابة الكلاسيكية أو 'random' (القسم 3.10)
      color: PLAYER_COLORS[k].id,
      team: 0,
      difficulty: 'medium'
    });
  }
  return slots;
}

let onStartMatch = null;
let onOpenGame = null;
let onContinueMatch = null;

// زر مع صوت النقرة (القسم 12.0: صوت ui_tap لكل زر)
function onTap(id, action) {
  el(id).addEventListener('click', () => { sound('ui_tap'); action(); });
}

export function setupMenus(handlers) {
  onStartMatch = handlers.startMatch;
  onOpenGame = handlers.openGame;
  onContinueMatch = handlers.continueMatch;
  setup.slots = defaultSlots();
  loadSetup();                         // آخر إعداد لعب به اللاعب

  // حالة الضغط (:active) على أجهزة iOS تحتاج مستمع لمس واحداً على الصفحة
  document.addEventListener('touchstart', () => {}, { passive: true });

  // القائمة الرئيسية (القسم 12.1)
  onTap('btnContinue', continuePressed);
  onTap('btnPlay', () => showScreen('setup'));
  onTap('btnSettings', () => showScreen('settings'));
  onTap('btnStats', () => showScreen('stats'));
  onTap('btnBackToMain', () => showScreen('main'));
  onTap('btnSettingsBack', () => showScreen('main'));
  onTap('btnStatsBack', () => showScreen('main'));
  el('btnStart').addEventListener('click', startPressed);
  el('btnArena').addEventListener('click', arenaPressed);

  // زر الخروج وسؤاله: داخل التطبيق فقط (القسم 2.1)
  el('btnExit').hidden = !isNativeApp();
  onTap('btnExit', openExitDialog);
  onTap('btnExitYes', exitApp);
  onTap('btnExitNo', closeExitDialog);

  // طور اللعب وخياراته: تظهر خيارات الطور المختار فقط
  buildOptions('optMode', GM.order, key => GM[key].name,
    () => setup.mode, key => { setup.mode = key; refresh(); });
  buildOptions('optPointsMinutes', GM.points.minutes, v => String(v),
    () => setup.pointsMinutes, v => { setup.pointsMinutes = v; refresh(); });
  buildOptions('optKingMinutes', GM.king.holdMinutes, v => String(v),
    () => setup.kingMinutes, v => { setup.kingMinutes = v; refresh(); });
  buildOptions('optAllies', GM.survival.allies, v => String(v),
    () => setup.allies, v => { setup.allies = v; refresh(); });
  buildOptions('optSurvivalLevel', GM.survival.levels, key => BOT[key].name,
    () => setup.survivalLevel, key => { setup.survivalLevel = key; refresh(); });

  buildOptions('optMapSize', MAP_SIZE_KEYS,
    key => MAP_SIZES[key].name + ' (' + MAP_SIZES[key].maxPlayers + ')',
    () => setup.mapSize, key => { setup.mapSize = key; refresh(); });

  onTap('btnCity', openCityPicker);

  buildOptions('optMaxUnits', MAX_UNIT_CHOICES, value => String(value),
    () => setup.maxUnits, value => { setup.maxUnits = value; refresh(); });

  buildOptions('optWeather', WEATHER_CHOICES,
    key => key === 'random' ? 'عشوائي' : WEATHER[key].name,
    () => setup.weather, key => { setup.weather = key; refresh(); });

  setupPicker();
  buildSlots();
  refresh();
  setupSettings();
  setupBattleScreen();               // أداة قياس البوتات الخفية (القسم 11.4)
}

// --- تبديل الشاشات بتلاشٍ قصير (القسم 12.0) ---
const SCREENS = {
  main: 'screenMain', setup: 'screenSetup', settings: 'screenSettings',
  stats: 'screenStats', game: 'screenGame', battle: 'screenBattle'
};

let screen = 'main';
export const currentScreen = () => screen;

export function showScreen(name) {
  screen = name;
  closeExitDialog();
  if (name === 'main') refreshContinue();
  if (name === 'setup') { el('setupSaveHint').hidden = !savedMatchInfo(); showCity(); }
  if (name === 'settings') refreshSettings();
  if (name === 'stats') renderStats();
  for (const [key, id] of Object.entries(SCREENS)) {
    if (key === name) fadeIn(el(id));
    else fadeOut(el(id));
  }
  // الخلفية الحية لكل القوائم، وتتوقف تماماً أثناء المباراة
  if (name === 'game') {
    hideMenuScene();
    if (onOpenGame) onOpenGame();
  } else {
    showMenuScene();
  }
}

// الصورة المصغرة للمدينة المختارة (حية: في "عشوائي" تتبدل المدن ما دامت القائمة ظاهرة)
// "مدينة المضيف": مدينة أمة اللاعب الأول، أو عشوائي إن كان عصابة كلاسيكية أو عشوائياً
function showCity() {
  const city = setup.city === 'host' ? hostCity(setup.slots[0].side) : setup.city;
  updateCityThumb(el('cityThumb'), el('cityName'), city, () => screen === 'setup' && !isPickerOpen());
}

// لوحة المدن: تبويب لكل منطقة، وفي كل خانة صورة صغيرة لمدينتها، وبجانب الخانة صورة المختارة الحية،
// وفي الأسفل عشوائي ومدينة المضيف
function openCityPicker() {
  openPicker({
    title: 'اختر المدينة',
    groups: CITY_GROUPS,
    art: drawCardThumb,
    extras: [{ value: 'random', text: 'عشوائي' }, { value: 'host', text: 'مدينة المضيف' }],
    current: () => setup.city,
    pick: (city) => { setup.city = city; refresh(); },
    tabFor: (choice) => CITY_GROUPS.indexOf(regionOf(CITY_GROUPS, choice === 'host' ? hostCity(setup.slots[0].side) : choice)),
    aside: (node, choice) => {
      if (node.dataset.kind !== 'city') {
        node.dataset.kind = 'city';
        node.innerHTML = '<canvas id="pickerThumb"></canvas><span id="pickerThumbName" class="hint"></span>';
      }
      const city = choice === 'host' ? hostCity(setup.slots[0].side) : choice;
      updateCityThumb(el('pickerThumb'), el('pickerThumbName'), city, isPickerOpen);
    },
    close: showCity
  });
}

// لوحة الأمم لخانة: تبويب لكل منطقة بعصاباتها ثم الكلاسيكية، وبجانب الخانة وصف المختارة
function openSidePicker(index) {
  const slot = setup.slots[index];
  openPicker({
    title: 'اختر الأمة — الخانة ' + (index + 1) + (index === 0 ? ' (أنت)' : ''),
    groups: SIDE_GROUPS,
    extras: [{ value: 'random', text: 'عشوائي' }],
    current: () => slot.side,
    pick: (side) => {
      slot.side = side;
      descSlot = index;
      refresh();
      if (index === 0 && setup.city === 'host') showCity();
    },
    aside: (node, side) => { node.dataset.kind = 'side'; node.textContent = sideDesc(side); },
    close: null
  });
}

function hostCity(side) {
  const nation = nationOf(side);
  return nation && CITIES.order.includes(nation.city) ? nation.city : 'random';
}

// --- متابعة المباراة المحفوظة ---
// الزر يظهر فقط حين يوجد حفظ، ويصبح هو الذهبي و"لعب" عادياً
function refreshContinue() {
  const info = savedMatchInfo();
  el('btnContinue').hidden = !info;
  el('btnPlay').classList.toggle('gold', !info);
  if (info) el('continueInfo').textContent = info.gang + ' • ' + clock(info.time) + ' • أحياء: ' + info.districts;
}

function continuePressed() {
  if (onContinueMatch && onContinueMatch()) return;
  // حفظ تالف أو من نسخة أقدم من اللعبة: حُذف، ونخبر اللاعب بلطف
  refreshContinue();
  showMainNotice('تعذر فتح المباراة المحفوظة، فحُذفت. ابدأ مباراة جديدة من "لعب".');
}

// رسالة قصيرة تحت أزرار القائمة الرئيسية
export function showMainNotice(text) {
  const node = el('mainNotice');
  node.textContent = text;
  node.hidden = false;
  clearTimeout(node.timer);
  node.timer = setTimeout(() => { node.hidden = true; }, 5000);
}

// --- سؤال الخروج (زر خروج أو زر الرجوع في القائمة الرئيسية) ---
export function openExitDialog() { fadeIn(el('exitDialog')); }
export function closeExitDialog() { fadeOut(el('exitDialog')); }
export const isExitDialogOpen = () => isShown(el('exitDialog'));

// --- الإعدادات (القسم 13.5): مؤشران للصوت وزر كتم عام، والكلمات الطائرة (5.4.4ب) ---
// كلها تُحفظ في localStorage فور تغييرها وتُقرأ عند بدء اللعبة
const percent = (v) => Math.round(v * 100) + '%';

function setupSettings() {
  for (const [id, key] of [['rangeSfx', 'sfx'], ['rangeMusic', 'music']]) {
    const range = el(id);
    range.min = '0';
    range.max = '1';
    range.step = String(AUDIO.volumeStep);
    // أثناء السحب: المستوى يتغير فوراً
    range.addEventListener('input', () => {
      setAudioSettings({ [key]: Number(range.value) });
      refreshSettings();
    });
    // عند الإفلات: نقرة بالمستوى الجديد حتى يسمعه اللاعب
    range.addEventListener('change', () => sound('ui_tap'));
  }

  el('tglMute').addEventListener('click', () => {
    setAudioSettings({ muted: !audioSettings().muted });
    sound('ui_tap');                   // بعد التغيير: تُسمع عند فك الكتم فقط
    refreshSettings();
  });

  el('tglPops').addEventListener('click', () => {
    sound('ui_tap');
    setPref('pops', !getPref('pops'));
    refreshSettings();
  });
  refreshSettings();
}

function refreshSettings() {
  const audio = audioSettings();
  for (const [id, key] of [['rangeSfx', 'sfx'], ['rangeMusic', 'music']]) {
    const range = el(id);
    range.value = String(audio[key]);
    range.style.setProperty('--fill', percent(audio[key]));   // الجزء الممتلئ من المسار
    el(id + 'Value').textContent = percent(audio[key]);
    // الكتم العام يُطفئ المؤشرين بصرياً دون أن يضيّع مستواهما
    range.classList.toggle('muted', audio.muted);
  }
  setSwitch('tglMute', audio.muted);
  setSwitch('tglPops', !!getPref('pops'));
}

function setSwitch(id, on) {
  el(id).setAttribute('aria-checked', on ? 'true' : 'false');
}

// --- الإحصائيات: مجموع كل المباريات المنتهية ---
function clock(seconds) {
  const s = Math.round(seconds);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function playTime(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + ' د';
  return Math.floor(minutes / 60) + ' س ' + (minutes % 60) + ' د';
}

function renderStats() {
  const stats = loadStats();
  const gang = favoriteGang(stats);
  const items = [
    ['المباريات', stats.played],
    ['فوز', stats.wins],
    ['خسارة', stats.losses],
    ['نسبة الفوز', stats.played ? Math.round(100 * stats.wins / stats.played) + '%' : '—'],
    ['أعداء قتلتهم', stats.kills],
    ['وحدات خسرتها', stats.unitsLost],
    ['أكبر عدد أحياء', stats.bestDistricts],
    ['أسرع فوز', stats.fastestWin ? clock(stats.fastestWin) : '—'],
    ['وقت اللعب', playTime(stats.totalSeconds)],
    ['عصابتك المفضلة', gang && nationOf(gang) ? nationOf(gang).gangName : gang && GANGS[gang] ? GANGS[gang].name : '—']
  ];
  el('statsEmpty').hidden = stats.played > 0;
  fillStatCards(el('statsList'), items);
}

// بطاقات رقم وعنوان (تستعملها الإحصائيات وشاشة النهاية)
export function fillStatCards(list, items) {
  list.innerHTML = '';
  for (const [label, value] of items) {
    const card = document.createElement('li');
    const number = document.createElement('b');
    const caption = document.createElement('span');
    number.textContent = String(value);
    caption.textContent = label;
    card.append(number, caption);
    list.appendChild(card);
  }
}

// --- حفظ آخر إعداد مباراة: يجد اللاعب اختياراته كما تركها ---
function loadSetup() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(UI.setupKey) || 'null'); } catch { return; }
  if (!saved || typeof saved !== 'object') return;

  // نقبل القيم الصالحة فقط، فلا تكسر بيانات قديمة أو تالفة القائمة
  if (GM.order.includes(saved.mode)) setup.mode = saved.mode;
  if (GM.points.minutes.includes(saved.pointsMinutes)) setup.pointsMinutes = saved.pointsMinutes;
  if (GM.king.holdMinutes.includes(saved.kingMinutes)) setup.kingMinutes = saved.kingMinutes;
  if (GM.survival.allies.includes(saved.allies)) setup.allies = saved.allies;
  if (GM.survival.levels.includes(saved.survivalLevel)) setup.survivalLevel = saved.survivalLevel;
  if (MAP_SIZES[saved.mapSize]) setup.mapSize = saved.mapSize;
  if (CITY_CHOICES.includes(saved.city)) setup.city = saved.city;
  if (MAX_UNIT_CHOICES.includes(saved.maxUnits)) setup.maxUnits = saved.maxUnits;
  if (WEATHER_CHOICES.includes(saved.weather)) setup.weather = saved.weather;
  if (!Array.isArray(saved.slots)) return;

  saved.slots.slice(0, MAX_SLOTS).forEach((s, k) => {
    if (!s || typeof s !== 'object') return;
    const slot = setup.slots[k];
    if (k > 0 && (s.type === 'bot' || s.type === 'closed')) slot.type = s.type;
    const side = s.side || s.gang;                // gang: إعداد محفوظ قبل الأمم
    if (SIDE_CHOICES.includes(side)) slot.side = side;
    if (PLAYER_COLORS.some(c => c.id === s.color)) slot.color = s.color;
    if (TEAM_CHOICES.includes(s.team)) slot.team = s.team;
    if (BOT_LEVELS.includes(s.difficulty)) slot.difficulty = s.difficulty;
  });
}

function saveSetup() {
  try { localStorage.setItem(UI.setupKey, JSON.stringify(setup)); } catch { /* لا تخزين: يبقى للجلسة */ }
}

// --- صفوف الخيارات (حجم الخريطة، الحد الأقصى، الطقس) ---
export function buildOptions(containerId, values, label, getCurrent, onPick) {
  const container = el(containerId);
  container.innerHTML = '';
  for (const value of values) {
    const button = document.createElement('button');
    button.className = 'opt';
    button.textContent = label(value);
    button.dataset.value = String(value);
    button.addEventListener('click', () => { sound('ui_tap'); onPick(value); });
    container.appendChild(button);
  }
  container.getCurrent = getCurrent;
}

export function refreshOptions(containerId) {
  const container = el(containerId);
  const current = String(container.getCurrent());
  for (const button of container.children) {
    button.classList.toggle('selected', button.dataset.value === current);
  }
}

// --- خانات اللاعبين ---
function buildSlots() {
  const container = el('slots');
  container.innerHTML = '';

  setup.slots.forEach((slot, index) => {
    const row = document.createElement('div');
    row.className = 'slot';
    row.dataset.index = String(index);

    row.appendChild(cell('num', String(index + 1), null));

    // نوع الخانة: الخانة الأولى دائماً أنت
    const type = cell('type', '', () => {
      if (index === 0) return;
      slot.type = slot.type === 'bot' ? 'closed' : 'bot';
      refresh();
    });
    row.appendChild(type);

    // اللمس على أي خانة مغلقة يفتحها بوتاً، حتى لا تكون هناك لمسة بلا نتيجة
    const openIfClosed = () => {
      if (slot.type !== 'closed') return false;
      slot.type = 'bot';
      refresh();
      return true;
    };

    // الأمة (القسم 3.10): لوحة مرتبة حسب المنطقة (العصابات العربية...) ثم الكلاسيكية، وسطر يصف المختارة تحت الخانات
    row.appendChild(cell('gang', '', () => {
      descSlot = index;
      if (openIfClosed()) return;
      openSidePicker(index);
    }));

    // اللمس على اللون ينتقل لأول لون غير مستخدم
    row.appendChild(cell('color', '', () => {
      if (openIfClosed()) return;
      slot.color = firstFreeColor(index);
      refresh();
    }));

    row.appendChild(cell('team', '', () => {
      if (openIfClosed()) return;
      slot.team = next(TEAM_CHOICES, slot.team);
      refresh();
    }));

    row.appendChild(cell('difficulty', '', () => {
      if (openIfClosed()) return;
      if (slot.type !== 'bot') return;      // خانة اللاعب: لا صعوبة
      slot.difficulty = next(BOT_LEVELS, slot.difficulty);
      refresh();
    }));

    container.appendChild(row);
  });
}

function cell(className, text, onClick) {
  const node = document.createElement(onClick ? 'button' : 'div');
  node.className = 'cell ' + className;
  node.textContent = text;
  if (onClick) node.addEventListener('click', () => { sound('ui_tap'); onClick(); });
  return node;
}

const next = (list, current) => list[(list.indexOf(current) + 1) % list.length];

// الخانة التي يصفها سطر الأمة: آخر خانة لمس اللاعب أمتها (الافتراضي خانته)
let descSlot = 0;

// اسم الخيار في الخانة، وسطر صغير تحته: اسم عصابة الأمة، أو "كلاسيكية"
function sideLabel(side) {
  const nation = nationOf(side);
  if (nation) return { text: nation.name, note: nation.gangName };
  if (GANGS[side]) return { text: GANGS[side].name, note: NATIONS.classicNote };
  return { text: 'عشوائي', note: '' };
}

// وصف الخيار: النمط القتالي، والسمة وضربة البطل للأمة
function sideDesc(side) {
  const nation = nationOf(side);
  if (nation) {
    const style = NATIONS.styles[nation.style];
    return nation.name + ' «' + nation.gangName + '» — نمط ' + style.name + ': ' + style.desc +
      ' • السمة «' + nation.trait.name + '»: ' + nation.trait.desc +
      ' • البطل ' + nation.names.champion + ': «' + nation.ult.name + '» ' + nation.ult.desc;
  }
  if (GANGS[side]) {
    const style = NATIONS.styles[side];
    return GANGS[side].name + ' (' + NATIONS.classicNote + ') — نمط ' + style.name + ': ' + style.desc;
  }
  return 'عشوائي: أمة أو عصابة كلاسيكية تُختار عند بدء المباراة';
}

// أول لون لا يستخدمه لاعب آخر
function firstFreeColor(index) {
  const used = new Set(setup.slots
    .filter((s, k) => k !== index && s.type !== 'closed')
    .map(s => s.color));
  const current = setup.slots[index].color;
  const order = PLAYER_COLORS.map(c => c.id);
  const start = order.indexOf(current);
  for (let step = 1; step <= order.length; step++) {
    const candidate = order[(start + step) % order.length];
    if (!used.has(candidate)) return candidate;
  }
  return current;
}

// --- تحديث كل الواجهة بعد أي تغيير ---
function refresh() {
  for (const id of ['optMode', 'optPointsMinutes', 'optKingMinutes', 'optAllies', 'optSurvivalLevel']) refreshOptions(id);
  refreshOptions('optMapSize');
  refreshOptions('optMaxUnits');
  refreshOptions('optWeather');

  // سطر يشرح الطور المختار، وخياراته وحدها ظاهرة
  el('modeDesc').textContent = GM[setup.mode].desc;
  // زر المدينة: الخيار ومنطقته (الاسم الكامل تحته من الصورة المصغرة)
  const cityGroup = regionOf(CITY_GROUPS, setup.city);
  el('cityChoice').textContent = setup.city === 'random' ? 'عشوائي' : setup.city === 'host' ? 'مدينة المضيف'
    : CITIES.short[setup.city] + (cityGroup ? ' • ' + cityGroup.name : '');
  for (const row of document.querySelectorAll('#screenSetup .row[data-mode]')) {
    row.hidden = row.dataset.mode !== setup.mode;
  }
  const survival = setup.mode === 'survival';
  el('screenSetup').querySelector('.menu.setup').classList.toggle('survival', survival);

  const limit = MAP_SIZES[setup.mapSize].maxPlayers;
  el('slotsHint').textContent = survival
    ? 'اختر أمتك ولونك • الحلفاء من الخانات التالية'
    : 'الخانة الأولى أنت • الحد على هذه الخريطة ' + limit + ' لاعبين';

  for (const row of el('slots').children) {
    const index = Number(row.dataset.index);
    const slot = setup.slots[index];
    row.classList.toggle('closed', slot.type === 'closed');

    row.querySelector('.type').textContent = SLOT_TYPES[slot.type];
    const label = sideLabel(slot.side), sideCell = row.querySelector('.gang');
    sideCell.textContent = label.text;
    if (label.note) {
      const note = document.createElement('small');
      note.className = 'cell-note';
      note.textContent = label.note;
      sideCell.appendChild(note);
    }
    row.querySelector('.team').textContent = slot.team === 0 ? 'بدون' : 'فريق ' + slot.team;
    // المجنون: سطر صغير تحته "يحصل على مزايا إضافية" حتى يعرف اللاعب أنه ليس عادلاً (11.3)
    const level = slot.type === 'bot' ? BOT[slot.difficulty] : null;
    const cellNode = row.querySelector('.difficulty');
    cellNode.textContent = level ? level.name : '—';
    if (level && level.note) {
      const note = document.createElement('small');
      note.className = 'cell-note';
      note.textContent = level.note;
      cellNode.appendChild(note);
    }

    const colorCell = row.querySelector('.color');
    const color = PLAYER_COLORS.find(c => c.id === slot.color);
    colorCell.style.background = color.hex;
    colorCell.title = color.name;
  }

  const described = setup.slots[descSlot] && setup.slots[descSlot].type !== 'closed' ? descSlot : 0;
  el('sideDesc').textContent = (described ? 'الخانة ' + (described + 1) + ': ' : '') + sideDesc(setup.slots[described].side);
  el('setupError').hidden = true;
}

// --- التحقق قبل بدء المباراة ---
function validate() {
  const limit = MAP_SIZES[setup.mapSize].maxPlayers;

  // الصمود: أنت وحلفاؤك في فريق واحد ضد الشرطة، فلا شرط للجانبين المتعاديين
  if (setup.mode === 'survival') {
    if (1 + setup.allies > limit) {
      return 'أنت و' + setup.allies + ' حلفاء أكثر من حد الخريطة ' + MAP_SIZES[setup.mapSize].name +
             ' (' + limit + '). قلّل الحلفاء أو كبّر الخريطة.';
    }
    const colors = survivalSlots().map(s => s.color);
    if (new Set(colors).size !== colors.length) return 'لا يمكن أن يتكرر اللون بين لاعبين.';
    return null;
  }

  const active = setup.slots.filter(s => s.type !== 'closed');

  if (active.length < 2) return 'تحتاج لاعبَين على الأقل: افتح خانة بوت واحدة على الأقل.';
  if (active.length > limit) {
    return 'عدد اللاعبين ' + active.length + ' أكبر من حد الخريطة ' +
           MAP_SIZES[setup.mapSize].name + ' (' + limit + '). أغلق خانة أو كبّر الخريطة.';
  }

  // جانبان متعاديان على الأقل: من بلا فريق جانب بنفسه
  const sides = new Set(active.map((s, k) => s.team === 0 ? 'solo' + k : 'team' + s.team));
  if (sides.size < 2) return 'كل اللاعبين في فريق واحد: غيّر فريق أحدهم ليكون هناك عدو.';

  const colors = active.map(s => s.color);
  if (new Set(colors).size !== colors.length) return 'لا يمكن أن يتكرر اللون بين لاعبين.';

  return null;
}

function startPressed() {
  sound('ui_tap');
  const error = validate();
  const errorNode = el('setupError');
  if (error) {
    errorNode.textContent = error;
    errorNode.hidden = false;
    return;
  }
  errorNode.hidden = true;
  saveSetup();
  onStartMatch(buildMatchSettings());
  startMusic();                       // الموسيقى تبدأ مع المباراة لا في القوائم
}

// ساحة تجربة القتال: غربان اللاعب ضد مطارق ثابتة، بلا بوت ولا ظهور
function arenaPressed() {
  sound('ui_tap');
  onStartMatch({
    mapSize: 'small', maxUnits: UNITS.maxUnitsDefault, weather: 'day', arena: true,
    players: [
      { name: 'أنت', gang: 'crows', color: 'purple', isHuman: true, team: 0, difficulty: 'medium' },
      { name: 'المطارق', gang: 'hammers', color: 'red', isHuman: false, team: 0, difficulty: 'medium' }
    ]
  });
  startMusic();
}

// يحول خيارات القائمة إلى إعدادات مباراة
// الصمود: خانتك ثم الحلفاء من الخانات التالية بعددهم (مفتوحة أو مغلقة)
function survivalSlots() {
  return setup.slots.slice(0, 1 + setup.allies);
}

export function buildMatchSettings() {
  const survival = setup.mode === 'survival';
  const slots = survival ? survivalSlots() : setup.slots.filter(s => s.type !== 'closed');
  const players = slots.map((slot, index) => ({
    name: index === 0 ? 'أنت' : 'بوت ' + index,
    ...resolveSide(slot.side),                   // {gang: النمط، nation: الأمة أو null}
    color: slot.color,
    isHuman: index === 0,
    team: survival ? 1 : slot.team,              // الصمود: الجميع فريق واحد
    difficulty: slot.difficulty
  }));

  return {
    mode: setup.mode,
    modeOptions: {
      minutes: setup.pointsMinutes,
      holdMinutes: setup.kingMinutes,
      allies: setup.allies,
      level: setup.survivalLevel
    },
    mapSize: setup.mapSize,
    // مدينة المضيف: مدينة أمة اللاعب الأول بعد حسم العشوائي، أو عشوائي للعصابة الكلاسيكية
    city: setup.city === 'host' ? hostCity(players[0].nation) : setup.city,
    maxUnits: setup.maxUnits,
    weather: setup.weather === 'random'
      ? WEATHER_KEYS[Math.floor(Math.random() * WEATHER_KEYS.length)]
      : setup.weather,
    players
  };
}
