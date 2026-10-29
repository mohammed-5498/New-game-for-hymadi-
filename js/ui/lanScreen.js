// شاشة اللعب المحلي (القسم 16، بطلب المستخدم: أسهل وأبسط): تبحث وحدها حين تُفتح، فتظهر المباريات القريبة
// أزراراً ولمسة تنضم إليها، وزر استضافة كبير، والاسم معبأ سلفاً. وعنوان المضيف باليد مخفي تحت رابط صغير.
// بعد الانضمام: غرفة انتظار المنضم. والمضيف يعدّ المباراة في قائمة الإعداد نفسها (menus.js: openLanSetup)
import { NET, MAP_SIZES, PLAYER_COLORS, CITIES, gameModes as GM } from '../config.js';
import { sound, startMusic } from '../audio/sound.js';
import { getPref, setPref } from '../prefs.js';
import { lan, initLan, cleanName, hostLan, searchLan, joinLan, leaveLan, setMySide } from '../net/session.js';
import { lanAvailable } from '../net/transport.js';
import { SIDE_CHOICES } from '../game/nations.js';
import {
  showScreen, showMainNotice, openLanSetup, closeLanSetup, isLanSetup, syncLanSlots, lanHasSeat, pickSide, sideLabel
} from './menus.js';
import { leaveToMain, backToLobby } from './hud.js';
import { closePicker } from './picker.js';

const el = (id) => document.getElementById(id);

let view = 'home';           // home (المباريات القريبة والاستضافة) | lobby (غرفة انتظار المنضم)
let busy = false;            // استضافة أو اتصال جارٍ: لا تُكرر اللمسة
let foundSign = '';          // ما في قائمة المباريات المعروضة (لا تُبنى أزرارها من جديد إلا حين يتغير)
let foundTimer = 0;
let mySide = SIDE_CHOICES.includes(getPref('lanSide')) ? getPref('lanSide') : 'random';

function tap(id, action) {
  el(id).addEventListener('click', () => { sound('ui_tap'); action(); });
}

export function setupLanScreen(state) {
  // اسم جاهز من أول مرة (لاعب ورقم)، فلا خطوة قبل اللعب، ويبقى قابلاً للتغيير
  if (!getPref('lanName')) setPref('lanName', cleanName('لاعب ' + (10 + Math.floor(Math.random() * 90))));
  el('lanName').value = getPref('lanName');
  el('lanName').addEventListener('change', myName);
  tap('btnLan', openLan);
  tap('btnLanHost', host);
  tap('btnLanManual', () => { el('lanManual').hidden = !el('lanManual').hidden; });
  tap('btnLanConnect', () => connect(el('lanIp').value, NET.port));
  tap('btnLanSide', () => pickSide('اختر أمتك', () => mySide, (side) => {
    mySide = side;
    setPref('lanSide', side);
    setMySide(side);
    render();
  }));
  tap('btnLanBack', lanBack);

  initLan(state, {
    lobbyChanged: () => { if (isLanSetup()) syncLanSlots(); else if (view === 'lobby') render(); },
    foundChanged: (error) => { if (error) status(error, true); if (view === 'home') renderFound(); },
    canSeat: lanHasSeat,
    // المضيف بدأ المباراة: المنضم يدخلها مباشرة (ولو كانت لوحة الأمم مفتوحة عنده)
    enterGame: () => {
      closePicker();
      state.running = true;
      showScreen('game');
      startMusic();
    },
    // انقطع المنضم عن المضيف (أو أغلق المضيف الجلسة)
    leftSession: (reason, inGame) => {
      closePicker();
      if (inGame) {
        view = 'home';
        leaveToMain(state);
        showMainNotice(reason);
        return;
      }
      goHome();
      status(reason, true);
    },
    // المضيف أنهى المباراة ورجع للغرفة: المنضم إلى غرفة الانتظار
    backToLobby: () => {
      view = 'lobby';
      backToLobby(state, 'lan');
      render();
    }
  });
}

function openLan() {
  if (!lanAvailable()) {
    showMainNotice('اللعب المحلي في تطبيق أندرويد: ثبّتوا نفس ملف اللعبة على كل جوال.');
    return;
  }
  showScreen('lan');
  goHome();
}

// الشاشة الأولى: البحث يبدأ وحده (ويعاد بعد كل رجوع إليها)
function goHome() {
  view = 'home';
  status('');
  foundSign = null;
  searchLan();
  render();
}

// زر "رجوع" وزر الرجوع في أندرويد، في هذه الشاشة وفي قائمة إعداد المضيف
export function lanBack() {
  if (isLanSetup()) {                // المضيف: يوقف الاستضافة ويعود لهذه الشاشة
    closeLanSetup();
    leaveLan();
    showScreen('lan');
    goHome();
    return;
  }
  if (view === 'lobby') {            // غرفة الانتظار: يغادر ويعود للمباريات القريبة
    leaveLan();
    goHome();
    return;
  }
  leaveLan();                        // يوقف البحث
  clearInterval(foundTimer);
  showScreen('main');
}

function myName() {
  const name = cleanName(el('lanName').value);
  el('lanName').value = name;
  setPref('lanName', name);
  return name;
}

async function host() {
  if (busy) return;
  busy = true;
  status('جارٍ بدء الاستضافة…');
  try {
    await hostLan(myName());
    status('');
    clearInterval(foundTimer);
    openLanSetup();
  } catch (e) {
    status(e.message || 'تعذرت الاستضافة', true);
    searchLan();
  }
  busy = false;
}

async function connect(ip, port) {
  ip = String(ip || '').trim();
  if (busy || !ip) return;
  busy = true;
  status('جارٍ الاتصال…');
  try {
    await joinLan(ip, port, myName(), mySide);
    view = 'lobby';
    status('');
    render();
  } catch (e) {
    goHome();                        // البحث يعود فيختار غيرها أو يعيد المحاولة
    status(e.message || 'تعذر الاتصال', true);
  }
  busy = false;
}

function status(text, error = false) {
  const node = el('lanStatus');
  node.hidden = !text;
  node.textContent = text;
  node.classList.toggle('error', error);
}

function render() {
  el('lanHome').hidden = view !== 'home';
  el('lanLobby').hidden = view !== 'lobby';
  clearInterval(foundTimer);
  if (view === 'home') {
    renderFound();
    foundTimer = setInterval(renderFound, 1000);     // المضيف الذي توقف إعلانه يختفي من القائمة
  }
  if (view === 'lobby') renderLobby();
}

// المباريات المعلنة على الشبكة في آخر ثوانٍ قليلة، كل واحدة زر انضمام
function renderFound() {
  const now = Date.now();
  const games = [...lan.found.values()].filter(g => now - g.at < NET.foundSeconds * 1000);
  const sign = games.map(g => g.ip + g.name + g.version).join('|');
  if (sign === foundSign) return;
  foundSign = sign;
  const list = el('lanFound');
  list.innerHTML = '';
  if (!games.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'جارٍ البحث… تظهر هنا مباراة صديقك حين يضغط "استضافة مباراة جديدة".';
    list.appendChild(p);
  }
  for (const game of games) {
    const button = document.createElement('button');
    button.className = 'wide';
    button.textContent = 'انضم إلى «' + game.name + '»';
    if (game.version !== String(NET.version)) {
      const note = document.createElement('small');
      note.className = 'hint';
      note.textContent = ' • نسخة مختلفة';
      button.appendChild(note);
    }
    button.addEventListener('click', () => { sound('ui_tap'); connect(game.ip, game.port); });
    list.appendChild(button);
  }
}

const cityText = (city) => city === 'random' ? 'مدينة عشوائية' : city === 'host' ? 'مدينة المضيف' : (CITIES.short[city] || '');

// غرفة الانتظار: ما يعدّه المضيف الآن، واللاعبون بألوانهم وأممهم، وأمتك
function renderLobby() {
  const room = lan.lobby;
  const parts = ['المضيف: ' + lan.hostName];
  if (room) {
    if (GM[room.mode]) parts.push(GM[room.mode].name);
    parts.push(cityText(room.city));
    if (MAP_SIZES[room.mapSize]) parts.push('خريطة ' + MAP_SIZES[room.mapSize].name);
  }
  el('lanLobbyInfo').textContent = parts.filter(Boolean).join(' • ');

  const list = el('lanPlayers');
  list.innerHTML = '';
  for (const p of (room && Array.isArray(room.players) ? room.players : [])) {
    const me = p.kind === 'net' && p.peer === lan.myId;
    const row = document.createElement('div');
    row.className = 'lan-player' + (me ? ' me' : '');
    const dot = document.createElement('span');
    dot.className = 'dot';
    const color = PLAYER_COLORS.find(c => c.id === p.color);
    dot.style.background = color ? color.hex : '#888';
    const name = document.createElement('b');
    name.textContent = String(p.name || '') + (p.kind === 'host' ? ' (المضيف)' : me ? ' (أنت)' : '');
    const side = document.createElement('small');
    side.textContent = sideLabel(p.side).text + (p.team ? ' • فريق ' + p.team : '');
    row.append(dot, name, side);
    list.appendChild(row);
  }

  const label = sideLabel(mySide);
  el('lanSideChoice').textContent = label.text;
  el('lanSideNote').textContent = label.note;
}
