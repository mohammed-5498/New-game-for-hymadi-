// حركات الفارس الأسود (حزمة المستخدم Black-Knight-Animations): يشغّل knight.js وoutlines.js في صندوق معزول
// (vm بلا require ولا ملفات ولا شبكة) ويطبع لكل حركة ولكل إطار مكان كل قطعة وزاويتها. يستدعيه scripts/import_beasts.py
// الاستعمال: node scripts/knight_frames.cjs <مجلد الحزمة> <إطارات في الثانية>
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = process.argv[2], fps = +process.argv[3] || 15;
class Img { decode() { return Promise.resolve(); } }
const ctx = { window: {}, Math, Object, Promise, Image: Img };
vm.createContext(ctx);
for (const f of ['outlines.js', 'knight.js']) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { timeout: 2000 });
const K = ctx.window.BlackKnight;
K.load('', ctx.window.KnightHulls).then(k => {
  const out = { rig: K.rig, clips: {} };
  for (const [id, c] of Object.entries(K.clips)) {
    const n = Math.round(c.duration * fps), frames = [];
    for (let f = 0; f < (c.loop ? n : n + 1); f++) frames.push(k.transforms(id, Math.min(c.duration, f / fps)));
    out.clips[id] = { duration: c.duration, loop: c.loop, frames };
  }
  process.stdout.write(JSON.stringify(out));
});
