// تخزين الطبقة الثابتة للمدينة (المرحلة 7ب، الأداء): الأرض والمباني والزينة تُرسم مرة واحدة
// على لوحات مخفية مقسمة إلى قطع، ويُعرض منها الظاهر فقط.
// - كل قطعة مربع من العالم (128 وحدة) بدقة تناسب التقريب الحالي (درجات ثابتة لا كل تقريب)
// - تُعاد قطعة فقط حين يتغير مالك حي فيها (وعلى 3 مراحل أثناء انتقال اللون)
// - رسم القطع الجديدة محدود بوقت في كل إطار؛ وحتى تجهز يظهر مكانها نسخة أقدم أو خريطة أرض منخفضة الدقة
// - المصابيح الوامضة وإضاءة الليل طبقة خفيفة تُرسم كل إطار
import { TILE_HALF_W, TILE_HALF_H, CITY_CACHE as CC } from '../config.js';
import { beginCity, groundColor, drawRoadSurface, drawTileStatic, debrisLight, specialType } from './cityRender.js';
import { lampSpot } from './landmarks.js';

const PAD = 1;   // كل قطعة تتجاوز حدودها بوحدة: لا خطوط شعرية بين القطع

let cache = null;

const tileX = (i, j) => (i - j) * TILE_HALF_W;
const tileY = (i, j) => (i + j) * TILE_HALF_H;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// --- الإعداد: شبكة القطع، ومربعات كل قطعة بترتيب الرسام، والأحياء وقطعها ---
function setup(state) {
  const map = state.map, n = map.n, R = CC.reach, size = CC.chunkWorld;
  const x0 = tileX(0, n - 1) - R.side, x1 = tileX(n - 1, 0) + R.side;
  const y0 = tileY(0, 0) - R.up, y1 = tileY(n - 1, n - 1) + R.down;
  const cols = Math.ceil((x1 - x0) / size), rows = Math.ceil((y1 - y0) / size);
  const chunks = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      chunks.push({ id: chunks.length, x: x0 + c * size, y: y0 + r * size, tiles: [],
                    canvas: null, scale: 0, dirty: false, used: 0 });
    }
  }
  // كل مربع ينتمي لكل قطعة قد يرسم فيها شيئاً (المباني ترتفع حتى 110 وحدة فوق المربع)
  for (let s = 0; s <= 2 * n - 2; s++) {
    for (let i = Math.max(0, s - n + 1); i <= Math.min(n - 1, s); i++) {
      const j = s - i, x = tileX(i, j), y = tileY(i, j);
      const c0 = Math.max(0, Math.floor((x - R.side - x0) / size)), c1 = Math.min(cols - 1, Math.floor((x + R.side - x0) / size));
      const r0 = Math.max(0, Math.floor((y - R.up - y0) / size)), r1 = Math.min(rows - 1, Math.floor((y + R.down - y0) / size));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) chunks[r * cols + c].tiles.push(i, j);
    }
  }
  // قطع كل حي: تُعاد حين يتغير مالكه
  const districtChunks = map.districts.map(() => new Set());
  chunks.forEach(chunk => {
    for (let t = 0; t < chunk.tiles.length; t += 2) {
      const d = map.districtAt[map.idx(chunk.tiles[t], chunk.tiles[t + 1])];
      if (d >= 0) districtChunks[d].add(chunk.id);
    }
  });

  cache = {
    map, weather: state.weather, mode: state.mode, x0, y0, cols, rows, chunks, districtChunks,
    keys: map.districts.map(d => tintKey(d)),
    lights: [], lamps: [], frame: 0, pixels: 0, base: null
  };
  collectStatics(state);
  buildBase(state);
}

// مفتاح لون الحي: المالك ومرحلة انتقال اللون (3 مراحل لا 10، حتى لا تُعاد القطع كثيراً)
function tintKey(d) {
  if (!d.tintColor) return '';
  return d.tintColor + '|' + Math.round(d.tintMix * CC.tintSteps);
}

// إضاءة الليل الثابتة والمصابيح الوامضة: تُحسب مرة واحدة بلا رسم
function collectStatics(state) {
  const map = state.map, n = map.n;
  beginCity(makeCanvas(1, 1).getContext('2d'), map);   // بذرة هذه الخريطة قبل أي حساب عشوائي حتمي
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = tileX(i, j), y = tileY(i, j), k = map.idx(i, j);
    const special = specialType(state, k);
    if (special === 'N') cache.lamps.push(lampSpot(map, i, j, x, y));
    else if (special === 'P') cache.lights.push({ x, y: y - 4, r: 18, c: '255,235,190', a: 0.25 });
    else if (!special && debrisLight(map, i, j)) cache.lights.push({ x, y: y - 7, r: 34, c: '255,150,60', a: 0.65 });
  }
}

// خريطة الأرض كاملة بدقة منخفضة: تظهر لحظياً مكان القطعة التي لم تُرسم بعد
function buildBase(state) {
  const s = CC.baseScale;
  const w = cache.cols * CC.chunkWorld, h = cache.rows * CC.chunkWorld;
  const canvas = makeCanvas(w * s, h * s);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(s, 0, 0, s, -cache.x0 * s, -cache.y0 * s);
  const map = state.map, all = [];
  for (let j = 0; j < map.n; j++) for (let i = 0; i < map.n; i++) all.push(i, j);
  drawGround(ctx, state, all);
  cache.base = { canvas, scale: s };
}

// --- رسم قطعة: الأرض ثم سطح الشوارع ثم محتوى المربعات بترتيب الرسام ---
function renderChunk(state, chunk, scale) {
  const size = Math.ceil((CC.chunkWorld + 2 * PAD) * scale);
  if (!chunk.canvas || chunk.canvas.width !== size) {
    if (chunk.canvas) cache.pixels -= chunk.canvas.width * chunk.canvas.height;
    chunk.canvas = makeCanvas(size, size);
    cache.pixels += size * size;
  }
  const ctx = chunk.canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.setTransform(scale, 0, 0, scale, -(chunk.x - PAD) * scale, -(chunk.y - PAD) * scale);
  drawGround(ctx, state, chunk.tiles);
  beginCity(ctx, state.map);
  const t = chunk.tiles;
  for (let k = 0; k < t.length; k += 2) drawTileStatic(state, t[k], t[k + 1], tileX(t[k], t[k + 1]), tileY(t[k], t[k + 1]), null, null);
  chunk.scale = scale;
  chunk.dirty = false;
}

// الأرض: نجمع المربعات حسب اللون ونرسم مساراً واحداً لكل لون، ثم سطح الشوارع وخطوطها
function drawGround(ctx, state, tiles) {
  const map = state.map;
  beginCity(ctx, map);            // ألوان الأرض تعتمد على بذرة الخريطة
  const EX = TILE_HALF_W + 0.4, EY = TILE_HALF_H + 0.25;   // توسيع بسيط يغلق الفراغات الشعرية
  const batches = new Map();
  for (let t = 0; t < tiles.length; t += 2) {
    const i = tiles[t], j = tiles[t + 1];
    const color = groundColor(state, i, j);
    let batch = batches.get(color);
    if (!batch) batches.set(color, batch = []);
    batch.push(tileX(i, j), tileY(i, j));
  }
  for (const [color, list] of batches) {
    ctx.beginPath();
    for (let t = 0; t < list.length; t += 2) {
      const x = list[t], y = list[t + 1];
      ctx.moveTo(x - EX, y); ctx.lineTo(x, y - EY); ctx.lineTo(x + EX, y); ctx.lineTo(x, y + EY); ctx.closePath();
    }
    ctx.fillStyle = color;
    ctx.fill();
  }
  beginCity(ctx, map);
  ctx.beginPath();
  let dashes = false;
  for (let t = 0; t < tiles.length; t += 2) {
    const i = tiles[t], j = tiles[t + 1], k = map.idx(i, j);
    if (!map.road[k]) continue;
    const x = tileX(i, j), y = tileY(i, j);
    drawRoadSurface(ctx, map, i, j, x, y);
  }
  for (let t = 0; t < tiles.length; t += 2) {
    const i = tiles[t], j = tiles[t + 1], k = map.idx(i, j);
    if (!map.dash[k]) continue;
    const x = tileX(i, j), y = tileY(i, j);
    if (!dashes) { ctx.beginPath(); dashes = true; }
    if (map.dash[k] === 1) { ctx.moveTo(x - 4, y - 2); ctx.lineTo(x + 4, y + 2); }
    else { ctx.moveTo(x + 4, y - 2); ctx.lineTo(x - 4, y + 2); }
  }
  if (dashes) {
    ctx.strokeStyle = '#c9bd85';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// الدقة المناسبة للتقريب: أصغر درجة تكفي (مع هامش)، وإلا الأعلى
function pickScale(need) {
  for (const s of CC.scales) if (s >= need * CC.scaleSlack) return s;
  return CC.scales[CC.scales.length - 1];
}

// --- كل إطار: الطبقة الثابتة للقطع الظاهرة ---
// ctx في إحداثيات العالم (worldTransform)، والإطار الظاهر بوحدات العالم
export function drawCityLayer(ctx, state, view) {
  if (!cache || cache.map !== state.map || cache.weather !== state.weather || cache.mode !== state.mode) setup(state);
  cache.frame++;
  markDirty(state);

  const scale = pickScale(state.view.dpr * state.camera.z);
  const size = CC.chunkWorld;
  const c0 = Math.max(0, Math.floor((view.x0 - cache.x0) / size)), c1 = Math.min(cache.cols - 1, Math.floor((view.x1 - cache.x0) / size));
  const r0 = Math.max(0, Math.floor((view.y0 - cache.y0) / size)), r1 = Math.min(cache.rows - 1, Math.floor((view.y1 - cache.y0) / size));

  // القطع الظاهرة الناقصة أو القديمة تُرسم الآن بحدود وقت، والأقرب للمركز أولاً.
  // ثم حلقة حول الشاشة تُرسم مسبقاً بما بقي من الوقت، فتكون جاهزة قبل أن تظهر أثناء التحريك
  const cx = (view.x0 + view.x1) / 2, cy = (view.y0 + view.y1) / 2;
  const near = (a, b) => Math.hypot(a.x + size / 2 - cx, a.y + size / 2 - cy) - Math.hypot(b.x + size / 2 - cx, b.y + size / 2 - cy);
  const pending = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const chunk = cache.chunks[r * cache.cols + c];
    chunk.used = cache.frame;
    if (!chunk.canvas || chunk.scale !== scale || chunk.dirty) pending.push(chunk);
  }
  pending.sort(near);
  const start = performance.now();
  const spent = () => performance.now() - start;
  for (const chunk of pending) {
    // القطعة التي لا شيء لها تُرسم ولو تجاوزنا الوقت قليلاً؛ أما تحديث الدقة أو اللون فينتظر وقتاً فارغاً
    if (spent() > CC.frameBudgetMs && (chunk.canvas || spent() > CC.frameBudgetMs * 2)) break;
    renderChunk(state, chunk, scale);
  }
  // الحلقة محفوظة من الحذف ما دامت قرب الشاشة، وتُرسم فقط إن بقي متسع في حد الذاكرة
  const ring = [];
  const m = CC.prefetchRing;
  for (let r = Math.max(0, r0 - m); r <= Math.min(cache.rows - 1, r1 + m); r++) {
    for (let c = Math.max(0, c0 - m); c <= Math.min(cache.cols - 1, c1 + m); c++) {
      if (r >= r0 && r <= r1 && c >= c0 && c <= c1) continue;
      const chunk = cache.chunks[r * cache.cols + c];
      chunk.used = cache.frame;
      if (!chunk.canvas || chunk.scale !== scale || chunk.dirty) ring.push(chunk);
    }
  }
  ring.sort(near);
  for (const chunk of ring) {
    if (spent() > CC.frameBudgetMs) break;
    const px = Math.ceil((size + 2 * PAD) * scale) ** 2;
    if (!chunk.canvas && cache.pixels + px > CC.maxPixels) break;
    renderChunk(state, chunk, scale);
  }

  // العرض: القطعة الجاهزة، وإلا خريطة الأرض المنخفضة مكانها
  ctx.imageSmoothingEnabled = true;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const chunk = cache.chunks[r * cache.cols + c];
    if (chunk.canvas) {
      const w = chunk.canvas.width / chunk.scale;
      ctx.drawImage(chunk.canvas, chunk.x - PAD, chunk.y - PAD, w, w);
    } else {
      const b = cache.base, bs = b.scale;
      ctx.drawImage(b.canvas, (chunk.x - cache.x0) * bs, (chunk.y - cache.y0) * bs, size * bs, size * bs, chunk.x, chunk.y, size, size);
    }
  }
  evict();
}

// تغيّر لون حي (مالك جديد أو مرحلة انتقال): قطعه تُعاد، والخريطة المنخفضة تتبعه
function markDirty(state) {
  const districts = state.map.districts;
  let changed = false;
  for (let d = 0; d < districts.length; d++) {
    const key = tintKey(districts[d]);
    if (key === cache.keys[d]) continue;
    cache.keys[d] = key;
    changed = true;
    for (const id of cache.districtChunks[d]) cache.chunks[id].dirty = true;
  }
  if (changed) buildBaseLater(state);
}

let baseTimer = 0;
function buildBaseLater(state) {
  clearTimeout(baseTimer);
  baseTimer = setTimeout(() => { if (cache && cache.map === state.map) buildBase(state); }, 600);
}

// حد الذاكرة: الأقدم استعمالاً من القطع غير الظاهرة يُحذف أولاً
function evict() {
  if (cache.pixels <= CC.maxPixels) return;
  const old = cache.chunks.filter(c => c.canvas && c.used < cache.frame).sort((a, b) => a.used - b.used);
  for (const chunk of old) {
    if (cache.pixels <= CC.maxPixels) break;
    cache.pixels -= chunk.canvas.width * chunk.canvas.height;
    chunk.canvas = null;
    chunk.scale = 0;
  }
}

// --- الطبقة الخفيفة كل إطار: المصابيح الوامضة وإضاءة الليل الثابتة ---
export function cityStatics() {
  return cache ? { lamps: cache.lamps, lights: cache.lights } : { lamps: [], lights: [] };
}

// للقياس والاختبارات
export function cacheStats() {
  if (!cache) return null;
  const ready = cache.chunks.filter(c => c.canvas).length;
  return { chunks: cache.chunks.length, ready, pixels: cache.pixels };
}

// قياس تكلفة رسم القطع (لأدوات القياس فقط): يرسم عدداً من القطع ويعيد متوسط الزمن بالملي ثانية
export function measureChunkCost(state, scale, count = 20) {
  if (!cache || cache.map !== state.map) setup(state);
  const full = cache.chunks.filter(c => c.tiles.length > 40).slice(0, count);
  const t0 = performance.now();
  for (const chunk of full) renderChunk(state, chunk, scale);
  return (performance.now() - t0) / Math.max(1, full.length);
}
