// شبكة مكانية بخلايا 2 × 2 مربع: للبحث عن الوحدات القريبة
// بدل مقارنة كل وحدة بكل وحدة (القسم 14 من الوصف)
import { PERFORMANCE } from '../config.js';

const CELL = PERFORMANCE.hashCellTiles;
const OFFSET = 2048;        // نزيح الإحداثيات لتكون المفاتيح أرقاماً موجبة
const STRIDE = 4096;

const cellIndex = (x, y) =>
  (Math.floor(x / CELL) + OFFSET) * STRIDE + (Math.floor(y / CELL) + OFFSET);

// تُبنى مرة واحدة في كل تحديث قبل استعمالها
// الدلاء تُفرَّغ وتُعاد كل تحديث بدل إنشاء مصفوفات جديدة (أقل عملاً لجامع القمامة)؛
// والخلية الفارغة تبقى دلواً فارغاً، فلا يتغير شيء لمن يقرأ الشبكة
export function buildUnitHash(state) {
  let cells = state.unitHash;
  if (!cells) cells = state.unitHash = new Map();
  else for (const bucket of cells.values()) bucket.length = 0;

  for (const unit of state.units) {
    if (unit.state === 'dead') continue;
    const key = cellIndex(unit.x, unit.y);
    const bucket = cells.get(key);
    if (bucket) bucket.push(unit);
    else cells.set(key, [unit]);
  }
  state.unitHashTime = state.time;
}

// تضمن وجود شبكة محدّثة لهذا التحديث (فحص رخيص إن كانت جاهزة)
export function ensureUnitHash(state) {
  if (state.unitHash && state.unitHashTime === state.time) return;
  buildUnitHash(state);
}

// يستدعي الدالة لكل وحدة داخل الخلايا التي تغطي دائرة نصف قطرها radius
export function forEachNearby(state, x, y, radius, callback) {
  ensureUnitHash(state);   // لا يعمل أي نظام على شبكة قديمة أو غير موجودة
  const cells = state.unitHash;
  if (!cells) return;

  const minI = Math.floor((x - radius) / CELL), maxI = Math.floor((x + radius) / CELL);
  const minJ = Math.floor((y - radius) / CELL), maxJ = Math.floor((y + radius) / CELL);

  for (let ci = minI; ci <= maxI; ci++) {
    const base = (ci + OFFSET) * STRIDE + OFFSET;
    for (let cj = minJ; cj <= maxJ; cj++) {
      const bucket = cells.get(base + cj);
      if (!bucket) continue;
      for (let k = 0; k < bucket.length; k++) callback(bucket[k]);
    }
  }
}

// --- الشبكة نفسها في مصفوفات كثيفة (للمسح الكبير المتكرر، مثل البوتات حول كل حي) ---
// نفس الخلايا ونفس ترتيب الوحدات داخل كل خلية كما في forEachNearby، تُبنى مرة في التحديث عند أول طلب
let dense = { state: null, time: -1 };

export function hashCells(state) {
  ensureUnitHash(state);
  if (dense.state === state && dense.time === state.unitHashTime) return dense;
  let minI = Infinity, maxI = -Infinity, minJ = Infinity, maxJ = -Infinity, total = 0;
  for (const [key, bucket] of state.unitHash) {
    if (!bucket.length) continue;
    const ci = Math.floor(key / STRIDE) - OFFSET, cj = key % STRIDE - OFFSET;
    if (ci < minI) minI = ci; if (ci > maxI) maxI = ci;
    if (cj < minJ) minJ = cj; if (cj > maxJ) maxJ = cj;
    total += bucket.length;
  }
  if (!total) { minI = maxI = minJ = maxJ = 0; }
  const h = maxJ - minJ + 1, cells = (maxI - minI + 1) * h;
  const start = new Int32Array(cells + 1), list = new Array(total);
  for (const [key, bucket] of state.unitHash) if (bucket.length) start[(Math.floor(key / STRIDE) - OFFSET - minI) * h + (key % STRIDE - OFFSET - minJ) + 1] = bucket.length;
  for (let c = 0; c < cells; c++) start[c + 1] += start[c];
  for (const [key, bucket] of state.unitHash) {
    if (!bucket.length) continue;
    let at = start[(Math.floor(key / STRIDE) - OFFSET - minI) * h + (key % STRIDE - OFFSET - minJ)];
    for (let k = 0; k < bucket.length; k++) list[at++] = bucket[k];
  }
  dense = { state, time: state.unitHashTime, minI, maxI, minJ, maxJ, h, start, list };
  return dense;
}

// مدى الخلايا التي تغطي دائرة (نفس حساب forEachNearby)
export function cellBox(x, y, radius) {
  return [Math.floor((x - radius) / CELL), Math.floor((x + radius) / CELL),
          Math.floor((y - radius) / CELL), Math.floor((y + radius) / CELL)];
}

