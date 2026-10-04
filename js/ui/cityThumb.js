// الصورة المصغرة الحية للمدينة في قائمة الإعداد (القسم 3.9): خريطة صغيرة حقيقية من مولّد الخريطة
// تُرسم بنفس دوال المدينة، مرة واحدة لكل مدينة، وفي "عشوائي" تتبدل المدن كل ثانيتين
import { CITIES, TILE_HALF_W, TILE_HALF_H, PLAYER_COLORS } from '../config.js';
import { createMap } from '../map/generator.js';
import { drawWholeMap } from '../render/chunkCache.js';
import { THEMES } from '../render/cityThemes.js';

const thumbs = new Map();     // مدينة -> لوحة جاهزة
let timer = 0, shown = '';

const THUMB = { w: 260, h: 130, tiles: 'small' };

function buildThumb(city) {
  if (thumbs.has(city)) return thumbs.get(city);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = THUMB.w * dpr;
  canvas.height = THUMB.h * dpr;
  const players = [0, 1].map(k => ({ name: '', gang: 'crows', color: PLAYER_COLORS[k].id, isHuman: false, team: 0 }));
  const map = createMap(THUMB.tiles, players, city);
  if (!map) return null;
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
