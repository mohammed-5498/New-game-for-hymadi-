// توليد الخريطة العشوائية: شوارع، أحياء، نقاط استيلاء، مباني
import { MAP_SIZES, MAP_GEN, POLICE } from '../config.js';
import { D4, D8 } from './pathfinding.js';

const rnd = () => Math.random();
const ri = (n) => Math.floor(Math.random() * n);

// أنواع المباني في كل طابع حي، مع أوزان الاحتمال (منقولة من prototype.html)
// '.' أرض فارغة، H بيت، A عمارة، R أطلال، F مصنع، W مستودع، T شجرة،
// M أكشاك سوق، X سيارة محطمة، K خزان ماء
const THEMES = {
  crows:     [['A', 40], ['H', 22], ['R', 14], ['T', 6],  ['.', 18]],
  hammers:   [['F', 18], ['W', 32], ['K', 8],  ['R', 14], ['X', 8], ['.', 20]],
  vipers:    [['T', 38], ['H', 28], ['R', 12], ['.', 22]],
  scorpions: [['H', 50], ['M', 10], ['B', 10], ['R', 12], ['.', 18]],
  neutral:   [['H', 30], ['A', 14], ['R', 20], ['W', 10], ['T', 10], ['X', 5], ['.', 11]],
  special:   [['T', 30], ['H', 25], ['.', 45]],
  police:    [['H', 26], ['W', 16], ['X', 10], ['R', 10], ['T', 8], ['.', 30]]
};

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
export function createMap(sizeKey, players) {
  const size = MAP_SIZES[sizeKey] || MAP_SIZES.medium;
  for (let attempt = 0; attempt < MAP_GEN.maxTries; attempt++) {
    const map = buildMap(size, players);
    if (map) return map;
  }
  return null;
}

function buildMap(size, players) {
  const map = createEmptyMap(size);
  carveStreets(map);
  if (!roadsConnected(map)) return null;          // شرط إلزامي: الشوارع كلها متصلة

  const districts = findDistricts(map);
  if (!assignHomeDistricts(map, districts, players)) return null;
  assignSpecialDistricts(map, districts, size, players);
  assignPoliceDistricts(map, districts, size);
  fillDistricts(map, districts);
  map.districts = districts;
  repairIsolatedPockets(map);     // القسم 3.4.1: لا يبقى فراغ محاصر بالمباني
  decorateRoads(map);
  return map;
}

function createEmptyMap(size) {
  const n = size.n;
  return {
    size,
    n,
    road: new Uint8Array(n * n),
    type: new Array(n * n).fill('.'),
    region: new Array(n * n).fill('neutral'),
    dash: new Uint8Array(n * n),      // خطوط منتصف الشارع
    decor: {},                        // زينة فوق الشوارع (برميل نار، عمود إنارة)
    districtAt: new Int32Array(n * n).fill(-1),
    districts: [],
    connected: null,                  // يملؤه إصلاح الفراغات المعزولة (القسم 3.4.1)

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
}

// --- 1) الشوارع ---
function carveStreets(map) {
  const n = map.n;
  const spacing = () => MAP_GEN.streetSpacingMin + ri(MAP_GEN.streetSpacingMax - MAP_GEN.streetSpacingMin + 1);
  const lines = () => {
    const arr = [];
    let p = 1 + ri(2);
    while (p < n - 1) { arr.push(p); p += spacing(); }
    return arr;
  };

  const cols = lines(), rows = lines();
  const near = (arr, v) => arr.some(a => Math.abs(a - v) <= 1);

  // شوارع طولية مع انحراف بسيط بعيداً عن التقاطعات
  for (const c of cols) {
    let cc = c;
    for (let j = 0; j < n; j++) {
      if (!near(rows, j) && rnd() < MAP_GEN.bendChance) {
        map.road[map.idx(cc, j)] = 1;
        cc = Math.max(1, Math.min(n - 2, cc + (rnd() < 0.5 ? -1 : 1)));
      }
      map.road[map.idx(cc, j)] = 1;
    }
  }
  // شوارع عرضية
  for (const r of rows) {
    let rr = r;
    for (let i = 0; i < n; i++) {
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
      if (map.inBounds(a, b)) map.road[map.idx(a, b)] = 1;
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
      if (map.road[k] || map.districtAt[k] >= 0) continue;

      const district = {
        id: districts.length,
        tiles: [],
        cx: 0, cy: 0,
        region: 'neutral',
        capturable: false,
        capture: null,      // نقطة الاستيلاء {i, j}
        isHome: false,
        special: null,      // hospital | armory | clock
        police: false,      // حي فيه مركز شرطة (القسم 3.8)
        policeDisabled: false,  // توقف إنتاج الشرطة نهائياً بعد أول استيلاء
        owner: null,        // رقم اللاعب المالك
        progress: 0,        // تقدم الاستيلاء (المرحلة 3)
        progressOwner: null,
        tintColor: null,    // لون الصبغ الحالي (القسم 8)
        tintMix: 0          // تقدم الانتقال اللوني من 0 إلى 1
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
          if (map.road[nk] || map.districtAt[nk] >= 0) continue;
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
      const dist = Math.hypot(d.cx - px, d.cy - py);
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
    .filter(d => !d.isHome && d.capturable && Math.hypot(d.cx - center, d.cy - center) < limit)
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
    Math.hypot(d.cx - h.cx, d.cy - h.cy) >= POLICE.minHomeDistance);

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
      const nearest = Math.min(...chosen.map(c => Math.hypot(d.cx - c.cx, d.cy - c.cy)));
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

// --- 5) ملء الأحياء بالمباني ونقاط الاستيلاء ---
function fillDistricts(map, districts) {
  for (const district of districts) {
    const theme = THEMES[district.region] || THEMES.neutral;

    for (const [i, j] of district.tiles) {
      const k = map.idx(i, j);
      map.region[k] = district.region;
      map.type[k] = pickWeighted(theme);
    }

    // حي صغير: ليس قابلاً للاستيلاء، أشجار أو أرض فارغة فقط
    if (!district.capturable) {
      for (const [i, j] of district.tiles) {
        map.type[map.idx(i, j)] = rnd() < 0.5 ? 'T' : '.';
      }
      continue;
    }

    // نقطة الاستيلاء: مربع ملاصق لشارع والأقرب لمركز الحي
    let point = null, bestDist = Infinity;
    for (const [i, j] of district.tiles) {
      const touchesRoad = D4.some(([dx, dy]) =>
        map.inBounds(i + dx, j + dy) && map.road[map.idx(i + dx, j + dy)]);
      if (!touchesRoad) continue;
      const dist = Math.hypot(i - district.cx, j - district.cy);
      if (dist < bestDist) { bestDist = dist; point = [i, j]; }
    }
    if (!point) { district.capturable = false; continue; }

    map.type[map.idx(point[0], point[1])] = 'P';   // ساحة العلم
    district.capture = { i: point[0], j: point[1] };

    // المباني المميزة توضع في أقرب مربعات لمركز الحي
    const inner = district.tiles
      .filter(([i, j]) => !(i === point[0] && j === point[1]))
      .sort((a, b) =>
        Math.hypot(a[0] - district.cx, a[1] - district.cy) -
        Math.hypot(b[0] - district.cx, b[1] - district.cy));

    if (district.isHome && inner[0]) {
      map.type[map.idx(inner[0][0], inner[0][1])] = 'Q';   // مبنى المقر
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

// --- 6) خطوط منتصف الشوارع وزينتها ---
function decorateRoads(map) {
  const n = map.n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = map.idx(i, j);
      if (!map.road[k]) continue;

      const horizontal = (map.inBounds(i - 1, j) && map.road[map.idx(i - 1, j)]) ||
                         (map.inBounds(i + 1, j) && map.road[map.idx(i + 1, j)]);
      const vertical   = (map.inBounds(i, j - 1) && map.road[map.idx(i, j - 1)]) ||
                         (map.inBounds(i, j + 1) && map.road[map.idx(i, j + 1)]);
      map.dash[k] = horizontal && !vertical ? 1 : vertical && !horizontal ? 2 : 0;

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
