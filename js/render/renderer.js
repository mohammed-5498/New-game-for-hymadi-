// الكاميرا وترتيب الرسم الكامل لإطار واحد
import { TILE_HALF_W, TILE_HALF_H, CAMERA, CAPTURE } from '../config.js';
import { mix, PALETTES, ROAD_COLOR, BACKGROUND, UI_LIGHT } from './colors.js';
import { drawBuilding, setFrameContext } from './buildings.js';
import { drawUnit, drawSelectionRing, drawProjectile } from './units.js';
import { drawOverlay, drawLights, drawParticles } from './weather.js';
import { worldToTile } from '../map/coords.js';

export function resizeCanvas(canvas, state) {
  const view = state.view;
  view.w = canvas.clientWidth || window.innerWidth;
  view.h = canvas.clientHeight || window.innerHeight;
  view.dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(view.w * view.dpr);
  canvas.height = Math.round(view.h * view.dpr);
}

// الكاميرا لا تخرج عن حدود الخريطة ولا عن حدود التكبير
// نحوّل مركز الكاميرا إلى مربعات ونحصره داخل الشبكة حتى لا يخرج المنظر خارج المدينة
export function clampCamera(state) {
  const cam = state.camera, n = state.map.n;
  cam.z = Math.max(CAMERA.minZoom, Math.min(CAMERA.maxZoom, cam.z));

  const tile = worldToTile(cam.x, cam.y);
  const i = Math.max(0, Math.min(n - 1, tile.i));
  const j = Math.max(0, Math.min(n - 1, tile.j));
  cam.x = (i - j) * TILE_HALF_W;
  cam.y = (i + j) * TILE_HALF_H;
}

export function render(ctx, state, alpha) {
  const { map, camera, view } = state;
  const lights = [];
  setFrameContext(ctx, state.weather, lights);

  // خلفية
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, view.w, view.h);

  // نظام إحداثيات العالم
  worldTransform(ctx, state);

  // حدود ما يظهر على الشاشة (نرسم ما بداخلها فقط)
  const z = camera.z;
  const vx0 = camera.x - view.w / 2 / z - 40, vx1 = camera.x + view.w / 2 / z + 40;
  const vy0 = camera.y - view.h / 2 / z - 30, vy1 = camera.y + view.h / 2 / z + 70;
  const visible = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;

  drawGround(ctx, state, visible);
  drawBuildingsAndUnits(ctx, state, alpha, visible);

  for (const shot of state.projectiles) drawProjectile(ctx, shot, alpha);
  drawCaptureBars(ctx, state, visible);

  // طبقة الطقس فوق المشهد
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  drawOverlay(ctx, state.weather, view);
  if (state.weather === 'night') drawLights(ctx, lights, camera, view);

  // دوائر التحديد وعلامة الحركة فوق طبقة الليل حتى تبقى واضحة
  worldTransform(ctx, state);
  for (const unit of state.units) {
    if (unit.selected && unit.state !== 'dead') drawSelectionRing(ctx, unit, alpha);
  }
  drawMoveMarker(ctx, state);

  // جزيئات الطقس ومربع التحديد في إحداثيات الشاشة
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  drawParticles(ctx, state.weather);
  drawSelectionBox(ctx, state);
}

function worldTransform(ctx, state) {
  const { camera: cam, view } = state;
  const s = view.dpr * cam.z;
  ctx.setTransform(s, 0, 0, s, view.dpr * (view.w / 2 - cam.x * cam.z), view.dpr * (view.h / 2 - cam.y * cam.z));
}

function drawGround(ctx, state, visible) {
  const { map } = state;
  for (let j = 0; j < map.n; j++) {
    for (let i = 0; i < map.n; i++) {
      const x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
      if (!visible(x, y)) continue;

      const k = map.idx(i, j);
      const isRoad = map.road[k] === 1;
      let color = isRoad ? ROAD_COLOR : (PALETTES[map.region[k]] || PALETTES.neutral).ground;

      // أرض الحي المملوك تُصبغ بلون مالكه
      if (!isRoad) {
        const district = map.districtOf(i, j);
        if (district && district.owner !== null) {
          color = mix(color, state.players[district.owner].color, CAPTURE.groundTintAlpha);
        }
      }

      if (state.weather === 'snow') color = mix(color, '#eef2f5', isRoad ? 0.45 : 0.72);
      else if (state.weather === 'rain') color = mix(color, '#2a2f36', 0.2);

      ctx.beginPath();
      ctx.moveTo(x - TILE_HALF_W, y);
      ctx.lineTo(x, y - TILE_HALF_H);
      ctx.lineTo(x + TILE_HALF_W, y);
      ctx.lineTo(x, y + TILE_HALF_H);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = color;   // يغلق الفراغات الشعرية بين المربعات
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // خطوط منتصف الشارع
      if (map.dash[k] === 1) dashLine(ctx, x - 4, y - 2, x + 4, y + 2);
      if (map.dash[k] === 2) dashLine(ctx, x + 4, y - 2, x - 4, y + 2);
    }
  }
}

function dashLine(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = '#c9bd85';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ترتيب الرسام: كل قطر (i + j) من الخلف للأمام، مباني ثم وحدات
function drawBuildingsAndUnits(ctx, state, alpha, visible) {
  const { map } = state;

  // توزيع الوحدات على الأقطار حسب موقعها المنعّم
  const buckets = new Map();
  for (const unit of state.units) {
    const i = unit.prevX + (unit.x - unit.prevX) * alpha;
    const j = unit.prevY + (unit.y - unit.prevY) * alpha;
    const key = Math.round(i + j);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(unit);
  }

  for (let s = 0; s <= 2 * map.n - 2; s++) {
    for (let i = Math.max(0, s - map.n + 1); i <= Math.min(map.n - 1, s); i++) {
      const j = s - i;
      const x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
      if (!visible(x, y)) continue;

      const k = map.idx(i, j);
      const type = map.road[k] ? map.decor[k] : map.type[k];
      if (!type || type === '.') continue;

      const district = map.districtOf(i, j);
      const ownerColor = district && district.owner !== null ? state.players[district.owner].color : null;
      drawBuilding(type, x, y, map.region[k], i, j, ownerColor);
    }

    const unitsHere = buckets.get(s);
    if (unitsHere) for (const unit of unitsHere) drawUnit(ctx, unit, alpha);
  }
}

// شريط تقدم الاستيلاء فوق العلم بلون المستولي
function drawCaptureBars(ctx, state, visible) {
  const w = 14, h = 2.4;
  for (const district of state.map.districts) {
    if (!district.capture) continue;
    const full = district.progress >= 100 && !district.contested;
    if (district.progress <= 0 && !district.contested) continue;
    if (full) continue;

    const { i, j } = district.capture;
    const x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
    if (!visible(x, y)) continue;

    const top = y - 30;
    ctx.fillStyle = 'rgba(20,18,16,.7)';
    ctx.fillRect(x - w / 2, top, w, h);

    const color = district.progressOwner !== null
      ? state.players[district.progressOwner].color
      : UI_LIGHT;
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, top, w * (district.progress / 100), h);

    // المنطقة متنازع عليها: إطار فاتح حول الشريط
    if (district.contested) {
      ctx.strokeStyle = UI_LIGHT;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(x - w / 2, top, w, h);
    }
  }
}

function drawMoveMarker(ctx, state) {
  const marker = state.moveMarker;
  if (!marker) return;
  const x = (marker.i - marker.j) * TILE_HALF_W, y = (marker.i + marker.j) * TILE_HALF_H;
  const alpha = 1 - marker.t / 0.8;
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.beginPath();
  ctx.ellipse(x, y, 6 + marker.t * 14, 3 + marker.t * 7, 0, 0, 6.2832);
  ctx.strokeStyle = UI_LIGHT;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawSelectionBox(ctx, state) {
  const sel = state.selectionBox;
  if (!sel) return;
  const x = Math.min(sel.x0, sel.x1), y = Math.min(sel.y0, sel.y1);
  const w = Math.abs(sel.x1 - sel.x0), h = Math.abs(sel.y1 - sel.y0);
  ctx.fillStyle = 'rgba(242,237,228,.12)';
  ctx.strokeStyle = UI_LIGHT;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}
