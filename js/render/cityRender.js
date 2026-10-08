// رسم المدينة بطابعها (القسم 3.9): لون الأرض ومحتوى كل مربع (مبنى، أطلال، زينة، حطام)
// الشكل فقط: مكان المباني والشوارع والأحياء يقرره مولّد الخريطة كما هو.
import { CAPTURE, CITY_UNTINTED, CITIES } from '../config.js';
import { mix } from './colors.js';
import { tintAmount } from '../game/capture.js';
import { THEMES, setThemeContext, setTone, getCtx, streetDebris, ruinTile, hsh, mixc } from './cityThemes.js';
import { PALETTES } from './colors.js';
import { drawLandmark } from './landmarks.js';

export const cityOf = (map) => THEMES[map.city] || THEMES.arab;

// قبل رسم أي شيء من المدينة: سياق الرسم وبذرة الخريطة (العشوائية حتمية: نفس الشكل دائماً)
export function beginCity(ctx, map) {
  setThemeContext(ctx, map.seed || 0);
  setTone(null);
}

// أرض الحي المميز وحي الشرطة تميل قليلاً لألوانهما القديمة حتى تُعرف من بعيد
const REGION_HINT = { police: ['#6f7b8a', 0.35], special: ['#bba565', 0.22] };

// لون أرضية المربع: طابع المدينة، ثم صبغ المالك، ثم الطقس
export function groundColor(state, i, j) {
  const map = state.map, T = cityOf(map);
  const k = map.idx(i, j);
  const isRoad = map.road[k] === 1;
  let color;
  if (map.type[k] === '~') {
    // ماء المضيق (النرويجية): لا يُصبغ، والثلج يجمّده قليلاً
    color = T.waterCol || '#34566e';
    return state.weather === 'snow' ? mix(color, '#dfe8ee', 0.3) : color;
  }
  if (isRoad) color = (i + j) % 2 ? T.road : T.road2;
  else if (map.type[k] === 'P') color = T.plaza;
  else {
    color = T.ground;
    if (T.groundAt) color = T.groundAt(i, j, color);
    else if (hsh(i, j, 200) < 0.3) color = mixc(color, '#5a5040', 0.12);
    const hint = REGION_HINT[map.region[k]];
    if (hint) color = mix(color, hint[0], hint[1]);
    const district = map.districtOf(i, j);
    const amount = tintAmount(district, CAPTURE.groundTintAlpha);
    if (amount > 0) color = mix(color, district.tintColor, amount);
  }
  if (state.weather === 'snow') color = mix(color, '#eef2f5', isRoad ? 0.45 : 0.72);
  else if (state.weather === 'rain') color = mix(color, '#2a2f36', 0.2);
  return color;
}

// زينة الشارع المرسومة على الأرض نفسها (حجارة أوروبا، الشقوق)
export function drawRoadSurface(ctx, map, i, j, x, y) {
  const T = cityOf(map);
  if (T.draw.tile) T.draw.tile(x, y, i, j);
  if (hsh(i, j, 201) < 0.35) {
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 1); ctx.lineTo(x - 3, y + 1.5); ctx.lineTo(x + 1, y); ctx.lineTo(x + 6, y + 2.5);
    ctx.strokeStyle = 'rgba(20,16,12,0.35)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

// --- صبغ المباني بلون مالك الحي (القسم 8) والطقس: الأسطح 45% والجدران 20% ---
// المباني الحاسمة تُصبغ أيضاً، أما علاماتها فلا (landmarks.js)
export function useTone(state, district, building) {
  const weather = state.weather;
  const amount = building ? tintAmount(district, 1) : 0;
  const color = amount > 0 ? district.tintColor : null;
  if (!color && weather !== 'snow') { setTone(null); return; }
  setTone((c, roof) => {
    if (color) c = mix(c, color, (roof ? CAPTURE.roofTintAlpha : CAPTURE.wallTintAlpha) * amount);
    if (weather === 'snow') c = mix(c, '#eef2f5', roof ? 0.6 : building ? 0 : 0.3);
    return c;
  });
}

// محتوى مربع عادي: الشوارع (زينة وحطام لا يعيقان الحركة)، الأرض الفارغة، الأطلال، المباني والأشجار.
// يعيد false إن كان المربع من المباني الحاسمة للعب (تُرسم في landmarks.js)
export function drawCityTile(state, i, j, x, y) {
  const map = state.map;
  const T = cityOf(map);
  const k = map.idx(i, j);
  if (map.road[k] || map.type[k] !== 'H') useTone(state, null, false);   // الحطام والأطلال لا تُصبغ
  if (map.road[k]) {
    if (T.draw.roadProp) T.draw.roadProp(x, y, i, j);
    streetDebris(x, y, i, j, T);
    return true;
  }
  const type = map.type[k];
  if (type === '.') {
    if (hsh(i, j, 210) < 0.4) streetDebris(x, y, i, j + 99, T);
    return true;
  }
  if (type === 'R') { ruinTile(x, y, i, j, T); return true; }
  if (type === '~') { if (T.draw.water) T.draw.water(x, y, i, j); return true; }
  if (type === 'H') {
    let kind = map.kind[k];
    if (!kind || typeof T.draw[kind] !== 'function') kind = firstBuilding(T);
    useTone(state, map.districtOf(i, j), !CITY_UNTINTED.includes(kind));
    // المدن المزدحمة: المبنى أصغر قليلاً حول قاعدته فتظهر الأرض بينه وبين جيرانه
    const open = CITIES.open[map.city];
    if (open && open.scale !== 1) {
      const ctx = getCtx();
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(open.scale, open.scale);
      T.draw[kind](0, 0, i, j, T);
      ctx.restore();
    } else T.draw[kind](x, y, i, j, T);
    return true;
  }
  return false;
}

// أول نوع مبنى في pool المدينة (للمربعات المردومة بلا نوع، مثل إصلاح الفراغات)
function firstBuilding(T) {
  for (const [kind] of T.pool) if (kind !== '.' && kind !== 'ruin' && typeof T.draw[kind] === 'function') return kind;
  return Object.keys(T.draw).find(key => typeof T.draw[key] === 'function');
}

// برميل نار من حطام الشارع أو الأرض الفارغة: يُضيء ليلاً (نفس شروط drawCityTile وstreetDebris)
export function debrisLight(map, i, j) {
  const k = map.idx(i, j);
  let r;
  if (map.road[k]) r = hsh(i, j, 20);
  else if (map.type[k] === '.' && hsh(i, j, 210) < 0.4) r = hsh(i, j + 99, 20);
  else return false;
  return r >= 0.07 && r < 0.12;
}

// --- الطبقة الثابتة لمربع واحد: كل ما لا يتحرك (يُرسم مرة واحدة في القطع المخزنة) ---
// lights: مصادر الإضاءة الثابتة ليلاً، lamps: نقاط المصابيح الوامضة (تُرسم كل إطار)
const SPECIAL_TYPES = 'QNSGCOP';

export function specialType(state, k) {
  if (state.mode === 'king' && hillLandmarkTile(state) === k) return 'L';
  const type = state.map.type[k];
  return SPECIAL_TYPES.includes(type) ? type : null;
}

export function drawTileStatic(state, i, j, x, y, lights, lamps) {
  const map = state.map;
  const k = map.idx(i, j);
  const special = specialType(state, k);
  if (!special) {
    drawCityTile(state, i, j, x, y);
    if (lights && debrisLight(map, i, j)) lights.push({ x, y: y - 7, r: 34, c: '255,150,60', a: 0.65 });
    return;
  }
  // المباني الحاسمة بطراز المدينة: المبنى يُصبغ بلون المالك، وعلاماته لا
  const district = map.districtOf(i, j);
  const ownerColor = district && district.owner !== null ? state.players[district.owner].color : null;
  const flagColor = (PALETTES[map.region[k]] || PALETTES.neutral).flag;
  useTone(state, district, true);
  const lamp = drawLandmark(map, special, x, y, i, j, ownerColor, flagColor, lights);
  if (lamp && lamps) lamps.push(lamp);
}

// معلم التلة في طور ملك الحي: أقرب مبنى لمركز حي التلة (يُحسب مرة واحدة)
function hillLandmarkTile(state) {
  const ms = state.modeState;
  if (ms.hillTile !== undefined) return ms.hillTile;
  const map = state.map, hill = map.districts[ms.hillId];
  let best = -1, bestD = Infinity;
  if (hill) {
    for (const [i, j] of hill.tiles) {
      const k = map.idx(i, j);
      if (map.type[k] !== 'H' && map.type[k] !== 'R') continue;
      const d = Math.hypot(i - hill.cx, j - hill.cy);
      if (d < bestD) { bestD = d; best = k; }
    }
  }
  ms.hillTile = best;
  return best;
}
