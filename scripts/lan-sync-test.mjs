// فحص اللعب المحلي (القسم 16): مضيف ومنضم في عملية واحدة بشبكة وهمية بتأخير عشوائي، وأوامر عشوائية من الطرفين.
// يقارن بصمة المباراة عند الجهازين في نفس التحديث: يجب أن تتطابق دائماً. ثم يُفسد المنضم عمداً في منتصف المدة،
// فيجب أن يكتشف المضيف الاختلاف ويعيد المزامنة وتتطابق البصمتان بعدها.
//   node scripts/lan-sync-test.mjs [ثوانٍ] [conquest|points|king|regicide] [small|medium|large] [مدينة]
// شغّله بعد أي تعديل في المحاكاة: Math.random أو شيء يخص جهازاً واحداً داخل التحديث يكسر التطابق
import { createMatch } from '../js/state.js';
import * as LS from '../js/net/lockstep.js';
import { packMatch, unpackMatch } from '../js/matchSave.js';
import { EMPIRE } from '../js/config.js';

const seconds = +(process.argv[2] || 60), mode = process.argv[3] || 'conquest', mapSize = process.argv[4] || 'small', city = process.argv[5] || 'random';
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
Math.random = rnd;          // الخريطة والبذرة عند المضيف قابلة للتكرار (والمحاكاة نفسها لا تستعمله)

const base = createMatch({
  mode, modeOptions: { minutes: 5, holdMinutes: 2 }, mapSize, city, maxUnits: 60, weather: 'day',
  players: [
    { name: 'المضيف', gang: 'crows', color: 'blue', isHuman: true, team: 0, difficulty: 'medium' },
    { name: 'صاحبي', gang: 'hammers', color: 'red', isHuman: true, team: 0, difficulty: 'medium' },
    { name: 'بوت 1', gang: 'vipers', color: 'green', isHuman: false, team: 0, difficulty: 'hard' },
    { name: 'بوت 2', gang: 'scorpions', color: 'yellow', isHuman: false, team: 0, difficulty: 'medium' }
  ]
});
LS.prepareLanMatch(base);
const text = packMatch(base);
const host = { view: { w: 900, h: 420, dpr: 1 } }, client = { view: { w: 800, h: 400, dpr: 1 } };
unpackMatch(host, text); host.humanId = 0;
unpackMatch(client, text); client.humanId = 1;

// شبكة وهمية: كل رسالة تصل بعد 5..60 ملي ث، بالترتيب في كل اتجاه (كاتصال TCP)
let now = 0;
const toClient = [], toHost = [];
const sendLater = (queue, msg) => {
  const last = queue.length ? queue[queue.length - 1].at : 0;
  queue.push({ at: Math.max(last, now + 5 + rnd() * 55), msg: JSON.parse(JSON.stringify(msg)) });
};
const deliver = (queue, L, state, fromSlot) => {
  while (queue.length && queue[0].at <= now) LS.receive(L, state, queue.shift().msg, fromSlot);
};
let resyncs = 0;
const H = LS.createLockstep('host', (to, msg) => sendLater(toClient, msg), 0);
const C = LS.createLockstep('client', (to, msg) => sendLater(toHost, msg), 1, { onResync: () => resyncs++ });

const pick = (list) => list[Math.floor(rnd() * list.length)];

// الاقتصاد: إنتاج في قاعدة، أو ترقية، أو بناء في حي، أو ترقية مبنى (وما لا تكفيه النقاط يُرفض عند الجميع)
function empireCommand(state, L) {
  const own = state.map.districts.filter(d => d.owner === L.slot && d.capture);
  const r = rnd();
  const d = r < 0.4 ? pick(own.filter(x => x.building === 'hq')) : r < 0.7 ? pick(own.filter(x => !x.building)) : pick(own.filter(x => x.building));
  if (r < 0.4 && d) LS.localCommand(L, { k: 'emp', a: 'queue', d: d.id, x: pick(EMPIRE.units.order) });
  else if (r < 0.55) LS.localCommand(L, { k: 'emp', a: 'upgrade', d: 0, x: pick(EMPIRE.upgrades.order) });
  else if (r < 0.7 && d) LS.localCommand(L, { k: 'emp', a: 'build', d: d.id, x: pick(EMPIRE.buildings.order) });
  else if (d) LS.localCommand(L, { k: 'emp', a: 'improve', d: d.id, x: pick(EMPIRE.buildings[d.building].upgrades.order) });
}

function randomCommand(state, L) {
  if (state.economy && rnd() < 0.5) { empireCommand(state, L); return; }
  const mine = state.units.filter(u => u.playerId === L.slot && u.state !== 'dead');
  if (!mine.length) return;
  const u = mine.filter(() => rnd() < 0.5).map(x => x.id);
  if (!u.length) u.push(mine[0].id);
  const r = rnd(), n = state.map.n;
  if (r < 0.4) LS.localCommand(L, { k: 'move', u, i: Math.floor(rnd() * n), j: Math.floor(rnd() * n) });
  else if (r < 0.8) LS.localCommand(L, { k: 'amove', u, i: Math.floor(rnd() * n), j: Math.floor(rnd() * n) });
  else {
    const enemies = state.units.filter(x => x.playerId !== L.slot && x.state !== 'dead');
    if (enemies.length) LS.localCommand(L, { k: 'attack', u, t: enemies[Math.floor(rnd() * enemies.length)].id });
  }
}

const seen = new Map();
const tally = { before: [0, 0], after: [0, 0] };      // [مقارنات، اختلافات] قبل الإفساد، وبعد إعادة المزامنة
let corrupted = false;
const end = seconds * 1000;
while (now < end && !(host.matchResult && client.matchResult)) {
  const frame = 12 + rnd() * 14;                   // إطارات غير منتظمة
  now += frame;
  deliver(toHost, H, host, 1);
  deliver(toClient, C, client, 0);
  if (rnd() < 0.02) randomCommand(host, H);
  if (rnd() < 0.02) randomCommand(client, C);
  host.camera.x += (rnd() - 0.5) * 8; client.camera.y += (rnd() - 0.5) * 8;
  LS.sendCamera(H, host, now); LS.sendCamera(C, client, now);
  LS.stepFrame(H, host, frame);
  LS.stepFrame(C, client, frame);
  for (const [state, tag] of [[host, 'h'], [client, 'c']]) {
    if (state.netTick % 20) continue;
    const k = state.netTick, h = LS.hashState(state), other = seen.get(k);
    if (!other) { seen.set(k, { tag, h }); continue; }
    if (other.tag === tag) continue;
    seen.delete(k);
    const t = !corrupted ? tally.before : resyncs ? tally.after : null;
    if (t) { t[0]++; if (other.h !== h) t[1]++; }
  }
  if (!corrupted && now > end / 2) {                // إفساد متعمد: جندي يتحرك عند المنضم وحده
    corrupted = true;
    client.units.find(x => x.state !== 'dead').x += 1.5;
  }
}

const ok = tally.before[0] > 0 && tally.before[1] === 0 && resyncs >= 1 && tally.after[0] > 0 && tally.after[1] === 0;
const economy = host.modeState.points ? { city: host.map.city, points: host.modeState.points.map(Math.floor),
  buildings: host.map.districts.filter(d => d.building).length } : undefined;
console.log(JSON.stringify({ mode, mapSize, seconds: Math.round(now / 1000), ticks: [host.netTick, client.netTick],
  before: tally.before, resyncs, afterResync: tally.after, economy, ok }));
process.exit(ok ? 0 : 1);
