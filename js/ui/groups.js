// مجموعات التحكم (القسم 4.4): مثل Age of Empires II، تحفظ جنوداً برقم ثم تحددهم بلمسة
// - ضغطة مطوّلة ومعك تحديد: حفظ المحددين في الرقم (بلا تحديد: لا شيء)
// - لمسة: تحديد المجموعة وحدها، ثم الرجوع لوضع تحريك الخريطة
// - لمستان سريعتان: التحديد ونقل الكاميرا إلى مركز المجموعة بانتقال ناعم
// العضوية حقل في الجندي نفسه (unit.group)، فلا يكون في مجموعتين، والميت يخرج تلقائياً لأنه لا يُعد.
import { controlGroups as CG, TILE_HALF_W, TILE_HALF_H } from '../config.js';
import { clampCamera } from '../render/renderer.js';
import { sound } from '../audio/sound.js';
import { setInputMode } from './hud.js';

const el = (id) => document.getElementById(id);
const isMember = (state, unit, k) =>
  unit.group === k && unit.playerId === state.humanId && unit.state !== 'dead';

let buttons = [];
let last = '';                   // آخر ما رُسم على الأزرار: لا نلمس DOM بلا تغيير

export function setupGroups(state) {
  const box = el('groups');
  box.innerHTML = '';
  buttons = [];
  for (let k = 0; k < CG.count; k++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'grp empty';
    button.innerHTML = '<b>' + (k + 1) + '</b><span class="cnt"></span>';
    bindGestures(state, button, k);
    box.appendChild(button);
    buttons.push(button);
  }
}

// --- الإيماءات على زر واحد ---
// الأزرار عناصر مستقلة فوق اللوحة: لمساتها لا تصل للخريطة أصلاً
function bindGestures(state, button, k) {
  let holdTimer = null, held = false, lastTap = 0, pointer = null;

  const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; };

  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    pointer = e.pointerId;
    try { button.setPointerCapture(e.pointerId); } catch (_) {}
    held = false;
    cancelHold();
    holdTimer = setTimeout(() => {
      holdTimer = null;
      held = true;                      // انتهت المدة: لن تُحسب لمسة عند الرفع
      saveGroup(state, k);
    }, CG.holdMs);
  });

  button.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pointer) return;
    e.preventDefault();
    e.stopPropagation();
    pointer = null;
    const wasHold = held || holdTimer === null;
    cancelHold();
    if (wasHold) return;

    const now = performance.now();
    const double = now - lastTap <= CG.doubleTapMs;
    lastTap = double ? 0 : now;         // اللمسة الثالثة تبدأ من جديد
    selectGroup(state, k, double);
  });

  button.addEventListener('pointercancel', () => { pointer = null; cancelHold(); held = true; });
  button.addEventListener('contextmenu', (e) => e.preventDefault());
}

// حفظ المحددين في الرقم k: يحل محل ما كان فيه، وكل جندي يخرج من مجموعته القديمة تلقائياً
function saveGroup(state, k) {
  const chosen = state.units.filter(u => u.selected && u.playerId === state.humanId && u.state !== 'dead');
  if (!chosen.length) return false;                     // بلا تحديد: لا شيء
  for (const unit of state.units) if (unit.group === k) unit.group = null;
  for (const unit of chosen) unit.group = k;
  sound('command');
  const button = buttons[k];
  button.classList.remove('saved');
  void button.offsetWidth;                              // إعادة تشغيل ومضة التأكيد
  button.classList.add('saved');
  last = '';
  return true;
}

// تحديد المجموعة وحدها (ومع اللمستين: نقل الكاميرا إلى مركزها)
function selectGroup(state, k, moveCamera) {
  let count = 0, sx = 0, sy = 0;
  for (const unit of state.units) {
    if (isMember(state, unit, k)) { count++; sx += unit.x; sy += unit.y; }
  }
  if (!count) return false;                             // رقم فارغ: لا شيء
  for (const unit of state.units) unit.selected = isMember(state, unit, k);
  sound('select');
  if (state.inputMode === 'select') setInputMode(state, 'pan');

  if (moveCamera) {
    const i = sx / count, j = sy / count;
    state.cameraTween = {
      fromX: state.camera.x, fromY: state.camera.y,
      toX: (i - j) * TILE_HALF_W, toY: (i + j) * TILE_HALF_H,
      t: 0
    };
  }
  last = '';
  return true;
}

// كل إطار: انتقال الكاميرا الناعم، وتحديث الأعداد والمجموعة المضاءة عند تغيرها فقط
export function updateGroups(state, frameMs) {
  const tween = state.cameraTween;
  if (tween) {
    tween.t = Math.min(1, tween.t + frameMs / 1000 / CG.cameraSeconds);
    const e = tween.t * tween.t * (3 - 2 * tween.t);     // بداية ونهاية ناعمتان
    state.camera.x = tween.fromX + (tween.toX - tween.fromX) * e;
    state.camera.y = tween.fromY + (tween.toY - tween.fromY) * e;
    clampCamera(state);
    if (tween.t >= 1) state.cameraTween = null;
  }

  const counts = new Array(CG.count).fill(0);
  const picked = new Array(CG.count).fill(0);
  let selected = 0;
  for (const unit of state.units) {
    if (unit.playerId !== state.humanId || unit.state === 'dead') continue;
    if (unit.selected) selected++;
    const k = unit.group;
    if (k === null || k === undefined || k >= CG.count) continue;
    counts[k]++;
    if (unit.selected) picked[k]++;
  }
  // المجموعة "المحددة حالياً": التحديد هو جنودها بالضبط
  const active = counts.findIndex((c, k) => c > 0 && picked[k] === c && selected === c);

  const human = state.players[state.humanId];
  const signature = counts.join(',') + '|' + active + '|' + (human ? human.color : '');
  if (signature === last) return;
  last = signature;
  if (human) el('groups').style.setProperty('--pc', human.color);
  buttons.forEach((button, k) => {
    button.classList.toggle('empty', counts[k] === 0);
    button.classList.toggle('active', k === active);
    button.querySelector('.cnt').textContent = counts[k] ? String(counts[k]) : '';
  });
}

// مستطيلات عناصر الواجهة الظاهرة على الشاشة: أسهم التحذير تتجنبها (القسم 12.3)
const HUD_IDS = ['groups', 'info', 'btnMode', 'btnPause', 'modeBar', 'btnAll', 'btnClear', 'power'];

export function hudRects() {
  const rects = [];
  for (const id of HUD_IDS) {
    const node = el(id);
    if (!node || node.hidden || !node.offsetParent) continue;
    const r = node.getBoundingClientRect();
    if (r.width) rects.push({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
  }
  return rects;
}
