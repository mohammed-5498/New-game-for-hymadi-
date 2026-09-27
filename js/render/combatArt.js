// رسم الوحدات بنظام الوضعيات v2 (القسم 5.4.6): poseOf و drawOne منقولتان من docs/combat-reference.html
// ومربوطتان بحقول الوحدة في اللعبة، مع كل الآثار: أثر السلاح، والشرر عند الارتطام، وشرر الصدّ،
// ونجوم الترنّح، ووميض الإصابة، وحلقة الضربة الدائرية. شبحا التفادي يرسمهما units.js حول هذه الدالة.
import { COMBAT, COMBAT_REALISM as CR } from '../config.js';
import {
  TAU, ease, limb, ell, tri, keyPose, ATK, DODGE, BLOCK,
  poseIdle, poseWalk, poseStagger, addFlinch, poseDeath, drawBody, wdir
} from './anim.js';
import { BODIES, tipOf } from './bodies.js';
import { ultGlow } from './unitsArt.js';

export const MOVE_AR = { quick: 'سريعة', heavy: 'قوية', thrust: 'طعنة', spin: 'دائرية', shoot: 'رمي بالقوس', throw: 'رمي' };
export const ST_AR = { dodge: 'تفادٍ', block: 'صدّ', stagger: 'ترنّح' };

// الضربة المميزة تستعمل مفاتيح أقرب حركة للوحدة (مع الوهج الذهبي الموجود)
const ULT_MOVE = {
  pierce: 'thrust', flurry: 'quick', slam: 'heavy', shot: 'shoot', fire: 'throw',
  buff: 'heavy', heal: 'heavy', arc: 'spin', arrows: 'shoot', bash: 'thrust', harden: 'block'
};
const RANGED = { shoot: true, throw: true };

// الخط الزمني القياسي من أزمنة الحركة الحقيقية (canonA في المرجع)
function canonA(ph, T) {
  if (T < ph.wind) return 0.34 * T / ph.wind;
  if (T < ph.wind + ph.strike) return 0.34 + 0.10 * (T - ph.wind) / ph.strike;
  if (T < ph.wind + ph.strike + ph.hold) return 0.44 + 0.09 * (T - ph.wind - ph.strike) / ph.hold;
  return Math.min(1, 0.53 + 0.47 * (T - ph.wind - ph.strike - ph.hold) / ph.rec);
}

// الحركة الجارية وتقدمها على الخط القياسي: الحركات الأربع، أو الرمي البعيد، أو الضربة المميزة
function swingOf(unit, time) {
  if (unit.cMove && unit.cPhases && unit.attackStart !== null) {
    return { key: unit.cMove, a: canonA(unit.cPhases, unit.cMoveT), ult: false };
  }
  if (unit.attackStart === null || !unit.attackRate) return null;
  const elapsed = time - unit.attackStart;
  if (elapsed < 0 || elapsed >= unit.attackRate) return null;
  const a = elapsed / unit.attackRate;            // الارتطام عند 0.47 يقع داخل تجمّد الخط القياسي
  const ult = unit.ultStart !== null && time - unit.ultStart < unit.ultRate;
  if (ult) return { key: ULT_MOVE[unit.stats.ult.kind] || 'heavy', a, ult: true };
  return { key: unit.stats.projectile === 'arrow' ? 'shoot' : unit.stats.projectile ? 'throw' : 'quick', a, ult: false };
}

// تسمية الحالة لوضع التفاصيل
export function stateLabel(unit, time) {
  if (unit.state === 'dead') return '';
  if (unit.cState) return ST_AR[unit.cState] + (unit.cState === 'dodge' ? (unit.dodgeType === 'duck' ? ' بالانحناء' : ' بالقفز') : '');
  const sw = swingOf(unit, time);
  if (sw) return (sw.ult ? 'مميزة: ' : '') + (MOVE_AR[sw.key] || ST_AR[sw.key] || sw.key);
  return '';
}

// poseOf في المرجع
function poseOf(unit, time, animT, walking, sw) {
  let p;
  if (sw) {
    p = sw.key === 'block' ? keyPose(BLOCK, sw.a) : keyPose(ATK[sw.key], sw.a);
    if (sw.key === 'shoot') p = Object.assign({}, p, { pull: sw.a < 0.47 ? ease(Math.min(1, sw.a / 0.34)) : 0 });
    else if (sw.key === 'throw') p = Object.assign({}, p, { thrown: sw.a >= 0.47 && sw.a < 0.9 });
    else if (sw.key === 'block') p = Object.assign({}, p, { blocking: true });
  } else if (unit.cState === 'dodge') {
    p = keyPose(DODGE[unit.dodgeType || 'leap'], 1 - unit.cTimer / CR.dodgeTime);
  } else if (unit.cState === 'block') {
    p = Object.assign({}, keyPose(BLOCK, 1 - unit.cTimer / CR.blockTime), { blocking: true });
    const im = unit.blockFlash / 0.2;
    if (im > 0) { p.cb -= 0.35 * im; p.px -= 1.6 * im; p.ht -= 0.2 * im; p.fh = [p.fh[0] - 1.8 * im, p.fh[1]]; }
  } else if (unit.cState === 'stagger') {
    p = poseStagger(animT, Math.min(1, Math.max(0, unit.cTimer) / 0.4));
  } else {
    const t = unit.target;
    const combat = !!t && t.state !== 'dead' && t.hp > 0 &&
      Math.hypot(t.x - unit.x, t.y - unit.y) < CR.combatPoseTiles;
    p = walking ? poseWalk(animT, unit.stats.speed / 2.2, combat) : poseIdle(animT, combat);
  }
  if (unit.flinch > 0) p = addFlinch(p, Math.sin(Math.PI * unit.flinch / CR.flinchTime), unit.flinchBack);
  return p;
}

// السلاح ذو اليدين يضع اليد الخلفية على المقبض تلقائياً
function twoHand(ud, p) {
  if (!ud.twoH) return p;
  const d = wdir(p.wa);
  p = Object.assign({}, p);
  p.bh = [p.fh[0] - d[0] * 3.2, p.fh[1] - d[1] * 3.2];
  return p;
}

// drawOne في المرجع. ghosts: عدد أشباح أثر السلاح (0 في المستوى المبسّط).
export function drawOne(ctx, unit, key, x, y, scale, color, time, walking, ghosts, alpha = 1) {
  const ud = BODIES[key] || BODIES.crow_common;
  const animT = time + (unit.id % 17) * 0.13;
  const dead = unit.state === 'dead';
  const sw = dead ? null : swingOf(unit, time);
  const p = twoHand(ud, dead ? poseDeath() : poseOf(unit, time, animT, walking, sw));
  const a = sw ? sw.a : -1;
  const melee = sw && !RANGED[sw.key] && sw.key !== 'block';

  let dir = unit.facing || 1;
  if (sw && sw.key === 'spin' && a > 0.35 && a < 0.42) dir = -dir;      // لفّة كاملة بصرياً

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale * dir * ud.sx, scale * ud.sy);

  if (dead) {
    const deadT = COMBAT.deathTime - unit.deathTimer, k = ease(Math.min(1, deadT * 1.25));
    ctx.globalAlpha *= deadT > 0.72 ? Math.max(0, 1 - (deadT - 0.72) / 0.28) : 1;
    ell(ctx, 0, 0.6, (ud.shadowW || 4) * (1 + k * 0.5), 1.6, 'rgba(0,0,0,0.3)');
    ctx.translate(-k * 3.4, 0); ctx.rotate(-k * 1.5708);
  } else {
    if (ud.ground) ud.ground(ctx, color, animT);
    if (sw && sw.ult) ultGlow(ctx, { a });                             // الوهج الذهبي الموجود
    const s = 1 - (p.air || 0) * 0.35;
    ell(ctx, 0, 0.6, (ud.shadowW || (ud.twoH ? 4.6 : 3.8)) * s, 1.6 * s, 'rgba(0,0,0,' + (0.3 * s) + ')');
  }

  // حلقة الضربة الدائرية
  if (sw && sw.key === 'spin' && a > 0.34 && a < 0.62) {
    const g = (a - 0.34) / 0.28;
    ctx.save(); ctx.globalAlpha *= Math.max(0, 1 - g) * 0.85;
    ctx.beginPath(); ctx.ellipse(0, -5, 13 + g * 7, 5.5 + g * 2.6, 0, 0, TAU);
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore();
  }

  // أثر السلاح: أشباح متتابعة خلف الضربة (المستوى الكامل فقط)
  if (ghosts > 0 && melee && a >= 0.34 && a < 0.55 && ud.weapon) {
    const L = ud.tipLen || (ud.twoH ? 8.6 : ud.wlen), butt = ud.butt || 3.4;
    for (let i = ghosts; i >= 1; i--) {
      const pa = twoHand(ud, keyPose(ATK[sw.key], a - i * 0.028)), d = wdir(pa.wa);
      const s0 = ud.twoH ? [pa.fh[0] - d[0] * butt, pa.fh[1] - d[1] * butt] : pa.fh;
      ctx.save(); ctx.globalAlpha *= 0.14 * (4 - i);
      limb(ctx, s0[0], s0[1], pa.fh[0] + d[0] * L, pa.fh[1] + d[1] * L, ud.twoH ? 2.2 : 1.6, '#f3eee2');
      ctx.restore();
    }
  }

  const J = drawBody(ctx, p, color, ud);

  // الشرر عند الارتطام
  if (melee && a >= 0.42 && a < 0.6 && ud.weapon) {
    const g = 1 - (a - 0.42) / 0.18, t = tipOf(ud, J, p);
    ctx.save(); ctx.globalAlpha *= g * 0.95;
    for (let i = 0; i < 6; i++) {
      const an = i * 1.047 + 0.3;
      limb(ctx, t[0], t[1], t[0] + Math.cos(an) * (2 + g * 3.6), t[1] + Math.sin(an) * (2 + g * 3.6), 0.9, '#ffe08a');
    }
    ell(ctx, t[0], t[1], 1.2 + g * 2.2, 1.2 + g * 2.2, 'rgba(255,236,170,' + (g * 0.7) + ')');
    ctx.restore();
  }

  if (!dead) {
    // وميض الإصابة على الصدر والرأس
    if (unit.hitFlash > 0) {
      ctx.save(); ctx.globalAlpha *= Math.min(1, unit.hitFlash / 0.1) * 0.55;
      ell(ctx, J.chest[0], J.chest[1] - 1, 5.5, 9, '#ffffff'); ell(ctx, J.head[0], J.head[1], 3.6, 3.6, '#ffffff');
      ctx.restore();
    }
    // شرر الصدّ
    if (unit.cState === 'block' && unit.blockFlash > 0) {
      const g = unit.blockFlash / 0.2, h = J.handF;
      ctx.save(); ctx.globalAlpha *= g;
      ctx.beginPath(); ctx.arc(h[0] + 3, h[1], 5 + (1 - g) * 6, -1.1, 1.1);
      ctx.strokeStyle = '#bfe2ff'; ctx.lineWidth = 1.6; ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const an = -0.9 + i * 0.45;
        limb(ctx, h[0] + 4, h[1], h[0] + 4 + Math.cos(an) * (4 + (1 - g) * 5), h[1] + Math.sin(an) * (4 + (1 - g) * 5), 0.9, '#ffffff');
      }
      ctx.restore();
    }
    // نجوم الترنّح حول الرأس
    if (unit.cState === 'stagger') {
      for (let i = 0; i < 3; i++) {
        const an = animT * 8 + i * 2.1, sx = J.head[0] + Math.cos(an) * 4.6, sy = J.head[1] - 4.6 + Math.sin(an) * 1.4;
        tri(ctx, [sx - 1, sy], [sx, sy - 1.6], [sx + 1, sy], '#ffd66e');
        tri(ctx, [sx - 1, sy], [sx, sy + 1.6], [sx + 1, sy], '#ffd66e');
      }
    }
  }
  ctx.restore();
}

// شرر تصادم الأسلحة في منتصف المسافة بين المتصادمين (إحداثيات العالم)
export function drawClash(ctx, x, y, t) {
  const g = 1 - t / CR.clashFxSeconds;
  if (g <= 0) return;
  ctx.save(); ctx.globalAlpha = g; ctx.strokeStyle = '#fff3c0'; ctx.lineWidth = 0.9;
  for (let i = 0; i < 8; i++) {
    const an = i * 0.785, r1 = 1.4, r2 = 3 + (1 - g) * 5;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r1, y + Math.sin(an) * r1);
    ctx.lineTo(x + Math.cos(an) * r2, y + Math.sin(an) * r2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,240,190,' + (g * 0.7) + ')';
  ctx.beginPath(); ctx.arc(x, y, 1 + (1 - g) * 2, 0, TAU); ctx.fill();
  ctx.restore();
}
