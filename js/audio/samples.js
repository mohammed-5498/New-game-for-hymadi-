// ملفات الصوت (بطلب المستخدم، assets/audio/): تُحمَّل بعد فتح الصوت، ولكل حدث نسخ يُختار منها عشوائياً بلا تكرار
// متتالٍ، بسرعة وارتفاع يتغيران قليلاً كل مرة. المؤثرات تمر بمرشح يخفف حدتها ثم ضاغط يمنع تراكم المتزامنة،
// ومؤثرات القتال بحد AUDIO.combatVoices معاً. ولحن القوائم وأصوات البداية بمسار الموسيقى ومؤشرها
import { AUDIO } from '../config.js';

let ctx = null, sfxIn = null, sfxOut = null, musicOut = null;
const buffers = {};
const live = new Set();       // كل ما يُسمع الآن من الملفات: يُسكت كله عند الشاشة السوداء
let combat = 0;               // مؤثرات القتال المسموعة الآن
const lastPick = {}, lastAt = {};
// عشوائية خاصة بالصوت: لا تستهلك Math.random ولا عشوائية المباراة
let seed = 0x9e3779b9;
const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const jitter = (k) => 1 + (rand() * 2 - 1) * k;

// مرة واحدة بعد إنشاء سياق الصوت. onLoaded بعد محاولة تحميل كل الملفات (ما فشل يبقى بالصوت المولَّد)
export function initSamples(context, onLoaded) {
  if (ctx) return;
  ctx = context;
  const soft = ctx.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = AUDIO.softHz;
  const comp = ctx.createDynamicsCompressor();
  sfxOut = ctx.createGain();
  musicOut = ctx.createGain();
  soft.connect(comp);
  comp.connect(sfxOut);
  sfxOut.connect(ctx.destination);
  musicOut.connect(ctx.destination);
  sfxIn = soft;

  const names = [...AUDIO.files.sfx, ...AUDIO.files.music];
  let left = names.length;
  for (const name of names) {
    fetch(AUDIO.files.dir + name + '.mp3')
      .then(r => r.arrayBuffer())
      .then(data => ctx.decodeAudioData(data))
      .then(buf => { buffers[name] = buf; }, () => {})
      .finally(() => { if (--left === 0 && onLoaded) onLoaded(); });
  }
}

export function setSampleVolumes(sfx, music, muted) {
  if (!ctx) return;
  sfxOut.gain.value = muted ? 0 : sfx;
  musicOut.gain.value = muted ? 0 : music;
}

function start(buf, dest, gain, rate, pan, fight) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p);
    p.connect(dest);
  } else {
    g.connect(dest);
  }
  live.add(src);
  if (fight) combat++;
  src.onended = () => { live.delete(src); if (fight) combat--; };
  src.start();
  return { src, g };
}

// نسخة عشوائية من القائمة، لا تتكرر مرتين متتاليتين لنفس الحدث
function pick(key, list) {
  let k = Math.floor(rand() * list.length);
  if (list.length > 1 && list[k] === lastPick[key]) k = (k + 1) % list.length;
  return (lastPick[key] = list[k]);
}

// يُسمع الحدث من ملفاته (opt: style أسلوب سلاح الضارب، وgain وpan وminGap). يعيد false إن لم يكن له ملف
// محمَّل بعد، فيُسمع بالصوت المولَّد
export function playSample(event, opt = {}) {
  const E = AUDIO.events[event];
  if (!E || !ctx || ctx.state !== 'running') return false;
  const list = (opt.style && E[opt.style]) || E.any;
  if (!list.length) return true;
  const fight = AUDIO.mix.priority[event] !== undefined;
  if (fight && combat >= AUDIO.combatVoices) return true;
  const now = ctx.currentTime;
  if (now - (lastAt[event] || -1) < (opt.minGap ?? 0.045)) return true;
  const buf = buffers[pick(event + (opt.style || ''), list)];
  if (!buf) return false;
  lastAt[event] = now;
  start(buf, sfxIn, (E.gain ?? 1) * (opt.gain ?? 1) * jitter(AUDIO.gainJitter),
        (E.rate ?? 1) * jitter(AUDIO.rateJitter), opt.pan, fight);
  return true;
}

// لحن أو صوت بداية بمسار الموسيقى. يعيد مدته بالثواني (0 إن لم يُحمَّل)، وdone عند انتهائه
export function playTrack(name, delay = 0, done = null) {
  const buf = buffers[name];
  if (!buf || !ctx) return 0;
  setTimeout(() => {
    const { src } = start(buf, musicOut, AUDIO.tracks[name] ?? 1, 1, 0, false);
    if (done) src.addEventListener('ended', done);
  }, delay * 1000);
  return buf.duration;
}

// لحن القوائم يدور بلا توقف، ويظهر ويختفي بتلاشٍ
let theme = null;
export function themeOn(on) {
  if (!ctx) return;
  const T = AUDIO.tracks, now = ctx.currentTime;
  if (on && !theme && buffers.theme && ctx.state === 'running') {
    theme = start(buffers.theme, musicOut, 0.0001, 1, 0, false);
    theme.src.loop = true;
    theme.g.gain.setValueAtTime(0.0001, now);
    theme.g.gain.exponentialRampToValueAtTime(T.theme, now + T.themeFadeIn);
  } else if (!on && theme) {
    theme.g.gain.cancelScheduledValues(now);
    theme.g.gain.setValueAtTime(Math.max(0.0001, theme.g.gain.value), now);
    theme.g.gain.exponentialRampToValueAtTime(0.0001, now + T.themeFadeOut);
    theme.src.stop(now + T.themeFadeOut);
    theme = null;
  }
}

// كل ما يُسمع من الملفات يصمت فوراً (الشاشة السوداء)
export function stopSamples() {
  for (const src of live) { try { src.stop(); } catch (e) { /* انتهى أصلاً */ } }
  theme = null;
}
