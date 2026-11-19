// المؤثرات المولَّدة بالكود (js/audio/audio.js، منسوخ من docs/audio.js) ملفات WAV للنسخة الجديدة (ن10):
// كل مؤثر يُرسم في OfflineAudioContext بالكود نفسه، أحادياً بـ 22050 هرتز
// الاستعمال: node scripts/export_synth_sounds.cjs  ← flutter_game/assets/audio/synth/<الاسم>.wav
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'flutter_game/assets/audio/synth');
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html></html>'); return; }
  res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(f).pipe(res);
}).listen(0, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/index-none.html`);
  const out = await page.evaluate(async () => {
    const RATE = 22050, SECONDS = 2.2;
    let current = null;
    // السياق "يعمل" دائماً (المولّد لا يرسم وهو معلَّق)
    class Offline extends OfflineAudioContext {
      constructor() { super(1, RATE * SECONDS, RATE); current = this; }
      get state() { return 'running'; }
      resume() { return Promise.resolve(); }
    }
    window.AudioContext = Offline;
    const wav = (buf) => {
      const d = buf.getChannelData(0);
      let end = d.length;
      while (end > 1 && Math.abs(d[end - 1]) < 1e-4) end--;        // بلا صمت في آخره
      const n = Math.min(d.length, end + 64), bytes = new DataView(new ArrayBuffer(44 + n * 2));
      const str = (o, s) => { for (let k = 0; k < s.length; k++) bytes.setUint8(o + k, s.charCodeAt(k)); };
      str(0, 'RIFF'); bytes.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
      bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true);
      bytes.setUint32(24, RATE, true); bytes.setUint32(28, RATE * 2, true); bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true);
      str(36, 'data'); bytes.setUint32(40, n * 2, true);
      for (let k = 0; k < n; k++) bytes.setInt16(44 + k * 2, Math.max(-1, Math.min(1, d[k])) * 32767, true);
      let s = '';
      const u = new Uint8Array(bytes.buffer);
      for (let k = 0; k < u.length; k++) s += String.fromCharCode(u[k]);
      return btoa(s);
    };
    const result = {};
    const { GameAudio: probe } = await import('/js/audio/audio.js?probe');
    for (const name of probe.names) {
      const { GameAudio } = await import('/js/audio/audio.js?' + name);   // نسخة جديدة لكل مؤثر
      GameAudio.init();
      GameAudio.setVolume(1, 1);
      GameAudio.play(name);
      const buf = await current.startRendering();
      result[name] = wav(buf);
    }
    return result;
  });
  for (const [name, b64] of Object.entries(out)) fs.writeFileSync(path.join(OUT, name + '.wav'), Buffer.from(b64, 'base64'));
  console.log(Object.keys(out).length, 'wav');
  await browser.close();
  server.close();
});
