// بيانات تجربة Flutter (docs/PROGRESS.md القسم 6): خريطة مدينة حقيقية، وأطلس واحد فيه مبانيها (من حزمة port/assets)
// وإطارات جنديين مرسومة برسم اللعبة نفسه، لكل لون اتجاهان: وقوف ومشي وضرب وموت.
//   node scripts/export_flutter_trial.cjs    (المخرجات في flutter_trial/assets/: map.json وatlas.png وatlas.json)
// الدقة 5.4 بكسل لكل وحدة عالم كحزمة الصور. لا يمس اللعبة: يرسم بدوالها في المتصفح.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'flutter_trial/assets');
const CITY = process.env.CITY || 'arab', SIZE = process.env.SIZE || 'medium';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };

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

// يُنفَّذ في الصفحة: مباراة حقيقية بلاعبين، ثم الخريطة والإطارات والأطلس
async function exportTrial({ city, size }) {
  const { lan } = await import('/js/net/session.js');
  const { resetMatch } = await import('/js/state.js');
  const { matchBlackout } = await import('/js/ui/blackout.js');
  const { showScreen } = await import('/js/ui/menus.js');
  const { groundColor } = await import('/js/render/cityRender.js');
  const { createUnit } = await import('/js/game/units.js');
  const { drawUnit } = await import('/js/render/units.js');
  const { sizeOf } = await import('/js/map/sizes.js');
  const C = await import('/js/config.js');
  const TEAMS = [{ gang: 'crows', color: 'blue' }, { gang: 'hammers', color: 'red' }];
  matchBlackout(() => {
    resetMatch(lan.state, { mode: 'conquest', city, mapSize: size, maxUnits: 100, weather: 'day', modeOptions: {},
      players: TEAMS.map((t, k) => ({ name: 'P' + k, gang: t.gang, color: t.color, isHuman: k === 0, team: k, difficulty: 'easy' })) });
    lan.state.running = true;
    showScreen('game');
  });
  // حتى ترتفع شاشة التحميل: المدينة وصور الشخصيات بألوان اللاعبين جاهزة
  await new Promise(r => setTimeout(r, 600));
  for (let k = 0; k < 150 && document.getElementById('blackout').classList.contains('on'); k++) await new Promise(r => setTimeout(r, 100));
  const s = lan.state;
  s.running = false;
  const map = s.map, n = map.n, S = 5.4;

  // صور المباني من الحزمة
  const man = await (await fetch('/port/assets/manifest.json')).json();
  const imgs = man.cities[city].images;
  const recOf = (pred, variant) => {
    const list = imgs.filter(pred);
    if (!list.length) return null;
    return list.find(r => r.variant === variant) || list[Math.min(list.length, variant || 1) - 1];
  };
  const FEAT = { souk: 'souk', pyramid: 'pyramid', villages: 'village', dojo: 'dojo', clinic: 'clinic', fortress: 'fortress' };
  const featKind = FEAT[C.CITY_FEATURES.cities[city]] || C.CITY_FEATURES.cities[city];
  const used = new Map(), tileSprite = new Array(n * n).fill(-1), colors = new Array(n * n), walk = new Array(n * n), missing = {};
  const spriteId = (rec) => {
    if (!used.has(rec.file)) used.set(rec.file, used.size);
    return used.get(rec.file);
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = map.idx(i, j), type = map.type[k], kind = map.kind[k], v = ((i + j) % 3) + 1;
    colors[k] = groundColor(s, i, j);
    walk[k] = map.isConnected(i, j) ? 1 : 0;
    if (map.road[k]) continue;
    const d = map.districtOf(i, j), dsize = d ? sizeOf(d) : 'medium';
    let rec = null;
    if (type === 'H') rec = kind === 'monument' ? recOf(r => r.group === 'monument')
      : recOf(r => (r.group === 'building' || r.group === 'prop') && r.kind === kind, v) || recOf(r => r.group === 'building', v);   // بلا نوع: أول مبنى
    else if (type === 'R') rec = recOf(r => r.group === 'ruin', v);
    else if (type === 'Q') rec = recOf(r => r.group === 'economy' && r.kind === 'hq' && r.size === dsize);
    else if (type === 'T') rec = recOf(r => r.group === 'economy' && r.kind === 'tower' && r.size === dsize);
    else if (type === 'M') rec = recOf(r => r.group === 'economy' && r.kind === 'hospital' && r.size === dsize);
    else if (type === 'N') rec = recOf(r => r.group === 'economy' && r.kind === 'police');
    else if (type === 'F') rec = recOf(r => r.group === 'feature' && r.kind === featKind);
    if (rec) tileSprite[k] = spriteId(rec);
    else if (!'.~fYP'.includes(type)) missing[type + ':' + kind] = (missing[type + ':' + kind] || 0) + 1;   // P ساحة العلم: أرض
  }
  const load = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
  const sprites = [];
  for (const [file] of used) {
    const rec = imgs.find(r => r.file === file);
    sprites.push({ name: file.split('/').slice(2).join('/').replace('.webp', ''), src: await load('/port/assets/' + file), w: rec.w, h: rec.h, ax: rec.ax, ay: rec.ay });
  }

  // إطارات الجنود: رسم اللعبة نفسه (المستوى الكامل والنمط المظلَّل) حول القدمين، بخلية موحدة لكل لون
  const BOX = { x0: -24, x1: 24, y0: -34, y1: 10 };
  const BW = Math.round((BOX.x1 - BOX.x0) * S), BH = Math.round((BOX.y1 - BOX.y0) * S);
  const frame = (unit, time) => {
    const cv = document.createElement('canvas');
    cv.width = BW; cv.height = BH;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.translate(-BOX.x0 * S, -BOX.y0 * S); c.scale(S, S);
    drawUnit(c, unit, 1, 99, time, false, false, true);
    return cv;
  };
  const N = { idle: 1, walk: 8, attack: 8, death: 6 };
  const units = [];
  TEAMS.forEach((team, t) => {
    const p = s.players[t];
    const u = createUnit(s, p, 0, 0);
    u.x = u.y = u.prevX = u.prevY = 0;
    u.lod = 'full';
    const walkPeriod = 1 / (2.55 * u.stats.speed / 2.2), attackRate = u.stats.attackRate || 1, deathTime = C.COMBAT.deathTime;
    const seq = {};
    let time = 100;
    for (const dir of [1, -1]) {
      u.facing = dir;
      const tag = dir > 0 ? 'r' : 'l';
      const set = (name, state, fn) => {
        const list = [];
        // إطار تمهيد يُهمل: يكمل مزج الوضعية من الحالة السابقة
        Object.assign(u, fn(0)); u.state = state; frame(u, time); time += 2;
        for (let f = 0; f < N[name]; f++) {
          const a = f / N[name];
          Object.assign(u, fn(a)); u.state = state;
          list.push(frame(u, time + (name === 'walk' ? a * walkPeriod : 0)));
        }
        time += 10;
        seq[name + '_' + tag] = list;
      };
      set('idle', 'idle', () => ({ attackStart: null, target: null }));
      set('walk', 'moving', () => ({ attackStart: null }));
      set('attack', 'attacking', (a) => ({ attackStart: time - a * attackRate, attackRate, path: [] }));
      set('death', 'dead', (a) => ({ deathTimer: deathTime * (1 - a * 0.92), deathFront: false }));
      u.state = 'idle';
    }
    units.push({ t, gang: team.gang, color: team.color, walkPeriod, attackRate, deathTime, seq });
  });
  // خلية موحدة لكل لون: أصغر مستطيل يجمع إطاراته كلها
  for (const un of units) {
    let x0 = BW, y0 = BH, x1 = -1, y1 = -1;
    for (const list of Object.values(un.seq)) for (const cv of list) {
      const d = cv.getContext('2d').getImageData(0, 0, BW, BH).data;
      for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) if (d[(y * BW + x) * 4 + 3] > 3) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    un.cell = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, ax: -BOX.x0 * S - x0, ay: -BOX.y0 * S - y0 };
    for (const [key, list] of Object.entries(un.seq)) list.forEach((cv, f) => sprites.push({
      name: `unit${un.t}_${key}_${f}`, src: cv, sx: x0, sy: y0, w: un.cell.w, h: un.cell.h, ax: un.cell.ax, ay: un.cell.ay
    }));
  }

  // الأطلس: رفوف بعرض 2048، الأطول أولاً، وحاشية 2 بكسل ضد تسرب الألوان عند التصغير
  const W = 2048, PAD = 2;
  const order = sprites.map((sp, k) => k).sort((a, b) => sprites[b].h - sprites[a].h);
  let x = PAD, y = PAD, rowH = 0;
  for (const k of order) {
    const sp = sprites[k];
    if (x + sp.w + PAD > W) { x = PAD; y += rowH + PAD; rowH = 0; }
    sp.x = x; sp.y = y; x += sp.w + PAD; rowH = Math.max(rowH, sp.h);
  }
  const H = y + rowH + PAD;
  const atlas = document.createElement('canvas');
  atlas.width = W; atlas.height = H;
  const ac = atlas.getContext('2d');
  for (const sp of sprites) ac.drawImage(sp.src, sp.sx || 0, sp.sy || 0, sp.w, sp.h, sp.x, sp.y, sp.w, sp.h);
  const rect = (sp) => [sp.x, sp.y, sp.w, sp.h, +sp.ax.toFixed(1), +sp.ay.toFixed(1)];
  const byName = Object.fromEntries(sprites.map(sp => [sp.name, sp]));
  const atlasJson = {
    pxPerUnit: S, size: [W, H],
    buildings: [...used.keys()].map((f, k) => rect(sprites[k])),
    buildingNames: sprites.slice(0, used.size).map(sp => sp.name),
    units: units.map(un => ({ gang: un.gang, color: un.color, walkPeriod: +un.walkPeriod.toFixed(3), attackRate: un.attackRate, deathTime: un.deathTime,
      seq: Object.fromEntries(Object.keys(un.seq).map(key => [key, un.seq[key].map((_, f) => rect(byName[`unit${un.t}_${key}_${f}`]))])) }))
  };
  const homes = s.players.slice(0, 2).map(p => { const d = map.districts[p.homeDistrictId]; return d.capture ? [d.capture.i, d.capture.j] : d.tiles[0]; });
  const argb = (hex) => parseInt('ff' + hex.replace('#', '').slice(0, 6), 16);
  const mapJson = { city, n, tile: { halfW: C.TILE_HALF_W, halfH: C.TILE_HALF_H }, homes,
    ground: colors.map(argb), sprite: tileSprite, walk };
  return { atlas: atlas.toDataURL('image/png'), atlasJson, mapJson, missing, sprites: sprites.length, H };
}

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForTimeout(2500);
  const r = await page.evaluate(exportTrial, { city: CITY, size: SIZE });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'atlas.png'), Buffer.from(r.atlas.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'atlas.json'), JSON.stringify(r.atlasJson));
  fs.writeFileSync(path.join(OUT, 'map.json'), JSON.stringify(r.mapJson));
  console.log('sprites', r.sprites, 'atlas 2048x' + r.H, 'n', r.mapJson.n, 'missing', JSON.stringify(r.missing));
  await browser.close();
  server.close();
  if (errors.length) { console.error('أخطاء:', errors); process.exit(1); }
})();
