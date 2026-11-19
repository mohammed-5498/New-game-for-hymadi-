// بصمات مباريات البوتات للنقل (القسم 18): نفس البذرة في js/ والنسخة الجديدة تخرج نفس البصمة.
// مزايا المدن مفعّلة (ن8). البصمة كل ثانية في أول دقيقتين ثم كل 20 ثانية، حتى 10 دقائق.
// الاستعمال: node scripts/export_sim_parity.mjs [مباريات] > flutter_game/test/sim_parity.json
const repo = new URL('..', import.meta.url).pathname;
const CFG = await import(repo + 'js/config.js');
const { createBattle, stepBattle, battleResult } = await import(repo + 'js/ai/botBattle.js');
const { createMatch } = await import(repo + 'js/state.js');
const { updateMatch } = await import(repo + 'js/game/loop.js');

let seedState = 0;
Math.random = () => {
  seedState = (seedState + 0x6D2B79F5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function hashOf(state) {
  let h = 2166136261 >>> 0;
  const mix = (v) => { h = Math.imul(h ^ (Math.round(v * 1000) | 0), 16777619) >>> 0; };
  mix(state.units.length);
  for (const u of state.units) { mix(u.id); mix(u.x); mix(u.y); mix(u.hp); mix(u.state.length); mix(u.playerId); }
  for (const d of state.map.districts) { mix(d.owner === null ? -1 : d.owner); mix(d.progress); }
  for (const p of state.modeState.points || []) mix(p);
  return h;
}

// full: الشاشة تغطي الخريطة فكل الوحدات بالتفصيل الكامل (الحركات وردود الأفعال كلها)
const CASES = [
  { a: 'hard', b: 'medium', mirror: true, size: 'small' },
  { a: 'hard', b: 'medium', mirror: false, size: 'small' },
  { a: 'insane', b: 'easy', mirror: false, size: 'small' },
  { a: 'medium', b: 'easy', mirror: false, size: 'small', full: true },
  { a: 'hard', b: 'insane', mirror: false, size: 'medium', full: true, teams: true },
  { a: 'easy', b: 'hard', mirror: true, size: 'large', full: true },
];
// الأطوار الأربعة الأخرى والأمم الـ15 (ن7): إعداد مباراة كامل بلا لاعب، ويُقاد كل جانب ببوت
const NATIONS = CFG.nations.order;
const COLORS = CFG.PLAYER_COLORS.map(c => c.id);
const LEVELS = ['easy', 'medium', 'hard', 'insane'];
const player = (k, nation, team = 0, difficulty = LEVELS[k % 4]) =>
  ({ name: 'بوت ' + k, gang: CFG.nations[nation] ? CFG.nations[nation].style : nation, nation: CFG.nations[nation] ? nation : null,
     color: COLORS[k], isHuman: false, team, difficulty });
const MODE_CASES = [
  { mode: 'points', mapSize: 'small', modeOptions: { minutes: 5 }, players: ['yemen', 'saudi', 'egypt', 'china'].map((n, k) => player(k, n)) },
  { mode: 'king', mapSize: 'medium', modeOptions: { holdMinutes: 2 }, players: ['japan', 'korea', 'france', 'britain', 'germany'].map((n, k) => player(k, n)) },
  { mode: 'regicide', mapSize: 'small', players: ['ethiopia', 'nigeria', 'sudan', 'brazil'].map((n, k) => player(k, n, k % 2 + 1, 'hard')) },
  { mode: 'survival', mapSize: 'small', modeOptions: { level: 'hard' }, protagonistId: 0,
    players: ['argentina', 'mexico', 'crows'].map((n, k) => player(k, n, 1, 'medium')) },
  { mode: 'conquest', mapSize: 'large', full: true, players: NATIONS.slice(0, 8).map((n, k) => player(k, n)) },
  { mode: 'conquest', mapSize: 'medium', city: 'japan', players: NATIONS.slice(8).map((n, k) => player(k, n, k % 2 + 1)) },
];
// مزايا المدن (ن8): مباراة في كل مدينة من الـ24 بميزتها ومبناها وحدثها
for (const [k, city] of CFG.CITIES.order.entries()) {
  MODE_CASES.push({ mode: 'conquest', mapSize: 'small', city,
    players: [NATIONS[k % 15], 'crows', NATIONS[(k + 7) % 15]].map((n, q) => player(q, n, 0, ['medium', 'hard', 'insane'][(k + q) % 3])) });
}
// طور القصة (ن9): مراحل حملة اليمن الخمس كما تبنيها شاشة القصة (اللاعب لا يتحرك، والبوتات وقوات القصة تلعب)
const { storyPlayers } = await import(repo + 'js/game/story.js');
const { CAMPAIGNS } = await import(repo + 'js/story/campaigns.js');
for (let k = 0; k < CFG.STORY.levels; k++) {
  const camp = CAMPAIGNS.yemen;
  MODE_CASES.push({ mode: 'conquest', modeOptions: {}, city: camp.city, mapSize: CFG.STORY.mapSize[k], maxUnits: CFG.STORY.maxUnits,
    weather: camp.levels[k].weather || 'day', story: { campaign: 'yemen', level: k, bonus: k > 1 ? { points: CFG.STORY.rewards.points, district: true } : {} },
    players: storyPlayers('yemen', k, CFG.STORY.defaultDifficulty) });
}
const matches = Number(process.argv[2] || CASES.length);
const out = [];
for (let k = 0; k < matches; k++) {
  const c = CASES[k % CASES.length];
  const seed = (2000 + k) * 7919 + 12345 >>> 0;
  seedState = seed;
  const state = createBattle({ a: c.a, b: c.b, perSide: 2, mapSize: c.size, mirror: c.mirror, teams: !!c.teams });
  if (c.full) state.view = { w: 1e6, h: 1e6, dpr: 1 };
  const hashes = [hashOf(state)];
  let ticks = 0;
  while (ticks < 12000) {
    const step = ticks < 2400 ? 20 : 400;
    const done = stepBattle(state, step);
    ticks += step;
    hashes.push(hashOf(state));
    if (done) break;
  }
  const r = battleResult(state);
  out.push({ seed, ...c, city: state.map.city, hashes, winner: r.winner, seconds: Math.round(state.time) });
}
for (let k = 0; k < MODE_CASES.length; k++) {
  const c = MODE_CASES[k];
  const seed = (3000 + k) * 7919 + 12345 >>> 0;
  seedState = seed;
  const settings = JSON.parse(JSON.stringify({ maxUnits: 100, weather: 'day', city: 'random', ...c }));
  delete settings.full;
  const state = createMatch(settings);
  state.running = true;
  if (c.full) state.view = { w: 1e6, h: 1e6, dpr: 1 };
  const hashes = [hashOf(state)];
  let ticks = 0;
  while (ticks < 12000 && !state.matchResult) {
    const step = ticks < 2400 ? 20 : 400;
    for (let t = 0; t < step && !state.matchResult; t++) updateMatch(state);
    ticks += step;
    hashes.push(hashOf(state));
  }
  out.push({ seed, settings, full: !!c.full, city: state.map.city, hashes,
    result: state.matchResult ? state.matchResult.reason : null, seconds: Math.round(state.time) });
}
console.log(JSON.stringify(out));
