// إخفاء الوحدات خلف المباني (كما كان قبل تخزين المدينة في قطع):
// لكل مبنى يُستخرج مرة واحدة خط حدوده (أعلى وأسفل البكسلات المعتمة عموداً عموداً) برسمه في لوحة صغيرة.
// والوحدة التي أمامها مبنى يقع على صندوقها تُرسم مباشرة على الشاشة مع قصّ (clip) يستثني شكل ذلك المبنى.
// فلا لوحات إضافية ولا رسم للمدينة مرتين، والشكل لا يتأثر بلون المالك ولا بالطقس.
import { TILE_HALF_W, TILE_HALF_H, CITY_CACHE as CC } from '../config.js';
import { beginCity, drawTileStatic } from './cityRender.js';
import { getCtx, setThemeContext } from './cityThemes.js';

const O = CC.occlusion;
const R = O.probeScale;          // دقة القياس: بكسلات لكل وحدة عالم
let cache = null;                // لكل خريطة وطور: المربعات المرتفعة وأشكال المباني المقيسة
let probe = null;

function reset(state) {
  const map = state.map, n = map.n;
  // ما يرتفع عن الأرض فقط: المباني والأشجار والأطلال والمباني الحاسمة (لا الشوارع ولا الأرض ولا الماء)
  const solid = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) {
    const type = map.type[k];
    solid[k] = !map.road[k] && type !== '.' && type !== '~' ? 1 : 0;
  }
  cache = { map, mode: state.mode, solid, shapes: new Array(n * n).fill(undefined) };
}

// شكل المبنى حول مركز مربعه: حدوده، وقطع متصلة من الأعمدة لكل منها أعلى وأسفل البكسلات المعتمة
// null = لا شيء مرتفع
function measure(state, i, j) {
  const w = 2 * O.side * R, up = CC.reach.up, h = (up + O.down) * R;
  if (!probe) {
    probe = document.createElement('canvas');
    probe.width = w; probe.height = h;
  }
  const pc = probe.getContext('2d', { willReadFrequently: true });
  pc.setTransform(1, 0, 0, 1, 0, 0);
  pc.clearRect(0, 0, w, h);
  pc.setTransform(R, 0, 0, R, O.side * R, up * R);
  const saved = getCtx();
  beginCity(pc, state.map);
  drawTileStatic(state, i, j, 0, 0, null, null);
  setThemeContext(saved, state.map.seed || 0);
  const data = pc.getImageData(0, 0, w, h).data;

  const runs = [];
  let run = null, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let c = 0; c < w; c++) {
    let top = -1, bottom = -1;
    for (let y = 0; y < h; y++) {
      if (data[(y * w + c) * 4 + 3] > O.alphaCut) { if (top < 0) top = y; bottom = y; }
    }
    if (top < 0) { run = null; continue; }
    const x = c / R - O.side, ty = top / R - up, by = (bottom + 1) / R - up;
    if (!run) runs.push(run = { xs: [], tops: [], bottoms: [] });
    run.xs.push(x); run.tops.push(ty); run.bottoms.push(by);
    if (x < x0) x0 = x;
    if (x + 1 / R > x1) x1 = x + 1 / R;
    if (ty < y0) y0 = ty;
    if (by > y1) y1 = by;
  }
  if (!runs.length) return null;
  // كل قطعة مضلع: الخط العلوي من اليسار لليمين ثم السفلي عائداً (حواف الأعمدة لا مراكزها)
  const polys = runs.map(r => {
    const pts = [], last = r.xs.length - 1, step = 1 / R;
    pts.push(r.xs[0], r.bottoms[0], r.xs[0], r.tops[0]);
    for (let k = 0; k <= last; k++) pts.push(r.xs[k] + step / 2, r.tops[k]);
    pts.push(r.xs[last] + step, r.tops[last], r.xs[last] + step, r.bottoms[last]);
    for (let k = last; k >= 0; k--) pts.push(r.xs[k] + step / 2, r.bottoms[k]);
    return { x0: r.xs[0], x1: r.xs[last] + step, xs: r.xs, tops: r.tops, bottoms: r.bottoms, pts: simplify(pts, O.simplify) };
  });
  return { x0, x1, y0, y1, polys };
}

// تبسيط المضلع (دوغلاس-بوكر): الحواف المستقيمة تصير نقطتين بدل عشرات، بخطأ أقل من tol وحدة عالم
function simplify(pts, tol) {
  const n = pts.length / 2, keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = pts[2 * a], ay = pts[2 * a + 1], dx = pts[2 * b] - ax, dy = pts[2 * b + 1] - ay;
    const len = Math.hypot(dx, dy) || 1;
    let far = -1, best = tol;
    for (let k = a + 1; k < b; k++) {
      const dist = Math.abs((pts[2 * k] - ax) * dy - (pts[2 * k + 1] - ay) * dx) / len;
      if (dist > best) { best = dist; far = k; }
    }
    if (far >= 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  const out = [];
  for (let k = 0; k < n; k++) if (keep[k]) out.push(pts[2 * k], pts[2 * k + 1]);
  return new Float32Array(out);
}

// هل تقع بكسلات قطعة المبنى (منقولة إلى bx,by) على الصندوق؟
function polyHits(p, bx, by, ex0, ex1, ey0, ey1) {
  if (bx + p.x1 <= ex0 || bx + p.x0 >= ex1) return false;
  for (let k = 0; k < p.xs.length; k++) {
    const x = bx + p.xs[k];
    if (x + 1 / R <= ex0 || x >= ex1) continue;
    if (by + p.tops[k] < ey1 && by + p.bottoms[k] > ey0) return true;
  }
  return false;
}

// لكل وحدة: قطع المباني أمامها (قطر أكبر) التي تقع على صندوقها
// entries: { x, y, key, size } لكل وحدة، key = قطرها المقرّب وsize حجم رسمها نسبة للفرد العادي
function findOccluders(state, entries) {
  const map = state.map, n = map.n, solid = cache.solid, shapes = cache.shapes;
  const start = performance.now();
  let count = 0;
  for (const e of entries) {
    e.occ = null;
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
        let shape = shapes[k];
        if (shape === undefined) {
          if (performance.now() - start > O.budgetMs) continue;   // يُقاس في إطار قادم
          shape = shapes[k] = measure(state, i, j);
        }
        if (!shape) continue;
        const bx = d * TILE_HALF_W, by = s * TILE_HALF_H;
        if (bx + shape.x1 <= ex0 || bx + shape.x0 >= ex1 || by + shape.y1 <= ey0 || by + shape.y0 >= ey1) continue;
        for (const p of shape.polys) {
          if (!polyHits(p, bx, by, ex0, ex1, ey0, ey1)) continue;
          (e.occ || (e.occ = [])).push(p, bx, by);
          count++;
        }
      }
    }
  }
  return count;
}

// الوحدة المغطاة: قصّ بصندوقها الموسّع، ثم استثناء كل قطعة مبنى أمامها (evenodd داخل الصندوق)
function drawCovered(ctx, e, draw) {
  const g = O.clipMargin, z = e.size || 1;
  const X0 = e.x - O.unitSide * z - g, Y0 = e.y - O.unitUp * z - g;
  const W = 2 * (O.unitSide * z + g), H = (O.unitUp + O.unitDown) * z + 2 * g;
  ctx.save();
  ctx.beginPath();
  ctx.rect(X0, Y0, W, H);
  ctx.clip();
  const occ = e.occ;
  for (let q = 0; q < occ.length; q += 3) {
    const p = occ[q], bx = occ[q + 1], by = occ[q + 2], pts = p.pts;
    ctx.beginPath();
    ctx.rect(X0, Y0, W, H);
    ctx.moveTo(bx + pts[0], by + pts[1]);
    for (let k = 2; k < pts.length; k += 2) ctx.lineTo(bx + pts[k], by + pts[k + 1]);
    ctx.closePath();
    ctx.clip('evenodd');
  }
  draw(ctx, e);
  ctx.restore();
}

// رسم الوحدات بترتيب الأقطار مع إخفائها خلف المباني التي أمامها.
// entries مرتبة بالقطر تصاعدياً، وdraw(c, entry) ترسم الوحدة على اللوحة c
export function drawUnitsOccluded(ctx, state, entries, draw) {
  if (!O.enabled || typeof document === 'undefined' || !state.map.type) {
    for (const e of entries) draw(ctx, e);
    return;
  }
  if (!cache || cache.map !== state.map || cache.mode !== state.mode) reset(state);
  if (entries.length) findOccluders(state, entries);
  for (const e of entries) {
    if (e.occ) drawCovered(ctx, e, draw);
    else draw(ctx, e);
  }
}

// للقياس والاختبارات: عدد المباني المقيسة
export function occlusionStats() {
  if (!cache) return null;
  let measured = 0;
  for (const s of cache.shapes) if (s !== undefined) measured++;
  return { measured };
}
