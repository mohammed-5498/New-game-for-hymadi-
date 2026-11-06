// شاشة التحميل (بطلب المستخدم 2026-11-06؛ كانت سوداء 4 ث): عند بدء المباراة أو متابعتها تُجهَّز فيها المدينة
// والصور والأصوات بشريط تقدم ونصيحة، ولا يُسمع إلا صوتا البداية والتحميل، والمباراة لا تتقدم حتى ترتفع (blackoutHolds
// في main.js). ترتفع حين يكتمل التحميل (loadingStep)، لا قبل UI.blackout.minSeconds ولا بعد maxSeconds.
// وعند تشغيل اللعبة شاشة سوداء قصيرة بلا شريط (UI.intro). تظهر وتختفي بتلاشٍ سريع (#blackout في style.css)
import { UI } from '../config.js';
import { matchSilence, introSound } from '../audio/sound.js';

const B = UI.blackout;
const el = (id) => document.getElementById(id);
let until = 0;        // نهاية شاشة التشغيل
let load = null;      // شاشة التحميل الجارية: { made, minAt, maxAt, shown }

function cover(fadeMs, loading) {
  const node = el('blackout');
  node.style.transitionDuration = fadeMs + 'ms';
  node.classList.toggle('loading', loading);
  node.classList.add('on');
}

// بدء المباراة أو متابعتها: work (إنشاء المباراة وإظهار شاشتها) بعد أن تغطي الشاشة، فلا يُرى تجمّد إنشائها.
// lan: مباراة محلية، حدها الأدنى أطول (lanMinSeconds)
export function matchBlackout(work, lan = false) {
  const now = performance.now();
  matchSilence(true);
  load = { made: false, minAt: now + (lan ? B.lanMinSeconds : B.minSeconds) * 1000, maxAt: now + B.maxSeconds * 1000, shown: 0 };
  el('loadTip').textContent = B.tips[Math.floor(Math.random() * B.tips.length)];   // نص فقط: لا يمس عشوائية المباراة
  bar(0);
  cover(B.fadeMs, true);
  setTimeout(() => { work(); if (load) load.made = true; }, B.fadeMs);
  // احتياط: ترتفع عند الحد الأقصى ولو لم تصلها إطارات المباراة
  setTimeout(() => loadingStep(performance.now(), 0), B.maxSeconds * 1000 + 50);
}

// كل إطار أثناء التحميل (main.js): ready ما جهز من 0 إلى 1 (لا يُحسب قبل أن تُنشأ المباراة)
export function loadingStep(now, ready) {
  if (!load) return;
  if (load.made) bar(ready);
  if (now < load.maxAt && !(load.made && ready >= 1 && now >= load.minAt)) return;
  load = null;
  el('blackout').classList.remove('on');
  matchSilence(false);
}

// الشريط لا يرجع إلى الخلف
function bar(p) {
  if (!load) return;
  load.shown = Math.max(load.shown, Math.min(1, p));
  el('loadFill').style.width = (load.shown * 100).toFixed(1) + '%';
  el('loadPct').textContent = Math.round(load.shown * 100) + '%';
}

// تشغيل اللعبة: الشاشة سوداء من أول رسم (class="on" في index.html) ثم ترتفع
export function introBlackout() {
  introSound(true);
  cover(UI.intro.fadeMs, false);
  until = performance.now() + UI.intro.seconds * 1000;
  setTimeout(() => {
    if (!load) el('blackout').classList.remove('on');
    until = 0;
    introSound(false);
  }, UI.intro.seconds * 1000);
}

export const blackoutHolds = (now) => !!load || now < until;
// شاشة التحميل تغطي المباراة: لا داعي لرسمها خلفها، ووقت الإطار كله لتجهيز المدينة
export const loadingCovers = () => !!load;
