// بيانات النسخة الجديدة (Flutter، القسم 18 في GAME_SPEC) من كود اللعبة الحالية، فلا تُنسخ باليد:
// 1) flutter_game/lib/data/cities.dart: ما يحتاجه مولّد الخريطة من طوابع المدن (أنواع المباني بأوزانها...)
// 2) flutter_game/test/map_parity.json: بصمات خرائط المولّد الحالي ببذور ثابتة، يقارن بها اختبار Dart
//    (Math.random هنا مولّد ببذرة، هو نفسه Rng في lib/core/fmath.dart)
//   node scripts/export_flutter_data.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { THEMES } from '../js/render/cityThemes.js';
import * as CONFIG from '../js/config.js';
const { CITIES, MAP_SIZES } = CONFIG;
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
  final List<String>? car;   // ألوان السيارة المحطمة في الشوارع (streetDebris)
  final String? debris;      // لون الركام
  const CityTheme({required this.name, required this.pool, this.styles, this.smallPool, this.tree, this.monument = false,
      this.car, this.debris});
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
  if (T.car) parts.push(`car: [${T.car.map(str).join(', ')}]`);
  if (T.debris) parts.push(`debris: ${str(T.debris)}`);
  dart += `  '${key}': CityTheme(${parts.join(', ')}),\n`;
}
dart += '};\n';
fs.mkdirSync(path.join(OUT, 'lib/data'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'lib/data/cities.dart'), dart);

// --- 1ب) كل أرقام js/config.js كما هي (lib/data/js_config.dart): مصدر واحد للأرقام أثناء النقل، فلا خطأ نسخ ---
const lit = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$').replace(/\n/g, '\\n') + "'";
  if (Array.isArray(v)) return '<Object?>[' + v.map(lit).join(', ') + ']';
  return '<String, Object?>{' + Object.entries(v).map(([k, x]) => lit(k) + ': ' + lit(x)).join(', ') + '}';
};
let cfg = `// مولّد من js/config.js بـ scripts/export_flutter_data.mjs: لا تعدّله باليد (عدّل js/config.js ثم أعد التصدير)
// كل قسم بالاسم نفسه، والقراءة بأدوات lib/core/cfg.dart: COMBAT.d('meleeRange') وGANGS.m(id)...
// ignore_for_file: constant_identifier_names
import '../core/cfg.dart';

`;
for (const [k, v] of Object.entries(CONFIG)) {
  cfg += v !== null && typeof v === 'object' && !Array.isArray(v) ? `const J ${k} = ${lit(v)};\n` : `const ${k} = ${lit(v)};\n`;
}
fs.writeFileSync(path.join(OUT, 'lib/data/js_config.dart'), cfg);

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
    const y = (r() - 0.5) * [0.5, 4, 40, 2000][(k >> 2) % 4];
    trig.push([bits(x), bits(Math.sin(x)), bits(Math.cos(x)), bits(y), bits(Math.atan2(y, x))]);
  }
  fs.writeFileSync(path.join(OUT, 'test/fmath_parity.json'), JSON.stringify(trig));
  // قيم Math.exp وMath.pow التي يحتاجها المنطق بالضبط: تباطؤ الارتداد، وتسارع الاشتباك (1 − step)^n
  const steps = new Set();
  const walk = (v) => { if (v && typeof v === 'object') { if (v.combo && typeof v.combo.step === 'number') steps.add(v.combo.step); Object.values(v).forEach(walk); } };
  walk(CONFIG);
  const pows = [...steps].sort((a, b) => a - b).map(st => `  ${st}: [${Array.from({ length: 256 }, (_, n) => String(Math.pow(1 - st, n))).join(', ')}],`);
  fs.writeFileSync(path.join(OUT, 'lib/data/exact.dart'), `// مولّد بـ scripts/export_flutter_data.mjs: قيم محسوبة في V8 نفسه، فتطابق النسختان بالبت
// ignore_for_file: constant_identifier_names
// Math.exp(−COMBAT_REALISM.friction × TICK_SEC): تباطؤ الارتداد في كل تحديث (realism.js)
const FRICTION_DECAY = ${Math.exp(-CONFIG.COMBAT_REALISM.friction * CONFIG.TICK_SEC)};
// Math.pow(1 − step, n) لكل step في combo الوحدات، وn من 0 إلى 255 (بعدها أصغر من أن يغيّر الحد الأدنى) (comboAttackTime في combat.js)
final COMBO_POW = <double, List<double>>{
${pows.join('\n')}
};
`);
  console.log('cities.dart,', cases.length, 'map fingerprints and', trig.length, 'trig values written');
}
