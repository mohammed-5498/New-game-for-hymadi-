// مباريات كاملة بين بوتات الفئات (GAME_SPEC 18.24): الأربع الكل ضد الكل، أو زوج واحد بـ PAIR، ويُسجَّل فائز كل مباراة بفئته
//   node scripts/balance/matches.mjs <matches> <firstSeed> [mapSize]   (الخيارات في README.md هنا)
const R = process.env.JSROOT || new URL('../../js', import.meta.url).pathname;
const C = await import(R + '/config.js');
// OVERRIDE='{"HEROES.sniper.stats.damage":30}' يغيّر أرقاماً في config.js لهذا التشغيل وحده
if (process.env.OVERRIDE) for (const [path, value] of Object.entries(JSON.parse(process.env.OVERRIDE))) {
  const keys = path.split('.'); let obj = C[keys[0]];
  for (const k of keys.slice(1, -1)) obj = obj[k];
  obj[keys[keys.length - 1]] = value;
}
let seedState = 0;
Math.random = () => {
  seedState = (seedState + 0x6D2B79F5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const { createMatch } = await import(R + '/state.js');
const { updateMatch } = await import(R + '/game/loop.js');
const { isPlayerAlive } = await import(R + '/game/victory.js');
const [matches = '8', first = '1000', mapSize = 'medium'] = process.argv.slice(2);
const G = C.GANG_IDS, wins = Object.fromEntries(G.map((g) => [g, 0])), out = [];
const PAIR = process.env.PAIR ? process.env.PAIR.split(',') : null;
const MIR = !!process.env.MIRROR;   // كل بذرة مرتين بالمكانين معكوسين، فيلغى أثر المكان (بدونه تنحاز بذور بعينها)
for (let k = 0; k < +matches; k++) {
  seedState = ((+first + (MIR ? k >> 1 : k)) * 7919 + 12345) >>> 0;
  const order = PAIR ? (k % 2 ? [PAIR[1], PAIR[0]] : PAIR) : [0, 1, 2, 3].map((n) => G[(n + k) % 4]);   // كل فئة في كل مكان بالتناوب
  const s = createMatch({ mapSize, maxUnits: 100, weather: 'day', mode: 'conquest', city: 'random',
    players: order.map((g, n) => ({ name: g + n, gang: g, color: ['red', 'green', 'yellow', 'purple'][n], isHuman: false, team: 0,
      difficulty: process.env.LEVEL || 'medium' })) });
  s.running = true;
  s.battle = { a: 'medium', b: 'medium', maxSeconds: 40 * 60 };
  s.players.forEach((p, n) => { if (n < order.length) p.battleSide = 'a'; });
  while (!s.matchResult && s.time < 40 * 60) {
    updateMatch(s);
    // STATS=1: كل دقيقة للدقائق الخمس الأولى أحياء كل لاعب وجنوده وما كسب وقتلاه وخسائره (على stderr)
    if (process.env.STATS && Math.round(s.time * 20) % 1200 === 0 && s.time <= 300) for (let pid = 0; pid < order.length; pid++) {
      const ms = s.modeState || s.empire;
      console.error('STAT ' + JSON.stringify({ g: s.players[pid].gang, m: Math.round(s.time / 60),
        d: s.map.districts.filter((d) => d.owner === pid).length, u: s.units.filter((u) => u.playerId === pid && u.state !== 'dead').length,
        earned: Math.round(ms.earned[pid]), k: s.stats.kills[pid], l: s.stats.losses[pid] }));
    }
    if (s.players.filter((p, n) => n < order.length && isPlayerAlive(s, p.id)).length <= 1) break;
  }
  // الفائز: الباقي حياً، ثم صاحب أكثر الأحياء إن بلغت المباراة 40 دقيقة
  const ranked = s.players.slice(0, order.length).map((p) => ({ g: p.gang, alive: isPlayerAlive(s, p.id), d: s.map.districts.filter((d) => d.owner === p.id).length }))
    .sort((a, b) => (b.alive - a.alive) || (b.d - a.d));
  wins[ranked[0].g]++;
  out.push(`${ranked[0].g}@${(s.time / 60).toFixed(1)}`);
}
console.log(JSON.stringify({ override: process.env.OVERRIDE || null, wins, games: out.join(' ') }));
