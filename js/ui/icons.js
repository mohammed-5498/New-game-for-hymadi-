// أيقونات خيارات قائمة الإعداد (بطلب المستخدم): طور اللعب، حجم الخريطة، الحد الأقصى للوحدات، الطقس.
// تُرسم بالكود على لوحة بمقاسها الظاهر (بلا صور) بألوان الواجهة، في مساحة 120×80 وسط اللوحة.
import { PLAYER_COLORS, MAP_SIZES, EMPIRE } from '../config.js';
import { getSprite } from '../render/sprites.js';

const GOLD = '#e0b04a', TEXT = '#f3ece0', DIM = '#c4b49c';
const W = 120, H = 80;

// اللوحة بمقاسها الظاهر وكثافة الشاشة (أو مقاسها الافتراضي إن كانت مخفية بعد)
function prepare(canvas) {
  const box = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round((box.width || W) * dpr));
  canvas.height = Math.max(1, Math.round((box.height || H) * dpr));
  const ctx = canvas.getContext('2d');
  const s = Math.min(canvas.width / W, canvas.height / H);
  ctx.setTransform(s, 0, 0, s, (canvas.width - W * s) / 2, (canvas.height - H * s) / 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return ctx;
}

function stroke(ctx, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function fill(ctx, color) {
  ctx.fillStyle = color;
  ctx.fill();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

// معين بنسبة 2:1 مثل مربعات الخريطة
function diamond(ctx, x, y, hw, hh) {
  ctx.beginPath();
  ctx.moveTo(x, y - hh);
  ctx.lineTo(x + hw, y);
  ctx.lineTo(x, y + hh);
  ctx.lineTo(x - hw, y);
  ctx.closePath();
}

function crown(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2, y - h);
  ctx.lineTo(x - w / 4, y - h * 0.55);
  ctx.lineTo(x, y - h * 1.2);
  ctx.lineTo(x + w / 4, y - h * 0.55);
  ctx.lineTo(x + w / 2, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
}

// صورة مبنى من صور صحراء اليمامة (صور المستخدم) قائمة على الأرض عند (x, ground) بارتفاع height
function building(ctx, name, x, ground, height) {
  const sprite = getSprite('yamamah', name);
  if (!sprite || !sprite.img) return;              // لم تُحمَّل بعد: تُرسم في التحديث التالي
  const s = height / sprite.h;
  ctx.drawImage(sprite.img, x - sprite.ax * s, ground - sprite.ay * s, sprite.w * s, sprite.h * s);
}

// --- طور اللعب ---
const MODE_ICONS = {
  // السيطرة الكاملة: علم مغروس في حي
  conquest(ctx) {
    diamond(ctx, 60, 64, 34, 13);
    fill(ctx, 'rgba(224,176,74,.16)');
    stroke(ctx, DIM, 2);
    ctx.beginPath();
    ctx.moveTo(52, 64);
    ctx.lineTo(52, 10);
    stroke(ctx, TEXT, 3.5);
    ctx.beginPath();
    ctx.moveTo(53, 12);
    ctx.bezierCurveTo(64, 7, 72, 18, 86, 13);
    ctx.lineTo(86, 36);
    ctx.bezierCurveTo(72, 41, 64, 30, 53, 35);
    ctx.closePath();
    fill(ctx, GOLD);
  },
  // الوقت بالنقاط: ساعة إيقاف
  points(ctx) {
    ctx.beginPath();
    ctx.rect(54, 9, 12, 7);
    fill(ctx, GOLD);
    circle(ctx, 60, 45, 26);
    fill(ctx, 'rgba(224,176,74,.12)');
    stroke(ctx, GOLD, 4);
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, r0 = k % 3 ? 20 : 17;
      ctx.beginPath();
      ctx.moveTo(60 + Math.cos(a) * r0, 45 + Math.sin(a) * r0);
      ctx.lineTo(60 + Math.cos(a) * 22, 45 + Math.sin(a) * 22);
      stroke(ctx, DIM, 1.6);
    }
    ctx.beginPath();
    ctx.moveTo(60, 45);
    ctx.lineTo(60, 28);
    ctx.moveTo(60, 45);
    ctx.lineTo(72, 51);
    stroke(ctx, TEXT, 3.5);
  },
  // حماية الزعيم: درع بتاج
  regicide(ctx) {
    ctx.beginPath();
    ctx.moveTo(60, 8);
    ctx.lineTo(87, 17);
    ctx.lineTo(85, 43);
    ctx.bezierCurveTo(83, 59, 72, 69, 60, 75);
    ctx.bezierCurveTo(48, 69, 37, 59, 35, 43);
    ctx.lineTo(33, 17);
    ctx.closePath();
    fill(ctx, 'rgba(224,176,74,.14)');
    stroke(ctx, GOLD, 3.5);
    crown(ctx, 60, 50, 28, 16);
    fill(ctx, GOLD);
  },
  // ملك الحي: تاج ذهبي فوق التلة
  king(ctx) {
    ctx.beginPath();
    ctx.moveTo(12, 72);
    ctx.bezierCurveTo(32, 42, 88, 42, 108, 72);
    ctx.closePath();
    fill(ctx, 'rgba(196,180,156,.22)');
    stroke(ctx, DIM, 2);
    crown(ctx, 60, 44, 36, 20);
    fill(ctx, GOLD);
    for (const x of [51, 60, 69]) {
      circle(ctx, x, 38, 2.2);
      fill(ctx, TEXT);
    }
  },
  // الصمود ضد الشرطة: شارة الشرطة
  survival(ctx) {
    ctx.beginPath();
    for (let k = 0; k < 12; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 6, r = k % 2 ? 16 : 31;
      ctx.lineTo(60 + Math.cos(a) * r, 42 + Math.sin(a) * r);
    }
    ctx.closePath();
    fill(ctx, '#4f86cf');
    stroke(ctx, '#a9c8f0', 2.5);
    circle(ctx, 60, 42, 9);
    fill(ctx, GOLD);
  },
  // الإمبراطورية: القاعدة الرئيسية وبرج الرماية بصورتيهما في اليمامة، وقطعة نقاط ذهبية
  empire(ctx) {
    building(ctx, EMPIRE.art.tower, 84, 66, 50);
    building(ctx, 'tower_a', 50, 70, 76);
    circle(ctx, 92, 62, 11);
    fill(ctx, GOLD);
    stroke(ctx, '#8a6420', 2);
    ctx.beginPath();
    ctx.moveTo(92, 56);
    ctx.lineTo(92, 68);
    ctx.moveTo(86, 62);
    ctx.lineTo(98, 62);
    stroke(ctx, '#3a2810', 2.6);
  }
};

export function drawModeIcon(canvas, mode) {
  const ctx = prepare(canvas);
  (MODE_ICONS[mode] || MODE_ICONS.conquest)(ctx);
}

// --- حجم الخريطة: معين المدينة بشبكته يكبر مع الحجم، وعليه نقطة بلون كل لاعب ممكن ---
const SIZE_LOOK = { small: { scale: 0.64, cells: 4 }, medium: { scale: 0.82, cells: 5 }, large: { scale: 1, cells: 6 } };

export function drawSizeIcon(canvas, key) {
  const ctx = prepare(canvas);
  const look = SIZE_LOOK[key] || SIZE_LOOK.medium;
  const hw = 56 * look.scale, hh = 28 * look.scale, cx = 60, cy = 42;
  diamond(ctx, cx, cy, hw, hh);
  fill(ctx, 'rgba(224,176,74,.14)');
  // خطوط الشبكة موازية لضلعي المعين
  ctx.beginPath();
  for (let k = 1; k < look.cells; k++) {
    const t = k / look.cells;
    ctx.moveTo(cx - hw + hw * t, cy - hh * t);
    ctx.lineTo(cx + hw * t, cy + hh - hh * t);
    ctx.moveTo(cx + hw - hw * t, cy - hh * t);
    ctx.lineTo(cx - hw * t, cy + hh - hh * t);
  }
  stroke(ctx, 'rgba(196,180,156,.35)', 1.2);
  diamond(ctx, cx, cy, hw, hh);
  stroke(ctx, GOLD, 2.5);
  const players = MAP_SIZES[key] ? MAP_SIZES[key].maxPlayers : 4;
  for (let k = 0; k < players; k++) {
    const a = -Math.PI / 2 + (k + 0.5) * Math.PI * 2 / players;
    circle(ctx, cx + Math.cos(a) * hw * 0.55, cy + Math.sin(a) * hh * 0.55, 4);
    fill(ctx, PLAYER_COLORS[k].hex);
    stroke(ctx, 'rgba(20,15,10,.7)', 1.2);
  }
}

// --- الحد الأقصى للوحدات: حشد صغير يزداد مع العدد، والبطل الذهبي في المقدمة ---
function figure(ctx, x, y, s, color) {
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, y);
  ctx.lineTo(x, y - 9 * s);
  ctx.lineTo(x + 4 * s, y);
  ctx.moveTo(x, y - 9 * s);
  ctx.lineTo(x, y - 18 * s);
  ctx.moveTo(x - 5 * s, y - 15 * s);
  ctx.lineTo(x + 5 * s, y - 15 * s);
  stroke(ctx, color, 3 * s);
  circle(ctx, x, y - 22 * s, 4.2 * s);
  fill(ctx, color);
}

export function drawUnitsIcon(canvas, count) {
  const ctx = prepare(canvas);
  const total = Math.max(2, Math.round(Math.sqrt(count) * 0.8));
  const perRow = 5, rows = Math.ceil(total / perRow);
  // الصفوف الخلفية أولاً (أصغر وأبهت) حتى يغطيها الصف الأمامي
  for (let r = rows - 1; r >= 0; r--) {
    const inRow = r === rows - 1 ? total - perRow * (rows - 1) : perRow;
    const s = 1 - r * 0.16, y = 74 - r * 13, gap = 19 * s;
    for (let k = 0; k < inRow; k++) {
      const x = 60 + (k - (inRow - 1) / 2) * gap + (r % 2 ? gap / 2 : 0);
      const hero = r === 0 && k === Math.floor((inRow - 1) / 2);
      figure(ctx, x, y, s, hero ? GOLD : r === 0 ? TEXT : r === 1 ? DIM : 'rgba(196,180,156,.6)');
    }
  }
}

// --- الطقس ---
const WEATHER_ICONS = {
  day(ctx) {
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(60 + Math.cos(a) * 23, 40 + Math.sin(a) * 23);
      ctx.lineTo(60 + Math.cos(a) * 32, 40 + Math.sin(a) * 32);
      stroke(ctx, GOLD, 4);
    }
    circle(ctx, 60, 40, 16);
    fill(ctx, GOLD);
  },
  night(ctx) {
    ctx.save();
    circle(ctx, 56, 40, 24);
    fill(ctx, '#f1e3b0');
    ctx.globalCompositeOperation = 'destination-out';
    circle(ctx, 68, 32, 21);
    fill(ctx, '#000');
    ctx.restore();
    for (const [x, y, r] of [[86, 18, 4], [90, 50, 3], [74, 64, 2.5]]) {
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.8);
      ctx.lineTo(x + r * 0.5, y - r * 0.5);
      ctx.lineTo(x + r * 1.8, y);
      ctx.lineTo(x + r * 0.5, y + r * 0.5);
      ctx.lineTo(x, y + r * 1.8);
      ctx.lineTo(x - r * 0.5, y + r * 0.5);
      ctx.lineTo(x - r * 1.8, y);
      ctx.lineTo(x - r * 0.5, y - r * 0.5);
      ctx.closePath();
      fill(ctx, '#f1e3b0');
    }
  },
  snow(ctx) {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
      ctx.moveTo(60, 40);
      ctx.lineTo(60 + c * 30, 40 + s * 30);
      // فرعان صغيران على كل ذراع
      const bx = 60 + c * 19, by = 40 + s * 19;
      for (const side of [-1, 1]) {
        const b = a + side * 0.7;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(b) * 9, by + Math.sin(b) * 9);
      }
    }
    stroke(ctx, '#e8f2fb', 3.5);
  },
  rain(ctx) {
    ctx.beginPath();
    ctx.arc(46, 36, 13, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(62, 28, 17, Math.PI * 1.05, Math.PI * 1.95);
    ctx.arc(79, 37, 12, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
    fill(ctx, '#c9d3df');
    ctx.beginPath();
    for (const x of [46, 60, 74]) {
      ctx.moveTo(x, 57);
      ctx.lineTo(x - 5, 71);
    }
    stroke(ctx, '#7fb2e5', 3.5);
  },
  // عشوائي: علامة استفهام ذهبية
  random(ctx) {
    ctx.fillStyle = GOLD;
    ctx.font = '700 58px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 60, 43);
  }
};

export function drawWeatherIcon(canvas, weather) {
  const ctx = prepare(canvas);
  (WEATHER_ICONS[weather] || WEATHER_ICONS.random)(ctx);
}
