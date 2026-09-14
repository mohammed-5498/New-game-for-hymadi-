// رسم الوحدات: يستعمل docs/units-art.js (منسوخ في unitsArt.js) مربوطاً بحالة الوحدة
import { TILE_HALF_W, TILE_HALF_H, COMBAT, PERFORMANCE, UNIT_ART } from '../config.js';
import { UI_LIGHT, mix } from './colors.js';
import { drawUnit as drawUnitArt } from './unitsArt.js';

// مفاتيح الرسم: عصابة الوحدة + نوعها (عادي أو شخصية مميزة)
const ART_KEYS = {
  crows:     { common: 'crow_common',   runner: 'crow_sprinter', biker: 'crow_biker' },
  hammers:   { common: 'hammer_common', armored: 'hammer_shield', smasher: 'hammer_breaker' },
  vipers:    { common: 'viper_common',  sniper: 'viper_sniper',  firebomber: 'viper_firebomber' },
  scorpions: { common: 'scorp_common',  boss: 'scorp_boss',      medic: 'scorp_medic' }
};

const artKey = (unit) => (ART_KEYS[unit.gang] || ART_KEYS.crows)[unit.hero || 'common'];
const artScale = (unit) => UNIT_ART.scale * (unit.hero ? UNIT_ART.heroScale : 1);

// موقع الوحدة في العالم مع تنعيم بين تحديثين (alpha من 0 إلى 1)
export function unitWorldPos(unit, alpha) {
  const i = unit.prevX + (unit.x - unit.prevX) * alpha;
  const j = unit.prevY + (unit.y - unit.prevY) * alpha;
  return { x: (i - j) * TILE_HALF_W, y: (i + j) * TILE_HALF_H };
}

// هل الوحدة في منتصف ضربة؟ (الرسم يقرأ زمن بدايتها من حالة الوحدة)
function swingProgress(unit, time) {
  if (unit.attackStart === null || !unit.attackRate) return -1;
  const elapsed = time - unit.attackStart;
  return elapsed >= 0 && elapsed < unit.attackRate ? elapsed : -1;
}

export function drawUnit(ctx, unit, alpha, zoom = 99, time = 0) {
  const { x, y } = unitWorldPos(unit, alpha);

  if (unit.state === 'dead') {
    drawDeadUnit(ctx, unit, x, y, time);
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

  const swing = swingProgress(unit, time);
  const walking = unit.state === 'moving' || unit.state === 'attackMove' ||
                  (unit.state === 'attacking' && unit.path.length > 0);

  drawUnitArt(ctx, artKey(unit), {
    x, y,
    // زمن الضربة يبدأ من صفر حتى تتطابق لحظة الارتطام مع الضرر الفعلي
    t: swing >= 0 ? swing : time + (unit.id % 17) * 0.13,
    state: swing >= 0 ? 'attack' : (walking ? 'walk' : 'idle'),
    color: unit.hitFlash > 0 ? mix(unit.color, '#ffffff', 0.5) : unit.color,
    dir: unit.facing || 1,
    scale: artScale(unit),
    rate: unit.attackRate || unit.stats.attackTime
  });

  // شريط الدم يظهر للوحدة المتضررة أو المحددة فقط
  if (unit.hp < unit.maxHp || unit.selected) drawHealthBar(ctx, unit, x, y);
}

// الوحدة الميتة تسقط على جنبها وتختفي خلال ثانية، بلا أثر على الأرض
function drawDeadUnit(ctx, unit, x, y, time) {
  const progress = Math.max(0, Math.min(1, 1 - unit.deathTimer / COMBAT.deathTime));
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.translate(x, y + progress * 1.5);
  ctx.rotate(progress * 1.35 * (unit.facing || 1));
  drawUnitArt(ctx, artKey(unit), {
    x: 0, y: 0, t: time, state: 'idle',
    color: unit.color, dir: unit.facing || 1, scale: artScale(unit),
    rate: unit.stats.attackTime
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawHealthBar(ctx, unit, x, y) {
  const w = unit.hero ? 6.5 : 5, h = 1.1;
  const top = y + (unit.hero ? UNIT_ART.heroHealthBarY : UNIT_ART.healthBarY);
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
