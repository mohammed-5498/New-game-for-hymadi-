// الصورة المصغرة الحية للمدينة في قائمة الإعداد (القسم 3.9): خريطة صغيرة حقيقية من مولّد الخريطة
// تُرسم بنفس دوال المدينة، مرة واحدة لكل مدينة، وفي "عشوائي" تتبدل المدن كل ثانيتين
import { CITIES, TILE_HALF_W, TILE_HALF_H, PLAYER_COLORS } from '../config.js';
import { createMap } from '../map/generator.js';
import { drawWholeMap } from '../render/chunkCache.js';
import { THEMES } from '../render/cityThemes.js';
import { cityReady } from '../render/cityRender.js';
import { onSpritesReady } from '../render/sprites.js';

const thumbs = new Map();     // مدينة -> لوحة جاهزة
let timer = 0, shown = '';
let waiting = null;           // صورة مصغرة طُلبت قبل تحميل صور مبانيها: تُرسم حين تكتمل
const cardWaiting = [];       // خانات لوحة الاختيار التي تنتظر صور مباني مدينتها
onSpritesReady(() => {
  if (waiting) { const w = waiting; waiting = null; show(...w); }
  for (const job of cardWaiting.splice(0)) drawCardThumb(...job);
});

const THUMB = { w: 260, h: 130, tiles: 'small' };

function buildThumb(city) {
  if (thumbs.has(city)) return thumbs.get(city);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = THUMB.w * dpr;
  canvas.height = THUMB.h * dpr;
  const players = [0, 1].map(k => ({ name: '', gang: 'crows', color: PLAYER_COLORS[k].id, isHuman: false, team: 0 }));
  const map = createMap(THUMB.tiles, players, city);
  if (!map || !cityReady(map)) return null;
  // حيّان منزليان ملوّنان بلونين، حتى يظهر تلوين المالك أيضاً
  const colors = [PLAYER_COLORS[0].hex, PLAYER_COLORS[1].hex];
  for (const d of map.districts) if (d.owner !== null) { d.tintColor = colors[d.owner]; d.tintMix = 1; }
  const state = { map, weather: 'day', mode: 'conquest', modeState: {}, players: colors.map(color => ({ color })) };
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2a2622';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // الخريطة كلها داخل الصورة: عرضها n×36 وارتفاعها n×18 تقريباً (مع المباني)
  const n = map.n;
  const worldW = n * 2 * TILE_HALF_W, worldH = n * 2 * TILE_HALF_H + 60;
  const s = Math.min(canvas.width / worldW, canvas.height / worldH) * CITIES.thumbZoom;   // أقرب قليلاً: تفاصيل أوضح
  ctx.setTransform(s, 0, 0, s, canvas.width / 2, (canvas.height - n * 2 * TILE_HALF_H * s) / 2 + 40 * s);
  drawWholeMap(ctx, state);
  thumbs.set(city, canvas);
  return canvas;
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
// عند فتح منطقة بمدن كثيرة (تُبنى مرة لكل مدينة وتبقى للمعاينة الكبيرة أيضاً)
const cardQueue = [];
let pumping = false;

export function drawCardThumb(canvas, city) {
  const ready = thumbs.get(city);
  if (ready) { fillCard(canvas, ready); return; }
  cardQueue.push([canvas, city]);
  if (!pumping) { pumping = true; requestAnimationFrame(pumpCards); }
}

function pumpCards() {
  while (cardQueue.length) {
    const [canvas, city] = cardQueue.shift();
    if (!canvas.isConnected) continue;          // أُعيد رسم الخانات أو أُغلقت اللوحة
    const thumb = thumbs.get(city) || buildThumb(city);
    if (thumb) fillCard(canvas, thumb);
    else cardWaiting.push([canvas, city]);      // صور مباني المدينة لم تُحمّل بعد (اليمامة)
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
