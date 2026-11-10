// صور القوائم للنسخة الجديدة (القسم 18، ن6): الصورة المصغرة لكل مدينة (drawCardThumb) وصف شخصيات كل عصابة وأمة
// (drawCharacters) كما ترسمها اللعبة الحالية نفسها في المتصفح، إلى flutter_game/assets/thumbs/ (webp بعد python)
// الاستعمال: node scripts/export_thumbs.cjs ثم python3 scripts/export_thumbs.py
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'flutter_game', 'assets', 'thumbs', 'png');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
fs.mkdirSync(OUT, { recursive: true });
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (f.endsWith('/')) f += 'index.html';
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 2 });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForTimeout(3000);
  const out = await page.evaluate(async () => {
    const C = await import('/js/config.js');
    const T = await import('/js/ui/cityThumb.js');
    const H = await import('/js/ui/charThumb.js');
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const result = {};
    for (const city of C.CITIES.order) {
      const c = document.createElement('canvas');
      c.style.cssText = 'position:fixed;left:0;top:0;width:260px;height:130px';
      document.body.appendChild(c);
      T.drawCardThumb(c, city);
      for (let k = 0; k < 100 && !c.dataset.done; k++) {
        await wait(100);
        const px = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data;
        if (px[3] > 0 && c.width > 300) break;
      }
      await wait(300);
      result['city_' + city] = c.toDataURL('image/png');
      c.remove();
    }
    const S = await import('/js/render/unitSprites.js');
    const sides = [...Object.keys(C.GANGS), ...C.nations.order];
    // صور الشخصيات: كل الأطالس محمّلة قبل الرسم (وإلا رُسمت بالكود)
    const N = await import('/js/render/nationArt.js'), U = await import('/js/render/units.js');
    const keys = [];
    for (const side of sides) for (const kind of H.sideKinds(side)) {
      const art = N.NATION_ART[side];
      keys.push(art ? (art[kind] || art.common)[0] : (U.ART_KEYS[side][kind] || U.ART_KEYS[side].common));
    }
    for (let t = 0; t < 100 && keys.some(k => !S.spriteBody(k)); t++) await wait(200);
    for (const side of sides) {
      const c = document.createElement('canvas');
      c.style.cssText = 'position:fixed;left:0;top:0;width:240px;height:96px';
      document.body.appendChild(c);
      H.drawCharacters(c, side, H.sideKinds(side), C.PLAYER_COLORS.find(p => p.id === C.STORE.previewColor).hex);
      await wait(1500);
      H.drawCharacters(c, side, H.sideKinds(side), C.PLAYER_COLORS.find(p => p.id === C.STORE.previewColor).hex);
      await wait(200);
      result['side_' + side] = c.toDataURL('image/png');
      c.remove();
    }
    return result;
  });
  for (const [name, url] of Object.entries(out)) fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log(Object.keys(out).length, 'thumbs');
  await browser.close();
  server.close();
});
