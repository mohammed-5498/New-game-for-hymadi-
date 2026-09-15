// رسم الوحدات: يستعمل docs/units-art.js (منسوخ في unitsArt.js) مربوطاً بحالة الوحدة
import { TILE_HALF_W, TILE_HALF_H, COMBAT, PERFORMANCE, UNIT_ART } from '../config.js';
import { UI_LIGHT, mix } from './colors.js';
import { drawUnit as drawUnitArt } from './unitsArt.js';

// مفاتيح الرسم (القسم 13): عصابة الوحدة + نوعها
// common فرد عادي، ثم شخصيتان مميزتان، ثم البطل champion
const ART_KEYS = {
  crows:     { common: 'crow_common',   spear: 'crow_spear',     dual: 'crow_dual',        champion: 'crow_hero' },
  hammers:   { common: 'hammer_common', armored: 'hammer_shield', smasher: 'hammer_breaker', champion: 'hammer_hero' },
  vipers:    { common: 'viper_common',  sniper: 'viper_sniper',  firebomber: 'viper_firebomber', champion: 'viper_hero' },
  scorpions: { common: 'scorp_common',  boss: 'scorp_boss',      medic: 'scorp_medic',     champion: 'scorp_hero' },
  // الشرطة المحايدة (المرحلة 4ج): منطقها لاحقاً، ورسمها جاهز
  police:    { common: 'police_common', captain: 'police_captain' }
};

const artKey = (unit) =>
  (ART_KEYS[unit.gang] || ART_KEYS.crows)[unit.champion ? 'champion' : (unit.hero || 'common')];

const artScale = (unit) => UNIT_ART.scale *
  (unit.champion ? UNIT_ART.championScale : unit.hero ? UNIT_ART.heroScale : 1);

// الشرطة تُرسم بلونها الثابت مهما كان اللاعب
const artColor = (unit) => unit.gang === 'police' ? UNIT_ART.policeColor : unit.color;

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
  const dead = unit.state === 'dead';

  // عند الإبعاد الشديد تكون الوحدة بضعة بكسلات: نرسمها نقطة واحدة
  if (!dead && zoom < PERFORMANCE.unitDetailZoom) {
    // بلون اللاعب دائماً: عند الإبعاد المهم معرفة جيش من أين لا من ضُرب
    ctx.fillStyle = artColor(unit);
    const size = unit.champion ? 6 : unit.hero ? 5 : 4;
    ctx.fillRect(x - size / 2, y - size, size, size);
    return;
  }

  drawUnitArt(ctx, artKey(unit), { x, y, ...artState(unit, time, dead) });
  if (dead) return;

  // شريط الدم للوحدة المتضررة أو المحددة، وللبطل دائماً (القسم 6.6)
  if (unit.hp < unit.maxHp || unit.selected || unit.champion) drawHealthBar(ctx, unit, x, y);
}

// اختيار حالة الرسم وزمنها: الموت ثم الضربة ثم تلقي الضرر ثم الجري أو الوقوف
function artState(unit, time, dead) {
  const common = {
    color: unit.hitFlash > 0 ? mix(artColor(unit), '#ffffff', 0.5) : artColor(unit),
    dir: unit.facing || 1,
    scale: artScale(unit),
    rate: unit.attackRate || unit.stats.attackTime,
    hurtDur: UNIT_ART.hurtSeconds,
    deathDur: COMBAT.deathTime
  };

  // الموت: سقوط واختفاء خلال ثانية (الأنميشن نفسه يدير الدوران والشفافية)
  if (dead) {
    return { ...common, state: 'death', t: COMBAT.deathTime - unit.deathTimer };
  }

  // الضربة أولاً حتى تبقى لحظة الارتطام (47%) مطابقة للضرر الفعلي
  const swing = swingProgress(unit, time);
  if (swing >= 0) return { ...common, state: 'attack', t: swing };

  if (unit.hurtTimer > 0) {
    return { ...common, state: 'hurt', t: UNIT_ART.hurtSeconds - unit.hurtTimer };
  }

  const walking = unit.state === 'moving' || unit.state === 'attackMove' ||
                  (unit.state === 'attacking' && unit.path.length > 0);
  // إزاحة صغيرة لكل وحدة حتى لا تتنفس كل الوحدات معاً
  return { ...common, state: walking ? 'walk' : 'idle', t: time + (unit.id % 17) * 0.13 };
}

function drawHealthBar(ctx, unit, x, y) {
  const w = unit.champion ? 8 : unit.hero ? 6.5 : 5, h = 1.1;
  const top = y + (unit.champion ? UNIT_ART.championHealthBarY
                 : unit.hero ? UNIT_ART.heroHealthBarY : UNIT_ART.healthBarY);
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
