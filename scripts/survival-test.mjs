// قياس صعوبة الصمود (9.5.5): بوت يلعب بدل اللاعب حتى يسقط، ويُطبع رقم الموجة التي وصل إليها
//   node scripts/survival-test.mjs hard 10 [bot]
// الهدف مع بوت صعب: سهل 12-15، متوسط 8-10، صعب 6-8، مجنون 4-5
import { runSurvival } from '../js/ai/botBattle.js';
import * as config from '../js/config.js';

// للتجارب فقط: OVERRIDE='{"ai.levels.hard.minSquad":5}' يغيّر رقماً في config.js لهذا التشغيل
if (process.env.OVERRIDE) {
  for (const [path, value] of Object.entries(JSON.parse(process.env.OVERRIDE))) {
    const keys = path.split('.');
    let obj = config[keys[0]];
    for (const k of keys.slice(1, -1)) obj = obj[k];
    obj[keys[keys.length - 1]] = value;
  }
}

const [level = 'medium', runs = '10', bot = 'hard'] = process.argv.slice(2);
const t0 = Date.now();
const r = runSurvival({
  level, bot, matches: Number(runs),
  onMatch: (wave, seconds, k) => console.error(`#${k + 1} وصل إلى الموجة ${wave} بعد ${(seconds / 60).toFixed(1)} د`)
});
console.log(JSON.stringify({ ...r, realSeconds: Math.round((Date.now() - t0) / 1000) }));
