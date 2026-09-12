// رسم الأفراد: جسم بلون اللاعب، رأس، ظل، شريط دم، ومضة الضرب، وسقوط الميت
import { TILE_HALF_W, TILE_HALF_H, COMBAT, PERFORMANCE } from '../config.js';
import { UI_LIGHT } from './colors.js';
import { mix } from './colors.js';

// موقع الوحدة في العالم مع تنعيم بين تحديثين (alpha من 0 إلى 1)
export function unitWorldPos(unit, alpha) {
  const i = unit.prevX + (unit.x - unit.prevX) * alpha;
  const j = unit.prevY + (unit.y - unit.prevY) * alpha;
  return { x: (i - j) * TILE_HALF_W, y: (i + j) * TILE_HALF_H };
}

export function drawUnit(ctx, unit, alpha, zoom = 99) {
  const { x, y } = unitWorldPos(unit, alpha);

  if (unit.state === 'dead') {
    drawDeadUnit(ctx, unit, x, y);
    return;
  }

  // عند الإبعاد الشديد تكون الوحدة بضعة بكسلات: نرسمها نقطة واحدة
  if (zoom < PERFORMANCE.unitDetailZoom) {
    // بلون اللاعب دائماً: عند الإبعاد المهم معرفة جيش من أين لا من ضُرب
    ctx.fillStyle = unit.color;
    const size = unit.hero ? 5 : 4;
    ctx.fillRect(x - size / 2, y - size, size, size);
    return;
  }

  // الظل (أكبر قليلاً للشخصيات المميزة)
  ctx.beginPath();
  ctx.ellipse(x, y + 0.5, unit.hero ? 4.4 : 3.5, unit.hero ? 2 : 1.6, 0, 0, 6.2832);
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fill();

  drawBody(ctx, unit, x, y);

  // شريط الدم يظهر للوحدة المتضررة أو المحددة
  if (unit.hp < unit.maxHp || unit.selected) drawHealthBar(ctx, unit, x, y);
}

// ألوان إكسسوارات العصابات
const GEAR = {
  crows:     { hood: '#4f4368' },
  hammers:   { armor: '#8a8a8a', helmet: '#6b6b6b' },
  vipers:    { mask: '#2f4424', cloth: '#4d6b3a', stone: '#9a948c' },
  scorpions: { band: '#a8792f', cloth: '#e8e0d0' }
};
const SKIN = '#d9a77a';

function drawBody(ctx, unit, x, y) {
  const flash = unit.hitFlash > 0;
  const body = flash ? mix(unit.color, '#ffffff', 0.45) : unit.color;
  const skin = flash ? mix(SKIN, '#ffffff', 0.45) : SKIN;
  if (unit.hero) drawHero(ctx, unit, x, y, body, skin);
  else drawNormalUnit(ctx, unit, x, y, body, skin);
}

// --- الفرد العادي مع إكسسوار عصابته ---
function drawNormalUnit(ctx, unit, x, y, body, skin) {
  ctx.fillStyle = body;
  ctx.fillRect(x - 2, y - 7, 4, 6);
  ctx.strokeStyle = '#2b2825';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x - 2, y - 7, 4, 6);

  if (unit.gang === 'hammers') {
    // قطعة درع رمادية على الأكتاف
    ctx.fillStyle = GEAR.hammers.armor;
    ctx.fillRect(x - 2.6, y - 7.4, 5.2, 2);
  }

  if (unit.gang === 'crows') {
    // قلنسوة فوق الرأس
    circle(ctx, x, y - 8.8, 2.7, GEAR.crows.hood);
    circle(ctx, x, y - 8.3, 1.9, skin);
  } else {
    circle(ctx, x, y - 8.5, 2, skin);
  }

  if (unit.gang === 'vipers') {
    // قناع على الوجه وحجر في اليد
    ctx.fillStyle = GEAR.vipers.mask;
    ctx.fillRect(x - 2, y - 9, 4, 1.4);
    circle(ctx, x + 2.9, y - 4.5, 1.1, GEAR.vipers.stone);
  }

  if (unit.gang === 'scorpions') {
    // عصابة رأس
    ctx.fillStyle = GEAR.scorpions.band;
    ctx.fillRect(x - 2.1, y - 9.8, 4.2, 1.1);
  }
}

// --- الشخصيات المميزة: أكبر قليلاً، مبسطة من docs/characters.svg ---
function drawHero(ctx, unit, x, y, body, skin) {
  const dark = '#2b2825';

  if (unit.hero === 'runner') {
    lines(ctx, [[x + 4, y - 8, x + 7.5, y - 8], [x + 4.5, y - 6, x + 8, y - 6], [x + 4, y - 4, x + 7, y - 4]], '#9a948c', 0.7);
    ctx.fillStyle = body;
    ctx.fillRect(x - 2.4, y - 9, 4.8, 7);          // جسم مائل للأمام
    lines(ctx, [[x - 1.5, y - 2, x - 2.6, y], [x + 1, y - 2, x + 2.2, y]], dark, 1);
    circle(ctx, x - 0.4, y - 10.6, 2.5, GEAR.crows.hood);
    circle(ctx, x, y - 10.2, 1.8, skin);

  } else if (unit.hero === 'biker') {
    circle(ctx, x - 3.4, y - 1.4, 2.3, null, '#3a3530', 0.9);   // عجلتان
    circle(ctx, x + 3.4, y - 1.4, 2.3, null, '#3a3530', 0.9);
    lines(ctx, [[x - 3.4, y - 1.4, x + 0.6, y - 2.2], [x + 0.6, y - 2.2, x + 3.4, y - 1.4],
                [x + 0.6, y - 2.2, x - 0.6, y - 5.4], [x + 3.4, y - 1.4, x + 2.4, y - 6]], '#8a7560', 0.9);
    ctx.fillStyle = body;
    ctx.fillRect(x - 2.2, y - 10, 4.4, 5);
    circle(ctx, x + 0.6, y - 11, 2.4, GEAR.crows.hood);
    circle(ctx, x + 1, y - 10.7, 1.7, skin);

  } else if (unit.hero === 'armored') {
    ctx.fillStyle = body;
    ctx.fillRect(x - 2.8, y - 9, 5.6, 8);
    ctx.fillStyle = GEAR.hammers.armor;             // درع الأكتاف
    ctx.fillRect(x - 3.4, y - 9.6, 2.6, 2);
    ctx.fillRect(x + 1, y - 9.6, 2.6, 2);
    circle(ctx, x, y - 11, 2.3, skin);
    ctx.fillStyle = GEAR.hammers.helmet;            // خوذة
    ctx.beginPath();
    ctx.arc(x, y - 11.2, 2.4, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#7a7a7a';                      // درع كبير في اليد
    ctx.fillRect(x - 6, y - 9.5, 3, 8);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 0.4;
    ctx.strokeRect(x - 6, y - 9.5, 3, 8);
    circle(ctx, x - 4.5, y - 5.5, 0.7, '#9a9a9a');

  } else if (unit.hero === 'smasher') {
    lines(ctx, [[x + 3.6, y - 2, x + 2.2, y - 12]], '#6b4a2e', 1.1);   // مطرقة
    ctx.fillStyle = GEAR.hammers.armor;
    poly(ctx, [[x + 0.4, y - 11.4], [x + 4.6, y - 12.8], [x + 3.8, y - 15], [x - 0.4, y - 13.6]]);
    ctx.fillStyle = body;
    ctx.fillRect(x - 2.6, y - 9, 5.2, 8);
    circle(ctx, x, y - 11, 2.3, skin);
    ctx.fillStyle = '#2b2825';                       // شريط على العينين
    ctx.fillRect(x - 2.4, y - 11.8, 4.8, 1.1);

  } else if (unit.hero === 'sniper') {
    ctx.fillStyle = body;
    ctx.fillRect(x - 2.2, y - 9, 4.4, 7.5);
    circle(ctx, x, y - 10.8, 2.2, skin);
    ctx.fillStyle = GEAR.vipers.cloth;               // قلنسوة
    ctx.beginPath();
    ctx.arc(x, y - 11, 2.4, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = GEAR.vipers.mask;
    ctx.fillRect(x - 2.2, y - 10.4, 4.4, 1.2);
    ctx.beginPath();                                 // قوس
    ctx.arc(x + 5.5, y - 7, 3.4, -1.9, 1.9);
    ctx.strokeStyle = '#6b4a2e';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    lines(ctx, [[x + 4.4, y - 10.2, x + 4.4, y - 3.8]], '#cfc8ba', 0.4);

  } else if (unit.hero === 'firebomber') {
    ctx.fillStyle = body;
    ctx.fillRect(x - 2.2, y - 9, 4.4, 7.5);
    ctx.fillStyle = '#5a8a6a';                       // جيوب
    ctx.fillRect(x - 1.8, y - 3.4, 1.4, 2);
    ctx.fillRect(x + 0.4, y - 3.4, 1.4, 2);
    circle(ctx, x, y - 10.8, 2.2, skin);
    ctx.fillStyle = GEAR.vipers.cloth;
    ctx.beginPath();
    ctx.arc(x, y - 11, 2.4, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = GEAR.vipers.mask;
    ctx.fillRect(x - 2.2, y - 10.4, 4.4, 1.2);
    lines(ctx, [[x + 2, y - 8, x + 4, y - 12]], skin, 1);   // ذراع مرفوعة
    ctx.fillStyle = '#5a8a6a';                              // زجاجة
    ctx.fillRect(x + 3.2, y - 15, 1.8, 3.2);
    poly(ctx, [[x + 3.2, y - 15], [x + 4.1, y - 17.6], [x + 5, y - 15]], '#e8893a');
    poly(ctx, [[x + 3.7, y - 15], [x + 4.1, y - 16.4], [x + 4.5, y - 15]], '#f2c14e');

  } else if (unit.hero === 'boss') {
    poly(ctx, [[x - 2.6, y - 9], [x + 2.6, y - 9], [x + 3.4, y - 1], [x - 3.4, y - 1]], body);  // معطف
    poly(ctx, [[x - 0.8, y - 9], [x + 0.8, y - 9], [x, y - 6.4]], GEAR.scorpions.cloth);        // ياقة
    circle(ctx, x, y - 11, 2.2, skin);
    ctx.fillStyle = '#3a3530';                       // قبعة
    ctx.beginPath();
    ctx.ellipse(x, y - 12.6, 3.4, 0.9, 0, 0, 6.2832);
    ctx.fill();
    ctx.fillRect(x - 1.9, y - 15, 3.8, 2.4);
    ctx.fillStyle = GEAR.scorpions.band;
    ctx.fillRect(x - 1.9, y - 13.2, 3.8, 0.5);
    lines(ctx, [[x + 3.8, y - 6.5, x + 4.6, y - 0.5]], '#3a3530', 0.6);   // عصا

  } else if (unit.hero === 'medic') {
    ctx.fillStyle = body;
    ctx.fillRect(x - 2.4, y - 9, 4.8, 8);
    lines(ctx, [[x - 2.2, y - 8.6, x + 2.4, y - 5]], '#8a6a4a', 0.5);     // حزام
    circle(ctx, x, y - 11, 2.2, skin);
    ctx.fillStyle = GEAR.scorpions.cloth;            // عصابة رأس بصليب أحمر
    ctx.fillRect(x - 2.2, y - 12.4, 4.4, 1);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(x - 0.3, y - 12.4, 0.7, 1);
    ctx.fillStyle = GEAR.scorpions.cloth;            // حقيبة إسعاف
    ctx.fillRect(x + 2.6, y - 5.6, 3.6, 2.8);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(x + 4.2, y - 5.2, 0.6, 2);
    ctx.fillRect(x + 3.5, y - 4.5, 2, 0.6);
  }

}

// --- أدوات رسم صغيرة ---
function circle(ctx, x, y, r, fill, strokeColor, width) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 6.2832);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (strokeColor) { ctx.strokeStyle = strokeColor; ctx.lineWidth = width || 0.5; ctx.stroke(); }
}

function lines(ctx, segments, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [x0, y0, x1, y1] of segments) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
  ctx.stroke();
}

function poly(ctx, points, fill) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let k = 1; k < points.length; k++) ctx.lineTo(points[k][0], points[k][1]);
  ctx.closePath();
  if (fill) ctx.fillStyle = fill;
  ctx.fill();
}

// الوحدة الميتة تسقط وتختفي خلال ثانية
function drawDeadUnit(ctx, unit, x, y) {
  const progress = Math.max(0, Math.min(1, 1 - unit.deathTimer / COMBAT.deathTime));
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.translate(x, y);
  ctx.rotate(progress * 1.4);
  ctx.fillStyle = unit.color;
  ctx.fillRect(-2, -7, 4, 6);
  ctx.beginPath();
  ctx.arc(0, -8.5, 2, 0, 6.2832);
  ctx.fillStyle = '#d9a77a';
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawHealthBar(ctx, unit, x, y) {
  const w = unit.hero ? 6.5 : 5, h = 1.1, top = y - (unit.hero ? 17 : 12.5);
  const ratio = Math.max(0, unit.hp / unit.maxHp);

  ctx.fillStyle = 'rgba(20,18,16,.75)';
  ctx.fillRect(x - w / 2, top, w, h);
  ctx.fillStyle = ratio > 0.5 ? '#5fbf5f' : ratio > 0.25 ? '#e0b030' : '#d9463b';
  ctx.fillRect(x - w / 2, top, w * ratio, h);
}

// دائرة التحديد عند القدمين (تُرسم فوق طبقة الليل حتى تبقى واضحة)
export function drawSelectionRing(ctx, unit, alpha) {
  const { x, y } = unitWorldPos(unit, alpha);
  ctx.beginPath();
  ctx.ellipse(x, y, 5.5, 2.8, 0, 0, 6.2832);
  ctx.strokeStyle = UI_LIGHT;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// --- المقذوفات وهي تطير ---
const PROJECTILE_COLORS = {
  stone:  '#9a948c',
  arrow:  '#c8b68a',
  bottle: '#e8893a'
};

export function drawProjectile(ctx, shot, alpha) {
  const i = shot.prevX + (shot.x - shot.prevX) * alpha;
  const j = shot.prevY + (shot.y - shot.prevY) * alpha;
  const t = shot.prevT + (shot.t - shot.prevT) * alpha;

  const x = (i - j) * TILE_HALF_W;
  const progress = Math.max(0, Math.min(1, t / shot.duration));
  // ارتفاع قوس الرمية + ارتفاع اليد
  const y = (i + j) * TILE_HALF_H - 6 - Math.sin(progress * Math.PI) * COMBAT.projectileArc;
  const color = PROJECTILE_COLORS[shot.kind] || PROJECTILE_COLORS.stone;

  if (shot.kind === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(x - 2, y + 1);
    ctx.lineTo(x + 2, y - 1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, 1.4, 0, 6.2832);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,40,37,.8)';   // حد داكن ليظهر المقذوف على أي خلفية
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

// هالة الزعيم: دائرة منقطة عند قدميه
export function drawAura(ctx, unit, alpha) {
  const { x, y } = unitWorldPos(unit, alpha);
  const aura = unit.stats.aura;
  ctx.beginPath();
  ctx.ellipse(x, y, aura.radius * TILE_HALF_W, aura.radius * TILE_HALF_H, 0, 0, 6.2832);
  ctx.strokeStyle = 'rgba(240,182,74,.75)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// نار الزجاجات على الأرض
export function drawFire(ctx, fire, time) {
  const x = (fire.x - fire.y) * TILE_HALF_W;
  const y = (fire.x + fire.y) * TILE_HALF_H;
  const fade = Math.min(1, fire.life / 1);          // يخفت في آخر ثانية
  const rx = fire.radius * TILE_HALF_W, ry = fire.radius * TILE_HALF_H;

  ctx.globalAlpha = 0.45 * fade;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, 6.2832);
  ctx.fillStyle = '#8c3a16';
  ctx.fill();
  ctx.globalAlpha = 1;

  // ألسنة لهب ترتعش
  for (let k = 0; k < 5; k++) {
    const angle = k * 1.257 + fire.x;
    const flicker = 0.6 + 0.4 * Math.sin(time * 9 + k * 2.1);
    const fx = x + Math.cos(angle) * rx * 0.55;
    const fy = y + Math.sin(angle) * ry * 0.55;
    const h = (3 + k % 2 * 2) * flicker * fade;
    ctx.beginPath();
    ctx.moveTo(fx - 1.6, fy);
    ctx.lineTo(fx, fy - h - 3);
    ctx.lineTo(fx + 1.6, fy);
    ctx.closePath();
    ctx.fillStyle = '#e8893a';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(fx - 0.8, fy);
    ctx.lineTo(fx, fy - h - 1);
    ctx.lineTo(fx + 0.8, fy);
    ctx.closePath();
    ctx.fillStyle = '#f2c14e';
    ctx.fill();
  }
}
