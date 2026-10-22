// صور الشخصيات في المتجر: الشخصيات واقفة بوضعية القتال وبالنمط المظلَّل الكامل (المرحلة 9ج)،
// بنفس رسم المباراة (drawBody) على لوحة بمقاسها الظاهر
import { UNIT_ART, GANGS, nations as NATIONS } from '../config.js';
import { BODIES } from '../render/bodies.js';
import { poseIdle, drawBody, STYLE, softShadow } from '../render/anim.js';
import { twoHand } from '../render/combatArt.js';
import { ART_KEYS } from '../render/units.js';          // ومعه تسجيل مظاهر الأمم
import { NATION_ART } from '../render/nationArt.js';

// مساحة الشخصية بوحدات الجسد (مقيسة لكل الشخصيات): من قمة غطاء الرأس إلى حلقة الأرض تحت القدمين،
// وعرض خانتها في صف الشخصيات (السلاح والحلقة قد يتجاوزانها قليلاً)
const FIT = { top: 38, bottom: 5, slot: 24 };

// أنواع وحدات الجانب بالترتيب: الفرد العادي، الشخصيتان المميزتان، البطل
export function sideKinds(side) {
  const nation = NATIONS[side];
  return ['common', ...GANGS[nation ? nation.style : side].heroes, 'champion'];
}

function bodyKey(side, kind) {
  const art = NATION_ART[side];
  if (art) return (art[kind] || art.common)[0];        // مظهر الأمة الكامل
  const keys = ART_KEYS[side] || ART_KEYS.crows;
  return keys[kind] || keys.common;
}

// الأبطال أكبر من المميزين، والمميزون أكبر من الأفراد، كما في المباراة
const kindScale = (kind) => kind === 'champion' ? UNIT_ART.championScale : kind === 'common' ? 1 : UNIT_ART.heroScale;

// يرسم شخصيات الجانب متجاورة من اليمين، وخلفها وهج بلون glow (لون الأمة الثانوي #rrggbb، اختياري)
export function drawCharacters(canvas, side, kinds, color, glow = null) {
  const box = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.width = Math.max(1, Math.round((box.width || 120) * dpr));
  const h = canvas.height = Math.max(1, Math.round((box.height || 80) * dpr));
  const ctx = canvas.getContext('2d');
  if (glow) {
    const g = ctx.createRadialGradient(w / 2, h * 0.6, 0, w / 2, h * 0.6, Math.max(w, h) * 0.6);
    g.addColorStop(0, glow + '70');
    g.addColorStop(1, glow + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  const big = Math.max(...kinds.map(kindScale));
  const span = kinds.reduce((sum, kind) => sum + FIT.slot * kindScale(kind), 0);
  const s = Math.min(h / ((FIT.top + FIT.bottom) * big), w / span);
  let x = (w + span * s) / 2;
  const y = h - FIT.bottom * big * s;
  kinds.forEach((kind, k) => {
    const ud = BODIES[bodyKey(side, kind)], sc = s * kindScale(kind), slot = FIT.slot * kindScale(kind) * s;
    ctx.save();
    ctx.translate(x - slot / 2, y);
    ctx.scale(-sc * ud.sx, sc * ud.sy);              // تنظر يساراً: اتجاه القراءة
    STYLE.on = true;
    if (ud.ground) ud.ground(ctx, color, 0.3);
    softShadow(ctx, 1, (ud.shadowW || (ud.twoH ? 4.6 : 3.8)) / 3.8);
    drawBody(ctx, twoHand(ud, poseIdle(0.3 + k * 0.17, true)), color, ud);
    STYLE.on = false;
    ctx.restore();
    x -= slot;
  });
}
