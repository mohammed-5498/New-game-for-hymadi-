// أداة قياس قوة البوتات (القسم 11.4): مباراة بوتات فقط، بلا لاعب وبلا رسم، تسجل الفائز والمدة
// النواة هنا لا تلمس الشاشة: تستعملها قائمة "معركة البوتات" في اللعبة، وسكربت القياس في Node.
import { ai, GANGS, PLAYER_COLORS, MATCH_DEFAULTS } from '../config.js';
import { createMatch } from '../state.js';
import { updateMatch } from '../game/loop.js';
import { isPlayerAlive } from '../game/victory.js';

const GANG_IDS = Object.keys(GANGS);

const shuffle = (list) => {
  for (let k = list.length - 1; k > 0; k--) {
    const r = Math.floor(Math.random() * (k + 1));
    [list[k], list[r]] = [list[r], list[k]];
  }
  return list;
};

// بوت "أ" ضد بوت "ب" (perSide لكل جانب، كل واحد بلا فريق)، بأماكن وألوان عشوائية.
// mirror: نفس العصابة للجانبين (الافتراضي) فلا يفرق بينهما إلا الذكاء، لأن العصابات غير متكافئة
// بين البوتات (الغربان تفوز 15% فقط ضد غيرها). وبدونه عصابة عشوائية لكل لاعب.
export function createBattle({ a, b, perSide = 1, mapSize = ai.battle.mapSize, maxUnits = MATCH_DEFAULTS.maxUnits, mirror = true }) {
  const gangs = shuffle([...GANG_IDS]);
  if (mirror) gangs.fill(gangs[0]);
  const colors = shuffle(PLAYER_COLORS.map(c => c.id));
  const sides = shuffle([...Array(perSide).fill('a'), ...Array(perSide).fill('b')]);
  const players = sides.map((side, k) => ({
    name: (side === 'a' ? 'أ' : 'ب') + (k + 1),
    gang: gangs[k % gangs.length],
    color: colors[k % colors.length],
    isHuman: false,
    team: 0,
    difficulty: side === 'a' ? a : b
  }));
  const state = createMatch({ mapSize, maxUnits, weather: 'day', mode: 'conquest', players });
  state.players.forEach((p, k) => { if (k < sides.length) p.battleSide = sides[k]; });
  state.running = true;
  state.battle = { a, b, maxSeconds: ai.battle.maxMinutes * 60 };
  return state;
}

// يتقدم عدداً من التحديثات، ويعيد true حين تنتهي المباراة (فوز أو انتهاء الحد الأقصى للوقت)
export function stepBattle(state, ticks) {
  for (let t = 0; t < ticks; t++) {
    if (state.matchResult || state.time >= state.battle.maxSeconds) return true;
    updateMatch(state);
  }
  return !!state.matchResult || state.time >= state.battle.maxSeconds;
}

// الفائز: الجانب الباقي وحده، وإلا (انتهى الوقت) صاحب الأحياء الأكثر ثم الجيش الأكبر
export function battleResult(state) {
  const score = { a: { alive: 0, districts: 0, units: 0 }, b: { alive: 0, districts: 0, units: 0 } };
  for (const p of state.players) {
    if (!p.battleSide) continue;
    const s = score[p.battleSide];
    if (isPlayerAlive(state, p.id)) s.alive++;
  }
  for (const d of state.map.districts) {
    const owner = d.owner !== null ? state.players[d.owner] : null;
    if (owner && owner.battleSide) score[owner.battleSide].districts++;
  }
  for (const u of state.units) {
    const owner = state.players[u.playerId];
    if (u.state !== 'dead' && owner.battleSide) score[owner.battleSide].units++;
  }
  const timeout = !state.matchResult;
  let winner = null;
  if (score.a.alive && !score.b.alive) winner = 'a';
  else if (score.b.alive && !score.a.alive) winner = 'b';
  else if (score.a.districts !== score.b.districts) winner = score.a.districts > score.b.districts ? 'a' : 'b';
  else if (score.a.units !== score.b.units) winner = score.a.units > score.b.units ? 'a' : 'b';
  const gangs = {};
  for (const p of state.players) if (p.battleSide) gangs[p.battleSide] = p.gang;
  return { winner, timeout, seconds: state.time, score, gangs };
}

// عدة مباريات متتالية (للقياس في Node: بأقصى سرعة بلا انتظار)
export function runBattles({ a, b, matches, perSide, mapSize, mirror, onMatch }) {
  const results = [];
  for (let k = 0; k < matches; k++) {
    const state = createBattle({ a, b, perSide, mapSize, mirror });
    while (!stepBattle(state, 2000)) { /* حتى النهاية */ }
    const result = battleResult(state);
    results.push(result);
    if (onMatch) onMatch(result, k);
  }
  return summarize(results);
}

export function summarize(results) {
  const n = results.length || 1;
  const wins = results.filter(r => r.winner === 'a').length;
  const losses = results.filter(r => r.winner === 'b').length;
  return {
    matches: results.length,
    wins, losses,
    draws: results.length - wins - losses,
    timeouts: results.filter(r => r.timeout).length,
    winRate: wins / n,
    avgMinutes: results.reduce((s, r) => s + r.seconds, 0) / n / 60
  };
}
