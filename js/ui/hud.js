// أزرار الشاشة وشريط معلومات المباراة
import { WEATHER, WEATHER_KEYS } from '../config.js';
import { clearSelection, selectAllUnitsOf, resetMatch, districtsOwnedBy } from '../state.js';
import { resetParticles } from '../render/weather.js';

const el = (id) => document.getElementById(id);

export function setupHud(state) {
  const btnMode = el('btnMode');
  btnMode.addEventListener('click', () => {
    state.inputMode = state.inputMode === 'pan' ? 'select' : 'pan';
    state.selectionBox = null;
    btnMode.textContent = state.inputMode === 'pan' ? 'تحريك الخريطة' : 'تحديد الجنود';
    btnMode.classList.toggle('on', state.inputMode === 'select');
  });

  el('btnAll').addEventListener('click', () => selectAllUnitsOf(state, state.humanId));
  el('btnClear').addEventListener('click', () => clearSelection(state));

  // أزرار تجريبية للمرحلة 1 (تُستبدل بقائمة الإعداد في المرحلة 6)
  const btnWeather = el('btnWeather');
  btnWeather.addEventListener('click', () => {
    const next = (WEATHER_KEYS.indexOf(state.weather) + 1) % WEATHER_KEYS.length;
    state.weather = WEATHER_KEYS[next];
    resetParticles(state.weather, state.view);
    btnWeather.textContent = 'الطقس: ' + WEATHER[state.weather].name;
  });

  el('btnNewMap').addEventListener('click', () => { resetMatch(state); hideEndScreen(); });
  el('btnRestart').addEventListener('click', () => { resetMatch(state); hideEndScreen(); });
}

function hideEndScreen() {
  el('endScreen').hidden = true;
  last.result = null;
}

// إشعار قصير عند الاستيلاء على حي
function updateNotice(state) {
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

  updateNotice(state);
  updateEndScreen(state);
}
