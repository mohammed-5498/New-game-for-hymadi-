// تخزين الطبقة الثابتة للمدينة (المرحلة 7ب، الأداء): الأرض والمباني والزينة تُرسم مرة واحدة
// على لوحات مخفية مقسمة إلى قطع، ويُعرض منها الظاهر فقط.
// - كل قطعة مربع من العالم (128 وحدة) بدقة تناسب التقريب الحالي (درجات ثابتة لا كل تقريب)
// - تُعاد قطعة فقط حين يتغير مالك حي فيها (وعلى 3 مراحل أثناء انتقال اللون)
// - رسم القطع على دفعات محدودة بوقت في كل إطار؛ وحتى تجهز يظهر مكانها نسختها الأقدم أو خريطة أرض منخفضة الدقة
// - المصابيح الوامضة وإضاءة الليل طبقة خفيفة تُرسم كل إطار
import { TILE_HALF_W, TILE_HALF_H, CITY_CACHE as CC, CAPTURE, EMPIRE, DISTRICT_SIZES, CITY_FEATURES } from '../config.js';
import { sizeOf } from '../map/sizes.js';
import { evolveOf, evolveKey } from './empireBuildings.js';
import { tintAmount } from '../game/capture.js';
import { beginCity, groundColor, drawRoadSurface, drawTileStatic, debrisLight, specialType, cityOf, cityReady } from './cityRender.js';
import { isLane, drawLanePaving, roundaboutAnchor, drawRoundaboutRing, laneLight, roundaboutLights } from './openCity.js';
import { lampSpot } from './landmarks.js';
import { mixc } from './cityThemes.js';
import { gfx } from '../graphics.js';
import { drawFeaturePaving, featureLight, featureLamp } from './featureArt.js';

const TAU = Math.PI * 2;
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
    map, weather: state.weather, mode: state.mode, detail: gfx().detail, x0, y0, cols, rows, chunks, districtChunks,
    keys: map.districts.map(d => tintKey(d, state)),
    lights: [], lamps: [], frame: 0, pixels: 0, base: null,
    tileMs: cache ? cache.tileMs : 0.3          // الزمن الحقيقي لرسم مربع واحد (يُقاس ويُحدَّث)
  };
  collectStatics(state);
  buildBase(state);
}

// مفتاح لون الحي: المالك ومرحلة انتقال اللون (3 مراحل لا 10، حتى لا تُعاد القطع كثيراً)،
// ومبناه في طور الإمبراطورية: بناؤه يعيد رسم قطع الحي
function tintKey(d, state) {
  // والتحصين (القسم 3.12)، وتطور المبنى مع ترقياته (evolveOf: البرج والمستشفى والقاعدة بمستواها)
  const building = (d.building ? '|' + d.building + evolveKey(evolveOf(state, d)) : '') + (d.fort ? '|f' + d.fort : '');
  if (!d.tintColor) return building;
  return d.tintColor + '|' + Math.round(d.tintMix * CC.tintSteps) + building;
}

// إضاءة الليل الثابتة والمصابيح الوامضة: تُحسب مرة واحدة بلا رسم
function collectStatics(state) {
  const map = state.map, n = map.n, T = cityOf(map);
  beginCity(makeCanvas(1, 1).getContext('2d'), map);   // بذرة هذه الخريطة قبل أي حساب عشوائي حتمي
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = tileX(i, j), y = tileY(i, j), k = map.idx(i, j);
    const special = specialType(state, k);
    if (special === 'N') cache.lamps.push(lampSpot(map, i, j, x, y));
    else if (special === 'P') cache.lights.push({ x, y: y - 4, r: 18, c: '255,235,190', a: 0.25 });
    else if (special === 'F') {
      const d = map.districtOf(i, j);
      if (d && d.feature) {
        cache.lights.push(featureLight(map, d, x, y));
        const lamp = featureLamp(d, x, y);
        if (lamp) cache.lamps.push(lamp);
      }
    }
    else if (!special && debrisLight(map, i, j)) cache.lights.push({ x, y: y - 7, r: 34, c: '255,150,60', a: 0.65 });
    else if (!special && isLane(map, k)) { const l = laneLight(map, i, j, x, y); if (l) cache.lights.push(l); }
    else if (map.type[k] === 'Y' && roundaboutAnchor(map, i, j)) cache.lights.push(...roundaboutLights(x, y, map.city));
    else if (map.kind[k] === 'monument') cache.lights.push(T.monumentLight ? T.monumentLight(x, y) : { x, y: y - 16, r: 30, c: '255,215,140', a: 0.4 });
    else if (T.lightsAt) { const l = T.lightsAt(map, i, j, x, y); if (l) cache.lights.push(...l); }   // مشاعل بوابات اليمامة
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
    drawBorderFront(job.ctx, state.map, i, j);
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
    else if (map.kind[k] === 'fplaza') drawFeaturePaving(ctx, x, y);          // ساحة المبنى المميز (القسم 3.11)
    else if (map.type[k] === 'Y' && roundaboutAnchor(map, i, j)) drawRoundaboutRing(ctx, x, y);
  }
  drawBorders(ctx, map, tiles, state.economy ? EMPIRE.halo : null);
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

// حدّ الحي بلون مالكه (القسم 8)، ونوعه بفئة حجمه (القسم 3.12، DISTRICT_SIZES.border): خط للصغير، وسياج بأعمدة
// صغيرة للمتوسط، وسور منخفض بأعمدة كبيرة على أركانه للكبير. والحي المحايد بلون الحجر خافتاً فيُعرف حجمه قبل احتلاله.
// الخط على كل ضلع من مربعات الحي يطل على غير الحي (شارع أو حافة)، مزاح نحو داخل المربع حتى لا يتداخل مع رصيف
// الشارع، وتحته خط داكن أعرض يفصله عن الأرض. لكل ضلع: الجار خلفه، وطرفاه نسبة لمركز المربع مزاحين نحو المركز
// بمقدار inset (عمودياً على الضلع)، وبته في قناع الأضلاع المطلة (غرب 1، شرق 2، شمال 4، جنوب 8)
const EDGES = [
  [-1, 0, [-TILE_HALF_W, 0], [0, -TILE_HALF_H]],
  [1, 0, [TILE_HALF_W, 0], [0, TILE_HALF_H]],
  [0, -1, [0, -TILE_HALF_H], [TILE_HALF_W, 0]],
  [0, 1, [0, TILE_HALF_H], [-TILE_HALF_W, 0]]
].map(([di, dj, a, b]) => {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, len = Math.hypot(mx, my);
  const sx = -mx / len * CAPTURE.border.inset, sy = -my / len * CAPTURE.border.inset;   // نحو المركز
  return [di, dj, a[0] + sx, a[1] + sy, b[0] + sx, b[1] + sy];
});
const BACK_EDGES = 1 | 4;            // الغربي والشمالي خلف مبنى المربع، والشرقي والجنوبي أمامه
// أركان المربع (أعلى، يمين، أسفل، يسار): ركن الحي حيث يطل الضلعان اللذان يلتقيان عنده، والأعلى وحده خلف المبنى
const [EW, EE, EN, ES] = EDGES;
const CORNERS = [
  { need: 1 | 4, x: (EW[4] + EN[2]) / 2, y: (EW[5] + EN[3]) / 2, back: true },
  { need: 4 | 2, x: (EN[4] + EE[2]) / 2, y: (EN[5] + EE[3]) / 2, back: false },
  { need: 2 | 8, x: (EE[4] + ES[2]) / 2, y: (EE[5] + ES[3]) / 2, back: false },
  { need: 8 | 1, x: (ES[4] + EW[2]) / 2, y: (ES[5] + EW[3]) / 2, back: false }
];

// حد المربع: قناع أضلاعه المطلة على غير حيه، ومظهر حده (لونه وشفافيته وفئة حجم حيه)، أو null
function borderOf(map, i, j) {
  const k = map.idx(i, j), d = map.districtAt[k];
  if (d < 0 || map.road[k]) return null;
  const district = map.districts[d];
  if (!district.capture) return null;                  // ليس حياً يُستولى عليه
  let mask = 0;
  for (let e = 0; e < 4; e++) {
    const a = i + EDGES[e][0], b = j + EDGES[e][1];
    if (!map.inBounds(a, b) || map.districtAt[map.idx(a, b)] !== d) mask |= 1 << e;
  }
  if (!mask) return null;
  const B = DISTRICT_SIZES.border, amount = tintAmount(district, 1);
  // الحي المحصن (القسم 3.12): سور على أضلاع مبانيه المطلة، والساحة والأرض والممرات مداخل بحدها العادي
  // والمربع الذي يُمشى عليه (ساحة، أرض، ممر) مدخل: بوابة بقوس مفتوح مكان السور، فيحيط السور بالحي كله
  const fort = district.fort || 0, open = map.isWalkable(i, j);
  const walls = fort && !open ? mask : 0, gates = fort && open ? mask : 0;
  // الحد يتأقلم مع مبنى الحي (11هـ): أغطية أعمدته وحافة سوره بلون مبناه، أو بلون هالة ميزة المدينة
  const glow = district.feature && CITY_FEATURES.colors[district.feature];
  const accent = (district.building && B.accents[district.building]) || (glow ? 'rgb(' + glow + ')' : null);
  return amount > 0
    ? { mask, walls, gates, fort, accent, d, i, j, size: sizeOf(district), color: district.tintColor, alpha: amount, owned: true }
    : { mask, walls, gates, fort, accent, d, i, j, size: sizeOf(district), color: B.neutral, alpha: B.neutralAlpha, owned: false };
}

// أعمدة السياج والسور: مستطيل بلون الحد وحافته الداكنة، وغطاء فاتح فوقه
function drawPosts(ctx, list, color, alpha, P, cap = null) {
  ctx.beginPath();
  for (let n = 0; n < list.length; n += 2) ctx.rect(list[n] - P.w / 2, list[n + 1] - P.h, P.w, P.h);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = CAPTURE.border.under;
  ctx.stroke();
  ctx.beginPath();
  for (let n = 0; n < list.length; n += 2) {
    ctx.rect(list[n] - P.w / 2 - P.cap, list[n + 1] - P.h - P.cap * 1.6, P.w + 2 * P.cap, P.cap * 2.4);
  }
  ctx.fillStyle = cap || DISTRICT_SIZES.border.capColor;
  ctx.fill();
}

// أعمدة المربع في جهة (back: خلف مبناه مع الأرض، وإلا أمامه بعد رسمه): منتصفات الأضلاع (السياج) والأركان
function postsOf(look, x, y, back, out) {
  const S = DISTRICT_SIZES.border[look.size], mask = look.mask & ~(look.walls | look.gates);   // أضلاع السور والبوابات بلا أعمدة
  if (!S.post) return;
  if (S.mids) {
    for (let e = 0; e < 4; e++) {
      if (!(mask & (1 << e)) || !!(BACK_EDGES & (1 << e)) !== back) continue;
      const E = EDGES[e];
      out.push(x + (E[2] + E[4]) / 2, y + (E[3] + E[5]) / 2);
    }
  }
  for (const c of CORNERS) if (c.back === back && (mask & c.need) === c.need) out.push(x + c.x, y + c.y);
}

// --- أسوار التحصين (القسم 3.12، EMPIRE.fortify) ---
// أضلاع السور في جهة (back: خلف مبنى المربع مع الأرض، وإلا أمامه بعده): [ax, ay, bx, by, مائل يميناً؟]،
// وأبراج أركانه حيث يلتقي ضلعا سور (من المستوى 2)
// أطراف ضلع السور مضبوطة على ركن الحي حتى لا تبقى فجوة: في إحداثيات المربعات الأضلاع أفقية وعمودية، والسور مزاح
// للداخل INSET مربع (مقابل inset بوحدات الشاشة). لكل طرف: m اتجاهه من منتصف الضلع، وn اتجاه الضلع للخارج:
// ركن بارز (لا جار للمربع في اتجاه m) يدخل نحو مركز المربع، وضلع مستقيم يبقى، وركن داخل (الجار وقطريّه من الحي)
// يمتد نحو m فيلتقي بضلع المربع المجاور
const INSET = CAPTURE.border.inset * Math.hypot(TILE_HALF_W, TILE_HALF_H) / (2 * TILE_HALF_W * TILE_HALF_H);
const EDGE_TILES = [
  { n: [-1, 0], a: [-0.5, 0.5], b: [-0.5, -0.5] },     // غربي: الركن الأيسر ← الأعلى
  { n: [1, 0], a: [0.5, -0.5], b: [0.5, 0.5] },        // شرقي: الأيمن ← الأسفل
  { n: [0, -1], a: [-0.5, -0.5], b: [0.5, -0.5] },     // شمالي: الأعلى ← الأيمن
  { n: [0, 1], a: [0.5, 0.5], b: [-0.5, 0.5] }         // جنوبي: الأسفل ← الأيسر
];
function wallEnds(map, look, e, x, y) {
  const E = EDGE_TILES[e], i = look.i, j = look.j;
  const inD = (a, b) => map.inBounds(a, b) && map.districtAt[map.idx(a, b)] === look.d;
  const end = (P) => {
    const mu = Math.sign(P[0] - (E.a[0] + E.b[0]) / 2), mv = Math.sign(P[1] - (E.a[1] + E.b[1]) / 2);
    const k = !inD(i + mu, j + mv) ? -1 : inD(i + mu + E.n[0], j + mv + E.n[1]) ? 1 : 0;
    const u = P[0] + INSET * (-E.n[0] + k * mu), v = P[1] + INSET * (-E.n[1] + k * mv);
    return [x + (u - v) * TILE_HALF_W, y + (u + v) * TILE_HALF_H];
  };
  const A = end(E.a), B = end(E.b);
  return [A[0], A[1], B[0], B[1], e < 2 ? 1 : 0];
}

function wallsOf(map, look, x, y, back, segs, towers, gates) {
  if (!look.walls && !look.gates) return;
  for (let e = 0; e < 4; e++) {
    if (!((look.walls | look.gates) & (1 << e)) || !!(BACK_EDGES & (1 << e)) !== back) continue;
    (look.gates & (1 << e) ? gates : segs).push(...wallEnds(map, look, e, x, y));
  }
  if (!EMPIRE.fortify.levels[look.fort - 1].tower) return;
  for (const c of CORNERS) if (c.back === back && (look.walls & c.need) === c.need) towers.push(x + c.x, y + c.y);
}

// ================= الأسوار بطراز كل منطقة (12ب، بطلب المستخدم: "تحسين وتغيير مظهر الجدران") =================
// المادة ولونها ونقشها، وتاجها من المستوى 2، وأبراج أركانها وغطاؤها، وبوابتها: من EMPIRE.fortify.styles بطراز المدينة.
// للسور سمك ظاهر من فوق (الممشى)، وشريط بلون المالك تحت حافته العليا، وأغطية أعمدة البوابة ورايات المستوى 3 بلونه
const styleCache = new Map();
function wallStyle(map) {
  let s = styleCache.get(map.city);
  if (!s) {
    const F = EMPIRE.fortify, c = F.cities[map.city] || F.cities.default;
    const [name, extra] = Array.isArray(c) ? c : [c, null];
    styleCache.set(map.city, s = { ...F.styles[name], ...(extra || {}) });
  }
  return s;
}
const WALL_LIGHT = ['rgba(40,28,14,0.26)', 'rgba(255,240,215,0.08)'];   // ظل الوجه: على محور i (يواجه +j) أغمق
const fillPath = (ctx, pts, col) => {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
};
// سمك السور خلف وجهه الظاهر: على محور i (slant 0) نحو −j، وعلى محور j (slant 1) نحو −i
const backOf = (slant) => { const t = EMPIRE.fortify.thick; return slant ? [-t, -t / 2] : [t, -t / 2]; };
// لون قطعة الصفيح ثابت لموضعها
const pieceColor = (S, ax, ay) => S.colors ? S.colors[Math.abs(Math.round(ax * 7 + ay * 13)) % S.colors.length] : S.face;

// صندوق بقاعدة معين (نصف عرضه w وعمقه w/2) وعمود أسطواني: أبراج الأركان وأعمدة البوابات
function isoBox(ctx, x, y, w, h, L, R, T) {
  const d = w / 2;
  fillPath(ctx, [x - w, y, x, y + d, x, y + d - h, x - w, y - h], L);
  fillPath(ctx, [x, y + d, x + w, y, x + w, y - h, x, y + d - h], R);
  fillPath(ctx, [x - w, y - h, x, y - d - h, x + w, y - h, x, y + d - h], T);
}
function isoCyl(ctx, x, y, r, h, L, R, T) {
  const ry = r / 2;
  ctx.beginPath();
  ctx.moveTo(x - r, y - h); ctx.lineTo(x - r, y); ctx.ellipse(x, y, r, ry, 0, Math.PI, 0, true); ctx.lineTo(x + r, y - h);
  ctx.closePath();
  ctx.fillStyle = R;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - r, y - h); ctx.lineTo(x - r, y); ctx.ellipse(x, y, r, ry, 0, Math.PI, Math.PI * 0.6, true);
  ctx.lineTo(x + r * Math.cos(Math.PI * 0.6), y - h);
  ctx.closePath();
  ctx.fillStyle = L;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y - h, r, ry, 0, 0, TAU);
  ctx.fillStyle = T;
  ctx.fill();
}

// نقش الوجه بين A وB بارتفاع h (P: نقطة على الوجه بنسبة t على طوله وارتفاع v)
function wallTexture(ctx, S, ax, ay, bx, by, h) {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 0.6) return;
  const P = (t, v) => [ax + (bx - ax) * t, ay + (by - ay) * t - v];
  const seg = (t0, v0, t1, v1) => { const p = P(t0, v0), q = P(t1, v1); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
  const stroke = (col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); };
  const T = S.texture;
  if (T === 'blocks' || T === 'bricks' || T === 'plaster') {
    const course = T === 'bricks' ? 1.3 : 2.1, joint = T === 'bricks' ? 2.6 : 4.2, top = T === 'plaster' ? h * 0.36 : h;
    if (T === 'plaster') fillPath(ctx, [...P(0, 0), ...P(1, 0), ...P(1, top), ...P(0, top)], S.base);
    ctx.beginPath();
    for (let v = course; v < top - 0.3; v += course) seg(0, v, 1, v);
    for (let v = 0, k = 0; v < top - 0.3; v += course, k++) {
      for (let s = (k % 2) * joint / 2 + joint * 0.5; s < len - 0.3; s += joint) seg(s / len, v, s / len, Math.min(v + course, top));
    }
    stroke(T === 'bricks' ? 'rgba(255,225,200,0.28)' : 'rgba(30,24,18,0.24)', 0.4);
    if (T === 'plaster') { ctx.beginPath(); seg(0, top, 1, top); stroke('rgba(30,30,30,0.35)', 0.6); }
  } else if (T === 'logs' || T === 'tin' || T === 'panels') {
    const step = T === 'logs' ? 1.5 : T === 'tin' ? 0.9 : 5;
    ctx.beginPath();
    for (let s = step; s < len - 0.2; s += step) seg(s / len, 0, s / len, h);
    if (T === 'panels') seg(0, h * 0.5, 1, h * 0.5);
    stroke(T === 'logs' ? 'rgba(40,24,10,0.5)' : 'rgba(0,0,0,0.2)', T === 'logs' ? 0.55 : 0.4);
  } else {
    // طين: خط تشقق خفيف، وأسفل أغمق، وفي الساحلي صف أوتاد خشبية بارزة (toron) تحت الحافة
    fillPath(ctx, [...P(0, 0), ...P(1, 0), ...P(1, 0.9), ...P(0, 0.9)], 'rgba(70,36,14,0.2)');
    ctx.beginPath();
    seg(0.05, h * 0.42, 0.55, h * 0.47);
    seg(0.5, h * 0.62, 0.95, h * 0.58);
    stroke('rgba(90,50,20,0.22)', 0.45);
    if (T === 'toron') {
      ctx.beginPath();
      for (let s = 1.6; s < len - 0.8; s += 3.2) { const p = P(s / len, h * 0.7); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + 0.9, p[1] + 0.9); }
      stroke('#5a3a20', 0.6);
    }
  }
}

// تاج السور على حافته العليا الأمامية (A إلى B) من المستوى 2؛ (tx, ty) سمكه للخلف
function wallCrown(ctx, S, ax, ay, bx, by, tx, ty) {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 0.6) return;
  const M = EMPIRE.fortify.merlon, ux = (bx - ax) / len, uy = (by - ay) / len, col = S.crownColor || S.face || S.top;
  const at = (s) => [ax + ux * s, ay + uy * s];
  const C = S.crown;
  if (C === 'flat') return;
  if (C === 'stakes' || C === 'spikes') {
    ctx.beginPath();
    for (let s = 0.75; s < len; s += 1.5) {
      const [px, py] = at(s);
      if (C === 'stakes') { ctx.moveTo(px - ux * 0.7, py - uy * 0.7); ctx.lineTo(px + tx * 0.4, py + ty * 0.4 - 2); ctx.lineTo(px + ux * 0.7, py + uy * 0.7); }
      else { ctx.moveTo(px, py); ctx.lineTo(px, py - 2.4); }
    }
    if (C === 'stakes') { ctx.fillStyle = S.face; ctx.fill(); ctx.strokeStyle = S.edge; ctx.lineWidth = 0.35; ctx.stroke(); return; }
    ctx.strokeStyle = '#2a2a2e';
    ctx.lineWidth = 0.45;
    ctx.stroke();
    ctx.beginPath();                                          // سلك شائك بين الأسياخ
    const p = at(0), q = at(len);
    ctx.moveTo(p[0], p[1] - 1.7); ctx.lineTo(q[0], q[1] - 1.7);
    ctx.moveTo(p[0], p[1] - 0.9); ctx.lineTo(q[0], q[1] - 0.9);
    ctx.strokeStyle = 'rgba(40,40,44,0.7)';
    ctx.lineWidth = 0.3;
    ctx.stroke();
    return;
  }
  if (C === 'tiles') {                                        // سقف قرميد صغير على طول السور بحافتين بارزتين
    const p0 = at(-0.5), p1 = at(len + 0.5), r0 = [p0[0] + tx * 0.5, p0[1] + ty * 0.5 - 1.7], r1 = [p1[0] + tx * 0.5, p1[1] + ty * 0.5 - 1.7];
    fillPath(ctx, [r0[0], r0[1], r1[0], r1[1], p1[0] + tx * 1.3, p1[1] + ty * 1.3, p0[0] + tx * 1.3, p0[1] + ty * 1.3], mixc(S.tile, '#000000', 0.25));
    fillPath(ctx, [p0[0], p0[1] + 0.7, p1[0], p1[1] + 0.7, r1[0], r1[1], r0[0], r0[1]], S.tile);
    ctx.beginPath();
    for (let s = 1.2; s < len; s += 1.2) { const p = at(s); ctx.moveTo(p[0], p[1] + 0.6); ctx.lineTo(p[0] + tx * 0.5, p[1] + ty * 0.5 - 1.6); }
    ctx.moveTo(r0[0], r0[1]); ctx.lineTo(r1[0], r1[1]);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 0.4;
    ctx.stroke();
    return;
  }
  const count = Math.max(1, Math.round(len / M.every)), w = M.w, mh = M.h;
  for (let m = 0; m < count; m++) {
    const [cx, cy] = at((m + 0.5) * len / count), lx = cx - ux * w / 2, ly = cy - uy * w / 2, rx = cx + ux * w / 2, ry = cy + uy * w / 2;
    if (C === 'teeth') fillPath(ctx, [lx, ly, cx + tx * 0.3, cy + ty * 0.3 - mh * 1.6, rx, ry], col);
    else if (C === 'round') {
      ctx.beginPath(); ctx.ellipse(cx + tx * 0.3, cy + ty * 0.3, w / 2, mh, 0, Math.PI, 0); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
    } else if (C === 'stepped') {
      const step = (k, sw) => fillPath(ctx, [cx - ux * sw, cy - uy * sw - k, cx + ux * sw, cy + uy * sw - k,
                                             cx + ux * sw, cy + uy * sw - k - mh * 0.55, cx - ux * sw, cy - uy * sw - k - mh * 0.55], col);
      step(0, w * 0.6); step(mh * 0.55, w * 0.38); step(mh * 1.1, w * 0.18);
    } else {                                                  // مربعة: وجه وسطح
      fillPath(ctx, [lx, ly, rx, ry, rx, ry - mh, lx, ly - mh], col);
      fillPath(ctx, [lx, ly - mh, rx, ry - mh, rx + tx, ry + ty - mh, lx + tx, ly + ty - mh], S.top);
    }
  }
}

function drawWalls(ctx, segs, color, alpha, fort, S) {
  const L = EMPIRE.fortify.levels[fort - 1], h = L.wall;
  for (let n = 0; n < segs.length; n += 5) {
    const ax = segs[n], ay = segs[n + 1], bx = segs[n + 2], by = segs[n + 3], slant = segs[n + 4], [tx, ty] = backOf(slant);
    ctx.globalAlpha = Math.max(alpha, 0.85);                 // السور ظاهر حتى في الحي المحايد
    fillPath(ctx, [ax, ay - h, bx, by - h, bx + tx, by + ty - h, ax + tx, ay + ty - h], S.top);   // الممشى
    fillPath(ctx, [ax, ay, bx, by, bx, by - h, ax, ay - h], pieceColor(S, ax, ay));
    wallTexture(ctx, S, ax, ay, bx, by, h);
    fillPath(ctx, [ax, ay, bx, by, bx, by - h, ax, ay - h], WALL_LIGHT[slant]);
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx, by - h); ctx.lineTo(ax, ay - h); ctx.closePath();
    ctx.strokeStyle = S.edge;
    ctx.lineWidth = 0.45;
    ctx.stroke();
    ctx.globalAlpha = alpha;                                 // شريط المالك تحت الحافة العليا
    ctx.beginPath();
    ctx.moveTo(ax, ay - h + 1.1); ctx.lineTo(bx, by - h + 1.1);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = color;
    ctx.lineWidth = L.band * 0.75;
    ctx.stroke();
    if (L.merlons) { ctx.globalAlpha = Math.max(alpha, 0.85); wallCrown(ctx, S, ax, ay - h, bx, by - h, tx, ty); }
  }
}

// غطاء برج الركن فوق قمته (x, yt) بنصف عرض r
function towerCap(ctx, S, x, yt, r) {
  const col = S.capColor || S.top, dark = mixc(col, '#000000', 0.22), light = mixc(col, '#ffffff', 0.12), C = S.cap;
  if (C === 'cone' || C === 'roof') {
    const o = r + 0.7, hh = C === 'cone' ? r * 2.6 : r * 1.6, dy = C === 'cone' ? r / 2 : o / 2;
    fillPath(ctx, [x - o, yt, x, yt + dy, x, yt - hh], dark);
    fillPath(ctx, [x, yt + dy, x + o, yt, x, yt - hh], light);
  } else if (C === 'dome') {
    ctx.beginPath(); ctx.ellipse(x, yt, r + 0.2, r * 1.15, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = light; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, yt, r + 0.2, r * 1.15, 0, Math.PI, Math.PI * 1.45); ctx.lineTo(x, yt); ctx.closePath(); ctx.fillStyle = dark; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, yt - r * 1.15); ctx.lineTo(x, yt - r * 1.15 - 1.3); ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = 0.6; ctx.stroke();
  } else if (C === 'pagoda') {
    const o = r + 1.6;
    fillPath(ctx, [x - o, yt + 0.3, x, yt + o / 2 + 0.6, x, yt - 2.8], dark);
    fillPath(ctx, [x, yt + o / 2 + 0.6, x + o, yt + 0.3, x, yt - 2.8], col);
    ctx.beginPath();
    ctx.moveTo(x - o, yt + 0.3); ctx.lineTo(x - o - 0.6, yt - 0.5);
    ctx.moveTo(x + o, yt + 0.3); ctx.lineTo(x + o + 0.6, yt - 0.5);
    ctx.moveTo(x, yt - 2.8); ctx.lineTo(x, yt - 3.8);
    ctx.strokeStyle = dark; ctx.lineWidth = 0.6; ctx.stroke();
  } else if (C === 'chhatri') {
    ctx.beginPath();
    for (const dx of [-r * 0.7, r * 0.7]) { ctx.moveTo(x + dx, yt + 0.3); ctx.lineTo(x + dx, yt - 2.4); }
    ctx.strokeStyle = col; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, yt - 2.4, r * 0.95, r * 0.95, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, yt - 2.4 - r * 0.95); ctx.lineTo(x, yt - 3.6 - r * 0.95); ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = 0.5; ctx.stroke();
  } else if (C === 'teeth') {
    for (const [dx, dy] of [[-r, 0], [-r * 0.5, r * 0.4], [0, r * 0.5], [r * 0.5, r * 0.4], [r, 0]]) {
      fillPath(ctx, [x + dx - 0.6, yt + dy, x + dx, yt + dy - 1.8, x + dx + 0.6, yt + dy], S.crownColor || light);
    }
  } else if (C === 'flat' || C === 'stepped') {
    const m = r * 0.42;
    for (const [dx, dy] of [[0, -r / 2], [-r + m, 0], [r - m, 0], [0, r / 2]]) isoBox(ctx, x + dx, yt + dy + m / 2, m, C === 'flat' ? 1.4 : 1, mixc(S.face || S.top, '#000000', 0.15), S.face || S.top, S.top);
    if (C === 'stepped') isoBox(ctx, x, yt, r * 0.45, 2.2, mixc(S.face, '#000000', 0.15), S.face, S.top);
  } else if (C === 'lamp') {
    isoBox(ctx, x, yt, 1.1, 1.4, '#2f3236', '#44484c', '#55595e');
    ctx.beginPath(); ctx.arc(x + 0.6, yt - 2.3, 0.9, 0, TAU); ctx.fillStyle = '#f4e3a0'; ctx.fill();
  }
}

// عمود بطراز السور (مستدير أو مربع) عرضه w وارتفاعه h؛ cap: غطاء بلون المالك (أعمدة البوابة)
function wallPost(ctx, S, x, y, w, h, capColor) {
  const L = mixc(S.face || S.colors[0], '#000000', 0.2), R = S.face || S.colors[1], r = w * 0.62;
  if (S.tower === 'round') isoCyl(ctx, x, y, r, h, L, R, S.top);
  else isoBox(ctx, x, y, r, h, L, R, S.top);
  if (capColor) fillPath(ctx, [x - r - 0.4, y - h, x, y - h - r * 0.55, x + r + 0.4, y - h, x, y - h + r * 0.55], capColor);
}

// البوابات: عتبة بطراز السور فوق قوس مفتوح يُمشى من تحته (أعلى من السور)، وأعلاها بلون المالك، وعمودان على طرفيها،
// ومن المستوى 2 مصراعان مفتوحان (wood) أو شبكة مرفوعة (iron) أو سقف فوقها (roofed)، وراية في وسطها في المستوى 3
function drawGates(ctx, segs, color, alpha, fort, S) {
  const F = EMPIRE.fortify, L = F.levels[fort - 1], G = F.gate, h = L.wall + G.extra;
  const spring = h * G.spring, apex = h * G.apex;
  for (let n = 0; n < segs.length; n += 5) {
    const ax = segs[n], ay = segs[n + 1], bx = segs[n + 2], by = segs[n + 3], slant = segs[n + 4], [tx, ty] = backOf(slant);
    const P = (t, v) => [ax + (bx - ax) * t, ay + (by - ay) * t - v];
    const lintel = [];
    lintel.push(...P(0, h), ...P(1, h));
    for (let k = 0; k <= 12; k++) { const t = 1 - k / 12; lintel.push(...P(t, spring + Math.sin(Math.PI * t) * (apex - spring))); }
    ctx.globalAlpha = Math.max(alpha, 0.85);
    if (L.merlons && S.gate === 'wood') {                    // مصراعان مفتوحان على جانبي الفتحة بألواح ومسامير
      for (const [t0, t1] of [[0.02, 0.17], [0.83, 0.98]]) {
        fillPath(ctx, [...P(t0, 0), ...P(t1, 0), ...P(t1, spring), ...P(t0, spring)], '#5e3c22');
        ctx.beginPath();
        for (const v of [spring * 0.3, spring * 0.7]) { const p = P(t0, v), q = P(t1, v); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
        ctx.strokeStyle = '#2e2014'; ctx.lineWidth = 0.4; ctx.stroke();
      }
    }
    fillPath(ctx, [...P(0, h), ...P(1, h), ...P(1, h).map((c, k) => c + (k ? ty : tx)), ...P(0, h).map((c, k) => c + (k ? ty : tx))], S.top);
    fillPath(ctx, lintel, pieceColor(S, ax, ay));
    fillPath(ctx, lintel, WALL_LIGHT[slant]);
    ctx.beginPath();
    ctx.moveTo(lintel[0], lintel[1]);
    for (let k = 2; k < lintel.length; k += 2) ctx.lineTo(lintel[k], lintel[k + 1]);
    ctx.closePath();
    ctx.strokeStyle = S.edge; ctx.lineWidth = 0.45; ctx.stroke();
    if (L.merlons && S.gate === 'iron') {                    // شبكة حديد مرفوعة تحت العتبة
      ctx.beginPath();
      for (let t = 0.1; t < 0.95; t += 0.1) { const p = P(t, apex + 0.4), q = P(t, apex - 1.6); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
      const p = P(0.08, apex - 0.6), q = P(0.92, apex - 0.6);
      ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]);
      ctx.strokeStyle = '#2c2c30'; ctx.lineWidth = 0.45; ctx.stroke();
    }
    ctx.globalAlpha = alpha;                                 // أعلى البوابة بلون المالك
    ctx.beginPath();
    { const p = P(0, h - 1.1), q = P(1, h - 1.1); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
    ctx.lineCap = 'butt';
    ctx.strokeStyle = color;
    ctx.lineWidth = L.band * 0.75;
    ctx.stroke();
    ctx.globalAlpha = Math.max(alpha, 0.85);
    if (L.merlons) {
      if (S.gate === 'roofed') {                             // سقف بوابة شرقية أعرض من التاج بطرفين مرفوعين
        const p0 = P(-0.12, h), p1 = P(1.12, h), up = 3.4;
        const r0 = [p0[0] + tx * 0.5, p0[1] + ty * 0.5 - up], r1 = [p1[0] + tx * 0.5, p1[1] + ty * 0.5 - up];
        fillPath(ctx, [r0[0], r0[1], r1[0], r1[1], p1[0] + tx * 1.4, p1[1] + ty * 1.4 - 0.4, p0[0] + tx * 1.4, p0[1] + ty * 1.4 - 0.4], mixc(S.capColor, '#000000', 0.25));
        fillPath(ctx, [p0[0], p0[1] + 1.2, p1[0], p1[1] + 1.2, r1[0], r1[1], r0[0], r0[1]], S.capColor);
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1] + 1.2); ctx.lineTo(p0[0] - 0.8, p0[1] - 0.2);
        ctx.moveTo(p1[0], p1[1] + 1.2); ctx.lineTo(p1[0] + 0.8, p1[1] - 0.2);
        ctx.moveTo(r0[0], r0[1]); ctx.lineTo(r1[0], r1[1]);
        ctx.strokeStyle = mixc(S.capColor, '#000000', 0.4); ctx.lineWidth = 0.6; ctx.stroke();
      } else wallCrown(ctx, S, ...P(0, h), ...P(1, h), tx, ty);
    }
    if (L.banners) {                                         // راية معلقة في وسط العتبة
      ctx.globalAlpha = alpha;
      const [cx, cy] = P(0.5, h - 0.8);
      fillPath(ctx, [cx - 1.3, cy, cx + 1.3, cy, cx + 1.3, cy + apex - spring + 0.4, cx, cy + apex - spring + 1.4, cx - 1.3, cy + apex - spring + 0.4], color);
    }
    ctx.globalAlpha = Math.max(alpha, 0.85);
    for (const t of [0, 1]) wallPost(ctx, S, ...P(t, 0), G.pillar.w, h + G.pillar.extra, null);
    ctx.globalAlpha = alpha;
    for (const t of [0, 1]) {
      const [px, py] = P(t, h + G.pillar.extra), r = G.pillar.w * 0.62;
      fillPath(ctx, [px - r - 0.4, py, px, py - r * 0.55, px + r + 0.4, py, px, py + r * 0.55], color);
    }
  }
}

// أبراج الأركان بطراز المنطقة وغطائها، وراية على سارية في المستوى 3
function drawTowers(ctx, list, color, alpha, fort, S) {
  const F = EMPIRE.fortify, L = F.levels[fort - 1], T = L.tower, r = T.w * 0.7;
  for (let n = 0; n < list.length; n += 2) {
    const x = list[n], y = list[n + 1];
    ctx.globalAlpha = Math.max(alpha, 0.85);
    wallPost(ctx, S, x, y, T.w * 1.13, T.h, null);
    ctx.globalAlpha = alpha;                                 // شريط المالك حول البرج
    ctx.beginPath();
    ctx.moveTo(x - r, y - T.h + 1.4); ctx.lineTo(x, y - T.h + 1.4 + r / 2); ctx.lineTo(x + r, y - T.h + 1.4);
    ctx.strokeStyle = color; ctx.lineWidth = L.band * 0.7; ctx.lineCap = 'butt'; ctx.stroke();
    ctx.globalAlpha = Math.max(alpha, 0.85);
    towerCap(ctx, S, x, y - T.h, r);
    if (!L.banners) continue;
    const B = F.banner, top = y - T.h - (S.cap === 'cone' ? r * 2.6 : S.cap === 'roof' ? r * 1.6 : S.cap === 'dome' ? r * 1.15 : 2.6);
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top - B.pole);
    ctx.lineWidth = 0.6; ctx.strokeStyle = '#3a3229'; ctx.stroke();
    ctx.globalAlpha = alpha;
    fillPath(ctx, [x, top - B.pole, x + B.w, top - B.pole + B.h * 0.35, x, top - B.pole + B.h], color);
  }
}

// halo (طور الإمبراطورية): هالة خفيفة بلون المالك على الحد نفسه، أعرض منه وتحته
function drawBorders(ctx, map, tiles, halo) {
  const B = CAPTURE.border, groups = new Map();
  for (let t = 0; t < tiles.length; t += 2) {
    const i = tiles[t], j = tiles[t + 1];
    const look = borderOf(map, i, j);
    if (!look) continue;
    const x = tileX(i, j), y = tileY(i, j);
    const key = look.color + '|' + look.alpha + '|' + look.size + '|' + look.fort + '|' + look.accent;
    let g = groups.get(key);
    if (!g) groups.set(key, g = { ...look, lines: [], front: [], posts: [], halo: [], walls: [], towers: [], gates: [] });
    for (let e = 0; e < 4; e++) {
      if (!(look.mask & (1 << e))) continue;
      const [, , ax, ay, bx, by] = EDGES[e];
      g.halo.push(x + ax, y + ay, x + bx, y + by);
      if ((look.walls | look.gates) & (1 << e)) continue;   // ضلع السور أو البوابة: هي مكان الحد
      g.lines.push(x + ax, y + ay, x + bx, y + by);
      if (!(BACK_EDGES & (1 << e))) g.front.push(x + ax, y + ay, x + bx, y + by);
    }
    postsOf(look, x, y, true, g.posts);
    wallsOf(map, look, x, y, true, g.walls, g.towers, g.gates);
  }
  if (!groups.size) return;
  ctx.save();
  ctx.lineCap = 'round';
  const path = (list, lift) => {
    ctx.beginPath();
    for (let n = 0; n < list.length; n += 4) { ctx.moveTo(list[n], list[n + 1] - lift); ctx.lineTo(list[n + 2], list[n + 3] - lift); }
  };
  for (const g of groups.values()) {
    ctx.lineCap = 'round';                           // الأسوار ترسم شريطها بطرف مستقيم
    const S = DISTRICT_SIZES.border[g.size];
    if (halo && g.owned) {
      path(g.halo, 0);
      ctx.globalAlpha = g.alpha * halo.alpha;
      ctx.strokeStyle = g.color;
      ctx.lineWidth = halo.width;
      ctx.stroke();
    }
    path(g.lines, 0);
    ctx.globalAlpha = g.owned ? g.alpha : g.alpha * 0.6;
    ctx.strokeStyle = B.under;
    ctx.lineWidth = S.under;
    ctx.stroke();
    ctx.globalAlpha = g.alpha * B.alpha;
    ctx.strokeStyle = g.color;
    if (S.wall) {
      // السور المنخفض: وجه أمامي مظلل على الأضلاع المطلة نحو الشاشة، ثم أعلاه بلونه وحافته الفاتحة
      ctx.beginPath();
      for (let n = 0; n < g.front.length; n += 4) {
        const ax = g.front[n], ay = g.front[n + 1], bx = g.front[n + 2], by = g.front[n + 3];
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx, by - S.wall); ctx.lineTo(ax, ay - S.wall); ctx.closePath();
      }
      ctx.fillStyle = g.color;
      ctx.fill();
      ctx.fillStyle = S.shade;
      ctx.fill();
      path(g.lines, S.wall);
      ctx.lineWidth = S.width;
      ctx.stroke();
      ctx.strokeStyle = g.accent || DISTRICT_SIZES.border.capColor;
      ctx.lineWidth = S.coping;
      ctx.stroke();
    } else {
      ctx.lineWidth = S.width;
      ctx.stroke();
      if (S.rail) {                                    // حاجز السياج: الخط نفسه مرفوعاً ورفيعاً بين أعمدته
        path(g.lines, S.railLift);
        ctx.lineWidth = S.rail;
        ctx.stroke();
      }
    }
    if (g.posts.length) drawPosts(ctx, g.posts, g.color, g.alpha, S.post, g.accent);
    if (g.walls.length) drawWalls(ctx, g.walls, g.color, g.alpha, g.fort, wallStyle(map));
    if (g.gates.length) drawGates(ctx, g.gates, g.color, g.alpha, g.fort, wallStyle(map));
    if (g.towers.length) drawTowers(ctx, g.towers, g.color, g.alpha, g.fort, wallStyle(map));
  }
  ctx.restore();
}

// أعمدة الحد الأمامية للمربع: بعد مبناه فتبقى أمامه، وقبل ما أمامه من مربعات (ترتيب الرسام)
function drawBorderFront(ctx, map, i, j) {
  const look = borderOf(map, i, j);
  if (!look) return;
  const list = [], segs = [], towers = [], gates = [], x = tileX(i, j), y = tileY(i, j);
  postsOf(look, x, y, false, list);
  wallsOf(map, look, x, y, false, segs, towers, gates);
  if (!list.length && !segs.length && !towers.length && !gates.length) return;
  ctx.save();
  if (list.length) drawPosts(ctx, list, look.color, look.alpha, DISTRICT_SIZES.border[look.size].post, look.accent);
  if (segs.length) drawWalls(ctx, segs, look.color, look.alpha, look.fort, wallStyle(map));
  if (gates.length) drawGates(ctx, gates, look.color, look.alpha, look.fort, wallStyle(map));
  if (towers.length) drawTowers(ctx, towers, look.color, look.alpha, look.fort, wallStyle(map));
  ctx.restore();
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
  if (!cityReady(state.map)) return Infinity;      // صور مباني المدينة لم تُحمّل بعد: لا شيء يُرسم ولا يُخزن
  if (!cache || cache.map !== state.map || cache.weather !== state.weather || cache.mode !== state.mode ||
      cache.detail !== gfx().detail) setup(state);
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
    const key = tintKey(districts[d], state);
    if (key === cache.keys[d]) continue;
    cache.keys[d] = key;
    // رسم جارٍ بالألوان القديمة يُلغى ويبدأ من جديد
    for (const id of cache.districtChunks[d]) { cache.chunks[id].dirty = true; cache.chunks[id].job = null; }
    repaintBase(state, districts[d]);
  }
}

// خريطة الأرض المنخفضة تتبع لون الحي: تُعاد أرض مربعاته وحدها (بضع عشرات من المعينات، لا الخريطة كلها)
function repaintBase(state, district) {
  const b = cache.base;
  if (!b) return;
  const ctx = b.canvas.getContext('2d');
  ctx.setTransform(b.scale, 0, 0, b.scale, -cache.x0 * b.scale, -cache.y0 * b.scale);
  const tiles = [];
  for (const [i, j] of district.tiles) tiles.push(i, j);
  drawGround(ctx, state, tiles);
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
  if (!cache || !cityReady(cache.map)) return null;
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
// lights: مصفوفة تُجمع فيها إضاءة الليل (صورة الطقس في لوحة الطقس)، أو null
export function drawWholeMap(ctx, state, lights = null) {
  const map = state.map, all = [];
  for (let j = 0; j < map.n; j++) for (let i = 0; i < map.n; i++) all.push(i, j);
  drawGround(ctx, state, all);
  beginCity(ctx, map);
  for (let s = 0; s <= 2 * map.n - 2; s++) {
    for (let i = Math.max(0, s - map.n + 1); i <= Math.min(map.n - 1, s); i++) {
      const j = s - i;
      drawTileStatic(state, i, j, tileX(i, j), tileY(i, j), lights, null);
    }
  }
}
