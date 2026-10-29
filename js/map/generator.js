// توليد الخريطة العشوائية: شوارع، أحياء، نقاط استيلاء، مباني
import { MAP_SIZES, MAP_GEN, POLICE, CITIES, CITY_UNTINTED, CITY_FEATURES } from '../config.js';
import { THEMES as CITY_THEMES } from '../render/cityThemes.js';
import { D4, D8 } from './pathfinding.js';
import { hypot } from '../game/hypot.js';

const rnd = () => Math.random();
const ri = (n) => Math.floor(Math.random() * n);

// المباني الخاصة بكل حي مميز
const SPECIAL_BUILDINGS = {
  hospital: ['S'],        // مستشفى مهجور
  armory:   ['G'],        // مخزن السلاح
  clock:    ['C', 'O']    // برج الساعة + نافورة
};

export const SPECIAL_NAMES = {
  hospital: 'المستشفى',
  armory: 'مخزن السلاح',
  clock: 'برج الساعة'
};

function pickWeighted(table) {
  let total = 0;
  for (const [, w] of table) total += w;
  let r = rnd() * total;
  for (const [key, w] of table) {
    r -= w;
    if (r <= 0) return key;
  }
  return table[0][0];
}

// ينشئ خريطة صالحة، ويعيد المحاولة إذا فشل الشرط (شوارع متصلة، أحياء منزلية كافية)
// city: مفتاح طابع المدينة (القسم 3.9)، أو 'random'. المدينة شكل فقط: الشوارع والأحياء كما هي
export function resolveCity(city) {
  return CITY_THEMES[city] ? city : CITIES.order[ri(CITIES.order.length)];
}

// options.specials: false بلا أحياء مميزة (طور الإمبراطورية: مبانيه تُبنى بالنقاط)
// options.features: مزايا المدن (القسم 3.11) في مباراة على الاقتصاد
export function createMap(sizeKey, players, city = 'random', options = {}) {
  const size = MAP_SIZES[sizeKey] || MAP_SIZES.medium;
  const cityKey = resolveCity(city);
  for (let attempt = 0; attempt < MAP_GEN.maxTries; attempt++) {
    const map = buildMap(size, players, cityKey, options);
    if (map) return map;
  }
  return null;
}

function buildMap(size, players, cityKey, options) {
  const map = createEmptyMap(size);
  map.city = cityKey;
  map.seed = ri(1e9);                // بذرة الرسم: نفس الخريطة تُرسم دائماً بنفس الشكل
  // ماء على حافة الخريطة (النرويجية): خارج الشوارع والأحياء، فلا علم ولا مقر ولا تلة عليه
  const water = (CITIES.water[cityKey] || {})[size.key] || 0;
  map.land = map.n - water;          // أول عمود ماء (i >= land)
  for (let j = 0; j < map.n; j++) for (let i = map.land; i < map.n; i++) map.type[map.idx(i, j)] = '~';
  carveStreets(map);
  if (!roadsConnected(map)) return null;          // شرط إلزامي: الشوارع كلها متصلة

  const districts = findDistricts(map);
  if (!assignHomeDistricts(map, districts, players)) return null;
  if (options.specials !== false) assignSpecialDistricts(map, districts, size, players);
  assignPoliceDistricts(map, districts, size);
  if (options.features) assignFeatures(map, districts, size);
  fillDistricts(map, districts);
  map.districts = districts;
  const walls = CITIES.walls[cityKey];
  if (walls) buildCityWalls(map, walls);
  if (map.land < map.n && CITIES.water[cityKey].huts) placeRorbu(map);   // أكواخ الماء للنرويجية وحدها
  repairIsolatedPockets(map);     // القسم 3.4.1: لا يبقى فراغ محاصر بالمباني
  decorateRoads(map);
  placeMonument(map);
  return map;
}

// معلم المنطقة المميز (بطلب المستخدم): يحل محل مبنى عادي قرب وسط المدينة، فلا يتغير ما يُمشى عليه
// (كان مبنى ويبقى مبنى) ولا يُستهلك رقم عشوائي، فبقية الخريطة والمباراة كما هما. يُفضَّل الركن الأمامي
// للحي (شارعان أمامه من الجهتين القريبتين من الشاشة) فلا يحجبه مبنى أمامه، ثم ما أمامه شارع من جهة،
// ثم ما يلاصق شارعاً. المدن ذات الدوار (CITIES.open[city].roundabout) لا تحتاجه: الدوار معلمها
function placeMonument(map) {
  const city = CITY_THEMES[map.city], open = CITIES.open[map.city];
  if (!city || typeof city.draw.monument !== 'function' || (open && open.roundabout)) return;
  const n = map.n, ci = (map.land - 1) / 2, cj = (n - 1) / 2;
  const road = (i, j) => map.inBounds(i, j) && map.road[map.idx(i, j)] === 1;
  let best = -1, bestScore = Infinity;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < map.land; i++) {
      const k = map.idx(i, j), kind = map.kind[k];
      if (map.type[k] !== 'H' || !kind || CITY_UNTINTED.includes(kind)) continue;   // مبنى عادي لا شجرة ولا سور
      const front = (road(i + 1, j) ? 1 : 0) + (road(i, j + 1) ? 1 : 0);
      if (!front && !road(i - 1, j) && !road(i, j - 1)) continue;
      const score = (2 - front) * 1e6 + (i - ci) * (i - ci) + (j - cj) * (j - cj);
      if (score < bestScore) { bestScore = score; best = k; }
    }
  }
  if (best >= 0) map.kind[best] = 'monument';
}

// دوال الخريطة: منفصلة عن بياناتها حتى تُعاد إليها بعد تحميل مباراة محفوظة
const MAP_METHODS = {
  idx(i, j) { return j * this.n + i; },
  inBounds(i, j) { return i >= 0 && j >= 0 && i < this.n && j < this.n; },
  // الوحدات تمشي على الشوارع والأرض الفارغة وساحات العلم فقط
  isWalkable(i, j) {
    if (!this.inBounds(i, j)) return false;
    const k = this.idx(i, j);
    return this.road[k] === 1 || this.type[k] === '.' || this.type[k] === 'P';
  },
  // مربع موصول بشبكة الشوارع: الظهور وأوامر الحركة لا تستهدف غيره
  isConnected(i, j) {
    if (!this.isWalkable(i, j)) return false;
    return !this.connected || this.connected[this.idx(i, j)] === 1;
  },
  districtOf(i, j) {
    if (!this.inBounds(i, j)) return null;
    const d = this.districtAt[this.idx(i, j)];
    return d < 0 ? null : this.districts[d];
  }
};

export function attachMapMethods(map) {
  return Object.assign(map, MAP_METHODS);
}

function createEmptyMap(size) {
  const n = size.n;
  return attachMapMethods({
    size,
    n,
    road: new Uint8Array(n * n),
    type: new Array(n * n).fill('.'),
    region: new Array(n * n).fill('neutral'),
    kind: new Array(n * n).fill(null),   // نوع المبنى من pool المدينة ('house', 'ruin', 'palm'...)
    dash: new Uint8Array(n * n),      // خطوط منتصف الشارع
    decor: {},                        // زينة فوق الشوارع (برميل نار، عمود إنارة)
    districtAt: new Int32Array(n * n).fill(-1),
    districts: [],
    connected: null                   // يملؤه إصلاح الفراغات المعزولة (القسم 3.4.1)
  });
}

// --- 1) الشوارع ---
function carveStreets(map) {
  const n = map.n, land = map.land;
  // المدن المفتوحة (CITIES.open): شوارع أعرض ومستقيمة بلا انحراف ولا أزقة، فالأحياء مستطيلات مرتبة
  const open = CITIES.open[map.city];
  if (open) { carveWideStreets(map, open); return; }
  const spacing = () => MAP_GEN.streetSpacingMin + ri(MAP_GEN.streetSpacingMax - MAP_GEN.streetSpacingMin + 1);
  const lines = (limit) => {
    const arr = [];
    let p = 1 + ri(2);
    while (p < limit - 1) { arr.push(p); p += spacing(); }
    return arr;
  };

  const cols = lines(land), rows = lines(n);
  const near = (arr, v) => arr.some(a => Math.abs(a - v) <= 1);

  // شوارع طولية مع انحراف بسيط بعيداً عن التقاطعات
  for (const c of cols) {
    let cc = c;
    for (let j = 0; j < n; j++) {
      if (!near(rows, j) && rnd() < MAP_GEN.bendChance) {
        map.road[map.idx(cc, j)] = 1;
        cc = Math.max(1, Math.min(land - 2, cc + (rnd() < 0.5 ? -1 : 1)));
      }
      map.road[map.idx(cc, j)] = 1;
    }
  }
  // شوارع عرضية
  for (const r of rows) {
    let rr = r;
    for (let i = 0; i < land; i++) {
      if (!near(cols, i) && rnd() < MAP_GEN.bendChance) {
        map.road[map.idx(i, rr)] = 1;
        rr = Math.max(1, Math.min(n - 2, rr + (rnd() < 0.5 ? -1 : 1)));
      }
      map.road[map.idx(i, rr)] = 1;
    }
  }

  // أزقة قصيرة تخرج من الشوارع (عددها يتناسب مع مساحة الخريطة)
  const alleys = Math.round(MAP_GEN.alleysPerSmallMap * (n * n) / (26 * 26));
  for (let k = 0; k < alleys; k++) {
    const i = ri(n), j = ri(n);
    if (!map.road[map.idx(i, j)]) continue;
    const d = D4[ri(4)];
    for (let s = 1; s <= MAP_GEN.alleyLength; s++) {
      const a = i + d[0] * s, b = j + d[1] * s;
      if (map.inBounds(a, b) && a < land) map.road[map.idx(a, b)] = 1;
    }
  }
}

// شبكة شوارع مستقيمة بعرض open.street، والمسافة بين بدايتي شارعين إحدى قيم open.spacing
function carveWideStreets(map, open) {
  const n = map.n, land = map.land, w = open.street;
  const lines = (limit) => {
    const arr = [];
    let p = 1 + ri(2);
    while (p + w <= limit - 1) { arr.push(p); p += open.spacing[ri(open.spacing.length)]; }
    return arr;
  };
  const cols = lines(land), rows = lines(n);
  for (const c of cols) for (let j = 0; j < n; j++) for (let d = 0; d < w; d++) map.road[map.idx(c + d, j)] = 1;
  for (const r of rows) for (let i = 0; i < land; i++) for (let d = 0; d < w; d++) map.road[map.idx(i, r + d)] = 1;
  if (open.roundabout && cols.length && rows.length) carveRoundabout(map, cols, rows, w, open.roundabout.radius);
}

// دوار في التقاطع الأقرب لمركز الخريطة: جزيرة في وسط التقاطع ('Y': لا يُمشى عليها ولا تُفتح)
// وحولها حلقة شارع حتى نصف القطر radius، تأخذ زوايا الأحياء الأربعة المجاورة
function carveRoundabout(map, cols, rows, w, radius) {
  const mid = (map.n - 1) / 2, half = (w - 1) / 2;
  const nearest = (arr) => arr.reduce((a, b) => Math.abs(b + half - mid) < Math.abs(a + half - mid) ? b : a);
  const c = nearest(cols), r = nearest(rows), ci = c + half, cj = r + half;
  const reach = Math.ceil(radius);
  for (let j = Math.floor(cj - reach); j <= Math.ceil(cj + reach); j++) {
    for (let i = Math.floor(ci - reach); i <= Math.ceil(ci + reach); i++) {
      if (!map.inBounds(i, j)) continue;
      const di = i - ci, dj = j - cj, k = map.idx(i, j);
      if (Math.abs(di) < w / 2 && Math.abs(dj) < w / 2) { map.road[k] = 0; map.type[k] = 'Y'; }
      else if (di * di + dj * dj <= radius * radius) map.road[k] = 1;
    }
  }
}

// شرط إلزامي: كل مربعات الشوارع متصلة ببعضها
function roadsConnected(map) {
  const n = map.n;
  let total = 0, startIndex = -1;
  for (let k = 0; k < n * n; k++) {
    if (map.road[k]) { total++; if (startIndex < 0) startIndex = k; }
  }
  if (total === 0) return false;

  const seen = new Uint8Array(n * n);
  const stack = [startIndex];
  seen[startIndex] = 1;
  let reached = 0;

  while (stack.length) {
    const k = stack.pop();
    reached++;
    const i = k % n, j = (k - i) / n;
    for (const [dx, dy] of D4) {
      const a = i + dx, b = j + dy;
      if (!map.inBounds(a, b)) continue;
      const nk = map.idx(a, b);
      if (map.road[nk] && !seen[nk]) { seen[nk] = 1; stack.push(nk); }
    }
  }
  return reached === total;
}

// --- 2) الأحياء: تجميع المربعات غير الشارعية المتصلة ---
function findDistricts(map) {
  const n = map.n;
  const districts = [];

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = map.idx(i, j);
      if (map.road[k] || map.districtAt[k] >= 0 || map.type[k] === '~' || map.type[k] === 'Y') continue;

      const district = {
        id: districts.length,
        tiles: [],
        cx: 0, cy: 0,
        region: 'neutral',
        capturable: false,
        capture: null,      // نقطة الاستيلاء {i, j}
        isHome: false,
        special: null,      // hospital | armory | clock
        feature: null,      // ميزة المدينة في هذا الحي (القسم 3.11): pyramid | village
        police: false,      // حي فيه مركز شرطة (القسم 3.8)
        policeDisabled: false,  // توقف إنتاج الشرطة نهائياً بعد أول استيلاء
        owner: null,        // رقم اللاعب المالك
        progress: 0,        // تقدم الاستيلاء (المرحلة 3)
        progressOwner: null,
        tintColor: null,    // لون الصبغ الحالي (القسم 8)
        tintMix: 0,         // تقدم الانتقال اللوني من 0 إلى 1
        tickAt: -99         // زمن آخر نبضة استيلاء مسموعة
      };
      map.districtAt[k] = district.id;
      const stack = [[i, j]];

      while (stack.length) {
        const [a, b] = stack.pop();
        district.tiles.push([a, b]);
        for (const [dx, dy] of D4) {
          const x = a + dx, y = b + dy;
          if (!map.inBounds(x, y)) continue;
          const nk = map.idx(x, y);
          if (map.road[nk] || map.districtAt[nk] >= 0 || map.type[nk] === '~' || map.type[nk] === 'Y') continue;
          map.districtAt[nk] = district.id;
          stack.push([x, y]);
        }
      }

      district.cx = district.tiles.reduce((s, t) => s + t[0], 0) / district.tiles.length;
      district.cy = district.tiles.reduce((s, t) => s + t[1], 0) / district.tiles.length;
      district.capturable = district.tiles.length >= MAP_GEN.minDistrictTiles;
      districts.push(district);
    }
  }
  return districts;
}

// --- 3) الأحياء المنزلية: نقاط موزعة بالتساوي على دائرة حول المركز ---
function assignHomeDistricts(map, districts, players) {
  const n = map.n;
  const center = (n - 1) / 2;
  const radius = n * MAP_GEN.homeRingRadiusPct;
  const big = districts.filter(d => d.tiles.length >= MAP_GEN.minHomeDistrictTiles);
  if (big.length < players.length) return false;

  // اللاعبون في نفس الفريق يأخذون نقاطاً متجاورة على الدائرة
  const order = players.map((p, index) => index)
    .sort((a, b) => (players[a].team || 99) - (players[b].team || 99));

  for (let slot = 0; slot < order.length; slot++) {
    const k = order[slot];
    const angle = -Math.PI / 2 + (2 * Math.PI * slot) / players.length;
    const px = center + Math.cos(angle) * radius;
    const py = center + Math.sin(angle) * radius;

    let best = null, bestDist = Infinity;
    for (const d of big) {
      if (d.isHome) continue;
      const dist = hypot(d.cx - px, d.cy - py);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    if (!best) return false;

    best.isHome = true;
    best.region = players[k].gang;
    best.owner = k;                 // كل لاعب يملك حيه المنزلي من البداية
    best.progress = 100;
    best.progressOwner = k;
    players[k].homeDistrictId = best.id;
  }
  return true;
}

// --- 4) الأحياء المميزة قرب مركز الخريطة ---
function assignSpecialDistricts(map, districts, size) {
  const n = map.n;
  const center = (n - 1) / 2;
  const limit = n * MAP_GEN.specialCenterRadiusPct;

  const candidates = districts
    .filter(d => !d.isHome && d.capturable && hypot(d.cx - center, d.cy - center) < limit)
    .sort(() => rnd() - 0.5);

  const types = ['hospital', 'armory', 'clock'].sort(() => rnd() - 0.5);
  const count = Math.min(size.specialDistricts, candidates.length);

  for (let k = 0; k < count; k++) {
    const d = candidates[k];
    d.region = 'special';
    // لا يتكرر النوع إلا إذا زاد العدد على 3
    d.special = types[k % types.length];
  }
}

// --- 4ب) مراكز الشرطة: أحياء محايدة موزعة وبعيدة عن الأحياء المنزلية ---
function assignPoliceDistricts(map, districts, size) {
  const homes = districts.filter(d => d.isHome);
  const farFromHomes = (d) => homes.every(h =>
    hypot(d.cx - h.cx, d.cy - h.cy) >= POLICE.minHomeDistance);

  const candidates = districts.filter(d =>
    !d.isHome && !d.special && d.capturable && farFromHomes(d));
  if (!candidates.length) return;

  // موزعة: بعد الأول نختار في كل مرة الأبعد عن المراكز المختارة
  const chosen = [candidates[ri(candidates.length)]];
  const count = Math.min(size.policeStations, candidates.length);

  while (chosen.length < count) {
    let best = null, bestDist = -1;
    for (const d of candidates) {
      if (chosen.includes(d)) continue;
      const nearest = Math.min(...chosen.map(c => hypot(d.cx - c.cx, d.cy - c.cy)));
      if (nearest > bestDist) { bestDist = nearest; best = d; }
    }
    if (!best) break;
    chosen.push(best);
  }

  for (const d of chosen) {
    d.police = true;
    d.region = 'police';      // أرض رمادية مزرقّة قبل الاستيلاء
  }
}

// --- 4ج) مزايا المدن (القسم 3.11): أحياؤها ليست منزلية ولا مراكز شرطة ---
// المبنى المميز (بطلب المستخدم: مساحة خاصة به وحجم أكبر): كتلة 2×2 وسط حيه، مرسومة كلها من مربعها الأمامي (F)
// والثلاثة الباقية f بلا رسم (لا يُمشى عليها)، وبقية الحي ساحة مرصوفة حوله يُمشى عليها (fplaza) إلا ساحة العلم.
// center: الأقرب لوسط المدينة (بلا رقم عشوائي)، spread: موزعة بعيدة عن الأحياء المنزلية (الأولى عشوائية ثم الأبعد)
const FEATURE_BUILDINGS = { pyramid: 'center', khartoum: 'center', dojo: 'center', clinic: 'spread', fortress: 'spread',
                            policeHQ: 'center', clock: 'center', complex: 'center', statue: 'center', mercs: 'spread',
                            souk: 'center' };
const DISTRICT_FEATURE = { pyramid: 'pyramid', villages: 'village', dojo: 'dojo', clinic: 'clinic', fortress: 'fortress',
                           khartoum: 'khartoum', policeHQ: 'policeHQ', clock: 'clock', cartel: 'complex', statue: 'statue',
                           mercs: 'mercs', souk: 'souk' };
const FEATURE_CONFIG = { village: 'villages', complex: 'cartel' };   // قسم الأرقام في CITY_FEATURES إن اختلف اسمه

function assignFeatures(map, districts, size) {
  const feature = DISTRICT_FEATURE[CITY_FEATURES.cities[map.city]];
  if (!feature) return;
  const cfg = CITY_FEATURES[FEATURE_CONFIG[feature] || feature];
  const homes = districts.filter(d => d.isHome);
  const far = (d) => !cfg.minHomeDistance || homes.every(h => hypot(d.cx - h.cx, d.cy - h.cy) >= cfg.minHomeDistance);
  const building = FEATURE_BUILDINGS[feature];
  const candidates = districts.filter(d => d.capturable && !d.isHome && !d.police && !d.special && far(d) &&
    (!building || (d.tiles.length >= CITY_FEATURES.blockTiles && hasBlock(map, d))));
  if (!candidates.length) return;
  const count = Math.min(cfg.count ? cfg.count[size.key] || 0 : 1, candidates.length);

  if (building === 'center') {
    const ci = (map.land - 1) / 2, cj = (map.n - 1) / 2;
    const order = candidates.slice().sort((a, b) => hypot(a.cx - ci, a.cy - cj) - hypot(b.cx - ci, b.cy - cj));
    for (const d of order.slice(0, count)) markFeature(d, feature);
    if (feature === 'complex' && order[0]) markCartel(districts, order[0], cfg.neighbors);
    return;
  }
  // موزعة: بعد الأولى نختار في كل مرة الأبعد عن المختارة (كمراكز الشرطة)
  const chosen = [candidates[ri(candidates.length)]];
  while (chosen.length < count) {
    let best = null, bestDist = -1;
    for (const d of candidates) {
      if (chosen.includes(d)) continue;
      const nearest = Math.min(...chosen.map(c => hypot(d.cx - c.cx, d.cy - c.cy)));
      if (nearest > bestDist) { bestDist = nearest; best = d; }
    }
    if (!best) break;
    chosen.push(best);
  }
  for (const d of chosen) markFeature(d, feature);
}

function markFeature(district, feature) {
  district.feature = feature;
  district.region = 'feature';    // أرض تميل للذهبي قبل الاستيلاء عليه (cityRender.js)
  // مركز الشرطة الرئيسي (روتنبورغ) مركز شرطة كغيره (police.js) ومبنى مميز معاً
  if (feature === 'policeHQ') { district.police = true; district.policeMain = true; }
}

// المجمع السكني (تينوتشتيتلان): أقرب count أحياء إليه أحياء العصابة معه
function markCartel(districts, complex, count) {
  const near = districts.filter(d => d !== complex && d.capturable && !d.isHome && !d.police && !d.special && !d.feature)
    .sort((a, b) => hypot(a.cx - complex.cx, a.cy - complex.cy) - hypot(b.cx - complex.cx, b.cy - complex.cy));
  for (const d of near.slice(0, count)) markFeature(d, 'cartel');
}

// هل في الحي كتلة 2×2 من مربعاته؟
function hasBlock(map, district) {
  const inD = (i, j) => map.inBounds(i, j) && map.districtAt[map.idx(i, j)] === district.id;
  return district.tiles.some(([i, j]) => inD(i + 1, j) && inD(i, j + 1) && inD(i + 1, j + 1));
}

// كتلة المبنى المميز الأقرب لمركز حيه بلا ساحة العلم، وبقية الحي ساحته. والحي الضيق: مبنى في مربع واحد كما كان
function placeFeatureBuilding(map, district, point, inner) {
  const inD = (i, j) => map.inBounds(i, j) && map.districtAt[map.idx(i, j)] === district.id;
  const isPoint = (i, j) => i === point[0] && j === point[1];
  let best = null, bestD = Infinity;
  for (const [i, j] of district.tiles) {
    const cells = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]];
    if (!cells.every(([a, b]) => inD(a, b) && !isPoint(a, b))) continue;
    const dist = hypot(i + 0.5 - district.cx, j + 0.5 - district.cy);
    if (dist < bestD) { bestD = dist; best = [i, j]; }
  }
  if (!best) {
    if (!inner[0]) return;
    district.featureTile = map.idx(inner[0][0], inner[0][1]);
    map.type[district.featureTile] = 'F';
    return;
  }
  const [i0, j0] = best;
  for (const [i, j] of district.tiles) {
    if (isPoint(i, j)) continue;
    const k = map.idx(i, j), block = i - i0 >= 0 && i - i0 <= 1 && j - j0 >= 0 && j - j0 <= 1;
    map.type[k] = block ? 'f' : '.';
    map.kind[k] = block ? null : 'fplaza';
  }
  district.featureTile = map.idx(i0 + 1, j0 + 1);   // المربع الأمامي: منه تُرسم الكتلة كلها
  map.type[district.featureTile] = 'F';
  district.featureBig = true;
}

// --- 5) ملء الأحياء بالمباني ونقاط الاستيلاء ---
// نوع المربع من pool المدينة: '.' أرض فارغة يُمشى عليها، 'ruin' أطلال، والباقي مبانٍ وأشجار لا يُمشى عليها
function placeKind(map, k, kind) {
  map.kind[k] = kind === '.' ? null : kind;
  map.type[k] = kind === '.' ? '.' : kind === 'ruin' ? 'R' : 'H';
}

// المدن المفتوحة: ممرات أرض مرصوفة بين صفوف المباني داخل الحي (المستطيل بين الشوارع)، موصولة بالشارع
// من طرفيها. الصفوف موازية لضلع الحي الأطول، والممر بينها:
// 'rows': كل مربع بعده عن أقرب طرف للحي فردي (الحي 3 ← صفان وممر، 4 ← صفان وممران، 5 ← ثلاثة صفوف)
// 'center': ممر واحد في وسط الحي (3 ← صفان، 5 ← صفان مزدوجان): أكثف
// 'lots': ممرات في الاتجاهين (كل مبنى في قطعته)
// يعيد اتجاه الممر للمربع ('lane_i' يمتد على i، 'lane_j' على j) أو null للمبنى
function laneMask(district, lanes) {
  let i0 = Infinity, i1 = -1, j0 = Infinity, j1 = -1;
  for (const [i, j] of district.tiles) {
    if (i < i0) i0 = i; if (i > i1) i1 = i;
    if (j < j0) j0 = j; if (j > j1) j1 = j;
  }
  const lane = (v, a, b) => {
    const u = v - a, w = b - a + 1;
    if (lanes !== 'center') return Math.min(u, b - v) % 2 === 1;
    return w % 2 ? w >= 3 && u === (w - 1) / 2 : w >= 4 && (u === w / 2 - 1 || u === w / 2);
  };
  if (lanes === 'lots') return (i, j) => lane(j, j0, j1) ? 'lane_i' : lane(i, i0, i1) ? 'lane_j' : null;
  return i1 - i0 >= j1 - j0 ? (i, j) => lane(j, j0, j1) ? 'lane_i' : null
                            : (i, j) => lane(i, i0, i1) ? 'lane_j' : null;
}

function fillDistricts(map, districts) {
  const city = CITY_THEMES[map.city];
  const open = CITIES.open[map.city];
  for (const district of districts) {
    const lane = open && open.lanes && district.capturable ? laneMask(district, open.lanes) : null;
    // أنماط الأحياء (صحراء اليمامة): الحي كله من نمط واحد (نجدي، قصور، واحة) فيبدو متجانساً
    const pool = city.styles && district.capturable ? pickWeighted(city.styles.map(style => [style, style.weight])).pool : city.pool;
    for (const [i, j] of district.tiles) {
      const k = map.idx(i, j);
      map.region[k] = district.region;
      const kind = pickWeighted(pool);
      const path = lane && lane(i, j);
      placeKind(map, k, path ? '.' : kind);
      if (path) map.kind[k] = path;            // أرض فارغة تُرسم ممراً مرصوفاً باتجاهه
    }

    // حي صغير: ليس قابلاً للاستيلاء، أشجار أو أرض فارغة فقط
    // (الأوروبية تعرّف شجرتها دالة رسم لا اسم نوع: نوعها 'tree'، وإلا رُسمت بيتاً)
    if (!district.capturable) {
      if (city.smallPool) {                    // بساتين وآبار (صحراء اليمامة)
        for (const [i, j] of district.tiles) placeKind(map, map.idx(i, j), pickWeighted(city.smallPool));
        continue;
      }
      const tree = typeof city.draw.tree === 'function' ? 'tree' : city.draw.tree;
      for (const [i, j] of district.tiles) {
        placeKind(map, map.idx(i, j), rnd() < 0.5 ? tree : '.');
      }
      continue;
    }

    // نقطة الاستيلاء: مربع ملاصق لشارع والأقرب لمركز الحي
    let point = null, bestDist = Infinity;
    for (const [i, j] of district.tiles) {
      const touchesRoad = D4.some(([dx, dy]) =>
        map.inBounds(i + dx, j + dy) && map.road[map.idx(i + dx, j + dy)]);
      if (!touchesRoad) continue;
      const dist = hypot(i - district.cx, j - district.cy);
      if (dist < bestDist) { bestDist = dist; point = [i, j]; }
    }
    if (!point) { district.capturable = false; continue; }

    map.type[map.idx(point[0], point[1])] = 'P';   // ساحة العلم
    district.capture = { i: point[0], j: point[1] };

    // المباني المميزة توضع في أقرب مربعات لمركز الحي
    const inner = district.tiles
      .filter(([i, j]) => !(i === point[0] && j === point[1]))
      .sort((a, b) =>
        hypot(a[0] - district.cx, a[1] - district.cy) -
        hypot(b[0] - district.cx, b[1] - district.cy));

    if (district.isHome && inner[0]) {
      map.type[map.idx(inner[0][0], inner[0][1])] = 'Q';   // مبنى المقر
    } else if (FEATURE_BUILDINGS[district.feature]) {
      placeFeatureBuilding(map, district, point, inner);   // مبنى ميزة المدينة وساحته (القسم 3.11)
    } else if (district.police && inner[0]) {
      map.type[map.idx(inner[0][0], inner[0][1])] = 'N';   // مركز الشرطة
    } else if (district.special) {
      SPECIAL_BUILDINGS[district.special].forEach((letter, index) => {
        const tile = inner[index];
        if (tile) map.type[map.idx(tile[0], tile[1])] = letter;
      });
    }
  }
}

// صحراء اليمامة: السور على مربعات حافة الخريطة (مبانٍ لا يُمشى عليها، وقبل إصلاح الفراغات فيُفتح منه ما يلزم)
// - الحافتان البعيدتان (i = 0 وj = 0): أقواس السور، وبرج كل towerEvery مربعاً، والأطلال فيه ثغرات منهارة،
//   وبوابة فوق كل شارع يخرج من الحافة (الشارع يبقى شارعاً: نوع البوابة على مربعه ويُمشى تحتها)
// - الحافتان القريبتان: سور منهار منخفض لا يحجب الجنود خلفه، والشوارع تخرج منه بلا بوابة
// - الزوايا أبراج (القريبة منهارة). ساحة العلم والمباني الحاسمة والشوارع على الحافة لا تُمس
function buildCityWalls(map, cfg) {
  const n = map.n, last = n - 1;
  const road = (i, j) => map.inBounds(i, j) && map.road[map.idx(i, j)] === 1;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (i !== 0 && j !== 0 && i !== last && j !== last) continue;
      const k = map.idx(i, j);
      const corner = (i === 0 || i === last) && (j === 0 || j === last);
      if (map.road[k]) {
        if (corner) continue;
        if (i === 0 && road(1, j) && !road(0, j - 1) && !road(0, j + 1)) map.kind[k] = 'gateJ';
        else if (j === 0 && road(i, 1) && !road(i - 1, 0) && !road(i + 1, 0)) map.kind[k] = 'gateI';
        // الحافتان القريبتان: قوس قديم قائم فوق بعض الشوارع الخارجة، والباقي ثغرة
        else if (rnd() < cfg.archChance) {
          if (i === last && road(i - 1, j) && !road(i, j - 1) && !road(i, j + 1)) map.kind[k] = 'archJ';
          else if (j === last && road(i, j - 1) && !road(i - 1, j) && !road(i + 1, j)) map.kind[k] = 'archI';
        }
        continue;
      }
      const type = map.type[k];
      if (type !== 'H' && type !== '.' && type !== 'R') continue;
      let kind;
      if (corner) kind = i === last && j === last ? 'brokenTower' : 'wallTower';
      else if (i === 0 || j === 0) {
        const along = i === 0 ? j : i;
        if (along % cfg.towerEvery === 0) kind = 'wallTower';
        else if (type === 'R') kind = i === 0 ? 'brokenJ' : 'brokenI';
        else kind = i === 0 ? 'wallJ' : 'wallI';
      } else kind = i === last ? 'brokenJ' : 'brokenI';
      map.type[k] = 'H';
      map.kind[k] = kind;
    }
  }
}

// النرويجية: المباني المجاورة للماء أكواخ على أعمدة (rorbu)، كما في hook المرجع
function placeRorbu(map) {
  const i = map.land - 1;
  for (let j = 0; j < map.n; j++) {
    const k = map.idx(i, j);
    if (map.type[k] === 'H' && rnd() < CITIES.rorbuChance) map.kind[k] = 'rorbu';
  }
}

// علامات الشارع العريض (حارتان)، ترسمها chunkCache.js:
// 3: خط المنتصف بين j و j+1 (شارع على i)، 4: بين i و i+1 (شارع على j)، ولا خط في التقاطعات
// 5: حلقة الدوار (بلا علامات ولا حطام)، 6 و7: ممر مشاة عند مدخل التقاطع (شارع على i / على j)
function wideDash(map, i, j) {
  const r = (a, b) => map.inBounds(a, b) && map.road[map.idx(a, b)] === 1;
  for (let b = j - 2; b <= j + 2; b++) for (let a = i - 2; a <= i + 2; a++) {
    if (map.inBounds(a, b) && map.type[map.idx(a, b)] === 'Y') return 5;
  }
  const roads = (a, b) => r(a - 1, b) + r(a + 1, b) + r(a, b - 1) + r(a, b + 1);
  const cross = (a, b) => r(a, b) && roads(a, b) === 4;      // مربع تقاطع: شارع من الجهات الأربع
  if (roads(i, j) === 3) {
    if (r(i - 1, j) && r(i + 1, j) && (cross(i - 1, j) || cross(i + 1, j))) return 6;
    if (r(i, j - 1) && r(i, j + 1) && (cross(i, j - 1) || cross(i, j + 1))) return 7;
  }
  if (r(i, j + 1) && !r(i, j - 1) && !r(i, j + 2) && r(i - 1, j) && r(i + 1, j)) return 3;
  if (r(i + 1, j) && !r(i - 1, j) && !r(i + 2, j) && r(i, j - 1) && r(i, j + 1)) return 4;
  return 0;
}

// --- 6) خطوط منتصف الشوارع وزينتها ---
function decorateRoads(map) {
  const n = map.n;
  const open = CITIES.open[map.city];
  const wide = open && open.street === 2;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = map.idx(i, j);
      if (!map.road[k]) continue;

      if (wide) map.dash[k] = wideDash(map, i, j);
      else {
        const horizontal = (map.inBounds(i - 1, j) && map.road[map.idx(i - 1, j)]) ||
                           (map.inBounds(i + 1, j) && map.road[map.idx(i + 1, j)]);
        const vertical   = (map.inBounds(i, j - 1) && map.road[map.idx(i, j - 1)]) ||
                           (map.inBounds(i, j + 1) && map.road[map.idx(i, j + 1)]);
        map.dash[k] = horizontal && !vertical ? 1 : vertical && !horizontal ? 2 : 0;
      }

      const q = rnd();
      if (q < 0.015) map.decor[k] = 'B';              // برميل نار
      else if (q < 0.05 && map.dash[k]) map.decor[k] = 'L';  // عمود إنارة
    }
  }
}


// --- 7) إصلاح الفراغات المعزولة (القسم 3.4.1، إلزامي) ---
// المشكلة: مربع فارغ محاصر بالمباني تظهر فيه وحدة فلا تخرج ولا يصلها أحد.
// الخطوات الخمس منفّذة بالترتيب: جمع، flood fill، فتح الحاجز أو الردم، إعادة، ساحات الأعلام.
export function repairIsolatedPockets(map) {
  // (4) نكرر الإصلاح ثلاث مرات كحد أقصى
  for (let round = 0; round < MAP_GEN.pocketRepairRounds; round++) {
    const reached = floodFromStreets(map);          // (1) و(2)
    const pockets = collectPockets(map, reached);
    if (!pockets.length) break;
    for (const pocket of pockets) fixPocket(map, pocket, reached);   // (3)
  }

  // (5) ساحة علم كل حي يجب أن تصل إلى شبكة الشوارع
  let reached = floodFromStreets(map);
  for (const district of map.districts) {
    if (!district.capture) continue;
    const { i, j } = district.capture;
    if (reached[map.idx(i, j)]) continue;
    carveCorridor(map, i, j, reached);
    reached = floodFromStreets(map);
  }

  map.connected = reached;
  warnIfIsolated(map, reached);
}

// (1) + (2) كل المربعات القابلة للمشي، وflood fill بثمانية اتجاهات من شبكة الشوارع كلها
// مع نفس قاعدة منع قطع الزوايا المستعملة في pathfinding
function floodFromStreets(map) {
  const n = map.n;
  const reached = new Uint8Array(n * n);
  const queue = new Int32Array(n * n);
  let head = 0, tail = 0;

  for (let k = 0; k < n * n; k++) {
    if (map.road[k]) { reached[k] = 1; queue[tail++] = k; }
  }

  while (head < tail) {
    const k = queue[head++];
    const i = k % n, j = (k - i) / n;
    for (const [dx, dy] of D8) {
      const a = i + dx, b = j + dy;
      if (!map.isWalkable(a, b)) continue;
      if (dx && dy && (!map.isWalkable(i + dx, j) || !map.isWalkable(i, j + dy))) continue;
      const nk = map.idx(a, b);
      if (reached[nk]) continue;
      reached[nk] = 1;
      queue[tail++] = nk;
    }
  }
  return reached;
}

// المربعات القابلة للمشي التي لم يصلها الـ flood fill، مجمّعة في فراغات متصلة
function collectPockets(map, reached) {
  const n = map.n;
  const seen = new Uint8Array(n * n);
  const pockets = [];

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = map.idx(i, j);
      if (reached[k] || seen[k] || !map.isWalkable(i, j)) continue;

      const pocket = [];
      const stack = [[i, j]];
      seen[k] = 1;
      while (stack.length) {
        const [a, b] = stack.pop();
        pocket.push([a, b]);
        for (const [dx, dy] of D8) {
          const x = a + dx, y = b + dy;
          if (!map.isWalkable(x, y)) continue;
          if (dx && dy && (!map.isWalkable(a + dx, b) || !map.isWalkable(a, b + dy))) continue;
          const nk = map.idx(x, y);
          if (seen[nk] || reached[nk]) continue;
          seen[nk] = 1;
          stack.push([x, y]);
        }
      }
      pockets.push(pocket);
    }
  }
  return pockets;
}

// (3) إما نفتح الحاجز بين الفراغ وأقرب مربع موصول، وإلا نردمه بمبنى
function fixPocket(map, pocket, reached) {
  if (openBarrier(map, pocket, reached)) return;

  // ساحة العلم لا تُردم: نحفر لها ممراً بدل ذلك (يكملها التحقق الخامس)
  const plaza = pocket.find(([i, j]) => map.type[map.idx(i, j)] === 'P');
  if (plaza) { carveCorridor(map, plaza[0], plaza[1], reached); return; }

  for (const [i, j] of pocket) {
    if (map.road[map.idx(i, j)]) continue;      // لا نردم شارعاً أبداً
    map.type[map.idx(i, j)] = MAP_GEN.pocketFillType;
  }
}

// يحوّل المبنى الفاصل بين مربع الفراغ ومربع موصول إلى أرض فارغة
function openBarrier(map, pocket, reached) {
  for (const [i, j] of pocket) {
    for (const [dx, dy] of D8) {
      if (dx && dy) {
        // جار قطري موصول يمنعه قطع الزوايا: نفتح أحد المربعين الجانبيين
        const a = i + dx, b = j + dy;
        if (!map.isWalkable(a, b) || !reached[map.idx(a, b)]) continue;
        const side = [[i + dx, j], [i, j + dy]].find(([x, y]) => openable(map, x, y));
        if (side) { map.type[map.idx(side[0], side[1])] = '.'; return true; }
      } else {
        // مبنى واحد يفصل الفراغ عن مربع موصول خلفه
        const a = i + dx, b = j + dy;
        if (!openable(map, a, b)) continue;
        const x = i + dx * 2, y = j + dy * 2;
        if (!map.isWalkable(x, y) || !reached[map.idx(x, y)]) continue;
        map.type[map.idx(a, b)] = '.';
        return true;
      }
    }
  }
  return false;
}

// مبنى عادي يمكن فتحه: لا شارع ولا مبنى مميز (مقر، مستشفى، مخزن، ساعة، نافورة)
function openable(map, i, j) {
  if (!map.inBounds(i, j)) return false;
  const k = map.idx(i, j);
  if (map.road[k]) return false;
  const type = map.type[k];
  return type !== '.' && type !== 'P' && !MAP_GEN.protectedBuildings.includes(type);
}

// (5) ممر بمربع واحد أو أكثر من نقطة معزولة إلى أقرب مربع موصول
function carveCorridor(map, si, sj, reached) {
  const n = map.n;
  const from = new Int32Array(n * n).fill(-2);
  const start = map.idx(si, sj);
  const queue = [start];
  from[start] = -1;

  while (queue.length) {
    const k = queue.shift();
    const i = k % n, j = (k - i) / n;

    if (k !== start && map.isWalkable(i, j) && reached[k]) {
      // نرجع على الطريق ونفتح كل مبنى فيه
      let node = from[k];
      while (node >= 0) {
        if (!map.road[node] && map.type[node] !== 'P') map.type[node] = '.';
        node = from[node];
      }
      return true;
    }

    for (const [dx, dy] of D4) {
      const a = i + dx, b = j + dy;
      if (!map.inBounds(a, b)) continue;
      const nk = map.idx(a, b);
      if (from[nk] !== -2) continue;
      if (openable(map, a, b) || map.isWalkable(a, b)) {
        from[nk] = k;
        queue.push(nk);
      }
    }
  }
  return false;
}

// فحص وضع التطوير: تحذير إن بقي مربع معزول بعد الإصلاح
function warnIfIsolated(map, reached) {
  if (!MAP_GEN.devChecks) return;
  let count = 0;
  for (let j = 0; j < map.n; j++) {
    for (let i = 0; i < map.n; i++) {
      if (map.isWalkable(i, j) && !reached[map.idx(i, j)]) count++;
    }
  }
  if (count) console.warn('تحذير: بقي ' + count + ' مربعاً معزولاً بعد إصلاح الفراغات (القسم 3.4.1)');
}
