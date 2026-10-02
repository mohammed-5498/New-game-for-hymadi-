// قياس قوة البوتات من سطر الأوامر (القسم 11.4)، بأقصى سرعة وبلا رسم:
//   node scripts/bot-battle.mjs hard medium 20 [perSide] [mapSize]
// يطبع نسبة فوز البوت الأول على الثاني.
import { runBattles } from '../js/ai/botBattle.js';

const [a = 'hard', b = 'medium', matches = '10', perSide = '1', mapSize = 'medium'] = process.argv.slice(2);
const t0 = Date.now();
const summary = runBattles({
  a, b, matches: Number(matches), perSide: Number(perSide), mapSize,
  onMatch: (r, k) => console.error(`#${k + 1} الفائز ${r.winner === 'a' ? a : r.winner === 'b' ? b : 'تعادل'} بعد ${(r.seconds / 60).toFixed(1)} د${r.timeout ? ' (انتهى الوقت)' : ''}`)
});
console.log(JSON.stringify({ a, b, perSide: Number(perSide), mapSize, ...summary, realSeconds: Math.round((Date.now() - t0) / 1000) }));
