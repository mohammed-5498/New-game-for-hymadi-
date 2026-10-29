// القوائم (القسم 12): الرئيسية، الإعداد، المتجر، الإعدادات، الإحصائيات، سؤال الخروج، وتبديل الشاشات
import {
  MAP_SIZES, PLAYER_COLORS, GANGS, GANG_IDS, BOT, BOT_LEVELS, COMBAT_REALISM,
  WEATHER, WEATHER_KEYS, UNITS, MATCH_DEFAULTS, AUDIO, UI, CITIES, NET, gameModes as GM, nations as NATIONS, CITY_FEATURES
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
import { updateCityThumb, drawCardThumb, shownCity, stopCard } from './cityThumb.js';
import { setupPicker, openPicker, isPickerOpen, refreshPicker } from './picker.js';
import { CITY_GROUPS, SIDE_GROUPS, regionOf } from './regions.js';
import { drawModeIcon, drawSizeIcon, drawUnitsIcon, drawWeatherIcon } from './icons.js';
import { showStore } from './storeScreen.js';
import { lan, lanPeers, broadcastLobby } from '../net/session.js';

const el = (id) => document.getElementById(id);

const MAP_SIZE_KEYS = ['small', 'medium', 'large'];
const MAX_UNIT_CHOICES = [30, 50, 100, 150, 200, 250];
const WEATHER_CHOICES = [...WEATHER_KEYS, 'random'];
// خيار المدينة: المدن، ثم "مدينة المضيف" (مدينة أمة اللاعب الأول، القسم 3.10)، ثم عشوائي
const CITY_CHOICES = [...CITIES.order, 'host', 'random'];
const TEAM_CHOICES = [0, 1, 2, 3, 4];
const SLOT_TYPES = { human: 'أنت', bot: 'بوت', closed: 'مغلقة' };
const MAX_SLOTS = 8;

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
let onStartLan = null;
let onLeaveLanSetup = null;

// زر مع صوت النقرة (القسم 12.0: صوت ui_tap لكل زر)
function onTap(id, action) {
  el(id).addEventListener('click', () => { sound('ui_tap'); action(); });
}

export function setupMenus(handlers) {
  onStartMatch = handlers.startMatch;
  onOpenGame = handlers.openGame;
  onContinueMatch = handlers.continueMatch;
  onStartLan = handlers.startLan;
  onLeaveLanSetup = handlers.leaveLanSetup;
  setup.slots = defaultSlots();
  loadSetup();                         // آخر إعداد لعب به اللاعب

  // حالة الضغط (:active) على أجهزة iOS تحتاج مستمع لمس واحداً على الصفحة
  document.addEventListener('touchstart', () => {}, { passive: true });

  // القائمة الرئيسية (القسم 12.1)
  onTap('btnContinue', continuePressed);
  onTap('btnPlay', () => showScreen('setup'));
  onTap('btnStore', () => showScreen('store'));
  onTap('btnSettings', () => showScreen('settings'));
  onTap('btnStats', () => showScreen('stats'));
  onTap('btnBackToMain', () => { if (lanSetup) onLeaveLanSetup(); else showScreen('main'); });
  onTap('btnSettingsBack', () => showScreen('main'));
  onTap('btnStatsBack', () => showScreen('main'));
  onTap('btnStoreBack', () => showScreen('main'));
  el('btnStart').addEventListener('click', startPressed);
  el('btnArena').addEventListener('click', arenaPressed);

  // زر الخروج وسؤاله: داخل التطبيق فقط (القسم 2.1)
  el('btnExit').hidden = !isNativeApp();
  onTap('btnExit', openExitDialog);
  onTap('btnExitYes', exitApp);
  onTap('btnExitNo', closeExitDialog);

  // خيارات المباراة: كل زر يفتح لوحته (طور اللعب وخياراته، المدينة، حجم الخريطة، الطقس، الحد الأقصى)
  onTap('pickMode', openModePicker);
  onTap('btnCity', openCityPicker);
  onTap('pickSize', openSizePicker);
  onTap('pickWeather', openWeatherPicker);
  onTap('pickUnits', openUnitsPicker);

  setupPicker();
  buildSlots();
  refresh();
  setupSettings();
  setupBattleScreen();               // أداة قياس البوتات الخفية (القسم 11.4)
}

// --- تبديل الشاشات بتلاشٍ قصير (القسم 12.0) ---
const SCREENS = {
  main: 'screenMain', setup: 'screenSetup', store: 'screenStore', settings: 'screenSettings',
  stats: 'screenStats', game: 'screenGame', battle: 'screenBattle', lan: 'screenLan'
};

let screen = 'main';
export const currentScreen = () => screen;

export function showScreen(name) {
  screen = name;
  closeExitDialog();
  if (name === 'main') refreshContinue();
  if (name === 'setup') { el('setupSaveHint').hidden = lanSetup || !savedMatchInfo(); showCity(); }
  if (name === 'settings') refreshSettings();
  if (name === 'stats') renderStats();
  for (const [key, id] of Object.entries(SCREENS)) {
    if (key === name) fadeIn(el(id));
    else fadeOut(el(id));
  }
  if (name === 'setup') drawSetupIcons();      // بعد الظهور: الأيقونات بمقاسها الحقيقي
  if (name === 'store') showStore();           // وصور المتجر بمقاس خاناتها
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
  const groups = CITY_GROUPS;
  openPicker({
    title: 'اختر المدينة',
    groups,
    art: drawCardThumb,
    extras: [{ value: 'random', text: 'عشوائي' }, { value: 'host', text: 'مدينة المضيف' }],
    current: () => setup.city,
    pick: (city) => { setup.city = city; refresh(); },
    tabFor: (choice) => groups.indexOf(regionOf(groups, choice === 'host' ? hostCity(setup.slots[0].side) : choice)),
    aside: (node, choice) => {
      if (node.dataset.kind !== 'city') {
        node.dataset.kind = 'city';
        node.innerHTML = '<canvas id="pickerThumb"></canvas><span id="pickerThumbName" class="hint"></span>' +
                         '<small id="pickerFeature" class="hint"></small>';
      }
      const city = choice === 'host' ? hostCity(setup.slots[0].side) : choice;
      updateCityThumb(el('pickerThumb'), el('pickerThumbName'), city, isPickerOpen);
      const feature = CITY_FEATURES.desc[CITY_FEATURES.cities[city]];    // ميزة المدينة (القسم 3.11)
      el('pickerFeature').textContent = feature ? 'ميزتها: ' + feature : '';
      el('pickerFeature').hidden = !feature;
    },
    close: showCity
  });
}

// لوحة الأمم لخانة: تبويب لكل منطقة بعصاباتها ثم الكلاسيكية، وبجانب الخانة وصف المختارة
function openSidePicker(index) {
  const slot = setup.slots[index];
  pickSide('اختر الأمة — الخانة ' + (index + 1) + (index === 0 ? ' (أنت)' : ''), () => slot.side, (side) => {
    slot.side = side;
    descSlot = index;
    refresh();
    if (index === 0 && setup.city === 'host') showCity();
  }, showCity);                          // صورة المدينة "عشوائي" تعود للتبدل بعد الإغلاق
}

// لوحة الأمم نفسها لغير الخانات (المنضم في اللعب المحلي يختار أمته في غرفة الانتظار)
export function pickSide(title, current, pick, close) {
  openPicker({
    title,
    groups: SIDE_GROUPS,
    extras: [{ value: 'random', text: 'عشوائي' }],
    current,
    pick,
    aside: (node, side) => { node.dataset.kind = 'side'; node.textContent = sideDesc(side); },
    close
  });
}

function hostCity(side) {
  const nation = nationOf(side);
  return nation && CITIES.order.includes(nation.city) ? nation.city : 'random';
}

// --- لوحات خيارات المباراة (بطلب المستخدم): بنفس لوحة المدن، خانة واحدة بعناصر بأيقوناتها أو صورها،
// وبجانبها صورة المختار واسمه ووصفه ---
const single = (items) => [{ name: '', title: '', items }];

// العدد مع المعدود بالعربية: 1 لاعب، لاعبان، 3-10 لاعبين، 11 فأكثر لاعباً
function count(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  return n + ' ' + (n <= 10 ? few : many);
}
const minutesText = (n) => count(n, 'دقيقة', 'دقيقتان', 'دقائق', 'دقيقة');
const playersText = (n) => count(n, 'لاعب', 'لاعبان', 'لاعبين', 'لاعباً');

// معاينة لوحات الخيارات: صورة المختار (أو أيقونته)، واسمه، وسطور تصفه
function infoAside(node, draw, value, title, lines, wide = false) {
  if (node.dataset.kind !== 'info') {
    node.dataset.kind = 'info';
    node.innerHTML = '<canvas class="aside-art"></canvas><b class="aside-title"></b><div class="aside-lines"></div>';
  }
  const canvas = node.querySelector('canvas');
  canvas.classList.toggle('wide', wide);          // قبل الرسم: الصورة تُرسم بمقاس اللوحة
  draw(canvas, value);
  node.querySelector('.aside-title').textContent = title;
  const list = node.querySelector('.aside-lines');
  list.innerHTML = '';
  for (const line of lines) {
    const p = document.createElement('p');
    p.textContent = line;
    list.appendChild(p);
  }
}

// طور اللعب: الأطوار الستة، وتحتها خيارات الطور المختار فقط (القسم 9.5)
const MODE_OPTIONS = {
  points: [{ key: 'pointsMinutes', label: 'مدة المباراة (دقيقة)', values: GM.points.minutes, text: String }],
  king: [{ key: 'kingMinutes', label: 'زمن السيطرة على التلة للفوز (دقيقة)', values: GM.king.holdMinutes, text: String }],
  survival: [
    { key: 'allies', label: 'عدد الحلفاء من البوتات', values: GM.survival.allies, text: String },
    { key: 'survivalLevel', label: 'صعوبة الشرطة', values: GM.survival.levels, text: key => BOT[key].name }
  ]
};

function modeOptions(node, mode) {
  for (const option of MODE_OPTIONS[mode] || []) {
    const row = document.createElement('div');
    row.className = 'row';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = option.label;
    const list = document.createElement('div');
    list.className = 'options';
    for (const value of option.values) {
      const button = document.createElement('button');
      button.className = 'opt' + (setup[option.key] === value ? ' selected' : '');
      button.textContent = option.text(value);
      button.addEventListener('click', () => { sound('ui_tap'); setup[option.key] = value; refresh(); refreshPicker(); });
      list.appendChild(button);
    }
    row.append(label, list);
    node.appendChild(row);
  }
}

// سطر تحت اسم الطور في زره: خياراته المختارة، أو شرحه إن لم تكن له خيارات
function modeNote() {
  if (setup.mode === 'points') return 'مدة المباراة: ' + minutesText(setup.pointsMinutes);
  if (setup.mode === 'king') return 'السيطرة على التلة: ' + minutesText(setup.kingMinutes);
  if (setup.mode === 'survival') return 'الحلفاء: ' + setup.allies + ' • صعوبة الشرطة: ' + BOT[setup.survivalLevel].name;
  return GM[setup.mode].desc;
}

function openModePicker() {
  openPicker({
    title: 'اختر طور اللعب',
    groups: single(GM.order.filter(key => !lanSetup || NET.modes.includes(key))   // اللعب المحلي: أطواره فقط (القسم 16)
      .map(key => ({ value: key, text: GM[key].name, note: GM[key].short }))),
    icon: drawModeIcon,
    columns: 3,
    current: () => setup.mode,
    pick: (mode) => { setup.mode = mode; refresh(); },
    more: modeOptions,
    aside: (node, mode) => infoAside(node, drawModeIcon, mode, GM[mode].name, [GM[mode].desc]),
    close: showCity
  });
}

// حجم الخريطة: حد اللاعبين وعدد الأحياء المميزة ومراكز الشرطة (القسم 3.2)
function openSizePicker() {
  openPicker({
    title: 'اختر حجم الخريطة',
    groups: single(MAP_SIZE_KEYS.map(key => ({ value: key, text: MAP_SIZES[key].name, note: 'حتى ' + playersText(MAP_SIZES[key].maxPlayers) }))),
    icon: drawSizeIcon,
    columns: 3,
    current: () => setup.mapSize,
    pick: (key) => { setup.mapSize = key; refresh(); },
    aside: (node, key) => {
      const size = MAP_SIZES[key];
      infoAside(node, drawSizeIcon, key, 'خريطة ' + size.name, [
        'مدينة ' + size.n + '×' + size.n + ' مربعاً، حتى ' + playersText(size.maxPlayers) + '.',
        'فيها ' + count(size.specialDistricts, 'حي مميز', 'حيّان مميزان', 'أحياء مميزة', 'حياً مميزاً') +
          ' و' + count(size.policeStations, 'مركز شرطة', 'مركزا شرطة', 'مراكز شرطة', 'مركز شرطة') + '.'
      ]);
    },
    close: showCity
  });
}

// الحد الأقصى للوحدات: لكل لاعب، ومعه مجموع المدينة بعدد اللاعبين الحالي
function activePlayers() {
  return setup.mode === 'survival' ? 1 + setup.allies : setup.slots.filter(s => s.type !== 'closed').length;
}

function openUnitsPicker() {
  openPicker({
    title: 'الحد الأقصى للوحدات',
    groups: single(MAX_UNIT_CHOICES.map(v => ({ value: v, text: String(v), note: v === UNITS.maxUnitsDefault ? 'الافتراضي' : '' }))),
    icon: drawUnitsIcon,
    columns: 6,
    current: () => setup.maxUnits,
    pick: (v) => { setup.maxUnits = v; refresh(); },
    aside: (node, v) => {
      const players = activePlayers(), total = players * v;
      const lines = [
        'يشمل العاديين والمميزين والبطل، ويتوقف الظهور عند بلوغه.',
        'مع ' + playersText(players) + ': حتى ' + total + ' وحدة في المدينة.'
      ];
      if (total > COMBAT_REALISM.lod.crowdedAbove) lines.push('معارك ضخمة: أثقل على الجوالات الضعيفة.');
      infoAside(node, drawUnitsIcon, v, v + ' وحدة لكل لاعب', lines);
    },
    close: showCity
  });
}

// الطقس (القسم 10): صورة المدينة المختارة بكل طقس، وتأثيره على اللعب من أرقامه في config.js
const percentLess = (mul) => Math.round((1 - mul) * 100) + '%';

function weatherEffects(key) {
  const w = WEATHER[key], list = [];
  if (w.visionMul < 1) list.push('مدى رصد الوحدات أقل ' + percentLess(w.visionMul) + '.');
  if (w.speedMul < 1) list.push('حركة كل الوحدات أبطأ ' + percentLess(w.speedMul) + '.');
  if (w.rangedHitChance < 1) list.push('الرمي (حجارة، قوس، زجاجات) يصيب ' + Math.round(w.rangedHitChance * 100) + '% فقط.');
  return list.length ? list : ['بلا تأثير على اللعب.'];
}

function weatherShort(key) {
  if (key === 'random') return 'يُختار عند البدء';
  const w = WEATHER[key];
  if (w.visionMul < 1) return 'رؤية أقل ' + percentLess(w.visionMul);
  if (w.speedMul < 1) return 'حركة أبطأ ' + percentLess(w.speedMul);
  if (w.rangedHitChance < 1) return 'إصابة الرمي ' + Math.round(w.rangedHitChance * 100) + '%';
  return 'بلا تأثير';
}

// مدينة صور الطقس: المختارة، أو الظاهرة الآن في صورة "عشوائي"
function previewCity() {
  const city = setup.city === 'host' ? hostCity(setup.slots[0].side) : setup.city;
  if (CITIES.order.includes(city)) return city;
  return CITIES.order.includes(shownCity()) ? shownCity() : CITIES.order[0];
}

function openWeatherPicker() {
  const city = previewCity();
  const scene = (canvas, key) => {
    if (key !== 'random') { drawCardThumb(canvas, city, key); return; }
    stopCard(canvas);
    drawWeatherIcon(canvas, key);
  };
  openPicker({
    title: 'اختر الطقس',
    groups: single(WEATHER_KEYS.map(key => ({ value: key, text: WEATHER[key].name, note: weatherShort(key) }))),
    art: scene,
    columns: 4,
    extras: [{ value: 'random', text: 'عشوائي' }],
    current: () => setup.weather,
    pick: (key) => { setup.weather = key; refresh(); },
    aside: (node, key) => key === 'random'
      ? infoAside(node, scene, key, 'طقس عشوائي', ['يُختار عند بدء المباراة، ويبقى ثابتاً حتى نهايتها.'], true)
      : infoAside(node, scene, key, WEATHER[key].name, [...weatherEffects(key), 'المعاينة على مدينة ' + CITIES.short[city] + '.'], true),
    close: showCity
  });
}

// أيقونات أزرار الخيارات (تُعاد عند كل تغيير، وبعد ظهور القائمة بمقاسها الحقيقي)
function drawSetupIcons() {
  drawModeIcon(el('modeIcon'), setup.mode);
  drawSizeIcon(el('sizeIcon'), setup.mapSize);
  drawWeatherIcon(el('weatherIcon'), setup.weather);
  drawUnitsIcon(el('unitsIcon'), setup.maxUnits);
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

// --- صفوف الخيارات (شاشة معركة البوتات) ---
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
      if (index === 0 || slot.type === 'net') return;      // خانة صديق (اللعب المحلي): تبقى له ما دام متصلاً
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
      if (slot.type === 'net') { refresh(); return; }   // الصديق يختار أمته بنفسه: اللمس يعرض وصفها فقط
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
export function sideLabel(side) {
  const nation = nationOf(side);
  if (nation) return { text: nation.name, note: nation.gangName };
  if (GANGS[side]) return { text: GANGS[side].name, note: NATIONS.classicNote };
  return { text: 'عشوائي', note: '' };
}

// وصف الخيار: النمط القتالي، والسمة وضربة البطل للأمة
export function sideDesc(side) {
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
  // أزرار الخيارات: الاختيار الحالي وسطر تحته
  el('modeChoice').textContent = GM[setup.mode].name;
  el('modeNote').textContent = modeNote();
  // زر المدينة: الخيار ومنطقته (الاسم الكامل تحته من الصورة المصغرة)
  const cityGroup = regionOf(CITY_GROUPS, setup.city);
  el('cityChoice').textContent = setup.city === 'random' ? 'عشوائي' : setup.city === 'host' ? 'مدينة المضيف'
    : CITIES.short[setup.city] + (cityGroup ? ' • ' + cityGroup.name : '');
  const size = MAP_SIZES[setup.mapSize];
  el('sizeChoice').textContent = size.name;
  el('sizeNote').textContent = 'حتى ' + playersText(size.maxPlayers);
  el('weatherChoice').textContent = setup.weather === 'random' ? 'عشوائي' : WEATHER[setup.weather].name;
  el('weatherNote').textContent = weatherShort(setup.weather);
  el('unitsChoice').textContent = setup.maxUnits + ' وحدة';
  el('unitsNote').textContent = 'لكل لاعب';
  drawSetupIcons();

  const survival = setup.mode === 'survival';
  el('screenSetup').querySelector('.menu.setup').classList.toggle('survival', survival);

  const limit = MAP_SIZES[setup.mapSize].maxPlayers;
  el('slotsHint').textContent = survival
    ? 'اختر أمتك ولونك • الحلفاء من الخانات التالية'
    : lanSetup ? 'الخانة الأولى أنت • كل صديق ينضم يأخذ خانة بوت • الحد ' + limit + ' لاعبين'
    : 'الخانة الأولى أنت • الحد على هذه الخريطة ' + limit + ' لاعبين';
  el('lanHostInfo').hidden = !lanSetup;
  el('arenaRow').hidden = lanSetup;
  if (lanSetup) {
    const friends = setup.slots.filter(s => s.type === 'net').length;
    el('lanHostInfo').textContent = 'مباراة محلية باسم «' + lan.name + '»' +
      (lan.ips.length ? ' • عنوانك: ' + lan.ips.join(' أو ') : '') +
      (friends ? ' • انضم ' + playersText(friends) : ' • بانتظار الأصدقاء…');
  }

  for (const row of el('slots').children) {
    const index = Number(row.dataset.index);
    const slot = setup.slots[index];
    row.classList.toggle('closed', slot.type === 'closed');
    row.classList.toggle('net', slot.type === 'net');

    row.querySelector('.type').textContent = slot.type === 'net' ? slot.name : SLOT_TYPES[slot.type];
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
  if (lanSetup) broadcastLobby(lobbyView());
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

  if (lanSetup && !active.some(s => s.type === 'net')) return 'انتظر حتى ينضم صديق واحد على الأقل.';
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
  if (lanSetup) {
    // اللعب المحلي: أصحاب الخانات بترتيب لاعبي المباراة (رقم اتصال كل صديق، أو null للمضيف والبوتات)
    onStartLan(buildMatchSettings(), setup.slots.filter(s => s.type !== 'closed').map(s => s.type === 'net' ? s.peer : null));
  } else {
    saveSetup();
    onStartMatch(buildMatchSettings());
  }
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
    name: index === 0 ? (lanSetup ? lan.name : 'أنت') : slot.type === 'net' ? slot.name : 'بوت ' + index,
    ...resolveSide(slot.side),                   // {gang: النمط، nation: الأمة أو null}
    color: slot.color,
    isHuman: index === 0 || slot.type === 'net', // اللعب المحلي: كل صديق لاعب حقيقي على جهازه (القسم 16)
    team: survival ? 1 : slot.team,              // الصمود: الجميع فريق واحد
    difficulty: slot.type === 'net' ? 'medium' : slot.difficulty   // الصديق إن غادر يقوده بوت متوسط
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

// --- اللعب المحلي (القسم 16): المضيف يعدّ المباراة في هذه القائمة نفسها، وكل صديق ينضم يأخذ خانة ---
let lanSetup = false;
export const isLanSetup = () => lanSetup;

export function openLanSetup() {
  lanSetup = true;
  if (!NET.modes.includes(setup.mode)) setup.mode = NET.modes[0];
  syncLanSlots();
  showScreen('setup');
}

// خانة صديق غادر تعود كما كانت قبله (بوت أو مغلقة)
function freeNetSlot(slot) {
  slot.type = slot.was || 'closed';
  slot.peer = null;
}

// خروج المضيف من قائمة الإعداد: خانات الأصدقاء تعود كما كانت
export function closeLanSetup() {
  lanSetup = false;
  for (const slot of setup.slots) if (slot.type === 'net') freeNetSlot(slot);
  refresh();
}

// المنضمون ← الخانات: الجديد يأخذ أول خانة بوت ثم أول مغلقة، ومن غادر تعود خانته، والأمة اختيار صاحبها
export function syncLanSlots() {
  if (!lanSetup) return;
  const peers = lanPeers();
  const ids = new Set(peers.map(p => p.id));
  for (const slot of setup.slots) {
    if (slot.type === 'net' && !ids.has(slot.peer)) freeNetSlot(slot);
  }
  for (const peer of peers) {
    let slot = setup.slots.find(s => s.type === 'net' && s.peer === peer.id);
    if (!slot) {
      slot = setup.slots.find((s, k) => k > 0 && s.type === 'bot') || setup.slots.find((s, k) => k > 0 && s.type === 'closed');
      if (!slot) continue;
      slot.was = slot.type;
      slot.type = 'net';
      slot.peer = peer.id;
    }
    slot.name = peer.name;
    if (SIDE_CHOICES.includes(peer.side)) slot.side = peer.side;
  }
  refresh();
}

// هل بقيت خانة لصديق جديد؟
export const lanHasSeat = () => setup.slots.some((s, k) => k > 0 && s.type !== 'net');

// وصف الغرفة الذي يراه المنضمون في غرفة الانتظار
function lobbyView() {
  return {
    mode: setup.mode, city: setup.city, mapSize: setup.mapSize,
    weather: setup.weather, maxUnits: setup.maxUnits,
    players: setup.slots.filter(s => s.type !== 'closed').map((s, k) => ({
      kind: k === 0 ? 'host' : s.type, name: k === 0 ? lan.name : s.type === 'net' ? s.name : 'بوت ' + BOT[s.difficulty].name,
      side: s.side, color: s.color, team: s.team, peer: s.type === 'net' ? s.peer : null
    }))
  };
}
