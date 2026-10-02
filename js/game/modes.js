// أطوار اللعب (القسم 9.5): ما يخص كل طور من عدّاد ونقاط وشروط فوز وواجهة
// السيطرة الكاملة (الافتراضي) لا تمر بشيء هنا: قواعدها كما كانت في victory.js.
import { TICK_SEC, gameModes as GM } from '../config.js';
import { isPlayerAlive, finish } from './victory.js';
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
  state.modeState = modeState;
}

// --- كل تحديث ---
export function updateMode(state) {
  if (state.matchResult) return;
  if (state.mode === 'points') updatePoints(state);
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
  return null;
}

// بطاقات إضافية في شاشة النهاية
export function modeExtras(state) {
  if (state.mode === 'points') {
    const human = state.players[state.humanId];
    const mine = human ? sideTotals(state).find(s => s.key === sideKey(human)) : null;
    return [['نقاطك', mine ? Math.floor(mine.points) : 0]];
  }
  return [];
}
