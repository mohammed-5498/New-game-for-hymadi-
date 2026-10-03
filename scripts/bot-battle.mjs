// قياس قوة البوتات من سطر الأوامر (القسم 11.4)، بأقصى سرعة وبلا رسم:
//   node scripts/bot-battle.mjs hard medium 20 [perSide] [mapSize] [mirror|random]
// يطبع نسبة فوز البوت الأول على الثاني.
import { runBattles } from '../js/ai/botBattle.js';
import * as config from '../js/config.js';

// للتجارب فقط: OVERRIDE='{"ai.levels.medium.minSquad":5}' يغيّر رقماً في config.js لهذا التشغيل
if (process.env.OVERRIDE) {
  for (const [path, value] of Object.entries(JSON.parse(process.env.OVERRIDE))) {
    const keys = path.split('.');
    let obj = config[keys[0]];
    for (const k of keys.slice(1, -1)) obj = obj[k];
    obj[keys[keys.length - 1]] = value;
  }
}

const [a = 'hard', b = 'medium', matches = '10', perSide = '1', mapSize = 'medium', gangs = 'mirror'] = process.argv.slice(2);
const t0 = Date.now();
const summary = runBattles({
  a, b, matches: Number(matches), perSide: Number(perSide), mapSize, mirror: gangs !== 'random',
  onMatch: (r, k) => console.error(`#${k + 1} الفائز ${r.winner === 'a' ? a : r.winner === 'b' ? b : 'تعادل'} بعد ${(r.seconds / 60).toFixed(1)} د${r.timeout ? ' (انتهى الوقت)' : ''}`)
});
console.log(JSON.stringify({ a, b, perSide: Number(perSide), mapSize, gangs, ...summary, realSeconds: Math.round((Date.now() - t0) / 1000) }));
