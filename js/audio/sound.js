// جسر الصوت (القسم 13.5): يربط أحداث اللعبة بـ docs/audio.js
// قواعد إلزامية: لا صوت قبل أول لمسة، ولا يُشغَّل صوت حدث خارج الشاشة إلا التنبيهات.
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
export function initSound() {
  loadAudioSettings();
  GameAudio.init();
  GameAudio.setVolume(settings.sfx, settings.music);
  GameAudio.setMuted(settings.muted);
  document.addEventListener('pointerdown', firstTouch, { once: true });
}

function firstTouch() {
  GameAudio.unlock();
  unlocked = true;
  if (wantMusic) startMusic();
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

// صوت حدث في مكان من الخريطة: موزّع يمين/يسار، ولا يُسمع إن كان خارج الشاشة
export function soundAt(state, name, i, j, opt) {
  const x = screenX(state, i, j);
  if (x === null) return false;
  GameAudio.playAt(name, x, state.view.w, opt);
  return true;
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
