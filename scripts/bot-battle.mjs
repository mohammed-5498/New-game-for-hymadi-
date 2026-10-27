// قياس قوة البوتات من سطر الأوامر (القسم 11.4)، بأقصى سرعة وبلا رسم:
//   node scripts/bot-battle.mjs hard medium 20 [perSide] [mapSize] [mirror|random] [ffa|teams]
// يطبع نسبة فوز البوت الأول على الثاني.
// SEED=1000: المباراة رقم k ببذرة 1000+k (نفس الخريطة والبداية في كل إعداد)، ويُطبع فائز كل مباراة في results:
// مقارنة إعدادين على نفس البذور أدق من مقارنة نسبتين عشوائيتين (النتائج تتشابه في المباريات التي لم يغيرها الإعداد)
import { runBattles } from '../js/ai/botBattle.js';
import * as config from '../js/config.js';

let seedState = 0;
const reseed = (seed) => { seedState = (seed * 7919 + 12345) >>> 0; };
if (process.env.SEED) {
  reseed(Number(process.env.SEED));
  Math.random = () => {
    seedState = (seedState + 0x6D2B79F5) >>> 0;
    let t = seedState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// للتجارب فقط: OVERRIDE='{"ai.levels.medium.minSquad":5}' يغيّر رقماً في config.js لهذا التشغيل
if (process.env.OVERRIDE) {
  for (const [path, value] of Object.entries(JSON.parse(process.env.OVERRIDE))) {
    const keys = path.split('.');
    let obj = config[keys[0]];
    for (const k of keys.slice(1, -1)) obj = obj[k];
    obj[keys[keys.length - 1]] = value;
  }
}

const [a = 'hard', b = 'medium', matches = '10', perSide = '1', mapSize = 'medium', gangs = 'mirror', format = 'ffa'] = process.argv.slice(2);
const t0 = Date.now();
let results = '';
const summary = runBattles({
  a, b, matches: Number(matches), perSide: Number(perSide), mapSize, mirror: gangs !== 'random', teams: format === 'teams',
  onMatch: (r, k) => {
    console.error(`#${k + 1} الفائز ${r.winner === 'a' ? a : r.winner === 'b' ? b : 'تعادل'} بعد ${(r.seconds / 60).toFixed(1)} د${r.timeout ? ' (انتهى الوقت)' : ''}`);
    results += r.winner || '-';
    if (process.env.SEED) reseed(Number(process.env.SEED) + k + 1);
  }
});
const seeded = process.env.SEED ? { seed: Number(process.env.SEED), results } : {};
console.log(JSON.stringify({ a, b, perSide: Number(perSide), mapSize, gangs, format, ...summary, ...seeded, realSeconds: Math.round((Date.now() - t0) / 1000) }));
