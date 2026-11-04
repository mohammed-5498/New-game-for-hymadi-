// جودة الرسم وتوفير البطارية (القسم 14.1): المستوى المختار في الإعدادات، أو التلقائي حسب الجهاز.
// الأرقام في GRAPHICS في config.js. الرسم وحده يتأثر: المحاكاة والبصمات كما هي
import { GRAPHICS as G } from './config.js';
import { getPref } from './prefs.js';

export function autoLevel() {
  const nav = globalThis.navigator || {};
  const mem = nav.deviceMemory || 8, cores = nav.hardwareConcurrency || 8;
  return mem <= G.auto.lowMemory || cores <= G.auto.lowCores ? 'low' : 'medium';
}

let level = 'medium';
// تُستدعى عند تغيير الإعداد: اللوحة وقطع المدينة تتبعه في الإطار التالي
export function refreshGraphics() {
  const q = getPref('quality');
  level = G.levels[q] ? q : autoLevel();
}
refreshGraphics();

export const gfxLevel = () => level;
export const gfx = () => G.levels[level];
export const viewDpr = () => Math.min(globalThis.devicePixelRatio || 1, gfx().maxDpr);
export const fpsCap = () => getPref('battery') ? G.batteryFps : gfx().fps;
