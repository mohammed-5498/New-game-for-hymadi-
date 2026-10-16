// لوحة الاختيار المرتبة حسب المنطقة (بطلب المستخدم): المدينة، وأمة كل خانة في قائمة الإعداد.
// في الأعلى تبويب لكل منطقة، وتحته خانة المنطقة المفتوحة بعناصرها، وبجانبها معاينة (صورة المدينة أو وصف الأمة)،
// وفي الأسفل الخيارات العامة (عشوائي، مدينة المضيف) وزر "تم". اللمس على عنصر يختاره فوراً وتبقى اللوحة
// مفتوحة للمقارنة؛ "تم" أو اللمس خارج اللوحة أو زر الرجوع في أندرويد يغلقها.
import { sound } from '../audio/sound.js';
import { fadeIn, fadeOut, isShown } from './transition.js';

const el = (id) => document.getElementById(id);

// spec: {
//   title: عنوان اللوحة،
//   groups: [{ name: اسم التبويب، title: عنوان الخانة، items: [{ value, text, note }] }],
//   extras: [{ value, text }]: خيارات خارج المناطق،
//   current(): القيمة المختارة الآن، pick(value): اختيارها،
//   aside(node, value): المعاينة بجانب الخانة، tabFor(value): تبويب الخيارات العامة (اختياري)،
//   art(canvas, value): صورة داخل كل عنصر (اختياري، صور المدن)، close(): بعد الإغلاق (اختياري)
// }
let spec = null;
let tab = 0;

export function setupPicker() {
  el('pickerDone').addEventListener('click', () => { sound('ui_tap'); closePicker(); });
  // اللمس على الخلفية المعتمة خارج اللوحة يغلقها
  el('picker').addEventListener('click', (event) => { if (event.target === el('picker')) closePicker(); });
}

export const isPickerOpen = () => isShown(el('picker'));

export function openPicker(next) {
  spec = next;
  // يفتح على تبويب الخيار الحالي، أو تبويب يحدده صاحب اللوحة للخيارات العامة
  const current = spec.current();
  const own = spec.groups.findIndex(group => group.items.some(item => item.value === current));
  tab = own >= 0 ? own : Math.max(0, spec.tabFor ? spec.tabFor(current) : 0);
  el('pickerTitle').textContent = spec.title;
  fadeIn(el('picker'));            // قبل الرسم: المعاينة الحية تعمل ما دامت اللوحة ظاهرة
  render();
}

export function closePicker() {
  if (!spec) return;
  const done = spec.close;
  spec = null;
  fadeOut(el('picker'));
  if (done) done();
}

function button(className, onClick) {
  const node = document.createElement('button');
  node.className = className;
  node.addEventListener('click', () => { sound('ui_tap'); onClick(); });
  return node;
}

function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function render() {
  const current = spec.current();

  // التبويبات: المفتوح مميز، ونقطة ذهبية على تبويب الخيار الحالي، وعدد عناصر كل منطقة
  const tabs = el('pickerTabs');
  tabs.innerHTML = '';
  spec.groups.forEach((group, k) => {
    const has = group.items.some(item => item.value === current);
    const node = button('picker-tab' + (k === tab ? ' open' : '') + (has ? ' has' : ''), () => { tab = k; render(); });
    node.appendChild(text('span', group.name));
    node.appendChild(text('small', String(group.items.length)));
    tabs.appendChild(node);
  });

  // خانة المنطقة المفتوحة بعناصرها
  const group = spec.groups[tab];
  el('pickerBoxTitle').textContent = group.title;
  const items = el('pickerItems');
  items.innerHTML = '';
  const arts = [];
  for (const item of group.items) {
    const node = button('picker-item' + (spec.art ? ' art' : '') + (item.value === current ? ' selected' : ''),
      () => { spec.pick(item.value); render(); });
    if (spec.art) {
      const canvas = document.createElement('canvas');
      canvas.className = 'picker-art';
      node.appendChild(canvas);
      arts.push([canvas, item.value]);
    }
    node.appendChild(text('b', item.text));
    if (item.note) node.appendChild(text('small', item.note));
    items.appendChild(node);
  }
  for (const [canvas, value] of arts) spec.art(canvas, value);   // بعد وضع العناصر: تُرسم بمقاسها

  const extras = el('pickerExtras');
  extras.innerHTML = '';
  for (const extra of spec.extras) {
    const node = button('opt' + (extra.value === current ? ' selected' : ''), () => { spec.pick(extra.value); render(); });
    node.textContent = extra.text;
    extras.appendChild(node);
  }

  spec.aside(el('pickerAside'), current);
}
