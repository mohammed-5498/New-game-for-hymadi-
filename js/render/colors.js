// خلط الألوان مع تخزين النتائج (يُستدعى كثيراً أثناء الرسم)
const cache = {};

export function mix(color, target, amount) {
  if (typeof color !== 'string' || color[0] !== '#' || color.length !== 7) return color;
  const key = color + target + amount;
  if (cache[key]) return cache[key];
  const parts = [1, 3, 5].map(i =>
    Math.round(parseInt(color.substr(i, 2), 16) * (1 - amount) +
               parseInt(target.substr(i, 2), 16) * amount));
  return cache[key] = '#' + parts.map(v => v.toString(16).padStart(2, '0')).join('');
}

// ألوان أرض ومباني كل طابع حي
export const PALETTES = {
  crows:     { ground: '#7a7090', left: '#4f4368', right: '#6a5b88', flag: '#b3a2e0' },
  hammers:   { ground: '#8d6a60', left: '#6e2f28', right: '#8e4036', flag: '#ef6b58' },
  vipers:    { ground: '#6d7d5a', left: '#3e5530', right: '#557043', flag: '#9fd07c' },
  scorpions: { ground: '#a08a66', left: '#8a6224', right: '#a87a32', flag: '#f5c25a' },
  neutral:   { ground: '#948d7f', left: '#7d4f3c', right: '#9c6349', flag: '#e8e2d6' },
  special:   { ground: '#bba565', left: '#7d4f3c', right: '#9c6349', flag: '#e0bd4f' }
};

export const ROAD_COLOR = '#5a554e';
export const BACKGROUND = '#34302b';
export const DARK = '#3d3a36';
export const LIT_WINDOW = '#e3c06a';
export const CRATE = ['#8a6a4a', '#a07e5a', '#b89470'];
export const UI_LIGHT = '#f2ede4';
