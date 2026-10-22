// جسر الصوت (القسم 13.5): يربط أحداث اللعبة بـ docs/audio.js
// قواعد إلزامية: لا صوت قبل أول لمسة، ولا يُشغَّل صوت حدث خارج الشاشة إلا التنبيهات.
// ومؤثرات القتال تمر بمازج يُسمع أهمها فقط حتى لا تتحول المعركة الكبيرة إلى ضجيج (المرحلة 5ب).
import { AUDIO, TILE_HALF_W, TILE_HALF_H, TICK_SEC } from '../config.js';
import { GameAudio } from './audio.js';

let settings = { sfx: AUDIO.sfxVolume, music: AUDIO.musicVolume, muted: AUDIO.muted };
let unlocked = false;
let wantMusic = false;

// --- الإعدادات: تُحفظ في localStorage وتُقرأ عند بدء اللعبة ---
export function loadAudioSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUDIO.storageKey) || 'null');
    if (saved) settings = { ...settings, ...saved };
  } catch (e) { /* تخزين معطّل: نبقى على الافتراضي */ }
  return { ...settings };
}

export function audioSettings() { return { ...settings }; }

export function setAudioSettings(next) {
  settings = { ...settings, ...next };
  GameAudio.setVolume(settings.sfx, settings.music);
  GameAudio.setMuted(settings.muted);
  try { localStorage.setItem(AUDIO.storageKey, JSON.stringify(settings)); } catch (e) { /* تجاهل */ }
  if (settings.muted || !settings.music) GameAudio.music.stop();
  else if (wantMusic && unlocked) GameAudio.music.start();
}

// --- التهيئة: الصوت لا يعمل قبل أول لمسة في متصفحات الجوال ---
// سياق الصوت نفسه يُنشأ عند أول تفاعل لا قبله (فلا يحذّر المتصفح)، ونعيد المحاولة مع كل تفاعل
// حتى يعمل فعلاً: بعض المتصفحات لا تسمح به في pointerdown وتسمح في touchend أو click
export function initSound() {
  loadAudioSettings();
  GameAudio.setVolume(settings.sfx, settings.music);
  GameAudio.setMuted(settings.muted);
  armUnlock();
  document.addEventListener('visibilitychange', onVisibility);
}

function armUnlock() {
  for (const name of AUDIO.unlockEvents) document.addEventListener(name, tryUnlock, true);
}

function tryUnlock() {
  GameAudio.unlock();                       // يُنشئ السياق أول مرة ويطلب استئنافه
  const ctx = GameAudio.context;
  if (!ctx) return;
  if (ctx.state === 'running') { onUnlocked(); return; }
  ctx.resume().then(() => { if (ctx.state === 'running') onUnlocked(); }, () => {});
}

function onUnlocked() {
  for (const name of AUDIO.unlockEvents) document.removeEventListener(name, tryUnlock, true);
  if (unlocked) return;
  unlocked = true;
  if (wantMusic) startMusic();
}

// تصغير التطبيق أو تبديل الصفحة: يصمت كل الصوت، ويعود عند الرجوع (أو بأول لمسة إن رفض المتصفح)
function onVisibility() {
  const ctx = GameAudio.context;
  if (!ctx) return;
  if (document.visibilityState === 'hidden') { ctx.suspend().catch(() => {}); return; }
  ctx.resume().then(() => { if (ctx.state !== 'running') armUnlock(); }, armUnlock);
}

// الموسيقى لا تبدأ قبل أول لمسة ولا داخل القوائم
export function startMusic() {
  wantMusic = true;
  if (!unlocked || settings.muted || !settings.music) return;
  GameAudio.music.start();
}

export function stopMusic() {
  wantMusic = false;
  GameAudio.music.stop();
}

// --- التشغيل ---
// sound: تنبيهات اللاعب وأصوات الواجهة. لا موقع لها على الخريطة فتُسمع دائماً،
// وهي المقصودة بالاستثناء في القسم 13.5: alert، capture_done، district_lost،
// victory، defeat، وأصوات الأزرار. أما مؤثرات الوحدات فتمر بـ soundAt وحدها.
export const sound = (name, opt) => GameAudio.play(name, opt);

// موقع مربع اللعبة على الشاشة، أو null إذا كان خارجها
function screenX(state, i, j) {
  const { camera, view } = state;
  if (!view.w) return null;
  const wx = (i - j) * TILE_HALF_W, wy = (i + j) * TILE_HALF_H;
  const x = (wx - camera.x) * camera.z + view.w / 2;
  const y = (wy - camera.y) * camera.z + view.h / 2;
  const m = AUDIO.screenMargin;
  if (x < -m || x > view.w + m || y < -m || y > view.h + m) return null;
  return x;
}

// صوت حدث في مكان من الخريطة: موزّع يمين/يسار، ولا يُسمع إن كان خارج الشاشة.
// مؤثرات القتال (AUDIO.mix.priority) تُجمع لمازج آخر التحديث، والباقي يُسمع فوراً.
// تعيد true إن كان الحدث على الشاشة (سُمع أو دخل المازج)
export function soundAt(state, name, i, j, opt) {
  const x = screenX(state, i, j);
  if (x === null) return false;
  const priority = AUDIO.mix.priority[name];
  if (priority === undefined) GameAudio.playAt(name, x, state.view.w, opt);
  else if (queue.length < AUDIO.mix.queueMax) {
    const centered = 1 - Math.min(1, Math.abs(x / state.view.w * 2 - 1));
    const gap = AUDIO.mix.minGap[name];
    queue.push({ name, x, w: state.view.w, opt: gap ? { ...opt, minGap: gap } : opt,
                 score: priority + jitter() * AUDIO.mix.jitter + centered * AUDIO.mix.center });
  }
  return true;
}

// --- مازج مؤثرات القتال (المرحلة 5ب) ---
// طلبات التحديث الواحد تُرتب بالأهمية، ويُسمع منها ما تسمح به ميزانية ثابتة في الثانية
// (perSecond بمخزون burst)، وحتى maxPerTick بلا تكرار نفس المؤثر. المعركة الصغيرة تُسمع كاملة تقريباً،
// والكبيرة يُسمع فيها الموت والضربات الثقيلة والضربات المميزة أولاً بدل جدار متصل من الضربات
const queue = [];
let tokens = AUDIO.mix.burst;
// عشوائية خاصة بالمازج: لا تستهلك Math.random فلا يتغير شيء في المباراة بسبب الصوت
let seed = 0x2545f491;
const jitter = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

// تُستدعى آخر كل تحديث للمباراة (loop.js)
export function flushSounds() {
  tokens = Math.min(AUDIO.mix.burst, tokens + AUDIO.mix.perSecond * TICK_SEC);
  if (!queue.length) return;
  queue.sort((a, b) => b.score - a.score);
  const used = [];
  for (const s of queue) {
    if (tokens < 1 || used.length >= AUDIO.mix.maxPerTick) break;
    if (used.includes(s.name)) continue;
    used.push(s.name);
    tokens--;
    GameAudio.playAt(s.name, s.x, s.w, s.opt);
  }
  queue.length = 0;
}

// التنبيهات وحدها تُسمع ولو كان مصدرها خارج الشاشة
export function soundAlert(state, name, i, j) {
  const x = screenX(state, i, j);
  if (x === null) GameAudio.play(name);
  else GameAudio.playAt(name, x, state.view.w);
}

// --- حرارة الموسيقى: تزداد الطبول كلما اشتدت معركة اللاعب ---
let musicTimer = 0;

export function updateMusicIntensity(state) {
  musicTimer -= TICK_SEC;
  if (musicTimer > 0) return;
  musicTimer = AUDIO.musicInterval;

  let engaged = 0;
  for (const unit of state.units) {
    if (unit.playerId !== state.humanId) continue;
    if (unit.state === 'attacking') engaged++;
  }
  GameAudio.music.setIntensity(Math.min(1, engaged * AUDIO.musicPerEngaged));
}
