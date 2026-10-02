// شاشة معركة البوتات (القسم 11.4): أداة خفية تفتحها ثلاث لمسات على عنوان اللعبة
// تشغّل مباريات بوتات متتالية بسرعة ×8 وبلا رسم، وتعرض من فاز ونسبته.
import { ai, BOT, BOT_LEVELS, TICK_SEC } from '../config.js';
import { createBattle, stepBattle, battleResult, summarize } from '../ai/botBattle.js';
import { buildOptions, refreshOptions, fillStatCards, showScreen, currentScreen } from './menus.js';
import { sound } from '../audio/sound.js';

const el = (id) => document.getElementById(id);
const options = { a: 'hard', b: 'medium', count: ai.battle.defaultMatches };
let run = null;              // القياس الجاري: { results, state, k, timer }

export function setupBattleScreen() {
  // ثلاث لمسات سريعة على العنوان تفتح الأداة
  let taps = 0, lastTap = 0;
  document.querySelector('#screenMain .title').addEventListener('click', () => {
    const now = performance.now();
    taps = now - lastTap < 600 ? taps + 1 : 1;
    lastTap = now;
    if (taps >= ai.battle.tapsToOpen) { taps = 0; sound('ui_tap'); showScreen('battle'); }
  });

  buildOptions('optBattleA', BOT_LEVELS, key => BOT[key].name, () => options.a, key => { options.a = key; refresh(); });
  buildOptions('optBattleB', BOT_LEVELS, key => BOT[key].name, () => options.b, key => { options.b = key; refresh(); });
  buildOptions('optBattleCount', ai.battle.matchOptions, v => String(v), () => options.count, v => { options.count = v; refresh(); });

  el('btnBattleRun').addEventListener('click', () => { sound('ui_tap'); run ? stop() : start(); });
  el('btnBattleBack').addEventListener('click', () => { sound('ui_tap'); stop(); showScreen('main'); });
  refresh();
}

function refresh() {
  for (const id of ['optBattleA', 'optBattleB', 'optBattleCount']) refreshOptions(id);
  el('btnBattleRun').textContent = run ? 'إيقاف' : 'ابدأ القياس';
}

function start() {
  run = { results: [], state: null, k: 0, timer: 0, last: performance.now() };
  showResults();
  refresh();
  loop();
}

function stop() {
  if (!run) return;
  clearTimeout(run.timer);
  run = null;
  refresh();
}

// كل 50 ملي ثانية حقيقية نتقدم ×8 من زمن اللعب، بلا رسم
function loop() {
  if (!run) return;
  if (currentScreen() !== 'battle') { stop(); return; }   // خرج بزر الرجوع في الجوال
  const now = performance.now();
  const elapsed = Math.min(250, now - run.last);           // تبويب مخفي ثم عاد: لا قفزة كبيرة
  run.last = now;

  if (!run.state) run.state = createBattle({ a: options.a, b: options.b });
  const ticks = Math.max(1, Math.round(ai.battle.speed * elapsed / 1000 / TICK_SEC));
  if (stepBattle(run.state, ticks)) {
    run.results.push(battleResult(run.state));
    run.state = null;
    run.k++;
    showResults();
    if (run.k >= options.count) { stop(); sound('victory'); return; }
  }
  status();
  run.timer = setTimeout(loop, 50);
}

function status() {
  if (!run) return;
  const t = run.state ? run.state.time : 0;
  const clock = Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  el('battleStatus').textContent = 'المباراة ' + (run.k + 1) + ' من ' + options.count + ' • زمن اللعب ' + clock;
}

function showResults() {
  const results = run ? run.results : [];
  if (!results.length) {
    el('battleStatus').textContent = '';
    fillStatCards(el('battleStats'), []);
    return;
  }
  const s = summarize(results);
  const a = BOT[options.a].name, b = BOT[options.b].name;
  el('battleStatus').textContent = 'انتهت ' + s.matches + ' من ' + options.count;
  fillStatCards(el('battleStats'), [
    ['فوز ' + a + ' (أ)', s.wins],
    ['فوز ' + b + ' (ب)', s.losses],
    ['نسبة فوز أ', Math.round(s.winRate * 100) + '%'],
    ['متوسط المدة', s.avgMinutes.toFixed(1) + ' د'],
    ['انتهى وقتها', s.timeouts]
  ]);
}
