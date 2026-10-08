// نقطة البداية: القوائم، دورة حياة المباراة، وحلقة اللعبة
// منطق اللعبة بخطوة زمنية ثابتة (20 تحديثاً/ث)، والرسم كل إطار مع تنعيم المواقع
import { MATCH_DEFAULTS, TICK_MS, CITY_CACHE } from './config.js';
import { paceFrame, paceWork } from './pacing.js';
import { createMatch, resetMatch } from './state.js';
import { updateMatch } from './game/loop.js';
import { render, resizeCanvas, clampCamera, warmCity } from './render/renderer.js';
import { updateParticles, resetParticles } from './render/weather.js';
import { setupInput } from './ui/input.js';
import {
  setupHud, updateHud, reportFrame,
  openPause, closePause, isPauseOpen, isEndOpen, leaveToMain
} from './ui/hud.js';
import { setupPower, updatePower } from './ui/power.js';
import { setupGroups, updateGroups, hudRects } from './ui/groups.js';
import {
  setupMenus, showScreen, currentScreen,
  openExitDialog, closeExitDialog, isExitDialogOpen
} from './ui/menus.js';
import { setupMenuScene, menuSceneFrame } from './ui/menuScene.js';
import { initSound, startMusic } from './audio/sound.js';
import { saveMatch, loadMatch, clearSavedMatch, canSaveMatch } from './matchSave.js';
import { onBackButton, keepScreenAwake } from './platform.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// الصوت: يُهيّأ الآن ويُفتح عند أول لمسة (القسم 13.5)
initSound();

// مباراة مبدئية حتى تكون هناك حالة صالحة قبل اختيار الإعدادات
const state = createMatch(MATCH_DEFAULTS);

setupInput(canvas, state);
setupHud(state);
setupPower(state);
setupGroups(state);
// الخلفية الحية للقوائم: مدينة مستقلة على لوحتها الخاصة (القسم 12.0)
setupMenuScene(document.getElementById('menuBg'), document.getElementById('menuBack'));
setupMenus({
  // "ابدأ" من قائمة الإعداد
  startMatch(settings) {
    // مباراة جديدة تحل محل المحفوظة؛ أما ساحة التجربة فلا تُحفظ ولا تمس المحفوظة
    if (!settings.arena) clearSavedMatch();
    resetMatch(state, settings);
    state.running = true;
    showScreen('game');
  },
  // "متابعة المباراة": تعود من حيث توقفت (false إن كان الحفظ تالفاً)
  continueMatch() {
    if (!loadMatch(state)) return false;
    state.running = true;
    showScreen('game');
    startMusic();
    return true;
  },
  // تُستدعى عند ظهور شاشة المباراة: اللوحة تأخذ مقاسها الآن
  openGame() {
    resizeCanvas(canvas, state);
    state.hudAvoid = hudRects();     // أسهم التحذير تتجنب عناصر الواجهة
    clampCamera(state);
    resetParticles(state.weather, state.view);
  }
});

showScreen('main');

// تصغير التطبيق أو إغلاقه أو مغادرة الصفحة: تُحفظ المباراة الجارية للعودة إليها
function saveOnLeave() {
  if (document.visibilityState === 'hidden' && canSaveMatch(state)) saveMatch(state);
}
document.addEventListener('visibilitychange', saveOnLeave);
window.addEventListener('pagehide', () => { if (canSaveMatch(state)) saveMatch(state); });

// زر الرجوع في أندرويد: أثناء المباراة يفتح الإيقاف، وفي القوائم يرجع خطوة،
// وفي القائمة الرئيسية يسأل "هل تريد الخروج؟" (القسم 2.1). في المتصفح لا يفعل شيئاً.
onBackButton(() => {
  if (isExitDialogOpen()) { closeExitDialog(); return; }

  if (currentScreen() === 'game') {
    if (isEndOpen()) { leaveToMain(state); return; }    // شاشة النهاية: رجوع للقائمة الرئيسية
    if (isPauseOpen()) { closePause(state); return; }   // الإيقاف مفتوح: رجوع خطوة
    openPause(state);                                   // أثناء المباراة: فتح الإيقاف
    return;
  }

  if (currentScreen() !== 'main') { showScreen('main'); return; }   // الإعداد والإعدادات والإحصائيات
  openExitDialog();                                     // القائمة الرئيسية
});

// تحديث منطقي واحد بخطوة ثابتة
function update() {
  if (state.paused || state.matchResult) return;   // الإيقاف ونهاية المباراة يوقفان اللعب
  updateMatch(state);
}

let lastTime = performance.now();
let hudMeasuredAt = 0;
let accumulator = 0;
let warmedMap = null;      // آخر خريطة بدأ تجهيز مدينتها
let warmUntil = 0;         // أقصى وقت لتجهيز المدينة قبل أن تبدأ المباراة على أي حال

function loop(now) {
  // إيقاع الإطارات (js/pacing.js): الإطار المتخطى لا يحدّث ولا يرسم، ووقته يُحسب في الإطار التالي
  if (!paceFrame(now, state.running && !state.paused && !state.matchResult && !warmUntil)) {
    requestAnimationFrame(loop);
    return;
  }
  const workStart = performance.now();
  const frameMs = Math.min(250, Math.max(0, now - lastTime));
  lastTime = now;

  // الشاشة تبقى صاحية أثناء اللعب فقط، وتنام في القوائم وعند الإيقاف (القسم 2.1)
  keepScreenAwake(state.running && !state.paused && !state.matchResult);

  if (!state.running) {          // داخل القوائم: لا تحديث للمباراة، والخلفية الحية وحدها تتحرك
    accumulator = 0;
    menuSceneFrame(now);
    requestAnimationFrame(loop);
    return;
  }

  // إعادة تهيئة اللوحة عند تغير حجم الشاشة بدون إعادة تشغيل المباراة
  if (canvas.clientWidth && (canvas.clientWidth !== state.view.w || canvas.clientHeight !== state.view.h)) {
    resizeCanvas(canvas, state);
    resetParticles(state.weather, state.view);
    clampCamera(state);
  }
  // عناصر الواجهة تتغير (شريط الطور، طي شريط القوة): نعيد قياسها مرتين في الثانية
  if (now - hudMeasuredAt > 500) { state.hudAvoid = hudRects(); hudMeasuredAt = now; }

  // خريطة جديدة (بداية أو إعادة أو متابعة): المدينة الظاهرة تُجهَّز على دفعات في الإطارات الأولى
  // والمباراة لا تتقدم حتى تكتمل (أو حتى الحد الأقصى)، ولا يُعوَّض وقت التجهيز لعباً
  if (state.map !== warmedMap && state.view.w) {
    warmedMap = state.map;
    warmUntil = now + CITY_CACHE.warmMaxMs;
  }
  if (warmUntil) {
    const ready = warmCity(ctx, state, CITY_CACHE.warmBudgetMs);
    render(ctx, state, 0, 0);
    updateHud(state);
    if (ready || performance.now() > warmUntil) {
      warmUntil = 0;
      lastTime = performance.now();
      accumulator = 0;
    }
    requestAnimationFrame(loop);
    return;
  }

  accumulator += frameMs;
  let steps = 0;
  while (accumulator >= TICK_MS && steps < 5) {   // حد أقصى للتحديثات المتراكمة
    update();
    accumulator -= TICK_MS;
    steps++;
  }
  if (accumulator > TICK_MS * 5) accumulator = 0;

  updateParticles(state.weather, state.view, frameMs / 1000);
  render(ctx, state, accumulator / TICK_MS);
  updateHud(state);
  updatePower(state);          // شريط القوة يتحدث كل ثانية لا كل إطار
  updateGroups(state, frameMs); // أعداد المجموعات وانتقال الكاميرا إليها
  reportFrame(frameMs);
  paceWork(performance.now() - workStart);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
