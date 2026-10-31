// رسم الوحدات بنظام الوضعيات v2 (القسم 5.4.6): poseOf و drawOne منقولتان من docs/combat-reference.html
// ومربوطتان بحقول الوحدة في اللعبة، مع كل الآثار: أثر السلاح، والشرر عند الارتطام، وشرر الصدّ،
// ونجوم الترنّح، ووميض الإصابة، وحلقة الضربة الدائرية. شبحا التفادي يرسمهما units.js حول هذه الدالة.
// (القسم 5.4.8) والحركات القريبة بلغة سلاح كل شخصية (fightAnim.js): عقدة شجرة التتابع التي اختارها القتال،
// والتجمّد عند الارتطام وإطار الارتطام، ومزج الوضعيات فلا قفزة إلى الوقفة، والإصابة والارتداد والموت للأمام أو للخلف.
// sub: ما مضى من التحديث الجاري، فتتحرك الوضعيات بسلاسة إطار الشاشة لا بخطوات التحديث (20 في الثانية)
import { COMBAT, COMBAT_REALISM as CR, FIGHT, TILE_HALF_W, TILE_HALF_H } from '../config.js';
import {
  TAU, ease, limb, bone3, ell, tri, rot, add, keyPose, ATK, DODGE, BLOCK,
  poseIdle, poseWalk, poseStagger, poseDown, downAngle, drawBody, wdir, STYLE, softShadow
} from './anim.js';
import { BODIES, tipOf } from './bodies.js';
import { ultGlow } from './unitsArt.js';
import { spriteBody, drawSpriteBody } from './unitSprites.js';
import { fightStyle, fightBig, hitstopOf } from '../game/realism.js';
import {
  nodePose, nodeFlip, nodeStriker, guardPose, walkArms, hitstopTime, flinchPose, hitKind, knockPose,
  deathPose, deathTilt, blendPose, impactKind
} from './fightAnim.js';

export const MOVE_AR = {
  quick: 'سريعة', heavy: 'قوية', thrust: 'طعنة', spin: 'دائرية',
  punch: 'لكمة', kick_front: 'ركلة أمامية', kick_high: 'ركلة عالية', shoot: 'رمي بالقوس', throw: 'رمي'
};
export const ST_AR = { dodge: 'تفادٍ', block: 'صدّ', stagger: 'ترنّح', down: 'على الأرض' };
// عقد شجرة التتابع (القسم 5.4.8) لوضع التفاصيل
const NODE_AR = { L1: 'خفيفة 1', L2: 'خفيفة 2', L3: 'خفيفة 3', L4: 'خفيفة 4', H1: 'قوية', S1: 'خاصة', D: 'اندفاع',
                  F: 'إنهاء', P: 'لكمة', KF: 'ركلة أمامية', KH: 'ركلة عالية' };
// عقدة الحركة حين لا تحملها الوحدة (الضربة المميزة، أو مباراة محفوظة قبل هذا القسم)
const CLASS_NODE = { quick: 'L1', heavy: 'H1', thrust: 'L1', spin: 'S1', punch: 'P', kick_front: 'KF', kick_high: 'KH' };

// الضربة المميزة تستعمل مفاتيح أقرب حركة للوحدة (مع الوهج الذهبي الموجود)
// ضربات أبطال الأمم (القسم 3.10): النداء والصيحة برفع العصا، وإطلاق الصقر من القبضة كالرمي،
// ورقصة الشارع لفّة في كل ضربة منها، ومطر السهام بالقوس، ورقصة الأباتشي لفّة يقذف بها خصمه،
// والرشوة يد ممدودة، وغرس الراية ضربة إلى الأرض
const ULT_MOVE = {
  pierce: 'thrust', flurry: 'quick', slam: 'heavy', shot: 'shoot', fire: 'throw',
  buff: 'heavy', heal: 'heavy', arc: 'spin', arrows: 'shoot', bash: 'thrust', harden: 'block',
  caravan: 'heavy', falcon: 'throw', shout: 'heavy', whirl: 'spin', rain: 'shoot',
  throwdown: 'spin', bribe: 'thrust', banner: 'heavy', haste: 'heavy', knockout: 'punch', roda: 'kick_high', tango: 'spin'
};
const RANGED = { shoot: true, throw: true };

// الخط الزمني القياسي من أزمنة الحركة الحقيقية (canonA في المرجع)
function canonA(ph, T) {
  if (T < ph.wind) return 0.34 * T / ph.wind;
  if (T < ph.wind + ph.strike) return 0.34 + 0.10 * (T - ph.wind) / ph.strike;
  if (T < ph.wind + ph.strike + ph.hold) return 0.44 + 0.09 * (T - ph.wind - ph.strike) / ph.hold;
  return Math.min(1, 0.53 + 0.47 * (T - ph.wind - ph.strike - ph.hold) / ph.rec);
}

// أسلوب الوحدة (سلاحها) وهل هي العضو الضخم: كائن واحد يُعاد ملؤه لكل وحدة (لا كائن جديد في كل إطار)
const FI = { style: 'blade', big: false };
function fightInfo(unit) { FI.style = fightStyle(unit); FI.big = fightBig(unit); return FI; }

// الحركة الجارية وتقدمها على الخط القياسي: الحركات القريبة بعقدتها، أو الرمي البعيد، أو الضربة المميزة
// ud.shoots: مظهر أمة يرمي بالقوس ما يرميه نمطه باليد (رامي السهام المشتعلة، القسم 3.10)
// القريبة: landed أصابت، وstop في تجمّد الارتطام الآن. وحتى يُعرف أأصابت يبقى الرسم عند لحظة الارتطام
function swingOf(unit, time, ud, F, sub = 0) {
  if (unit.cMove && unit.cPhases && unit.attackStart !== null) {
    const ph = unit.cPhases, node = unit.cNode || CLASS_NODE[unit.cMove] || 'L1';
    const hit = ph.wind + ph.strike * CR.strikeMoment;
    let T = Math.min(ph.total, unit.cMoveT + sub), stop = false;
    const landed = unit.landAt >= unit.attackStart;
    if (unit.hitDoneAt >= unit.attackStart) {
      // عُرفت النتيجة: التجمّد هو انتظار معرفتها (أقل من تحديث) أو تجمّد الارتطام إن أصابت، ثم يكمل أسرع قليلاً
      const hs = Math.max(landed && F ? hitstopOf(F.style, node, F.big) : 0, unit.hitDoneAt - unit.attackStart - hit);
      stop = landed && T >= hit && T < hit + hs;
      T = hitstopTime(T, ph, hs);
    } else if (unit.pendingHit && T > hit) T = hit;    // لم تُعرف بعد: يبقى على لحظة الارتطام
    return { key: unit.cMove, a: canonA(ph, T), ult: false, node, landed, stop };
  }
  if (unit.attackStart === null || !unit.attackRate) return null;
  const elapsed = time - unit.attackStart;
  if (elapsed < 0 || elapsed >= unit.attackRate) return null;
  const a = elapsed / unit.attackRate;            // الارتطام عند 0.47 يقع داخل تجمّد الخط القياسي
  const ult = unit.ultStart !== null && time - unit.ultStart < unit.ultRate;
  const shoots = ud && ud.shoots;
  if (ult) {
    const key = ULT_MOVE[unit.stats.ult.kind] || 'heavy', hm = COMBAT.hitMoment;
    // أثر الضربة المميزة عند hitMoment، وارتطام عقد الأسلوب عند 0.40: يُطابَق الخط الزمني للحركات القريبة
    const near = CLASS_NODE[key] ? (a < hm ? a * 0.4 / hm : 0.4 + (a - hm) * 0.6 / (1 - hm)) : a;
    return { key: shoots && key === 'throw' ? 'shoot' : key, a: near, ult: true, node: CLASS_NODE[key], landed: false, stop: false };
  }
  const projectile = unit.stats.projectile;
  const key = projectile === 'arrow' || (shoots && projectile) ? 'shoot' : projectile ? 'throw' : 'quick';
  return { key, a, ult: false, node: 'L1', landed: false, stop: false };
}

// تسمية الحالة لوضع التفاصيل: العقدة في شجرة التتابع ثم الحركة الفعلية
export function stateLabel(unit, time) {
  if (unit.state === 'dead') return '';
  if (unit.cState) return ST_AR[unit.cState] + (unit.cState === 'dodge' ? (unit.dodgeType === 'duck' ? ' بالانحناء' : ' بالقفز') : '');
  const sw = swingOf(unit, time);
  if (!sw) return '';
  const move = MOVE_AR[sw.key] || ST_AR[sw.key] || sw.key;
  if (sw.ult) return 'مميزة: ' + move;
  if (RANGED[sw.key]) return move;
  return (unit.combo && !CR.moves[sw.key]?.unarmed ? 'تتابع: ' : '') + (NODE_AR[sw.node] || sw.node) + ' · ' + move;
}

// الارتداد بقوة (مربع في الثانية): من هذه السرعة يبدأ الانزلاق للخلف، ويكتمل بعدها بهذا القدر
const KNOCK_FROM = 2.2, KNOCK_RANGE = 3;

// poseOf في المرجع، بوقفات السلاح وعقده (القسم 5.4.8) ومزج الوضعيات عند تبدّل الحالة
function poseOf(unit, rt, animT, walking, sw, F, sub) {
  let p, src, dur = FIGHT.blend.react;
  if (sw) {
    if (sw.key === 'block') p = Object.assign({}, keyPose(BLOCK, sw.a), { blocking: true });
    else if (sw.key === 'shoot') p = Object.assign({}, keyPose(ATK.shoot, sw.a), { pull: sw.a < 0.47 ? ease(Math.min(1, sw.a / 0.34)) : 0 });
    else if (sw.key === 'throw') p = Object.assign({}, keyPose(ATK.throw, sw.a), { thrown: sw.a >= 0.47 && sw.a < 0.9 });
    else p = nodePose(F.style, sw.node, sw.key, sw.a, F.big);
    src = sw.ult ? 'u' + unit.ultStart : 's' + unit.attackStart;
    dur = FIGHT.blend.swing;
  } else if (unit.cState === 'dodge') {
    p = keyPose(DODGE[unit.dodgeType || 'leap'], 1 - (unit.cTimer - sub) / CR.dodgeTime);
    src = 'dodge';
  } else if (unit.cState === 'block') {
    p = Object.assign({}, keyPose(BLOCK, 1 - (unit.cTimer - sub) / CR.blockTime), { blocking: true });
    const im = (unit.blockFlash - sub) / 0.2;
    if (im > 0) { p.cb -= 0.35 * im; p.px -= 1.6 * im; p.ht -= 0.2 * im; p.fh = [p.fh[0] - 1.8 * im, p.fh[1]]; }
    src = 'block';
  } else if (unit.cState === 'stagger') {
    p = poseStagger(animT, Math.min(1, Math.max(0, unit.cTimer - sub) / 0.4));
    src = 'stagger';
  } else if (unit.cState === 'down') {
    p = poseDown(CR.downTime - (unit.cTimer - sub));           // على الأرض ثم النهوض بالركوع
    src = 'down';
  } else {
    const t = unit.target;
    const combat = !!t && t.state !== 'dead' && t.hp > 0 &&
      Math.hypot(t.x - unit.x, t.y - unit.y) < CR.combatPoseTiles;
    if (combat) p = walking ? walkArms(poseWalk(animT, unit.stats.speed / 2.2, true), F.style, animT, F.big) : guardPose(F.style, animT, F.big);
    else p = walking ? poseWalk(animT, unit.stats.speed / 2.2, false) : poseIdle(animT, false);
    src = walking ? 'w' : combat ? 'g' : 'i';
    dur = walking ? FIGHT.blend.walk : FIGHT.blend.rest;
  }
  // ارتداد بقوة: ينزلق للخلف منحنياً (خارج الضرب والتفادي والسقوط)
  if (!sw && unit.cState !== 'dodge' && unit.cState !== 'down') {
    const v = Math.hypot(unit.vx || 0, unit.vy || 0);
    if (v > KNOCK_FROM) p = knockPose(p, Math.min(1, (v - KNOCK_FROM) / KNOCK_RANGE));
  }
  p = blendPose(unit, src, p, rt, dur);
  // ارتداد الإصابة الخفيفة: يبدأ بعد تجمّد الارتطام، وشكله حسب سلاح الضارب (طعنة، ثقيلة، أو ارتداد الرأس)
  const fl = unit.flinch - sub;
  if (fl > 0) {
    const since = rt - unit.hitAt, recent = since >= 0 && since < CR.flinchTime * CR.pushFlinch + 0.1;
    let f;
    if (recent) {
      const u = (since - unit.hitStop) / Math.max(0.05, fl + since - unit.hitStop);
      f = u <= 0 ? 0 : Math.sin(Math.PI * Math.min(1, u));
    } else f = Math.sin(Math.PI * Math.min(1, fl / CR.flinchTime));
    if (f > 0) p = flinchPose(p, f, unit.flinchBack, recent ? hitKind(unit.hitStyle, unit.hitNode) : 'snap', F.big);
  }
  return p;
}

// السلاح ذو اليدين يضع اليد الخلفية على المقبض تلقائياً (وصور الشخصيات في المتجر)
export function twoHand(ud, p) {
  if (!ud.twoH) return p;
  const d = wdir(p.wa);
  p = Object.assign({}, p);
  p.bh = [p.fh[0] - d[0] * 3.2, p.fh[1] - d[1] * 3.2];
  return p;
}

// الكتف واليد الفعلية لطرف من الوضعية (اليد لا تتجاوز طول الذراع 7.35): لأثر اللكمة وإطار الارتطام
function armOf(p, front) {
  const a2 = p.pl + p.cb, tw = p.tw || 0;
  const C = add(add([p.px, p.py], rot(0, -4.6, p.pl)), rot(0, -4.6, a2));
  const s = add(C, front ? rot(0.9 - 0.9 * tw, 0.5, a2) : rot(-0.9 + 1.5 * tw, 0.7, a2)), t = front ? p.fh : p.bh;
  const dx = t[0] - s[0], dy = t[1] - s[1], d = Math.hypot(dx, dy), k = d > 7.35 ? 7.35 / d : 1;
  return [s, [s[0] + dx * k, s[1] + dy * k]];
}
// الورك والركبة والقدم للرجل الأمامية
function legOf(p) {
  const hx = p.px + 1.2, hy = p.py, k = [hx + Math.sin(p.tf) * 5.8, hy + Math.cos(p.tf) * 5.8];
  return [[hx, hy], k, [k[0] + Math.sin(p.tf - p.kf) * 6, k[1] + Math.cos(p.tf - p.kf) * 6]];
}

// drawOne في المرجع. ghosts: عدد أشباح أثر السلاح (0 في المستوى المبسّط).
// shaded: النمط المظلَّل (المرحلة 9ج) يُشغَّل لعلامات القدمين والظل والجسد فقط، لا للآثار من حوله
export function drawOne(ctx, unit, key, x, y, scale, color, time, walking, ghosts, alpha = 1, shaded = false, sub = 0) {
  // الشخصيات بصورها المعتمدة (unitSprites.js: الكلاسيكية والأمم والشرطة) لوحدات المستوى الكامل وحدها (أقرب 60 في
  // الشاشة): رسم أجزاء الصور أثقل من الخطوط على جهاز بلا تسريع رسومي، فيبقى عددها محدوداً، والباقي بالرسم القديم
  const ud = (unit.lod === 'full' && spriteBody(key)) || BODIES[key] || BODIES.crow_common;
  const rt = time + sub, animT = rt + (unit.id % 17) * 0.13;
  const dead = unit.state === 'dead';
  const F = fightInfo(unit);
  const sw = dead ? null : swingOf(unit, rt, ud, F, sub);
  const deadT = dead ? COMBAT.deathTime - (unit.deathTimer - sub) : 0;
  const pose = dead ? blendPose(unit, 'dead', deathPose(!!unit.deathFront, deadT), rt, FIGHT.blend.react)
    : poseOf(unit, rt, animT, walking, sw, F, sub);
  // اللكمة باليد الحرة: لا تُثبَّت اليد الخلفية على مقبض السلاح ذي اليدين أثناءها
  const p = sw && sw.key === 'punch' ? pose : twoHand(ud, pose);
  const a = sw ? sw.a : -1;
  const melee = !!sw && !RANGED[sw.key] && sw.key !== 'block';
  // الطرف الضارب: السلاح (w) أو يد أو رجل، لأثره وشرره وإطار ارتطامه
  const striker = melee ? nodeStriker(F.style, sw.node, sw.key) : null;

  let dir = unit.facing || 1;
  if (melee && nodeFlip(F.style, sw.node, sw.key, a)) dir = -dir;      // لفّة كاملة بصرياً

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  // المُصاب يرتجف أثناء تجمّد الارتطام
  const shook = rt - unit.hitAt;
  if (!dead && shook >= 0 && shook < unit.hitStop) ctx.translate(Math.sin(shook * 170) * 0.9 * (1 - shook / unit.hitStop) * scale, 0);
  ctx.scale(scale * dir * ud.sx, scale * ud.sy);

  if (dead) {
    // يرتد ثم يسقط على ظهره، أو على وجهه إن قُتل من الخلف، ويرتطم بالأرض فيثور غبار
    const tilt = deathTilt(!!unit.deathFront, deadT), k = Math.abs(tilt) / 1.5708;
    ctx.globalAlpha *= deadT > 0.72 ? Math.max(0, 1 - (deadT - 0.72) / 0.28) : 1;
    ell(ctx, 0, 0.6, (ud.shadowW || 4) * (1 + k * 0.5), 1.6, 'rgba(0,0,0,0.3)');
    const land = deadT - (unit.deathFront ? 0.58 : 0.5);
    if (land > 0 && land < 0.3) dust(ctx, (unit.deathFront ? 9 : -9), land / 0.3, F.big ? 1.5 : 1);
    ctx.translate(tilt * (unit.deathFront ? 1.6 : 2.2), 0); ctx.rotate(tilt);
  } else if (unit.cState === 'down') {                                  // يسقط على ظهره ثم ينهض
    const an = downAngle(CR.downTime - (unit.cTimer - sub));
    ell(ctx, -3, 0.6, 5.5, 1.8, 'rgba(0,0,0,0.3)');
    ctx.translate(an * 2.2, 0); ctx.rotate(an);
  } else {
    if (ud.ground) { STYLE.on = shaded; ud.ground(ctx, color, animT); STYLE.on = false; }
    if (sw && sw.ult) ultGlow(ctx, { a });                             // الوهج الذهبي الموجود
    if (sw && sw.node === 'F' && a > 0.16 && a < 0.6) finisherGlow(ctx, a);
    const s = 1 - (p.air || 0) * 0.35, sw0 = ud.shadowW || (ud.twoH ? 4.6 : 3.8);
    if (shaded) softShadow(ctx, s, sw0 / 3.8);                         // ظل ناعم (style-v5)
    else ell(ctx, 0, 0.6, sw0 * s, 1.6 * s, 'rgba(0,0,0,' + (0.3 * s) + ')');
  }

  // حلقة الضربة الدائرية (ضربة القبضات الأرضية أثرها في الأرض نفسها: drawImpact)
  if (melee && sw.key === 'spin' && sw.node === 'S1' && F.style !== 'fists' && a > 0.34 && a < 0.62) {
    const g = (a - 0.34) / 0.28;
    ctx.save(); ctx.globalAlpha *= Math.max(0, 1 - g) * 0.85;
    ctx.beginPath(); ctx.ellipse(0, -5, 13 + g * 7, 5.5 + g * 2.6, 0, 0, TAU);
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore();
  }

  // أثر الطرف الضارب: اليد اللاكمة أو الرجل الراكلة
  if (ghosts > 0 && striker && striker !== 'w' && a >= 0.3 && a < 0.54) {
    for (let i = ghosts; i >= 1; i--) {
      const pa = nodePose(F.style, sw.node, sw.key, a - i * 0.03, F.big);
      ctx.save(); ctx.globalAlpha *= 0.16 * (4 - i);
      if (striker === 'leg') { const L = legOf(pa); bone3(ctx, L[0], L[1], L[2], ud.lw * 1.1, color); }
      else { const A = armOf(pa, striker === 'fh'); limb(ctx, A[0][0], A[0][1], A[1][0], A[1][1], ud.lw * 1.1, color); }
      ctx.restore();
    }
  }

  // أثر السلاح: أشباح متتابعة خلف الضربة (المستوى الكامل فقط)
  if (ghosts > 0 && striker === 'w' && a >= 0.3 && a < 0.55 && ud.weapon) {
    const L = ud.tipLen || (ud.twoH ? 8.6 : ud.wlen), butt = ud.butt || 3.4;
    for (let i = ghosts; i >= 1; i--) {
      const pa = twoHand(ud, nodePose(F.style, sw.node, sw.key, a - i * 0.028, F.big)), d = wdir(pa.wa), h = armOf(pa, true)[1];
      const s0 = ud.twoH ? [h[0] - d[0] * butt, h[1] - d[1] * butt] : h;
      ctx.save(); ctx.globalAlpha *= 0.14 * (4 - i);
      limb(ctx, s0[0], s0[1], h[0] + d[0] * L, h[1] + d[1] * L, ud.twoH ? 2.2 : 1.6, '#f3eee2');
      ctx.restore();
    }
  }

  STYLE.on = shaded;
  const J = ud.sprite ? drawSpriteBody(ctx, p, color, ud) : drawBody(ctx, p, color, ud);
  STYLE.on = false;

  // إطار الارتطام: أثناء التجمّد يلمع السلاح أو الطرف الضارب، ثم شرر عند رأس السلاح إن أصاب
  if (sw && sw.stop) impactFrame(ctx, ud, J, p, striker);
  if (striker === 'w' && sw.landed && a >= 0.4 && a < 0.58 && ud.weapon) {
    const g = 1 - (a - 0.4) / 0.18, t = tipOf(ud, J, p);
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
    if (unit.hitFlash - sub > 0) {
      ctx.save(); ctx.globalAlpha *= Math.min(1, (unit.hitFlash - sub) / 0.1) * 0.55;
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

// إطار الارتطام: خط أبيض على السلاح ونجمة صغيرة عند رأسه، أو وميض عند القبضة أو القدم
function impactFrame(ctx, ud, J, p, striker) {
  ctx.save();
  if (striker === 'w' && ud.weapon) {
    const t = tipOf(ud, J, p), h = J.handF;
    ctx.globalAlpha *= 0.85;
    limb(ctx, h[0], h[1], t[0], t[1], 1.1, '#ffffff');
    star(ctx, t[0], t[1], 3.2);
  } else if (striker) {
    const q = striker === 'fh' ? J.handF : striker === 'bh' ? J.handB : legOf(p)[2];
    ctx.globalAlpha *= 0.9; star(ctx, q[0], q[1], 3.6);
  }
  ctx.restore();
}
function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const an = i * Math.PI / 4, k = i % 2 ? 0.32 : 1;
    ctx.lineTo(x + Math.cos(an) * r * k, y + Math.sin(an) * r * k);
  }
  ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
}

// وهج ضربة الإنهاء: قوس ذهبي-أحمر خلف القائد في قفزته وهويّه
function finisherGlow(ctx, a) {
  const g = Math.min(1, (a - 0.16) / 0.18) * (a > 0.45 ? Math.max(0, 1 - (a - 0.45) / 0.15) : 1);
  ctx.save(); ctx.globalAlpha *= 0.55 * g;
  ctx.beginPath(); ctx.ellipse(0, -13, 9, 14, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,170,60,0.35)'; ctx.fill();
  ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}

// غبار السقوط: ثلاث سحب صغيرة تتسع وتتلاشى عند (x, 0)
function dust(ctx, x, g, s) {
  ctx.save(); ctx.globalAlpha *= 0.55 * (1 - g);
  for (let i = 0; i < 3; i++) {
    const an = i * 2.1 + 0.6, d = (2 + g * 5) * s;
    ell(ctx, x + Math.cos(an) * d * 1.4, -1 - g * 2 * s + Math.sin(an) * d * 0.35, (2.2 + g * 2.6) * s, (1.2 + g * 1.2) * s, '#cdbb98');
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

// نجمة انفجار الارتطام (burst في المرجع): بيضاء بإطار برتقالي، أكبر للركلات والضربة القوية
// sc: مقياس الوحدة في العالم، g: تقدم النجمة من 0 إلى 1
export function drawBurst(ctx, x, y, g, big, sc) {
  const R = (big ? 10 : 6.5) * sc * (0.6 + g * 0.8), n = big ? 10 : 8;
  ctx.save(); ctx.globalAlpha = Math.max(0, 1 - g);
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const an = i * Math.PI / n + 0.2, r = i % 2 ? R * 0.45 : R;
    ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
  }
  ctx.closePath(); ctx.fillStyle = '#fffdf2'; ctx.fill();
  ctx.lineWidth = Math.max(0.35, 0.7 * sc); ctx.strokeStyle = '#ffb02e'; ctx.stroke();
  ctx.restore();
}

// أثر الارتطام بلغة سلاح الضارب (القسم 5.4.8): gx, gy موضع الارتطام على الأرض، sc مقياس الوحدة في العالم، t عمره بالثواني.
// السكين والسيف ومضة قوس سريعة، والرمح خط سرعة، والقبضات والدرع نجمة وغبار، والمطرقة والضخم وميض قوي وحلقة غبار
// تتسع على الأرض بشقوق (ومعها اهتزاز الوحدات القريبة في renderer.js)، والصقر نجمته القديمة
export function drawImpact(ctx, fx, gx, gy, sc, t) {
  const kind = impactKind(fx), hy = gy - fx.h * sc, B = CR.burstSeconds;
  if (kind === 'star') { if (t < B) drawBurst(ctx, gx, hy, t / B, fx.big, sc); return; }
  // اتجاه الضربة على الشاشة
  let vx = (fx.dx - fx.dy) * TILE_HALF_W, vy = (fx.dx + fx.dy) * TILE_HALF_H;
  const v = Math.hypot(vx, vy) || 1; vx /= v; vy /= v;
  ctx.save();
  if (kind === 'slash' || kind === 'pierce') {
    const g = t / 0.16;
    if (g < 1) {
      ctx.globalAlpha = 1 - g; ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
      if (kind === 'slash') {                       // قوس جرح عمودي على اتجاه الضربة
        const R = 7 * sc * (0.8 + 0.5 * g), an = Math.atan2(vy, vx);
        ctx.lineWidth = 2.6 * sc * (1 - g) + 0.3;
        ctx.beginPath(); ctx.arc(gx - vx * R * 0.6, hy - vy * R * 0.6, R, an - 0.9, an + 0.9); ctx.stroke();
      } else {                                      // خط سرعة على امتداد الطعنة وخطان رفيعان بجانبه
        const L = 15 * sc, nx = -vy * 2.2 * sc, ny = vx * 2.2 * sc;
        ctx.lineWidth = 2 * sc * (1 - g) + 0.3;
        ctx.beginPath(); ctx.moveTo(gx - vx * L, hy - vy * L); ctx.lineTo(gx + vx * L * 0.5, hy + vy * L * 0.5); ctx.stroke();
        ctx.lineWidth = 0.7 * sc;
        ctx.beginPath(); ctx.moveTo(gx - vx * L * 0.9 + nx, hy - vy * L * 0.9 + ny); ctx.lineTo(gx - vx * L * 0.2 + nx, hy - vy * L * 0.2 + ny);
        ctx.moveTo(gx - vx * L * 0.8 - nx, hy - vy * L * 0.8 - ny); ctx.lineTo(gx - vx * L * 0.1 - nx, hy - vy * L * 0.1 - ny); ctx.stroke();
      }
    }
    ctx.restore();
    if (t < B * 0.7) drawBurst(ctx, gx, hy, t / (B * 0.7), false, sc * 0.6);   // ومضة صغيرة سريعة
    return;
  }
  const quake = kind === 'quake', life = quake ? FIGHT.quake.seconds : B, g = t / life;
  if (g < 1) {
    if (quake) {                                    // حلقة غبار تتسع على الأرض وشقوق قصيرة
      const R = (5 + 20 * g) * sc;
      ctx.globalAlpha = 0.75 * (1 - g); ctx.strokeStyle = '#d8c39a'; ctx.lineWidth = 2.4 * sc * (1 - g) + 0.4;
      ctx.beginPath(); ctx.ellipse(gx, gy, R, R * 0.45, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#5a4a36'; ctx.lineWidth = 0.9 * sc; ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const an = i * 1.256 + 0.4, r1 = 2.4 * sc, r2 = (5 + 4 * (i % 2)) * sc * Math.min(1, g * 4);
        ctx.moveTo(gx + Math.cos(an) * r1, gy + Math.sin(an) * r1 * 0.45); ctx.lineTo(gx + Math.cos(an) * r2, gy + Math.sin(an) * r2 * 0.45);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.6 * (1 - g); ctx.fillStyle = '#cdbb98';     // غبار
    for (let i = 0; i < (quake ? 5 : 3); i++) {
      const an = i * 2.4 + 0.5, d = (3 + g * (quake ? 12 : 6)) * sc;
      ctx.beginPath();
      ctx.ellipse(gx + Math.cos(an) * d, gy - 1.5 * sc - g * 4 * sc + Math.sin(an) * d * 0.3, (2.4 + g * 3) * sc, (1.3 + g * 1.5) * sc, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  if (t < B) drawBurst(ctx, gx, hy, t / B, fx.big || quake, quake ? sc * 1.35 : sc);
}

// خطوط سرعة خلف الوحدة المندفعة أو المقذوفة أو المتفادية (speedLines في المرجع)
// vx, vy: اتجاه الحركة على الشاشة بوحدات العالم، speed: سرعتها بالمربعات في الثانية
export function drawSpeedLines(ctx, x, y, vx, vy, speed, sc) {
  if (speed < CR.speedLinesAbove) return;
  const v = Math.hypot(vx, vy) || 1, nx = -vx / v, ny = -vy / v;
  const k = Math.min(1, (speed - CR.speedLinesAbove) / 5.33);
  ctx.save(); ctx.globalAlpha = 0.5 * k; ctx.strokeStyle = '#5b554c'; ctx.lineWidth = 1.2 * sc;
  for (let i = 0; i < 3; i++) {
    const oy = (i - 1) * 7 * sc, ox = -ny * oy, oyy = nx * oy, L = (10 + i * 4) * sc * k;
    ctx.beginPath();
    ctx.moveTo(x + ox + nx * 6 * sc, y - 14 * sc + oyy + ny * 6 * sc);
    ctx.lineTo(x + ox + nx * (6 * sc + L), y - 14 * sc + oyy + ny * (6 * sc + L));
    ctx.stroke();
  }
  ctx.restore();
}
