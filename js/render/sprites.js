// صور المباني الجاهزة (مدينة صحراء اليمامة): تحميل، ورسم بنقطة ارتكاز، وصبغ المالك والثلج.
// الصور مصغّرة ومصححة الزاوية مسبقاً (أضلاع القاعدة 2:1 كمربعات اللعبة) بدقة PX بكسل لكل وحدة عالم،
// وهي أعلى دقة لقطع المدينة (CITY_CACHE.scales) فتُرسم فيها بلا تكبير.
// لكل مبنى بسطح قناع أبيض بنفس الحجم (<name>-roof.png): السطح يُصبغ بنسبة الأسطح والباقي بنسبة الجدران.
import { CAPTURE } from '../config.js';

export const PX = 5.4;

const sets = new Map();      // اسم المجموعة -> { sprites, pending }
const listeners = [];        // تُستدعى حين تكتمل مجموعة (لإعادة رسم الصور المصغرة مثلاً)
const canDraw = typeof document !== 'undefined' && typeof Image !== 'undefined';

// table: { name: [w, h, ax, ay, roof] } بالبكسل، (ax, ay) مركز قاعدة المبنى داخل الصورة
export function loadSpriteSet(setName, baseUrl, table) {
  if (sets.has(setName)) return sets.get(setName);
  const set = { sprites: {}, pending: 0 };
  sets.set(setName, set);
  for (const [name, [w, h, ax, ay, roof]] of Object.entries(table)) {
    const sprite = { name, w, h, ax, ay, img: null, roof: null, tints: new Map() };
    set.sprites[name] = sprite;
    if (!canDraw) continue;
    const load = (file, done) => {
      set.pending++;
      const img = new Image();
      img.onload = () => { done(img); finish(set); };
      img.onerror = () => { console.warn('تعذر تحميل صورة المبنى: ' + file); finish(set); };
      img.src = new URL(file, baseUrl).href;
    };
    load(name + '.webp', img => { sprite.img = img; });
    if (roof) load(name + '-roof.png', img => { sprite.roof = img; });
  }
  return set;
}

function finish(set) {
  if (--set.pending === 0) for (const fn of listeners) fn();
}

// كل صور المجموعة جاهزة (في Node لا رسم أصلاً: تُعد جاهزة)
export function spriteSetReady(setName) {
  if (!canDraw) return true;
  const set = sets.get(setName);
  return !set || set.pending === 0;
}

export function onSpritesReady(fn) { listeners.push(fn); }

export function getSprite(setName, name) {
  const set = sets.get(setName);
  return set ? set.sprites[name] : null;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// صورة المبنى بلون واحد، شفافيتها وزن الصبغ: السطح 1 والجدران (نسبة الجدران ÷ نسبة الأسطح).
// تُصنع مرة لكل مبنى ولون (ألوان اللاعبين وأبيض الثلج) ولا تتغير بعدها
let temp = null;
function silhouette(sprite, color, roofOnly) {
  const key = color + (roofOnly ? '|roof' : '');
  let c = sprite.tints.get(key);
  if (c) return c;
  c = makeCanvas(sprite.w, sprite.h);
  const g = c.getContext('2d');
  if (!roofOnly) {
    g.drawImage(sprite.img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.globalAlpha = CAPTURE.wallTintAlpha / CAPTURE.roofTintAlpha;
    g.fillStyle = color;
    g.fillRect(0, 0, sprite.w, sprite.h);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
  if (sprite.roof) {
    if (!temp) temp = makeCanvas(sprite.w, sprite.h);
    if (temp.width < sprite.w || temp.height < sprite.h) { temp.width = Math.max(temp.width, sprite.w); temp.height = Math.max(temp.height, sprite.h); }
    const t = temp.getContext('2d');
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, temp.width, temp.height);
    t.drawImage(sprite.roof, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = color;
    t.fillRect(0, 0, sprite.w, sprite.h);
    g.drawImage(temp, 0, 0, sprite.w, sprite.h, 0, 0, sprite.w, sprite.h);
  }
  sprite.tints.set(key, c);
  return c;
}

// رسم المبنى ومركز قاعدته عند (x, y)، بحجم scale (1 = حجمه الأصلي).
// info من cityThemes.getToneInfo(): { color, amount, snow } — الثلج على الأسطح أولاً ثم لون المالك فوقه:
// الإضاءة تقترب من لون المالك بنسبة الأسطح/الجدران (كما في colors.tint)، ثم درجة اللون كاملة على الأسطح
// وبوزن الجدران عليها (نمطا المزج luminosity ثم color)
// flip: معكوسة أفقياً (قطعة على محور i تصير على محور j)
export function drawSprite(ctx, sprite, x, y, info, scale = 1, flip = false) {
  if (!sprite || !sprite.img) return;
  if (flip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    drawSprite(ctx, sprite, 0, 0, info, scale);
    ctx.restore();
    return;
  }
  const s = scale / PX;
  const dx = x - sprite.ax * s, dy = y - sprite.ay * s, dw = sprite.w * s, dh = sprite.h * s;
  const smooth = ctx.imageSmoothingQuality;
  ctx.imageSmoothingQuality = 'high';            // التصغير عند الدقات المنخفضة بلا تشرشر
  ctx.drawImage(sprite.img, dx, dy, dw, dh);
  if (info) {
    if (info.snow && sprite.roof) {
      ctx.globalAlpha = info.snow;
      ctx.drawImage(silhouette(sprite, '#eef2f5', true), dx, dy, dw, dh);
      ctx.globalAlpha = 1;
    }
    if (info.color && info.amount > 0) {
      // الإضاءة أولاً ثم درجة اللون: لو سبقت درجةُ اللون صار الأصفر فوق قبة زرقاء داكنة زيتونياً
      const sil = silhouette(sprite, info.color, false);
      const op = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'luminosity';
      ctx.globalAlpha = CAPTURE.roofTintAlpha * info.amount;
      ctx.drawImage(sil, dx, dy, dw, dh);
      ctx.globalCompositeOperation = 'color';
      ctx.globalAlpha = info.amount;          // درجة اللون كاملة على الأسطح (والجدران بنسبة وزنها في الصورة الملونة)
      ctx.drawImage(sil, dx, dy, dw, dh);
      ctx.globalCompositeOperation = op;
      ctx.globalAlpha = 1;
    }
  }
  ctx.imageSmoothingQuality = smooth;
}

// نفس الرسم مقصوصاً فوق خط مكسور (سور منهار): يبقى من المبنى ما تحت ارتفاع keep وحدة فوق قاعدته.
// slope ميل خط القاعدة على الشاشة (سور على محور j: -0.5، وعلى محور i: +0.5، والبرج: 0)
export function drawSpriteBroken(ctx, sprite, x, y, info, keep, slope, seed) {
  if (!sprite || !sprite.img) return;
  const s = 1 / PX;
  const left = x - sprite.ax * s, right = left + sprite.w * s;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left - 1, y + 40);
  const steps = 9;
  for (let k = 0; k <= steps; k++) {
    const px = left - 1 + (right - left + 2) * k / steps;
    const n = Math.sin((seed + k * 7.13) * 12.9898) * 43758.5453;
    ctx.lineTo(px, y + slope * (px - x) - keep + (n - Math.floor(n) - 0.5) * keep * 0.7);
  }
  ctx.lineTo(right + 1, y + 40);
  ctx.closePath();
  ctx.clip();
  drawSprite(ctx, sprite, x, y, info);
  ctx.restore();
}
