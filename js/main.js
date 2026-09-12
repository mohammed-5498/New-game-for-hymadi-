// نقطة البداية: القوائم، دورة حياة المباراة، وحلقة اللعبة
// منطق اللعبة بخطوة زمنية ثابتة (20 تحديثاً/ث)، والرسم كل إطار مع تنعيم المواقع
import { MATCH_DEFAULTS, TICK_MS, TICK_SEC } from './config.js';
import { createMatch, resetMatch } from './state.js';
import { updateUnits } from './game/units.js';
import { updateCombat, removeDeadUnits } from './game/combat.js';
import { updateCapture, updateNotice } from './game/capture.js';
import { updateAbilities } from './game/abilities.js';
import { updateSpawn } from './game/spawn.js';
import { updateVictory } from './game/victory.js';
import { updateBots } from './ai/bot.js';
import { render, resizeCanvas, clampCamera } from './render/renderer.js';
import { updateParticles, resetParticles } from './render/weather.js';
import { setupInput } from './ui/input.js';
import { setupHud, updateHud } from './ui/hud.js';
import { setupMenus, showScreen } from './ui/menus.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// مباراة مبدئية حتى تكون هناك حالة صالحة قبل اختيار الإعدادات
const state = createMatch(MATCH_DEFAULTS);

setupInput(canvas, state);
setupHud(state);
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

// تحديث منطقي واحد بخطوة ثابتة
function update() {
  if (state.paused || state.matchResult) return;   // الإيقاف ونهاية المباراة يوقفان اللعب

  state.time += TICK_SEC;
  updateAbilities(state);   // الهالات والعلاج والنار قبل حساب الضرر
  updateCombat(state);      // اختيار الأهداف والضرب قبل الحركة
  updateUnits(state);
  removeDeadUnits(state);
  updateCapture(state);
  updateSpawn(state);
  updateBots(state);
  updateVictory(state);
  updateNotice(state);

  if (state.moveMarker) {
    state.moveMarker.t += TICK_SEC;
    if (state.moveMarker.t > 0.8) state.moveMarker = null;
  }
}

let lastTime = performance.now();
let accumulator = 0;

function loop(now) {
  const frameMs = Math.min(250, Math.max(0, now - lastTime));
  lastTime = now;

  if (!state.running) {          // داخل القوائم: لا تحديث ولا رسم
    accumulator = 0;
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

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
