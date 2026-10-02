// القوائم (القسم 12): الرئيسية، الإعداد، الإعدادات، الإحصائيات، سؤال الخروج، وتبديل الشاشات
import {
  MAP_SIZES, PLAYER_COLORS, GANGS, GANG_IDS, BOT, BOT_LEVELS,
  WEATHER, WEATHER_KEYS, UNITS, MATCH_DEFAULTS, AUDIO, UI, gameModes as GM
} from '../config.js';
import { sound, audioSettings, setAudioSettings, startMusic } from '../audio/sound.js';
import { isNativeApp, exitApp } from '../platform.js';
import { getPref, setPref } from '../prefs.js';
import { loadStats, favoriteGang } from '../stats.js';
import { savedMatchInfo } from '../matchSave.js';
import { fadeIn, fadeOut, isShown } from './transition.js';
import { showMenuScene, hideMenuScene } from './menuScene.js';

const el = (id) => document.getElementById(id);

const MAP_SIZE_KEYS = ['small', 'medium', 'large'];
const MAX_UNIT_CHOICES = [30, 50, 100, 150, 200, 250];
const WEATHER_CHOICES = [...WEATHER_KEYS, 'random'];
const GANG_CHOICES = [...GANG_IDS, 'random'];
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
  maxUnits: UNITS.maxUnitsDefault,
  weather: 'day',
  slots: []
};

function defaultSlots() {
  const slots = [];
  for (let k = 0; k < MAX_SLOTS; k++) {
    slots.push({
      type: k === 0 ? 'human' : (k < 4 ? 'bot' : 'closed'),
      gang: GANG_IDS[k % GANG_IDS.length],
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

  buildOptions('optMaxUnits', MAX_UNIT_CHOICES, value => String(value),
    () => setup.maxUnits, value => { setup.maxUnits = value; refresh(); });

  buildOptions('optWeather', WEATHER_CHOICES,
    key => key === 'random' ? 'عشوائي' : WEATHER[key].name,
    () => setup.weather, key => { setup.weather = key; refresh(); });

  buildSlots();
  refresh();
  setupSettings();
}

// --- تبديل الشاشات بتلاشٍ قصير (القسم 12.0) ---
const SCREENS = {
  main: 'screenMain', setup: 'screenSetup', settings: 'screenSettings',
  stats: 'screenStats', game: 'screenGame'
};

let screen = 'main';
export const currentScreen = () => screen;

export function showScreen(name) {
  screen = name;
  closeExitDialog();
  if (name === 'main') refreshContinue();
  if (name === 'setup') el('setupSaveHint').hidden = !savedMatchInfo();
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
    ['عصابتك المفضلة', gang && GANGS[gang] ? GANGS[gang].name : '—']
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
  if (MAX_UNIT_CHOICES.includes(saved.maxUnits)) setup.maxUnits = saved.maxUnits;
  if (WEATHER_CHOICES.includes(saved.weather)) setup.weather = saved.weather;
  if (!Array.isArray(saved.slots)) return;

  saved.slots.slice(0, MAX_SLOTS).forEach((s, k) => {
    if (!s || typeof s !== 'object') return;
    const slot = setup.slots[k];
    if (k > 0 && (s.type === 'bot' || s.type === 'closed')) slot.type = s.type;
    if (GANG_CHOICES.includes(s.gang)) slot.gang = s.gang;
    if (PLAYER_COLORS.some(c => c.id === s.color)) slot.color = s.color;
    if (TEAM_CHOICES.includes(s.team)) slot.team = s.team;
    if (BOT_LEVELS.includes(s.difficulty)) slot.difficulty = s.difficulty;
  });
}

function saveSetup() {
  try { localStorage.setItem(UI.setupKey, JSON.stringify(setup)); } catch { /* لا تخزين: يبقى للجلسة */ }
}

// --- صفوف الخيارات (حجم الخريطة، الحد الأقصى، الطقس) ---
function buildOptions(containerId, values, label, getCurrent, onPick) {
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

function refreshOptions(containerId) {
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

    row.appendChild(cell('gang', '', () => {
      if (openIfClosed()) return;
      slot.gang = next(GANG_CHOICES, slot.gang);
      refresh();
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
  for (const row of document.querySelectorAll('#screenSetup .row[data-mode]')) {
    row.hidden = row.dataset.mode !== setup.mode;
  }
  const survival = setup.mode === 'survival';
  el('screenSetup').querySelector('.menu.setup').classList.toggle('survival', survival);

  const limit = MAP_SIZES[setup.mapSize].maxPlayers;
  el('slotsHint').textContent = survival
    ? 'اختر عصابتك ولونك • الحلفاء من الخانات التالية'
    : 'الخانة الأولى أنت • الحد على هذه الخريطة ' + limit + ' لاعبين';

  for (const row of el('slots').children) {
    const index = Number(row.dataset.index);
    const slot = setup.slots[index];
    row.classList.toggle('closed', slot.type === 'closed');

    row.querySelector('.type').textContent = SLOT_TYPES[slot.type];
    row.querySelector('.gang').textContent = slot.gang === 'random' ? 'عشوائي' : GANGS[slot.gang].name;
    row.querySelector('.team').textContent = slot.team === 0 ? 'بدون' : 'فريق ' + slot.team;
    row.querySelector('.difficulty').textContent = slot.type === 'bot' ? BOT[slot.difficulty].name : '—';

    const colorCell = row.querySelector('.color');
    const color = PLAYER_COLORS.find(c => c.id === slot.color);
    colorCell.style.background = color.hex;
    colorCell.title = color.name;
  }

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
    gang: slot.gang === 'random' ? GANG_IDS[Math.floor(Math.random() * GANG_IDS.length)] : slot.gang,
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
    maxUnits: setup.maxUnits,
    weather: setup.weather === 'random'
      ? WEATHER_KEYS[Math.floor(Math.random() * WEATHER_KEYS.length)]
      : setup.weather,
    players
  };
}
