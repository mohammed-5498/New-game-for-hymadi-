// شبكة مكانية بخلايا 2 × 2 مربع: للبحث عن الوحدات القريبة
// بدل مقارنة كل وحدة بكل وحدة (القسم 14 من الوصف)
import { PERFORMANCE } from '../config.js';

const CELL = PERFORMANCE.hashCellTiles;
const OFFSET = 2048;        // نزيح الإحداثيات لتكون المفاتيح أرقاماً موجبة
const STRIDE = 4096;

const cellIndex = (x, y) =>
  (Math.floor(x / CELL) + OFFSET) * STRIDE + (Math.floor(y / CELL) + OFFSET);

// تُبنى مرة واحدة في كل تحديث قبل استعمالها
export function buildUnitHash(state) {
  let cells = state.unitHash;
  if (!cells) cells = state.unitHash = new Map();
  else cells.clear();

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
