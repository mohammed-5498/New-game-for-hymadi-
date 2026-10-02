// شريط القوة (القسم 12.3): وضع كل لاعب في المباراة بلمحة واحدة
import { POWER_PANEL } from '../config.js';
import { sound } from '../audio/sound.js';
import { isPlayerAlive } from '../game/victory.js';
import { powerColumn } from '../game/modes.js';

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
  const rows = collectRows(state, column);
  const signature = rows.map(r => r.id + ':' + r.value + ':' + r.units + ':' + r.out + ':' + (r.bar ?? '')).join('|') + (folded ? 'f' : '');
  if (!force && signature === lastSignature) return;
  lastSignature = signature;

  // مطوية: سطر واحد فيه عدد أحياء اللاعب فقط
  const mine = rows.find(r => r.id === state.humanId);
  el('powerTitle').textContent = folded
    ? (column ? column.folded : 'أحيائي: ' + (mine ? mine.districts : 0))
    : 'القوة';

  if (folded) { el('powerRows').innerHTML = ''; return; }
  render(state, rows);
}

// سطر لكل لاعب: عدد أحيائه ووحداته، مرتبة تنازلياً، والمهزوم في الأسفل
function collectRows(state, column) {
  const districts = state.players.map(() => 0);
  const units = state.players.map(() => 0);

  for (const d of state.map.districts) if (d.owner !== null) districts[d.owner]++;
  for (const u of state.units) if (u.state !== 'dead') units[u.playerId]++;

  return state.players
    .filter(p => !p.neutral)                  // الشرطة ليست لاعباً
    .map(p => ({
      id: p.id,
      name: p.gangName,
      team: p.team,
      color: p.color,
      districts: districts[p.id],
      units: units[p.id],
      out: !isPlayerAlive(state, p.id),
      // الرقم الأبرز في السطر: الأحياء، أو ما يخص الطور
      value: column ? column.value(p.id) : districts[p.id],
      sortValue: column ? column.sortValue(p.id) : districts[p.id],
      bar: column && column.bar ? column.bar(p.id) : null
    }))
    .sort((a, b) => (a.out - b.out) || (b.sortValue - a.sortValue) || (b.units - a.units));
}

function render(state, rows) {
  const me = state.players[state.humanId];
  const container = el('powerRows');
  container.innerHTML = '';

  for (const row of rows) {
    const line = document.createElement('div');
    line.className = 'power-row';
    if (row.id === state.humanId) line.classList.add('me');
    // حليف: نفس الفريق ولست أنا (الفريق 0 يعني بلا فريق)
    else if (me && me.team && row.team === me.team) line.classList.add('ally');
    if (row.out) line.classList.add('out');

    const dot = document.createElement('span');
    dot.className = 'power-dot';
    dot.style.background = row.color;
    line.appendChild(dot);

    const name = document.createElement('span');
    name.className = 'power-name';
    name.textContent = row.name + (row.team ? ' ' : '');
    if (row.team) {
      const team = document.createElement('span');
      team.className = 'power-team';
      team.textContent = 'ف' + row.team;
      name.appendChild(team);
    }
    line.appendChild(name);

    const districts = document.createElement('span');
    districts.className = 'power-num districts';
    districts.textContent = row.value;
    line.appendChild(districts);

    // شريط صغير (دم الزعيم في حماية الزعيم)
    if (row.bar !== null) {
      const track = document.createElement('span');
      track.className = 'power-bar';
      const fill = document.createElement('span');
      fill.style.width = Math.round(Math.max(0, Math.min(1, row.bar)) * 100) + '%';
      fill.style.background = row.color;
      track.appendChild(fill);
      line.appendChild(track);
    }

    const units = document.createElement('span');
    units.className = 'power-num units';
    units.textContent = row.units;
    line.appendChild(units);

    container.appendChild(line);
  }
}
