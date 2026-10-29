// شاشة المتجر (بطلب المستخدم): الخرائط والعصابات والمظاهر. في كل قسم تبويب لكل منطقة (كلوحة المدن في
// قائمة الإعداد)، وخانات بصورها وتحت اسمها "مجانية" أو "السعر لاحقاً"، وبجانبها معاينة المختار ووصفه وسعره.
// المظاهر فارغة حتى إشعار آخر، والأسعار تُحدد لاحقاً، وكل شيء متاح للعب في فترة الاختبار (js/store.js)
import { CITIES, GANGS, HEROES, CHAMPIONS, PLAYER_COLORS, STORE, nations as NATIONS, CITY_FEATURES } from '../config.js';
import { sound } from '../audio/sound.js';
import { CITY_GROUPS, SIDE_GROUPS } from './regions.js';
import { drawCardThumb, updateCityThumb } from './cityThumb.js';
import { drawCharacters, sideKinds } from './charThumb.js';
import { isFreeCity, isFreeSide, cityPrice, sidePrice } from '../store.js';

const el = (id) => document.getElementById(id);

const SECTIONS = [
  { name: 'الخرائط', groups: CITY_GROUPS, card: mapCard, aside: mapAside },
  { name: 'العصابات', groups: SIDE_GROUPS, card: sideCard, aside: sideAside },
  { name: 'المظاهر', groups: [] }                     // فارغة حتى إشعار آخر
];
let section = 0;
const region = SECTIONS.map(() => 0);                 // تبويب المنطقة المفتوح في كل قسم
const chosen = SECTIONS.map(() => null);              // الخانة المختارة في كل قسم

const color = () => PLAYER_COLORS.find(c => c.id === STORE.previewColor).hex;

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

// تُرسم بعد ظهور الشاشة: الصور بمقاس خاناتها
export function showStore() {
  render();
}

function render() {
  // الأقسام: الخرائط والعصابات بعدد ما فيها، والمظاهر "قريباً"
  const tabs = el('storeTabs');
  tabs.innerHTML = '';
  SECTIONS.forEach((s, k) => {
    const count = s.groups.reduce((n, group) => n + group.items.length, 0);
    const node = button('store-tab' + (k === section ? ' selected' : ''), () => { section = k; render(); });
    node.append(text('span', s.name), text('small', count ? String(count) : 'قريباً'));
    tabs.appendChild(node);
  });

  const s = SECTIONS[section], empty = !s.groups.length;
  el('storeEmpty').hidden = !empty;
  el('storeRegions').hidden = empty;
  el('storeBody').hidden = empty;
  if (empty) return;

  // تبويب لكل منطقة بعدد خاناتها، كلوحة المدن والأمم في قائمة الإعداد
  const regions = el('storeRegions');
  regions.innerHTML = '';
  s.groups.forEach((group, k) => {
    const node = button('picker-tab' + (k === region[section] ? ' open' : ''), () => { region[section] = k; render(); });
    node.append(text('span', group.name), text('small', String(group.items.length)));
    regions.appendChild(node);
  });

  const group = s.groups[region[section]];
  if (!group.items.some(item => item.value === chosen[section])) chosen[section] = group.items[0].value;
  el('storeBoxTitle').textContent = group.title;
  const items = el('storeItems');
  items.innerHTML = '';
  const draws = [];
  for (const item of group.items) {
    const node = button('picker-item store-card' + (item.value === chosen[section] ? ' selected' : ''), () => choose(item.value));
    node.dataset.value = item.value;
    draws.push(s.card(node, item));
    items.appendChild(node);
  }
  for (const draw of draws) draw();                    // بعد وضع الخانات: تُرسم بمقاسها
  s.aside(el('storeAside'), chosen[section]);
}

function choose(value) {
  chosen[section] = value;
  for (const node of el('storeItems').children) node.classList.toggle('selected', node.dataset.value === value);
  SECTIONS[section].aside(el('storeAside'), value);
}

// خانة المتجر: صورة، ثم الاسم وسطر تحته، ثم شارة "مجانية" (مع اللاعب) أو "السعر لاحقاً" (تُشترى)
function card(node, item, free) {
  const canvas = document.createElement('canvas');
  canvas.className = 'store-art';
  node.append(canvas, text('b', item.text), text('small', item.note),
    text('span', free ? 'مجانية' : 'السعر لاحقاً', 'store-badge' + (free ? ' free' : '')));
  return canvas;
}

// السعر أسفل المعاينة
function status(free, price) {
  const box = document.createElement('div');
  box.className = 'store-status' + (free ? ' free' : '');
  box.append(
    text('b', free ? 'مجانية' : 'السعر: ' + (price === null ? 'يُحدد لاحقاً' : price)),
    text('span', free ? 'تأتي مع اللاعب' : 'متاحة لك الآن في فترة الاختبار')
  );
  return box;
}

// تحت صورة المعاينة: الاسم ثم السعر ثم الوصف
function asideText(node, title, free, price, lines) {
  const list = document.createElement('div');
  list.className = 'aside-lines';
  for (const line of lines) list.appendChild(text('p', line));
  node.append(title, status(free, price), list);
}

// --- الخرائط: صورة المدينة كخانات لوحة المدن، والمعاينة صورتها كاملة واسمها الكامل ---
function mapCard(node, item) {
  const canvas = card(node, item, isFreeCity(item.value));
  return () => drawCardThumb(canvas, item.value);
}

function mapAside(node, city) {
  node.dataset.kind = 'map';
  node.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'store-thumb';
  const title = text('b', '', 'aside-title');
  node.appendChild(canvas);
  updateCityThumb(canvas, title, city, () => false);   // الاسم الكامل: "شبام — اليمن"
  const lines = ['منطقتها: ' + CITY_GROUPS.find(g => g.items.some(i => i.value === city)).name];
  const host = NATIONS.order.find(id => NATIONS[id].city === city);
  if (host) lines.push('مدينة أمة ' + NATIONS[host].name + ': مدينة المضيف حين تلعب بها.');
  const feature = CITY_FEATURES.desc[CITY_FEATURES.cities[city]];      // ميزة المدينة (القسم 3.11)
  if (feature) lines.push('ميزتها: ' + feature);
  asideText(node, title, isFreeCity(city), cityPrice(city), lines);
}

// --- العصابات: البطل في الخانة، وفي المعاينة الأربعة (العادي والمميزان والبطل) ---
function sideCard(node, item) {
  const canvas = card(node, item, isFreeSide(item.value));
  return () => drawCharacters(canvas, item.value, ['champion'], color(), glowOf(item.value));
}

const glowOf = (side) => NATIONS[side] ? NATIONS[side].secondary : null;

// اسم كل شخصية: من الأمة، أو أسماء العصابة الكلاسيكية
export function unitName(side, kind) {
  const nation = NATIONS[side];
  if (nation) return nation.names[kind];
  if (kind === 'champion') return CHAMPIONS[side].name;
  return kind === 'common' ? 'الفرد العادي' : HEROES[kind].name;
}

function sideAside(node, side) {
  node.dataset.kind = 'gang';
  node.innerHTML = '';
  const kinds = sideKinds(side), canvas = document.createElement('canvas');
  canvas.className = 'store-lineup';
  node.append(canvas, text('span', kinds.map(kind => unitName(side, kind)).join(' • '), 'hint store-names'));
  drawCharacters(canvas, side, kinds, color(), glowOf(side));
  const nation = NATIONS[side], style = NATIONS.styles[nation ? nation.style : side];
  const lines = ['نمط ' + style.name + ': ' + style.desc];
  if (nation) {
    lines.push('السمة «' + nation.trait.name + '»: ' + nation.trait.desc);
    lines.push('ضربة البطل «' + nation.ult.name + '»: ' + nation.ult.desc);
    lines.push('مدينتها: ' + CITIES.short[nation.city]);
  }
  const title = text('b', nation ? nation.name + ' «' + nation.gangName + '»' : GANGS[side].name, 'aside-title');
  asideText(node, title, isFreeSide(side), sidePrice(side), lines);
}
