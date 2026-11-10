// صور الخريطة للمحرك الجديد (Flutter، القسم 6 في docs/PROGRESS.md): كل ما ترسمه المدينة بالكود صورةً شفافة
// بنقطة ارتكاز، وأقنعة الصبغ، وmanifest.json يصف كل صورة. لا تمس اللعبة الحالية: ترسم بدوال الرسم نفسها.
//   node scripts/export_port_assets.cjs [outdir=port/assets] [ONLY=arab,cairo]
// الدقة 5.4 بكسل لكل وحدة عالم (أعلى دقة لقطع المدينة في اللعبة، ودقة صور اليمامة). المربع 36×18 وحدة = 194×97 بكسل.
// نقطة الارتكاز (ax, ay): وسط قاعدة المربع (وللمبنى المميز 2×2 وسط مربعه الأمامي)، بالبكسل داخل الصورة.
// الأقنعة: -roof.png أبيض حيث يُصبغ السطح بلون مالك الحي (والجدران تُصبغ أخف: wallTint/roofTint في manifest)،
// و-owner.png حيث لون المالك نفسه (رايات القصر والبرج وأعلى السور): الصورة مرسومة هناك بالأبيض فيُضرب لون المالك فيها.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'port/assets');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };

// خادم ملفات بسيط للمستودع (وحدات ES تحتاج http)
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// يُنفَّذ في الصفحة: أدوات الرسم والقص والأقنعة
async function setup(page) {
  await page.evaluate(async () => {
    const M = {
      TH: await import('/js/render/cityThemes.js'), DT: await import('/js/render/detail.js'),
      L: await import('/js/render/landmarks.js'), F: await import('/js/render/featureArt.js'),
      W: await import('/js/render/chunkCache.js'), C: await import('/js/config.js')
    };
    for (let k = 0; k < 100 && M.TH.THEMES.yamamah.ready && !M.TH.THEMES.yamamah.ready(); k++) await new Promise(r => setTimeout(r, 100));
    const S = 5.4, FRAME = { x0: -60, x1: 60, y0: -150, y1: 40 };
    const W = Math.round((FRAME.x1 - FRAME.x0) * S), H = Math.round((FRAME.y1 - FRAME.y0) * S);
    const AX = -FRAME.x0 * S, AY = -FRAME.y0 * S;
    const raw = (draw) => {
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const c = cv.getContext('2d', { willReadFrequently: true });
      c.translate(AX, AY); c.scale(S, S);
      M.TH.setThemeContext(c, 7);
      draw(c);
      M.TH.setTone(null);
      return c.getImageData(0, 0, W, H);
    };
    const bbox = (d) => {
      let x0 = W, x1 = -1, y0 = H, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d.data[(y * W + x) * 4 + 3] > 3) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    };
    const encode = (d, b, type) => {
      const cv = document.createElement('canvas');
      cv.width = b.w; cv.height = b.h;
      cv.getContext('2d').putImageData(d, -b.x, -b.y, b.x, b.y, b.w, b.h);
      return type === 'webp' ? cv.toDataURL('image/webp', 0.92) : cv.toDataURL('image/png');
    };
    // قناع أبيض بشفافية weight(r,g,b,a) من 0 إلى 1، أو null إن كان فارغاً
    const mask = (d, weight) => {
      const out = new ImageData(W, H);
      let any = false;
      for (let k = 0; k < d.data.length; k += 4) {
        const w = weight(d.data, k);
        if (w <= 0.02) continue;
        out.data[k] = out.data[k + 1] = out.data[k + 2] = 255;
        out.data[k + 3] = Math.round(Math.min(1, w) * 255);
        any = true;
      }
      return any ? out : null;
    };
    // صورة بقناع سطح: الألوان التي تمر بالصبغ (paint) تُرسم مرة بالأرجواني للأسطح والأخضر للجدران
    const MARK = (c, roof) => roof ? '#ff00ff' : '#00ff00';
    const roofWeight = (p, k) => (Math.min(p[k], p[k + 2]) - p[k + 1]) / 255 * (p[k + 3] / 255);
    // قناع لون المالك: الفرق بين رسمين بمالكين مختلفين
    const ownerWeight = (a, b) => (p, k) => (Math.abs(a.data[k] - b.data[k]) + Math.abs(a.data[k + 1] - b.data[k + 1]) + Math.abs(a.data[k + 2] - b.data[k + 2])) / 300;
    const shoot = (draw, opts = {}) => {
      const base = raw((c) => draw(c, opts.owner ? '#ffffff' : null));
      const b = bbox(base);
      if (!b) return null;
      const out = { img: encode(base, b, 'webp'), w: b.w, h: b.h, ax: +(AX - b.x).toFixed(1), ay: +(AY - b.y).toFixed(1) };
      if (opts.roof) {
        const marked = raw((c) => { M.TH.setTone(MARK); draw(c, opts.owner ? '#ffffff' : null); });
        const m = mask(marked, roofWeight);
        if (m) out.roof = encode(m, b, 'png');
      }
      if (opts.owner) {
        const red = raw((c) => draw(c, '#ff0000')), blue = raw((c) => draw(c, '#0000ff'));
        const m = mask(red, ownerWeight(red, blue));
        if (m) out.owner = encode(m, b, 'png');
      }
      return out;
    };
    window.__P = { M, S, shoot };
  });
}

const FEAT = { pyramid: 'pyramid', villages: 'village', dojo: 'dojo', clinic: 'clinic', fortress: 'fortress', khartoum: 'khartoum',
  policeHQ: 'policeHQ', clock: 'clock', cartel: 'complex', statue: 'statue', mercs: 'mercs', souk: 'souk', triads: 'triads',
  elephants: 'stable', bells: 'cathedral', mine: 'mine', bank: 'bank' };

// يُنفَّذ في الصفحة لكل مدينة: قائمة الصور { file, kind, ... }
function cityShots({ city, FEAT }) {
  const { M, shoot } = window.__P, T = M.TH.THEMES[city], C = M.C;
  const out = [], sizes = { small: 6, medium: C.DISTRICT_SIZES.maxTiles.small + 3, large: C.DISTRICT_SIZES.maxTiles.medium + 8 };
  const add = (file, meta, shot) => { if (shot) out.push({ file, ...meta, ...shot }); };
  const VARIANTS = [[3, 3], [3, 4], [3, 5]];       // (i+j) % 3 = 0، 1، 2: درجات الارتفاع الثلاث في رسم المباني
  const dedupe = (list) => list.filter((s, k) => s && list.findIndex(t => t && t.img === s.img) === k);
  const pool = [...new Set((T.pool || []).map(p => p[0]))].filter(k => k !== '.' && k !== 'ruin' && typeof T.draw[k] === 'function');
  if (typeof T.draw.rorbu === 'function' && !pool.includes('rorbu')) pool.push('rorbu');   // بيوت الصيد على الماء (النرويجية)

  // 1) المباني العادية (بتفاصيل 12ج) والأشجار والزينة، بثلاث نسخ
  for (const kind of pool) {
    const prop = C.CITY_UNTINTED.includes(kind);
    const shots = dedupe(VARIANTS.map(([i, j]) => shoot(() => {
      if (prop || city === 'yamamah') T.draw[kind](0, 0, i, j, T);
      else { M.DT.beginDetail(city, i, j); T.draw[kind](0, 0, i, j, T); M.DT.endDetail(); }
    }, { roof: !prop })));
    shots.forEach((s, v) => add(`${prop ? 'props' : 'buildings'}/${kind}_${v + 1}`, { group: prop ? 'prop' : 'building', kind, variant: v + 1 }, s));
  }
  // 2) الأطلال بثلاث نسخ
  dedupe(VARIANTS.map(([i, j]) => shoot(() => (T.draw.ruin || M.TH.ruinTile)(0, 0, i, j, T))))
    .forEach((s, v) => add(`ruins/ruin_${v + 1}`, { group: 'ruin', kind: 'ruin', variant: v + 1 }, s));
  // 3) معلم المدينة
  if (typeof T.draw.monument === 'function') add('monument', { group: 'monument', kind: 'monument' }, shoot(() => T.draw.monument(0, 0, 3, 4, T)));
  // 4) المبنى المميز للمدينة (2×2: الارتكاز وسط المربع الأمامي) ومبنى مدن الأحداث (12هـ)
  const features = [FEAT[C.CITY_FEATURES.cities[city]], C.CITY_FEATURES.buildings && C.CITY_FEATURES.buildings[city]].filter(Boolean);
  for (const f of [...new Set(features)]) {
    if (f === 'village') add('feature/village_well', { group: 'feature', kind: f, footprint: 1 }, shoot(() => M.F.villageWell(0, 0)));
    else add(`feature/${f}`, { group: 'feature', kind: f, footprint: 2 }, shoot(() => M.F.drawFeatureBuilding(f, 0, 0, 10, 10, true)));
  }
  // 5) مباني الاقتصاد والشرطة بأحجام الأحياء، بلا ترقيات (القصر والبرج بلون المالك في قناع owner)
  let seed = 1000 + city.length * 37 + city.charCodeAt(0);
  const land = (type, size) => {
    const s = ++seed;
    return (c, owner) => {
      const map = { city, seed: s * 7, idx: () => 0, districtAt: [0], districts: [{ tiles: new Array(sizes[size]), isHome: false }] };
      M.L.drawLandmark(map, type, 0, 0, 3, 4, owner || '#ffffff', owner || '#ffffff', null, true, null);
    };
  };
  for (const [type, name] of [['Q', 'hq'], ['T', 'tower'], ['M', 'hospital']]) {
    for (const size of ['small', 'medium', 'large']) {
      add(`economy/${name}_${size}`, { group: 'economy', kind: name, size }, shoot(land(type, size), { roof: true, owner: true }));
    }
  }
  add('economy/police', { group: 'economy', kind: 'police', size: 'medium' }, shoot(land('N', 'medium'), { roof: true, owner: true }));
  // 6) قطع السور بمستوياته الثلاثة: ضلعا الوجهين وبوابتاهما وبرج الركن، حول مركز مربعها (أعلاه بلون المالك)
  const N = 5, inD = (i, j) => i >= 1 && i <= 3 && j >= 1 && j <= 3;
  const map = { city, inBounds: (i, j) => i >= 0 && j >= 0 && i < N && j < N, idx: (i, j) => i * N + j,
    districtAt: Array.from({ length: N * N }, (_, k) => inD(Math.floor(k / N), k % N) ? 0 : -1) };
  const look = (i, j, fort, gates) => {
    let m = 0;
    M.W.EDGES.forEach(([di, dj], e) => { if (!inD(i + di, j + dj)) m |= 1 << e; });
    const g = gates.has(i + ',' + j);
    return { mask: m, walls: g ? 0 : m, gates: g ? m : 0, fort, d: 0, i, j };
  };
  const piece = (fort, kind) => (c, owner) => {
    const [ti, tj] = kind === 'R' || kind === 'GR' ? [3, 2] : kind === 'TW' ? [3, 3] : [2, 3];
    const gates = new Set(kind === 'GR' ? ['3,2'] : kind === 'GL' ? ['2,3'] : []);
    const segs = [], towers = [], gs = [], WS = M.W.wallStyle(map);
    M.W.wallsOf(map, look(ti, tj, fort, gates), 0, 0, false, segs, towers, gs);
    if (kind === 'TW') { if (towers.length) M.W.drawTowers(c, towers, owner, 1, fort, WS); }
    else { if (segs.length) M.W.drawWalls(c, segs, owner, 1, fort, WS); if (gs.length) M.W.drawGates(c, gs, owner, 1, fort, WS); }
    c.globalAlpha = 1;
  };
  const PIECES = { R: 'right', L: 'left', GR: 'gate_right', GL: 'gate_left', TW: 'tower' };
  for (const lv of [1, 2, 3]) for (const [k, name] of Object.entries(PIECES)) {
    if (k === 'TW' && lv === 1) continue;
    add(`walls/level${lv}_${name}`, { group: 'wall', kind: name, level: lv }, shoot(piece(lv, k), { owner: true }));
  }
  // ألوان الأرض (المربعات أشكال مسطحة يرسمها المحرك)
  const open = C.CITIES.open[city];
  const info = { name: T.name, scale: open ? open.scale : 1,
    colors: { ground: T.ground, road: T.road, road2: T.road2, plaza: T.plaza, water: T.waterCol || null } };
  return { info, shots: out };
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.waitForTimeout(1500);
  await setup(page);
  const cities = await page.evaluate(() => Object.keys(window.__P.M.TH.THEMES));
  const C = await page.evaluate(() => ({ roofTint: window.__P.M.C.CAPTURE.roofTintAlpha, wallTint: window.__P.M.C.CAPTURE.wallTintAlpha }));
  const manifest = {
    version: 1,
    pxPerUnit: 5.4,
    tile: { halfW: 18, halfH: 9 },
    note: 'ax, ay: نقطة الارتكاز بالبكسل داخل الصورة (وسط قاعدة المربع). roof: قناع صبغ السطح بلون المالك، والجدران بنسبة wallTint/roofTint من الصورة كلها. owner: حيث لون المالك (مرسوم بالأبيض فيُضرب فيه).',
    tint: C,
    cities: {}
  };
  const save = (rel, url) => {
    const f = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  };
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const city of cities) {
    if (ONLY && !ONLY.includes(city)) continue;
    const { info, shots } = await page.evaluate(cityShots, { city, FEAT });
    const entry = { ...info, images: [] };
    for (const s of shots) {
      const rec = { file: `cities/${city}/${s.file}.webp`, group: s.group, kind: s.kind, w: s.w, h: s.h, ax: s.ax, ay: s.ay };
      for (const key of ['variant', 'size', 'level', 'footprint']) if (s[key] !== undefined) rec[key] = s[key];
      save(rec.file, s.img);
      if (s.roof) { rec.roof = `cities/${city}/${s.file}-roof.png`; save(rec.roof, s.roof); }
      if (s.owner) { rec.owner = `cities/${city}/${s.file}-owner.png`; save(rec.owner, s.owner); }
      entry.images.push(rec);
    }
    // صحراء اليمامة: صور المستخدم الأصلية بأقنعة أسطحها، كما ترسمها اللعبة (مبانيها المركبة أعلاه بلا أقنعة)
    if (city === 'yamamah') {
      const src = path.join(ROOT, 'assets/yamamah'), dst = path.join(OUT, 'cities/yamamah/source');
      fs.mkdirSync(dst, { recursive: true });
      for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
      entry.source = 'cities/yamamah/source';
    }
    manifest.cities[city] = entry;
    console.log(city, shots.length);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  await browser.close();
  server.close();
  if (errors.length) { console.error('أخطاء:', errors); process.exit(1); }
})();
