// مزايا المدن (القسم 3.11): ما يُرسم منها
// - مبنى الميزة (الهرم) في الطبقة الثابتة بطراز مدينته (landmarks.js بالحرف F)، ويُصبغ بلون مالكه كبقية المباني
// - شارة فوق كل مبنى ميزة وفوق علم كل قرية ينتظر أهلها، كشارات مباني الاقتصاد (empireArt.js)
// - غبار العاصفة الرملية فوق المشهد كله
import { TILE_HALF_W, TILE_HALF_H, EMPIRE as E, CITY_FEATURES as F } from '../config.js';
import { poly, ln, hsh, getTone, getToneInfo, setTone } from './cityThemes.js';
import { tileOf } from '../game/empire.js';
import { stormAt, villageWaiting } from '../game/features.js';

const worldOf = (i, j) => ({ x: (i - j) * TILE_HALF_W, y: (i + j) * TILE_HALF_H });

// ارتفاع قمة كل مبنى ميزة فوق قاعدته، وارتفاع شارة القرية فوق ساحة علمها
const TOPS = { pyramid: 33, village: 24 };

// --- مبنى الميزة في الطبقة الثابتة ---
// معلم لا يُصبغ بلون مالكه (كمعلم المدينة): مالكه من حلقة شارته وأرض حيه وحده
export function drawFeatureBuilding(feature, x, y, i, j) {
  const saved = getTone(), savedInfo = getToneInfo();
  setTone(null);
  if (feature === 'pyramid') pyramid(x, y, i, j);
  setTone(saved, savedInfo);
}

// الهرم: حجر رملي بمداميك ظاهرة، وقمة ذهبية، وحجارة ناقصة هنا وهناك (روح الخراب)، وباب على الواجهة اليمنى
function pyramid(x, y, i, j) {
  const w = 17, d = 8.5, h = 32;
  const L = [x - w, y], Fr = [x, y + d], R = [x + w, y], A = [x, y - h];
  const at = (P, t) => [P[0] + (A[0] - P[0]) * t, P[1] + (A[1] - P[1]) * t];
  poly([[x - w - 2, y + 1], [x, y + d + 2], [x + w + 2, y + 1], [x, y + d - 3]], 'rgba(60,40,20,0.25)');   // ظل القاعدة
  poly([L, Fr, A], '#b69460');
  poly([Fr, R, A], '#d8b77c');
  // مداميك: خطوط موازية للقاعدة على الواجهتين
  for (let k = 1; k < 9; k++) {
    const t = k / 9;
    const a = at(L, t), b = at(Fr, t), c = at(R, t);
    ln(a[0], a[1], b[0], b[1], 'rgba(70,48,24,0.35)', 0.5);
    ln(b[0], b[1], c[0], c[1], 'rgba(90,62,30,0.3)', 0.5);
  }
  // حجارة ناقصة: مواضعها ثابتة لكل مربع
  for (let k = 0; k < 4; k++) {
    const t = 0.15 + hsh(i, j, 860 + k) * 0.6, u = 0.1 + hsh(i, j, 870 + k) * 0.8;
    const right = hsh(i, j, 880 + k) < 0.5;
    const P = right ? at(Fr, t) : at(L, t), Q = right ? at(R, t) : at(Fr, t);
    const m = [P[0] + (Q[0] - P[0]) * u, P[1] + (Q[1] - P[1]) * u];
    poly([[m[0] - 1.4, m[1]], [m[0] + 1.4, m[1] + (right ? -0.7 : 0.7)], [m[0] + 1.4, m[1] - 1.6 + (right ? -0.7 : 0.7)], [m[0] - 1.4, m[1] - 1.6]],
         right ? '#a98a58' : '#8f7246');
  }
  // باب ضيق على الواجهة اليمنى
  const D0 = [Fr[0] + (R[0] - Fr[0]) * 0.42, Fr[1] + (R[1] - Fr[1]) * 0.42];
  poly([[D0[0] - 1.3, D0[1] + 0.6], [D0[0] + 1.3, D0[1] - 0.6], [D0[0] + 1.1, D0[1] - 4.4], [D0[0] - 1.1, D0[1] - 3.2]], '#3a2a18');
  // القمة الذهبية
  const cL = at(L, 0.86), cF = at(Fr, 0.86), cR = at(R, 0.86);
  poly([cL, cF, A], '#c9a032');
  poly([cF, cR, A], '#f2cf5a');
}

// --- الشارات: فوق مبنى الميزة، وفوق علم القرية التي لم ينضم أهلها ---
// مكانها كشارة مباني الاقتصاد (empireArt.badgeOf)، وللمس المبنى في input.js
export function featureBadgeOf(state, d) {
  const B = E.badge, map = state.map;
  const building = d.featureTile !== undefined;
  const at = building ? tileOf(map, d.featureTile) : d.capture, { x, y } = worldOf(at.i, at.j);
  const top = y - TOPS[d.feature];
  const r = Math.max(B.radius, B.minScreen / state.camera.z);
  return { x, y, top, r, cy: top - B.pole - r };
}

const hasBadge = (d) => d.feature && (d.featureTile !== undefined || (villageWaiting(d) && d.capture));

const ICONS = {
  // هرم ذهبي بمدماكين
  pyramid(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - s * 1.1, y + s * 0.7);
    ctx.lineTo(x, y - s * 0.95);
    ctx.lineTo(x + s * 1.1, y + s * 0.7);
    ctx.closePath();
    ctx.fillStyle = '#e8c45a';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.95);
    ctx.lineTo(x + s * 1.1, y + s * 0.7);
    ctx.lineTo(x + s * 0.15, y + s * 0.7);
    ctx.closePath();
    ctx.fillStyle = '#b8902e';
    ctx.fill();
  },
  // ثلاثة من أهل القرية
  village(ctx, x, y, s) {
    ctx.fillStyle = '#efe4cc';
    for (const [dx, k] of [[-0.75, 0.85], [0.75, 0.85], [0, 1]]) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y - s * 0.45 * k, s * 0.3 * k, 0, 6.2832);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + dx * s, y + s * 0.5, s * 0.42 * k, s * 0.5 * k, 0, Math.PI, 0);
      ctx.fill();
    }
  }
};

// فوق طبقة الليل لتُقرأ دائماً (بعد شارات مباني الاقتصاد)
export function drawFeatureBadges(ctx, state, visible) {
  if (!state.feature) return;
  const B = E.badge, z = state.camera.z;
  for (const d of state.map.districts) {
    if (!hasBadge(d)) continue;
    const b = featureBadgeOf(state, d);
    if (!visible(b.x, b.y)) continue;
    ctx.beginPath();
    ctx.moveTo(b.x, b.top + 1);
    ctx.lineTo(b.x, b.cy + b.r);
    ctx.strokeStyle = '#2b2825';
    ctx.lineWidth = Math.max(1.1, 1.6 / z);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x, b.cy, b.r, 0, 6.2832);
    ctx.fillStyle = B.disc;
    ctx.fill();
    ctx.lineWidth = b.r * 0.24;
    ctx.strokeStyle = d.owner !== null ? state.players[d.owner].color : B.neutral;
    ctx.stroke();
    ICONS[d.feature](ctx, b.x, b.cy, b.r * 0.6);
  }
}

// --- غبار العاصفة الرملية: طبقة لون وخطوط رمل تجري مع الريح، تشتد في أولها وتخف في آخرها ---
let sand = [], lastAt = 0;

export function drawStorm(ctx, state, view) {
  if (state.feature !== 'storm') return;
  const S = F.storm, now = stormAt(state.time);
  if (!now.on) return;
  const k = Math.max(0, Math.min(1, now.since / S.fade, now.left / S.fade));
  ctx.fillStyle = 'rgba(' + S.color + ',' + (S.alpha * k).toFixed(3) + ')';
  ctx.fillRect(0, 0, view.w, view.h);

  // الجزيئات بزمن الشاشة (رسم فقط، لا تدخل المحاكاة)، وتقف مع الإيقاف
  const t = performance.now(), dt = state.paused ? 0 : Math.min(0.1, (t - lastAt) / 1000);
  lastAt = t;
  if (sand.length !== S.particles) {
    sand = [];
    for (let n = 0; n < S.particles; n++) {
      sand.push({ x: Math.random() * view.w, y: Math.random() * view.h, v: 260 + Math.random() * 260, l: 8 + Math.random() * 16 });
    }
  }
  ctx.strokeStyle = 'rgba(' + S.streak + ',' + (0.8 * k).toFixed(3) + ')';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const p of sand) {
    p.x -= p.v * dt;
    p.y += p.v * 0.12 * dt;
    if (p.x < -30) { p.x = view.w + Math.random() * 40; p.y = Math.random() * view.h; }
    if (p.y > view.h + 10) p.y = -10;
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.l, p.y - p.l * 0.12);
  }
  ctx.stroke();
}
