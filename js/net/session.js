// اللعب المحلي (القسم 16): الجلسة كلها: الاستضافة والبحث والانضمام وغرفة الانتظار وبدء المباراة وأثناءها ونهايتها.
// المضيف يدير الغرفة (خانات اللاعبين في قائمة الإعداد)، ويرسل المباراة كلها لكل منضم عند البدء، ثم الأدوار.
// الواجهة تعطي الجلسة دوالاً (hooks) تُنادى حين يتغير شيء: lobbyChanged، foundChanged، enterGame،
// leftSession(reason, inGame)، backToLobby، resynced
import { NET, UI } from '../config.js';
import { createTransport } from './transport.js';
import { createLockstep, localCommand, receive, stepFrame, sendCamera, playerLeft, prepareLanMatch, ALL } from './lockstep.js';
import { packMatch, unpackMatch } from '../matchSave.js';
import { centerCameraOnHome } from '../state.js';

const S = {
  role: null,          // 'host' | 'client' | null
  phase: 'idle',       // 'search' (المنضم يبحث) | 'lobby' (غرفة الانتظار) | 'game'
  name: '',
  transport: null,
  ips: [],             // المضيف: عناوينه على الشبكة (تظهر لمن يكتب العنوان بيده)
  peers: new Map(),    // المضيف: رقم الاتصال ← {id, name, side, hello}
  slotOf: new Map(),   // المضيف أثناء المباراة: رقم الاتصال ← رقم اللاعب
  lobby: null,         // المنضم: آخر وصف للغرفة من المضيف
  hostName: '',
  myId: null,          // المنضم: رقم اتصاله عند المضيف (ليعرف خانته في وصف الغرفة)
  found: new Map(),    // المنضم: المباريات المعلنة على الشبكة (العنوان ← {name, ip, port, version, at})
  join: null,          // المنضم: طلب انضمام ينتظر رد المضيف {resolve, reject}
  L: null,             // المحاكاة خطوة بخطوة أثناء المباراة (lockstep.js)
  hostPaused: false,   // المنضم: المضيف أوقف المباراة
  waitingSince: 0,     // المنضم: منذ متى لا يصل دور جديد (للافتة "بانتظار المضيف")
  state: null,
  hooks: {}
};
export const lan = S;

const hook = (name, ...args) => { if (S.hooks[name]) S.hooks[name](...args); };
export const cleanName = (name) => String(name || '').replace(/[\r\n|]/g, ' ').trim().slice(0, NET.maxNameLength) || 'لاعب';

export function initLan(state, hooks) {
  S.state = state;
  S.hooks = hooks;
}

export const lanActive = () => S.phase === 'game' && !!S.L;
export const isLanHost = () => S.role === 'host';

function reset() {
  S.role = null; S.phase = 'idle'; S.transport = null; S.ips = [];
  S.peers.clear(); S.slotOf.clear(); S.found.clear();
  S.lobby = null; S.join = null; S.L = null; S.hostPaused = false; S.myId = null;
  if (S.state) S.state.lanRole = null;
}

// --- الأحداث من الشبكة ---
const handlers = {
  peer(id, address) {
    if (S.role === 'host') S.peers.set(id, { id, name: '', side: 'random', address, hello: false });
  },
  message(id, msg) {
    if (S.role === 'host') hostMessage(id, msg);
    else if (S.role === 'client' && id === 0) clientMessage(msg);
  },
  closed(id) {
    if (S.role === 'host') {
      S.peers.delete(id);
      if (S.phase === 'game' && S.L && S.slotOf.has(id)) playerLeft(S.L, S.slotOf.get(id));
      S.slotOf.delete(id);
      hook('lobbyChanged');
    } else if (S.role === 'client' && id === 0) {
      const inGame = S.phase === 'game';
      const join = S.join;
      S.transport.stop();
      reset();
      if (join) join.reject(new Error('أغلق المضيف الاتصال'));
      else hook('leftSession', 'انقطع الاتصال بالمضيف', inGame);
    }
  },
  found(info) {
    if (S.role !== 'client' || S.phase !== 'search' || !info || !info.ip) return;
    S.found.set(info.ip, { name: cleanName(info.name), ip: info.ip, port: +info.port || NET.port,
                           version: String(info.version), at: Date.now() });
    hook('foundChanged');
  }
};

// --- المضيف ---
export async function hostLan(name) {
  if (S.role) leaveLan();
  S.name = cleanName(name);
  S.transport = createTransport(handlers);
  S.role = 'host';
  S.phase = 'lobby';
  try {
    const res = await S.transport.host(S.name);
    S.ips = (res && res.ips) || [];
    return S.ips;
  } catch (e) {
    reset();
    throw e;
  }
}

function hostMessage(id, msg) {
  const peer = S.peers.get(id);
  if (!peer) return;
  if (msg.t === 'hello') {
    const reason = msg.v !== NET.version || msg.mv !== UI.matchVersion ? 'نسخة اللعبة مختلفة عند المضيف: ثبّتوا نفس الملف على كل الأجهزة'
      : S.phase !== 'lobby' ? 'المباراة بدأت، انتظر حتى تنتهي'
      : !(S.hooks.canSeat ? S.hooks.canSeat() : true) ? 'الغرفة ممتلئة' : null;
    if (reason) {
      S.transport.send(id, { t: 'reject', reason });
      setTimeout(() => S.transport && S.transport.closePeer(id), 400);   // بعد أن تصل الرسالة
      return;
    }
    peer.name = cleanName(msg.name);
    peer.side = typeof msg.side === 'string' ? msg.side : 'random';
    peer.hello = true;
    S.transport.send(id, { t: 'welcome', id, host: S.name });
    hook('lobbyChanged');
  } else if (msg.t === 'side' && typeof msg.side === 'string') {
    peer.side = msg.side;
    hook('lobbyChanged');
  } else if (msg.t === 'bye') {
    S.transport.closePeer(id);
  } else if (S.phase === 'game' && S.L && S.slotOf.has(id)) {
    receive(S.L, S.state, msg, S.slotOf.get(id));
  }
}

// المنضمون الذين عرّفوا بأنفسهم (لخانات قائمة الإعداد)
export const lanPeers = () => [...S.peers.values()].filter(p => p.hello);

// وصف الغرفة لكل المنضمين (تبنيه قائمة الإعداد من خاناتها)
export function broadcastLobby(view) {
  if (S.role === 'host' && S.phase === 'lobby') S.transport.send(ALL, { t: 'lobby', ...view });
}

export function kickPeer(id) {
  if (S.role === 'host' && S.transport) S.transport.closePeer(id);
}

// بدء المباراة عند المضيف: الحالة جاهزة (resetMatch)، وpeerOfPlayer[k] رقم اتصال صاحب اللاعب k أو null
export function startLanHost(state, peerOfPlayer) {
  prepareLanMatch(state);
  const text = packMatch(state);
  unpackMatch(state, text);                 // المضيف يبدأ من نفس الحالة المفكوكة حرفياً، كالمنضمين
  state.humanId = 0;
  state.lanRole = 'host';
  state.paused = false;
  centerCameraOnHome(state);
  S.slotOf.clear();
  peerOfPlayer.forEach((id, k) => {
    if (id === null || id === undefined || !S.peers.has(id)) return;
    S.slotOf.set(id, k);
    S.transport.send(id, { t: 'start', you: k, s: text });
  });
  S.L = createLockstep('host', (to, m) => S.transport.send(to, m), 0, { onResync: () => hook('resynced') });
  S.phase = 'game';
}

// المضيف أوقف المباراة أو استأنفها (اللافتة عند المنضمين؛ والتوقف نفسه لأن الأدوار لا تصل)
export function lanPause(on) {
  if (S.role === 'host' && S.transport) S.transport.send(ALL, { t: 'pause', on: !!on });
}

// بعد النهاية: المضيف يعود بالجميع إلى الغرفة لمباراة جديدة
export function lanBackToLobby() {
  if (S.role !== 'host') return;
  S.phase = 'lobby';
  S.L = null;
  S.slotOf.clear();
  S.transport.send(ALL, { t: 'back' });
  hook('lobbyChanged');                     // وصف الغرفة من جديد (ربما غادر أحد أثناء المباراة)
}

// --- المنضم ---
export async function searchLan() {
  if (S.role) leaveLan();
  S.transport = createTransport(handlers);
  S.role = 'client';
  S.phase = 'search';
  try {
    await S.transport.discover();
  } catch (e) {
    // البحث لا يعمل على هذه الشبكة: كتابة العنوان باليد تبقى ممكنة
    hook('foundChanged', e && e.message);
  }
}

export async function joinLan(ip, port, name, side) {
  if (S.role !== 'client') await searchLan();
  S.name = cleanName(name);
  S.transport.stopDiscover();
  try {
    await S.transport.connect(String(ip).trim(), port || NET.port);
  } catch (e) {
    throw new Error('تعذر الاتصال بـ ' + ip + ': تأكد من العنوان، وأن المضيف في قائمة الإعداد، وأنكما على نفس الشبكة');
  }
  return new Promise((resolve, reject) => {
    S.join = {
      resolve: (v) => { S.join = null; resolve(v); },
      reject: (e) => { S.join = null; reject(e); }
    };
    S.transport.send(0, { t: 'hello', v: NET.version, mv: UI.matchVersion, name: S.name, side });
    setTimeout(() => {
      if (!S.join) return;
      const j = S.join;
      leaveLan();
      j.reject(new Error('لا رد من المضيف'));
    }, 6000);
  });
}

function clientMessage(msg) {
  if (msg.t === 'welcome') {
    S.phase = 'lobby';
    S.hostName = cleanName(msg.host);
    S.myId = msg.id;
    if (S.join) S.join.resolve(S.hostName);
  } else if (msg.t === 'reject') {
    const j = S.join;
    leaveLan();
    if (j) j.reject(new Error(msg.reason || 'رفض المضيف'));
  } else if (msg.t === 'lobby') {
    S.lobby = msg;
    hook('lobbyChanged');
  } else if (msg.t === 'start') {
    clientStart(msg);
  } else if (msg.t === 'pause') {
    S.hostPaused = !!msg.on;
  } else if (msg.t === 'back') {
    S.phase = 'lobby';
    S.L = null;
    S.hostPaused = false;
    hook('backToLobby');
  } else if (S.L) {
    receive(S.L, S.state, msg, 0);
  }
}

function clientStart(msg) {
  const state = S.state;
  try {
    unpackMatch(state, msg.s);
  } catch (e) {
    leaveLan();
    hook('leftSession', 'تعذر استلام المباراة: ' + e.message, false);
    return;
  }
  state.humanId = msg.you;
  state.lanRole = 'client';
  state.paused = false;
  centerCameraOnHome(state);
  S.L = createLockstep('client', (to, m) => S.transport.send(0, m), msg.you, { onResync: () => hook('resynced') });
  S.hostPaused = false;
  S.waitingSince = 0;
  S.phase = 'game';
  hook('enterGame');
}

export function setMySide(side) {
  if (S.role === 'client' && S.transport) S.transport.send(0, { t: 'side', side });
}

// مغادرة الجلسة (المنضم يودّع المضيف، والمضيف يغلق الكل). الإغلاق فوري: انقطاع الاتصال يكفي المضيف
// إن لم يصل الوداع، والإضافة الأصلية واحدة لكل الجلسات فلا يُؤجَّل إيقافها حتى لا يوقف جلسة بعدها
export function leaveLan() {
  if (S.transport) {
    if (S.role === 'client') S.transport.send(0, { t: 'bye' });
    S.transport.stop();
  }
  reset();
}

// --- أثناء المباراة ---
export function lanCommand(cmd) {
  if (S.L) localCommand(S.L, cmd);
}

// إطار واحد من حلقة اللعبة: موضع الكاميرا ثم التحديثات. يعيد كسر التحديث للرسم
export function lanFrame(state, frameMs, nowMs) {
  sendCamera(S.L, state, nowMs);
  const before = state.netTick;
  const alpha = stepFrame(S.L, state, frameMs);
  if (S.role === 'client') {
    if (state.netTick !== before || state.matchResult) S.waitingSince = 0;
    else if (!S.waitingSince) S.waitingSince = nowMs;
  }
  return alpha;
}

// سطر قصير للافتة أعلى الشاشة أثناء المباراة، أو null
export function lanStatus(nowMs) {
  if (S.phase !== 'game') return null;
  if (S.role === 'client' && S.hostPaused) return 'أوقف المضيف المباراة';
  if (S.role === 'client' && S.waitingSince && nowMs - S.waitingSince > 1500) return 'بانتظار المضيف…';
  return null;
}
