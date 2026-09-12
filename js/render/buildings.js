// رسم المباني بألوان مسطحة (منقول من prototype.html)
import { mix, PALETTES, DARK, LIT_WINDOW, CRATE } from './colors.js';

let ctx = null;
let weather = 'day';
let lights = [];   // مصادر الإضاءة تُجمع أثناء الرسم وتُستخدم ليلاً

export function setFrameContext(context, weatherKey, lightsArray) {
  ctx = context;
  weather = weatherKey;
  lights = lightsArray;
}

// يبيّض اللون في جو الثلج
const snow = (color, amount) => weather === 'snow' ? mix(color, '#eef2f5', amount) : color;

// --- أدوات رسم أساسية ---
function poly(points, color) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let k = 1; k < points.length; k++) ctx.lineTo(points[k][0], points[k][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function circ(x, y, r, color, alpha) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 6.2832);
  ctx.fillStyle = color;
  if (alpha) ctx.globalAlpha = alpha;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function line(x0, y0, x1, y1, color, width) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

function ellipse(x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, 6.2832);
  ctx.fillStyle = color;
  ctx.fill();
}

// صندوق مجسم: واجهة يسار، واجهة يمين، وسطح اختياري
function box(cx, cy, w, d, h, leftColor, rightColor, topColor) {
  poly([[cx - w, cy], [cx, cy + d], [cx, cy + d - h], [cx - w, cy - h]], leftColor);
  poly([[cx, cy + d], [cx + w, cy], [cx + w, cy - h], [cx, cy + d - h]], rightColor);
  if (topColor) poly([[cx - w, cy - h], [cx, cy - d - h], [cx + w, cy - h], [cx, cy + d - h]], snow(topColor, 0.75));
}

// سقف مائل
function roof(cx, cy, w, d, h, rh, leftColor, rightColor) {
  const apex = [cx, cy - h - rh];
  poly([[cx - w, cy - h], apex, [cx + w, cy - h]], '#4a3a30');
  poly([[cx - w, cy - h], [cx, cy + d - h], apex], snow(leftColor, 0.55));
  poly([[cx, cy + d - h], [cx + w, cy - h], apex], snow(rightColor, 0.65));
}

// نافذة على الواجهة اليسرى
function windowL(cx, cy, w, d, u, v, du, dv, color) {
  const q = (a, b) => [cx - w + a * w, cy + a * d - b];
  poly([q(u, v), q(u + du, v), q(u + du, v + dv), q(u, v + dv)], color);
}

// نافذة على الواجهة اليمنى
function windowR(cx, cy, w, d, u, v, du, dv, color) {
  const q = (a, b) => [cx + a * w, cy + d - a * d - b];
  poly([q(u, v), q(u + du, v), q(u + du, v + dv), q(u, v + dv)], color);
}

// يرسم مبنى واحداً في إحداثيات العالم (x, y)
// ownerColor: لون اللاعب المالك للحي (للأعلام)، أو null
export function drawBuilding(type, x, y, region, i, j, ownerColor, detail = true) {
  const g = PALETTES[region] || PALETTES.neutral;
  const variant = (i * 7 + j * 3) % 3;

  if (type === 'H') {                      // بيت بسقف مائل
    const walls = [['#b59a78', '#cdb391'], ['#a88f7a', '#c4ab95'], ['#9f9a86', '#bab5a0']][variant];
    box(x, y + 1, 14, 7, 14, walls[0], walls[1]);
    roof(x, y + 1, 14, 7, 14, 12, g.left, g.right);
    if (detail) {
      windowL(x, y + 1, 14, 7, 0.2, 5, 0.25, 4, DARK);
      windowR(x, y + 1, 14, 7, 0.6, 5, 0.22, 4, DARK);
      windowR(x, y + 1, 14, 7, 0.15, 0, 0.2, 8, '#5b4636');
    }

  } else if (type === 'A') {               // عمارة سكنية بنوافذ بعضها مضاء
    const h = 32 + ((i + j) % 2) * 8;
    box(x, y, 15, 7.5, h, '#8f8c85', '#aaa69e', '#77736c');
    for (let v = 6; detail && v < h - 4; v += 7) {
      [0.15, 0.55].forEach((u, n) => {
        windowL(x, y, 15, 7.5, u, v, 0.25, 4, (i + j + v + n) % 4 === 0 ? LIT_WINDOW : DARK);
        windowR(x, y, 15, 7.5, u, v, 0.25, 4, (i + 2 * j + v + n) % 5 === 0 ? LIT_WINDOW : DARK);
      });
    }
    box(x - 4, y - h, 3, 1.5, 5, '#6b6861', '#7f7c75', '#5e5b55');
    lights.push({ x, y: y - h / 2, r: 20, c: '255,205,120', a: 0.3 });

  } else if (type === 'R') {               // أطلال مهدمة مع ركام
    const w = 14, d = 7;
    poly([[x - w, y - 12], [x, y - d - 10], [x + w, y - 5], [x, y + d - 9]], '#5e574d');
    poly([[x - w, y], [x, y + d], [x, y + d - 9], [x - w * 0.5, y + d * 0.5 - 17], [x - w, y - 12]], '#8a8074');
    poly([[x, y + d], [x + w, y], [x + w, y - 5], [x + w * 0.55, y + d * 0.45 - 13], [x, y + d - 9]], '#a39888');
    windowL(x, y, w, d, 0.3, 4, 0.22, 4, DARK);
    poly([[x + 5, y + 7], [x + 9, y + 4], [x + 14, y + 7], [x + 9, y + 9]], '#6e665b');
    poly([[x - 12, y + 4], [x - 8, y + 2], [x - 4, y + 5], [x - 8, y + 7]], '#7d7466');

  } else if (type === 'F') {               // مصنع بمدخنة ودخان
    box(x, y, 16, 8, 18, '#7a5040', '#945f4b', '#5e4035');
    if (detail) {
      [0.1, 0.4, 0.7].forEach(u => windowL(x, y, 16, 8, u, 7, 0.18, 6, DARK));
      windowR(x, y, 16, 8, 0.35, 0, 0.3, 10, '#4a3b32');
    }
    box(x + 6, y - 19, 3, 1.5, 22, '#5d4a3f', '#6e584b', '#4a3b32');
    circ(x + 7, y - 46, 4, '#a39d95', 0.7);
    circ(x + 11, y - 52, 5, '#a39d95', 0.55);
    circ(x + 16, y - 59, 6, '#a39d95', 0.4);

  } else if (type === 'W') {               // مستودع
    box(x, y, 17, 8.5, 12, '#7f7a70', '#99938a', '#6c675f');
    windowR(x, y, 17, 8.5, 0.3, 0, 0.35, 8, '#4a453f');

  } else if (type === 'G') {               // مخزن السلاح: مستودع مع صناديق
    box(x, y, 17, 8.5, 12, '#7f7a70', '#99938a', '#6c675f');
    windowR(x, y, 17, 8.5, 0.3, 0, 0.35, 8, '#4a453f');
    box(x - 10, y + 5, 4, 2, 4, CRATE[0], CRATE[1], CRATE[2]);
    box(x - 4, y + 8, 3.5, 1.8, 3.5, CRATE[0], CRATE[1], CRATE[2]);
    box(x + 9, y + 4, 4, 2, 5, CRATE[0], CRATE[1], CRATE[2]);

  } else if (type === 'T') {               // شجرة
    const o = ((i + j) % 2) * 3 - 1.5;
    rect(x - 1 + o, y - 8, 2, 8, '#5b4636');
    circ(x + o, y - 13, 7, snow('#4f7a3c', 0.3));
    circ(x - 3 + o, y - 15, 5, snow('#5f8f48', 0.55));
    circ(x + 3 + o, y - 11, 4, snow('#5f8f48', 0.4));

  } else if (type === 'M') {               // أكشاك سوق
    box(x + 2, y - 5, 3, 1.5, 3, CRATE[0], CRATE[1], CRATE[2]);
    [[x - 7, y, '#c24f3e'], [x + 6, y + 3, '#3e6fa0']].forEach(s => {
      box(s[0], s[1], 6, 3, 5, '#8a6a4a', '#a07e5a');
      roof(s[0], s[1], 7, 3.5, 5, 4, s[2], '#e8e0d0');
    });

  } else if (type === 'X') {               // سيارة محطمة
    box(x, y + 2, 8, 4, 4, '#6b4f3a', '#85624a', '#57402f');
    box(x + 1, y - 2, 4, 2, 3, '#3d3a36', '#555049', '#4a4540');

  } else if (type === 'B') {               // برميل نار
    rect(x - 2.5, y - 5, 5, 6, '#4f4337');
    poly([[x - 3, y - 5], [x, y - 13], [x + 3, y - 5]], '#e8893a');
    poly([[x - 1.5, y - 5], [x, y - 9], [x + 1.5, y - 5]], '#f2c14e');
    lights.push({ x, y: y - 7, r: 34, c: '255,150,60', a: 0.65 });

  } else if (type === 'L') {               // عمود إنارة في الشارع
    line(x + 10, y + 3, x + 10, y - 18, '#2b2825', 1.2);
    line(x + 10, y - 18, x + 6, y - 19, '#2b2825', 1);
    circ(x + 6, y - 18.5, 1.6, '#f2e3a8');
    lights.push({ x: x + 6, y: y - 17, r: 12, c: '255,225,160', a: 0.6 });
    lights.push({ x: x + 6, y: y + 1, r: 24, c: '255,215,140', a: 0.28 });

  } else if (type === 'K') {               // خزان ماء
    line(x - 7, y + 2, x - 5, y - 20, '#5d4a3f', 1.5);
    line(x + 7, y + 2, x + 5, y - 20, '#5d4a3f', 1.5);
    line(x, y + 5, x, y - 20, '#5d4a3f', 1.5);
    ellipse(x, y - 20, 8, 3, '#7a6552');
    rect(x - 8, y - 32, 16, 12, '#8c7560');
    ellipse(x, y - 32, 8, 3, '#a08a74');
    poly([[x - 8, y - 32], [x, y - 41], [x + 8, y - 32]], '#6e584b');

  } else if (type === 'Q') {               // مقر العصابة بعلم بلون اللاعب
    box(x, y, 16, 8, 26, g.left, g.right, '#3a3632');
    [[0.2, 8], [0.6, 8], [0.2, 17], [0.6, 17]].forEach(p => {
      windowL(x, y, 16, 8, p[0], p[1], 0.2, 5, '#2b2825');
      windowR(x, y, 16, 8, p[0], p[1], 0.2, 5, '#2b2825');
    });
    line(x, y - 26, x, y - 46, '#2b2825', 1.2);
    poly([[x, y - 46], [x + 12, y - 42], [x, y - 38]], ownerColor || g.flag);
    if (ownerColor) lights.push({ x, y: y - 42, r: 14, c: '255,235,190', a: 0.25 });

  } else if (type === 'C') {               // برج ساعة
    box(x - 4, y - 3, 6, 3, 50, '#c2b79f', '#dad0b8');
    roof(x - 4, y - 3, 6, 3, 50, 12, '#6d4a36', '#86593f');
    circ(x - 1, y - 41, 2.6, '#f2ede4');
    line(x - 1, y - 41, x - 1, y - 43, '#3d3a36', 0.6);
    box(x, y + 2, 16, 8, 14, '#b8ad96', '#d0c6ae');
    roof(x, y + 2, 16, 8, 14, 9, '#6d4a36', '#86593f');
    windowL(x, y + 2, 16, 8, 0.35, 3, 0.15, 7, DARK);
    windowR(x, y + 2, 16, 8, 0.5, 3, 0.15, 7, DARK);

  } else if (type === 'O') {               // نافورة
    ellipse(x, y + 1, 12, 6, '#9a917f');
    ellipse(x, y + 1, 9, 4.3, '#5f8fb0');
    rect(x - 1.2, y - 8, 2.4, 9, '#9a917f');
    ellipse(x, y - 8, 3.5, 1.6, '#7fb0cf');

  } else if (type === 'S') {               // مستشفى مهجور
    box(x, y, 16, 8, 22, '#cfc8ba', '#e4ddcf', '#b3ab9c');
    [[0.15, 6], [0.55, 6], [0.15, 14], [0.55, 14]].forEach((p, n) => {
      windowL(x, y, 16, 8, p[0], p[1], 0.22, 5, n === 1 ? '#6b665c' : DARK);
      windowR(x, y, 16, 8, p[0], p[1], 0.22, 5, DARK);
    });
    rect(x - 4, y - 24, 8, 2.6, '#c0392b');
    rect(x - 1.3, y - 27, 2.6, 8.6, '#c0392b');

  } else if (type === 'P') {               // ساحة العلم (نقطة الاستيلاء)
    poly([[x - 12, y], [x, y - 6], [x + 12, y], [x, y + 6]], '#b3aa98');
    ctx.beginPath();
    ctx.ellipse(x, y, 15, 7.5, 0, 0, 6.2832);
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
    line(x, y, x, y - 22, '#2b2825', 1.2);
    poly([[x, y - 22], [x + 10, y - 19], [x, y - 16]], ownerColor || '#e8e2d6');
    lights.push({ x, y: y - 4, r: 18, c: '255,235,190', a: 0.25 });
  }
}
