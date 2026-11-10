// بصمات مباريات البوتات للنقل (القسم 18): نفس البذرة في js/ والنسخة الجديدة تخرج نفس البصمة.
// مزايا المدن مطفأة (لم تُنقل بعد، ن8). البصمة كل ثانية في أول دقيقتين ثم كل 20 ثانية، حتى 10 دقائق.
// الاستعمال: node scripts/export_sim_parity.mjs [مباريات] > flutter_game/test/sim_parity.json
const repo = new URL('..', import.meta.url).pathname;
const CFG = await import(repo + 'js/config.js');
for (const k of ['cities', 'buildings', 'events']) for (const c of Object.keys(CFG.CITY_FEATURES[k])) delete CFG.CITY_FEATURES[k][c];
const { createBattle, stepBattle, battleResult } = await import(repo + 'js/ai/botBattle.js');

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
console.log(JSON.stringify(out));
