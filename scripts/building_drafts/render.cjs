// يرسم مسودات المباني المقترحة (GAME_SPEC 3.14، drafts.js) صوراً شفافة ولوحة تجمعها: node scripts/building_drafts/render.cjs [مجلد]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const HERE = __dirname, OUT = path.resolve(process.argv[2] || require('os').tmpdir() + '/gangcity-building-drafts');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };
fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = url.startsWith('/drafts/') ? path.join(HERE, url.slice(8)) : path.join(ROOT, url);
  if (url === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><meta charset="utf-8"><body></body>'); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('ERR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const list = await page.evaluate(async () => {
    const TH = await import('/js/render/cityThemes.js');
    const { DRAFTS } = await import('/drafts/drafts.js');
    const S = 8, X0 = -50, X1 = 50, Y0 = -95, Y1 = 30;
    const W = (X1 - X0) * S, H = (Y1 - Y0) * S;
    const out = [];
    for (const [id, name, city, kind, draw] of DRAFTS) {
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const c = cv.getContext('2d', { willReadFrequently: true });
      c.translate(-X0 * S, -Y0 * S); c.scale(S, S);
      TH.setThemeContext(c, 7);
      TH.setTone(null);
      try { draw(0, -9, 10, 10); } catch (e) { out.push({ id, error: String(e) }); continue; }
      const d = c.getImageData(0, 0, W, H);
      let x0 = W, x1 = -1, y0 = H, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d.data[(y * W + x) * 4 + 3] > 3) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      const pad = 8, bx = Math.max(0, x0 - pad), by = Math.max(0, y0 - pad), bw = Math.min(W, x1 + pad) - bx, bh = Math.min(H, y1 + pad) - by;
      const cut = document.createElement('canvas');
      cut.width = bw; cut.height = bh;
      cut.getContext('2d').putImageData(d, -bx, -by, bx, by, bw, bh);
      out.push({ id, name, city, kind, png: cut.toDataURL('image/png'), w: bw, h: bh, clipped: y0 <= 0 || x0 <= 0 || x1 >= W - 1 });
    }
    return out;
  });
  for (const e of list) {
    if (e.error) { console.log('FAIL', e.id, e.error); continue; }
    fs.writeFileSync(path.join(OUT, e.id + '.png'), Buffer.from(e.png.split(',')[1], 'base64'));
    if (e.clipped) console.log('CLIPPED', e.id);
  }
  // اللوحة: معابد ثم مرتزقة، بأسمائها ومدنها
  const cards = (kind) => list.filter(e => e.kind === kind && !e.error).map(e =>
    `<figure><div class="img"><img src="${e.id}.png"></div><figcaption><b>${e.name}</b><span>${e.city}</span></figcaption></figure>`).join('');
  const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><style>
    body{margin:0;background:#1b1611;color:#f2e6cf;font-family:'Noto Naskh Arabic','Noto Sans Arabic',sans-serif;padding:24px}
    h1{color:#e2b55a;font-size:30px;margin:6px 0 4px} h2{color:#e2b55a;font-size:24px;margin:26px 0 10px}
    p{color:#9c8f7a;margin:0 0 8px;font-size:15px}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    figure{margin:0;background:#2e241b;border-radius:12px;padding:10px;display:flex;flex-direction:column;align-items:center}
    .img{height:230px;display:flex;align-items:flex-end;justify-content:center;width:100%;background:#d9cdb2;border-radius:8px}
    .img img{max-height:220px;max-width:100%}
    figcaption{display:flex;flex-direction:column;align-items:center;margin-top:8px}
    figcaption b{font-size:17px} figcaption span{color:#9c8f7a;font-size:14px}
  </style><body>
  <h1>مدينة العصابات: صور أولية للمباني المقترحة</h1>
  <p>مسودات بأدوات رسم اللعبة، كتلة 2×2 بمنظور مائل، للتطوير. الصور الكاملة بخلفية شفافة في الملف المضغوط.</p>
  <h2>المعابد (وسط الخريطة)</h2><div class="grid">${cards('معبد')}</div>
  <h2>مباني المرتزقة (زوايا الخريطة)</h2><div class="grid">${cards('مرتزقة')}</div>
  </body></html>`;
  fs.writeFileSync(path.join(OUT, 'sheet.html'), html);
  const sheet = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  await sheet.goto('file://' + path.join(OUT, 'sheet.html'));
  await sheet.waitForTimeout(500);
  await sheet.screenshot({ path: path.join(OUT, 'sheet.png'), fullPage: true });
  console.log('done', list.filter(e => !e.error).length);
  await browser.close(); server.close();
});
