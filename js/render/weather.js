// الطقس: طبقات لونية، ندف ثلج، خطوط مطر، وإضاءة الليل
import { WEATHER } from '../config.js';

let particles = [];
let currentKey = null;

// تُعاد تهيئة الجزيئات عند تغير الطقس أو حجم الشاشة
export function resetParticles(weatherKey, view) {
  currentKey = weatherKey;
  particles = [];
  const count = WEATHER[weatherKey].particles;
  for (let k = 0; k < count; k++) {
    particles.push(weatherKey === 'snow'
      ? { x: Math.random() * view.w, y: Math.random() * view.h, vy: 18 + Math.random() * 22, vx: -4 + Math.random() * 8, r: 0.8 + Math.random() * 1.6 }
      : { x: Math.random() * (view.w + 40), y: Math.random() * view.h, vy: 420 + Math.random() * 120, vx: -70, l: 9 + Math.random() * 6 });
  }
}

export function updateParticles(weatherKey, view, dt) {
  if (weatherKey !== currentKey) resetParticles(weatherKey, view);
  for (const p of particles) {
    p.y += p.vy * dt;
    p.x += p.vx * dt + (weatherKey === 'snow' ? Math.sin(p.y * 0.03) * 12 * dt : 0);
    if (p.y > view.h + 10) { p.y = -10; p.x = Math.random() * (view.w + 40); }
    if (p.x < -20) p.x = view.w + 10;
    if (p.x > view.w + 20) p.x = -10;
  }
}

// الطبقة اللونية فوق المشهد
export function drawOverlay(ctx, weatherKey, view) {
  const overlay = WEATHER[weatherKey].overlay;
  if (!overlay) return;
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, view.w, view.h);
}

// إضاءة دافئة من النار والنوافذ والأعلام (ليلاً فقط)
export function drawLights(ctx, lights, camera, view) {
  ctx.globalCompositeOperation = 'lighter';
  for (const light of lights) {
    const sx = (light.x - camera.x) * camera.z + view.w / 2;
    const sy = (light.y - camera.y) * camera.z + view.h / 2;
    const r = light.r * camera.z;
    if (sx < -r || sy < -r || sx > view.w + r || sy > view.h + r) continue;
    const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    gradient.addColorStop(0, 'rgba(' + light.c + ',' + light.a + ')');
    gradient.addColorStop(1, 'rgba(' + light.c + ',0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, 6.2832);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

export function drawParticles(ctx, weatherKey) {
  if (weatherKey === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fill();
    }
  } else if (weatherKey === 'rain') {
    ctx.strokeStyle = 'rgba(200,215,235,.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const p of particles) {
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 2.5, p.y + p.l);
    }
    ctx.stroke();
  }
}
