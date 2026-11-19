// يرسم الزينة (catalog.js) صوراً شفافة على قالب ثابت بدقة اللعبة، في مجلدات كحزمة صور المستخدم، ولوحة لكل منطقة
// الاستعمال: node scripts/decor_drafts/render.cjs <مجلد الإخراج> <ألوان المدن.json> [مجلد صور المدن المفكوك: لأسماء مجلداته]
// القالب الصغير 259×302 وارتكازه (129.5، 216)، والكبير 432×713 وارتكازه (216، 594): مركز المربع، 5.4 بكسل لكل وحدة
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const [OUT, PALETTE, SRC] = process.argv.slice(2);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };
const REGIONS = { arab: ['shibam', 'diriyah', 'cairo', 'yamamah', 'arab'], asia: ['kaifeng', 'japan', 'gyeongju', 'china', 'hk', 'jaipur'],
  europe: ['paris', 'birmingham', 'rothenburg', 'europe', 'norway'], africa: ['gondar', 'kano', 'meroe'], americas: ['rio', 'laboca', 'tenoch', 'mexico', 'chicago'] };
const REGION_NAMES = { arab: '1-المدن العربية', asia: '2-المدن الآسيوية', europe: '3-المدن الأوروبية', africa: '4-المدن الأفريقية', americas: '5-مدن الأمريكتين' };
const CAT = { tree: '1-الأشجار والقطع الكبيرة', street: '2-زينة الشوارع', ground: '3-الأرضيات والأرصفة', new: '4-زينة إضافية مقترحة' };
const SLOT = { hang: '1-معلّقة', light: '2-ضوء', ground: '3-قطعة أرض' };

// اسم مجلد كل مدينة من مجلد صور المستخدم إن وُجد (مثل "01-شبام - اليمن (shibam)")
const cityDir = {};
if (SRC) for (const r of fs.readdirSync(SRC)) if (!r.startsWith('0-')) for (const c of fs.readdirSync(path.join(SRC, r))) { const m = c.match(/\(([a-z]+)\)/); if (m) cityDir[m[1]] = c; }

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = url.startsWith('/drafts/') ? path.join(__dirname, url.slice(8)) : path.join(ROOT, url);
  if (url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><meta charset="utf-8"><body></body>'); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('ERR', e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const PAL = JSON.parse(fs.readFileSync(PALETTE, 'utf8'));
  const list = await page.evaluate(async PAL => {
    const TH = await import('/js/render/cityThemes.js');
    const { existing, proposed } = await import('/drafts/catalog.js');
    const MAN = await (await fetch('/flutter_game/assets/map/manifest.json')).json();
    const W = 432, H = 713, AX = 216, AY = 594, S = 5.4;
    const big = document.createElement('canvas'); big.width = W; big.height = H;
    const c = big.getContext('2d', { willReadFrequently: true });
    TH.setThemeContext(c, 7); TH.setTone(null);
    const entries = [...existing(PAL, MAN), ...proposed(PAL)];
    const load = src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; });
    const paint = async (e, under) => {
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
      if (e.img) { c.drawImage(await load('/flutter_game/assets/map/' + e.img.file), AX - e.img.ax, AY - e.img.ay); return; }
      c.setTransform(S, 0, 0, S, AX, AY); TH.setThemeContext(c, 7); TH.setTone(null);
      if (under) { const k = e.underScale || 1, cy = k > 1 ? -9 : 0; TH.poly([[-18 * k, cy], [0, cy - 9 * k], [18 * k, cy], [0, cy + 9 * k]], under); }
      c.save(); e.draw(0, 0); c.restore();
    };
    const bbox = () => {
      const d = c.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
    };
    const cut = (x, y, w, h) => { const o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(big, x, y, w, h, 0, 0, w, h); return o.toDataURL('image/png'); };
    const out = [];
    for (const e of entries) {
      if (!e.draw && !e.img) { out.push({ ...e, draw: undefined, error: 'لا رسم' }); continue; }
      try { await paint(e); } catch (err) { out.push({ ...e, draw: undefined, error: String(err) }); continue; }
      const b = bbox();
      if (!b) { out.push({ ...e, draw: undefined, img: undefined, error: 'فارغة' }); continue; }
      // القالب الصغير إن وسعها
      const small = b[0] >= AX - 129.5 && b[2] <= AX + 129.5 && b[1] >= AY - 216 && b[3] <= AY + 86;
      const png = small ? cut(AX - 129.5, AY - 216, 259, 302) : cut(0, 0, W, H);
      const clipped = b[0] === 0 || b[1] === 0 || b[2] === W || b[3] === H;
      let thumb;
      if (e.under) { await paint(e, e.under); const t = bbox(); thumb = cut(t[0] - 4, t[1] - 4, t[2] - t[0] + 8, t[3] - t[1] + 8); }
      else thumb = cut(b[0] - 4, b[1] - 4, b[2] - b[0] + 8, b[3] - b[1] + 8);
      out.push({ city: e.city, cat: e.cat, slot: e.slot, name: e.name, png, thumb, small, clipped });
    }
    return out;
  }, PAL);

  // الملفات
  const dirOf = e => {
    if (e.city === '_') return path.join(OUT, 'pack', '0-عام لكل المدن', CAT[e.cat]);
    const reg = Object.keys(REGIONS).find(r => REGIONS[r].includes(e.city));
    return path.join(OUT, 'pack', REGION_NAMES[reg], cityDir[e.city] || e.city, CAT[e.cat]);
  };
  const count = {};
  for (const e of list) {
    if (e.error) { console.log('SKIP', e.city, e.name, e.error); continue; }
    const d = dirOf(e); fs.mkdirSync(d, { recursive: true });
    count[d] = (count[d] || 0) + 1;
    const n = e.cat === 'new' ? `${SLOT[e.slot]} - ${e.name}` : `${String(count[d]).padStart(2, '0')}-${e.name}`;
    e.file = path.join(d, n.replace(/[\/\\]/g, '-') + '.png');
    fs.writeFileSync(e.file, Buffer.from(e.png.split(',')[1], 'base64'));
    if (e.clipped) console.log('CLIPPED', e.city, e.name);
  }
  const ok = list.filter(e => !e.error);
  console.log('صور', ok.length, 'جديدة', ok.filter(e => e.cat === 'new').length);

  // اللوحات: لكل منطقة صفحة، ولكل مدينة بطاقة بألوانها وزينتها الحالية والمقترحة
  const card = e => `<figure class="${e.cat === 'new' ? 'new' : ''}"><div class="img"><img src="${e.thumb}"></div><figcaption>${e.cat === 'new' ? `<i>${SLOT[e.slot].slice(2)}</i>` : ''}<b>${e.name}</b></figcaption></figure>`;
  const css = `body{margin:0;background:#1b1611;color:#f2e6cf;font-family:'Noto Naskh Arabic','Noto Sans Arabic',sans-serif;padding:22px;width:1500px}
    h1{color:#e2b55a;font-size:30px;margin:4px 0} h2{color:#e2b55a;font-size:24px;margin:0} h3{color:#c9b48a;font-size:16px;margin:12px 0 6px}
    p{color:#a89a82;margin:4px 0 10px;font-size:15px} .city{background:#251d16;border-radius:14px;padding:14px 16px;margin:14px 0}
    .head{display:flex;align-items:center;gap:14px} .sw{display:flex;gap:4px} .sw span{width:26px;height:26px;border-radius:6px;border:1px solid #0006}
    .row{display:flex;flex-wrap:wrap;gap:8px} figure{margin:0;background:#2e241b;border-radius:10px;padding:6px;display:flex;flex-direction:column;align-items:center;width:138px}
    figure.new{background:#3b2c18;border:2px solid #e2b55a;width:190px} .img{height:120px;width:100%;display:flex;align-items:flex-end;justify-content:center;background:#d9cdb2;border-radius:7px}
    figure.new .img{height:170px} .img img{max-height:112px;max-width:96%;transform-origin:bottom;image-rendering:auto} figure.new .img img{max-height:162px}
    figcaption{display:flex;flex-direction:column;align-items:center;margin-top:5px;text-align:center} figcaption b{font-size:13px} figcaption i{font-style:normal;color:#e2b55a;font-size:13px}`;
  const cityName = c => (cityDir[c] || c).replace(/^\d+-/, '').replace(/\s*\([a-z]+\)$/, '');
  const section = (items, title) => items.length ? `<h3>${title}</h3><div class="row">${items.map(card).join('')}</div>` : '';
  const sheets = [];
  const write = async (name, html) => {
    const f = path.join(OUT, name + '.html');
    fs.writeFileSync(f, `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><style>${css}</style><body>${html}</body></html>`);
    const p = await browser.newPage({ viewport: { width: 1544, height: 900 }, deviceScaleFactor: 1 });
    await p.goto('file://' + f); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true }); await p.close();
    sheets.push(name + '.png');
  };
  const general = ok.filter(e => e.city === '_');
  await write('0-عام', `<h1>زينة المدن: ما يُرسم اليوم بالكود في كل المدن</h1>
    <p>كل صورة على القالب الثابت (مركز المربع) بدقة اللعبة 5.4 بكسل لكل وحدة. والأرضيات الشفافة (الأرصفة والخطوط) معروضة هنا فوق أرض شارع لتُرى، وملفاتها بلا أرض.</p>
    <div class="city">${section(general.filter(e => e.cat === 'street'), 'زينة الشوارع العامة')}${section(general.filter(e => e.cat === 'ground'), 'الأرضيات والأرصفة والخطوط')}</div>`);
  for (const [reg, cities] of Object.entries(REGIONS)) {
    let html = `<h1>${REGION_NAMES[reg].slice(2)}: الزينة الحالية والمقترحة</h1>
      <p>بطاقة لكل مدينة: ألوانها من صور مبانيك (منها رُسمت المقترحة)، ثم ما يُرسم اليوم، ثم الثلاث الجديدة بإطار ذهبي: معلّقة فوق الشارع، وضوء يضيء ليلاً، وقطعة أرض.</p>`;
    for (const city of cities) {
      const items = ok.filter(e => e.city === city);
      html += `<div class="city"><div class="head"><h2>${cityName(city)}</h2><div class="sw">${PAL[city].map(c => `<span style="background:${c}" title="${c}"></span>`).join('')}</div></div>
        ${section(items.filter(e => e.cat === 'new'), 'الزينة الإضافية المقترحة')}
        ${section(items.filter(e => e.cat === 'tree'), 'الأشجار والقطع الكبيرة (صور الحزمة الحالية)')}
        ${section(items.filter(e => e.cat === 'street'), 'زينة الشوارع الحالية')}
        ${section(items.filter(e => e.cat === 'ground'), 'الأرضيات بألوان المدينة')}</div>`;
    }
    await write(REGION_NAMES[reg], html);
  }
  console.log('لوحات', sheets.join(' '));
  await browser.close(); server.close();
});
