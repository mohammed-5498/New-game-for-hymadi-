// أزرار المباراة، شريط المعلومات، قائمة الإيقاف، وشاشة النهاية
import { WEATHER, PERFORMANCE } from '../config.js';
import { clearSelection, selectAllUnitsOf, resetMatch, districtsOwnedBy } from '../state.js';
import { showScreen } from './menus.js';

const el = (id) => document.getElementById(id);

let fpsVisible = false;
let infoTaps = 0;

// مؤشر الإطارات: يُحدَّث من حلقة اللعبة
export function reportFrame(frameMs) {
  if (!fpsVisible) return;
  fpsSamples.push(frameMs);
  if (fpsSamples.length < 20) return;
  const average = fpsSamples.reduce((sum, ms) => sum + ms, 0) / fpsSamples.length;
  fpsSamples.length = 0;
  el('fps').textContent = Math.round(1000 / average) + ' إطار/ث';
}
const fpsSamples = [];

export function setupHud(state) {
  // لمس شريط المعلومات 3 مرات يُظهر مؤشر الإطارات أو يخفيه
  el('info').addEventListener('click', () => {
    infoTaps++;
    if (infoTaps < PERFORMANCE.fpsTaps) return;
    infoTaps = 0;
    fpsVisible = !fpsVisible;
    el('fps').hidden = !fpsVisible;
  });

  const btnMode = el('btnMode');
  btnMode.addEventListener('click', () => {
    state.inputMode = state.inputMode === 'pan' ? 'select' : 'pan';
    state.selectionBox = null;
    btnMode.textContent = state.inputMode === 'pan' ? 'تحريك الخريطة' : 'تحديد الجنود';
    btnMode.classList.toggle('on', state.inputMode === 'select');
  });

  el('btnAll').addEventListener('click', () => selectAllUnitsOf(state, state.humanId));
  el('btnClear').addEventListener('click', () => clearSelection(state));

  // --- قائمة الإيقاف: اللعبة تتوقف بالكامل أثناء فتحها ---
  el('btnPause').addEventListener('click', () => {
    if (state.matchResult) return;
    state.paused = true;
    el('pauseMenu').hidden = false;
  });

  el('btnResume').addEventListener('click', () => {
    state.paused = false;
    el('pauseMenu').hidden = true;
  });

  el('btnRestartMatch').addEventListener('click', () => {
    resetMatch(state);                 // نفس الإعدادات
    closeOverlays();
  });

  el('btnQuitToMain').addEventListener('click', () => leaveToMain(state));

  // --- شاشة النهاية ---
  el('btnRestart').addEventListener('click', () => {
    resetMatch(state);
    closeOverlays();
  });

  el('btnEndToMain').addEventListener('click', () => leaveToMain(state));
}

function closeOverlays() {
  el('pauseMenu').hidden = true;
  el('endScreen').hidden = true;
  last.result = null;
}

function leaveToMain(state) {
  state.running = false;
  state.paused = false;
  closeOverlays();
  showScreen('main');
}

// إشعار قصير عند الاستيلاء على حي
function updateNoticeBox(state) {
  const notice = el('notice');
  const text = state.notice ? state.notice.text : '';
  if (text === last.notice) return;
  last.notice = text;
  notice.hidden = !text;
  notice.textContent = text;
  notice.classList.toggle('mine', !!(state.notice && state.notice.mine));
}

// شاشة النهاية: فزت أو خسرت مع الإحصائيات
function updateEndScreen(state) {
  const result = state.matchResult;
  if (result === last.result) return;
  last.result = result;

  const screen = el('endScreen');
  if (!result) { screen.hidden = true; return; }

  const minutes = Math.floor(result.duration / 60);
  const seconds = Math.floor(result.duration % 60);
  el('endTitle').textContent = result.won ? 'فزت' : 'خسرت';
  el('endStats').innerHTML = [
    'مدة المباراة: ' + minutes + ':' + String(seconds).padStart(2, '0'),
    'أكبر عدد أحياء: ' + result.maxDistricts,
    'أعداء قتلتهم: ' + result.kills,
    'وحداتك التي ماتت: ' + result.losses
  ].map(line => '<li>' + line + '</li>').join('');
  screen.hidden = false;
}

// تحديث شريط المعلومات (بدون لمس DOM إلا عند تغير القيم)
const last = { sel: -1, units: -1, districts: -1, weather: '', notice: '', result: null };

export function updateHud(state) {
  let selected = 0, playerUnitCount = 0;
  for (const unit of state.units) {
    if (unit.state === 'dead') continue;
    if (unit.selected) selected++;
    if (unit.playerId === state.humanId) playerUnitCount++;
  }
  const districts = districtsOwnedBy(state, state.humanId);

  if (selected !== last.sel) {
    last.sel = selected;
    el('infoSel').textContent = 'محدد: ' + selected;
  }
  if (playerUnitCount !== last.units) {
    last.units = playerUnitCount;
    el('infoUnits').textContent = playerUnitCount + '/' + state.maxUnits;
  }
  if (districts !== last.districts) {
    last.districts = districts;
    el('infoDistricts').textContent = 'أحياء: ' + districts;
  }
  if (state.weather !== last.weather) {
    last.weather = state.weather;
    el('infoWeather').textContent = WEATHER[state.weather].name;
  }

  updateNoticeBox(state);
  updateEndScreen(state);
}
