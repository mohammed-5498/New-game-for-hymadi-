// رسم القتال الواقعي (القسم 5.4.6): منقول كما هو من rigC و drawOne في docs/combat-reference.html
// يحوّل الحالات الجديدة (تفادٍ، صدّ، ترنّح) والحركات الأربع إلى هيكل حركي متوافق مع
// دوال الرسم الموجودة في unitsArt.js، دون تعديل رسم أي وحدة.
import { COMBAT_REALISM as CR } from '../config.js';
import { U, rig, shadow, ell, limb, tri, TAU } from './unitsArt.js';

// هل تحتاج هذه الوحدة الرسم الخاص بالقتال الواقعي؟
export const needsCombatArt = (unit) =>
  !!unit.cState || (!!unit.cMove && unit.attackStart !== null);

// الفكرة: كل حركة لها أزمنتها، فنحوّل زمنها الحقيقي إلى الخط الزمني القياسي للضربة
// (استعداد 0–0.34، ضرب 0.34–0.44، تجمّد 0.44–0.53، تعافٍ 0.53–1) فتعمل الآثار والشرر كما هي.
function combatRig(unit, animT, spd, walking) {
  let R;
  if (unit.cMove && unit.cPhases) {
    const m = CR.moves[unit.cMove], p = unit.cPhases, T = unit.cMoveT;
    let a;
    if (T < p.wind) a = 0.34 * T / p.wind;
    else if (T < p.wind + p.strike) a = 0.34 + 0.10 * (T - p.wind) / p.strike;
    else if (T < p.wind + p.strike + p.hold) a = 0.44 + 0.09 * (T - p.wind - p.strike) / p.hold;
    else a = 0.53 + 0.47 * Math.min(1, (T - p.wind - p.strike - p.hold) / p.rec);

    R = rig({ t: Math.min(0.999, a), state: 'attack', rate: 1, spd });
    R.s *= m.sAmp;
    R.lunge *= m.lunge;
    R.move = unit.cMove;
    R.hipX = R.lunge * 0.55;
    return R;
  }

  R = rig({ t: animT, state: walking ? 'walk' : 'idle', spd });

  if (unit.cState === 'dodge') {
    const g = 1 - unit.cTimer / CR.dodgeTime, sg = Math.sin(Math.PI * g);
    R.st = 'dodge'; R.bounce = -sg * 3.2; R.lean = -0.4 * sg; R.air = sg * 0.8; R.p = 0; R.armPh = 0;
    R.thigh = q => q < 1 ? 0.75 : -0.25; R.flex = () => 1.15; R.s = -0.6; R.lunge = 0;
  } else if (unit.cState === 'block') {
    R.st = 'block'; R.bounce = -0.3; R.lean = -0.12; R.p = 0; R.armPh = 0;
    R.thigh = q => q < 1 ? 0.5 : -0.65; R.flex = () => 0.5; R.s = -0.3;
    R.lunge = -0.9 * unit.blockFlash / 0.2;
  } else if (unit.cState === 'stagger') {
    const d = Math.max(0, unit.cTimer) / 0.4;
    R.st = 'stagger'; R.bounce = -0.4; R.lean = -0.35 + Math.sin(animT * 22) * 0.22 * d; R.p = 0; R.armPh = 0;
    R.thigh = q => q < 1 ? 0.15 : -0.35; R.flex = () => 0.45; R.s = -0.45; R.lunge = -1.2 * d;
  }

  R.hipY = -11 + R.bounce;
  R.hipX = (R.lunge || 0) * 0.55;
  return R;
}

// رسم وحدة في حالة قتال واقعي: الهيكل ثم مؤثرات الصدّ والترنّح والدائرية
export function drawCombatUnit(ctx, unit, key, x, y, scale, color, animT, walking) {
  const art = U[key];
  if (!art) return;
  const r = combatRig(unit, animT, art.spd || 1, walking);
  const dir = unit.facing || 1;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * dir * (art.sx || 1), scale * (art.sy || 1));
  shadow(ctx, r, art.shadowW);

  // دائرة الضربة الدائرية تتوسع حول الضارب
  if (unit.cMove === 'spin' && unit.cPhases) {
    const p = unit.cPhases;
    const g = (unit.cMoveT - p.wind) / (p.strike + p.hold);
    if (g > 0 && g < 1.2) {
      ctx.save();
      ctx.globalAlpha *= Math.max(0, 1 - g) * 0.8;
      ctx.beginPath();
      ctx.ellipse(0, -4, 14 + g * 6, 6 + g * 2.4, 0, 0, TAU);
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }
  }

  art.draw(ctx, r, color);

  // شرر الصدّ
  if (unit.cState === 'block' && unit.blockFlash > 0) {
    const g = unit.blockFlash / 0.2;
    ctx.save();
    ctx.globalAlpha *= g;
    ctx.beginPath();
    ctx.arc(7, -10, 5 + (1 - g) * 6, -1.1, 1.1);
    ctx.strokeStyle = '#bfe2ff';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * 0.45;
      limb(ctx, 8, -10, 8 + Math.cos(a) * (4 + (1 - g) * 5), -10 + Math.sin(a) * (4 + (1 - g) * 5), 0.9, '#ffffff');
    }
    ctx.restore();
  }

  // نجوم الترنّح تدور فوق الرأس
  if (unit.cState === 'stagger') {
    for (let i = 0; i < 3; i++) {
      const a = animT * 8 + i * 2.1;
      tri(ctx,
        [Math.cos(a) * 4.5 - 1, -25 + Math.sin(a) * 1.4],
        [Math.cos(a) * 4.5, -26.6 + Math.sin(a) * 1.4],
        [Math.cos(a) * 4.5 + 1, -25 + Math.sin(a) * 1.4], '#ffd66e');
    }
  }

  // وميض الإصابة
  if (unit.hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha *= Math.min(1, unit.hitFlash / 0.1) * 0.55;
    ell(ctx, 0.5, -12, 5.5, 12.5, '#ffffff');
    ctx.restore();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}
