// أطوار اللعب (القسم 9.5): ما يخص كل طور من عدّاد ونقاط وشروط فوز وواجهة
// السيطرة الكاملة (الافتراضي) لا تمر بشيء هنا: قواعدها كما كانت في victory.js.
import { TICK_SEC, ALERTS, COMBAT, gameModes as GM } from '../config.js';
import { isPlayerAlive, finish } from './victory.js';
import { isEnemy } from './combat.js';
import { championOf } from './spawn.js';
import { onScreen } from './alerts.js';
import { createUnit, commandAttackMove } from './units.js';
import { policePlayer, policeStations } from './police.js';
import { findFreeTiles } from '../map/pathfinding.js';
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

  if (state.mode === 'regicide') {
    modeState.leaderKills = 0;          // زعماء أسقطهم جانبك
    modeState.lastHp = null;            // دم زعيمك في التحديث السابق: لكشف الضرب
    modeState.alertAt = -99;            // آخر صوت تنبيه لضرب زعيمك
  }

  if (state.mode === 'survival') {
    const S = GM.survival;
    modeState.level = S.levels.includes(options.level) ? options.level : S.defaultLevel;
    modeState.wave = 0;                       // آخر موجة وصلت
    modeState.nextWaveAt = S.firstWaveSeconds;
    modeState.survived = 0;                   // موجات صمدت أمامها
    modeState.retargetAt = 0;
    modeState.record = null;                  // يُملأ عند النهاية: { best, newRecord }
  }
  state.modeState = modeState;
}

// بعد ظهور الوحدات الأولى: ما يخص الطور فيها
export function prepareModeUnits(state) {
  if (state.mode !== 'regicide') return;
  // الزعيم أقوى لأنه لا يعود: دم +50% (القسم 9.5.3)
  for (const unit of state.units) {
    if (!unit.champion) continue;
    const factor = 1 + GM.regicide.hpBonus;
    unit.stats = { ...unit.stats, hp: unit.stats.hp * factor };
    unit.maxHp = unit.stats.hp;
    unit.hp = unit.maxHp;
  }
}

// --- كل تحديث ---
export function updateMode(state) {
  if (state.matchResult) return;
  if (state.mode === 'points') updatePoints(state);
  else if (state.mode === 'king') updateKing(state);
  else if (state.mode === 'regicide') updateRegicide(state);
  else if (state.mode === 'survival') updateSurvival(state);
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

// ================= 9.5.3 حماية الزعيم =================
function updateRegicide(state) {
  const R = GM.regicide;
  const ms = state.modeState;

  for (const player of gangPlayers(state)) {
    if (player.fallen) continue;
    const leader = championOf(state, player.id);
    if (!leader) { fallLeader(state, player); continue; }

    // يتعالج داخل حيه المنزلي (مربعاته، أو الشوارع حول علمه: الوحدات تقف في الشوارع غالباً)
    const home = state.map.districts[player.homeDistrictId];
    const district = state.map.districtOf(Math.round(leader.x), Math.round(leader.y));
    const atHome = home && (district === home ||
      (home.capture && Math.hypot(leader.x - home.capture.i, leader.y - home.capture.j) <= R.homeHealRadius));
    if (atHome && leader.hp < leader.maxHp) {
      leader.hp = Math.min(leader.maxHp, leader.hp + R.homeHealPerSecond * TICK_SEC);
    }
  }

  // زعيمك يُضرب: سهم أحمر نابض على الحافة (إن كان خارج الشاشة) وصوت تنبيه
  const mine = championOf(state, state.humanId);
  if (mine) {
    if (ms.lastHp !== null && mine.hp < ms.lastHp - 1e-6) leaderHit(state, mine);
    ms.lastHp = mine.hp;
  }
  // السهم يتبع الزعيم ما دام قائماً
  const arrow = state.alerts.find(a => a.kind === 'leader');
  if (arrow && mine) { arrow.i = mine.x; arrow.j = mine.y; }
}

function leaderHit(state, leader) {
  const R = GM.regicide;
  const ms = state.modeState;
  if (state.time - ms.alertAt >= R.hitAlertSeconds) {
    ms.alertAt = state.time;
    sound('alert');
  }
  if (onScreen(state, leader.x, leader.y)) return;
  const arrow = state.alerts.find(a => a.kind === 'leader');
  if (arrow) { arrow.life = R.hitAlertSeconds; return; }
  // سهم الزعيم أهم من غيره: يحل محل أقدم سهم إن امتلأت الأسهم
  if (state.alerts.length >= ALERTS.maxArrows) {
    state.alerts.sort((a, b) => a.life - b.life);
    state.alerts.shift();
  }
  state.alerts.push({ kind: 'leader', i: leader.x, j: leader.y, life: R.hitAlertSeconds, screen: null });
}

// سقط الزعيم: يخرج صاحبه فوراً، وتتلاشى وحداته خلال ثانية، وتصبح أحياؤه محايدة
function fallLeader(state, player) {
  const R = GM.regicide;
  const ms = state.modeState;
  player.fallen = true;

  // من أسقطه؟ آخر من ضربه (يُحسب لجانبك إن كان أنت أو حليفك)
  const human = state.players[state.humanId];
  const body = state.units.find(u => u.playerId === player.id && u.champion);
  const killer = body && body.lastHitBy !== undefined ? state.players[body.lastHitBy] : null;
  if (human && killer && player.id !== state.humanId && sideKey(killer) === sideKey(human)) ms.leaderKills++;

  for (const unit of state.units) {
    if (unit.playerId !== player.id || unit.state === 'dead') continue;
    unit.fadeAt = state.time + Math.random() * R.fadeSeconds;
  }
  for (const district of state.map.districts) {
    if (district.owner !== player.id) continue;
    district.owner = null;
    district.progress = 0;
    district.progressOwner = null;
  }
  if (player.id !== state.humanId) {
    state.notice = { text: 'سقط زعيم ' + player.gangName, mine: false, t: 3 };
  }
}

// التلاشي: تموت الوحدات في لحظاتها المحددة بلا قاتل (لا تُحسب قتلى لأحد)
export function updateFades(state) {
  for (const unit of state.units) {
    if (unit.fadeAt === undefined || unit.state === 'dead' || state.time < unit.fadeAt) continue;
    unit.hp = 0;
    unit.state = 'dead';
    unit.deathTimer = COMBAT.deathTime;
    unit.target = null;
    unit.path = [];
    unit.selected = false;
  }
}

// زعماء الأعداء الأحياء: تشير إليهم أسهم ذهبية على الحافة
export function enemyLeaders(state) {
  if (state.mode !== 'regicide') return [];
  const human = state.players[state.humanId];
  const list = [];
  for (const player of gangPlayers(state)) {
    if (player.fallen || player.id === state.humanId) continue;
    if (human && sideKey(player) === sideKey(human)) continue;     // حليفك ليس عدواً
    const leader = championOf(state, player.id);
    if (leader) list.push({ unit: leader, color: player.color });
  }
  return list;
}

// ================= 9.5.5 الصمود ضد الشرطة =================
export const nextWaveIn = (state) => Math.max(0, state.modeState.nextWaveAt - state.time);
const isWaveUnit = (unit) => unit.wave > 0 && unit.state !== 'dead';

function updateSurvival(state) {
  const S = GM.survival;
  const ms = state.modeState;

  // انتهت موجتك الحالية كلها: صمدت أمامها
  if (ms.wave > ms.survived && !state.units.some(u => isWaveUnit(u) && u.wave === ms.wave)) {
    ms.survived = ms.wave;
  }

  if (state.time >= ms.nextWaveAt) {
    // وصول موجة جديدة وأنت قائم يعني أنك صمدت أمام التي قبلها
    ms.survived = Math.max(ms.survived, ms.wave);
    ms.wave++;
    ms.nextWaveAt += S.waveSeconds;
    spawnWave(state, ms.wave);
  }

  if (state.time >= ms.retargetAt) {
    ms.retargetAt = state.time + S.retargetSeconds;
    retargetWave(state);
  }

  // الخسارة: فقدت كل جنودك وكل أحيائك (الحلفاء لا يُبقونك في المباراة)
  if (state.humanId >= 0 && !isPlayerAlive(state, state.humanId)) endSurvival(state);
}

// حجم الموجة n = 4 + 2n، ومن الموجة 3 ضابط ومن 6 ضابطان؛ والدم والضرر يزيدان مع كل موجة
function spawnWave(state, n) {
  const S = GM.survival;
  const police = policePlayer(state);
  if (!police) return;
  const count = S.baseSize + S.perWave * n;
  const captains = n >= S.twoCaptainsFromWave ? 2 : n >= S.captainFromWave ? 1 : 0;
  const factor = 1 + S.growth[state.modeState.level] * (n - 1);

  const sources = waveSources(state);
  if (!sources.length) return;
  const kinds = [...Array(captains).fill('captain'), ...Array(count).fill(null)];
  const groups = sources.map(() => []);
  kinds.forEach((kind, k) => groups[k % sources.length].push(kind));

  sources.forEach((source, s) => {
    const spots = findFreeTiles(state.map, source.i, source.j, S.spawnSpread);
    if (!spots.length) return;
    const units = [];
    groups[s].forEach((kind, k) => {
      const [i, j] = spots[k % spots.length];
      const unit = createUnit(state, police, i, j, kind);
      unit.stats = { ...unit.stats, hp: unit.stats.hp * factor, damage: unit.stats.damage * factor, capturePower: S.capturePower };
      unit.maxHp = unit.stats.hp;
      unit.hp = unit.maxHp;
      unit.wave = n;            // بلا مركز ولا قيد مسافة: تزحف حتى تجد هدفها
      state.units.push(unit);
      units.push(unit);
    });
    const target = waveTarget(state, source.i, source.j);
    if (target && units.length) commandAttackMove(state, target.i, target.j, units, false);
  });

  state.notice = { text: 'الموجة ' + n + ' قادمة!', mine: false, t: S.noticeSeconds };
  sound('alert');
}

// المصادر: مراكز الشرطة وحواف الخريطة، نختار منها عدداً عشوائياً لكل موجة
// (مركز واحد على الأقل إن وُجد: الموجات تأتي من الحواف ومن المراكز معاً)
function waveSources(state) {
  const S = GM.survival;
  const map = state.map;
  const shuffle = (list) => {
    for (let k = list.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [list[k], list[r]] = [list[r], list[k]];
    }
    return list;
  };
  const stations = shuffle(policeStations(state).filter(d => d.capture)
    .map(d => ({ i: d.capture.i, j: d.capture.j })));
  const last = map.n - 1, mid = Math.floor(map.n / 2);
  const edges = [];
  for (const [ei, ej] of [[mid, 0], [mid, last], [0, mid], [last, mid], [0, 0], [last, last], [0, last], [last, 0]]) {
    const spot = findFreeTiles(map, ei, ej, 1, S.edgeSearchTiles)[0];
    if (spot) edges.push({ i: spot[0], j: spot[1] });
  }
  const rest = shuffle([...stations.slice(1), ...edges]);
  return [...stations.slice(0, 1), ...rest].slice(0, S.sourcesPerWave);
}

// أقرب حي تملكه العصابات (لا مراكز الشرطة)، وإلا أقرب وحدة منها
function waveTarget(state, i, j) {
  let best = null, bestDist = Infinity;
  for (const d of state.map.districts) {
    if (!d.capture || d.police || d.owner === null || state.players[d.owner].neutral) continue;
    const dist = Math.hypot(d.capture.i - i, d.capture.j - j);
    if (dist < bestDist) { bestDist = dist; best = { i: d.capture.i, j: d.capture.j }; }
  }
  if (best) return best;
  for (const unit of state.units) {
    if (unit.state === 'dead' || state.players[unit.playerId].neutral) continue;
    const dist = Math.hypot(unit.x - i, unit.y - j);
    if (dist < bestDist) { bestDist = dist; best = { i: Math.round(unit.x), j: Math.round(unit.y) }; }
  }
  return best;
}

// شرطة الموجة الواقفة: تبقى إن كانت تستولي على حي، وإلا تزحف نحو هدف جديد
function retargetWave(state) {
  const police = policePlayer(state);
  if (!police) return;
  const map = state.map;
  const orders = new Map();
  for (const unit of state.units) {
    if (!isWaveUnit(unit) || unit.state !== 'idle') continue;
    const ids = map.zoneAt.get(map.idx(Math.round(unit.x), Math.round(unit.y))) || [];
    const capturing = ids.some(id => {
      const d = map.districts[id];
      return !d.police && d.owner !== police.id;
    });
    if (capturing) continue;
    const target = waveTarget(state, unit.x, unit.y);
    if (!target) continue;
    const key = target.i + ',' + target.j;
    if (!orders.has(key)) orders.set(key, { target, units: [] });
    orders.get(key).units.push(unit);
  }
  for (const { target, units } of orders.values()) {
    commandAttackMove(state, target.i, target.j, units, false);
  }
}

// النتيجة: الموجات التي صمدت أمامها والزمن، وأفضل نتيجة تُحفظ في localStorage
function endSurvival(state) {
  const ms = state.modeState;
  const best = loadSurvivalBest();
  const mine = { waves: ms.survived, seconds: Math.floor(state.time) };
  const newRecord = !best || mine.waves > best.waves || (mine.waves === best.waves && mine.seconds > best.seconds);
  if (newRecord) saveSurvivalBest(mine);
  ms.record = { best: newRecord ? mine : best, newRecord };
  const record = newRecord ? 'رقم قياسي جديد: الموجة ' + mine.waves + '!' : 'رقمك القياسي: الموجة ' + best.waves;
  finish(state, false, 'خسرت كل جنودك وأحيائك أمام الشرطة • ' + record);
}

export function loadSurvivalBest() {
  try {
    const data = JSON.parse(localStorage.getItem(GM.survival.recordKey));
    return data && Number.isFinite(data.waves) ? data : null;
  } catch { return null; }
}

function saveSurvivalBest(record) {
  try { localStorage.setItem(GM.survival.recordKey, JSON.stringify(record)); } catch { /* لا تخزين */ }
}

const policeAlive = (state) => state.units.filter(u => u.state !== 'dead' && state.players[u.playerId].neutral).length;

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
  if (state.mode === 'survival') {
    const ms = state.modeState;
    const left = nextWaveIn(state);
    return {
      text: ms.wave ? 'الموجة ' + ms.wave + ' • التالية بعد ' + clock(left) : 'الموجة الأولى بعد ' + clock(left),
      alarm: left <= GM.survival.alarmSeconds
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
  if (state.mode === 'regicide') {
    // دم كل زعيم شريطاً صغيراً، والرقم عدد الأحياء كالمعتاد
    const counts = state.players.map(() => 0);
    for (const d of state.map.districts) if (d.owner !== null) counts[d.owner]++;
    const ratio = (playerId) => {
      const leader = championOf(state, playerId);
      return leader ? leader.hp / leader.maxHp : 0;
    };
    const mine = championOf(state, state.humanId);
    return {
      value: (playerId) => counts[playerId],
      sortValue: (playerId) => counts[playerId],
      bar: ratio,
      folded: 'زعيمي: ' + (mine ? Math.round(100 * mine.hp / mine.maxHp) + '%' : 'سقط')
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
  if (state.mode === 'survival') {
    // رقم الموجة وعدد الشرطة الأحياء بدل قائمة اللاعبين
    const wave = state.modeState.wave, police = policeAlive(state);
    return {
      summary: [['الموجة', wave], ['الشرطة الأحياء', police]],
      folded: 'الموجة ' + wave + ' • شرطة ' + police
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
  if (state.mode === 'regicide') {
    return [['زعماء أسقطتهم', state.modeState.leaderKills]];
  }
  if (state.mode === 'survival') {
    const ms = state.modeState;
    const best = ms.record ? ms.record.best : loadSurvivalBest();
    return [
      ['موجات صمدت أمامها', ms.survived],
      ['رقمك القياسي (موجات)', best ? best.waves : ms.survived]
    ];
  }
  return [];
}
