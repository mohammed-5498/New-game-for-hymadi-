// البوتات في طور الإمبراطورية: تصرف نقاطها على الجنود والزعيم والترقيات والمباني (الأرقام في EMPIRE.bot).
// لا ظهور تلقائي في هذا الطور فبلا هذا لا جيش للبوت. القتال والتوسع كما في الأطوار الأخرى (bot.js).
// في كل قرار: "الشراء التالي" واحد، ويُدّخر له إن لم تكفِ النقاط (فلا تأكل الأفراد الرخيصة كل شيء)
import { EMPIRE as E, CITY_FEATURES, DISTRICT_SIZES as DS } from '../config.js';
import { sizeOf } from '../map/sizes.js';
import {
  canQueue, queueUnit, unitPrice, nextUpgrade, buyUpgrade, buildDistrict,
  nextBuildingUpgrade, upgradeBuilding, buildSpot, nextFort, fortifyDistrict
} from '../game/empire.js';
import { isEnemyId } from '../game/combat.js';
import { recruitsAt, canCallTriads, callTriads, triadTarget, canRingBells, ringBells } from '../game/features.js';
import { hypot } from '../game/hypot.js';

const B = E.bot;
const KINDS = ['common', 'strong', 'elite'];

// ترتيب الإنتاج بالدور من النسب (توزيع موزون ناعم: [5, 2, 1] = عادي، أقوى، عادي، عادي، نخبة، ...)
const SEQUENCES = {};
function sequence(level) {
  if (SEQUENCES[level]) return SEQUENCES[level];
  const w = B.mix[level] || B.mix.medium, total = w.reduce((a, b) => a + b, 0) || 1;
  const current = w.map(() => 0), seq = [];
  for (let n = 0; n < total; n++) {
    w.forEach((x, k) => { current[k] += x; });
    const best = current.indexOf(Math.max(...current));
    current[best] -= total;
    seq.push(KINDS[best]);
  }
  return (SEQUENCES[level] = seq);
}

export function empireEconomy(state, player) {
  const ms = state.modeState, pid = player.id;
  if (!ms.bot) ms.bot = {};
  const memo = ms.bot[pid] || (ms.bot[pid] = { turn: 0, units: 0, tech: 0 });
  botTriads(state, pid);
  botBells(state, pid);
  for (let n = 0; n < B.buysPerDecision; n++) {
    const next = pickNext(state, player, memo);
    if (!next || ms.points[pid] < next.cost) return;     // يدّخر للشراء التالي
    if (!next.buy().ok) return;
    if (next.tech) memo.tech += next.cost;
    else memo.units += next.cost;
    if (next.turn) memo.turn++;
  }
}

function pickNext(state, player, memo) {
  const pid = player.id, map = state.map, level = player.difficulty || 'medium';
  const owned = map.districts.filter(d => d.owner === pid && d.capture);
  if (!owned.length) return null;
  const hqs = owned.filter(d => d.building === 'hq');
  // حي يُبنى فيه: بلا مبنى، لا مركز شرطة ولا مبنى ميزة المدينة (القسم 3.11)
  const plain = owned.filter(d => !d.building && !d.police && d.featureTile === undefined && buildSpot(map, d) >= 0);
  const enemyDist = (d) => distanceToEnemy(state, pid, d);

  // بلا قاعدة رئيسية: لا إنتاج، فأول ما يُشترى قاعدة في أبعد أحيائه عن الأعداء
  if (!hqs.length) {
    const spot = farthest(plain, d => enemyDist(d) * worth(d));
    return spot ? { cost: E.buildings.hq.cost, tech: true, buy: () => buildDistrict(state, pid, spot.id, 'hq') } : null;
  }

  const army = state.units.reduce((n, u) => n + (u.playerId === pid && u.state !== 'dead' && u.hp > 0 ? 1 : 0), 0);
  const queues = state.modeState.queues;
  const queued = hqs.reduce((n, d) => n + (queues[d.id] ? queues[d.id].length : 0), 0);
  const hq = hqs.reduce((a, b) => ((queues[a.id] || []).length <= (queues[b.id] || []).length ? a : b));
  const roomy = (queues[hq.id] || []).length < B.queue && army + queued < state.maxUnits;

  // الزعيم: يُعاد شراؤه حين يموت ومعه جيش (ويُدّخر له)
  if (roomy && army >= B.leaderArmy) {
    const check = canQueue(state, pid, hq, 'leader');
    if (check.ok || check.reason === 'النقاط لا تكفي') {
      return { cost: unitPrice(state, pid, 'leader'), buy: () => queueUnit(state, pid, hq.id, 'leader') };
    }
  }

  // مجنَّدو المباني المميزة (القسم 3.11): واحد لكل recruitEvery من جيشه، الأقل عدداً أولاً
  if (army + queued < state.maxUnits) {
    const recruit = pickRecruit(state, pid, owned, army);
    if (recruit) return recruit;
  }

  // الجنود: بالدور حسب النسب، ما لم يحن دور الترقيات والمباني
  const kind = sequence(level)[memo.turn % sequence(level).length];
  const unit = roomy ? { cost: unitPrice(state, pid, kind), turn: true, buy: () => queueUnit(state, pid, hq.id, kind) } : null;
  const share = B.techShare[level] || 0;
  if (!share || (unit && army < B.minArmy)) return unit;
  const techTurn = memo.tech < share * (memo.units + memo.tech + 1);
  if (unit && !techTurn) return unit;
  return bestTech(state, pid, owned, hqs, plain, enemyDist) || unit;
}

// الترقية أو المبنى التالي: الأقل رتبة (البرج الناقص، ثم القاعدة الثانية، ثم ترقيات العصابة وسرعة إنتاج قواعده
// بمستوياتها بين المباني)
function bestTech(state, pid, owned, hqs, plain, enemyDist) {
  const items = [];
  const add = (rank, cost, buy) => items.push({ rank, cost, tech: true, buy });
  const towers = owned.filter(d => d.building === 'tower');
  const hospitals = owned.filter(d => d.building === 'hospital');

  const front = nearest(plain, d => enemyDist(d) / worth(d));
  if (front && towers.length < Math.floor(owned.length / B.towerEvery)) {
    add(0, E.buildings.tower.cost, () => buildDistrict(state, pid, front.id, 'tower'));
  }
  if (hqs.length < B.maxHq && owned.length >= B.hqAt) {
    const safe = farthest(plain, d => enemyDist(d) * worth(d));
    if (safe && safe !== front) add(1, E.buildings.hq.cost, () => buildDistrict(state, pid, safe.id, 'hq'));
  }
  const ups = B.upgradeOrder.map(key => ({ key, next: nextUpgrade(state, pid, key) })).filter(u => u.next);
  if (ups.length) {
    const low = Math.min(...ups.map(u => u.next.level));
    const up = ups.find(u => u.next.level === low);
    add(2 * low, up.next.cost, () => buyUpgrade(state, pid, up.key));
  }
  if (!hospitals.length && owned.length >= B.hospitalAt) {
    const home = hqs[0];
    const spot = nearest(plain.filter(d => d !== front), d => hypot(d.cx - home.cx, d.cy - home.cy) / worth(d));
    if (spot) add(3, E.buildings.hospital.cost, () => buildDistrict(state, pid, spot.id, 'hospital'));
  }
  // ترقيات المباني: مبنى واحد من كل نوع في كل مرة (القاعدة الأقل مستوى، والبرج الأقرب للأعداء، ثم المستشفى)
  // وسرعة الإنتاج قبل ترقيات العصابة من نفس المستوى
  const RANK = { hq: -0.5, tower: 3, hospital: 6 };
  const byLevel = (d) => Math.min(...E.buildings.hq.upgrades.order.map(key => (d.blv && d.blv[key]) || 0));
  for (const list of [[...hqs].sort((a, b) => byLevel(a) - byLevel(b)), [...towers].sort((a, b) => enemyDist(a) - enemyDist(b)), hospitals]) {
    for (const d of list) {
      const keys = E.buildings[d.building].upgrades.order.map(key => ({ key, next: nextBuildingUpgrade(d, key) })).filter(u => u.next);
      if (!keys.length) continue;
      const low = Math.min(...keys.map(u => u.next.level));
      const up = keys.find(u => u.next.level === low);
      add(RANK[d.building] + 2 * low, up.next.cost, () => upgradeBuilding(state, pid, d.id, up.key));
      break;
    }
  }
  // التحصين (القسم 3.12): القاعدة والبرج الأقرب للأعداء أولاً
  const wall = (list, max, rank) => {
    const d = [...list].sort((a, b) => enemyDist(a) - enemyDist(b)).find(d => (d.fort || 0) < max);
    const next = d && nextFort(d);
    if (next) add(rank + 2 * next.level, next.cost, () => fortifyDistrict(state, pid, d.id));
  };
  wall(hqs, B.fort.hq, B.fort.rank);
  wall(towers, B.fort.tower, B.fort.rank + 1);
  if (!items.length) return null;
  return items.reduce((a, b) => (b.rank < a.rank ? b : a));
}

function pickRecruit(state, pid, owned, army) {
  const queues = state.modeState.queues;
  for (const d of owned) {
    const kinds = recruitsAt(d);
    if (!kinds || (queues[d.id] || []).length >= B.queue) continue;
    const have = (kind) => state.units.filter(u => u.playerId === pid && u.recruitKind === kind && u.state !== 'dead').length +
      Object.values(queues).reduce((n, q) => n + q.filter(item => item.payer === pid && item.kind === kind).length, 0);
    const kind = kinds.reduce((a, b) => (have(b) < have(a) ? b : a));
    if (kinds.reduce((n, k) => n + have(k), 0) * B.recruitEvery >= army) continue;
    const check = canQueue(state, pid, d, kind);
    if (check.ok || check.reason === 'النقاط لا تكفي') {
      return { cost: unitPrice(state, pid, kind), buy: () => queueUnit(state, pid, d.id, kind) };
    }
  }
  return null;
}

// أقرب حي معادٍ لهذا الحي (للجبهة والأمان)
function distanceToEnemy(state, pid, district) {
  let best = Infinity;
  for (const d of state.map.districts) {
    if (d.owner === null || !d.capture || !isEnemyId(state, pid, d.owner)) continue;
    const dist = hypot(d.cx - district.cx, d.cy - district.cy);
    if (dist < best) best = dist;
  }
  return best;
}

// مباني البوت في الحي الأكبر حين تتقارب المسافات: مبانيه فيه أقوى (القسم 3.12)
const worth = (d) => DS.botValue[sizeOf(d)];
const nearest = (list, score) => list.reduce((a, b) => (!a || score(b) < score(a) ? b : a), null);
const farthest = (list, score) => list.reduce((a, b) => (!a || score(b) > score(a) ? b : a), null);

// مقر الترياد (القسم 3.11): متى كان جاهزاً ومع البوت كلفته وفضل botReserve، يرسلهم إلى حي العدو الأقرب إلى أحيائه
function botTriads(state, pid) {
  if (state.feature !== 'triads') return;
  const T = CITY_FEATURES.triads, map = state.map;
  const hq = map.districts.find(d => d.feature === 'triads' && d.owner === pid && d.featureTile !== undefined);
  if (!hq || state.modeState.points[pid] < T.cost + T.botReserve || !canCallTriads(state, pid, hq).ok) return;
  const mine = map.districts.filter(d => d.owner === pid && d.capture);
  let best = null, bestDist = Infinity;
  for (const d of map.districts) {
    if (!triadTarget(state, pid, d)) continue;
    for (const m of mine) {
      const dist = hypot(d.capture.i - m.capture.i, d.capture.j - m.capture.j);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
  }
  if (best) callTriads(state, pid, hq.id, best.id);
}

// الكاتدرائية (القسم 3.11): يقرع أجراسها حين يقاتل botFighting من جنوده فأكثر
function botBells(state, pid) {
  if (state.feature !== 'bells') return;
  const d = state.map.districts.find(x => x.feature === 'cathedral' && x.featureTile !== undefined && x.owner === pid);
  if (!d || !canRingBells(state, pid, d).ok) return;
  let fighting = 0;
  for (const u of state.units) if (u.playerId === pid && u.target && u.state !== 'dead' && u.hp > 0) fighting++;
  if (fighting >= CITY_FEATURES.cathedral.botFighting) ringBells(state, pid, d.id);
}
