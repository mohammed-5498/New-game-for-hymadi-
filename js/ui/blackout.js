// الشاشة السوداء (بطلب المستخدم): عند بدء المباراة أو متابعتها UI.blackout.seconds تُجهَّز فيها المدينة ولا يُسمع
// إلا صوتا البداية والتحميل، والمباراة لا تتقدم حتى ترتفع (blackoutHolds في main.js). وعند تشغيل اللعبة شاشة قصيرة
// (UI.intro) مكان مقدمة التطبيق لاحقاً. تظهر وتختفي بتلاشٍ سريع (#blackout في style.css)
import { UI } from '../config.js';
import { matchSilence, introSound } from '../audio/sound.js';

let until = 0, timer = 0;

function cover(B, done) {
  const node = document.getElementById('blackout');
  node.style.transitionDuration = B.fadeMs + 'ms';
  node.classList.add('on');
  until = performance.now() + B.seconds * 1000;
  clearTimeout(timer);
  timer = setTimeout(() => {
    node.classList.remove('on');
    until = 0;
    if (done) done();
  }, B.seconds * 1000);
}

// بدء المباراة أو متابعتها: work (إنشاء المباراة وإظهار شاشتها) بعد أن تسودّ الشاشة، فلا يُرى تجمّد إنشائها
export function matchBlackout(work) {
  matchSilence(true);
  cover(UI.blackout, () => matchSilence(false));
  setTimeout(work, UI.blackout.fadeMs);
}

// تشغيل اللعبة: الشاشة سوداء من أول رسم (class="on" في index.html) ثم ترتفع
export function introBlackout() {
  introSound();
  cover(UI.intro);
}

export const blackoutHolds = (now) => now < until;
