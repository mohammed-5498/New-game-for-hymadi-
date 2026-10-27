// يفتح صفحة التجربة (والخادم المحلي يعمل من جذر المستودع) ويصوّر إطارات الحركة كلها أو ورقة فحص
// node docs/rig-test/shot.mjs <مجلد الإخراج> <frames|rest|diff|parts|poses|stills|at:t1,t2,...> [fps]
// RIG_URL يغيّر العنوان (الافتراضي http://127.0.0.1:8765/docs/rig-test/test.html)
// PLAYWRIGHT مسار مكتبة playwright إن لم تكن مثبتة في المشروع
import fs from 'node:fs';
import path from 'node:path';

let pw;
try { pw = (await import('playwright')).default; }
catch { pw = (await import(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright/index.js')).default; }

const [outDir, mode = 'frames', fpsArg] = process.argv.slice(2);
if (!outDir) {
  console.log('node docs/rig-test/shot.mjs <مجلد الإخراج> <frames|rest|diff|parts|poses|stills|at:t1,t2> [fps]');
  process.exit(1);
}
const url = (process.env.RIG_URL || 'http://127.0.0.1:8765/docs/rig-test/test.html') + '?capture';

const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 2400, height: 1500 } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text()); });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto(url);
await page.evaluate(() => window.ready);
fs.mkdirSync(outDir, { recursive: true });
const grab = async (name) => {
  const data = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
  fs.writeFileSync(path.join(outDir, name), Buffer.from(data.split(',')[1], 'base64'));
};

if (mode === 'frames') {
  const fps = Number(fpsArg || 30);
  const total = await page.evaluate(() => window.TOTAL);
  const n = Math.round(total * fps);
  for (let k = 0; k < n; k++) {
    await page.evaluate((t) => window.frame(t), k / fps);
    await grab(`f${String(k).padStart(4, '0')}.png`);
  }
  console.log('frames', n, 'total', total);
} else if (mode.startsWith('at:')) {
  for (const t of mode.slice(3).split(',').map(Number)) {
    await page.evaluate((t) => window.frame(t), t);
    await grab(`at_${t}.png`);
  }
} else {
  const r = await page.evaluate((w) => window.sheet(w), mode);
  if (r !== undefined) console.log(mode, r);
  await grab(`${mode}.png`);
}
await browser.close();
