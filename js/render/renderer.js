// الكاميرا وترتيب الرسم الكامل لإطار واحد
import { TILE_HALF_W, TILE_HALF_H, TICK_SEC, CAMERA, CAPTURE, PERFORMANCE, ALERTS, COMBAT_REALISM, UNIT_ART, gameModes as GM } from '../config.js';
import { enemyLeaders } from '../game/modes.js';
import { onScreen } from '../game/alerts.js';
import { mix, PALETTES, ROAD_COLOR, BACKGROUND, UI_LIGHT } from './colors.js';
import { drawBuilding, setFrameContext } from './buildings.js';
import { drawUnit, drawSelectionRing, drawProjectile, drawAura, drawFire, unitWorldPos } from './units.js';
import { drawOverlay, drawLights, drawParticles } from './weather.js';
import { worldToTile } from '../map/coords.js';
import { tintAmount } from '../game/capture.js';
import { drawClash, drawBurst } from './combatArt.js';
import { getPref } from '../prefs.js';

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
  shake = shakeOffset(state, alpha);   // إزاحة الارتجاجة لهذا الإطار
  setFrameContext(ctx, state.weather, lights, state.time);

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

  // النار والهالات على الأرض: تحتها المباني والوحدات تظهر فوقها
  for (const fire of state.fires) {
    drawFire(ctx, fire, state.time);
    lights.push({ x: (fire.x - fire.y) * TILE_HALF_W, y: (fire.x + fire.y) * TILE_HALF_H,
                  r: fire.radius * 28, c: '255,150,60', a: 0.7 });
  }
  drawBuildingsAndUnits(ctx, state, alpha, visible);

  for (const shot of state.projectiles) drawProjectile(ctx, shot, alpha);
  drawCaptureBars(ctx, state, visible);

  // طبقة الطقس فوق المشهد
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  drawOverlay(ctx, state.weather, view);
  if (state.weather === 'night') drawLights(ctx, lights, camera, view);

  // الهالات ودوائر التحديد وعلامة الحركة فوق طبقة الليل حتى تبقى واضحة
  worldTransform(ctx, state);
  for (const unit of state.units) {
    if (unit.state === 'dead') continue;
    if (!unit.stats.aura && !unit.selected) continue;
    if (!visible((unit.x - unit.y) * TILE_HALF_W, (unit.x + unit.y) * TILE_HALF_H)) continue;
    if (unit.stats.aura) drawAura(ctx, unit, alpha);
    if (unit.selected) drawSelectionRing(ctx, unit, alpha);
  }
  drawMoveMarker(ctx, state);
  drawHillCrown(ctx, state, visible);
  drawGroupTags(ctx, state, alpha, visible);
  drawCombatFx(ctx, state, visible);

  // جزيئات الطقس ومربع التحديد وأسهم التنبيه في إحداثيات الشاشة
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  drawParticles(ctx, state.weather);
  drawSelectionBox(ctx, state);
  drawEdgeAlerts(ctx, state);
}

// --- شرر تصادم الأسلحة والكلمات الطائرة (القسم 5.4.4ب) ---
// فوق طبقة الليل حتى تُقرأ، وبحجم ثابت على الشاشة مهما كان التقريب
function drawCombatFx(ctx, state, visible) {
  if (state.camera.z < PERFORMANCE.unitDetailZoom) return;
  // نجوم الانفجار عند الارتطام
  const sc = UNIT_ART.scale * 1.15;
  for (const fx of state.fx) {
    const x = (fx.x - fx.y) * TILE_HALF_W, y = (fx.x + fx.y) * TILE_HALF_H - fx.h * sc;
    if (visible(x, y)) drawBurst(ctx, x, y, fx.t / COMBAT_REALISM.burstSeconds, fx.big, sc);
  }
  for (const fx of state.clashes) {
    const x = (fx.x - fx.y) * TILE_HALF_W, y = (fx.x + fx.y) * TILE_HALF_H - 14;
    if (visible(x, y)) drawClash(ctx, x, y, fx.t);
  }
  if (!state.pops.length || !getPref('pops')) return;
  const z = state.camera.z;
  ctx.font = '600 ' + (12 / z).toFixed(2) + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.lineWidth = 3 / z;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  for (const pop of state.pops) {
    const x = (pop.x - pop.y) * TILE_HALF_W;
    const y = (pop.x + pop.y) * TILE_HALF_H - 30 - pop.t * 22 / z;
    if (!visible(x, y)) continue;
    ctx.globalAlpha = Math.max(0, 1 - pop.t / COMBAT_REALISM.pops.seconds);
    ctx.fillStyle = pop.color;
    ctx.strokeText(pop.text, x, y);
    ctx.fillText(pop.text, x, y);
  }
  ctx.globalAlpha = 1;
  ctx.direction = 'inherit';
}

// --- تاج التلة الذهبي فوق علمها في ملك الحي (القسم 9.5.4) ---
// فوق طبقة الليل، ولا يصغر على الشاشة عن حد أدنى: ظاهر من بعيد
function drawHillCrown(ctx, state, visible) {
  if (state.mode !== 'king' || !state.modeState) return;
  const hill = state.map.districts[state.modeState.hillId];
  if (!hill || !hill.capture) return;
  const { i, j } = hill.capture;
  const x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
  if (!visible(x, y)) return;

  const s = Math.max(7, 13 / state.camera.z);             // نصف عرض التاج
  const bob = Math.sin(state.time * 2.2) * s * 0.08;      // حركة خفيفة تلفت النظر
  const base = y - 25 + bob, top = base - s * 1.1;        // فوق رأس عمود العلم (22) مباشرة
  ctx.beginPath();
  ctx.moveTo(x - s, base);
  ctx.lineTo(x - s, top + s * 0.35);
  ctx.lineTo(x - s * 0.5, top + s * 0.75);
  ctx.lineTo(x, top);
  ctx.lineTo(x + s * 0.5, top + s * 0.75);
  ctx.lineTo(x + s, top + s * 0.35);
  ctx.lineTo(x + s, base);
  ctx.closePath();
  ctx.fillStyle = '#f2c14e';
  ctx.fill();
  ctx.lineWidth = Math.max(0.6, 1.4 / state.camera.z);
  ctx.strokeStyle = '#6b4a12';
  ctx.stroke();
  // جواهر صغيرة على رؤوس التاج
  ctx.fillStyle = '#d9463b';
  for (const [jx, jy] of [[-s, top + s * 0.35], [0, top], [s, top + s * 0.35]]) {
    ctx.beginPath();
    ctx.arc(x + jx, y + (jy - y), s * 0.16, 0, 6.2832);
    ctx.fill();
  }
}

// --- رقم مجموعة التحكم فوق رأس الجندي المحدد فقط (القسم 4.4) ---
// بحجم ثابت على الشاشة مهما كان التقريب، وفوق طبقة الليل حتى يُقرأ
function drawGroupTags(ctx, state, alpha, visible) {
  const z = state.camera.z;
  let fontSet = false;
  for (const unit of state.units) {
    if (!unit.selected || unit.group === null || unit.group === undefined || unit.state === 'dead') continue;
    const { x, y } = unitWorldPos(unit, alpha);
    if (!visible(x, y)) continue;
    if (!fontSet) {
      ctx.font = '700 ' + (10 / z).toFixed(2) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 2.5 / z;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.fillStyle = UI_LIGHT;
      fontSet = true;
    }
    // فوق شريط الدم (الظاهر دائماً للمحدد) بقليل
    const bar = unit.champion ? UNIT_ART.championHealthBarY : unit.hero ? UNIT_ART.heroHealthBarY : UNIT_ART.healthBarY;
    const ty = y + bar - 1.5;
    const label = String(unit.group + 1);
    ctx.strokeText(label, x, ty);
    ctx.fillText(label, x, ty);
  }
}

// --- أسهم التنبيه على حافة الشاشة (القسم 12.3) ---
// السهم يقف عند حافة الشاشة في اتجاه الحدث، ويخزّن موقعه ليُلمس في input.js
function drawEdgeAlerts(ctx, state) {
  drawLeaderArrows(ctx, state);                  // حماية الزعيم: أسهم ذهبية نحو زعماء الأعداء
  if (!state.alerts.length) return;

  for (const alert of state.alerts) {
    const { x, y, angle } = edgePoint(state, alert.i, alert.j, ALERTS.size);
    alert.screen = { x, y };

    const fade = Math.min(1, alert.life);          // يخفت في آخر ثانية
    // سهم زعيمك أوضح نبضاً من غيره (القسم 9.5.3)
    const leader = alert.kind === 'leader';
    const pulse = leader ? 0.8 + 0.3 * Math.sin(state.time * 11) : 0.85 + 0.15 * Math.sin(state.time * 7);
    const color = alert.kind === 'capture' ? ALERTS.captureColor : ALERTS.attackColor;
    drawArrow(ctx, x, y, angle, ALERTS.size * pulse, color, UI_LIGHT, fade);
  }
}

// موقع السهم على حافة الشاشة في اتجاه المربع (i, j)، بعيداً عن عمود مجموعات التحكم
function edgePoint(state, i, j, size) {
  const { camera, view } = state;
  const m = ALERTS.edgeMargin;
  const wx = (i - j) * TILE_HALF_W, wy = (i + j) * TILE_HALF_H;
  const dx = (wx - camera.x) * camera.z, dy = (wy - camera.y) * camera.z;
  const angle = Math.atan2(dy, dx);

  // نحصر النقطة داخل مستطيل الشاشة بعد طرح الهامش
  const halfW = Math.max(1, view.w / 2 - m), halfH = Math.max(1, view.h / 2 - m);
  const scale = Math.min(halfW / Math.max(1e-3, Math.abs(dx)), halfH / Math.max(1e-3, Math.abs(dy)));
  let x = view.w / 2 + dx * scale, y = view.h / 2 + dy * scale;
  // عناصر الواجهة على الحواف (الأزرار وشريط المعلومات والمجموعات وشريط القوة):
  // السهم يقف بجانبها لا تحتها، حتى يُرى ويُلمس. يتنحّى نحو وسط الشاشة بأقصر مسافة
  for (let pass = 0; pass < 2; pass++) {
    for (const r of state.hudAvoid || []) {
      if (x + size <= r.x0 || x - size >= r.x1 || y + size <= r.y0 || y - size >= r.y1) continue;
      const options = [
        { x: r.x0 - size - 6, y }, { x: r.x1 + size + 6, y },
        { x, y: r.y0 - size - 6 }, { x, y: r.y1 + size + 6 }
      ].filter(p => p.x > size && p.x < view.w - size && p.y > size && p.y < view.h - size);
      if (!options.length) continue;
      const best = options.reduce((a, b) => Math.hypot(a.x - x, a.y - y) <= Math.hypot(b.x - x, b.y - y) ? a : b);
      x = best.x; y = best.y;
    }
  }
  return { x, y, angle };
}

function drawArrow(ctx, x, y, angle, r, fill, outline, alpha, lineWidth = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  // قرص خلفي ليبقى السهم واضحاً فوق أي مشهد
  ctx.beginPath();
  ctx.arc(0, 0, r + 3, 0, 6.2832);
  ctx.fillStyle = 'rgba(20,18,16,.55)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(-r * 0.6, r * 0.7);
  ctx.lineTo(-r * 0.2, 0);
  ctx.lineTo(-r * 0.6, -r * 0.7);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// تاج الزعيم مرئي للجميع دائماً (القسم 9.5.3): سهم ذهبي صغير بحدّ بلون صاحبه
// يشير لكل زعيم عدو خارج الشاشة
function drawLeaderArrows(ctx, state) {
  const size = GM.regicide.leaderArrowSize;
  for (const { unit, color } of enemyLeaders(state)) {
    if (onScreen(state, unit.x, unit.y)) continue;
    const { x, y, angle } = edgePoint(state, unit.x, unit.y, size);
    drawArrow(ctx, x, y, angle, size, '#f2c14e', color, 0.95, 2);
  }
}

// إزاحة الارتجاجة بالبكسل، تُطبَّق على طبقات العالم دون طبقات الشاشة
let shake = null;

function shakeOffset(state, alpha) {
  const { pixels, seconds } = CAMERA.shake;
  // زمن الرسم المنعّم حتى تكون الارتجاجة سلسة لا بخطوة التحديث
  const now = state.time + alpha * TICK_SEC;
  const elapsed = now - state.shakeAt;
  if (elapsed < 0 || elapsed >= seconds) return null;

  const amount = pixels * (1 - elapsed / seconds);   // تخفت حتى تنتهي
  // اتجاه يدور بسرعة فتبدو ارتجاجاً، ومقدار الإزاحة لا يتجاوز pixels
  const angle = now * 61;
  return { x: Math.cos(angle) * amount, y: Math.sin(angle) * amount };
}

function worldTransform(ctx, state) {
  const { camera: cam, view } = state;
  const s = view.dpr * cam.z;
  const dx = shake ? shake.x : 0, dy = shake ? shake.y : 0;
  ctx.setTransform(s, 0, 0, s,
    view.dpr * (view.w / 2 - cam.x * cam.z + dx),
    view.dpr * (view.h / 2 - cam.y * cam.z + dy));
}

// الأرض: نجمع المربعات حسب اللون ونرسم مساراً واحداً لكل لون
// (أسرع بكثير من مسار لكل مربع مع آلاف المربعات)
const groundBatches = new Map();

function drawGround(ctx, state, visible) {
  const { map } = state;
  const EX = TILE_HALF_W + 0.4, EY = TILE_HALF_H + 0.25;   // توسيع بسيط يغلق الفراغات الشعرية

  for (const tiles of groundBatches.values()) tiles.length = 0;
  let dashes = null;

  for (let j = 0; j < map.n; j++) {
    for (let i = 0; i < map.n; i++) {
      const x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
      if (!visible(x, y)) continue;

      const k = map.idx(i, j);
      const isRoad = map.road[k] === 1;
      let color = isRoad ? ROAD_COLOR : (PALETTES[map.region[k]] || PALETTES.neutral).ground;

      // أرض الحي المملوك تُصبغ بلون مالكه (انتقال تدريجي خلال نصف ثانية)
      if (!isRoad) {
        const district = map.districtOf(i, j);
        const amount = tintAmount(district, CAPTURE.groundTintAlpha);
        if (amount > 0) color = mix(color, district.tintColor, amount);
      }

      if (state.weather === 'snow') color = mix(color, '#eef2f5', isRoad ? 0.45 : 0.72);
      else if (state.weather === 'rain') color = mix(color, '#2a2f36', 0.2);

      let batch = groundBatches.get(color);
      if (!batch) groundBatches.set(color, batch = []);
      batch.push(x, y);

      // خطوط منتصف الشارع
      if (map.dash[k]) {
        if (!dashes) dashes = [];
        if (map.dash[k] === 1) dashes.push(x - 4, y - 2, x + 4, y + 2);
        else dashes.push(x + 4, y - 2, x - 4, y + 2);
      }
    }
  }

  for (const [color, tiles] of groundBatches) {
    if (!tiles.length) continue;
    ctx.beginPath();
    for (let t = 0; t < tiles.length; t += 2) {
      const x = tiles[t], y = tiles[t + 1];
      ctx.moveTo(x - EX, y);
      ctx.lineTo(x, y - EY);
      ctx.lineTo(x + EX, y);
      ctx.lineTo(x, y + EY);
      ctx.closePath();
    }
    ctx.fillStyle = color;
    ctx.fill();
  }

  if (dashes) {
    ctx.beginPath();
    for (let t = 0; t < dashes.length; t += 4) {
      ctx.moveTo(dashes[t], dashes[t + 1]);
      ctx.lineTo(dashes[t + 2], dashes[t + 3]);
    }
    ctx.strokeStyle = '#c9bd85';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ترتيب الرسام: كل قطر (i + j) من الخلف للأمام، مباني ثم وحدات
function drawBuildingsAndUnits(ctx, state, alpha, visible) {
  const { map } = state;
  // عند الإبعاد الشديد تختفي التفاصيل الصغيرة أصلاً، فلا نرسمها
  const detail = state.camera.z >= PERFORMANCE.detailZoom;

  // توزيع الوحدات الظاهرة فقط على الأقطار حسب موقعها المنعّم
  const buckets = new Map();
  for (const unit of state.units) {
    const i = unit.prevX + (unit.x - unit.prevX) * alpha;
    const j = unit.prevY + (unit.y - unit.prevY) * alpha;
    if (!visible((i - j) * TILE_HALF_W, (i + j) * TILE_HALF_H)) continue;
    const key = Math.round(i + j);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(unit);
    else buckets.set(key, [unit]);
  }

  for (let s = 0; s <= 2 * map.n - 2; s++) {
    for (let i = Math.max(0, s - map.n + 1); i <= Math.min(map.n - 1, s); i++) {
      const j = s - i;
      const x = (i - j) * TILE_HALF_W, y = (i + j) * TILE_HALF_H;
      if (!visible(x, y)) continue;

      const k = map.idx(i, j);
      const type = map.road[k] ? map.decor[k] : map.type[k];
      if (!type || type === '.') continue;

      // مباني الحي تحمل لون مالكه: الأسطح 45% والجدران 20% (القسم 8)
      const district = map.districtOf(i, j);
      const ownerColor = district && district.owner !== null ? state.players[district.owner].color : null;
      drawBuilding(type, x, y, map.region[k], i, j, ownerColor || (district && district.tintColor),
                   detail, tintAmount(district, 1));
    }

    const unitsHere = buckets.get(s);
    if (unitsHere) for (const unit of unitsHere) drawUnit(ctx, unit, alpha, state.camera.z, state.time, state.debugView, state.lodCrowded);
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
  // حلقة حمراء لأمر الهجوم المتحرك، وبيضاء لأمر الحركة العادي
  ctx.strokeStyle = marker.attack ? '#d9463b' : UI_LIGHT;
  ctx.lineWidth = marker.attack ? 1.6 : 1.2;
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
