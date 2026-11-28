// صور المباراة من نسخة الويب (للفحص فقط، 2.3.x): بعد `flutter build web --release` في flutter_game/:
//   node scripts/flutter_shot.cjs "paris=match=1&size=medium&bots=3&ff=20&spectate=1&temples=1&city=paris&zoom=1.6&cam=park"
// كل وسيط name=query يعطي صورة out/name.png في المجلد الحالي (OUT= لمجلد آخر). خيارات الرابط في _testMatch (lib/main.dart)،
// وcam: i,j أو temple أو merc أو beast أو monument أو park (match_screen.dart). يحتاج Playwright وChromium (موجودان في بيئة الجلسة)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'flutter_game', 'build', 'web');
const OUT = process.env.OUT || path.join(process.cwd(), 'out');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.wasm': 'application/wasm', '.otf': 'font/otf', '.ttf': 'font/ttf', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0, async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const arg of process.argv.slice(2)) {
    const [name, query] = [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)];
    const page = await browser.newPage({ viewport: { width: 868, height: 412 }, deviceScaleFactor: 2, locale: process.env.LOCALE || undefined });
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/?${query}`);
    await page.waitForTimeout(18000);
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    console.log(name, 'errors:', errors.slice(0, 3));
    await page.close();
  }
  await browser.close(); server.close();
});
