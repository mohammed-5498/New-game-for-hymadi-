// أطوار اللعب (القسم 9.5): ما يخص كل طور من عدّاد ونقاط وشروط فوز وواجهة
// السيطرة الكاملة (الافتراضي) لا تمر بشيء هنا: قواعدها كما كانت في victory.js.
import { TICK_SEC, gameModes as GM } from '../config.js';
import { isPlayerAlive, finish } from './victory.js';
import { isEnemy } from './combat.js';
import { sound } from '../audio/sound.js';

export const modeOf = (state) => (state.mode && GM[state.mode]) ? state.mode : 'conquest';

// الفريق كتلة واحدة: من بلا فريق جانب بنفسه (9.5.0)
export const sideKey = (player) => player.team ? 'team' + player.team : 'player' + player.id;

const gangPlayers = (state) => state.players.filter(p => !p.neutral);

// --- البداية ---
export function initMode(state) {
  state.mode = GM[state.settings.mode] ? state.settings.mode : GM.defaultMode;
  const options = state.settings.modeOptions || {};
  const modeState = {};

  if (state.mode === 'points') {
    const minutes = GM.points.minutes.includes(options.minutes) ? options.minutes : GM.points.defaultMinutes;
    modeState.duration = minutes * 60;
    modeState.scores = state.players.map(() => 0);
    modeState.finalAnnounced = false;
  }

  if (state.mode === 'king') {
    const minutes = GM.king.holdMinutes.includes(options.holdMinutes) ? options.holdMinutes : GM.king.defaultHoldMinutes;
    const hill = pickHill(state.map);
    if (hill) hill.hill = true;
    modeState.hillId = hill ? hill.id : -1;
    modeState.target = minutes * 60;
    modeState.held = state.players.map(() => 0);   // عدّاد كل لاعب، لا يُصفَّر عند خسارة التلة
    modeState.warned = {};                          // تنبيه "يقترب من الفوز" مرة لكل جانب
    modeState.blocked = false;                      // عدو داخل منطقة التلة الآن
  }
  state.modeState = modeState;
}

// --- كل تحديث ---
export function updateMode(state) {
  if (state.matchResult) return;
  if (state.mode === 'points') updatePoints(state);
  else if (state.mode === 'king') updateKing(state);
}

// ================= 9.5.2 الوقت بالنقاط =================
export const pointsRemaining = (state) => Math.max(0, state.modeState.duration - state.time);
export const isFinalMinute = (state) =>
  state.mode === 'points' && pointsRemaining(state) <= GM.points.finalSeconds;

function updatePoints(state) {
  const ms = state.modeState;
  const final = isFinalMinute(state);
  const multiplier = final ? GM.points.finalMultiplier : 1;

  // النقاط تتراكم: كل حي نقطة في الثانية، والمميز نقطتان
  for (const district of state.map.districts) {
    if (district.owner === null || !district.capture) continue;
    if (state.players[district.owner].neutral) continue;
    const perSecond = district.special ? GM.points.pointPerSpecial : GM.points.pointPerDistrict;
    ms.scores[district.owner] += perSecond * multiplier * TICK_SEC;
  }

  if (final && !ms.finalAnnounced) {
    ms.finalAnnounced = true;
    state.notice = { text: 'الدقيقة الأخيرة! النقاط مضاعفة', mine: false, t: 4 };
    sound('alert');
  }

  if (pointsRemaining(state) <= 0) endPoints(state);
}

// قوة الجيش لحسم التعادل: الفرد 1، الشخصية المميزة 3، البطل 5
function armyWeight(state, playerId) {
  const w = GM.points.armyWeights;
  let total = 0;
  for (const unit of state.units) {
    if (unit.playerId !== playerId || unit.state === 'dead') continue;
    total += unit.champion ? w.champion : unit.hero ? w.hero : w.unit;
  }
  return total;
}

// نتيجة كل جانب: مجموع نقاط أعضائه وجيوشهم وأحيائهم (من أُقصي كل أعضائه لا يفوز)
export function sideTotals(state) {
  const sides = new Map();
  for (const player of gangPlayers(state)) {
    const key = sideKey(player);
    if (!sides.has(key)) sides.set(key, { key, players: [], points: 0, army: 0, districts: 0, alive: false });
    const side = sides.get(key);
    side.players.push(player);
    side.points += state.modeState.scores ? state.modeState.scores[player.id] : 0;
    side.army += armyWeight(state, player.id);
    side.districts += state.map.districts.filter(d => d.owner === player.id).length;
    if (isPlayerAlive(state, player.id)) side.alive = true;
  }
  return [...sides.values()];
}

function endPoints(state) {
  const ranked = sideTotals(state).filter(s => s.alive)
    .sort((a, b) => (Math.floor(b.points) - Math.floor(a.points)) || (b.army - a.army) || (b.districts - a.districts));
  if (!ranked.length) return;
  const [first, second] = ranked;
  const human = state.players[state.humanId];
  const won = !!human && sideKey(human) === first.key;

  // لماذا فاز الأول؟ بالنقاط، أو حُسم التعادل بالجيش ثم بالأحياء
  const tied = second && Math.floor(second.points) === Math.floor(first.points);
  const by = !tied ? 'نقاط' : (second.army !== first.army ? 'جيش' : 'أحياء');
  const winnerName = first.players.map(p => p.gangName).join(' و');
  let reason;
  if (won) {
    reason = by === 'نقاط' ? 'انتهى الوقت ونقاطك الأعلى'
           : by === 'جيش' ? 'انتهى الوقت بتعادل النقاط، وجيشك الأكبر'
           : 'انتهى الوقت بتعادل النقاط والجيش، وأحياؤك أكثر';
  } else {
    reason = by === 'نقاط' ? 'انتهى الوقت و' + winnerName + ' أعلى نقاطاً'
           : 'انتهى الوقت بتعادل النقاط، و' + winnerName + ' حسمه';
  }
  finish(state, won, reason);
}

// ================= 9.5.4 ملك الحي =================
// التلة: الأقرب لمركز الخريطة من الأحياء بـ 6 مربعات فأكثر، لا منزلية ولا مركز شرطة
export function pickHill(map) {
  const center = (map.n - 1) / 2;
  let best = null, bestDist = Infinity;
  for (const d of map.districts) {
    if (!d.capture || d.isHome || d.police || d.tiles.length < GM.king.hillMinTiles) continue;
    const dist = Math.hypot(d.cx - center, d.cy - center);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best;
}

export const hillOf = (state) => state.map.districts[state.modeState.hillId] || null;

function updateKing(state) {
  const ms = state.modeState;
  const hill = hillOf(state);
  if (!hill) return;

  // العدّاد يجري لمالك التلة ما دام لا عدو داخل منطقة الاستيلاء فيها
  const owner = hill.owner;
  ms.blocked = false;
  if (owner !== null && !state.players[owner].neutral) {
    const zone = new Set(hill.zone);
    for (const unit of state.units) {
      if (unit.state === 'dead') continue;
      if (!zone.has(state.map.idx(Math.round(unit.x), Math.round(unit.y)))) continue;
      if (isEnemy(state, { playerId: owner }, unit)) { ms.blocked = true; break; }
    }
    if (!ms.blocked) ms.held[owner] += TICK_SEC;
  }

  for (const side of kingSides(state)) {
    const left = ms.target - side.held;
    // تنبيه للجميع حين يقترب أحد من الفوز (آخر 20 ثانية)
    if (left <= GM.king.warnSeconds && !ms.warned[side.key] && side.alive) {
      ms.warned[side.key] = true;
      const mine = isHumanSide(state, side);
      state.notice = { text: mine ? 'أنت على وشك الفوز بالتلة!' : side.name + ' يقترب من الفوز بالتلة!', mine, t: 4 };
      sound('alert');
    }
    if (left <= 0 && side.alive) {
      const won = isHumanSide(state, side);
      const need = Math.round(ms.target / 60);
      const span = need === 2 ? 'دقيقتين' : need + ' دقائق';
      finish(state, won, won ? 'سيطرت على التلة ' + span
                             : side.name + ' سيطر على التلة ' + span);
      return;
    }
  }
}

// زمن كل جانب على التلة: مجموع أعضائه
export function kingSides(state) {
  const sides = new Map();
  for (const player of gangPlayers(state)) {
    const key = sideKey(player);
    if (!sides.has(key)) sides.set(key, { key, held: 0, color: player.color, name: player.gangName, players: [], alive: false });
    const side = sides.get(key);
    side.players.push(player);
    side.held += state.modeState.held[player.id];
    if (isPlayerAlive(state, player.id)) side.alive = true;
  }
  return [...sides.values()];
}

const isHumanSide = (state, side) => side.players.some(p => p.id === state.humanId);

// ================= الواجهة =================
const clock = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

// شريط أعلى وسط الشاشة: { text, alarm } أو null حين لا يلزم (السيطرة الكاملة)
export function modeBar(state) {
  if (state.mode === 'points') {
    return { text: clock(pointsRemaining(state)), alarm: isFinalMinute(state) };
  }
  if (state.mode === 'king') {
    // تقدم كل جانب نحو الزمن المطلوب بلونه، وزمنك أنت في السطر
    const ms = state.modeState;
    const sides = kingSides(state);
    const mine = sides.find(s => isHumanSide(state, s));
    const top = Math.max(...sides.map(s => s.held));
    return {
      text: '👑 ' + clock(mine ? mine.held : 0) + ' / ' + clock(ms.target),
      alarm: ms.target - top <= GM.king.warnSeconds,
      bars: sides.map(s => ({ color: s.color, ratio: s.held / ms.target, me: isHumanSide(state, s) }))
    };
  }
  return null;
}

// عمود شريط القوة: قيمة كل لاعب حسب الطور، وعنوان الطي
export function powerColumn(state) {
  if (state.mode === 'points') {
    const scores = state.modeState.scores;
    return {
      value: (playerId) => Math.floor(scores[playerId]),
      sortValue: (playerId) => scores[playerId],
      folded: 'نقاطي: ' + Math.floor(scores[state.humanId] || 0)
    };
  }
  if (state.mode === 'king') {
    const held = state.modeState.held;
    return {
      value: (playerId) => clock(held[playerId]),
      sortValue: (playerId) => held[playerId],
      folded: 'التلة: ' + clock(held[state.humanId] || 0)
    };
  }
  return null;
}

// بطاقات إضافية في شاشة النهاية
export function modeExtras(state) {
  if (state.mode === 'points') {
    const human = state.players[state.humanId];
    const mine = human ? sideTotals(state).find(s => s.key === sideKey(human)) : null;
    return [['نقاطك', mine ? Math.floor(mine.points) : 0]];
  }
  if (state.mode === 'king') {
    const mine = kingSides(state).find(s => isHumanSide(state, s));
    return [['زمنك على التلة', clock(mine ? mine.held : 0)]];
  }
  return [];
}
