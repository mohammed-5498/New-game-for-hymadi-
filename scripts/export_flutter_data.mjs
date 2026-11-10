// بيانات النسخة الجديدة (Flutter، القسم 18 في GAME_SPEC) من كود اللعبة الحالية، فلا تُنسخ باليد:
// 1) flutter_game/lib/data/cities.dart: ما يحتاجه مولّد الخريطة من طوابع المدن (أنواع المباني بأوزانها...)
// 2) flutter_game/test/map_parity.json: بصمات خرائط المولّد الحالي ببذور ثابتة، يقارن بها اختبار Dart
//    (Math.random هنا مولّد ببذرة، هو نفسه Rng في lib/core/fmath.dart)
//   node scripts/export_flutter_data.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { THEMES } from '../js/render/cityThemes.js';
import { CITIES, MAP_SIZES } from '../js/config.js';
import { createMap } from '../js/map/generator.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'flutter_game');

// --- 1) طوابع المدن ---
const num = (w) => Number.isInteger(w) ? w + '.0' : String(w);
const str = (s) => s == null ? 'null' : `'${s}'`;
const pool = (p) => '[' + p.map(([k, w]) => `(${str(k)}, ${num(w)})`).join(', ') + ']';
let dart = `// مولّد من js/render/cityThemes.js بـ scripts/export_flutter_data.mjs: لا تعدّله باليد
// ما يحتاجه مولّد الخريطة من طابع كل مدينة: أنواع المربعات بأوزانها (pool)، وأنماط الأحياء (styles، اليمامة)،
// وأنواع الأحياء الصغيرة (smallPool)، ونوع الشجرة، ووجود المعلم
typedef Pool = List<(String?, double)>;

class CityTheme {
  final String name;
  final Pool pool;
  final List<(Pool, double)>? styles;
  final Pool? smallPool;
  final String? tree;
  final bool monument;
  const CityTheme({required this.name, required this.pool, this.styles, this.smallPool, this.tree, this.monument = false});
}

const CITY_THEMES = <String, CityTheme>{
`;
for (const key of CITIES.order) {
  const T = THEMES[key];
  const tree = typeof T.draw.tree === 'function' ? 'tree' : T.draw.tree;
  const parts = [`name: ${str(T.name)}`, `pool: ${pool(T.pool)}`];
  if (T.styles) parts.push(`styles: [${T.styles.map(s => `(${pool(s.pool)}, ${num(s.weight)})`).join(', ')}]`);
  if (T.smallPool) parts.push(`smallPool: ${pool(T.smallPool)}`);
  if (tree != null) parts.push(`tree: ${str(tree)}`);
  if (typeof T.draw.monument === 'function') parts.push('monument: true');
  dart += `  '${key}': CityTheme(${parts.join(', ')}),\n`;
}
dart += '};\n';
fs.mkdirSync(path.join(OUT, 'lib/data'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'lib/data/cities.dart'), dart);

// --- 2) بصمات الخرائط ---
// مولّد mulberry32 كما في js/game/random.js
function seeded(seed) {
  let s = seed | 0;
  return () => {
    let t = (s = (s + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// نص الخريطة الكامل بترتيب ثابت (نفسه في test/map_parity_test.dart)
export function canon(map, players) {
  const parts = [map.n, map.land, map.seed, map.city];
  parts.push(map.type.join(''));
  parts.push(Array.from(map.road).join(''));
  parts.push(Array.from(map.dash).join(''));
  parts.push(map.region.join(','));
  parts.push(map.kind.map(k => k || '').join(','));
  parts.push(Object.keys(map.decor).map(Number).sort((a, b) => a - b).map(k => k + map.decor[k]).join(','));
  parts.push(Array.from(map.districtAt).join(','));
  parts.push(Array.from(map.connected).join(''));
  for (const d of map.districts) {
    parts.push([d.id, d.tiles.map(t => t[0] + ':' + t[1]).join(' '), d.region, d.capturable ? 1 : 0,
      d.capture ? d.capture.i + ':' + d.capture.j : '-', d.isHome ? 1 : 0, d.special || '-', d.feature || '-',
      d.police ? 1 : 0, d.policeMain ? 1 : 0, d.featureTile ?? '-', d.featureBig ? 1 : 0, d.owner ?? '-'].join('|'));
  }
  parts.push(players.map(p => p.homeDistrictId).join(','));
  return parts.join('\n');
}
export function fnv(s) {
  let h = 0x811c9dc5;
  for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}
const GANGS = ['crows', 'hammers', 'vipers', 'scorpions'];
export function playersFor(sizeKey, seed) {
  const count = [2, MAP_SIZES[sizeKey].maxPlayers, 4][seed % 3];
  return Array.from({ length: count }, (_, k) => ({ gang: GANGS[k % 4], team: seed % 2 ? (k % 2) + 1 : 0 }));
}
export function jsMap(city, sizeKey, seed) {
  const real = Math.random;
  Math.random = seeded(seed);
  try {
    const players = playersFor(sizeKey, seed);
    const map = createMap(sizeKey, players, city, { specials: false, features: true });
    return { map, players };
  } finally { Math.random = real; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cases = [];
  const warn = console.warn;
  console.warn = () => {};
  for (const city of CITIES.order) for (const size of ['small', 'medium', 'large']) for (const seed of [1, 2, 3]) {
    const { map, players } = jsMap(city, size, seed);
    cases.push({ city, size, seed, hash: fnv(canon(map, players)) });
  }
  console.warn = warn;
  fs.mkdirSync(path.join(OUT, 'test'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'test/map_parity.json'), JSON.stringify(cases, null, 0).replace(/},/g, '},\n'));
  // الجيب وجيب التمام في V8 لقيم متنوعة، ببتات العدد (16 رقماً ست عشرياً) فلا يختلف تنسيقه
  const bits = (x) => { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, x); return b.getBigUint64(0).toString(16).padStart(16, '0'); };
  const trig = [];
  const r = seeded(7);
  for (let k = 0; k < 2000; k++) {
    const x = (r() - 0.5) * [0.5, 4, 40, 2000][k % 4];
    trig.push([bits(x), bits(Math.sin(x)), bits(Math.cos(x))]);
  }
  fs.writeFileSync(path.join(OUT, 'test/fmath_parity.json'), JSON.stringify(trig));
  console.log('cities.dart,', cases.length, 'map fingerprints and', trig.length, 'trig values written');
}
