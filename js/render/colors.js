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

// --- صبغ المالك (القسم 8) بخلط في فضاء OKLab بدل RGB ---
// الخلط العادي يعكّر الألوان: الأصفر فوق سقف رمادي مزرق يصير زيتونياً كالأخضر، والأحمر فوق مدينة وردية لا يظهر.
// هنا الإضاءة تقترب من لون المالك بالنسبة نفسها (amount)، ودرجة اللون تقترب أكثر (amount × chroma)
// فيبقى ظل المبنى ونوره كما هما، ويظهر لون المالك نقياً في كل المدن
const tintCache = {};
const toLinear = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const fromLinear = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

function toOklab(color) {
  const r = toLinear(parseInt(color.substr(1, 2), 16));
  const g = toLinear(parseInt(color.substr(3, 2), 16));
  const b = toLinear(parseInt(color.substr(5, 2), 16));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}

function fromOklab(L, A, B) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
               -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
               -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  return '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(fromLinear(v)))).toString(16).padStart(2, '0')).join('');
}

export function tint(color, owner, amount, chroma) {
  if (typeof color !== 'string' || color[0] !== '#' || color.length !== 7 || amount <= 0) return color;
  const key = color + owner + amount + '|' + chroma;
  const hit = tintCache[key];
  if (hit) return hit;
  const a = toOklab(color), o = toOklab(owner), c = Math.min(1, amount * chroma);
  return tintCache[key] = fromOklab(a[0] + (o[0] - a[0]) * amount, a[1] + (o[1] - a[1]) * c, a[2] + (o[2] - a[2]) * c);
}

// ألوان أرض ومباني كل طابع حي
export const PALETTES = {
  crows:     { ground: '#7a7090', left: '#4f4368', right: '#6a5b88', flag: '#b3a2e0' },
  hammers:   { ground: '#8d6a60', left: '#6e2f28', right: '#8e4036', flag: '#ef6b58' },
  vipers:    { ground: '#6d7d5a', left: '#3e5530', right: '#557043', flag: '#9fd07c' },
  scorpions: { ground: '#a08a66', left: '#8a6224', right: '#a87a32', flag: '#f5c25a' },
  neutral:   { ground: '#948d7f', left: '#7d4f3c', right: '#9c6349', flag: '#e8e2d6' },
  special:   { ground: '#bba565', left: '#7d4f3c', right: '#9c6349', flag: '#e0bd4f' },
  // حي مركز الشرطة: أرض رمادية مزرقّة قبل الاستيلاء عليه (القسم 3.8)
  police:    { ground: '#6f7b8a', left: '#3c4a5e', right: '#51617a', flag: '#8fa6c4' }
};

export const ROAD_COLOR = '#5a554e';
export const BACKGROUND = '#34302b';
export const DARK = '#3d3a36';
export const LIT_WINDOW = '#e3c06a';
export const CRATE = ['#8a6a4a', '#a07e5a', '#b89470'];
export const UI_LIGHT = '#f2ede4';
