// المخلوقات (القسم 3.11): الفيل الحربي (جايبور) وترول الجبل (القرية النرويجية) يُرسمان بشكلهما لا بهيكل الوحدات.
// الرسم بوحدات محلية: الفرد العادي نحو 30 وحدة طولاً بمقياس 1، فيُضرب كل شيء في مقياس الوحدة (artScale)،
// ويُعكس حسب اتجاهها (facing). المشي يحرك الأرجل، والضربة (cMove) تحرك الخرطوم أو الهراوة، والموت يُسقطه ويخفيه
import { COMBAT } from '../config.js';

const TAU = 6.2831853;

function ell(ctx, x, y, rx, ry, color, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

function shape(ctx, pts, color) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function stroke(ctx, pts, color, width) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

// تقدّم الضربة الجارية من 0 إلى 1 (0 بلا ضربة)
const swingOf = (unit) => (unit.cMove && unit.cPhases ? Math.min(1, unit.cMoveT / unit.cPhases.total) : 0);

// --- الفيل الحربي: جسد رمادي بأرجل غليظة، ورأس بأذن وخرطوم ونابين، وكسوة مزخرفة وغطاء جبهة بلون مالكه،
// وهودج ذهبي بقبة حمراء وفيه فارس بعمامة بلون مالكه ---
function elephant(ctx, color, walkT, swing, flash) {
  const skin = '#8d8884', dark = '#6e6966', light = '#a6a19c';
  const step = (k) => Math.sin(walkT + k * Math.PI) * 1.6;
  const lift = (k) => Math.max(0, Math.sin(walkT + k * Math.PI)) * 1.1;
  const bob = Math.abs(Math.sin(walkT)) * 0.5;
  const lunge = Math.sin(swing * Math.PI) * 2;
  ell(ctx, 1, 0, 15, 4.2, 'rgba(0,0,0,0.25)');
  // الرجلان البعيدتان أولاً
  ctx.fillStyle = dark;
  for (const [lx, k] of [[-8, 1], [6, 0]]) ctx.fillRect(lx - 2 + step(k), -11 - lift(k), 4, 10.6);
  ctx.save();
  ctx.translate(lunge, -bob);
  // الذيل والجسد والبطن
  stroke(ctx, [[-13, -18], [-15.5, -13], [-15, -9]], dark, 0.9);
  ell(ctx, -1, -17, 13.5, 9, skin);
  ell(ctx, 0, -12, 10, 4, dark);
  ell(ctx, -3, -21, 8, 3, light);
  // الكسوة المزخرفة بلون المالك وحافتها الذهبية وشراشيبها
  shape(ctx, [[-10, -24], [7, -24], [8, -14], [-11, -14]], color);
  stroke(ctx, [[-11, -14], [8, -14]], '#e8c45a', 1);
  for (let n = 0; n < 6; n++) ell(ctx, -9.5 + n * 3.3, -12.8, 0.7, 1, '#e8c45a');
  for (let n = 0; n < 3; n++) ell(ctx, -6 + n * 6, -19, 1.3, 1.3, '#e8c45a');
  // الرأس والأذن والعين
  ctx.save();
  ctx.translate(11, -19);
  ctx.rotate(-0.35 * Math.sin(swing * Math.PI));
  ell(ctx, 1.5, -1, 6.5, 6, skin);
  ell(ctx, -1.2, 0, 4, 5.6, dark);
  shape(ctx, [[-0.5, -6], [5, -6.5], [6.5, -2], [0, -2.5]], color);       // غطاء الجبهة
  stroke(ctx, [[0, -2.5], [6.5, -2]], '#e8c45a', 0.8);
  ell(ctx, 4.3, -1.3, 0.8, 0.8, '#1d1a18');
  // الخرطوم: يرتفع مع الضربة، ثم النابان
  const up = Math.sin(swing * Math.PI);
  stroke(ctx, [[6.5, 1], [8.5, 5 - up * 4], [8.6, 10 - up * 9], [10.5, 12 - up * 13]], skin, 3.2);
  stroke(ctx, [[5.5, 2.5], [9.5, 4.2], [11.5, 2.6]], '#f2ecdf', 1.3);
  ctx.restore();
  // الهودج وقبته والفارس
  ctx.fillStyle = '#a8432f';
  ctx.fillRect(-7, -31, 12, 7);
  stroke(ctx, [[-7, -31], [5, -31]], '#e8c45a', 1.2);
  stroke(ctx, [[-7, -24.5], [5, -24.5]], '#e8c45a', 1);
  for (const px of [-6.2, 4.2]) stroke(ctx, [[px, -31], [px, -37]], '#e8c45a', 0.9);
  ell(ctx, -1, -32.5, 1.9, 2.4, '#c98f6a');                                 // وجه الفارس
  ell(ctx, -1, -34.6, 2.2, 1.4, color);                                     // عمامته
  shape(ctx, [[-3, -30.5], [1, -30.5], [1.6, -27.5], [-3.6, -27.5]], color); // كتفاه
  ctx.beginPath();
  ctx.ellipse(-1, -37, 7, 4.2, 0, Math.PI, 0);
  ctx.fillStyle = '#c0392b';
  ctx.fill();
  stroke(ctx, [[-1, -41.2], [-1, -43.5]], '#e8c45a', 0.9);
  ctx.restore();
  // الرجلان القريبتان
  for (const [lx, k] of [[-5, 0], [9, 1]]) {
    ctx.fillStyle = skin;
    ctx.fillRect(lx - 2.3 + step(k), -11 - lift(k), 4.6, 11);
    ctx.fillStyle = '#d8d2c8';
    ctx.fillRect(lx - 2.3 + step(k), -1.2 - lift(k), 4.6, 1.2);
  }
  if (flash) ell(ctx, 0, -18, 14, 10, 'rgba(255,255,255,0.35)');
}

// --- ترول الجبل: جسد ضخم منحنٍ بلون الطحلب، ورأس صغير بأنف كبير وأذنين مدببتين ونابين، وإزار من الفرو،
// وذراعان طويلتان، وهراوة خشبية تُرفع فوق رأسه ثم تهوي مع الضربة ---
function troll(ctx, color, walkT, swing, flash) {
  const skin = color, dark = '#46523f', light = '#86957a';
  const step = (k) => Math.sin(walkT + k * Math.PI) * 2;
  const lift = (k) => Math.max(0, Math.sin(walkT + k * Math.PI)) * 1.3;
  const bob = Math.abs(Math.sin(walkT)) * 0.7;
  ell(ctx, 0, 0, 11, 3.4, 'rgba(0,0,0,0.25)');
  // الرجلان
  for (const k of [0, 1]) {
    const lx = (k ? 3.5 : -3.5) + step(k);
    shape(ctx, [[lx - 2.6, -11], [lx + 2.6, -11], [lx + 2.2, -1.5 - lift(k)], [lx - 2.4, -1.5 - lift(k)]], k ? skin : dark);
    ell(ctx, lx + 0.8, -1 - lift(k), 3.2, 1.4, k ? dark : '#38412f');
  }
  ctx.save();
  ctx.translate(0, -bob);
  // الذراع البعيدة خلف الجسد
  stroke(ctx, [[-4, -22], [-8, -15], [-7.5, -8]], dark, 3.4);
  // الجسد والبطن وبقع الطحلب والإزار
  ell(ctx, 0, -18, 8.5, 9, skin);
  ell(ctx, 2, -15, 5, 5.5, light);
  for (const [px, py] of [[-5, -23], [-3, -19], [-6, -16]]) ell(ctx, px, py, 1.4, 1, '#9fb07c');
  shape(ctx, [[-7.5, -12], [7.5, -12], [6.5, -8], [3, -9.5], [0, -7.5], [-3, -9.5], [-6.5, -8]], '#6b4a2e');
  // الرأس منخفضاً إلى الأمام: الأذن والأنف والعين والنابان والشعر
  ell(ctx, 4.5, -26.5, 4.2, 3.8, skin);
  shape(ctx, [[1.5, -28], [-1.5, -32], [2.5, -29.5]], skin);
  ell(ctx, 8.6, -25.4, 2.6, 1.8, dark);
  ell(ctx, 5.6, -28, 0.6, 0.6, '#1d1a18');
  shape(ctx, [[6, -23.4], [6.8, -21.4], [7.4, -23.4]], '#f2ecdf');
  shape(ctx, [[3.6, -23.6], [4.3, -21.8], [4.9, -23.6]], '#f2ecdf');
  stroke(ctx, [[2, -30], [4, -31.5], [6.5, -30.5]], '#38412f', 1.2);
  // الذراع القريبة بالهراوة: مرفوعة خلف رأسه ثم تهوي إلى الأمام مع الضربة
  const a = swing ? -2.4 + swing * 3.2 : -0.35;
  ctx.save();
  ctx.translate(4, -21);
  ctx.rotate(a);
  stroke(ctx, [[0, 0], [5, 3], [8.5, 4]], skin, 3.6);
  shape(ctx, [[8, 2.4], [22, 1], [23, 5.6], [8.5, 5.6]], '#5a3e26');
  for (const px of [12, 16, 20]) ell(ctx, px, 3, 0.8, 0.8, '#3a2716');
  ell(ctx, 9, 4, 2, 2, skin);
  ctx.restore();
  ctx.restore();
  if (flash) ell(ctx, 0, -18, 9, 10, 'rgba(255,255,255,0.35)');
}

const DRAW = { elephant, troll };

// x وy موضع القدمين، وscale مقياس الوحدة، وcolor لون مالكها
export function drawCreature(ctx, unit, x, y, scale, color, time, walking) {
  const draw = DRAW[unit.creature];
  if (!draw) return;
  const dead = unit.state === 'dead';
  const deadT = dead ? Math.min(1, 1 - unit.deathTimer / COMBAT.deathTime) : 0;
  ctx.save();
  ctx.translate(x, y);
  if (dead) {
    ctx.globalAlpha = deadT > 0.6 ? Math.max(0, 1 - (deadT - 0.6) / 0.4) : 1;
    ctx.rotate(-(unit.facing || 1) * Math.min(1, deadT * 2.2) * 1.2);
  }
  ctx.scale(scale * (unit.facing || 1), scale);
  draw(ctx, color, walking && !dead ? time * 7 : 0, dead ? 0 : swingOf(unit), unit.hitFlash > 0);
  ctx.restore();
}

// صورة المخلوق في خانة التجنيد (قائمة الإسطبل)
export function drawCreatureIcon(canvas, kind, color) {
  const box = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.width = Math.max(1, Math.round((box.width || 120) * dpr));
  const h = canvas.height = Math.max(1, Math.round((box.height || 80) * dpr));
  const ctx = canvas.getContext('2d');
  const draw = DRAW[kind];
  if (!draw) return;
  const s = Math.min(w / 34, h / 48);
  ctx.save();
  ctx.translate(w / 2, h * 0.94);
  ctx.scale(s, s);
  draw(ctx, color, 0, 0, false);
  ctx.restore();
}
