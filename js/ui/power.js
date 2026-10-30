// شريط القوة (القسم 12.3): وضع كل لاعب في المباراة بلمحة واحدة
import { POWER_PANEL } from '../config.js';
import { sound } from '../audio/sound.js';
import { isPlayerAlive } from '../game/victory.js';
import { powerColumn, sideKey } from '../game/modes.js';

const el = (id) => document.getElementById(id);

let folded = false;
let nextUpdate = 0;      // بالزمن الحقيقي: اللوحة تتحدث كل ثانية لا كل إطار
let lastSignature = '';

export function setupPower(state) {
  folded = loadFolded();
  applyFold();

  el('powerHead').addEventListener('click', () => {
    sound('ui_tap');
    folded = !folded;
    applyFold();
    saveFolded();
    lastSignature = '';            // أعد الرسم فوراً بعد الطي أو الفتح
    updatePower(state, true);
  });
}

function applyFold() {
  el('power').classList.toggle('folded', folded);
  el('powerArrow').textContent = folded ? '▸' : '▾';
}

function loadFolded() {
  try { return localStorage.getItem(POWER_PANEL.storageKey) === '1'; }
  catch (e) { return false; }
}

function saveFolded() {
  try { localStorage.setItem(POWER_PANEL.storageKey, folded ? '1' : '0'); }
  catch (e) { /* تخزين معطّل */ }
}

// تتحدث كل ثانية لا كل إطار
export function updatePower(state, force = false) {
  const now = performance.now();
  if (!force && now < nextUpdate) return;
  nextUpdate = now + POWER_PANEL.updateSeconds * 1000;

  const column = powerColumn(state);              // عمود الطور: نقاط أو زمن أو دم الزعيم (القسم 9.5)
  if (column && column.summary) { renderSummary(column, force); return; }
  const groups = collectGroups(state, column);
  const signature = state.humanId + '#' + groups.map(g => g.value + '=' + g.rows.map(r =>
    [r.id, r.name, r.color, r.value, r.units, r.out, r.bar ?? ''].join(':')).join(',')).join('|') + (folded ? 'f' : '');
  if (!force && signature === lastSignature) return;
  lastSignature = signature;

  // مطوية: سطر واحد فيه عدد أحياء اللاعب فقط
  const mine = groups.flatMap(g => g.rows).find(r => r.id === state.humanId);
  el('powerTitle').textContent = folded
    ? (column ? column.folded : 'أحيائي: ' + (mine ? mine.districts : 0))
    : 'القوة';

  if (folded) { el('powerRows').innerHTML = ''; return; }
  render(state, groups);
}

// سطر لكل لاعب: قيمته (الأحياء أو ما يخص الطور) ووحداته. وأفراد الفريق معاً تحت سطر الفريق بقيمته:
// متوسط نقاطهم، أو مجموع ما يعدّه الطور (القسم 12.3). الأعلى أولاً، والمهزوم في الأسفل
function collectGroups(state, column) {
  const districts = state.players.map(() => 0);
  const units = state.players.map(() => 0);

  for (const d of state.map.districts) if (d.owner !== null) districts[d.owner]++;
  for (const u of state.units) if (u.state !== 'dead') units[u.playerId]++;

  const show = column ? column.show : (v) => v;
  const rank = (a, b) => (a.out - b.out) || (b.sortValue - a.sortValue) || (b.units - a.units);
  const groups = new Map();
  for (const p of state.players) {
    if (p.neutral) continue;                  // الشرطة ليست لاعباً
    const key = sideKey(p);
    if (!groups.has(key)) groups.set(key, { team: p.team, rows: [] });
    const sortValue = column ? column.sortValue(p.id) : districts[p.id];
    groups.get(key).rows.push({
      id: p.id,
      name: p.gangName,
      color: p.color,
      districts: districts[p.id],
      units: units[p.id],
      out: !isPlayerAlive(state, p.id),
      value: show(sortValue),
      sortValue,
      bar: column && column.bar ? column.bar(p.id) : null
    });
  }
  for (const g of groups.values()) {
    g.rows.sort(rank);
    const total = g.rows.reduce((sum, r) => sum + r.sortValue, 0);
    g.sortValue = column && column.teamAverage ? total / g.rows.length : total;
    g.value = show(g.sortValue);
    g.units = g.rows.reduce((sum, r) => sum + r.units, 0);
    g.out = g.rows.every(r => r.out);
    g.head = g.rows.length > 1;               // فريق بفرد واحد سطر عادي
  }
  return [...groups.values()].sort(rank);
}

// الصمود ضد الشرطة: رقم الموجة وعدد الشرطة الأحياء بدل قائمة اللاعبين
function renderSummary(column, force) {
  const signature = 's:' + column.summary.map(([, v]) => v).join(',') + (folded ? 'f' : '');
  if (!force && signature === lastSignature) return;
  lastSignature = signature;
  el('powerTitle').textContent = folded ? column.folded : 'القوة';
  const container = el('powerRows');
  container.innerHTML = '';
  if (folded) return;
  for (const [label, value] of column.summary) {
    const line = document.createElement('div');
    line.className = 'power-row';
    const name = document.createElement('span');
    name.className = 'power-name';
    name.textContent = label;
    line.appendChild(name);
    const num = document.createElement('span');
    num.className = 'power-num districts';
    num.textContent = value;
    line.appendChild(num);
    container.appendChild(line);
  }
}

// عقد الأسطر تبقى بين التحديثات (بمفتاح اللاعب أو الفريق)، والترتيب بخاصية order لا بنقلها في الصفحة:
// نقل العقدة يعيد تمرير الاسم الطويل من أوله
const nodes = new Map();

function rowNode(key) {
  let line = nodes.get(key);
  if (!line) {
    line = document.createElement('div');
    line.innerHTML = '<span class="power-dot"></span><span class="power-name"><span></span></span>' +
      '<span class="power-num districts"></span><span class="power-bar" hidden><span></span></span><span class="power-num units"></span>';
    nodes.set(key, line);
  }
  return line;
}

const setText = (node, text) => { if (node.textContent !== String(text)) node.textContent = text; };

// يملأ السطر ويعيده. color فارغ: بلا دائرة (سطر الفريق)، وbar رقم من 0 إلى 1 أو null
function fill(line, className, color, name, value, bar, units) {
  if (line.className !== className) line.className = className;
  const [dot, nameBox, num, track, count] = line.children;
  dot.hidden = !color;
  dot.style.background = color;
  setText(nameBox.firstChild, name);
  setText(num, value);
  track.hidden = bar === null;
  if (bar !== null) {
    track.firstChild.style.width = Math.round(Math.max(0, Math.min(1, bar)) * 100) + '%';
    track.firstChild.style.background = color;
  }
  setText(count, units);
  return line;
}

// الاسم الأطول من مكانه يُمرَّر من أوله (يمينه) إلى آخره ثم يعود
function fitName(box) {
  const over = Math.ceil(box.firstChild.offsetWidth - box.clientWidth);
  box.classList.toggle('scroll', over > 1);
  if (over > 1 && box.style.getPropertyValue('--shift') !== over + 'px') {
    box.style.setProperty('--shift', over + 'px');
    box.style.setProperty('--dur', (POWER_PANEL.scrollSeconds + over / POWER_PANEL.scrollSpeed).toFixed(2) + 's');
  }
}

function render(state, groups) {
  const order = [];
  for (const g of groups) {
    if (g.head) order.push(fill(rowNode('team' + g.team), 'power-row team-head' + (g.out ? ' out' : ''), '', 'فريق ' + g.team, g.value, null, ''));
    for (const row of g.rows) {
      const className = 'power-row' + (g.head ? ' member' : '') + (row.id === state.humanId ? ' me' : '') + (row.out ? ' out' : '');
      order.push(fill(rowNode(row.id), className, row.color, row.name, row.value, row.bar, row.units));
    }
  }
  const container = el('powerRows');
  for (const line of [...container.children]) if (!order.includes(line)) line.remove();
  order.forEach((line, k) => {
    line.style.order = k;
    if (line.parentNode !== container) container.appendChild(line);
  });
  for (const line of order) fitName(line.children[1]);
}
