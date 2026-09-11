// تحويلات الإحداثيات بين المربعات والعالم والشاشة
import { TILE_HALF_W, TILE_HALF_H } from '../config.js';

// من المربع (i, j) إلى إحداثيات العالم
export function tileToWorld(i, j) {
  return { x: (i - j) * TILE_HALF_W, y: (i + j) * TILE_HALF_H };
}

export function tileToWorldX(i, j) { return (i - j) * TILE_HALF_W; }
export function tileToWorldY(i, j) { return (i + j) * TILE_HALF_H; }

// من العالم إلى المربع (قد يرجع كسوراً)
export function worldToTile(x, y) {
  return {
    i: (x / TILE_HALF_W + y / TILE_HALF_H) / 2,
    j: (y / TILE_HALF_H - x / TILE_HALF_W) / 2
  };
}

// من الشاشة إلى العالم (حسب الكاميرا وحجم اللوحة)
export function screenToWorld(sx, sy, cam, view) {
  return {
    x: (sx - view.w / 2) / cam.z + cam.x,
    y: (sy - view.h / 2) / cam.z + cam.y
  };
}

// من العالم إلى الشاشة
export function worldToScreen(x, y, cam, view) {
  return {
    x: (x - cam.x) * cam.z + view.w / 2,
    y: (y - cam.y) * cam.z + view.h / 2
  };
}
