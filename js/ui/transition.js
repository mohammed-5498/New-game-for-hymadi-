// انتقالات ناعمة بين الشاشات (القسم 12.0): تلاشٍ قصير بدل القفز المفاجئ
// الإظهار والإخفاء بخاصية hidden كما كان، ومعها صنفان يشغّلان حركة CSS:
// entering عند الظهور، وleaving قبل الإخفاء (ولا يستقبل العنصر اللمس أثناءه).
import { UI } from '../config.js';

// مدة الحركة في config.js، وتصل لملف التنسيق عبر متغير CSS
if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--fade', UI.fadeMs + 'ms');
}

// هل العنصر ظاهر منطقياً؟ (الذي يتلاشى خارجاً يُعد مغلقاً من الآن)
export const isShown = (node) => !node.hidden && !node.classList.contains('leaving');

export function fadeIn(node) {
  if (isShown(node)) return;
  clearTimeout(node.fadeTimer);
  node.classList.remove('leaving');
  node.hidden = false;
  node.classList.add('entering');
  node.fadeTimer = setTimeout(() => node.classList.remove('entering'), UI.fadeMs);
}

export function fadeOut(node) {
  if (!isShown(node)) return;
  clearTimeout(node.fadeTimer);
  node.classList.remove('entering');
  node.classList.add('leaving');
  node.fadeTimer = setTimeout(() => {
    node.hidden = true;
    node.classList.remove('leaving');
  }, UI.fadeMs);
}
