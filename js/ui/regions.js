// المدن والأمم مرتبة حسب المنطقة (بطلب المستخدم): تبويب لكل منطقة بمدنها أو عصاباتها.
// تستعملها لوحتا المدينة والأمة في قائمة الإعداد (picker.js) والمتجر (store.js)
import { CITIES, REGIONS, GANGS, GANG_IDS, nations as NATIONS } from '../config.js';
import { THEMES } from '../render/cityThemes.js';
import { OPEN_CITIES } from '../map/generator.js';

// تحت اسم المدينة بلدها (الجزء بعد "—" من اسمها الكامل)، أو اسمها الكامل إن لم يكن لها بلد
export const cityNote = (city) => {
  const name = THEMES[city] ? THEMES[city].name : '';
  return name.includes('—') ? name.split('—')[1].trim() : name;
};

// تبويب "أخرى" لما لم يُذكر في أي منطقة (مدينة أو أمة جديدة)، فلا تختفي من القائمة
function regionGroups(key, all, title, item) {
  const groups = REGIONS.order.map(r => ({
    name: REGIONS[r].name, title: REGIONS[r][title],
    items: REGIONS[r][key].filter(v => all.includes(v)).map(item)
  }));
  const rest = all.filter(v => !REGIONS.order.some(r => REGIONS[r][key].includes(v)));
  if (rest.length) groups.push({ name: REGIONS.other.name, title: REGIONS.other[title], items: rest.map(item) });
  return groups;
}

const cityItem = city => ({ value: city, text: CITIES.short[city], note: cityNote(city) });

// كل المدن (المتجر)، ومدن الأطوار العادية في قائمة الإعداد (بلا مدن طور واحد، CITIES.modeOnly)
export const CITY_GROUPS = regionGroups('cities', CITIES.order, 'cityTitle', cityItem);
export const PLAY_CITY_GROUPS = regionGroups('cities', OPEN_CITIES, 'cityTitle', cityItem);

export const SIDE_GROUPS = [
  ...regionGroups('nations', NATIONS.order, 'nationTitle',
    id => ({ value: id, text: NATIONS[id].name, note: NATIONS[id].gangName + ' • ' + NATIONS.styles[NATIONS[id].style].name })),
  { name: REGIONS.classic.name, title: REGIONS.classic.nationTitle,
    items: GANG_IDS.map(id => ({ value: id, text: GANGS[id].name, note: NATIONS.styles[id].name })) }
];

export const regionOf = (groups, value) => groups.find(group => group.items.some(item => item.value === value));
