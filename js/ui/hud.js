// أزرار المباراة، شريط المعلومات، قائمة الإيقاف، وشاشة النهاية
import { WEATHER, PERFORMANCE, UI } from '../config.js';
import { clearSelection, selectAllUnitsOf, resetMatch, districtsOwnedBy } from '../state.js';
import { sound, startMusic, stopMusic } from '../audio/sound.js';
import { showScreen, buildMatchSettings, fillStatCards } from './menus.js';
import { fadeIn, fadeOut, isShown } from './transition.js';
import { recordMatch } from '../stats.js';
import { saveMatch, clearSavedMatch } from '../matchSave.js';
import { modeBar, modeExtras } from '../game/modes.js';

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

// تبديل وضع الإصبع الواحد مع تحديث شكل الزر
// (يستعمله الزر نفسه، والرجوع التلقائي بعد التحديد في input.js)
export function setInputMode(state, mode) {
  state.inputMode = mode;
  state.selectionBox = null;
  const btnMode = el('btnMode');
  btnMode.textContent = mode === 'pan' ? 'تحريك الخريطة' : 'تحديد الجنود';
  btnMode.classList.toggle('on', mode === 'select');
}

export function setupHud(state) {
  // لمس شريط المعلومات 3 مرات: وضع التفاصيل (مؤشر الإطارات واسم حالة كل وحدة)
  el('info').addEventListener('click', () => {
    infoTaps++;
    if (infoTaps < PERFORMANCE.fpsTaps) return;
    infoTaps = 0;
    fpsVisible = !fpsVisible;
    el('fps').hidden = !fpsVisible;
    state.debugView = fpsVisible;      // وضع التفاصيل: اسم الحالة فوق كل وحدة
  });

  el('btnMode').addEventListener('click', () => {
    sound('ui_tap');
    setInputMode(state, state.inputMode === 'pan' ? 'select' : 'pan');
  });

  el('btnAll').addEventListener('click', () => { sound('select'); selectAllUnitsOf(state, state.humanId); });
  el('btnClear').addEventListener('click', () => { sound('ui_tap'); clearSelection(state); });

  // --- قائمة الإيقاف: اللعبة تتوقف بالكامل أثناء فتحها ---
  el('btnPause').addEventListener('click', () => openPause(state));
  el('btnResume').addEventListener('click', () => closePause(state));

  el('btnRestartMatch').addEventListener('click', () => {
    sound('ui_tap');
    clearSavedMatch();                 // البداية من جديد تحل محل المحفوظة
    resetMatch(state);                 // نفس الإعدادات
    startMusic();
    closeOverlays();
  });

  el('btnQuitToMain').addEventListener('click', () => leaveToMain(state));

  // --- شاشة النهاية ---
  // "مباراة جديدة": نفس اختيارات قائمة الإعداد، و"عشوائي" يُسحب من جديد
  el('btnRestart').addEventListener('click', () => {
    sound('ui_tap');
    clearSavedMatch();
    resetMatch(state, state.settings.arena ? state.settings : buildMatchSettings());
    startMusic();
    closeOverlays();
  });

  el('btnEndToMain').addEventListener('click', () => leaveToMain(state));
}

// فتح وإغلاق قائمة الإيقاف: يستعملهما الزر وزر الرجوع في أندرويد (القسم 2.1)
export function openPause(state) {
  if (state.matchResult || !state.running) return false;
  if (isPauseOpen()) return false;
  sound('ui_tap');
  stopMusic();                         // الموسيقى تصمت أثناء الإيقاف
  state.paused = true;
  fadeIn(el('pauseMenu'));
  // نقطة حفظ: اللعبة متوقفة فلا يُلاحظ زمن الحفظ، وننتظر انتهاء ظهور القائمة حتى لا يتقطع
  setTimeout(() => { if (state.paused) saveMatch(state); }, UI.fadeMs + 30);
  return true;
}

export function closePause(state) {
  if (!isPauseOpen()) return false;
  sound('ui_tap');
  startMusic();
  state.paused = false;
  fadeOut(el('pauseMenu'));
  return true;
}

export const isPauseOpen = () => isShown(el('pauseMenu'));
export const isEndOpen = () => isShown(el('endScreen'));

function closeOverlays() {
  fadeOut(el('pauseMenu'));
  fadeOut(el('endScreen'));
  last.result = null;
}

export function leaveToMain(state) {
  sound('ui_tap');
  saveMatch(state);                   // المباراة الجارية تبقى للعودة إليها (المنتهية لا تُحفظ)
  stopMusic();                        // لا موسيقى داخل القوائم
  state.running = false;
  state.paused = false;
  closeOverlays();
  showScreen('main');
}

// شريط الطور أعلى الوسط (القسم 9.5): لا نلمس DOM إلا حين يتغير ما فيه
function updateModeBar(state) {
  const bar = state.matchResult ? null : modeBar(state);
  const signature = bar ? bar.text + '|' + !!bar.alarm + '|' + (bar.bars || []).map(b => b.color + b.ratio.toFixed(3) + b.me).join(',') : '';
  if (signature === last.modeBar) return;
  last.modeBar = signature;

  const node = el('modeBar');
  node.hidden = !bar;
  if (!bar) { el('notice').style.top = ''; return; }
  el('modeText').textContent = bar.text;
  node.classList.toggle('alarm', !!bar.alarm);

  const tracks = el('modeBars');
  const list = bar.bars || [];
  if (tracks.children.length !== list.length) {
    tracks.innerHTML = '';
    for (let k = 0; k < list.length; k++) {
      const track = document.createElement('div');
      track.className = 'mode-track';
      track.appendChild(document.createElement('div')).className = 'mode-fill';
      tracks.appendChild(track);
    }
  }
  list.forEach((b, k) => {
    const track = tracks.children[k];
    track.classList.toggle('me', !!b.me);
    track.firstChild.style.background = b.color;
    track.firstChild.style.width = (Math.min(1, b.ratio) * 100).toFixed(1) + '%';
  });
  // الإشعار القصير ينزل تحت الشريط حتى لا يتداخلا
  el('notice').style.top = (node.offsetTop + node.offsetHeight + 8) + 'px';
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

// شاشة النهاية: فزت أو خسرت مع إحصائيات المباراة (القسم 12.5)
function updateEndScreen(state) {
  const result = state.matchResult;
  if (result === last.result) return;
  last.result = result;

  const screen = el('endScreen');
  if (!result) { fadeOut(screen); return; }

  const minutes = Math.floor(result.duration / 60);
  const seconds = Math.floor(result.duration % 60);
  el('endTitle').textContent = result.won ? 'فزت' : 'خسرت';
  el('endReason').textContent = result.reason || '';          // سبب النهاية (القسم 9.5.0)
  screen.classList.toggle('won', result.won);
  fillStatCards(el('endStats'), [
    ['مدة المباراة', minutes + ':' + String(seconds).padStart(2, '0')],
    ['أكبر عدد أحياء', result.maxDistricts],
    ['أعداء قتلتهم', result.kills],
    ['وحداتك التي ماتت', result.losses],
    ...modeExtras(state)                                        // إحصائيات الطور
  ]);
  fadeIn(screen);

  clearSavedMatch();                  // انتهت: لا شيء لمتابعته
  // تُضاف للإحصائيات الدائمة مرة واحدة لكل مباراة (ساحة التجربة لا تُحسب)
  const human = state.players[state.humanId];
  // (والصمود ضد الشرطة له رقمه القياسي الخاص: لا يُحسب خسارة في الإحصائيات)
  if (human && !state.settings.arena && state.mode !== 'survival') recordMatch(result, human.gang);
}

// تحديث شريط المعلومات (بدون لمس DOM إلا عند تغير القيم)
const last = { sel: -1, units: -1, max: -1, districts: -1, weather: '', notice: '', result: null, modeBar: null };

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
  // مباراة جديدة بحد أقصى مختلف تحدّث النص ولو تساوى عدد الوحدات
  if (playerUnitCount !== last.units || state.maxUnits !== last.max) {
    last.units = playerUnitCount;
    last.max = state.maxUnits;
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

  updateModeBar(state);
  updateNoticeBox(state);
  updateEndScreen(state);
}
