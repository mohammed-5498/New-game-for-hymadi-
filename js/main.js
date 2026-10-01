// نقطة البداية: القوائم، دورة حياة المباراة، وحلقة اللعبة
// منطق اللعبة بخطوة زمنية ثابتة (20 تحديثاً/ث)، والرسم كل إطار مع تنعيم المواقع
import { MATCH_DEFAULTS, TICK_MS } from './config.js';
import { createMatch, resetMatch } from './state.js';
import { updateMatch } from './game/loop.js';
import { render, resizeCanvas, clampCamera } from './render/renderer.js';
import { updateParticles, resetParticles } from './render/weather.js';
import { setupInput } from './ui/input.js';
import {
  setupHud, updateHud, reportFrame,
  openPause, closePause, isPauseOpen, isEndOpen, leaveToMain
} from './ui/hud.js';
import { setupPower, updatePower } from './ui/power.js';
import {
  setupMenus, showScreen, currentScreen,
  openExitDialog, closeExitDialog, isExitDialogOpen
} from './ui/menus.js';
import { setupMenuScene, menuSceneFrame } from './ui/menuScene.js';
import { initSound } from './audio/sound.js';
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
// الخلفية الحية للقوائم: مدينة مستقلة على لوحتها الخاصة (القسم 12.0)
setupMenuScene(document.getElementById('menuBg'), document.getElementById('menuBack'));
setupMenus({
  // "ابدأ" من قائمة الإعداد
  startMatch(settings) {
    resetMatch(state, settings);
    state.running = true;
    showScreen('game');
  },
  // تُستدعى عند ظهور شاشة المباراة: اللوحة تأخذ مقاسها الآن
  openGame() {
    resizeCanvas(canvas, state);
    clampCamera(state);
    resetParticles(state.weather, state.view);
  }
});

showScreen('main');

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
let accumulator = 0;

function loop(now) {
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
  reportFrame(frameMs);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
