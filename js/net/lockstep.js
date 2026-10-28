// اللعب المحلي (القسم 16): المحاكاة خطوة بخطوة على كل الأجهزة (lockstep).
// كل جهاز يحاكي المباراة كلها بنفسه؛ والذي يسافر بينها أوامر اللاعبين وحدها. المضيف يجمع الأوامر ويحدد لكل منها
// تحديثاً بعد NET.delayTicks ويرسلها في "دور" ذلك التحديث، فينفذها الجميع في نفس التحديث بنفس الترتيب.
// العشوائية من بذرة داخل الحالة (game/random.js)، ومستويات التفصيل من كاميرات كل اللاعبين (game/realism.js).
// وكل NET.hashTicks تحديثاً يقارن المضيف بصمة المباراة عند الجميع، فإن اختلفت أرسل المباراة كلها (إعادة مزامنة).
// بلا DOM: تعمل في المتصفح وفي Node (أداة الاختبار). send(to, msg): to رقم خانة اللاعب، أو ALL للجميع
import { NET, TICK_MS, CAMERA } from '../config.js';
import { updateMatch } from '../game/loop.js';
import { seedFrom, unseed } from '../game/random.js';
import { commandMove, commandAttackMove } from '../game/units.js';
import { commandAttack, isEnemy } from '../game/combat.js';
import { empireCommand } from '../game/empire.js';
import { packMatch, unpackMatch } from '../matchSave.js';
import { tileToWorld } from '../map/coords.js';

export const ALL = -1;

// ما يخص هذا الجهاز ويبقى كما هو عند استلام المباراة كلها
const LOCAL_KEYS = ['camera', 'humanId', 'lanRole', 'running', 'paused', 'lanOut', 'moveMarker', 'notice', 'alerts', 'alertSeen', 'hudAvoid',
                    'empireOpen', 'empireHinted'];

// بصمة المباراة: ما يغيّر اللعب فقط (المواقع والدم والحالات والأحياء والبذرة ونقاط الأطوار)، لا ما يخص الشاشة
export function hashState(state) {
  let h = 2166136261 >>> 0;
  const mix = (v) => { h = Math.imul(h ^ (v | 0), 16777619) >>> 0; };
  mix(state.netRand); mix(state.nextUnitId); mix(state.units.length); mix(state.netTick);
  for (const u of state.units) {
    mix(u.id); mix(u.x * 1000); mix(u.y * 1000); mix(u.hp * 100); mix(u.state.length); mix(u.playerId);
  }
  for (const d of state.map.districts) { mix(d.owner === null ? -1 : d.owner); mix(d.progress * 100); }
  // ما يحسم الأطوار: نقاط الإمبراطورية، ونقاط طور الوقت، وزمن السيطرة على التلة
  const ms = state.modeState || {};
  for (const list of [ms.points, ms.scores, ms.held]) if (Array.isArray(list)) for (const v of list) mix(v * 100);
  return h;
}

// تجهيز مباراة جديدة للعب المحلي على المضيف قبل إرسالها: البذرة والعدّاد وكاميرات اللاعبين عند أحيائهم
export function prepareLanMatch(state) {
  state.settings.lan = true;
  state.netRand = (Math.random() * 4294967296) | 0;
  state.netTick = 0;
  state.netCams = state.players.map(p => {
    if (!p.isHuman) return null;
    const home = state.map.districts[p.homeDistrictId];
    const point = home && home.capture ? home.capture : { i: state.map.n / 2, j: state.map.n / 2 };
    const w = tileToWorld(point.i, point.j);
    return { x: Math.round(w.x), y: Math.round(w.y), z: CAMERA.startZoom, w: NET.defaultView.w, h: NET.defaultView.h };
  });
}

// --- تنفيذ الأوامر: نفس النتيجة على كل جهاز، فلا يعتمد شيء هنا على هذا الجهاز إلا علامة الحركة لأوامره ---
function unitsOf(state, playerId, ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const wanted = new Set(ids), list = [];
  for (const u of state.units) {
    if (wanted.has(u.id) && u.playerId === playerId && u.state !== 'dead' && u.hp > 0) list.push(u);
  }
  return list;
}

function applyCommand(state, c) {
  const player = state.players[c.p];
  if (!player) return;
  if (c.k === 'cam') {
    if (state.netCams && player.isHuman) state.netCams[c.p] = { x: +c.x || 0, y: +c.y || 0, z: +c.z || 1, w: +c.w || 1, h: +c.h || 1 };
    return;
  }
  if (c.k === 'leave') {                    // غادر لاعب: يقود جيشه بوت من الآن
    if (!player.isHuman) return;
    player.isHuman = false;
    player.difficulty = player.difficulty || 'medium';
    state.botTimers[c.p] = 0;
    if (state.netCams) state.netCams[c.p] = null;
    state.notice = { text: 'غادر ' + player.name + ' • يقود جيشه بوت الآن', mine: false, t: 4 };
    return;
  }
  if (!player.isHuman) return;              // لاعب صار بوتاً: أوامره القديمة لا تُنفذ
  if (c.k === 'emp') {                      // طور الإمبراطورية: إنتاج وترقيات ومبانٍ من قائمة الحي
    if (state.mode === 'empire') empireCommand(state, c.p, c.a, Math.round(+c.d), c.x);
    return;
  }
  const units = unitsOf(state, c.p, c.u);
  if (!units.length) return;
  const i = Math.round(+c.i), j = Math.round(+c.j);
  if ((c.k === 'move' || c.k === 'amove') && !(Number.isFinite(i) && Number.isFinite(j))) return;
  if (c.k === 'move') commandMove(state, i, j, units, false);
  else if (c.k === 'amove') commandAttackMove(state, i, j, units, false);
  else if (c.k === 'attack') {
    const target = state.units.find(u => u.id === c.t);
    if (target && target.state !== 'dead' && target.hp > 0 && isEnemy(state, units[0], target)) commandAttack(state, units, target);
  }
}

// تحديث واحد: أوامر هذا التحديث ثم المحاكاة، والعشوائية كلها من بذرة الحالة
function runTurn(state, cmds) {
  seedFrom(state);
  try {
    for (const c of cmds) applyCommand(state, c);
    if (!state.matchResult) updateMatch(state);
    state.netTick++;
  } finally {
    unseed();
  }
}

// --- الجلسة: المضيف أو منضم ---
// slot: رقم لاعب هذا الجهاز. events: onResync(), onDesync() اختيارية
export function createLockstep(role, send, slot, events = {}) {
  const L = {
    role, slot, send, events,
    turns: new Map(),          // التحديث ← أوامره
    pending: [],               // المضيف: أوامر وصلت ولم تُحدد لها تحديثات بعد
    acc: 0,
    lastTurn: -1,              // آخر دور وصل (المنضم)
    hostHashes: new Map(),     // المضيف: بصمته عند كل تحديث مقارنة
    peerHashes: new Map(),     // المضيف: بصمات وصلت قبل أن يبلغ تحديثها
    camAt: -1e9, camSent: '',
    resyncs: 0
  };
  for (let n = 0; n < NET.delayTicks; n++) L.turns.set(n, []);   // الأدوار الأولى بلا أوامر عند الجميع
  return L;
}

// أمر من لاعب هذا الجهاز (من اللمس)
export function localCommand(L, cmd) {
  cmd.p = L.slot;
  if (L.role === 'host') L.pending.push(cmd);
  else L.send(0, { t: 'cmd', c: cmd });
}

// المضيف: لاعب غادر أو انقطع
export function playerLeft(L, playerSlot) {
  if (L.role === 'host') L.pending.push({ k: 'leave', p: playerSlot });
}

// رسالة وصلت. fromSlot: خانة المرسل (المضيف يعرفها من اتصاله، فلا يصدق ما يكتبه المرسل عن نفسه)
export function receive(L, state, msg, fromSlot) {
  if (L.role === 'host') {
    if (msg.t === 'cmd' && msg.c && typeof msg.c === 'object') {
      msg.c.p = fromSlot;
      if (msg.c.k !== 'leave') L.pending.push(msg.c);
    } else if (msg.t === 'hash') {
      checkHash(L, state, msg.n, msg.h, fromSlot);
    }
    return;
  }
  if (msg.t === 'turn') {
    L.turns.set(msg.n, Array.isArray(msg.c) ? msg.c : []);
    if (msg.n > L.lastTurn) L.lastTurn = msg.n;
  } else if (msg.t === 'sync') {
    loadSync(L, state, msg.s, msg.n);
  }
}

// --- المضيف ---
function hostTick(L, state) {
  const n = state.netTick + NET.delayTicks;
  const cmds = L.pending;
  L.pending = [];
  L.turns.set(n, cmds);
  L.send(ALL, { t: 'turn', n, c: cmds });
  runTurn(state, L.turns.get(state.netTick) || []);
  L.turns.delete(state.netTick - 1);
  if (state.netTick % NET.hashTicks === 0) {
    const h = hashState(state);
    L.hostHashes.set(state.netTick, h);
    L.hostHashes.delete(state.netTick - NET.hashTicks * 10);
    const waiting = L.peerHashes.get(state.netTick);
    if (waiting) {
      L.peerHashes.delete(state.netTick);
      for (const [slot, ph] of waiting) checkHash(L, state, state.netTick, ph, slot);
    }
  }
}

function checkHash(L, state, n, h, slot) {
  if (!L.hostHashes.has(n)) {                       // المنضم سبق المضيف: نقارن حين يبلغه
    if (n > state.netTick && n < state.netTick + NET.keepTicks) {
      if (!L.peerHashes.has(n)) L.peerHashes.set(n, []);
      L.peerHashes.get(n).push([slot, h]);
    }
    return;
  }
  if (L.hostHashes.get(n) === h) return;
  if (L.events.onDesync) L.events.onDesync(slot, n);
  resyncAll(L, state);
}

// إعادة المزامنة: المضيف يرسل مباراته كلها، ويفكها هو أيضاً فيتطابق الجميع (الترميز يقرّب الأعداد)
export function resyncAll(L, state) {
  const text = packMatch(state);
  const selected = new Set(state.units.filter(u => u.selected).map(u => u.id));
  unpackMatch(state, text, LOCAL_KEYS);
  for (const u of state.units) u.selected = selected.has(u.id) && u.playerId === state.humanId;
  L.hostHashes.clear();
  L.peerHashes.clear();
  L.resyncs++;
  L.send(ALL, { t: 'sync', n: state.netTick, s: text });
  if (L.events.onResync) L.events.onResync();
}

// --- المنضم ---
function loadSync(L, state, text, n) {
  const selected = new Set(state.units.filter(u => u.selected).map(u => u.id));
  unpackMatch(state, text, LOCAL_KEYS);
  for (const u of state.units) u.selected = selected.has(u.id) && u.playerId === state.humanId;
  for (const k of [...L.turns.keys()]) if (k < n) L.turns.delete(k);
  L.resyncs++;
  if (L.events.onResync) L.events.onResync();
}

function clientTick(L, state) {
  runTurn(state, L.turns.get(state.netTick));
  L.turns.delete(state.netTick - 1 - NET.keepTicks);
  if (state.netTick % NET.hashTicks === 0) L.send(0, { t: 'hash', n: state.netTick, h: hashState(state) });
}

// كم دوراً متتالياً جاهزاً من التحديث الحالي (المنضم)
function ready(L, state) {
  let k = 0;
  while (L.turns.has(state.netTick + k)) k++;
  return k;
}

// إطار واحد: يتقدم بالتحديثات حسب الوقت (والمنضم حسب الأدوار التي وصلت). يعيد كسر التحديث للرسم (0..1)
// paused: المضيف أوقف المباراة (المنضم يتوقف وحده لأن الأدوار لا تصل)
export function stepFrame(L, state, frameMs) {
  if (state.matchResult) { L.acc = 0; return 0; }
  if (L.role === 'host') {
    if (state.paused) { L.acc = 0; return 0; }
    L.acc += frameMs;
    let steps = 0;
    while (L.acc >= TICK_MS && steps < 5 && !state.matchResult) {
      hostTick(L, state);
      L.acc -= TICK_MS;
      steps++;
    }
    if (L.acc > TICK_MS * 5) L.acc = 0;
    return Math.min(1, L.acc / TICK_MS);
  }
  L.acc += frameMs;
  let avail = ready(L, state), steps = 0;
  const max = avail > NET.catchUpAbove ? NET.catchUpSteps : 5;
  while (avail > 0 && steps < max && (L.acc >= TICK_MS || avail > NET.catchUpAbove) && !state.matchResult) {
    clientTick(L, state);
    L.acc = Math.max(0, L.acc - TICK_MS);
    avail--;
    steps++;
  }
  if (!L.turns.has(state.netTick)) L.acc = Math.min(L.acc, TICK_MS);   // ينتظر المضيف: لا يدّخر وقتاً
  return Math.min(1, L.acc / TICK_MS);
}

// موضع كاميرا هذا الجهاز كأمر مشترك (لمستويات التفصيل)، حين يتغير وكل NET.camSeconds على الأكثر
export function sendCamera(L, state, nowMs) {
  if (nowMs - L.camAt < NET.camSeconds * 1000) return;
  L.camAt = nowMs;
  const cam = { k: 'cam', x: Math.round(state.camera.x), y: Math.round(state.camera.y),
                z: Math.round(state.camera.z * 100) / 100, w: Math.round(state.view.w), h: Math.round(state.view.h) };
  const key = cam.x + ',' + cam.y + ',' + cam.z + ',' + cam.w + ',' + cam.h;
  if (key === L.camSent) return;
  L.camSent = key;
  localCommand(L, cam);
}
