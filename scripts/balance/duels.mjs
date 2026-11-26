// معارك الفئات (GAME_SPEC 18.24): جيشان بالسعر نفسه (أو بالعدد نفسه)، بلا اقتصاد. الاستعمال في README.md هنا
//   node scripts/balance/duels.mjs <comp> <cost|count> <size> <seeds>
const R = process.env.JSROOT || new URL('../../js', import.meta.url).pathname;
const C = await import(R + '/config.js');
if (process.env.OVERRIDE) for (const [path, value] of Object.entries(JSON.parse(process.env.OVERRIDE))) {
  const keys = path.split('.'); let obj = C[keys[0]];
  for (const k of keys.slice(1, -1)) obj = obj[k];
  obj[keys[keys.length - 1]] = value;
}
const { createMatch } = await import(R + '/state.js');
const { updateMatch } = await import(R + '/game/loop.js');
const { createUnit, commandAttackMove } = await import(R + '/game/units.js');
const { findFreeTiles } = await import(R + '/map/pathfinding.js');

let seedState = 0;
Math.random = () => {
  seedState = (seedState + 0x6D2B79F5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const [comp = 'mix', mode = 'cost', size = '300', seeds = '6'] = process.argv.slice(2);
const SP = C.STYLE_PERKS, E = C.EMPIRE;
const STRONG = { crows: 'dual', hammers: 'armored', vipers: 'firebomber', scorpions: 'medic' };
const price = (g, kind) => E.units[kind].cost * ((SP.classes[g] || {}).price || 1);
const PATTERN = comp === 'mix' ? ['common', 'common', 'strong', 'common', 'common', 'elite', 'common', 'strong']   // 5:2:1
  : comp === 'early' ? ['common', 'common', 'strong', 'common', 'common', 'elite', 'common', 'strong'] : comp === 'cs' ? ['common', 'common', 'strong'] : comp === 'ce' ? ['common', 'common', 'common', 'elite'] : comp === 'lc' ? ['common'] : [comp];   // أو مع نوع واحد، أو نوع واحد
function army(g) {
  const lead = comp === 'lc' || comp === 'early';   // early: البطل وخليط البوت 5:2:1 كما في أول المباراة
  const out = lead ? ['leader'] : [];
  let spent = lead ? price(g, 'leader') : 0, k = 0;
  for (;;) {
    const kind = PATTERN[k % PATTERN.length];
    if (mode === 'count' ? out.length >= +size : spent + price(g, kind) > +size) break;
    out.push(kind); spent += price(g, kind); k++;
  }
  return { kinds: out, spent };
}
const alive = (u) => u.state !== 'dead' && u.hp > 0;
function duel(ga, gb, seed) {
  seedState = (seed * 7919 + 12345) >>> 0;
  const s = createMatch({ mapSize: 'large', city: 'chicago', maxUnits: 300, weather: 'day', arena: true,
    players: [{ name: 'a', gang: ga, color: 'red', isHuman: true, team: 0, difficulty: 'medium' },
              { name: 'b', gang: gb, color: 'blue', isHuman: true, team: 1, difficulty: 'medium' }] });
  const m = s.map, c = m.n >> 1;
  let A = [c - 7, c], B = [c + 7, c];
  if (process.env.STREET) {   // شارع حقيقي: أطول خط مستقيم ممشى قرب الوسط، والجيشان على طرفيه
    let best = null;
    for (let j = 4; j < m.n - 4; j++) for (let i0 = 2; i0 < m.n - 2; i0++) {
      if (!m.isWalkable(i0, j) || m.isWalkable(i0 - 1, j)) continue;
      let i1 = i0; while (m.isWalkable(i1 + 1, j)) i1++;
      const len = i1 - i0, mid = Math.abs((i0 + i1) / 2 - c) + Math.abs(j - c);
      if (len >= 16 && (!best || mid < best.mid)) best = { i0, i1, j, mid };
    }
    const L = Math.min(14, best.i1 - best.i0 - 2), ci = Math.round((best.i0 + best.i1) / 2);
    A = [ci - (L >> 1), best.j]; B = [ci + (L >> 1), best.j];
  } else for (let i = c - 16; i <= c + 16; i++) for (let j = c - 10; j <= c + 10; j++) { const k = m.idx(i, j); m.road[k] = 1; m.type[k] = '.'; }
  s.units = []; s.projectiles = []; s.fires = []; s.pathQueue = [];
  const TR = +(process.env.TRICKLE || 0);   // التدفق: كل فرد يصل بعد السابق بهذا العدد من الثواني بدل الجيش كله معاً
  const sides = [[ga, s.players[0], A], [gb, s.players[1], B]].map(([g, p, at]) => {
    const a = army(g), tiles = findFreeTiles(m, at[0], at[1], a.kinds.length, 14), units = [], queue = [];
    a.kinds.forEach((kind, n) => {
      const [i, j] = tiles[n % tiles.length];
      const hero = kind === 'common' || kind === 'leader' ? null : kind === 'strong' ? STRONG[g] : E.elite[g];
      if (TR && n > 0) { queue.push({ i, j, hero, leader: kind === 'leader', at: n * TR, p }); return; }
      const u = createUnit(s, p, i, j, hero, kind === 'leader'); if (process.env.ULTFULL) u.ultCharge = 100; s.units.push(u); units.push(u);
    });
    return { g, units, spent: a.spent, queue, home: at };
  });
  if (process.env.BOTTAC) {   // تكتيك البوت المتوسط (تركيز الضرب والضربات الذكية) بلا قراراته الكبرى
    for (const p of s.players.slice(0, 2)) p.isHuman = false;
    s.botTimers = s.players.map(() => 1e9);
  }
  s.camera.x = 0; s.camera.y = c * 2 * 9; s.camera.z = 1;
  if (process.env.LOD === 'stat') { s.view.w = 10; s.view.h = 10; s.camera.x = 99999; }
  commandAttackMove(s, B[0], B[1], sides[0].units, false);
  commandAttackMove(s, A[0], A[1], sides[1].units, false);
  s.camera.x = ((A[0] + B[0]) / 2 - (A[1] + B[1]) / 2) * 18; s.camera.y = ((A[0] + B[0]) / 2 + (A[1] + B[1]) / 2) * 9;
  let t = 0;
  while (t < 20 * 240) {
    updateMatch(s); t++;
    if (TR) for (const [n, side] of sides.entries()) while (side.queue.length && side.queue[0].at * 20 <= t) {
      const q = side.queue.shift(), u = createUnit(s, q.p, q.i, q.j, q.hero, q.leader); if (process.env.ULTFULL) u.ultCharge = 100; s.units.push(u); side.units.push(u);
      const to = sides[1 - n].home; commandAttackMove(s, to[0], to[1], [u], false);
    }
    if (t % 40 === 0) for (const side of sides) {   // من وقف بلا عدو يعاود الهجوم
      const idle = side.units.filter((u) => alive(u) && u.state === 'idle');
      const foe = sides.find((x) => x !== side).units.filter(alive);
      if (idle.length && foe.length) commandAttackMove(s, Math.round(foe[0].x), Math.round(foe[0].y), idle, false);
    }
    if ((!sides[0].units.some(alive) && !sides[0].queue.length) || (!sides[1].units.some(alive) && !sides[1].queue.length)) break;
  }
  const left = sides.map((side) => side.units.filter(alive).reduce((a, u) => a + u.hp / u.maxHp * price(side.g, u.champion ? 'leader' : !u.hero ? 'common' : u.hero === STRONG[side.g] ? 'strong' : 'elite'), 0) / side.spent);
  return { win: left[0] > 0 && left[1] <= 0 ? 0 : left[1] > 0 && left[0] <= 0 ? 1 : -1, left, secs: t / 20, n: sides.map((x) => x.units.length) };
}
const G = C.GANG_IDS, score = {}, cell = {};
for (const g of G) score[g] = { w: 0, n: 0, val: 0 };
for (let x = 0; x < G.length; x++) for (let y = x + 1; y < G.length; y++) {
  const a = G[x], b = G[y]; let wa = 0, n = 0, va = 0, vb = 0, secs = 0, counts;
  for (let k = 0; k < +seeds; k++) for (const swap of [false, true]) {
    const r = swap ? duel(b, a, 100 + k) : duel(a, b, 100 + k);
    const ia = swap ? 1 : 0, ib = 1 - ia;
    if (r.win === ia) wa += 1; else if (r.win === -1) wa += 0.5;
    va += r.left[ia]; vb += r.left[ib]; secs += r.secs; n++; counts = swap ? [r.n[1], r.n[0]] : r.n;
  }
  cell[`${a}-${b}`] = { winA: +(wa / n).toFixed(2), leftA: +(va / n).toFixed(2), leftB: +(vb / n).toFixed(2), secs: +(secs / n).toFixed(0), units: counts };
  score[a].w += wa; score[a].n += n; score[b].w += n - wa; score[b].n += n;
  score[a].val += va - vb; score[b].val += vb - va;
}
if (process.env.JSONOUT) { console.log(JSON.stringify(Object.fromEntries(Object.entries(cell).map(([k, v]) => [k, +(v.leftA - v.leftB).toFixed(3)])))); process.exit(0); }
if (process.env.BRIEF) { console.log(process.env.BRIEF + ' ' + G.map((g) => g.slice(0, 3) + ' ' + String(Math.round(score[g].w / score[g].n * 100)).padStart(3) + '%' + String(Math.round(score[g].val / score[g].n * 100)).padStart(4)).join('  ') + '  | ' + Object.entries(cell).map(([k, v]) => k.split('-').map((x) => x.slice(0, 1)).join('') + String(Math.round((v.leftA - v.leftB) * 100)).padStart(4)).join(' ')); process.exit(0); }
console.log(JSON.stringify({ comp, mode, size: +size, seeds: +seeds, override: process.env.OVERRIDE || null }));
console.table(cell);
console.table(Object.fromEntries(G.map((g) => [g, { winRate: +(score[g].w / score[g].n).toFixed(2), valueEdge: +(score[g].val / score[g].n).toFixed(2) }])));
