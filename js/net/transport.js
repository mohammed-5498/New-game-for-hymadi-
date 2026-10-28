// اللعب المحلي (القسم 16): نقل الرسائل بين الأجهزة. في تطبيق أندرويد إضافة LanNet (LanPlugin.java):
// خادم عند المضيف وإعلان على الواي فاي، واتصال من المنضمين. وفي المتصفح (للتجربة فقط، بإضافة ?lan=test
// للرابط) قناة BroadcastChannel بين نوافذ المتصفح نفسه، بنفس الواجهة، فتُجرَّب الجلسة كلها بلا جوالين.
// أرقام الاتصالات: المنضمون عند المضيف من 1، والمضيف عند المنضم 0. send(to < 0) للجميع.
// handlers: peer(id, address)، message(id, msg)، closed(id)، found({name, ip, port, version})
import { NET } from '../config.js';
import { isNativeApp } from '../platform.js';

const testMode = () => typeof location !== 'undefined' && /[?&]lan=test\b/.test(location.search);
export const lanAvailable = () => isNativeApp() || (testMode() && typeof BroadcastChannel !== 'undefined');

const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };

let handlers = null;          // معالجات الجلسة الحالية (المستمعون يُسجَّلون مرة واحدة ويمررون إليها)
export function createTransport(h) {
  handlers = h;
  return isNativeApp() ? nativeTransport() : testTransport();
}

// --- تطبيق أندرويد ---
let nativeBound = false;
function nativeTransport() {
  const cap = window.Capacitor;
  const call = (method, opts = {}) => cap.nativePromise('LanNet', method, opts);
  if (!nativeBound) {
    nativeBound = true;
    cap.addListener('LanNet', 'peer', (e) => handlers && handlers.peer(e.id, e.address));
    cap.addListener('LanNet', 'message', (e) => {
      const msg = parse(e.data);
      if (msg && handlers) handlers.message(e.id, msg);
    });
    cap.addListener('LanNet', 'closed', (e) => handlers && handlers.closed(e.id));
    cap.addListener('LanNet', 'found', (e) => handlers && handlers.found(e));
  }
  return {
    host: (name) => call('host', { port: NET.port, beaconPort: NET.beaconPort, beaconMs: NET.beaconSeconds * 1000,
                                   name, version: String(NET.version) }),
    discover: () => call('discover', { beaconPort: NET.beaconPort }),
    stopDiscover: () => { call('stopDiscover').catch(() => {}); },
    connect: (ip, port) => call('connect', { ip, port: port || NET.port, timeoutMs: 4000 }),
    send: (to, msg) => { call('send', { to, data: JSON.stringify(msg) }).catch(() => {}); },
    closePeer: (id) => { call('closePeer', { id }).catch(() => {}); },
    stop: () => { call('stop').catch(() => {}); }
  };
}

// --- المتصفح للتجربة: نوافذ نفس المتصفح كأجهزة على شبكة واحدة ---
function testTransport() {
  const ch = new BroadcastChannel('gangcity-lan');
  const me = 'tab' + Math.random().toString(36).slice(2, 8);
  let role = null, hostTab = null, beacon = null, discovering = false, pending = null, nextId = 1;
  const peers = new Map();                         // رقم المنضم ← نافذته (عند المضيف)
  const idOf = (tab) => { for (const [id, t] of peers) if (t === tab) return id; return 0; };
  const post = (kind, to, extra = {}) => ch.postMessage({ kind, from: me, to, ...extra });

  ch.onmessage = (ev) => {
    const m = ev.data;
    if (m.kind === 'beacon') {
      if (discovering && handlers) handlers.found({ name: m.name, ip: 'test-' + m.from, port: 0, version: m.version });
      return;
    }
    if (m.to !== me || !handlers) return;
    if (m.kind === 'connect' && role === 'host') {
      const id = nextId++;
      peers.set(id, m.from);
      post('accept', m.from);
      handlers.peer(id, 'test-' + m.from);
    } else if (m.kind === 'accept' && pending && m.from === hostTab) {
      const p = pending;
      pending = null;
      handlers.peer(0, 'test-' + m.from);
      p.resolve();
    } else if (m.kind === 'msg') {
      const msg = parse(m.data);
      if (!msg) return;
      if (role === 'host') { const id = idOf(m.from); if (id) handlers.message(id, msg); }
      else if (m.from === hostTab) handlers.message(0, msg);
    } else if (m.kind === 'close') {
      if (role === 'host') { const id = idOf(m.from); if (id) { peers.delete(id); handlers.closed(id); } }
      else if (m.from === hostTab) { role = null; handlers.closed(0); }
    }
  };
  const stop = () => {
    if (beacon) { clearInterval(beacon); beacon = null; }
    if (role === 'host') for (const tab of peers.values()) post('close', tab);
    else if (role === 'client' && hostTab) post('close', hostTab);
    peers.clear();
    role = null;
    discovering = false;
  };
  window.addEventListener('pagehide', stop);
  return {
    host(name) {
      role = 'host';
      const send = () => ch.postMessage({ kind: 'beacon', from: me, name, version: String(NET.version) });
      send();
      beacon = setInterval(send, NET.beaconSeconds * 1000);
      return Promise.resolve({ port: 0, ips: ['test-' + me] });
    },
    discover() { discovering = true; return Promise.resolve(); },
    stopDiscover() { discovering = false; },
    connect(ip) {
      role = 'client';
      hostTab = String(ip).replace(/^test-/, '');
      return new Promise((resolve, reject) => {
        pending = { resolve };
        post('connect', hostTab);
        setTimeout(() => { if (pending) { pending = null; role = null; reject(new Error('لا رد من ' + ip)); } }, 3000);
      });
    },
    send(to, msg) {
      const data = JSON.stringify(msg);
      if (role === 'host') {
        const tabs = to < 0 ? [...peers.values()] : [peers.get(to)];
        for (const tab of tabs) if (tab) post('msg', tab, { data });
      } else if (role === 'client') post('msg', hostTab, { data });
    },
    closePeer(id) {
      const tab = peers.get(id);
      if (!tab) return;
      post('close', tab);
      peers.delete(id);
      handlers.closed(id);
    },
    stop
  };
}
