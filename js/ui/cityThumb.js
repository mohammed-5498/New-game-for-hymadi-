// الصورة المصغرة الحية للمدينة في قائمة الإعداد (القسم 3.9): خريطة صغيرة حقيقية من مولّد الخريطة
// تُرسم بنفس دوال المدينة، مرة واحدة لكل مدينة، وفي "عشوائي" تتبدل المدن كل ثانيتين.
// وصور لوحة الطقس: الخريطة نفسها بطقسها (الثلج على الأسطح والأرض) وفوقها طبقته وجزيئاته وإضاءة الليل
import { CITIES, TILE_HALF_W, TILE_HALF_H, PLAYER_COLORS, WEATHER } from '../config.js';
import { createMap } from '../map/generator.js';
import { drawWholeMap } from '../render/chunkCache.js';
import { THEMES } from '../render/cityThemes.js';
import { cityReady } from '../render/cityRender.js';
import { onSpritesReady } from '../render/sprites.js';

const thumbs = new Map();     // مدينة (أو "مدينة|طقس") -> لوحة جاهزة
const maps = new Map();       // مدينة -> خريطتها الصغيرة: صور الطقس تُرسم على الخريطة نفسها لا على خريطة جديدة
let timer = 0, shown = '';
let waiting = null;           // صورة مصغرة طُلبت قبل تحميل صور مبانيها: تُرسم حين تكتمل
const cardWaiting = [];       // خانات لوحة الاختيار التي تنتظر صور مباني مدينتها
onSpritesReady(() => {
  if (waiting) { const w = waiting; waiting = null; show(...w); }
  for (const [canvas, city, weather] of cardWaiting.splice(0)) {
    if (canvas.thumbWant === thumbKey(city, weather)) drawCardThumb(canvas, city, weather);
  }
});

const THUMB = { w: 260, h: 130, tiles: 'small' };
const thumbKey = (city, weather) => weather === 'day' ? city : city + '|' + weather;

function buildThumb(city, weather = 'day') {
  const key = thumbKey(city, weather);
  if (thumbs.has(key)) return thumbs.get(key);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = THUMB.w * dpr;
  canvas.height = THUMB.h * dpr;
  let map = maps.get(city);
  if (!map) {
    const players = [0, 1].map(k => ({ name: '', gang: 'crows', color: PLAYER_COLORS[k].id, isHuman: false, team: 0 }));
    map = createMap(THUMB.tiles, players, city);
    if (!map) return null;
    // حيّان منزليان ملوّنان بلونين، حتى يظهر تلوين المالك أيضاً
    for (const d of map.districts) if (d.owner !== null) { d.tintColor = PLAYER_COLORS[d.owner].hex; d.tintMix = 1; }
    maps.set(city, map);
  }
  if (!cityReady(map)) return null;
  const colors = [PLAYER_COLORS[0].hex, PLAYER_COLORS[1].hex];
  const state = { map, weather, mode: 'conquest', modeState: {}, players: colors.map(color => ({ color })) };
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2a2622';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // الخريطة كلها داخل الصورة: عرضها n×36 وارتفاعها n×18 تقريباً (مع المباني)
  const n = map.n;
  const worldW = n * 2 * TILE_HALF_W, worldH = n * 2 * TILE_HALF_H + 60;
  const s = Math.min(canvas.width / worldW, canvas.height / worldH) * CITIES.thumbZoom;   // أقرب قليلاً: تفاصيل أوضح
  const ox = canvas.width / 2, oy = (canvas.height - n * 2 * TILE_HALF_H * s) / 2 + 40 * s;
  ctx.setTransform(s, 0, 0, s, ox, oy);
  const lights = weather === 'night' ? [] : null;
  drawWholeMap(ctx, state, lights);
  if (weather !== 'day') {
    weatherOver(ctx, weather, lights, s, ox, oy, dpr);
    // صور الطقس لمدينة المعاينة الحالية فقط: لا تتراكم في الذاكرة
    for (const old of [...thumbs.keys()]) if (old.includes('|') && !old.startsWith(city + '|')) thumbs.delete(old);
  }
  thumbs.set(key, canvas);
  return canvas;
}

// طبقة الطقس فوق الصورة كما في المباراة (weather.js): اللون، ثم إضاءة الليل الدافئة، ثم الثلج أو المطر
function weatherOver(ctx, weather, lights, s, ox, oy, dpr) {
  const look = WEATHER[weather], w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (look.overlay) {
    ctx.fillStyle = look.overlay;
    ctx.fillRect(0, 0, w, h);
  }
  if (lights) {
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const x = ox + l.x * s, y = oy + l.y * s, r = Math.max(2, l.r * s);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(' + l.c + ',' + l.a + ')');
      g.addColorStop(1, 'rgba(' + l.c + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  const count = Math.round(look.particles * CITIES.thumbParticles);
  if (weather === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let k = 0; k < count; k++) {
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, (0.8 + Math.random() * 1.4) * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (weather === 'rain') {
    ctx.strokeStyle = 'rgba(200,215,235,.5)';
    ctx.lineWidth = dpr;
    ctx.beginPath();
    for (let k = 0; k < count; k++) {
      const x = Math.random() * (w + 20), y = Math.random() * h, l = (7 + Math.random() * 5) * dpr;
      ctx.moveTo(x, y);
      ctx.lineTo(x - l * 0.25, y + l);
    }
    ctx.stroke();
  }
}

function show(target, nameEl, city) {
  const thumb = buildThumb(city);
  waiting = thumb ? null : [target, nameEl, city];
  const ctx = target.getContext('2d');
  target.width = thumb ? thumb.width : 1;
  target.height = thumb ? thumb.height : 1;
  if (thumb) ctx.drawImage(thumb, 0, 0);
  nameEl.textContent = THEMES[city] ? THEMES[city].name : '';
  shown = city;
}

// المدينة الظاهرة الآن في الصورة المصغرة (في "عشوائي": آخر مدينة تبدلت إليها)
export const shownCity = () => shown;

// city: مفتاح مدينة أو 'random' (تتبدل المدن ما دامت القائمة ظاهرة)
export function updateCityThumb(target, nameEl, city, isVisible) {
  clearInterval(timer);
  timer = 0;
  if (city !== 'random') { show(target, nameEl, city); return; }
  let k = Math.max(0, CITIES.order.indexOf(shown));
  const next = () => {
    if (!isVisible()) { clearInterval(timer); timer = 0; return; }
    k = (k + 1) % CITIES.order.length;
    show(target, nameEl, CITIES.order[k]);
    nameEl.textContent = 'عشوائي — ' + nameEl.textContent;
  };
  next();
  timer = setInterval(next, CITIES.thumbCycleMs);
}

// صورة خانة المدينة في لوحة الاختيار (picker.js): وسط الصورة المصغرة نفسها مكبّراً قليلاً (CITIES.cardZoom)
// ومقصوصاً بشكل الخانة. الجاهزة تُرسم فوراً، والجديدة واحدة في كل إطار حتى لا تتجمد اللوحة
// عند فتح منطقة بمدن كثيرة (تُبنى مرة لكل مدينة وتبقى للمعاينة الكبيرة أيضاً).
// weather: صورة المدينة بطقس آخر (خانات لوحة الطقس)
const cardQueue = [];
let pumping = false;

export function drawCardThumb(canvas, city, weather = 'day') {
  // آخر صورة طُلبت لهذه اللوحة (معاينة لوحة الطقس تتبدل): الطلبات الأقدم المنتظرة لا ترسم فوقها
  canvas.thumbWant = thumbKey(city, weather);
  const ready = thumbs.get(canvas.thumbWant);
  if (ready) { fillCard(canvas, ready); return; }
  cardQueue.push([canvas, city, weather]);
  if (!pumping) { pumping = true; requestAnimationFrame(pumpCards); }
}

// اللوحة ستُرسم بشيء آخر (أيقونة "عشوائي" في معاينة الطقس): صورها المنتظرة لا تُرسم فوقها
export function stopCard(canvas) {
  canvas.thumbWant = '';
}

function pumpCards() {
  while (cardQueue.length) {
    const [canvas, city, weather] = cardQueue.shift();
    // أُعيد رسم الخانات أو أُغلقت اللوحة، أو طُلبت للوحة صورة أحدث
    if (!canvas.isConnected || canvas.thumbWant !== thumbKey(city, weather)) continue;
    const thumb = buildThumb(city, weather);
    if (thumb) fillCard(canvas, thumb);
    else cardWaiting.push([canvas, city, weather]);   // صور مباني المدينة لم تُحمّل بعد (اليمامة)
    break;
  }
  if (cardQueue.length) requestAnimationFrame(pumpCards);
  else pumping = false;
}

function fillCard(canvas, thumb) {
  const box = canvas.getBoundingClientRect();
  const aspect = box.width > 0 && box.height > 0 ? box.width / box.height : 2.9;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round((box.width || 180) * dpr));
  canvas.height = Math.max(1, Math.round(canvas.width / aspect));
  const sw = Math.min(thumb.width / CITIES.cardZoom, thumb.height * aspect), sh = sw / aspect;
  canvas.getContext('2d').drawImage(thumb, (thumb.width - sw) / 2, (thumb.height - sh) / 2, sw, sh,
    0, 0, canvas.width, canvas.height);
}
