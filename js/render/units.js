// رسم الوحدات: نظام الوضعيات v2 (anim.js + bodies.js + combatArt.js) مربوطاً بحالة الوحدة
import { TILE_HALF_W, TILE_HALF_H, TICK_SEC, COMBAT, COMBAT_REALISM, PERFORMANCE, UNIT_ART, ULT, nations } from '../config.js';
import { UI_LIGHT } from './colors.js';
import { drawOne, stateLabel, drawSpeedLines } from './combatArt.js';
import { flameLayers } from './anim.js';
import { shadedCount } from '../pacing.js';
import { nationArtKey, shotLook } from './nationArt.js';
import { spriteShotLook } from './unitSprites.js';
import './nationsArab.js';                 // مظاهر الدفعة العربية تُسجَّل في سجل الأمم (القسم 3.10)
import './nationsAsia.js';                 // والدفعة الآسيوية
import './nationsEurope.js';               // والدفعة الأوروبية
import './nationsAfrica.js';               // والدفعة الأفريقية
import './nationsLatin.js';                // والدفعة اللاتينية

// الأفراد العاديون بلا ضربة مميزة، فلا نجمة ولا شريط شحن لهم
const hasUlt = (unit) => !!unit.stats.ult;
const ultReady = (unit) => hasUlt(unit) && unit.ultCharge >= ULT.max;

// مفاتيح الرسم (القسم 13): عصابة الوحدة + نوعها (وصور الشخصيات في المتجر)
// common فرد عادي، ثم شخصيتان مميزتان، ثم البطل champion
export const ART_KEYS = {
  crows:     { common: 'crow_common',   spear: 'crow_spear',     dual: 'crow_dual',        champion: 'crow_hero' },
  hammers:   { common: 'hammer_common', armored: 'hammer_shield', smasher: 'hammer_breaker', champion: 'hammer_hero' },
  vipers:    { common: 'viper_common',  sniper: 'viper_sniper',  firebomber: 'viper_firebomber', champion: 'viper_hero' },
  scorpions: { common: 'scorp_common',  boss: 'scorp_boss',      medic: 'scorp_medic',     champion: 'scorp_hero' },
  // الشرطة المحايدة (المرحلة 4ج): منطقها لاحقاً، ورسمها جاهز
  police:    { common: 'police_common', captain: 'police_captain' }
};

// مفتاح غير معروف (عصابة لا تملك هذه الشخصية) يرجع لرسم الفرد العادي بدل ألا يُرسم شيء
// وحدة الأمة (القسم 3.10) بمظهر أمتها: الكامل للوحدة المظللة (المرحلة 9ج)، والمبسّط لغيرها
const artKey = (unit, time, shaded) => {
  const kind = unit.champion ? 'champion' : (unit.hero || 'common');
  const own = unit.nation ? nationArtKey(unit, kind, time, shaded) : null;
  if (own) return own;
  const gang = ART_KEYS[unit.gang] || ART_KEYS.crows;
  return gang[kind] || gang.common;
};

const artScale = (unit) => UNIT_ART.scale *
  (unit.champion ? UNIT_ART.championScale : unit.hero ? UNIT_ART.heroScale : 1) *
  (unit.traits ? unit.traits.size : 1) *     // تنويع حجم بسيط بين الأفراد (القسم 5.4)
  (unit.artScale || 1);                      // قائد الشرطة في الصمود أكبر ×1.3

// حجم رسم الوحدة نسبة إلى الفرد العادي (لصندوقها عند إخفائها خلف المباني)
export const unitSizeFactor = (unit) => artScale(unit) / UNIT_ART.scale;

// الشرطة تُرسم بلونها الثابت مهما كان اللاعب
// (ووحدة التدخل في الصمود بلونها الأغمق الخاص)
const artColor = (unit) => unit.artColor || (unit.gang === 'police' ? UNIT_ART.policeColor : unit.color);

// موقع الوحدة في العالم مع تنعيم بين تحديثين (alpha من 0 إلى 1)
export function unitWorldPos(unit, alpha) {
  const i = unit.prevX + (unit.x - unit.prevX) * alpha;
  const j = unit.prevY + (unit.y - unit.prevY) * alpha;
  return { x: (i - j) * TILE_HALF_W, y: (i + j) * TILE_HALF_H };
}

// shaded: النمط المظلَّل ومظهر الأمة الكامل (يختار renderer.js أقرب وحدات المستوى الكامل، المرحلة 9ج)
export function drawUnit(ctx, unit, alpha, zoom = 99, time = 0, debug = false, crowded = false, shaded = false) {
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

  // نظام الوضعيات v2 لكل الوحدات (القسم 5.4.6). المستوى المبسّط بلا أثر السلاح وبلا شبحي التفادي
  const key = artKey(unit, time, shaded), scale = artScale(unit), color = artColor(unit), walking = isWalking(unit);
  const full = unit.lod === 'full';
  // ما مضى من التحديث الجاري: الوضعيات تتحرك بسلاسة إطار الشاشة لا بخطوات التحديث (القسم 5.4.8)
  const sub = alpha * TICK_SEC;
  // خطوط السرعة خلف المندفع والمقذوف والمتفادي (القسم 5.4.7)
  if (!dead) {
    const vi = unit.cState === 'dodge' ? unit.dvx : unit.vx, vj = unit.cState === 'dodge' ? unit.dvy : unit.vy;
    const speed = Math.hypot(vi, vj);
    if (speed > COMBAT_REALISM.speedLinesAbove && (full || COMBAT_REALISM.speedLinesSimple)) {
      drawSpeedLines(ctx, x, y, (vi - vj) * TILE_HALF_W, (vi + vj) * TILE_HALF_H, speed, scale);
    }
  }
  if (full && unit.cState === 'dodge') {
    for (let g = 1; g <= 2; g++) {
      const di = unit.dvx * 0.035 * g, dj = unit.dvy * 0.035 * g;
      drawOne(ctx, unit, key, x - (di - dj) * TILE_HALF_W, y - (di + dj) * TILE_HALF_H,
              scale, color, time, walking, 0, 0.18, false, sub);
    }
  }
  const ghosts = full ? (crowded ? COMBAT_REALISM.trailGhostsCrowded : COMBAT_REALISM.trailGhosts) : 0;
  // صيحة الحارة والراية المغروسة (القسم 3.10): حلقة ذهبية تحت قدمي من يصمد بلا ترنّح ولا سقوط،
  // والشرطي المرتشي (رشوة الشرطي) بحلقة خضراء ما دامت الهدنة
  const ring = dead ? null : unit.steadyUntil > time ? nations.fx.steadyRing : unit.bribedUntil > time ? nations.fx.bribeRing : null;
  if (ring) {
    ctx.beginPath();
    ctx.ellipse(x, y + 0.6, 6.2 * scale, 2.5 * scale, 0, 0, 6.2832);
    ctx.strokeStyle = ring;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  drawOne(ctx, unit, key, x, y, scale, color, time, walking, ghosts, 1, shaded, sub);
  if (dead) return;

  // وضع التفاصيل (ثلاث لمسات على شريط المعلومات): اسم الحالة فوق الوحدة
  if (debug) {
    const label = stateLabel(unit, time);
    if (label) {
      ctx.font = '600 3px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.fillStyle = '#fff';
      const ly = y + UNIT_ART.healthBarY - 2.5 * (unit.champion ? 1.3 : 1);
      ctx.strokeText(label, x, ly); ctx.fillText(label, x, ly);
    }
  }

  // شريط الدم للوحدة المتضررة أو المحددة، وللبطل دائماً (القسم 6.6)
  const bar = unit.hp < unit.maxHp || unit.selected || unit.champion;
  if (bar) drawHealthBar(ctx, unit, x, y);

  // شريط الشحن الذهبي تحت شريط الدم للوحدة المحددة أو الجاهزة (القسم 6.7)
  if (hasUlt(unit) && (unit.selected || ultReady(unit))) drawChargeBar(ctx, unit, x, y, bar);
  // نجمة ذهبية صغيرة فوق الوحدة عند الجاهزية
  if (ultReady(unit)) drawReadyStar(ctx, x, y, time);
}

const isWalking = (unit) =>
  unit.state === 'moving' || unit.state === 'attackMove' ||
  (unit.state === 'attacking' && unit.path.length > 0);

function drawHealthBar(ctx, unit, x, y) {
  const w = unit.champion ? 8 : unit.hero ? 6.5 : 5, h = 1.1;
  const top = y + (unit.champion ? UNIT_ART.championHealthBarY
                 : unit.hero ? UNIT_ART.heroHealthBarY : UNIT_ART.healthBarY);
  const ratio = Math.max(0, unit.hp / unit.maxHp);

  ctx.fillStyle = 'rgba(20,18,16,.75)';
  ctx.fillRect(x - w / 2, top, w, h);
  // لون الشريط لون مالك الوحدة، والدم الناقص يُقرأ من طول الشريط
  ctx.fillStyle = artColor(unit);
  ctx.fillRect(x - w / 2, top, w * ratio, h);
}

// شريط الشحن الذهبي، تحت شريط الدم إن كان ظاهراً
function drawChargeBar(ctx, unit, x, y, underHealthBar) {
  const w = unit.champion ? 8 : unit.hero ? 6.5 : 5, h = 0.9;
  const base = unit.champion ? UNIT_ART.championHealthBarY
             : unit.hero ? UNIT_ART.heroHealthBarY : UNIT_ART.healthBarY;
  const top = y + base + (underHealthBar ? UNIT_ART.chargeBarGap : 0);
  const ratio = Math.max(0, Math.min(1, unit.ultCharge / ULT.max));

  ctx.fillStyle = 'rgba(20,18,16,.75)';
  ctx.fillRect(x - w / 2, top, w, h);
  ctx.fillStyle = ratio >= 1 ? '#ffe08a' : '#c99a2e';
  ctx.fillRect(x - w / 2, top, w * ratio, h);
}

// نجمة ذهبية تنبض فوق رأس الوحدة الجاهزة لضربتها المميزة
function drawReadyStar(ctx, x, y, time) {
  const pulse = 0.85 + 0.15 * Math.sin(time * 6);
  const r = UNIT_ART.starSize * pulse, inner = r * 0.42;
  const top = y + UNIT_ART.starY;

  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const angle = -Math.PI / 2 + k * Math.PI / 5;
    const radius = k % 2 ? inner : r;
    const px = x + Math.cos(angle) * radius, py = top + Math.sin(angle) * radius;
    k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffe08a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,60,10,.7)';
  ctx.lineWidth = 0.4;
  ctx.stroke();
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

  if (shot.kind === 'falcon') { drawFalcon(ctx, shot, x, (i + j) * TILE_HALF_H, progress, t); return; }
  // سهام مطر السهام (القسم 3.10): قوس عالٍ تسقط منه على المساحة، والسهم باتجاه طيرانه
  if (shot.area > 0) {
    const arc = nations.fx.rainArc;
    aimedArrow(ctx, shot, x, (i + j) * TILE_HALF_H - 6 - Math.sin(progress * Math.PI) * arc, progress, arc, color);
    return;
  }
  const look = spriteShotLook(shot) || shotLook(shot);
  // السهم المشتعل (رامي السهام المشتعلة): شكل فقط، وقواعده قواعد زجاجة رامي النار
  if (look === 'firearrow') {
    const head = aimedArrow(ctx, shot, x, y, progress, COMBAT.projectileArc, PROJECTILE_COLORS.arrow);
    if (shadedCount()) { flameLayers(ctx, head.x, head.y + 0.8, 0.7); return; }    // لهب بطبقات (المرحلة 9ج) ما دام النمط مشغلاً
    ctx.beginPath(); ctx.ellipse(head.x, head.y, 1.2, 1.5, 0, 0, 6.2832); ctx.fillStyle = '#f0902a'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(head.x, head.y - 0.4, 0.6, 0.9, 0, 0, 6.2832); ctx.fillStyle = '#ffd45a'; ctx.fill();
    return;
  }
  // المشعل (رامي المشاعل): عصا تدور في الهواء وفي طرفها لهب، وقواعده أيضاً قواعد زجاجة رامي النار
  if (look === 'torch') {
    const a = progress * 9.4, cx = Math.cos(a) * 2, cy = Math.sin(a) * 1.2;
    ctx.beginPath(); ctx.moveTo(x - cx, y - cy); ctx.lineTo(x + cx, y + cy);
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1; ctx.stroke();
    if (shadedCount()) { flameLayers(ctx, x + cx, y + cy + 0.4, 0.8); return; }
    ctx.beginPath(); ctx.ellipse(x + cx, y + cy - 0.6, 1.5, 2, 0, 0, 6.2832); ctx.fillStyle = '#f0902a'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + cx, y + cy - 0.9, 0.8, 1.2, 0, 0, 6.2832); ctx.fillStyle = '#ffd45a'; ctx.fill();
    return;
  }
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

// سهم بطول 4 باتجاه طيرانه على الشاشة (مع ميل قوس الرمية arc)، ويعيد مكان رأسه
const HEAD = { x: 0, y: 0 };
function aimedArrow(ctx, shot, x, y, progress, arc, color) {
  const dI = shot.x - shot.prevX, dJ = shot.y - shot.prevY, dp = (shot.t - shot.prevT) / shot.duration;
  let vx = (dI - dJ) * TILE_HALF_W, vy = (dI + dJ) * TILE_HALF_H - arc * Math.PI * Math.cos(progress * Math.PI) * dp;
  const n = Math.sqrt(vx * vx + vy * vy);
  if (n > 1e-6) { vx = vx / n * 2; vy = vy / n * 2; } else { vx = 2; vy = -1; }
  ctx.beginPath();
  ctx.moveTo(x - vx, y - vy);
  ctx.lineTo(x + vx, y + vy);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.9;
  ctx.stroke();
  HEAD.x = x + vx; HEAD.y = y + vy;
  return HEAD;
}

// صقر الصقّار (القسم 3.10): يرتفع من ساعده ثم ينقضّ بجناحين مضمومين على صدر الهدف،
// ويعود بقوس ألطف وجناحين يرفرفان. ظل صغير على الأرض تحته
function drawFalcon(ctx, shot, x, ground, progress, t) {
  const back = shot.back;
  const h = back ? 8 + 6 * progress + Math.sin(progress * Math.PI) * 14
                 : 14 - 6 * progress + Math.sin(Math.min(1, progress / 0.8) * Math.PI) * 18;
  const y = ground - h;
  const sx = shot.startX - shot.startY, cx = shot.x - shot.y;
  const dir = cx >= sx ? 1 : -1;
  const dive = !back && progress > 0.62;
  // ارتفاع طرفي الجناحين فوق الجسد: يرفرفان بين المنتصف والأعلى، ومضمومان في الانقضاض
  const flap = dive ? 0.45 : 1.2 + 1.5 * (0.5 + 0.5 * Math.sin(t * 30));

  ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.ellipse(x, ground, 2.4, 1, 0, 0, 6.2832); ctx.fillStyle = '#000'; ctx.fill();
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * 1.5, 1.5);
  if (dive) ctx.rotate(0.75);                          // الرأس للأسفل في الانقضاض
  const tri = (a, b, c, col) => {
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
    ctx.fillStyle = col; ctx.fill();
  };
  tri([-0.4, 0], [-1.4, -flap * 0.85], [1.2, -0.3], '#5a3e28');        // الجناح البعيد
  tri([-2, -0.2], [-3.8, -0.9], [-3.6, 0.9], '#5a3e28');                // الذيل
  ctx.beginPath(); ctx.ellipse(0, 0, 2.3, 1.1, 0, 0, 6.2832); ctx.fillStyle = '#7a5a3e'; ctx.fill();
  ctx.beginPath(); ctx.arc(2.1, -0.5, 0.95, 0, 6.2832); ctx.fillStyle = '#5a3e28'; ctx.fill();
  tri([2.8, -0.8], [3.8, -0.3], [2.8, -0.1], '#e0b24a');                // المنقار
  tri([0.2, 0], [-0.9, -flap], [1.6, -0.2], '#8e6a4a');                // الجناح القريب
  ctx.restore();
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

// الراية المغروسة (غرس الراية، القسم 3.10): دائرة متقطعة بلون صاحبها، وسارية عليها راية بخطوط لونه والذهبي
// تتموج، وتخفت في آخر ثانية من عمرها
export function drawZone(ctx, zone, time) {
  const x = (zone.x - zone.y) * TILE_HALF_W, y = (zone.x + zone.y) * TILE_HALF_H;
  const fade = Math.max(0, Math.min(1, zone.until - time));
  ctx.globalAlpha = 0.85 * fade;
  ctx.beginPath();
  ctx.ellipse(x, y, zone.radius * TILE_HALF_W, zone.radius * TILE_HALF_H, 0, 0, 6.2832);
  ctx.strokeStyle = zone.color;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = fade;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 30);
  ctx.strokeStyle = '#5a4632'; ctx.lineWidth = 1.2; ctx.stroke();
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (let k = pass; k < 5; k += 2) {
      const y0 = y - 29 + k * 2.4, wv = Math.sin(time * 4 + k * 0.9) * 0.9;
      ctx.moveTo(x, y0); ctx.lineTo(x - 13, y0 + wv); ctx.lineTo(x - 13, y0 + 2.4 + wv); ctx.lineTo(x, y0 + 2.4); ctx.closePath();
    }
    ctx.fillStyle = pass ? '#d9a83a' : zone.color;
    ctx.fill();
  }
  ctx.beginPath(); ctx.arc(x, y - 30, 1, 0, 6.2832); ctx.fillStyle = '#c9a04a'; ctx.fill();
  ctx.globalAlpha = 1;
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

  // ألسنة لهب ترتعش (بالنمط المظلَّل ما دام مشغلاً: لهب بطبقات وجمرات بنفس الارتفاع، المرحلة 9ج)
  for (let k = 0; k < 5; k++) {
    const angle = k * 1.257 + fire.x;
    const flicker = 0.6 + 0.4 * Math.sin(time * 9 + k * 2.1);
    const fx = x + Math.cos(angle) * rx * 0.55;
    const fy = y + Math.sin(angle) * ry * 0.55;
    const h = (3 + k % 2 * 2) * flicker * fade;
    if (shadedCount()) { flameLayers(ctx, fx, fy, (h + 3) / 4.4); continue; }
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
