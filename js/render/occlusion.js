// إخفاء الوحدات خلف المباني (كما كان قبل تخزين المدينة في قطع):
// الوحدات تُرسم مباشرة بترتيب الأقطار، والمبنى الذي يقع أمام وحدات خلفه "يُلصق" فوقها في دوره:
// قصاصة من صورة المدينة الجاهزة نفسها (القطع المخزنة) بشكل المبنى فقط، فتطابق ما على الشاشة تماماً.
// كلفة الإطار: نسخ صورة واحد لكل مبنى يغطي وحدات (لا قصّ ولا لوحات وسيطة). والقصاصة تُعاد فقط
// حين تُعاد قطعة المدينة تحتها (لون مالك جديد، دقة أخرى، طقس آخر).
import { TILE_HALF_W, TILE_HALF_H, CITY_CACHE as CC } from '../config.js';
import { beginCity, drawTileStatic } from './cityRender.js';
import { getCtx, setThemeContext } from './cityThemes.js';
import { cityRegion, drawRegionChunks, regionSig } from './chunkCache.js';

const O = CC.occlusion;
let cache = null;     // لكل خريطة وطور: المربعات المرتفعة، وحدود كل مبنى، والقصاصات
let probe = null;     // لوحة صغيرة لقياس حدود المبنى مرة واحدة
let mask = null;      // لوحة شكل المبنى عند صنع قصاصته

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// لوحة القصاصة لا تصغر عن 130×130: Chrome يرسم اللوحات الأصغر من 128×129 بالمعالج لا بكرت الشاشة،
// ونسخ صورة المدينة (على كرت الشاشة) إلى لوحة معالج يوقف الجوال حتى ينتهي كرت الشاشة من عمله
const GPU_MIN = 130;
const spriteSize = (w) => Math.max(GPU_MIN, w);

function reset(state) {
  const map = state.map, n = map.n;
  // ما يرتفع عن الأرض فقط: المباني والأشجار والأطلال والمباني الحاسمة (لا الشوارع ولا الأرض ولا الماء)
  const solid = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) {
    const type = map.type[k];
    solid[k] = !map.road[k] && type !== '.' && type !== '~' ? 1 : 0;
  }
  // حدود المبنى حول مركز مربعه: أعلى، يسار، يمين، أسفل (-1 = لم يُقس بعد)
  cache = { map, mode: state.mode, solid, bounds: new Int16Array(n * n * 4).fill(-1),
            sprites: new Map(), pixels: 0, frame: 0 };
}

// رسم مربع واحد وحده عند نقطة الأصل الحالية، ثم إعادة سياق الطوابع كما كان
function drawTileAlone(ctx, state, i, j) {
  const saved = getCtx();
  beginCity(ctx, state.map);
  drawTileStatic(state, i, j, 0, 0, null, null);
  setThemeContext(saved, state.map.seed || 0);
}

// حدود البكسلات المعتمة للمبنى: تُقاس مرة واحدة برسمه في لوحة صغيرة (بكسل لكل وحدة عالم)
function measure(state, i, j, k) {
  const w = 2 * O.side, up = CC.reach.up, h = up + O.down;
  if (!probe) probe = makeCanvas(w, h);
  const pc = probe.getContext('2d', { willReadFrequently: true });
  pc.setTransform(1, 0, 0, 1, 0, 0);
  pc.clearRect(0, 0, w, h);
  pc.setTransform(1, 0, 0, 1, O.side, up);
  drawTileAlone(pc, state, i, j);
  const data = pc.getImageData(0, 0, w, h).data;
  let top = h, bottom = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (data[row + x * 4 + 3] <= O.alphaCut) continue;
      if (y < top) top = y;
      bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  const b = cache.bounds, p = k * 4;
  if (bottom < 0) { cache.solid[k] = 0; b[p] = b[p + 1] = b[p + 2] = b[p + 3] = 0; return; }   // لا شيء مرتفع
  b[p] = up - top + 1;             // فوق المركز (مع هامش بكسل)
  b[p + 1] = O.side - left + 1;    // يسار المركز
  b[p + 2] = right + 2 - O.side;   // يمين المركز
  b[p + 3] = bottom + 2 - up;      // تحت المركز
}

// القصاصة: صورة المدينة الجاهزة حول المبنى، ثم يُبقى منها شكل المبنى فقط (destination-in)
function spriteOf(state, o, canSpend) {
  let sprite = cache.sprites.get(o.k);
  if (sprite && regionSig(sprite.region) === sprite.sig) { sprite.used = cache.frame; return sprite; }
  if (!canSpend()) return null;                        // تُصنع في إطار قادم
  const b = cache.bounds, p = o.k * 4;
  const region = cityRegion(o.bx - b[p + 1], o.by - b[p], o.bx + b[p + 2], o.by + b[p + 3]);
  if (!region) return null;                            // قطعة المدينة لم تُرسم بعد
  const scale = region.scale;
  // محاذاة القصاصة لشبكة بكسلات القطعة الأولى حتى تطابق ما على الشاشة بلا تمويه
  const gx = region.gx, gy = region.gy;
  const x0 = gx + Math.floor((o.bx - b[p + 1] - gx) * scale) / scale;
  const y0 = gy + Math.floor((o.by - b[p] - gy) * scale) / scale;
  const w = Math.ceil((o.bx + b[p + 2] - x0) * scale), h = Math.ceil((o.by + b[p + 3] - y0) * scale);
  if (w <= 0 || h <= 0) return null;

  const canvas = sprite && sprite.canvas.width === spriteSize(w) && sprite.canvas.height === spriteSize(h)
    ? sprite.canvas : makeCanvas(spriteSize(w), spriteSize(h));
  const sc = canvas.getContext('2d');
  sc.setTransform(1, 0, 0, 1, 0, 0);
  sc.clearRect(0, 0, canvas.width, canvas.height);
  sc.setTransform(scale, 0, 0, scale, -x0 * scale, -y0 * scale);
  drawRegionChunks(sc, region);
  if (!mask) mask = makeCanvas(w, h);
  if (mask.width < w || mask.height < h) { mask.width = Math.max(mask.width, w); mask.height = Math.max(mask.height, h); }
  const mc = mask.getContext('2d');
  mc.setTransform(1, 0, 0, 1, 0, 0);
  mc.clearRect(0, 0, w, h);
  mc.setTransform(scale, 0, 0, scale, (o.bx - x0) * scale, (o.by - y0) * scale);
  drawTileAlone(mc, state, o.i, o.j);
  sc.setTransform(1, 0, 0, 1, 0, 0);
  sc.globalCompositeOperation = 'destination-in';
  sc.drawImage(mask, 0, 0, w, h, 0, 0, w, h);
  sc.globalCompositeOperation = 'source-over';

  if (sprite) cache.pixels -= sprite.canvas.width * sprite.canvas.height;
  sprite = { canvas, scale, x0, y0, w, h, region, sig: region.sig, used: cache.frame };
  cache.sprites.set(o.k, sprite);
  cache.pixels += canvas.width * canvas.height;
  return sprite;
}

function evict() {
  if (cache.pixels <= O.maxPixels) return;
  const old = [...cache.sprites].filter(([, s]) => s.used < cache.frame).sort((a, b) => a[1].used - b[1].used);
  for (const [k, s] of old) {
    if (cache.pixels <= O.maxPixels) break;
    cache.pixels -= s.canvas.width * s.canvas.height;
    cache.sprites.delete(k);
  }
}

// المباني أمام الوحدات (قطر أكبر) التي تقع حدودها على صناديقها، ولكل مبنى مستطيل التغطية
// entries: { x, y, key, size } لكل وحدة، key = قطرها المقرّب وsize حجم رسمها نسبة للفرد العادي
function findOccluders(state, entries, canSpend) {
  const map = state.map, n = map.n, solid = cache.solid, b = cache.bounds;
  const found = new Map();
  for (const e of entries) {
    const z = e.size || 1;
    const ex0 = e.x - O.unitSide * z, ex1 = e.x + O.unitSide * z, ey0 = e.y - O.unitUp * z, ey1 = e.y + O.unitDown * z;
    const reachX = O.unitSide * z + O.side;
    const d0 = Math.ceil((e.x - reachX) / TILE_HALF_W), d1 = Math.floor((e.x + reachX) / TILE_HALF_W);
    const s1 = Math.min(2 * n - 2, Math.floor((ey1 + CC.reach.up) / TILE_HALF_H));
    for (let s = e.key + 1; s <= s1; s++) {
      for (let d = d0; d <= d1; d++) {
        if ((s + d) & 1) continue;
        const i = (s + d) / 2, j = (s - d) / 2;
        if (i < 0 || j < 0 || i >= n || j >= n) continue;
        const k = map.idx(i, j);
        if (!solid[k]) continue;
        const p = k * 4;
        if (b[p] < 0) {
          if (!canSpend()) continue;          // يُقاس في إطار قادم
          measure(state, i, j, k);
          if (!solid[k]) continue;
        }
        const bx = d * TILE_HALF_W, by = s * TILE_HALF_H;
        const x0 = Math.max(ex0, bx - b[p + 1]), x1 = Math.min(ex1, bx + b[p + 2]);
        const y0 = Math.max(ey0, by - b[p]), y1 = Math.min(ey1, by + b[p + 3]);
        if (x1 <= x0 || y1 <= y0) continue;   // المبنى لا يصل إلى الوحدة
        const o = found.get(k);
        if (!o) found.set(k, { k, s, i, j, bx, by, x0, x1, y0, y1 });
        else {
          if (x0 < o.x0) o.x0 = x0; if (x1 > o.x1) o.x1 = x1;
          if (y0 < o.y0) o.y0 = y0; if (y1 > o.y1) o.y1 = y1;
        }
      }
    }
  }
  const list = [];
  for (const o of found.values()) {
    o.sprite = spriteOf(state, o, canSpend);
    if (o.sprite) list.push(o);
  }
  return list.sort((a, b) => a.s - b.s);
}

// لصق جزء المبنى فوق ما رُسم قبله (الوحدات التي خلفه)
function paste(ctx, o) {
  const sp = o.sprite, k = sp.scale;
  const x0 = Math.max(o.x0, sp.x0), y0 = Math.max(o.y0, sp.y0);
  const x1 = Math.min(o.x1, sp.x0 + sp.w / k), y1 = Math.min(o.y1, sp.y0 + sp.h / k);   // أبعاد المحتوى لا اللوحة
  if (x1 <= x0 || y1 <= y0) return;
  // حواف المستطيل على شبكة بكسلات القصاصة: نفس عيّنات صورة المدينة بلا تمويه
  const sx0 = Math.floor((x0 - sp.x0) * k), sy0 = Math.floor((y0 - sp.y0) * k);
  const sx1 = Math.ceil((x1 - sp.x0) * k), sy1 = Math.ceil((y1 - sp.y0) * k);
  ctx.drawImage(sp.canvas, sx0, sy0, sx1 - sx0, sy1 - sy0,
                sp.x0 + sx0 / k, sp.y0 + sy0 / k, (sx1 - sx0) / k, (sy1 - sy0) / k);
}

// رسم الوحدات بترتيب الأقطار مع إخفائها خلف المباني التي أمامها.
// entries مرتبة بالقطر تصاعدياً، وdraw(c, entry) ترسم الوحدة على اللوحة c
export function drawUnitsOccluded(ctx, state, entries, draw) {
  if (!O.enabled || typeof document === 'undefined' || !state.map.type) {
    for (const e of entries) draw(ctx, e);
    return;
  }
  if (!cache || cache.map !== state.map || cache.mode !== state.mode) reset(state);
  cache.frame++;
  const start = performance.now();
  const canSpend = () => performance.now() - start < O.budgetMs;
  const occ = entries.length ? findOccluders(state, entries, canSpend) : [];
  // مباني القطر s تُلصق قبل وحدات القطر s نفسه: تغطي ما خلفها فقط (نفس ترتيب الرسام القديم)
  let q = 0;
  for (const e of entries) {
    while (q < occ.length && occ[q].s <= e.key) paste(ctx, occ[q++]);
    draw(ctx, e);
  }
  while (q < occ.length) paste(ctx, occ[q++]);
  evict();
}

// للقياس والاختبارات
export function occlusionStats() {
  if (!cache) return null;
  return { sprites: cache.sprites.size, pixels: cache.pixels };
}
