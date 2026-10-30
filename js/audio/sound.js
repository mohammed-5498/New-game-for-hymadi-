// جسر الصوت (القسم 13.5): يربط أحداث اللعبة بالصوت. ما له ملفات من المستخدم (assets/audio/، js/audio/samples.js)
// يُسمع منها، والباقي بالمولَّد (docs/audio.js).
// قواعد إلزامية: لا صوت قبل أول لمسة (إلا في التطبيق: يُفتح عند تشغيله)، ولا يُشغَّل صوت حدث خارج الشاشة إلا التنبيهات،
// وارتفاع الحدث من قرب الكاميرا (بطلب المستخدم). ومؤثرات القتال تمر بمازج يُسمع أهمها فقط حتى لا تتحول المعركة
// الكبيرة إلى ضجيج (المرحلة 5ب)
import { AUDIO, TILE_HALF_W, TILE_HALF_H, TICK_SEC } from '../config.js';
import { GameAudio } from './audio.js';
import { initSamples, setSampleVolumes, playSample, playTrack, themeOn, stopSamples, cityMusicOn, cityMusicOff, cityMusicHold } from './samples.js';
import { isNativeApp } from '../platform.js';

let settings = { sfx: AUDIO.sfxVolume, music: AUDIO.musicVolume, muted: AUDIO.muted };
let unlocked = false;
let wantMusic = false;
let wantTheme = false;      // لحن القوائم: القوائم ظاهرة
let silenced = false;       // الشاشة السوداء لبدء المباراة: لا يُسمع إلا صوتا البداية والتحميل
let intro = false;          // شاشة التشغيل السوداء ظاهرة: صوت التشغيل (التطبيق)، ولحن القوائم بعدها مباشرة

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
  applyVolumes();
  try { localStorage.setItem(AUDIO.storageKey, JSON.stringify(settings)); } catch (e) { /* تجاهل */ }
  if (settings.muted || !settings.music) { GameAudio.music.stop(); cityMusicOff(); }
  else if (wantMusic && unlocked && !silenced) matchMusic();
  refreshTheme();
}

// المولَّد أخفض بـ synthGain ليناسب الملفات
function applyVolumes() {
  GameAudio.setVolume(settings.sfx * AUDIO.synthGain, settings.music);
  GameAudio.setMuted(settings.muted);
  setSampleVolumes(settings.sfx, settings.music, settings.muted);
}

// --- التهيئة: الصوت لا يعمل قبل أول لمسة في متصفحات الجوال ---
// سياق الصوت نفسه يُنشأ عند أول تفاعل لا قبله (فلا يحذّر المتصفح)، ونعيد المحاولة مع كل تفاعل
// حتى يعمل فعلاً: بعض المتصفحات لا تسمح به في pointerdown وتسمح في touchend أو click
export function initSound() {
  loadAudioSettings();
  applyVolumes();
  armUnlock();
  document.addEventListener('visibilitychange', onVisibility);
  if (isNativeApp()) tryUnlock();       // التطبيق يسمح بالصوت قبل أي لمسة: صوت التشغيل ثم لحن القوائم
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
  initSamples(GameAudio.context, onSamplesLoaded);
  applyVolumes();
  if (wantMusic) startMusic();
}

// الملفات جاهزة: صوت تشغيل اللعبة إن كان وقته (التطبيق)، ثم لحن القوائم
function onSamplesLoaded() {
  if (intro && !silenced && isNativeApp()) playTrack('game_start');
  refreshTheme();
}

function refreshTheme() {
  themeOn(wantTheme && unlocked && !silenced && !intro && !settings.muted && settings.music > 0);
}

// لحن القوائم: يدور ما دامت القوائم ظاهرة (showScreen)
export function menuMusic(on) {
  wantTheme = on;
  refreshTheme();
}

// شاشة التشغيل السوداء ظاهرة أو ارتفعت: صوتها في التطبيق وحده (المتصفح لا يفتح الصوت قبل أول لمسة، فيبدأ بها
// لحن القوائم)، واللحن مع ارتفاعها
export function introSound(on) {
  intro = on;
  refreshTheme();
}

// الشاشة السوداء لبدء المباراة: يصمت كل شيء إلا صوت البداية ثم صوت التحميل، ويعود ما كان مطلوباً بعدها
export function matchSilence(on) {
  silenced = on;
  if (on) {
    GameAudio.music.stop();
    stopSamples();
    queue.length = 0;
    playTrack('match_start');
    playTrack('loading', AUDIO.tracks.loadingDelay);
  } else if (wantMusic && unlocked && !settings.muted && settings.music) {
    matchMusic();
  }
  refreshTheme();
}

// تصغير التطبيق أو تبديل الصفحة: يصمت كل الصوت، ويعود عند الرجوع (أو بأول لمسة إن رفض المتصفح)
function onVisibility() {
  const ctx = GameAudio.context;
  if (!ctx) return;
  cityMusicHold(document.visibilityState === 'hidden');
  if (document.visibilityState === 'hidden') { ctx.suspend().catch(() => {}); return; }
  ctx.resume().then(() => { if (ctx.state !== 'running') armUnlock(); }, armUnlock);
}

// الموسيقى لا تبدأ قبل أول لمسة ولا داخل القوائم
export function startMusic() {
  wantMusic = true;
  if (!unlocked || silenced || settings.muted || !settings.music) return;
  matchMusic();
}

export function stopMusic() {
  wantMusic = false;
  GameAudio.music.stop();
  cityMusicOff();
}

// موسيقى المباراة: لحن مدينتها إن كان لها (AUDIO.cityMusic، بطلب المستخدم)، وإلا المولَّدة
let musicCity = () => null;
export function setMusicCity(fn) { musicCity = fn; }

function matchMusic() {
  const track = AUDIO.cityMusic[musicCity()];
  if (track && cityMusicOn(track)) return;
  GameAudio.music.start();
}

// --- التشغيل ---
// sound: تنبيهات اللاعب وأصوات الواجهة. لا موقع لها على الخريطة فتُسمع دائماً،
// وهي المقصودة بالاستثناء في القسم 13.5: alert، capture_done، district_lost،
// victory، defeat، وأصوات الأزرار. أما مؤثرات الوحدات فتمر بـ soundAt وحدها.
export function sound(name, opt) {
  if (!silenced) play(name, opt);
}

const play = (name, opt) => { if (!playSample(name, opt)) GameAudio.play(name, opt); };

// موقع مربع اللعبة على الشاشة، أو null إذا كان خارجها
function screenPos(state, i, j) {
  const { camera, view } = state;
  if (!view.w) return null;
  const wx = (i - j) * TILE_HALF_W, wy = (i + j) * TILE_HALF_H;
  const x = (wx - camera.x) * camera.z + view.w / 2;
  const y = (wy - camera.y) * camera.z + view.h / 2;
  const m = AUDIO.screenMargin;
  if (x < -m || x > view.w + m || y < -m || y > view.h + m) return null;
  return { x, y };
}

export const onScreen = (state, i, j) => screenPos(state, i, j) !== null;
const panOf = (state, at) => (at.x / state.view.w * 2 - 1) * 0.7;

// ارتفاع الحدث من قرب الكاميرا (AUDIO.near): يكاد لا يُسمع والكاميرا بعيدة، ويعلو كلما اقتربت، وأخفض عند أطراف الشاشة
function nearness(state, at) {
  const N = AUDIO.near, { view, camera } = state;
  const t = Math.max(0, Math.min(1, (camera.z - N.quiet) / (N.loud - N.quiet)));
  const dx = at.x / view.w * 2 - 1, dy = at.y / view.h * 2 - 1;
  return (N.floor + (1 - N.floor) * t ** N.curve) * (1 - N.edge * Math.min(1, (dx * dx + dy * dy) / 2));
}

// صوت حدث في مكان من الخريطة: موزّع يمين/يسار وبارتفاع من قرب الكاميرا، ولا يُسمع إن كان خارج الشاشة.
// مؤثرات القتال (AUDIO.mix.priority) تُجمع لمازج آخر التحديث، والباقي يُسمع فوراً. opt.style أسلوب سلاح الضارب.
// تعيد true إن كان الحدث على الشاشة (سُمع أو دخل المازج)
export function soundAt(state, name, i, j, opt) {
  const at = screenPos(state, i, j);
  if (!at) return false;
  if (silenced) return true;
  const priority = AUDIO.mix.priority[name];
  const o = { ...opt, pan: panOf(state, at), gain: nearness(state, at) * (priority === undefined ? 1 : AUDIO.combatGain) };
  if (priority === undefined) play(name, o);
  else if (queue.length < AUDIO.mix.queueMax) {
    const centered = 1 - Math.min(1, Math.abs(at.x / state.view.w * 2 - 1));
    if (AUDIO.mix.minGap[name]) o.minGap = AUDIO.mix.minGap[name];
    queue.push({ name, opt: o, score: priority + jitter() * AUDIO.mix.jitter + centered * AUDIO.mix.center });
  }
  return true;
}

// --- مازج مؤثرات القتال (المرحلة 5ب) ---
// طلبات التحديث الواحد تُرتب بالأهمية، ويُسمع منها حتى maxPerTick بلا تكرار نفس المؤثر، وحتى AUDIO.combatVoices
// مسموعة معاً (samples.js). المعركة الصغيرة تُسمع كاملة تقريباً، والكبيرة يُسمع فيها الموت والضربات الثقيلة
// والضربات المميزة أولاً بدل جدار متصل من الضربات
const queue = [];
// عشوائية خاصة بالمازج: لا تستهلك Math.random فلا يتغير شيء في المباراة بسبب الصوت
let seed = 0x2545f491;
const jitter = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

// تُستدعى آخر كل تحديث للمباراة (loop.js)
export function flushSounds() {
  if (!queue.length) return;
  queue.sort((a, b) => b.score - a.score);
  const used = [];
  for (const s of queue) {
    if (used.length >= AUDIO.mix.maxPerTick) break;
    if (used.includes(s.name)) continue;
    used.push(s.name);
    play(s.name, s.opt);
  }
  queue.length = 0;
}

// التنبيهات وحدها تُسمع ولو كان مصدرها خارج الشاشة، وبارتفاعها كاملاً
export function soundAlert(state, name, i, j) {
  if (silenced) return;
  const at = screenPos(state, i, j);
  play(name, at ? { pan: panOf(state, at) } : undefined);
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
