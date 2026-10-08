// تخزين الطبقة الثابتة للمدينة (المرحلة 7ب، الأداء): الأرض والمباني والزينة تُرسم مرة واحدة
// على لوحات مخفية مقسمة إلى قطع، ويُعرض منها الظاهر فقط.
// - كل قطعة مربع من العالم (128 وحدة) بدقة تناسب التقريب الحالي (درجات ثابتة لا كل تقريب)
// - تُعاد قطعة فقط حين يتغير مالك حي فيها (وعلى 3 مراحل أثناء انتقال اللون)
// - رسم القطع على دفعات محدودة بوقت في كل إطار؛ وحتى تجهز يظهر مكانها نسختها الأقدم أو خريطة أرض منخفضة الدقة
// - المصابيح الوامضة وإضاءة الليل طبقة خفيفة تُرسم كل إطار
import { TILE_HALF_W, TILE_HALF_H, CITY_CACHE as CC } from '../config.js';
import { beginCity, groundColor, drawRoadSurface, drawTileStatic, debrisLight, specialType } from './cityRender.js';
import { isLane, drawLanePaving, roundaboutAnchor, drawRoundaboutRing, laneLight, roundaboutLights } from './openCity.js';
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
                    canvas: null, job: null, scale: 0, dirty: false, used: 0, ver: 0 });
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
    gen: (cache ? cache.gen : 0) + 1,
    map, weather: state.weather, mode: state.mode, x0, y0, cols, rows, chunks, districtChunks,
    keys: map.districts.map(d => tintKey(d)),
    lights: [], lamps: [], frame: 0, pixels: 0, base: null,
    tileMs: cache ? cache.tileMs : 0.3          // الزمن الحقيقي لرسم مربع واحد (يُقاس ويُحدَّث)
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
    else if (!special && isLane(map, k)) { const l = laneLight(map, i, j, x, y); if (l) cache.lights.push(l); }
    else if (map.type[k] === 'Y' && roundaboutAnchor(map, i, j)) cache.lights.push(...roundaboutLights(x, y));
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
// يُرسم على لوحة جديدة على دفعات بحدود وقت كل إطار، والقديمة تبقى معروضة حتى تكتمل الجديدة:
// فلا إطار واحد يحمل رسم قطعة كاملة (تغيّر لون حي، أو رفع الدقة بعد بداية المباراة)
function startJob(state, chunk, scale) {
  const size = Math.ceil((CC.chunkWorld + 2 * PAD) * scale);
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, -(chunk.x - PAD) * scale, -(chunk.y - PAD) * scale);
  drawGround(ctx, state, chunk.tiles);
  chunk.job = { canvas, ctx, scale, t: 0 };
}

// المتصفح يسجّل أوامر الرسم ثم ينفذها لاحقاً عند استعمال الصورة، فقياس الوقت وحده يخدع:
// ننفذها فوراً بنسخ بكسل واحد منها، فيُحسب وقتها الحقيقي داخل دفعة القطعة لا في إطار آخر
// لوحة الاستقبال كبيرة عمداً (256×256 ولا يُرسم فيها إلا بكسل): Chrome يرسم اللوحات الصغيرة جداً
// بالمعالج لا بكرت الشاشة، ونسخ لوحة من كرت الشاشة إلى لوحة معالج يوقف الجوال حتى ينتهي كرت الشاشة
let sink = null;
function flush(canvas) {
  if (!sink) sink = makeCanvas(256, 256);
  sink.getContext('2d').drawImage(canvas, 0, 0, 1, 1, 0, 0, 1, 1);
}

// متابعة رسم القطعة حتى deadline؛ true إن اكتملت ووُضعت مكان القديمة.
// عدد المربعات في الدفعة من زمنها الحقيقي المقيس (cache.tileMs)، لا من زمن تسجيل الأوامر
function stepJob(state, chunk, deadline) {
  const job = chunk.job, t = chunk.tiles;
  const start = performance.now();
  const room = deadline - start;
  const max = room === Infinity ? t.length : Math.max(2, 2 * Math.floor(room / cache.tileMs));
  const end = Math.min(t.length, job.t + max);
  const from = job.t;
  beginCity(job.ctx, state.map);
  while (job.t < end) {
    const i = t[job.t], j = t[job.t + 1];
    drawTileStatic(state, i, j, tileX(i, j), tileY(i, j), null, null);
    job.t += 2;
  }
  if (room !== Infinity) {
    flush(job.canvas);
    const tiles = (job.t - from) / 2;
    if (tiles > 0) cache.tileMs = 0.7 * cache.tileMs + 0.3 * Math.max(0.02, (performance.now() - start) / tiles);
  }
  if (job.t < t.length) return false;
  if (chunk.canvas) cache.pixels -= chunk.canvas.width * chunk.canvas.height;
  chunk.canvas = job.canvas;
  cache.pixels += job.canvas.width * job.canvas.height;
  chunk.scale = job.scale;
  chunk.dirty = false;
  chunk.job = null;
  chunk.ver++;
  return true;
}

function renderChunk(state, chunk, scale) {
  startJob(state, chunk, scale);
  stepJob(state, chunk, Infinity);
}

// قطعة تحتاج رسماً بهذه الدقة: تبدأ عملها (أو تعيده إن كان بدقة أخرى) ثم تتقدم حتى deadline
function work(state, chunk, scale, deadline) {
  if (chunk.job && chunk.job.scale !== scale) chunk.job = null;
  if (!chunk.job) {
    startJob(state, chunk, scale);
    if (deadline !== Infinity) flush(chunk.job.canvas);    // الأرض نفسها تأخذ وقتاً: تُحسب الآن
    if (performance.now() > deadline) return false;
  }
  return stepJob(state, chunk, deadline);
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
    const x = tileX(i, j), y = tileY(i, j);
    if (map.road[k]) drawRoadSurface(ctx, map, i, j, x, y);
    else if (isLane(map, k)) drawLanePaving(ctx, map, i, j, x, y);            // المدن المفتوحة
    else if (map.type[k] === 'Y' && roundaboutAnchor(map, i, j)) drawRoundaboutRing(ctx, x, y);
  }
  for (let t = 0; t < tiles.length; t += 2) {
    const i = tiles[t], j = tiles[t + 1], k = map.idx(i, j);
    if (!map.dash[k]) continue;
    const x = tileX(i, j), y = tileY(i, j);
    if (!dashes) { ctx.beginPath(); dashes = true; }
    if (map.dash[k] === 1) { ctx.moveTo(x - 4, y - 2); ctx.lineTo(x + 4, y + 2); }
    else if (map.dash[k] === 2) { ctx.moveTo(x + 4, y - 2); ctx.lineTo(x - 4, y + 2); }
    // الشارع العريض: الخط على الحد بين الحارتين (نصف مربع نحو الحارة الثانية)؛ 5-7 لا خط (حلقة وممرات مشاة)
    else if (map.dash[k] === 3) { ctx.moveTo(x - 13, y + 2.5); ctx.lineTo(x - 5, y + 6.5); }
    else if (map.dash[k] === 4) { ctx.moveTo(x + 5, y + 6.5); ctx.lineTo(x + 13, y + 2.5); }
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
// budgetMs: وقت رسم القطع في هذا الإطار. maxScale: سقف الدقة (بداية المباراة: دقة أقل تُرسم بسرعة ثم تُرفع تدريجياً)
// يعيد عدد القطع الظاهرة التي لم تكتمل بعد
export function drawCityLayer(ctx, state, view, budgetMs = CC.frameBudgetMs, maxScale = Infinity) {
  if (!cache || cache.map !== state.map || cache.weather !== state.weather || cache.mode !== state.mode) setup(state);
  cache.frame++;
  markDirty(state);

  const scale = Math.min(maxScale, pickScale(state.view.dpr * state.camera.z));
  const size = CC.chunkWorld;
  const c0 = Math.max(0, Math.floor((view.x0 - cache.x0) / size)), c1 = Math.min(cache.cols - 1, Math.floor((view.x1 - cache.x0) / size));
  const r0 = Math.max(0, Math.floor((view.y0 - cache.y0) / size)), r1 = Math.min(cache.rows - 1, Math.floor((view.y1 - cache.y0) / size));

  // القطع الظاهرة الناقصة أو القديمة تتقدم بحدود وقت، والأقرب للمركز أولاً.
  // ثم حلقة حول الشاشة تُرسم مسبقاً بما بقي من الوقت، فتكون جاهزة قبل أن تظهر أثناء التحريك
  const cx = (view.x0 + view.x1) / 2, cy = (view.y0 + view.y1) / 2;
  const near = (a, b) => Math.hypot(a.x + size / 2 - cx, a.y + size / 2 - cy) - Math.hypot(b.x + size / 2 - cx, b.y + size / 2 - cy);
  const needs = (chunk) => !chunk.canvas || chunk.dirty || (chunk.scale !== scale && !(maxScale < Infinity && chunk.scale > scale));
  const pending = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const chunk = cache.chunks[r * cache.cols + c];
    chunk.used = cache.frame;
    if (needs(chunk)) pending.push(chunk);
  }
  pending.sort(near);
  const start = performance.now();
  let left = 0;               // قطع ظاهرة لم تكتمل بعد هذا الإطار
  for (const chunk of pending) {
    // القطعة الفارغة (تظهر مكانها الأرض فقط) تأخذ ضعف الوقت؛ أما تحديث الدقة أو اللون فوقته العادي
    const deadline = start + (chunk.canvas ? budgetMs : budgetMs * 2);
    if (performance.now() > deadline || !work(state, chunk, scale, deadline)) left++;
  }
  // الحلقة محفوظة من الحذف ما دامت قرب الشاشة، وتُرسم فقط إن بقي متسع في حد الذاكرة
  const ring = [];
  const m = CC.prefetchRing;
  for (let r = Math.max(0, r0 - m); r <= Math.min(cache.rows - 1, r1 + m); r++) {
    for (let c = Math.max(0, c0 - m); c <= Math.min(cache.cols - 1, c1 + m); c++) {
      if (r >= r0 && r <= r1 && c >= c0 && c <= c1) continue;
      const chunk = cache.chunks[r * cache.cols + c];
      chunk.used = cache.frame;
      if (needs(chunk)) ring.push(chunk);
    }
  }
  ring.sort(near);
  const ringDeadline = start + Math.min(budgetMs, CC.frameBudgetMs);
  for (const chunk of ring) {
    if (performance.now() > ringDeadline) break;
    const px = Math.ceil((size + 2 * PAD) * scale) ** 2;
    if (!chunk.canvas && !chunk.job && cache.pixels + px > CC.maxPixels) break;
    work(state, chunk, scale, ringDeadline);
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
  return left;
}

// تغيّر لون حي (مالك جديد أو مرحلة انتقال): قطعه تُعاد، والخريطة المنخفضة تتبعه
function markDirty(state) {
  const districts = state.map.districts;
  for (let d = 0; d < districts.length; d++) {
    const key = tintKey(districts[d]);
    if (key === cache.keys[d]) continue;
    cache.keys[d] = key;
    // رسم جارٍ بالألوان القديمة يُلغى ويبدأ من جديد
    for (const id of cache.districtChunks[d]) { cache.chunks[id].dirty = true; cache.chunks[id].job = null; }
  }
  // خريطة الأرض المنخفضة لا تُعاد هنا: تظهر لحظة فقط مكان قطعة لم تُرسم، فلونها القديم لا يُلاحظ
}

// حد الذاكرة: الأقدم استعمالاً من القطع غير الظاهرة يُحذف أولاً
function evict() {
  if (cache.pixels <= CC.maxPixels) return;
  const old = cache.chunks.filter(c => c.canvas && c.used < cache.frame).sort((a, b) => a.used - b.used);
  for (const chunk of old) {
    if (cache.pixels <= CC.maxPixels) break;
    cache.pixels -= chunk.canvas.width * chunk.canvas.height;
    chunk.canvas = null;
    chunk.job = null;
    chunk.scale = 0;
  }
}

// --- الطبقة الخفيفة كل إطار: المصابيح الوامضة وإضاءة الليل الثابتة ---
export function cityStatics() {
  return cache ? { lamps: cache.lamps, lights: cache.lights } : { lamps: [], lights: [] };
}

// صورة المدينة الجاهزة لمستطيل من العالم (لقصاصات المباني فوق الوحدات خلفها):
// ترسم القطع التي تغطيه في ctx (بإحداثيات العالم) وتعيد { scale, sig }، أو null إن لم تجهز كلها بنفس الدقة.
// sig يتغير متى أُعيد رسم إحداها (لون مالك جديد، دقة أخرى، طقس آخر)
export function cityRegion(x0, y0, x1, y1) {
  if (!cache) return null;
  const size = CC.chunkWorld;
  const c0 = Math.max(0, Math.floor((x0 - cache.x0) / size)), c1 = Math.min(cache.cols - 1, Math.floor((x1 - cache.x0) / size));
  const r0 = Math.max(0, Math.floor((y0 - cache.y0) / size)), r1 = Math.min(cache.rows - 1, Math.floor((y1 - cache.y0) / size));
  const list = [];
  let scale = 0, sig = cache.gen + ':';
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const chunk = cache.chunks[r * cache.cols + c];
    if (!chunk.canvas) return null;
    scale = Math.max(scale, chunk.scale);
    sig += chunk.id + '.' + chunk.ver + ',';
    list.push(chunk);
  }
  if (!list.length) return null;
  // أصل شبكة بكسلات القطعة الأولى (مع هامشها): لمحاذاة القصاصة معها
  return { scale, sig, list, gx: list[0].x - PAD, gy: list[0].y - PAD };
}

export function drawRegionChunks(ctx, region) {
  for (const chunk of region.list) {
    const w = chunk.canvas.width / chunk.scale;
    ctx.drawImage(chunk.canvas, chunk.x - PAD, chunk.y - PAD, w, w);
  }
}

// نفس توقيع القطع الآن؟ (القصاصة المخزنة ما زالت صحيحة)
export function regionSig(region) {
  if (!cache) return '';
  let sig = cache.gen + ':';
  for (const chunk of region.list) sig += chunk.id + '.' + chunk.ver + ',';
  return sig;
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

// رسم الخريطة كاملة مرة واحدة على لوحة (الصورة المصغرة للمدينة في قائمة الإعداد)
export function drawWholeMap(ctx, state) {
  const map = state.map, all = [];
  for (let j = 0; j < map.n; j++) for (let i = 0; i < map.n; i++) all.push(i, j);
  drawGround(ctx, state, all);
  beginCity(ctx, map);
  for (let s = 0; s <= 2 * map.n - 2; s++) {
    for (let i = Math.max(0, s - map.n + 1); i <= Math.min(map.n - 1, s); i++) {
      const j = s - i;
      drawTileStatic(state, i, j, tileX(i, j), tileY(i, j), null, null);
    }
  }
}
