// القائمة الرئيسية وقائمة الإعداد وقائمة الإيقاف وتبديل الشاشات
import {
  MAP_SIZES, PLAYER_COLORS, GANGS, GANG_IDS, BOT, BOT_LEVELS,
  WEATHER, WEATHER_KEYS, UNITS, MATCH_DEFAULTS
} from '../config.js';

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

export function setupMenus(handlers) {
  onStartMatch = handlers.startMatch;
  onOpenGame = handlers.openGame;
  setup.slots = defaultSlots();

  el('btnPlay').addEventListener('click', () => showScreen('setup'));
  el('btnBackToMain').addEventListener('click', () => showScreen('main'));
  el('btnStart').addEventListener('click', startPressed);

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
}

// --- تبديل الشاشات ---
export function showScreen(name) {
  el('screenMain').hidden = name !== 'main';
  el('screenSetup').hidden = name !== 'setup';
  el('screenGame').hidden = name !== 'game';
  if (name === 'game' && onOpenGame) onOpenGame();
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
    button.addEventListener('click', () => onPick(value));
    container.appendChild(button);
  }
  container.dataset.getter = containerId;
  container._getCurrent = getCurrent;
}

function refreshOptions(containerId) {
  const container = el(containerId);
  const current = String(container._getCurrent());
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

    row.appendChild(cell('name', index === 0 ? 'أنت' : 'خانة ' + (index + 1), null));

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
  if (onClick) node.addEventListener('click', onClick);
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
  refreshOptions('optMapSize');
  refreshOptions('optMaxUnits');
  refreshOptions('optWeather');

  const limit = MAP_SIZES[setup.mapSize].maxPlayers;
  el('slotsHint').textContent = 'الخانة الأولى أنت • الحد على هذه الخريطة ' + limit + ' لاعبين';

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
  const active = setup.slots.filter(s => s.type !== 'closed');
  const limit = MAP_SIZES[setup.mapSize].maxPlayers;

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
  const error = validate();
  const errorNode = el('setupError');
  if (error) {
    errorNode.textContent = error;
    errorNode.hidden = false;
    return;
  }
  errorNode.hidden = true;
  onStartMatch(buildMatchSettings());
}

// يحول خيارات القائمة إلى إعدادات مباراة
export function buildMatchSettings() {
  const players = setup.slots
    .filter(s => s.type !== 'closed')
    .map((slot, index) => ({
      name: slot.type === 'human' ? 'أنت' : 'بوت ' + index,
      gang: slot.gang === 'random' ? GANG_IDS[Math.floor(Math.random() * GANG_IDS.length)] : slot.gang,
      color: slot.color,
      isHuman: slot.type === 'human',
      team: slot.team,
      difficulty: slot.difficulty
    }));

  return {
    mapSize: setup.mapSize,
    maxUnits: setup.maxUnits,
    weather: setup.weather === 'random'
      ? WEATHER_KEYS[Math.floor(Math.random() * WEATHER_KEYS.length)]
      : setup.weather,
    players
  };
}
