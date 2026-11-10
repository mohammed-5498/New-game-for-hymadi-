// وضعيات الأنميشن للنسخة الجديدة (القسم 18): مفاتيح js/render/anim.js وfightAnim.js كما يحسبها JavaScript نفسه،
// فتتحرك الشخصيات بالأرقام نفسها. المخرج: flutter_game/lib/data/poses.dart
// كل وضعية 18 رقماً: px py pl cb ht hdx hdy fhx fhy bhx bhy wa tf kf tb kb air tw (والغائب NaN: tw في وضعيات المرجع)
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const repo = new URL('..', import.meta.url).pathname;
// fightAnim.js لا يصدّر جداوله: نسخة مؤقتة تصدّرها، باستيراداتها مسارات كاملة
const dir = mkdtempSync(join(tmpdir(), 'poses-'));
const src = readFileSync(repo + 'js/render/fightAnim.js', 'utf8')
  .replace("'../config.js'", `'${repo}js/config.js'`).replace("'./anim.js'", `'${repo}js/render/anim.js'`) +
  '\nexport { N, BIG, GUARDS, BIG_GUARD, KNOCK, DEATH_BACK, DEATH_FRONT };\n';
writeFileSync(join(dir, 'f.mjs'), src);
const F = await import(join(dir, 'f.mjs'));
const A = await import(repo + 'js/render/anim.js');

const FIELDS = ['px', 'py', 'pl', 'cb', 'ht', 'hdx', 'hdy', 'fh0', 'fh1', 'bh0', 'bh1', 'wa', 'tf', 'kf', 'tb', 'kb', 'air', 'tw'];
const poses = [], seen = new Map();
const num = (v) => v === undefined ? 'nan' : Object.is(v, -0) ? '0' : String(v);
function idx(p) {
  const v = FIELDS.map(f => f === 'fh0' ? p.fh[0] : f === 'fh1' ? p.fh[1] : f === 'bh0' ? p.bh[0] : f === 'bh1' ? p.bh[1] : p[f]);
  const key = v.map(num).join(',');
  if (!seen.has(key)) { seen.set(key, poses.length); poses.push(key); }
  return seen.get(key);
}
const EASES = { undefined: 0, in: 1, out: 2, lin: 3 };
const keys = (list) => '[' + list.map(([t, p, e]) => `(${t}, ${idx(p)}, ${EASES[e]})`).join(', ') + ']';
const table = (obj) => '{' + Object.entries(obj).map(([k, v]) => `'${k}': ${keys(v)}`).join(', ') + '}';
const nested = (obj) => '{\n' + Object.entries(obj).map(([k, v]) => `  '${k}': ${table(v)},`).join('\n') + '\n}';
const single = (obj) => '{' + Object.entries(obj).map(([k, p]) => `'${k}': ${idx(p)}`).join(', ') + '}';

const out = [];
out.push(`const ATK = ${table(A.ATK)};`);
out.push(`const DODGE = ${table(A.DODGE)};`);
out.push(`const BLOCK = ${keys(A.BLOCK)};`);
out.push(`const NODES = ${nested(F.N)};`);
out.push(`const BIG_NODES = ${nested(F.BIG)};`);
out.push(`const GUARDS = ${single(F.GUARDS)};`);
out.push(`const BIG_GUARDS = ${single(F.BIG_GUARD)};`);
out.push(`const DEATH_BACK = ${keys(F.DEATH_BACK)};`);
out.push(`const DEATH_FRONT = ${keys(F.DEATH_FRONT)};`);
out.push(`const KNOCK = ${idx(F.KNOCK)};`);
out.push(`const BASE = ${idx(A.BASE)};`);
out.push(`const G = ${idx(A.G)};`);
// poseDown: وضعيتا النهوض (P في anim.js)
out.push(`const DOWN_LIE = ${idx(A.P({ py: -9, pl: 0.1, cb: 0.22, ht: 0.35, fh: [5.5, -6], bh: [-4.5, -12.5], wa: 0.8, tf: 0.65, kf: 0.85, tb: -0.3, kb: 0.6 }))};`);
out.push(`const DOWN_KNEEL = ${idx(A.P({ py: -7, pl: 0.48, cb: 0.34, ht: 0.22, fh: [4, -8], bh: [1, -7], tf: 1.25, kf: 1.95, tb: -0.3, kb: 1.85 }))};`);
const body = `// مولّد بـ scripts/export_flutter_poses.mjs من js/render/anim.js وfightAnim.js: لا تعدّله باليد
// كل وضعية 18 رقماً: px py pl cb ht hdx hdy fhx fhy bhx bhy wa tf kf tb kb air tw (nan = غائب)، والمفتاح (زمن، وضعية، تسارع)
// تسارع: 0 ease، 1 in، 2 out، 3 lin
// ignore_for_file: constant_identifier_names
const nan = double.nan;
const POSES = <List<double>>[
${poses.map(p => '  [' + p + '],').join('\n')}
];
${out.join('\n')}
`;
writeFileSync(repo + 'flutter_game/lib/data/poses.dart', body);

// أجزاء صور الشخصيات (js/render/unitSpritesData.js من scripts/slice_units.py): الكلاسيكية الأربع والأمم الـ15 والشرطة،
// ومقاسات مظاهر الأمم من BODIES (nationArt.js) لكل مفتاح: [sx, sy, عرض الخط, طول السلاح, باليدين, عرض الظل, زينة القدمين]
globalThis.document ??= { createElement: () => ({ getContext: () => ({}) }) };
const { SPRITES } = await import(repo + 'js/render/unitSpritesData.js');
const { BODIES } = await import(repo + 'js/render/bodies.js');
for (const f of ['Arab', 'Asia', 'Europe', 'Africa', 'Latin']) await import(repo + `js/render/nations${f}.js`);
const dart = (v) => Array.isArray(v) ? '[' + v.map(dart).join(', ') + ']'
  : v && typeof v === 'object' ? '<String, Object?>{' + Object.entries(v).map(([k, x]) => `'${k}': ${dart(x)}`).join(', ') + '}'
  : typeof v === 'string' ? `'${v}'` : String(v);
const gangs = {}, bodies = {};
const ground = { heroRing: 'r', auraRing: 'boss', auraHealRings: 'medic' };
for (const [g, G] of Object.entries(SPRITES.gangs)) {
  gangs[g] = { src: G.src.replace(/^\.\.\//, ''), h: G.h, sat: G.sat, val: G.val, units: G.units };
  for (const key of Object.keys(G.units)) {
    if (!G.units[key]._) continue;
    for (const k of [key, key + '_away']) {
      const b = BODIES[k];
      if (b) bodies[k] = [b.sx || 1, b.sy || 1, b.lw || 3, b.wlen || 4, !!b.twoH, b.shadowW || 0, (b.ground && ground[b.ground.name]) || ''];
    }
  }
}
writeFileSync(repo + 'flutter_game/lib/data/unit_sprites.dart', `// مولّد بـ scripts/export_flutter_poses.mjs من js/render/unitSpritesData.js وBODIES: لا تعدّله باليد
// كل جزء: [x, y, عرض, ارتفاع, مفصلX, مفصلY, زاوية محوره في الصورة، ثم للسلاح: مقياسه, بُعد طرفه, مؤخرته] (والإزار: بُعد حاشيته)
// و'_' في وحدات الأمم والشرطة: طريقة حمل كل قطعة (uses) وعدد السهام والنار والسلاح الثاني
// ignore_for_file: constant_identifier_names
const double SPRITE_UPP = ${SPRITES.upp};
const Map<String, Object?> SPRITE_GANGS = ${dart(gangs)};
const Map<String, Object?> NATION_BODIES = ${dart(bodies)};
`);
console.log('unit_sprites.dart written');
console.log('poses.dart:', poses.length, 'poses');
